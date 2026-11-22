"""
Búsqueda global de la paleta (Ctrl K) sobre una base SQLite temporal sembrada, como en
test_lista_envios.py. Se llama la función del motor directo, sin pasar por HTTP: la ruta
GET /api/search la registra main.py y aquí no se necesita.

Lo que se comprueba: cada tipo encuentra por sus campos propios y devuelve el href correcto,
el texto corto no consulta la base, los comodines % y _ se buscan como letras, el límite es por
tipo y `truncated` avisa cuando quedaron coincidencias por fuera. Sobre tildes: la comparación
pliega tildes y mayúsculas (el LIKE de SQLite, solo, no lo hace), así que «bogota», «Bogotá» y
«BOGOTÁ» encuentran lo mismo y «narino» encuentra «Nariño»; el detalle está en la docstring de
app/engine/search.py.
"""
import urllib.parse

import pytest

import app.database.db as db
import app.init_db as init_db
from app.engine import search as busqueda

TIPOS = ("envio", "vehiculo", "bodega", "cliente")


@pytest.fixture(scope="module")
def base(tmp_path_factory):
    """Base temporal sembrada con los datos de ejemplo, aislada de backend/data/."""
    ruta = str(tmp_path_factory.mktemp("busqueda") / "busqueda.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", ruta)
    mp.setattr(init_db, "DB_PATH", ruta)
    init_db.init_database()
    yield
    mp.undo()


def test_contrato_de_la_respuesta(base):
    r = busqueda.search("  LS  ")
    assert set(r) == {"query", "items", "truncated"}
    assert r["query"] == "LS"  # recortado
    assert isinstance(r["truncated"], bool)
    for item in r["items"]:
        assert set(item) == {"type", "title", "subtitle", "href"}
        assert item["type"] in TIPOS
        assert all(isinstance(item[campo], str) and item[campo] for campo in ("title", "subtitle", "href"))


def test_busqueda_por_codigo_de_envio(base):
    envio = db.fetch_all("SELECT shipment_code FROM mm_shipments ORDER BY shipment_code LIMIT 1")[0]
    r = busqueda.search(envio["shipment_code"], limit=10)
    item = next(i for i in r["items"] if i["type"] == "envio" and i["title"] == envio["shipment_code"])
    assert item["href"] == f"/envios/{envio['shipment_code']}"
    assert "→" in item["subtitle"]


def test_busqueda_por_ciudad(base):
    # La ciudad que menos envíos toca, para que el envío esperado quepa en el límite de 10.
    envio = db.fetch_all("""
        SELECT s.shipment_code, s.origin_city AS city
        FROM mm_shipments s
        ORDER BY (SELECT COUNT(*) FROM mm_shipments x
                  WHERE x.origin_city = s.origin_city OR x.dest_city = s.origin_city), s.shipment_code
        LIMIT 1""")[0]
    r = busqueda.search(envio["city"], limit=10)
    hrefs = {i["href"] for i in r["items"] if i["type"] == "envio"}
    assert f"/envios/{envio['shipment_code']}" in hrefs


def test_busqueda_por_cliente(base):
    cliente = db.fetch_all("""
        SELECT client, COUNT(*) AS n FROM mm_shipments
        GROUP BY client ORDER BY n DESC, client LIMIT 1""")[0]
    r = busqueda.search(cliente["client"], limit=10)
    item = next(i for i in r["items"] if i["type"] == "cliente" and i["title"] == cliente["client"])
    assert item["href"] == "/envios?q=" + urllib.parse.quote(cliente["client"], safe="")
    assert item["subtitle"] == f"{int(cliente['n'])} envíos"


def test_busqueda_por_placa_de_vehiculo(base):
    vehiculo = db.fetch_all("SELECT vehicle_id, code, vehicle_type FROM fl_vehicles ORDER BY vehicle_id LIMIT 1")[0]
    r = busqueda.search(vehiculo["code"], limit=10)
    item = next(i for i in r["items"] if i["type"] == "vehiculo" and i["title"] == vehiculo["code"])
    assert item["href"] == f"/flota/{vehiculo['vehicle_id']}"
    assert item["subtitle"].startswith(vehiculo["vehicle_type"])


