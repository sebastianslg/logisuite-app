"""
Pruebas de la API FastAPI (TestClient, sin servidor).
Ejecución: pytest -v  (desde backend/)
"""
import re

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_red_multimodal_es_geojson(client):
    data = client.get("/api/network/multimodal").json()
    assert data["nodes"]["type"] == data["links"]["type"] == "FeatureCollection"
    p = data["nodes"]["features"][0]
    assert p["geometry"]["type"] == "Point" and len(p["geometry"]["coordinates"]) == 2
    modos = {f["properties"]["mode"] for f in data["links"]["features"]}
    assert modos == {"terrestre", "fluvial", "maritimo", "aereo", "ferreo"}
    for f in data["links"]["features"]:
        assert f["geometry"]["type"] == "LineString" and len(f["geometry"]["coordinates"]) >= 2


def test_simular_leticia_cartagena(client):
    r = client.post("/api/routes/simulate",
                    json={"origen": "Leticia", "destino": "Cartagena", "prioridad": "tiempo", "peso_t": 5})
    assert r.status_code == 200
    route = r.json()["route"]
    assert route["modes"] == ["aereo", "aereo"]
    assert route["legs"][0]["from"]["code"] == "LET-AIR"
    assert route["legs"][1]["to"]["code"] == "CTG-AIR"
    assert route["transfers"][0]["label"] == "Conexión aérea"
    # Recorrido animable: mismas longitudes y tiempos crecientes
    trip = route["trip"]
    assert len(trip["path"]) == len(trip["timestamps"])
    assert trip["timestamps"] == sorted(trip["timestamps"])
    assert len(r.json()["alternatives"]) == 3


def test_formato_numerico_limpio(client):
    route = client.post("/api/routes/simulate",
                        json={"origen": "Leticia", "destino": "Cartagena", "prioridad": "balanceado",
                              "peso_t": 5}).json()["route"]
    assert isinstance(route["cost"], int) and isinstance(route["distance_km"], int)
    assert re.fullmatch(r"US\$ \d{1,3}(\.\d{3})*", route["cost_fmt"])
    assert re.fullmatch(r"\d{1,3}(\.\d{3})* km", route["distance_fmt"])
    assert route["weight_fmt"] == "5 t"  # sin ",0"


def test_simular_con_origen_desconocido_da_422(client):
    r = client.post("/api/routes/simulate", json={"origen": "Atlántida", "destino": "Cartagena"})
    assert r.status_code == 422
    assert "desconocida" in r.json()["detail"]


def test_flota_en_vivo(client):
    data = client.get("/api/fleet/live").json()
    assert data["count"] >= 1
    a = data["assets"][0]
    assert -5 < a["lat"] < 13 and -82 < a["lon"] < -66
    assert a["status"] in ("En Ruta", "Transferencia Modal", "Retrasado")
    # El recorrido está referido a "ahora": hay marcas negativas (pasado) y positivas
    ts = a["trip"]["timestamps"]
    assert ts[0] <= 0 <= ts[-1]


def test_envios_y_detalle(client):
    data = client.get("/api/shipments").json()
    assert data["count"] > 0
    code = data["items"][0]["code"]
    det = client.get(f"/api/shipments/{code}").json()
    assert det["code"] == code and det["legs"]
    assert client.get("/api/shipments/NO-EXISTE").status_code == 404


def test_departamentos_con_trafico(client):
    data = client.get("/api/geo/departments").json()
    assert len(data["features"]) == 33  # 32 departamentos + Bogotá D.C.
    assert max(f["properties"]["intensity"] for f in data["features"]) == 1.0


def test_resumen_dashboard(client):
    data = client.get("/api/dashboard/summary").json()
    assert sum(m["share_pct"] for m in data["modal_split"]) == pytest.approx(100, abs=0.5)
    assert data["kpis"]["active"]["value"] >= 1
