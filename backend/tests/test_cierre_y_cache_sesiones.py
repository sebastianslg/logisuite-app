"""
Cierre de sesión con solo la cookie y caché de lecturas frente a «Mis sesiones»: la lista de una cuenta no puede
servirse a otra aunque pidan la misma URL en los mismos segundos.
"""
import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.engine import auth_otp


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("cierre") / "cierre.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    from app import main
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app) as c:
        auth_otp.set_password_account("cuenta.a", "clave-de-prueba-aaa", "Cuenta A", "admin")
        auth_otp.set_password_account("cuenta.b", "clave-de-prueba-bbb", "Cuenta B", "lector")
        yield c
    main.network.cache_clear()
    mp.undo()


def entrar(client, usuario, clave):
    r = client.post("/api/auth/password", json={"identifier": usuario, "password": clave})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def test_cerrar_sesion_con_solo_la_cookie_borra_la_sesion_de_la_base(client):
    token = entrar(client, "cuenta.a", "clave-de-prueba-aaa")
    assert client.get("/api/auth/me", headers={"cookie": f"westvane_session={token}"}).status_code == 200
    r = client.post("/api/auth/logout", headers={"cookie": f"westvane_session={token}"})
    assert r.status_code == 204
    # La sesión ya no existe en la base: ni la cookie ni el token valen
    assert client.get("/api/auth/me", headers={"cookie": f"westvane_session={token}"}).status_code == 401
    assert not db.fetch_all("SELECT 1 FROM user_sessions WHERE session_id = ?", (token,))


def test_mis_sesiones_nunca_sale_de_la_cache_de_lecturas(client, monkeypatch):
    from app import main
    monkeypatch.setattr(main, "CACHE_TTL_S", 30.0)          # la caché de 5 s encendida, como en producción
    a = entrar(client, "cuenta.a", "clave-de-prueba-aaa")
    b = entrar(client, "cuenta.b", "clave-de-prueba-bbb")
    # Mismas URL, solo la cookie cambia: cada cuenta ve las suyas
    de_a = client.get("/api/auth/sessions", headers={"cookie": f"westvane_session={a}"})
    de_b = client.get("/api/auth/sessions", headers={"cookie": f"westvane_session={b}"})
    assert de_a.status_code == de_b.status_code == 200
    assert de_a.headers.get("x-cache") is None and de_b.headers.get("x-cache") is None
    assert de_a.json() != de_b.json()
    assert all(not item["current"] or item["id"] != "" for item in de_b.json()["items"])
    assert a[:16] not in de_b.text and b[:16] not in de_a.text
