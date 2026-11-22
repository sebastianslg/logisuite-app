"""
ETag en las lecturas públicas que casi no cambian y `no-store` en las que traen datos de la operación.

Nodos y vías se piden al abrir Vías, pero su respuesta incluye `changed_by` (quién cerró) y los códigos de los envíos
pendientes: no son un catálogo y el navegador no debe guardarlas. Van con `Cache-Control: no-store`, sin ETag, y un
`If-None-Match` nunca recibe 304 (un validador solo sirve para revalidar una copia guardada). El catálogo (ubicaciones,
catálogo de flota y roles de bodega) sigue con ETag y `Cache-Control: no-cache`, y 304 sin cuerpo al revalidar, también
cuando la petición lleva sesión. Las lecturas privadas siguen sin ETag. Usa una base SQLite temporal propia, como
test_etag_red.
"""
import time

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db
from app import main
from app.database.db import run_write
from conftest import admin_headers


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("etag_catalogos") / "etag_catalogos.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app) as c:
        yield c
    main.network.cache_clear()
    main._cache.clear()
    mp.undo()


RUTAS_ETAG = ("/api/locations", "/api/fleet/catalog", "/api/warehouses/roles")
RUTAS_NO_GUARDAR = ("/api/nodes/status", "/api/corridors")


def test_las_dos_listas_no_se_pisan(client):
    """Una ruta que no se guarda no puede llevar ETag: sin copia guardada, el validador no tiene sentido (y el 304
    confirmaría que existe). Nodos y vías salieron de la lista de ETag por `changed_by` y por los envíos."""
    assert not set(main._ETAG_LECTURAS) & set(main._NO_STORE)
    assert set(RUTAS_NO_GUARDAR) <= set(main._NO_STORE)


@pytest.mark.parametrize("ruta", RUTAS_ETAG)
def test_lectura_con_etag_responde_200_y_304(client, ruta):
    r = client.get(ruta)
    assert r.status_code == 200
    etag = r.headers.get("etag")
    assert etag and etag.startswith('"')
    assert r.headers["cache-control"] == "no-cache"
    assert r.headers["content-type"].startswith("application/json")
    assert r.content

    otra = client.get(ruta, headers={"If-None-Match": etag})
    assert otra.status_code == 304
    assert otra.content == b""
    assert otra.headers["etag"] == etag
    assert otra.headers["cache-control"] == "no-cache"


@pytest.mark.parametrize("ruta", RUTAS_ETAG)
def test_un_etag_de_otra_version_recibe_el_200_completo(client, ruta):
    r = client.get(ruta, headers={"If-None-Match": '"otra-version"'})
    assert r.status_code == 200
    assert r.headers.get("etag")
    assert r.content


@pytest.mark.parametrize("ruta", RUTAS_NO_GUARDAR)
def test_las_lecturas_de_la_operacion_no_se_guardan(client, ruta):
    """Nodos y vías: `no-store`, sin ETag y sin 304 aunque el cliente repita un validador."""
    r = client.get(ruta)
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    assert "etag" not in {k.lower() for k in r.headers}
    assert r.content

    for validador in ('"otra-version"', "*"):
        otra = client.get(ruta, headers={"If-None-Match": validador})
        assert otra.status_code == 200, "sin ETag no hay 304: la copia no se guarda"
        assert otra.headers["cache-control"] == "no-store"
        assert "etag" not in {k.lower() for k in otra.headers}
        assert otra.content


def test_esas_respuestas_si_traen_los_datos_que_las_excluyen(client):
    """El motivo del `no-store`: quién cerró (`changed_by`) y los envíos pendientes (`shipments`)."""
    nodos = client.get("/api/nodes/status").json()["items"]
    vias = client.get("/api/corridors").json()["items"]
    assert nodos and vias
    assert all({"changed_by", "shipments"} <= set(n) for n in nodos)
    assert all({"changed_by", "shipments"} <= set(c) for c in vias)


def test_una_sesion_no_rompe_el_etag_ni_guarda_lo_de_la_operacion(client):
    """El proxy reenvía `Authorization`: un catálogo público sigue revalidando (no depende de la sesión) y nodos y
    vías siguen sin guardarse aunque quien pida tenga cuenta."""
    headers = admin_headers()

    r = client.get("/api/locations", headers=headers)
    assert r.status_code == 200 and r.headers.get("etag")
    assert r.headers["cache-control"] == "no-cache"
    otra = client.get("/api/locations", headers={**headers, "If-None-Match": r.headers["etag"]})
    assert otra.status_code == 304
    assert otra.content == b""

    for ruta in RUTAS_NO_GUARDAR:
        privada = client.get(ruta, headers=headers)
        assert privada.status_code == 200
        assert privada.headers["cache-control"] == "no-store"
        assert "etag" not in {k.lower() for k in privada.headers}
        assert privada.content


