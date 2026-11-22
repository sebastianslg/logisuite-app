"""
Ingreso con usuario (o correo) y contraseña: auth_otp.login_password, /api/auth/password y la consola app.crear_acceso.
"""
import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.engine import auth_otp
from app.engine.common import OperationError


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("acceso") / "acceso.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    from app import main
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app) as c:
        auth_otp.set_password_account("profesor", "clave-de-prueba-123", "Profesor de prueba", "admin")
        yield c
    main.network.cache_clear()
    mp.undo()


def login(client, ident, pw):
    return client.post("/api/auth/password", json={"identifier": ident, "password": pw})


def test_con_usuario_entra_como_administrador_sin_empresa_ni_correo(client):
    res = login(client, "Profesor", "clave-de-prueba-123")                      # el usuario no distingue mayúsculas
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["user"]["role"] == "admin" and body["user"]["email"] is None and body["user"]["company"] is None
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.status_code == 200 and me.json()["username"] == "profesor"
    # Como administrador ve la lista de usuarios (y la cuenta sin correo no rompe el JSON)
    users = client.get("/api/admin/users", headers={"Authorization": f"Bearer {body['token']}"})
    assert users.status_code == 200 and any(u["username"] == "profesor" for u in users.json()["items"])


def test_con_correo_tambien_entra(client):
    auth_otp.set_password_account("docente2", "otra-clave-larga-1", "Docente", "lector", "docente2@ejemplo.invalid")
    assert login(client, "DOCENTE2@ejemplo.invalid", "otra-clave-larga-1").status_code == 200
    assert login(client, "docente2", "otra-clave-larga-1").status_code == 200


def test_mismo_mensaje_si_no_existe_o_la_clave_no_coincide(client):
    a = login(client, "nadie-existe", "lo-que-sea-123")
    b = login(client, "docente2", "clave-equivocada")
    assert a.status_code == b.status_code == 422 and a.json()["detail"] == b.json()["detail"]


def test_las_cuentas_solo_con_codigo_no_entran_con_contrasena(client):
    """El relleno de password_hash de las cuentas por correo nunca coincide (no tiene el prefijo pbkdf2$)."""
    row = db.fetch_all("SELECT password_hash, salt FROM users WHERE username = 'admin'")[0]
    assert not row["password_hash"].startswith("pbkdf2$")
    assert login(client, "admin", row["password_hash"]).status_code == 422
    assert login(client, "admin@westvane.invalid", "").status_code == 422


def test_cinco_fallos_bloquean_quince_minutos_aun_con_la_clave_buena(client):
    auth_otp.set_password_account("bloqueo", "clave-buena-12345", "Bloqueo", "lector")
    for _ in range(auth_otp.MAX_PASSWORD_FAILURES):
        assert login(client, "bloqueo", "mala-mala-mala").status_code == 422
    res = login(client, "bloqueo", "clave-buena-12345")
    assert res.status_code == 422 and "Demasiados intentos" in res.json()["detail"]
    # Cambiar la contraseña desde la consola la desbloquea
    auth_otp.set_password_account("bloqueo", "clave-nueva-12345", "", "lector")
    assert login(client, "bloqueo", "clave-nueva-12345").status_code == 200


def test_cambiar_la_contrasena_cierra_las_sesiones_y_la_vieja_deja_de_valer(client):
    auth_otp.set_password_account("rotar", "primera-clave-123", "Rotar", "operador")
    token = login(client, "rotar", "primera-clave-123").json()["token"]
    auth_otp.set_password_account("rotar", "segunda-clave-123", "", "operador")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    assert login(client, "rotar", "primera-clave-123").status_code == 422
    assert login(client, "rotar", "segunda-clave-123").status_code == 200


def test_reglas_de_la_cuenta(client):
    with pytest.raises(OperationError):
        auth_otp.set_password_account("ab", "suficientemente-larga", "", "admin")       # usuario corto
    with pytest.raises(OperationError):
        auth_otp.set_password_account("corta", "123", "", "admin")                      # contraseña corta
    with pytest.raises(OperationError):
        auth_otp.set_password_account("otro", "suficientemente-larga", "", "admin", "docente2@ejemplo.invalid")  # correo ajeno
    stored = db.fetch_all("SELECT password_hash FROM users WHERE username = 'profesor'")[0]["password_hash"]
    assert stored.startswith("pbkdf2$") and "clave-de-prueba-123" not in stored


def test_cambiar_la_contrasena_pide_la_actual_y_cierra_las_demas_sesiones(client):
    clave = "clave-de-prueba-123"

    # Dos sesiones de la misma cuenta
    primera = login(client, "profesor", clave).json()
    segunda = login(client, "profesor", clave).json()
    h1 = {"Authorization": f"Bearer {primera['token']}"}
    h2 = {"Authorization": f"Bearer {segunda['token']}"}

    # Sin sesión, 401
    assert client.post("/api/auth/password/change", json={"current": "x", "new": "y" * 12}).status_code == 401
    # Contraseña actual incorrecta
    r = client.post("/api/auth/password/change", json={"current": "no-es", "new": "otra-clave-larga"}, headers=h1)
    assert r.status_code == 422 and "actual" in r.json()["detail"]
    # Nueva demasiado corta, y repetida
    assert client.post("/api/auth/password/change", json={"current": clave, "new": "corta"}, headers=h1).status_code == 422
    assert client.post("/api/auth/password/change", json={"current": clave, "new": clave}, headers=h1).status_code == 422

    # Cambio correcto
    nueva = "clave-nueva-de-pruebas"
    ok = client.post("/api/auth/password/change", json={"current": clave, "new": nueva}, headers=h1)
    assert ok.status_code == 200, ok.text

    # La sesión que hizo el cambio sigue viva; la otra se cerró
    assert client.get("/api/auth/me", headers=h1).status_code == 200
    assert client.get("/api/auth/me", headers=h2).status_code == 401

    # La contraseña vieja ya no entra y la nueva sí
    assert login(client, "profesor", clave).status_code == 422
    assert login(client, "profesor", nueva).status_code == 200

    # El historial lo registra sin la contraseña
    log = db.run_query("SELECT detail FROM audit_log WHERE detail LIKE 'Contraseña cambiada%' ORDER BY audit_id DESC LIMIT 1")
    assert not log.empty and "clave-nueva" not in log.iloc[0]["detail"]

    # Se deja como estaba para las demás pruebas
    auth_otp.set_password_account("profesor", clave, "Profesor de prueba", "admin", operator="pruebas")


def test_una_cuenta_sin_contrasena_no_puede_cambiarla(client, monkeypatch):
    monkeypatch.setenv("WESTVANE_DEV_OTP", "1")
    monkeypatch.setenv("WESTVANE_OTP_COOLDOWN_S", "0")
    auth_otp.create_user_record("sin.clave@ejemplo.com", "Sin Clave", "lector", None, operator="T")
    # Entra con código y prueba a cambiar la contraseña
    pedido = client.post("/api/auth/otp/request", json={"email": "sin.clave@ejemplo.com"}).json()
    assert "dev_code" in pedido, pedido
    token = client.post("/api/auth/otp/verify", json={"email": "sin.clave@ejemplo.com", "code": pedido["dev_code"]}).json()["token"]
    r = client.post("/api/auth/password/change", json={"current": "x", "new": "una-clave-larga"},
                    headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 422 and "código al correo" in r.json()["detail"]
    # Y su sesión dice que no tiene contraseña (para no mostrarle el formulario)
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["has_password"] is False
