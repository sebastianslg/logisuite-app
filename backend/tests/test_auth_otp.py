"""
Pruebas de autenticación sin contraseña (OTP por correo), empresas y roles.

Cubren también lo que NO debe pasar: el código no viaja en la respuesta fuera del modo de desarrollo, los endpoints
de administración exigen sesión de administrador y el último administrador no se puede degradar.
"""
import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.engine import auth_otp

ADMIN = "admin@westvane.invalid"  # los correos de la semilla usan un dominio reservado (RFC 2606): no existe


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("auth") / "auth.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    mp.setenv("WESTVANE_DEV_OTP", "1")          # solo pruebas: el código viaja en la respuesta
    mp.setenv("WESTVANE_OTP_COOLDOWN_S", "0")
    mp.delenv("SMTP_HOST", raising=False)
    mp.delenv("ADMIN_EMAIL", raising=False)
    from app import main
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app) as c:
        yield c
    main.network.cache_clear()
    mp.undo()


def login(client, email=ADMIN) -> dict:
    code = client.post("/api/auth/otp/request", json={"email": email}).json()["dev_code"]
    res = client.post("/api/auth/otp/verify", json={"email": email, "code": code})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


def test_request_otp_invalid_email(client):
    assert client.post("/api/auth/otp/request", json={"email": "no-es-correo"}).status_code == 422


def test_correo_no_registrado_no_se_distingue_de_uno_registrado(client):
    """No se puede averiguar quién tiene cuenta: misma respuesta, y sin código."""
    res = client.post("/api/auth/otp/request", json={"email": "desconocido@correo.com"})
    assert res.status_code == 200 and res.json()["ok"] is True and res.json()["dev_code"] is None
    assert db.run_query("SELECT 1 FROM auth_codes WHERE email = 'desconocido@correo.com'").empty
    known = client.post("/api/auth/otp/request", json={"email": ADMIN}).json()
    assert known["message"].replace(ADMIN, "X") == res.json()["message"].replace("desconocido@correo.com", "X")


def test_otp_flow_and_session(client):
    res = client.post("/api/auth/otp/request", json={"email": ADMIN})
    assert res.status_code == 200
    code = res.json()["dev_code"]
    assert len(code) == 6 and code.isdigit()

    wrong = client.post("/api/auth/otp/verify", json={"email": ADMIN, "code": "000000" if code != "000000" else "111111"})
    assert wrong.status_code == 422 and "incorrecto" in wrong.json()["detail"]

    ok = client.post("/api/auth/otp/verify", json={"email": ADMIN, "code": code})
    assert ok.status_code == 200
    token, user = ok.json()["token"], ok.json()["user"]
    assert user["email"] == ADMIN and user["role"] == "admin"
    assert user["company"] is not None and user["company"]["nit"] is None  # sin NIT inventado

    assert client.post("/api/auth/otp/verify", json={"email": ADMIN, "code": code}).status_code == 422  # un solo uso

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["email"] == ADMIN
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer token_falso"}).status_code == 401

    assert client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"}).status_code == 204
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_sin_correo_configurado_y_sin_modo_de_desarrollo_no_se_inicia_sesion(client, monkeypatch):
    """Producción sin SMTP: ni se entrega el código ni se devuelve en la respuesta."""
    monkeypatch.delenv("WESTVANE_DEV_OTP", raising=False)
    monkeypatch.delenv("SMTP_HOST", raising=False)
    res = client.post("/api/auth/otp/request", json={"email": ADMIN})
    assert res.status_code == 422 and "no está configurado" in res.json()["detail"]
    assert "dev_code" not in res.json().get("detail", "")


def test_con_correo_configurado_el_codigo_no_viaja_en_la_respuesta(client, monkeypatch):
    sent = []
    monkeypatch.delenv("WESTVANE_DEV_OTP", raising=False)
    monkeypatch.setenv("SMTP_HOST", "smtp.ejemplo.invalid")
    monkeypatch.setattr(auth_otp, "send_email_code", lambda email, code: sent.append((email, code)))
    res = client.post("/api/auth/otp/request", json={"email": ADMIN})
    assert res.status_code == 200 and res.json()["dev_code"] is None
    assert sent and sent[0][0] == ADMIN and len(sent[0][1]) == 6  # el código solo va por el correo


def test_un_codigo_nuevo_por_minuto(client, monkeypatch):
    monkeypatch.setenv("WESTVANE_OTP_COOLDOWN_S", "60")
    assert client.post("/api/auth/otp/request", json={"email": "operador@westvane.invalid"}).status_code == 200
    again = client.post("/api/auth/otp/request", json={"email": "operador@westvane.invalid"})
    assert again.status_code == 422 and "Espera" in again.json()["detail"]


