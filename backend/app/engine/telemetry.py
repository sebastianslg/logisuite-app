"""
telemetry.py
Estado vivo de la operación: estados de envíos, posición interpolada de cada
activo sobre el trazado de su ruta y reposición de despachos.

La posición se interpola sobre la línea de tiempo que calculó el motor
multimodal (puntos del trazado con su hora de ruta), así que un camión sigue
la carretera, una barcaza el río y un buque la costa. No hay GPS: es una
simulación determinista a partir de la salida, la duración y el retraso.

Para que la operación no se "vacíe" con el paso de los días, `replenish()`
despacha nuevos envíos cuando hay menos de MIN_ACTIVE en tránsito, como haría
la llegada continua de órdenes a un TMS real.
"""
from __future__ import annotations

import json
import math
import random
import threading
from datetime import datetime, timedelta

from app.database.db import run_query, run_write
from app.engine.dispatch import TEMPLATES, build_shipment, status_at
from app.engine.multimodal import MultimodalNetwork, RoutingError

MIN_ACTIVE = 16
ACTIVE_STATUSES = ("En Ruta", "Transferencia Modal", "Retrasado")

_lock = threading.Lock()


def _bearing(lon1, lat1, lon2, lat2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    x = math.sin(dl) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def position_on(timeline: list, route_h: float) -> dict:
    """Interpola lon/lat y rumbo para una hora de ruta dada."""
    if not timeline:
        return {}
    if route_h <= timeline[0]["t_h"]:
        p = timeline[0]
        return {"lon": p["lon"], "lat": p["lat"], "bearing": 0.0, "mode": p["mode"]}
    for a, b in zip(timeline, timeline[1:]):
        if a["t_h"] <= route_h <= b["t_h"]:
            span = b["t_h"] - a["t_h"]
            f = (route_h - a["t_h"]) / span if span > 0 else 0.0
            lon = a["lon"] + (b["lon"] - a["lon"]) * f
            lat = a["lat"] + (b["lat"] - a["lat"]) * f
            moving = (a["lon"], a["lat"]) != (b["lon"], b["lat"])
            return {"lon": lon, "lat": lat, "mode": b["mode"],
                    "bearing": _bearing(a["lon"], a["lat"], b["lon"], b["lat"]) if moving else 0.0}
    p = timeline[-1]
    return {"lon": p["lon"], "lat": p["lat"], "bearing": 0.0, "mode": p["mode"]}


def refresh_statuses(now: datetime) -> None:
    """Recalcula y persiste el estado de los envíos no entregados."""
    rows = run_query("""SELECT shipment_code, departure_at, total_time_h, delay_h, route_json, status
                        FROM mm_shipments WHERE status != 'Entregado'""").to_dict(orient="records")
    for r in rows:
        new = status_at(r, now)["status"]
        if new != r["status"]:
            run_write("UPDATE mm_shipments SET status = ? WHERE shipment_code = ?",
                       (new, r["shipment_code"]))


def replenish(network: MultimodalNetwork, now: datetime) -> int:
    """Despacha envíos nuevos si hay menos de MIN_ACTIVE en tránsito y la
    reposición automática está activa (parámetro AUTO_REPLENISH)."""
    from app.engine.operations import auto_replenish, next_code
    if not auto_replenish():
        return 0
    active = int(run_query(
        f"SELECT COUNT(*) c FROM mm_shipments WHERE status IN ({','.join('?' * len(ACTIVE_STATUSES))})",
        ACTIVE_STATUSES).iloc[0]["c"])
    missing = MIN_ACTIVE - active
    if missing <= 0:
        return 0
    rng = random.Random(int(now.timestamp()))
    # Consecutivo global: nunca reutiliza un código existente o borrado
    seq = int(next_code(now).rsplit("-", 1)[1])
    created = 0
    for _ in range(missing):
        template = rng.choice(TEMPLATES)
        try:
            probe = build_shipment(network, template, now, seq, rng)
        except RoutingError:
            continue
        # Salida reciente para que entren a la operación a mitad de recorrido
        departure = now - timedelta(hours=probe["total_time_h"] * rng.uniform(0.05, 0.6))
        sh = build_shipment(network, template, departure, seq, random.Random(seq))
        sh["status"] = status_at(sh, now)["status"]
        sh["source"] = "auto"
        cols = list(sh.keys())
        run_write(f"INSERT OR IGNORE INTO mm_shipments ({', '.join(cols)}) "
                   f"VALUES ({', '.join('?' * len(cols))})", tuple(sh[c] for c in cols))
        seq += 1
        created += 1
    return created


def sync(network: MultimodalNetwork, now: datetime) -> None:
    """Pone la operación al día: estados y reposición (serializado)."""
    with _lock:
        refresh_statuses(now)
        if replenish(network, now):
            refresh_statuses(now)


def live_fleet(now: datetime) -> list:
    """Activos en movimiento con su posición, tramo actual y recorrido."""
    rows = run_query(
        f"SELECT * FROM mm_shipments WHERE status IN ({','.join('?' * len(ACTIVE_STATUSES))})",
        ACTIVE_STATUSES).to_dict(orient="records")
    fleet = []
    for r in rows:
        route = json.loads(r["route_json"])
        st = status_at(r, now, route)
        pos = position_on(route["timeline"], st["route_h"])
        leg = next((l for l in route["legs"] if l["start_h"] <= st["route_h"] <= l["end_h"]),
                   None)
        if leg is None:  # en transbordo: se toma el tramo siguiente
            leg = next((l for l in route["legs"] if l["start_h"] >= st["route_h"]), route["legs"][-1])
        fleet.append({"shipment": r, "route": route, "state": st, "position": pos, "leg": leg})
    return fleet
