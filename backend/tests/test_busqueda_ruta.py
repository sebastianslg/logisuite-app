"""
Ruta GET /api/search: lo que prueba test_busqueda_global.py a nivel de función, aquí a través de la API
(validación de parámetros y forma de la respuesta).
"""
import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("busqueda_ruta") / "busqueda.db")
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


def test_la_ruta_devuelve_la_forma_del_contrato(client):
    codigo = client.get("/api/shipments", params={"limit": 1}).json()["items"][0]["code"]
    r = client.get("/api/search", params={"q": codigo[:7]})
    assert r.status_code == 200
    cuerpo = r.json()
    assert set(cuerpo) == {"query", "items", "truncated"}
    assert any(i["type"] == "envio" and i["href"] == f"/envios/{i['title']}" for i in cuerpo["items"])


def test_menos_de_dos_caracteres_o_sin_q_da_lista_vacia(client):
    assert client.get("/api/search", params={"q": "a"}).json()["items"] == []
    assert client.get("/api/search").json()["items"] == []


def test_los_topes_de_los_parametros(client):
    assert client.get("/api/search", params={"q": "x" * 101}).status_code == 422
    assert client.get("/api/search", params={"q": "bog", "limit": 11}).status_code == 422
    assert client.get("/api/search", params={"q": "bog", "limit": 0}).status_code == 422
    assert client.get("/api/search", params={"q": "bog", "limit": 10}).status_code == 200