def test_administrar_exige_sesion_de_administrador(client):
    body = {"email": "intruso@example.com", "full_name": "Intruso", "role": "admin", "company_id": None}
    for method, url, payload in (
        ("get", "/api/companies", None), ("get", "/api/admin/users", None),
        ("post", "/api/companies", {"name": "Falsa"}), ("post", "/api/admin/users", body),
        ("put", "/api/admin/users/1/role", {"role": "admin"}),
    ):
        res = getattr(client, method)(url, **({"json": payload} if payload else {}))
        assert res.status_code == 401, (method, url, res.status_code)
    # Un operador tampoco puede
    op = login(client, "operador@westvane.invalid")
    assert client.get("/api/companies", headers=op).status_code == 403
    assert client.post("/api/admin/users", json=body, headers=op).status_code == 403
    assert client.put("/api/admin/users/1/role", json={"role": "admin"}, headers=op).status_code == 403
    assert db.run_query("SELECT 1 FROM users WHERE email = 'intruso@example.com'").empty


def test_empresas_y_usuarios_como_administrador(client):
    h = login(client)
    companies = client.get("/api/companies", headers=h).json()["items"]
    assert len(companies) >= 1

    new_c = client.post("/api/companies", json={"name": "Transportes del Caribe S.A.", "nit": "800.123.456-1"}, headers=h)
    assert new_c.status_code == 201
    company = new_c.json()
    assert client.post("/api/companies", json={"name": "Transportes del Caribe S.A."}, headers=h).status_code == 422  # duplicada

    created = client.post("/api/admin/users", headers=h, json={
        "email": "carolina.logistica@caribe.com", "full_name": "Carolina Herrera", "role": "operador",
        "company_id": company["company_id"]})
    assert created.status_code == 201
    user = created.json()
    assert user["role"] == "operador" and user["company_id"] == company["company_id"]
    # El historial queda firmado por quien tenía la sesión, no por un nombre que se escribe en la URL
    log = db.run_query("SELECT username FROM audit_log WHERE detail LIKE '%carolina.logistica%' ORDER BY audit_id DESC LIMIT 1")
    assert log.iloc[0]["username"] == "admin"

    role = client.put(f"/api/admin/users/{user['user_id']}/role", json={"role": "lector"}, headers=h)
    assert role.status_code == 200 and role.json()["role"] == "lector"
    assert client.put(f"/api/admin/users/{user['user_id']}/role", json={"role": "jefe"}, headers=h).status_code == 422

    assert client.post("/api/auth/otp/request", json={"email": "carolina.logistica@caribe.com"}).json()["dev_code"]


def test_no_se_degrada_al_ultimo_administrador(client):
    h = login(client)
    admins = db.run_query("SELECT user_id FROM users WHERE role = 'admin' AND active = 1 AND email IS NOT NULL")
    assert len(admins) == 1
    res = client.put(f"/api/admin/users/{int(admins.iloc[0]['user_id'])}/role", json={"role": "lector"}, headers=h)
    assert res.status_code == 422 and "al menos un administrador" in res.json()["detail"]


def test_primer_administrador_desde_el_env(client, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "Dueño@Ejemplo.com")
    monkeypatch.setenv("ADMIN_NAME", "El Dueño")
    auth_otp.ensure_bootstrap_admin()
    auth_otp.ensure_bootstrap_admin()  # idempotente
    rows = db.run_query("SELECT role, active, full_name FROM users WHERE LOWER(email) = 'dueño@ejemplo.com'")
    assert len(rows) == 1 and rows.iloc[0]["role"] == "admin" and rows.iloc[0]["active"] == 1
    # Si alguien lo degradó o lo desactivó, el arranque lo restablece
    db.run_write("UPDATE users SET role = 'lector', active = 0 WHERE LOWER(email) = 'dueño@ejemplo.com'")
    auth_otp.ensure_bootstrap_admin()
    again = db.run_query("SELECT role, active FROM users WHERE LOWER(email) = 'dueño@ejemplo.com'")
    assert again.iloc[0]["role"] == "admin" and again.iloc[0]["active"] == 1
    monkeypatch.setenv("ADMIN_EMAIL", "no-es-un-correo")
    auth_otp.ensure_bootstrap_admin()  # no falla ni crea nada
    assert db.run_query("SELECT 1 FROM users WHERE email = 'no-es-un-correo'").empty
