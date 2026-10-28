"""Seguimiento público: enlace con token, vista sin datos internos, revocación y tope de enlaces."""
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("trk") / "trk.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    from app import main
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app) as c:
        yield c
    main.network.cache_clear()
    mp.undo()


def _new(client):
    body = {"origin": "Bogotá", "destination": "Cali", "cargo": "Café", "weight_t": 8, "priority": "costo",
            "client": "Cliente Secreto S.A.", "departure_at": (datetime.now() - timedelta(hours=2)).isoformat(timespec="minutes")}
    return client.post("/api/shipments", json=body).json()["code"]


def test_vista_publica_sin_datos_internos(client):
    code = _new(client)
    r = client.post(f"/api/shipments/{code}/tracking?usuario=Ana")
    assert r.status_code == 201
    token = r.json()["token"]
    assert len(token) >= 20 and r.json()["path"] == f"/seguimiento/{token}"
    v = client.get(f"/api/tracking/{token}")
    assert v.status_code == 200
    body = v.json()
    assert body["code"] == code and body["origin"] == "Bogotá" and body["legs"]
    text = v.text
    for secret in ("Cliente Secreto", "cost", "created_by", "Ana", "weight"):
        assert secret not in text, secret


def test_revocar_y_enlace_inexistente(client):
    code = _new(client)
    token = client.post(f"/api/shipments/{code}/tracking").json()["token"]
    assert client.get(f"/api/shipments/{code}/tracking").json()["count"] == 1
    assert client.delete(f"/api/shipments/{code}/tracking/{token}").status_code == 200
    assert client.get(f"/api/tracking/{token}").status_code == 404
    assert client.delete(f"/api/shipments/{code}/tracking/{token}").status_code == 404
    assert client.get("/api/tracking/no-existe").status_code == 404
    assert client.post("/api/shipments/NO-EXISTE/tracking").status_code == 404


def test_tope_de_enlaces_y_envio_borrado(client):
    code = _new(client)
    tokens = [client.post(f"/api/shipments/{code}/tracking").json()["token"] for _ in range(5)]
    assert client.post(f"/api/shipments/{code}/tracking").status_code == 422
    assert client.delete(f"/api/shipments/{code}").status_code in (200, 204)
    assert client.get(f"/api/tracking/{tokens[0]}").status_code == 404
