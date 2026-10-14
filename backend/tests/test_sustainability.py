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