def test_el_etag_y_el_no_store_sobreviven_a_la_cache_de_lectura(client, monkeypatch):
    """La caché de 5 s del servidor no puede perder las cabeceras al rehacer la respuesta: el catálogo revalida con
    ETag y las lecturas de la operación salen sin guardar también cuando la respuesta viene de la caché."""
    monkeypatch.setattr(main, "CACHE_TTL_S", 5.0)
    main._bump_cache()
    main._last_sync = time.monotonic()   # sin sincronización a mitad de la prueba (su escritura vaciaría la caché)
    try:
        r = client.get("/api/locations")
        assert r.status_code == 200 and r.headers.get("etag")
        assert r.headers.get("x-cache") == "miss"
        hit = client.get("/api/locations")
        assert hit.status_code == 200 and hit.headers.get("x-cache") == "hit"
        assert hit.headers.get("etag") == r.headers["etag"]
        assert client.get("/api/locations", headers={"If-None-Match": r.headers["etag"]}).status_code == 304

        nodos = client.get("/api/nodes/status")
        assert nodos.status_code == 200 and nodos.headers.get("x-cache") == "miss"
        assert nodos.headers["cache-control"] == "no-store"
        otra = client.get("/api/nodes/status")
        assert otra.status_code == 200 and otra.headers.get("x-cache") == "hit"
        assert otra.headers["cache-control"] == "no-store"
        assert "etag" not in {k.lower() for k in otra.headers}
        assert client.get("/api/nodes/status", headers={"If-None-Match": "*"}).status_code == 200
    finally:
        main._cache.clear()
        main._last_sync = 0.0


def test_el_cierre_de_un_nodo_no_se_guarda_y_se_ve_en_la_lista(client):
    antes = client.get("/api/nodes/status")
    code = antes.json()["items"][0]["code"]

    r = client.post("/api/nodes/status", json={
        "code": code, "active": False, "reason": "Prueba de ETag", "usuario": "Pruebas"})
    assert r.status_code == 200, r.text
    assert r.headers["cache-control"] == "no-store", "el resumen del cierre trae los envíos redirigidos"
    assert r.json()["active"] is False

    despues = client.get("/api/nodes/status")
    assert despues.headers["cache-control"] == "no-store"
    assert "etag" not in {k.lower() for k in despues.headers}
    cerrado = next(n for n in despues.json()["items"] if n["code"] == code)
    assert cerrado["active"] is False
    assert cerrado["reason"] == "Prueba de ETag"
    assert cerrado["changed_by"] == "Pruebas"


def test_el_cierre_de_una_via_no_se_guarda_y_se_ve_en_la_lista(client):
    antes = client.get("/api/corridors")
    # Puede haber vías cerradas de la semilla (van primero en el orden): se toma una activa para poder cerrarla
    via = next(c for c in antes.json()["items"] if c["active"])["corridor"]

    r = client.post("/api/corridors/status", json={
        "corridor": via, "active": False, "reason": "Prueba de ETag", "usuario": "Pruebas"})
    assert r.status_code == 200, r.text
    assert r.headers["cache-control"] == "no-store", "el resumen del cierre trae los envíos redirigidos"

    despues = client.get("/api/corridors")
    assert despues.headers["cache-control"] == "no-store"
    assert "etag" not in {k.lower() for k in despues.headers}
    cerrada = next(c for c in despues.json()["items"] if c["corridor"] == via)
    assert cerrada["active"] is False
    assert cerrada["reason"] == "Prueba de ETag"
    assert cerrada["changed_by"] == "Pruebas"


def test_el_etag_de_las_ubicaciones_cambia_al_editar_la_red(client):
    """`/api/locations` se arma con los nodos de la red: si se edita un nodo, el ETag tiene que cambiar."""
    antes = client.get("/api/locations")
    etag = antes.headers["etag"]
    run_write("UPDATE mm_nodes SET name = name || ' (ETag)' WHERE node_code = "
              "(SELECT node_code FROM mm_nodes ORDER BY node_code LIMIT 1)")
    main.network.cache_clear()          # la red se guarda en memoria (lru_cache)
    main._last_sync = 0.0

    despues = client.get("/api/locations", headers={"If-None-Match": etag})
    assert despues.status_code == 200
    assert despues.headers["etag"] != etag
    assert any(n["name"].endswith("(ETag)") for c in despues.json()["cities"] for n in c["nodes"])


def test_las_lecturas_privadas_o_por_sesion_siguen_sin_etag(client):
    """El ETag es solo para lecturas públicas: la lista de envíos, las alertas y las cuentas no lo llevan."""
    for ruta in ("/api/shipments", "/api/alerts", "/api/auth/me", "/api/consents?browser_id=nav-pruebas-00000001"):
        r = client.get(ruta)
        assert r.status_code in (200, 401), (ruta, r.status_code)
        assert "etag" not in {k.lower() for k in r.headers}, ruta
