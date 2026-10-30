"""
Correos de la app: enlace de seguimiento al cliente (con sesión y tope diario), avisos al administrador y que nunca
se envíe nada sin SMTP. El envío real se sustituye por una lista: estas pruebas no mandan correos.
"""
import json
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.engine import auth_otp, delivery, fleet, mail, tracking
from test_entrega import png

ADMIN = "admin@westvane.invalid"


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("correos") / "correos.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    mp.setenv("WESTVANE_DEV_OTP", "1")
    mp.setenv("WESTVANE_OTP_COOLDOWN_S", "0")
    mp.setenv("DOMAIN", "westvane.ejemplo.invalid")
    from app import main
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app) as c:
        yield c
    main.network.cache_clear()
    mp.undo()


@pytest.fixture
def outbox(monkeypatch):
    """Con SMTP «configurado» y el envío real reemplazado por una lista."""
    sent = []
    monkeypatch.setenv("SMTP_HOST", "smtp.ejemplo.invalid")
    monkeypatch.setattr(mail, "send_text", lambda to, subject, body: sent.append((to, subject, body)))
    monkeypatch.setattr(auth_otp, "send_email_code", lambda email, code: None)  # el código de acceso no sale en estas pruebas
    return sent


def login(client, email=ADMIN) -> dict:
    code = client.post("/api/auth/otp/request", json={"email": email}).json()["dev_code"]
    return {"Authorization": f"Bearer {client.post('/api/auth/otp/verify', json={'email': email, 'code': code}).json()['token']}"}


def shipment_with_link(client, n=0):
    code = client.get("/api/shipments").json()["items"][n]["code"]
    token = client.post(f"/api/shipments/{code}/tracking", params={"usuario": "T"}).json()["token"]
    return code, token


def test_mask():
    assert mail.mask("juan.perez@empresa.com") == "j***@empresa.com"
    assert mail.mask("sin-arroba") == "***"


def test_enviar_enlace_exige_sesion_y_rol(client, outbox):
    code, token = shipment_with_link(client)
    url = f"/api/shipments/{code}/tracking/{token}/email"
    assert client.post(url, json={"email": "cliente@ejemplo.com"}).status_code == 401
    assert client.post(url, json={"email": "cliente@ejemplo.com"}, headers={"Authorization": "Bearer falso"}).status_code == 401
    # un lector solo consulta
    client.post("/api/admin/users", headers=login(client), json={"email": "lector.x@ejemplo.com", "full_name": "Lector X", "role": "lector", "company_id": None})
    assert client.post(url, json={"email": "cliente@ejemplo.com"}, headers=login(client, "lector.x@ejemplo.com")).status_code == 403
    assert outbox == []


def test_enlace_por_correo_contenido_y_sin_datos_internos(client, outbox):
    code, token = shipment_with_link(client)
    res = client.post(f"/api/shipments/{code}/tracking/{token}/email", json={"email": "Cliente.Prueba@Ejemplo.com"}, headers=login(client))
    assert res.status_code == 200 and res.json() == {"sent": True, "to": "c***@ejemplo.com"}
    to, subject, body = outbox[0]
    assert to == "cliente.prueba@ejemplo.com" and code in subject
    assert f"https://westvane.ejemplo.invalid/seguimiento/{token}" in body
    ship = db.run_query("SELECT client, total_cost FROM mm_shipments WHERE shipment_code = ?", (code,)).iloc[0]
    assert str(ship["client"]) not in body and f"{ship['total_cost']:.0f}" not in body  # ni cliente ni costos
    # La dirección completa del cliente no queda guardada: solo la enmascarada
    log = db.run_query("SELECT detail, username FROM audit_log WHERE action = 'EMAIL' ORDER BY audit_id DESC LIMIT 1").iloc[0]
    assert "c***@ejemplo.com" in log["detail"] and "cliente.prueba" not in log["detail"] and log["username"] == "admin"


def test_tope_diario_por_envio_y_validaciones(client, outbox):
    code, token = shipment_with_link(client, 1)  # otro envío: el anterior ya llevaba un correo hoy
    h = login(client)
    url = f"/api/shipments/{code}/tracking/{token}/email"
    assert client.post(url, json={"email": "no-es-correo"}, headers=h).status_code == 422
    assert client.post(f"/api/shipments/{code}/tracking/inexistente/email", json={"email": "a@ejemplo.com"}, headers=h).status_code == 404
    for i in range(tracking.MAX_EMAILS_PER_SHIPMENT_DAY):
        assert client.post(url, json={"email": f"c{i}@ejemplo.com"}, headers=h).status_code == 200
    extra = client.post(url, json={"email": "otro@ejemplo.com"}, headers=h)
    assert extra.status_code == 422 and "hoy" in extra.json()["detail"]
    # Un enlace revocado deja de poder enviarse
    other_code, other_token = shipment_with_link(client, 2)
    client.delete(f"/api/shipments/{other_code}/tracking/{other_token}", params={"usuario": "T"})
    assert client.post(f"/api/shipments/{other_code}/tracking/{other_token}/email", json={"email": "a@ejemplo.com"}, headers=h).status_code == 404


def test_sin_smtp_no_envia_nada_y_lo_dice(client, monkeypatch):
    monkeypatch.delenv("SMTP_HOST", raising=False)
    code, token = shipment_with_link(client)
    res = client.post(f"/api/shipments/{code}/tracking/{token}/email", json={"email": "a@ejemplo.com"}, headers=login(client))
    assert res.status_code == 422 and "no está configurado" in res.json()["detail"]
    assert mail.send_admin_async("x", "y") is False


