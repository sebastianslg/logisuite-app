"""
Lista de envíos recordada en memoria (main._envios_leidos).

`/api/shipments` era la lectura más cara de la API que todavía se recalculaba en cada consulta: el total, los recuentos
de los chips y las filas sobre mm_shipments. Ahora se recuerdan las filas y los recuentos leídos —no la respuesta— con la
huella de la base como clave (misma técnica que fleet._ctx), y cualquier escritura sube esa huella para que la lectura
siguiente vea el cambio al instante.
"""
import time
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("memoria_envios") / "memoria_envios.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    from app import main
    main.network.cache_clear()
    main._last_sync = 0.0
    main._envios_cache.clear()
    with TestClient(main.app) as c:
        yield c
    main._envios_cache.clear()
    main.network.cache_clear()
    mp.undo()


def lista(client, **params) -> dict:
    """La lista completa, como la pide el calendario."""
    return client.get("/api/shipments", params={"limit": 1000, **params}).json()


def test_en_frio_lee_la_base_y_la_segunda_vez_no(client, monkeypatch):
    from app import main

    main._last_sync = time.monotonic()   # que una sincronización no escriba entre las dos lecturas
    main._envios_cache.clear()           # lectura en frío: no hay nada recordado
    primera = lista(client)
    assert primera["total"] > 10 and primera["items"]
    assert main._envios_cache, "la lectura no quedó recordada"

    def no_consultar(*_args, **_kw):
        raise AssertionError("volvió a la base sin que la base cambiara")

    monkeypatch.setattr(main, "fetch_all", no_consultar)
    version = db.data_version()
    segunda = lista(client)
    assert db.data_version() == version, "nada escribió: la huella tenía que ser la misma"
    assert segunda == primera, "dos lecturas con la misma versión tienen que dar exactamente lo mismo"


def test_los_filtros_no_se_mezclan_en_la_memoria(client):
    """La clave lleva los filtros: lo recordado para una búsqueda no puede responder otra."""
    en_ruta = lista(client, status="En Ruta")
    entregado = lista(client, status="Entregado")
    assert en_ruta["total"] and entregado["total"]
    # Los recuentos de los chips no aplican el filtro de estado, así que son los mismos en las dos lecturas
    assert en_ruta["counts"]["status"] == entregado["counts"]["status"]
    assert en_ruta["total"] == en_ruta["counts"]["status"]["En Ruta"]
    # Pero las filas sí respetan el filtro guardado de cada lectura
    assert not ({i["code"] for i in en_ruta["items"]} & {i["code"] for i in entregado["items"]})


def test_el_orden_tambien_es_parte_de_la_clave(client):
    """La clave lleva el orden: la lista por estado y la lista por código no se sirven la una de la otra."""
    por_estado = [i["code"] for i in lista(client, sort="estado")["items"]]
    por_codigo = [i["code"] for i in lista(client, sort="codigo")["items"]]
    assert por_estado and len(por_estado) == len(por_codigo)
    assert set(por_estado) == set(por_codigo), "los mismos filtros traen los mismos envíos"
    assert por_estado != por_codigo, "los dos órdenes tienen que ser distintos"
    assert por_codigo == sorted(por_codigo), "sort=codigo va por código ascendente"
    # Al volver a cada orden sigue saliendo el suyo, no el último que se recordó
    assert [i["code"] for i in lista(client, sort="estado")["items"]] == por_estado
    assert [i["code"] for i in lista(client, sort="codigo")["items"]] == por_codigo


def test_una_escritura_por_la_api_se_ve_en_la_lectura_siguiente(client):
    from app import main

    main._last_sync = time.monotonic()   # la sincronización no debe meter despachos en medio de la prueba
    antes = lista(client, status="Programado")
    codes_antes = {i["code"] for i in antes["items"]}
    version = db.data_version()

    dep = (datetime.now() + timedelta(days=3)).isoformat(timespec="minutes")
    r = client.post("/api/shipments", json={"origin": "Bogotá", "destination": "Tunja", "cargo": "Prueba de memoria",
                                            "weight_t": 2, "client": "QA", "priority": "costo",
                                            "departure_at": dep, "usuario": "Pruebas"})
    assert r.status_code == 201, r.text
    nuevo = r.json()["code"]
    assert db.data_version() != version, "la escritura tiene que cambiar la huella de la base"

    despues = lista(client, status="Programado")
    codes_despues = {i["code"] for i in despues["items"]}
    assert nuevo in codes_despues and nuevo not in codes_antes, "la lectura siguió sirviendo lo recordado"
    assert codes_despues - codes_antes == {nuevo}
    assert despues["total"] == len(codes_despues)
