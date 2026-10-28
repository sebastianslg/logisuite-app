"""Remesa en PDF, alias /api/v1 y registro de errores del navegador. Base SQLite temporal propia."""
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("opx") / "opx.db")
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


def test_remesa_pdf(client):
    body = {"origin": "Bogotá", "destination": "Cartagena", "cargo": "Café verde", "weight_t": 20, "priority": "costo",
            "client": "Cafés de prueba", "departure_at": (datetime.now() - timedelta(hours=1)).isoformat(timespec="minutes")}
    code = client.post("/api/shipments", json=body).json()["code"]
    r = client.get(f"/api/shipments/{code}/remesa")
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF") and len(r.content) > 1500
    assert "inline" in r.headers["content-disposition"]
    assert "attachment" in client.get(f"/api/shipments/{code}/remesa?descargar=true").headers["content-disposition"]
    assert client.get("/api/shipments/NO-EXISTE/remesa").status_code == 404


def test_alias_v1(client):
    a = client.get("/api/v1/health")
    assert a.status_code == 200 and a.json() == client.get("/api/health").json()
    assert a.headers["x-api-version"] == "1"
    assert client.get("/api/v1/legal").json()["versions"] == client.get("/api/legal").json()["versions"]


def test_errores_del_navegador(client):
    r = client.post("/api/client-errors", json={"path": "/envios?cliente=Juan#x", "message": "TypeError: x is undefined",
                                                "stack": "at f (a.js:1:2)", "release": "abc123"},
                    headers={"user-agent": "Prueba/2"})
    assert r.status_code == 204
    items = client.get("/api/client-errors").json()["items"]
    assert items[0]["path"] == "/envios" and items[0]["message"].startswith("TypeError")
    assert items[0]["user_agent"] == "Prueba/2"
    assert client.post("/api/client-errors", json={"path": "/", "message": ""}).status_code == 422