def test_aviso_al_administrador_por_entrega_con_novedad(client, outbox, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "dueno@ejemplo.com")
    monkeypatch.setattr(mail.threading, "Thread", lambda target, daemon: type("T", (), {"start": staticmethod(target)})())
    code = next(i["code"] for i in client.get("/api/shipments", params={"status": "Entregado"}).json()["items"] if i["delivery_signed"] is False)
    body = {"received_by": "María Pérez", "condition": "con_novedad", "notes": "Dos cajas con el empaque roto", "signature": png(), "usuario": "T"}
    assert client.put(f"/api/shipments/{code}/delivery", json=body).status_code == 200
    to, subject, text = outbox[-1]
    assert to == "dueno@ejemplo.com" and code in subject and "empaque roto" in text
    assert "María" not in text and "base64" not in text                         # ni nombre ni firma de quien recibió
    outbox.clear()
    other = next(i["code"] for i in client.get("/api/shipments", params={"status": "Entregado"}).json()["items"] if i["delivery_signed"] is False)
    assert client.put(f"/api/shipments/{other}/delivery", json={**body, "condition": "conforme", "notes": None}).status_code == 200
    assert outbox == []                                                          # conforme: sin aviso


def test_resumen_diario_de_vencimientos_por_correo(client, outbox, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "dueno@ejemplo.com")
    monkeypatch.setattr(mail.threading, "Thread", lambda target, daemon: type("T", (), {"start": staticmethod(target)})())
    v = next(x for x in client.get("/api/fleet/vehicles", params={"mode": "terrestre"}).json()["items"] if not x["retired"])
    assert client.put(f"/api/fleet/vehicles/{v['id']}", json={"soat_expiry": (datetime.now() + timedelta(days=2)).date().isoformat(), "usuario": "T"}).status_code == 200
    fleet.notify_due(datetime.now())
    to, subject, text = outbox[-1]
    assert to == "dueno@ejemplo.com" and "por vencer" in subject
    assert f"- {v['code']}: SOAT vence en 2 d" in text and "Hoy" in text


def test_avisos_al_administrador_se_apagan_por_tipo(client, outbox, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "dueno@ejemplo.com")
    monkeypatch.setattr(mail.threading, "Thread", lambda target, daemon: type("T", (), {"start": staticmethod(target)})())
    h = login(client)

    estado = client.get("/api/settings/mail-alerts").json()
    assert estado["configured"] is True and estado["admin_email"] == "d***@ejemplo.com"   # la dirección no se muestra completa
    assert {a["kind"]: a["enabled"] for a in estado["alerts"]} == {"vencimientos": True, "novedades": True}  # encendidos por defecto

    # Cambiarlos exige sesión de administrador
    assert client.put("/api/settings/mail-alerts", json={"kind": "novedades", "enabled": False}).status_code == 401
    client.post("/api/admin/users", headers=h, json={"email": "operador.z@ejemplo.com", "full_name": "Operador Z", "role": "operador", "company_id": None})
    assert client.put("/api/settings/mail-alerts", json={"kind": "novedades", "enabled": False}, headers=login(client, "operador.z@ejemplo.com")).status_code == 403
    assert client.put("/api/settings/mail-alerts", json={"kind": "inventado", "enabled": False}, headers=h).status_code == 422

    # Apagar «vencimientos»: el resumen diario ya no sale; «novedades» sigue
    assert client.put("/api/settings/mail-alerts", json={"kind": "vencimientos", "enabled": False}, headers=h).status_code == 200
    v = next(x for x in client.get("/api/fleet/vehicles", params={"mode": "terrestre"}).json()["items"] if not x["retired"])
    client.put(f"/api/fleet/vehicles/{v['id']}", json={"soat_expiry": (datetime.now() + timedelta(days=2)).date().isoformat(), "usuario": "T"})
    outbox.clear()
    fleet.notify_due(datetime.now())
    assert outbox == []

    # Al volver a encenderlo, sale, y el correo dice cómo dejar de recibirlo
    assert client.put("/api/settings/mail-alerts", json={"kind": "vencimientos", "enabled": True}, headers=h).status_code == 200
    fleet.notify_due(datetime.now())
    to, subject, text = outbox[-1]
    assert to == "dueno@ejemplo.com" and "Para dejar de recibir estos avisos" in text and "/configuracion" in text

    # Apagar «novedades»: una entrega con novedad ya no avisa
    assert client.put("/api/settings/mail-alerts", json={"kind": "novedades", "enabled": False}, headers=h).status_code == 200
    outbox.clear()
    code = next(i["code"] for i in client.get("/api/shipments", params={"status": "Entregado"}).json()["items"] if i["delivery_signed"] is False)
    body = {"received_by": "María Pérez", "condition": "con_novedad", "notes": "Caja rota", "signature": png(), "usuario": "T"}
    assert client.put(f"/api/shipments/{code}/delivery", json=body).status_code == 200
    assert outbox == []
    # El cambio queda en el historial, firmado por quien lo hizo
    log = db.run_query("SELECT username, detail FROM audit_log WHERE table_name = 'system_params' AND detail LIKE '%novedad%' ORDER BY audit_id DESC LIMIT 1").iloc[0]
    assert log["username"] == "admin" and "desactivado" in log["detail"]
