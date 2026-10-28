"""Costo real contra estimado (envío y cliente) y matriz de retrasos por vía y día. Base SQLite temporal propia."""
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("costo") / "costo.db")
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


def _new(client, **kw):
    body = {"origin": "Bogotá", "destination": "Medellín", "cargo": "Repuestos", "weight_t": 10, "priority": "costo",
            "client": "Cliente Costo Real", "departure_at": (datetime.now() - timedelta(hours=3)).isoformat(timespec="minutes"), **kw}
    r = client.post("/api/shipments", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_costo_real_y_desviacion(client):
    s = _new(client)
    est = s["cost"]
    r = client.put(f"/api/shipments/{s['code']}/actual-cost", json={"amount": round(est * 1.1, 2), "note": "Factura 123", "usuario": "Ana"})
    assert r.status_code == 200 and abs(r.json()["variance_pct"] - 10) < 0.2
    d = client.get(f"/api/shipments/{s['code']}").json()
    assert d["actual_cost"]["note"] == "Factura 123" and d["actual_cost"]["by"] == "Ana"
    assert abs(d["actual_cost"]["variance_pct"] - 10) < 0.2
    c = next(x for x in client.get("/api/clients").json()["items"] if x["client"] == "Cliente Costo Real")
    assert c["actual"]["shipments"] == 1 and abs(c["actual"]["variance_pct"] - 10) < 0.2
    # Borrar
    assert client.put(f"/api/shipments/{s['code']}/actual-cost", json={"amount": None}).json()["actual_cost"] is None
    assert client.get(f"/api/shipments/{s['code']}").json()["actual_cost"] is None


def test_costo_real_en_cop_y_validaciones(client):
    s = _new(client)
    assert client.put("/api/settings/fx", json={"rate": 4000, "date": "2026-10-28", "source": "Prueba"}).status_code in (200, 201)
    r = client.put(f"/api/shipments/{s['code']}/actual-cost", json={"amount": 4_000_000, "moneda": "COP"})
    assert r.status_code == 200 and r.json()["actual_cost"] == 1000.0
    assert client.put(f"/api/shipments/{s['code']}/actual-cost", json={"amount": 0}).status_code == 422
    assert client.put(f"/api/shipments/{s['code']}/actual-cost", json={"amount": -5}).status_code == 422
    assert client.put("/api/shipments/NO-EXISTE/actual-cost", json={"amount": 10}).status_code == 404


def test_retrasos_por_via_y_dia(client):
    s = _new(client, departure_at=(datetime.now() - timedelta(hours=5)).isoformat(timespec="minutes"))
    client.post(f"/api/shipments/{s['code']}/events", json={"kind": "derrumbe", "body": "Derrumbe", "delay_h": 6})
    h = client.get("/api/history?days=30").json()
    assert h["delays"], "debe haber al menos una vía con retraso"
    row = h["delays"][0]
    assert len(row["hours"]) == 7 and row["total_h"] >= 6 and sum(row["shipments"]) >= 1
    weekday = (datetime.now() - timedelta(hours=5)).weekday()
    assert any(d["hours"][weekday] >= 6 for d in h["delays"])