def test_busqueda_por_nombre_de_bodega(base):
    bodega = db.fetch_all("SELECT warehouse_id, code, name, city FROM wh_warehouses ORDER BY warehouse_id LIMIT 1")[0]
    r = busqueda.search(bodega["name"], limit=10)
    item = next(i for i in r["items"] if i["type"] == "bodega" and i["title"] == bodega["name"])
    assert item["href"] == f"/bodegas/{bodega['warehouse_id']}"
    assert item["subtitle"] == f"{bodega['code']} · {bodega['city']}"


def test_texto_corto_no_consulta_la_base(base, monkeypatch):
    """Con menos de dos letras la respuesta es vacía y ni siquiera se abre la base."""

    def prohibido(*_args, **_kwargs):
        raise AssertionError("no debía consultar la base")

    monkeypatch.setattr(busqueda, "fetch_all", prohibido)
    for q in ("", "   ", "a", " Á "):
        assert busqueda.search(q) == {"query": q.strip(), "items": [], "truncated": False}


def test_los_comodines_se_buscan_como_letras(base):
    """Sin escapar, «LS%» devolvería todos los envíos y «B_» todo lo que empiece por B."""
    assert len(db.fetch_all("SELECT shipment_code FROM mm_shipments WHERE shipment_code LIKE 'LS%'")) > 0
    for q in ("%%", "LS%", "B_", "%og%", "_--", "LS_2610"):
        assert busqueda.search(q, limit=10)["items"] == [], q


def test_el_limite_es_por_tipo_y_se_recorta_entre_1_y_10(base):
    for tope in (1, 3, 5):
        r = busqueda.search("LS", limit=tope)  # «LS» coincide con todos los códigos de envío
        assert sum(1 for i in r["items"] if i["type"] == "envio") == tope
        assert r["truncated"] is True

    # Fuera de rango se recorta al rango válido en vez de fallar cuando se llama directo.
    assert sum(1 for i in busqueda.search("LS", limit=0)["items"] if i["type"] == "envio") == 1
    assert sum(1 for i in busqueda.search("LS", limit=99)["items"] if i["type"] == "envio") == 10


def test_truncated_avisa_que_quedaron_resultados_por_fuera(base):
    assert busqueda.search("LS", limit=5)["truncated"] is True
    # Una búsqueda que cabe entera no marca truncado.
    pocos = busqueda.search("Lácteos de Nariño", limit=10)
    assert pocos["items"] and pocos["truncated"] is False


def test_el_orden_de_los_tipos_es_envios_vehiculos_bodegas_clientes(base):
    # «an» cae en los cuatro tipos con los datos de la semilla.
    r = busqueda.search("an", limit=10)
    tipos = [i["type"] for i in r["items"]]
    assert set(tipos) == set(TIPOS)
    assert tipos == sorted(tipos, key=TIPOS.index)


def test_tildes_y_mayusculas_encuentran_lo_mismo(base):
    """SQLite LIKE solo ignora mayúsculas en ASCII y no normaliza tildes; search() pliega las dos."""
    resultados = [{i["href"] for i in busqueda.search(q, limit=10)["items"]}
                  for q in ("bogota", "Bogotá", "BOGOTÁ", "BOGOTA")]
    assert all(resultados)
    assert all(conjunto == resultados[0] for conjunto in resultados)

    # La ñ se pliega a n: «narino» encuentra a «Lácteos de Nariño» y su envío.
    cliente = db.fetch_all("SELECT client FROM mm_shipments WHERE client LIKE 'Lácteos de Nari%' LIMIT 1")[0]["client"]
    r = busqueda.search("narino", limit=10)
    assert any(i["type"] == "cliente" and i["title"] == cliente for i in r["items"])
