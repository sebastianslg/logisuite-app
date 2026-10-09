"""
geo.py
Departamentos de Colombia (DANE, MGN 2018) y tráfico logístico por
departamento.

El tráfico de un departamento es la suma de toneladas de los envíos cuyo
trazado lo atraviesa (cada envío cuenta una vez por departamento). Se mide
sobre la geometría real de cada tramo, no solo sobre sus nodos: un convoy por
el Magdalena también "pasa" por Bolívar, Cesar y Santander.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache

_GEOJSON = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        "data", "colombia_departamentos.geojson")


@lru_cache(maxsize=1)
def departments() -> dict:
    with open(_GEOJSON, encoding="utf-8") as f:
        return json.load(f)


def _rings(geometry: dict) -> list:
    """Lista de polígonos, cada uno como [anillo exterior, huecos...]."""
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    return geometry["coordinates"]


@lru_cache(maxsize=1)
def _index() -> list:
    out = []
    for f in departments()["features"]:
        polys = _rings(f["geometry"])
        xs = [p[0] for poly in polys for p in poly[0]]
        ys = [p[1] for poly in polys for p in poly[0]]
        out.append((f["properties"]["code"], (min(xs), min(ys), max(xs), max(ys)), polys))
    return out


def _in_ring(x: float, y: float, ring: list) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def department_at(lon: float, lat: float) -> str | None:
    for code, (x0, y0, x1, y1), polys in _index():
        if not (x0 <= lon <= x1 and y0 <= lat <= y1):
            continue
        for poly in polys:
            if _in_ring(lon, lat, poly[0]) and not any(_in_ring(lon, lat, h) for h in poly[1:]):
                return code
    return None


def _densify(path: list, step_deg: float = 0.15) -> list:
    """Agrega puntos intermedios para no saltarse departamentos estrechos."""
    out = []
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        n = max(1, int(max(abs(x1 - x0), abs(y1 - y0)) / step_deg))
        out.extend((x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n) for k in range(n))
    if path:
        out.append(tuple(path[-1]))
    return out


def departments_on_route(route: dict) -> set:
    codes = set()
    for leg in route.get("legs", []):
        if leg["mode"] == "aereo":
            # Un vuelo no genera tráfico en tierra: solo cuentan sus aeropuertos
            pts = [leg["path"][0], leg["path"][-1]]
        else:
            pts = _densify(leg["path"])
        for lon, lat in pts:
            c = department_at(lon, lat)
            if c:
                codes.add(c)
    return codes


def department_traffic(shipments: list) -> dict:
    """{código DANE: toneladas} a partir de envíos con route_json."""
    traffic: dict = {}
    for s in shipments:
        route = json.loads(s["route_json"]) if isinstance(s["route_json"], str) else s["route_json"]
        for code in departments_on_route(route):
            traffic[code] = traffic.get(code, 0.0) + float(s["weight_t"])
    return traffic
