"""
Mensajes de error de la API en español, sin detalles internos (B3, tanda 3).
"""
import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("errores") / "errores.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    from app import main
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app, raise_server_exceptions=False) as c:
        yield c
    main.network.cache_clear()
    mp.undo()


def _msgs(res):
    assert res.status_code == 422, res.text
    return " ".join(e["msg"] for e in res.json()["detail"])


def test_campo_faltante_y_texto_largo_en_espanol(client):
    m = _msgs(client.post("/api/routes/simulate", json={"destino": "Cartagena"}))
    assert "Falta «origen»" in m and "Field required" not in m
    m = _msgs(client.post("/api/routes/simulate", json={"origen": "x" * 5000, "destino": "Cartagena"}))
    assert "demasiado largo" in m and "at most" not in m


def test_numero_invalido_y_fuera_de_rango(client):
    assert "debe ser un número" in _msgs(client.post("/api/routes/simulate", json={"origen": "Bogotá", "destino": "Cali", "peso_t": "mucho"}))
    assert "Valid" not in _msgs(client.get("/api/history?days=0"))


def test_no_devuelve_el_valor_recibido(client):
    secreto = "dato-personal-" + "z" * 4000
    res = client.post("/api/routes/simulate", json={"origen": secreto, "destino": "Cartagena"})
    assert secreto not in res.text and all("input" not in e for e in res.json()["detail"])


def test_json_roto(client):
    res = client.post("/api/routes/simulate", content=b"{no es json", headers={"content-type": "application/json"})
    assert "JSON válido" in _msgs(res)


def test_lo_que_no_existe_responde_en_espanol(client):
    assert "no existe" in client.get("/api/fleet/vehicles/999999").json()["detail"]
    assert client.get("/api/shipments/NO-EXISTE").status_code == 404
