"""
Hoja de vida del vehículo en PDF (/api/fleet/vehicles/{id}/pdf).
"""
import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("hoja") / "hoja.db")
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


def test_hoja_de_vida_es_un_pdf_con_el_nombre_de_la_placa(client):
    v = client.get("/api/fleet/vehicles").json()["items"][0]
    res = client.get(f"/api/fleet/vehicles/{v['id']}/pdf")
    assert res.status_code == 200 and res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF") and len(res.content) > 2000
    assert f"hoja-de-vida-{v['code']}.pdf" in res.headers["content-disposition"]
    assert "attachment" in client.get(f"/api/fleet/vehicles/{v['id']}/pdf?descargar=1").headers["content-disposition"]


def test_vehiculo_inexistente_responde_404_en_espanol(client):
    res = client.get("/api/fleet/vehicles/999999/pdf")
    assert res.status_code == 404 and "no existe" in res.json()["detail"]
