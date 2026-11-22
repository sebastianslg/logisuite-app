"""
Caché del navegador para las dos lecturas que casi no cambian: la red multimodal y los departamentos.

Las dos responden 200 con `ETag` y `Cache-Control: no-cache` (guardar, pero revalidar siempre) y 304 sin cuerpo cuando
el cliente repite el `If-None-Match`. El ETag cambia si cambia el contenido: un nodo o una vía editados, un envío nuevo
que suma toneladas. Las demás lecturas siguen sin ETag. Usa una base SQLite temporal propia, como test_guard.
"""
import time
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app.database.db import run_write


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("etag") / "etag.db")
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


@pytest.mark.parametrize("ruta", ["/api/network/multimodal", "/api/geo/departments"])
def test_lectura_revalidable_con_etag(client, ruta):
    r = client.get(ruta)
    assert r.status_code == 200
    etag = r.headers.get("etag")
    assert etag and etag.startswith('"')
    assert r.headers["cache-control"] == "no-cache"
    assert r.headers["content-type"].startswith("application/json")
    assert r.content  # el 200 sí trae cuerpo

    again = client.get(ruta, headers={"If-None-Match": etag})
    assert again.status_code == 304
    assert again.content == b""
    assert again.headers["etag"] == etag
    assert again.headers["cache-control"] == "no-cache"


@pytest.mark.parametrize("ruta", ["/api/network/multimodal", "/api/geo/departments"])
def test_el_if_none_match_ajeno_no_corta_la_respuesta(client, ruta):
    """Un ETag de otra versión (o de otra ruta) siempre recibe el 200 completo, no un 304 equivocado."""
    r = client.get(ruta, headers={"If-None-Match": '"otra-version"'})
    assert r.status_code == 200
    assert r.headers.get("etag")


def test_el_etag_de_la_red_cambia_al_editar_un_nodo_y_un_enlace(client):
    from app import main
    antes = client.get("/api/network/multimodal")
    etag = antes.headers["etag"]
    nodo = antes.json()["nodes"]["features"][0]["properties"]["code"]
    enlace = antes.json()["links"]["features"][0]["properties"]["id"]

    run_write("UPDATE mm_nodes SET name = name || ' (en prueba)' WHERE node_code = ?", (nodo,))
    run_write("UPDATE mm_links SET capacity_t = capacity_t + 10 WHERE link_id = ?", (enlace,))
    main.network.cache_clear()          # el motor guarda la red en memoria
    main._last_sync = time.monotonic()  # sin sincronización a mitad de la prueba

    despues = client.get("/api/network/multimodal", headers={"If-None-Match": etag})
    assert despues.status_code == 200, "un nodo o una vía editados tienen que cambiar el ETag"
    assert despues.headers["etag"] != etag
    assert despues.json()["nodes"]["features"][0]["properties"]["name"].endswith("(en prueba)")


def test_el_etag_de_departamentos_cambia_con_un_envio(client):
    from app import main
    antes = client.get("/api/geo/departments")
    etag = antes.headers["etag"]
    total = sum(f["properties"]["traffic_t"] for f in antes.json()["features"])

    r = client.post("/api/shipments", json={
        "origin": "Bogotá", "destination": "Cartagena", "cargo": "Prueba de ETag", "weight_t": 40,
        "priority": "costo", "client": "Pruebas",
        "departure_at": (datetime.now() - timedelta(hours=2)).isoformat(timespec="minutes"), "usuario": "Pruebas",
    })
    assert r.status_code == 201, r.text
    main._last_sync = 0.0  # que la siguiente lectura vuelva a sincronizar la operación

    despues = client.get("/api/geo/departments", headers={"If-None-Match": etag})
    assert despues.status_code == 200, "un envío nuevo que suma toneladas tiene que cambiar el ETag"
    assert despues.headers["etag"] != etag
    assert sum(f["properties"]["traffic_t"] for f in despues.json()["features"]) > total


def test_las_demas_lecturas_no_llevan_etag(client):
    r = client.get("/api/shipments")
    assert r.status_code == 200
    assert "etag" not in {k.lower() for k in r.headers}


def test_el_etag_sobrevive_a_la_cache_de_lectura(client, monkeypatch):
    """La caché de lecturas del servidor (5 s en producción) rehace la respuesta y perdería las cabeceras; estas dos
    rutas quedan fuera de ella a propósito."""
    from app import main
    monkeypatch.setattr(main, "CACHE_TTL_S", 5.0)
    try:
        r = client.get("/api/network/multimodal")
        assert r.status_code == 200 and r.headers.get("etag")
        assert r.headers["cache-control"] == "no-cache"
        assert client.get("/api/network/multimodal", headers={"If-None-Match": r.headers["etag"]}).status_code == 304
    finally:
        main._cache.clear()
