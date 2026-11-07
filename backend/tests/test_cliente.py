"""
Avisos al cliente por correo cuando su envío cambia de estado: alta del correo, disparo una sola vez por estado, contenido
sin datos internos y borrado por el plazo de conservación.
"""
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.engine import client_notify, mail


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("cliente") / "cliente.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    mp.setenv("WESTVANE_DEV_OTP", "1")
    mp.setenv("WESTVANE_OTP_COOLDOWN_S", "0")
    mp.setenv("DOMAIN", "westvane.ejemplo.invalid")
    mp.delenv("SMTP_HOST", raising=False)
    from app import main
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app) as c:
        yield c
    main.network.cache_clear()
    mp.undo()


@pytest.fixture
def outbox(monkeypatch):
    sent = []
    monkeypatch.setenv("SMTP_HOST", "smtp.ejemplo.invalid")
    monkeypatch.setattr(mail, "send_text", lambda to, subject, body, attachments=None: sent.append((to, subject, body)))
    return sent


def login(client) -> dict:
    code = client.post("/api/auth/otp/request", json={"email": "admin@westvane.invalid"}).json()["dev_code"]
    token = client.post("/api/auth/otp/verify", json={"email": "admin@westvane.invalid", "code": code}).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def con_estado(client, estado: str) -> str:
    return client.get("/api/shipments", params={"status": estado, "limit": 1}).json()["items"][0]["code"]


def test_el_correo_del_cliente_exige_sesion_y_valida(client):
    code = con_estado(client, "En Ruta")
    url = f"/api/shipments/{code}/client-email"
    assert client.put(url, json={"email": "cliente@ejemplo.com"}).status_code == 401
    h = login(client)
    assert client.put(url, json={"email": "no-es-correo"}, headers=h).status_code == 422
    assert client.put("/api/shipments/NO-EXISTE/client-email", json={"email": "a@b.co"}, headers=h).status_code == 404
    ok = client.put(url, json={"email": "Cliente@Ejemplo.com"}, headers=h)
    assert ok.status_code == 200 and ok.json()["client_email"] == "cliente@ejemplo.com"
    assert client.get(f"/api/shipments/{code}").json()["client_email"] == "cliente@ejemplo.com"
    # El historial guarda la dirección enmascarada, no completa
    log = db.run_query("SELECT detail FROM audit_log WHERE record_id = ? ORDER BY audit_id DESC LIMIT 1", (code,)).iloc[0]
    assert "c***@ejemplo.com" in log["detail"] and "cliente@ejemplo.com" not in log["detail"]
    # Se puede borrar
    assert client.put(url, json={"email": None}, headers=h).json()["client_email"] is None


def test_avisa_al_salir_una_sola_vez_y_sin_datos_internos(client, outbox):
    code = con_estado(client, "En Ruta")
    client.put(f"/api/shipments/{code}/client-email", json={"email": "cliente@ejemplo.com"}, headers=login(client))
    outbox.clear()
    assert client_notify.check(datetime.now()) >= 1
    to, subject, body = outbox[-1]
    assert to == "cliente@ejemplo.com" and code in subject and "ya salió" in body
    # Sin costos ni nombre del cliente
    ship = db.run_query("SELECT client, total_cost FROM mm_shipments WHERE shipment_code = ?", (code,)).iloc[0]
    assert str(ship["client"]) not in body and f"{ship['total_cost']:.0f}" not in body
    # No se repite en la siguiente pasada
    n = len(outbox)
    assert client_notify.check(datetime.now()) == 0 and len(outbox) == n


def test_avisa_cuando_llega(client, outbox):
    code = con_estado(client, "Entregado")
    client.put(f"/api/shipments/{code}/client-email", json={"email": "cliente@ejemplo.com"}, headers=login(client))
    outbox.clear()
    assert client_notify.check(datetime.now()) >= 1
    to, subject, body = outbox[-1]
    assert to == "cliente@ejemplo.com" and "llegó" in subject
    n = len(outbox)
    assert client_notify.check(datetime.now()) == 0 and len(outbox) == n


def test_sin_correo_no_avisa_y_sin_smtp_tampoco(client, outbox, monkeypatch):
    code = con_estado(client, "En Ruta")
    client.put(f"/api/shipments/{code}/client-email", json={"email": None}, headers=login(client))
    outbox.clear()
    assert client_notify.check(datetime.now()) == 0 and outbox == []
    client.put(f"/api/shipments/{code}/client-email", json={"email": "cliente@ejemplo.com"}, headers=login(client))
    monkeypatch.delenv("SMTP_HOST", raising=False)
    assert client_notify.check(datetime.now()) == 0 and outbox == []


def test_el_seguimiento_publico_no_muestra_el_correo(client):
    code = con_estado(client, "En Ruta")
    client.put(f"/api/shipments/{code}/client-email", json={"email": "cliente@ejemplo.com"}, headers=login(client))
    token = client.post(f"/api/shipments/{code}/tracking", params={"usuario": "T"}).json()["token"]
    texto = str(client.get(f"/api/tracking/{token}").json())
    assert "cliente@ejemplo.com" not in texto and "client_email" not in texto


def test_la_direccion_se_borra_con_el_plazo(client):
    code = con_estado(client, "Entregado")
    client.put(f"/api/shipments/{code}/client-email", json={"email": "cliente@ejemplo.com"}, headers=login(client))
    db.run_write("UPDATE mm_shipments SET eta_at = ? WHERE shipment_code = ?",
                 ((datetime.now() - timedelta(days=40)).isoformat(timespec="minutes"), code))
    assert client_notify.purge_emails(datetime.now(), 30) >= 1
    assert client.get(f"/api/shipments/{code}").json()["client_email"] is None
    assert client_notify.purge_emails(datetime.now(), 0) == 0          # sin plazo no borra nada
