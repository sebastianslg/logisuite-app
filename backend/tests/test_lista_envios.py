"""
Lista de envíos paginada en el servidor: filtros por estado y modo, búsqueda, orden y recuentos de los chips.

Lo importante: los filtros se aplican sobre todos los envíos, no sobre la página cargada.
"""
import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("lista") / "lista.db")
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


def todo(client, **params) -> dict:
    return client.get("/api/shipments", params={"limit": 1000, **params}).json()


def test_la_pagina_trae_solo_su_parte_y_el_mismo_total(client):
    primera = client.get("/api/shipments", params={"limit": 5, "offset": 0}).json()
    segunda = client.get("/api/shipments", params={"limit": 5, "offset": 5}).json()
    assert primera["count"] == 5 and segunda["count"] == 5
    assert primera["total"] == segunda["total"] > 10
    assert not ({i["code"] for i in primera["items"]} & {i["code"] for i in segunda["items"]})
    assert primera["truncated"] is True


def test_filtro_por_un_estado_y_por_varios(client):
    uno = client.get("/api/shipments", params={"status": "En Ruta", "limit": 1000}).json()
    assert uno["total"] > 0 and all(i["status"] == "En Ruta" for i in uno["items"])

    dos = client.get("/api/shipments", params={"status": "En Ruta,Retrasado", "limit": 1000}).json()
    assert dos["total"] >= uno["total"]
    assert {i["status"] for i in dos["items"]} <= {"En Ruta", "Retrasado"}


def test_filtro_por_modo(client):
    maritimo = client.get("/api/shipments", params={"modes": "maritimo", "limit": 1000}).json()
    assert maritimo["total"] > 0
    assert all("maritimo" in i["modes"] for i in maritimo["items"])


def test_busqueda_por_codigo_ciudad_carga_y_cliente(client):
    muestra = client.get("/api/shipments", params={"limit": 1}).json()["items"][0]
    for campo in ("code", "origin", "cargo", "client"):
        valor = str(muestra[campo])
        assert valor, campo
        r = client.get("/api/shipments", params={"q": valor, "limit": 100}).json()
        assert r["total"] >= 1, campo
        assert any(muestra["code"] == i["code"] for i in r["items"]), campo


def test_los_recuentos_respetan_la_busqueda_pero_no_el_estado(client):
    """Al elegir un estado, los demás chips deben seguir mostrando cuántos hay (si no, se apagarían todos)."""
    sin_filtro = todo(client)
    assert sum(sin_filtro["counts"]["status"].values()) == sin_filtro["total"]

    con_estado = client.get("/api/shipments", params={"status": "En Ruta", "limit": 1}).json()
    assert con_estado["counts"]["status"] == sin_filtro["counts"]["status"]

    con_modo = client.get("/api/shipments", params={"modes": "aereo", "limit": 1}).json()
    assert sum(con_modo["counts"]["status"].values()) == con_modo["total"]
    assert con_modo["counts"]["modes"].get("aereo") == con_modo["total"]


def test_orden_por_estado_primero_lo_que_se_mueve(client):
    items = client.get("/api/shipments", params={"limit": 20}).json()["items"]
    orden = {"En Ruta": 0, "Retrasado": 1, "Transferencia Modal": 2, "Programado": 3, "Entregado": 4}
    valores = [orden[i["status"]] for i in items]
    assert valores == sorted(valores)
    # Y se puede pedir otro orden
    por_codigo = client.get("/api/shipments", params={"limit": 20, "sort": "codigo"}).json()["items"]
    assert [i["code"] for i in por_codigo] == sorted(i["code"] for i in por_codigo)
