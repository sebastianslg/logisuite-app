"""Pruebas del cálculo de combustible y CO2e y de sus endpoints."""
import pytest
from fastapi.testclient import TestClient

from app.engine import sustainability as SU
from app.main import app


def test_emisiones_de_un_tramo():
    e = SU.leg_emissions("terrestre", 10, 100)  # 1.000 t-km x 80 g = 80 kg
    assert e["tkm"] == 1000 and e["co2e_kg"] == pytest.approx(80)
    assert e["fuel_l"] == pytest.approx(80 / 3.24)


def test_el_aire_emite_mas_que_el_resto():
    por_modo = {m: SU.FACTORS[m].g_co2e_per_tkm for m in SU.MODE_ORDER}
    assert max(por_modo, key=por_modo.get) == "aereo"
    assert min(por_modo, key=por_modo.get) == "maritimo"


def test_combustible_consumido_es_progresivo():
    route = {"legs": [{"mode": "terrestre", "distance_km": 100, "start_h": 0, "end_h": 10},
                      {"mode": "ferreo", "distance_km": 200, "start_h": 12, "end_h": 20}]}
    a = SU.fuel_burned(route, 5, 0)["burned_l"]
    b = SU.fuel_burned(route, 5, 5)["burned_l"]
    c = SU.fuel_burned(route, 5, 20)
    assert a == 0 < b < c["burned_l"] == pytest.approx(c["total_l"])


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_summary_es_coherente(client):
    d = client.get("/api/sustainability/summary").json()
    assert [m["mode"] for m in d["by_mode"]] == list(SU.MODE_ORDER)
    assert sum(m["co2e_kg"] for m in d["by_mode"]) == pytest.approx(d["totals"]["co2e_kg"], abs=len(d["by_mode"]))
    assert len(d["co2e_14d"]) == 14
    assert d["totals"]["fuel_l"] > 0


def test_fuel_live(client):
    d = client.get("/api/sustainability/fuel-live").json()
    assert d["count"] == len(d["assets"]) > 0
    for a in d["assets"]:
        assert 0 <= a["burned_l"] <= a["total_l"]


def test_simular_incluye_huella_y_alternativas(client):
    d = client.post("/api/routes/simulate",
                    json={"origen": "Cali", "destino": "Cartagena", "prioridad": "costo", "peso_t": 20}).json()
    fp = d["footprint"]
    assert fp["co2e_kg"] > 0 and fp["fuel_l"] > 0
    assert len(fp["per_leg"]) == len(d["route"]["legs"])
    assert all("co2e_kg" in a for a in d["alternatives"] if a["found"])


def test_crear_envio_incluye_huella(client):
    from datetime import datetime
    body = {"origin": "Cali", "destination": "Cartagena", "priority": "costo", "weight_t": 12,
            "cargo": "Prueba", "client": "QA", "departure_at": datetime.now().isoformat(timespec="minutes")}
    r = client.post("/api/shipments", json=body)
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["weight_t"] == 12 and d["footprint"]["co2e_kg"] > 0
    again = client.get(f"/api/shipments/{d['code']}").json()
    assert again["footprint"]["co2e_kg"] == d["footprint"]["co2e_kg"]


def test_ciudades_traen_categoria(client):
    cities = client.get("/api/locations").json()["cities"]
    assert {c["category"] for c in cities} <= {"principal", "municipio", "dificil_acceso"}
    assert next(c for c in cities if c["city"] == "Leticia")["category"] == "dificil_acceso"
