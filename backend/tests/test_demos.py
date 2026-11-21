"""
Solicitudes de demostración desde la presentación pública: validación, campo trampa, tope por conexión, aviso al buzón de
Westvane y que solo un administrador las vea, las atienda o las borre.
"""
import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.engine import auth_otp, demo, mail

ADMIN = "admin@westvane.invalid"


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("demos") / "demos.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    mp.setenv("WESTVANE_DEV_OTP", "1")
    mp.setenv("WESTVANE_OTP_COOLDOWN_S", "0")
    mp.setenv("ADMIN_EMAIL", ADMIN)
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
    monkeypatch.setenv("NOTIFY_EMAIL", "buzon@westvane.invalid")
    monkeypatch.setattr(mail, "send_text", lambda to, subject, body, attachments=None: sent.append((to, subject, body)))
    monkeypatch.setattr(mail.threading, "Thread", lambda target, daemon: type("T", (), {"start": staticmethod(target)})())
    monkeypatch.setattr(auth_otp, "send_email_code", lambda email, code: None)
    return sent


def login(client) -> dict:
    code = client.post("/api/auth/otp/request", json={"email": ADMIN}).json()["dev_code"]
    token = client.post("/api/auth/otp/verify", json={"email": ADMIN, "code": code}).json()["token"]
    return {"Authorization": f"Bearer {token}"}


GOOD = {"name": "Laura Gómez", "company": "Carga Andina SAS", "email": "Laura@CargaAndina.example", "phone": "+57 300 123 4567",
        "role": "Gerente de operaciones", "fleet_size": "11 a 50 vehículos", "message": "Queremos verla con nuestra flota.",
        "accepted": True}


def post(client, ip="203.0.113.10", **changes):
    return client.post("/api/demo-requests", json={**GOOD, **changes}, headers={"X-Forwarded-For": ip})


def test_el_formulario_trae_la_autorizacion_y_las_opciones(client):
    form = client.get("/api/demo-requests/form").json()
    assert form["consent_text"] == demo.CONSENT_TEXT and "Más de 200 vehículos" in form["fleet_sizes"]


def test_solicitud_valida_se_guarda_y_avisa_al_buzon(client, outbox):
    res = post(client)
    assert res.status_code == 201 and res.json()["request_id"]
    to, subject, body = outbox[-1]
    assert to == "buzon@westvane.invalid" and "Carga Andina SAS" in subject
    assert "laura@cargaandina.example" in body and "11 a 50" in body           # el correo se guarda en minúsculas
    row = db.run_query("SELECT consent_text, ip_hash FROM demo_requests ORDER BY request_id DESC LIMIT 1").iloc[0]
    assert row["consent_text"] == demo.CONSENT_TEXT and row["ip_hash"] and "203.0.113" not in row["ip_hash"]


@pytest.mark.parametrize("cambio, error", [
    ({"accepted": False}, "acepte"),
    ({"name": ""}, "nombre"),
    ({"company": "X"}, "corto"),
    ({"email": "no-es-correo"}, "correo"),
    ({"phone": "llámame"}, "teléfono"),
    ({"fleet_size": "Mil camiones"}, "tamaño"),
    ({"message": "x" * 1600}, "1500"),
])
def test_datos_invalidos_se_explican(client, cambio, error):
    res = post(client, ip="203.0.113.20", **cambio)
    assert res.status_code == 422 and error in res.json()["detail"]


def test_campo_trampa_descarta_en_silencio(client, outbox):
    antes = len(db.run_query("SELECT 1 FROM demo_requests"))
    res = post(client, ip="203.0.113.30", website="http://spam.example")
    assert res.status_code == 201 and res.json()["request_id"] is None
    assert len(db.run_query("SELECT 1 FROM demo_requests")) == antes and outbox == []


def test_tope_de_solicitudes_por_conexion(client, outbox):
    for _ in range(demo.MAX_PER_DAY):
        assert post(client, ip="198.51.100.7").status_code == 201
    res = post(client, ip="198.51.100.7")
    assert res.status_code == 422 and "varias solicitudes" in res.json()["detail"]
    assert post(client, ip="198.51.100.8").status_code == 201                     # otra conexión sí puede


def test_solo_un_administrador_las_ve_atiende_y_borra(client, outbox):
    rid = post(client, ip="203.0.113.40").json()["request_id"]
    assert client.get("/api/demo-requests").status_code == 401
    assert client.put(f"/api/demo-requests/{rid}/handled", json={"handled": True}).status_code == 401
    assert client.delete(f"/api/demo-requests/{rid}").status_code == 401
    h = login(client)
    lista = client.get("/api/demo-requests", headers=h).json()
    assert lista["count"] >= 1 and any(i["request_id"] == rid for i in lista["items"])
    hecha = client.put(f"/api/demo-requests/{rid}/handled", json={"handled": True}, headers=h).json()
    assert hecha["handled_at"] and hecha["handled_by"]
    assert client.delete(f"/api/demo-requests/{rid}", headers=h).status_code == 200
    assert client.delete(f"/api/demo-requests/{rid}", headers=h).status_code == 404


def test_la_cache_nunca_comparte_respuestas_con_sesion(client, monkeypatch):
    """La caché de lecturas usa solo la ruta como clave: lo que pide un administrador no puede servirse a quien no tiene
    sesión en los segundos siguientes (antes, la lista de usuarios con correos quedaba 5 s al alcance de cualquiera)."""
    from app import main
    monkeypatch.setattr(main, "CACHE_TTL_S", 30.0)
    main._bump_cache()
    h = login(client)
    for path in ("/api/admin/users", "/api/demo-requests", "/api/auth/me", "/api/companies"):
        assert client.get(path, headers=h).status_code == 200, path
        assert client.get(path).status_code == 401, path                          # sin sesión: nunca la respuesta guardada
    # Una lectura pública con sesión tampoco entra en la caché
    assert client.get("/api/settings", headers=h).headers.get("x-cache") is None
    assert client.get("/api/settings").headers.get("x-cache") == "miss"
    assert client.get("/api/settings").headers.get("x-cache") == "hit"
