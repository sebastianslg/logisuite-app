"""Tablero «Hoy»: cada lista trae lo que corresponde a su ventana y nada más."""
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from test_entrega import png


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("hoy") / "hoy.db")
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


def test_ventanas(client):
    b = client.get("/api/today").json()
    now = datetime.fromisoformat(b["now"])
    assert set(b["counts"]) >= {"departures", "arrivals", "to_sign", "incidents", "fleet_documents", "late_arrivals"}
    for d in b["departures"]:
        assert now <= datetime.fromisoformat(d["at"]) <= now + timedelta(hours=24) and 0 <= d["in_h"] <= 24
    for a in b["arrivals"]:
        assert now <= datetime.fromisoformat(a["at"]) <= now + timedelta(hours=24)
    for t in b["to_sign"]:
        assert now - timedelta(days=7) <= datetime.fromisoformat(t["at"]) <= now and t["in_h"] <= 0
    assert [d["at"] for d in b["departures"]] == sorted(d["at"] for d in b["departures"])
    assert all(d["days_left"] <= 7 for d in b["fleet_documents"])


def test_salida_nueva_aparece_y_al_firmar_sale_de_por_firmar(client):
    dep = (datetime.now() + timedelta(hours=5)).isoformat(timespec="minutes")
    r = client.post("/api/shipments", json={"origin": "Bogotá", "destination": "Tunja", "cargo": "Hoy", "weight_t": 3,
                                            "client": "QA", "priority": "costo", "departure_at": dep, "usuario": "Ana"})
    code = r.json()["code"]
    b = client.get("/api/today").json()
    mine = next(d for d in b["departures"] if d["code"] == code)
    assert 4.5 <= mine["in_h"] <= 5.1 and mine["origin"] == "Bogotá"
    pending = b["to_sign"]
    if not pending:
        pytest.skip("no hay entregas recientes sin firmar en la semilla")
    first = pending[0]["code"]
    ok = client.put(f"/api/shipments/{first}/delivery", json={"received_by": "Luz Gómez", "signature": png(), "usuario": "Ana"})
    assert ok.status_code == 200, ok.text
    assert first not in {t["code"] for t in client.get("/api/today").json()["to_sign"]}


def test_incidencia_del_dia(client):
    items = client.get("/api/shipments", params={"status": "En Ruta"}).json()["items"]
    if not items:
        pytest.skip("no hay envíos en ruta")
    code = items[0]["code"]
    r = client.post(f"/api/shipments/{code}/events", json={"kind": "paro", "body": "Paro en la vía (prueba hoy)", "delay_h": 0, "usuario": "Ana"})
    assert r.status_code == 201, r.text
    inc = client.get("/api/today").json()["incidents"]
    assert any(i["code"] == code and "prueba hoy" in i["body"] for i in inc)
