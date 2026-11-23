"""
Cuenta de invitado: entra con clave pública, ve todo lo de lectura, calcula y descarga, pero nada de lo que escribe se
guarda (main.session_identity) y no ve lo de administración.
"""
import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.engine import auth_otp


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("invitado") / "invitado.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    from app import main
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app) as c:
        auth_otp.set_password_account("invitado", "12345678", "Invitado", "lector")
        yield c
    main.network.cache_clear()
    mp.undo()


@pytest.fixture(scope="module")
def auth(client):
    res = client.post("/api/auth/password", json={"identifier": "invitado", "password": "12345678"})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


def test_lee_calcula_y_descarga(client, auth):
    assert client.get("/api/shipments?limit=5", headers=auth).status_code == 200
    assert client.get("/api/dashboard/summary", headers=auth).status_code == 200
    sim = client.post("/api/routes/simulate", json={"origen": "Bogotá", "destino": "Cartagena"}, headers=auth)
    assert sim.status_code == 200, sim.text


def test_no_guarda_nada_y_lo_explica(client, auth):
    antes = client.get("/api/shipments?limit=1000").json()["count"]
    res = client.post("/api/shipments", json={"origin": "Bogotá", "destination": "Medellín", "cargo": "Prueba", "client": "X",
                                              "weight_t": 5, "departure_at": "2026-12-01T08:00"}, headers=auth)
    assert res.status_code == 403 and "Modo invitado" in res.json()["detail"]
    assert client.get("/api/shipments?limit=1000").json()["count"] == antes
    code = client.get("/api/shipments?limit=1").json()["items"][0]["code"]
    assert client.delete(f"/api/shipments/{code}", headers=auth).status_code == 403
    assert client.get(f"/api/shipments/{code}").status_code == 200


def test_tambien_por_cookie_y_sin_tocar_la_cuenta(client, auth):
    token = auth["Authorization"][7:]
    client.cookies.set("westvane_session", token)
    try:
        assert client.post("/api/fleet/vehicles", json={"code": "INV001"}).status_code == 403
    finally:
        client.cookies.clear()
    assert client.post("/api/auth/password/change", json={"current": "12345678", "new": "otra-clave-larga"}, headers=auth).status_code == 403
    assert client.post("/api/auth/sessions/close-others", headers=auth).status_code == 403


def test_no_ve_administracion(client, auth):
    assert client.get("/api/admin/users", headers=auth).status_code == 403


def test_errores_de_clave_no_bloquean_la_cuenta(client):
    for _ in range(auth_otp.MAX_PASSWORD_FAILURES + 2):
        assert client.post("/api/auth/password", json={"identifier": "invitado", "password": "mala-clave"}).status_code == 422
    assert client.post("/api/auth/password", json={"identifier": "invitado", "password": "12345678"}).status_code == 200
