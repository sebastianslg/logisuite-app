"""
Coherencia geográfica de la red: coordenadas de los nodos y distancias de las vías.

No reemplaza la validación contra INVÍAS, ANI, Aerocivil y Cormagdalena (esas fuentes no están en el repo), pero
atrapa lo que es imposible sin ellas: un nodo fuera de Colombia o de su departamento (polígonos del DANE), una
carretera más corta que la línea recta entre sus extremos o un trazado que sale del país.
"""
import json
import math

import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db

COLOMBIA = (-4.3, 13.5, -82.0, -66.8)  # lat mín, lat máx, lon mín, lon máx (incluye San Andrés y Leticia)
EDGE_KM = 15.0  # los polígonos del DANE vienen simplificados: puertos y orillas de río quedan en el borde

# Enlaces cuyo kilometraje declarado es MENOR que la línea recta entre sus extremos (imposible por carretera).
# Pendientes de corregir con la distancia oficial de INVÍAS; cada uno aparece aquí a propósito.
DISTANCIA_POR_REVISAR = {
    ("CEDI-CLO", "CITY-SQU"): "declara 45 km; el CEDI está en Yumbo y la recta mide 64 km",
    ("CITY-HND", "CITY-IBG"): "declara 95 km; la recta mide 102 km",
    ("CITY-BOS", "CITY-VUP"): "declara 90 km; su propio trazado mide 105 km",
}


@pytest.fixture(scope="module")
def red(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("coords") / "coords.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    from app import main
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app):
        nodes = db.run_query("SELECT * FROM mm_nodes").to_dict(orient="records")
        links = db.run_query("SELECT * FROM mm_links").to_dict(orient="records")
    main.network.cache_clear()
    mp.undo()
    return nodes, links


def haversine(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    x = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(x))


def _inside(x, y, ring):
    c = False
    for i in range(len(ring)):
        x1, y1 = ring[i]
        x2, y2 = ring[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def _departamentos():
    from pathlib import Path
    g = json.loads((Path(__file__).resolve().parents[1] / "app" / "data" / "colombia_departamentos.geojson").read_text(encoding="utf-8"))
    out = {}
    for f in g["features"]:
        geom = f["geometry"]
        out[f["properties"]["code"]] = (f["properties"]["name"], [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"])
    return out


def test_todos_los_nodos_estan_en_colombia(red):
    nodes, _ = red
    lat0, lat1, lon0, lon1 = COLOMBIA
    fuera = [n["node_code"] for n in nodes if not (lat0 <= n["latitude"] <= lat1 and lon0 <= n["longitude"] <= lon1)]
    assert not fuera, f"Nodos fuera de Colombia: {fuera}"


def test_cada_nodo_cae_en_su_departamento_o_en_su_borde(red):
    nodes, _ = red
    deps = _departamentos()
    problemas = []
    for n in nodes:
        dep = deps.get(n["department_code"])
        if dep is None:
            problemas.append(f"{n['node_code']}: el departamento {n['department_code']} no existe")
            continue
        lat, lon = n["latitude"], n["longitude"]
        if any(_inside(lon, lat, p[0]) and not any(_inside(lon, lat, h) for h in p[1:]) for p in dep[1]):
            continue
        borde = min(haversine(lat, lon, y, x) for p in dep[1] for x, y in p[0])
        if borde > EDGE_KM:
            problemas.append(f"{n['node_code']} {n['name']}: a {borde:.0f} km del borde de {dep[0]}")
    assert not problemas, "\n".join(problemas)


def test_los_aeropuertos_tienen_iata_y_los_demas_nodos_no(red):
    nodes, _ = red
    assert all(bool(n["iata"]) == (n["kind"] == "aeropuerto") for n in nodes)


def test_los_trazados_no_salen_de_colombia(red):
    _, links = red
    lat0, lat1, lon0, lon1 = COLOMBIA
    malos = [f"{l['origin_code']}->{l['dest_code']}" for l in links
             if any(not (lat0 <= p[1] <= lat1 and lon0 <= p[0] <= lon1) for p in json.loads(l["geometry_json"]))]
    assert not malos, f"Trazados con puntos fuera de Colombia: {malos}"


def test_ninguna_carretera_es_mas_corta_que_la_linea_recta(red):
    nodes, links = red
    by = {n["node_code"]: n for n in nodes}
    malos = []
    for l in links:
        if l["mode"] != "terrestre":
            continue
        a, b = by[l["origin_code"]], by[l["dest_code"]]
        recta = haversine(a["latitude"], a["longitude"], b["latitude"], b["longitude"])
        if l["distance_km"] < recta * 0.9 - 1 and (l["origin_code"], l["dest_code"]) not in DISTANCIA_POR_REVISAR:
            malos.append(f"{l['origin_code']}->{l['dest_code']} ({l['corridor']}): declara {l['distance_km']:.0f} km y la recta mide {recta:.0f} km")
    assert not malos, "\n".join(malos)


def test_las_excepciones_conocidas_siguen_siendo_ciertas(red):
    """Si alguien corrige una distancia, debe quitarla de DISTANCIA_POR_REVISAR (la lista no se pudre)."""
    nodes, links = red
    by = {n["node_code"]: n for n in nodes}
    for l in links:
        k = (l["origin_code"], l["dest_code"])
        if k not in DISTANCIA_POR_REVISAR:
            continue
        a, b = by[k[0]], by[k[1]]
        trazado = sum(haversine(p[1], p[0], q[1], q[0]) for p, q in zip(*(lambda g: (g, g[1:]))(json.loads(l["geometry_json"]))))
        recta = haversine(a["latitude"], a["longitude"], b["latitude"], b["longitude"])
        assert l["distance_km"] < max(recta, trazado) * 0.98, f"{k} ya no es inconsistente: quítalo de DISTANCIA_POR_REVISAR"
