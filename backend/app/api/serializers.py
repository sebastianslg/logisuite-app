"""
serializers.py
Convierte los resultados del motor y de la base en respuestas JSON limpias:
números redondeados con su versión formateada, coordenadas a 4 decimales y
GeoJSON estándar para nodos y enlaces.
"""
from __future__ import annotations

import json
from datetime import datetime

from app.api import format as F


def node_brief(n: dict) -> dict:
    return {"code": n["code"], "name": n["name"], "city": n["city"], "kind": n["kind"],
            "lon": F.coord(n["lon"]), "lat": F.coord(n["lat"])}


def leg(l: dict) -> dict:
    out = {
        "mode": l["mode"], "mode_label": F.MODE_LABELS[l["mode"]],
        "from": node_brief(l["from"]), "to": node_brief(l["to"]),
        "corridors": l["corridors"],
        "distance_km": F.km(l["distance_km"]), "distance_fmt": F.km_fmt(l["distance_km"]),
        "time_h": F.hours(l["time_h"]), "time_fmt": F.duration_fmt(l["time_h"]),
        "cost": F.money(l["cost"]), "cost_fmt": F.money_fmt(l["cost"]),
        "start_h": round(l["start_h"], 3), "end_h": round(l["end_h"], 3),
        "path": [[F.coord(x), F.coord(y)] for x, y in l["path"]],
    }
    if l.get("asset"):
        out["asset"] = l["asset"]
    if l.get("interrupted"):
        out["interrupted"] = True
    if l.get("detour"):
        out["detour"] = True
    return out


def transfer(t: dict) -> dict:
    same = t["from_mode"] == t["to_mode"]
    label = (F.CONNECTION_LABELS[t["from_mode"]] if same else
             f"{F.MODE_VEHICLE[t['from_mode']]} → {F.MODE_VEHICLE[t['to_mode']]}")
    return {
        "node": node_brief(t["node"]), "from_mode": t["from_mode"], "to_mode": t["to_mode"],
        "label": label, "start_h": round(t["start_h"], 3),
        "time_h": F.hours(t["time_h"]), "time_fmt": F.duration_fmt(t["time_h"]),
        "cost": F.money(t["cost"]), "cost_fmt": F.money_fmt(t["cost"]),
    }


def trip(timeline: list, offset_h: float = 0.0) -> dict:
    """Recorrido para TripsLayer: trazado + marcas de tiempo (horas)."""
    return {
        "path": [[F.coord(p["lon"]), F.coord(p["lat"])] for p in timeline],
        "timestamps": [round(p["t_h"] - offset_h, 3) for p in timeline],
        "modes": [p["mode"] for p in timeline],
    }


def route(r: dict) -> dict:
    return {
        "origin": r["origin"], "destination": r["destination"],
        "priority": r["priority"],
        "weight_t": F.tons(r["weight_t"]), "weight_fmt": F.tons_fmt(r["weight_t"]),
        "modes": r["modes"], "mode_labels": [F.MODE_LABELS[m] for m in r["modes"]],
        "n_transfers": r["n_transfers"],
        "distance_km": F.km(r["distance_km"]), "distance_fmt": F.km_fmt(r["distance_km"]),
        "time_h": F.hours(r["time_h"]), "time_fmt": F.duration_fmt(r["time_h"]),
        "cost": F.money(r["cost"]), "cost_fmt": F.money_fmt(r["cost"]),
        "cost_per_t": F.money(r["cost"] / r["weight_t"]),
        "cost_per_t_fmt": F.money_fmt(r["cost"] / r["weight_t"]) + " / t",
        "legs": [leg(l) for l in r["legs"]],
        "transfers": [transfer(t) for t in r["transfers"]],
        "trip": trip(r["timeline"]),
    }


def route_summary(r: dict) -> dict:
    if not r.get("found", True):
        return {"priority": r["priority"], "found": False, "error": r.get("error")}
    return {
        "priority": r["priority"], "found": True, "modes": r["modes"],
        "n_transfers": r["n_transfers"],
        "time_h": F.hours(r["time_h"]), "time_fmt": F.duration_fmt(r["time_h"]),
        "cost": F.money(r["cost"]), "cost_fmt": F.money_fmt(r["cost"]),
        "distance_km": F.km(r["distance_km"]), "distance_fmt": F.km_fmt(r["distance_km"]),
    }


def shipment(s: dict, state: dict | None = None, detail: bool = False) -> dict:
    route_data = json.loads(s["route_json"])
    modes = s["modes"].split(",") if s["modes"] else []
    progress = state["progress"] if state else (1.0 if s["status"] == "Entregado" else 0.0)
    current_mode = None
    if state and s["status"] in ("En Ruta", "Retrasado", "Transferencia Modal"):
        h = state["route_h"]
        current = next((l for l in route_data["legs"] if l["start_h"] <= h <= l["end_h"]), None)
        current_mode = current["mode"] if current else None
    eta = datetime.fromisoformat(s["eta_at"])
    out = {
        "code": s["shipment_code"], "origin": s["origin_city"], "destination": s["dest_city"],
        "cargo": s["cargo"], "client": s["client"],
        "weight_t": F.tons(s["weight_t"]), "weight_fmt": F.tons_fmt(s["weight_t"]),
        "priority": s["priority"], "status": s["status"],
        "modes": modes, "mode_labels": [F.MODE_LABELS[m] for m in modes],
        "current_mode": current_mode, "n_transfers": int(s["n_transfers"]),
        "distance_km": F.km(s["distance_km"]), "distance_fmt": F.km_fmt(s["distance_km"]),
        "time_h": F.hours(s["total_time_h"]), "time_fmt": F.duration_fmt(s["total_time_h"]),
        "cost": F.money(s["total_cost"]), "cost_fmt": F.money_fmt(s["total_cost"]),
        "departure_at": s["departure_at"], "eta_at": s["eta_at"],
        "eta_fmt": eta.strftime("%d/%m %H:%M"),
        "delay_h": F.hours(s["delay_h"]),
        "delay_fmt": F.duration_fmt(s["delay_h"]) if s["delay_h"] else None,
        "progress_pct": F.pct(progress * 100),
        "source": s.get("source") or "seed",
        "route_status": s.get("route_status") or "ok",
        "route_note": s.get("route_note"),
        "forced_modes": [m for m in (s.get("forced_modes") or "").split(",") if m],
        "forced_corridors": [c for c in (s.get("forced_corridors") or "").split(",") if c],
        "created_by": s.get("created_by"),
        "updated_at": s.get("updated_at"),
        "updated_by": s.get("updated_by"),
    }
    if detail:
        out["legs"] = [leg(l) for l in route_data["legs"]]
        out["transfers"] = [transfer(t) for t in route_data["transfers"]]
        out["trip"] = trip(route_data["timeline"])
    return out


def network_geojson(network) -> dict:
    modes_by_node: dict = {}
    for l in network.links:
        for c in (l["origin_code"], l["dest_code"]):
            modes_by_node.setdefault(c, set()).add(l["mode"])
    nodes = {"type": "FeatureCollection", "features": [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [F.coord(n["longitude"]), F.coord(n["latitude"])]},
        "properties": {"code": code, "name": n["name"], "kind": n["kind"], "city": n["city"],
                       "department_code": n["department_code"], "iata": n["iata"],
                       "approximate": bool(n.get("approximate")),
                       "modes": sorted(modes_by_node.get(code, []))},
    } for code, n in network.nodes.items()]}
    links = {"type": "FeatureCollection", "features": [{
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": l["geometry"]},
        "properties": {
            "id": l["link_id"], "mode": l["mode"], "mode_label": F.MODE_LABELS[l["mode"]],
            "corridor": l["corridor"],
            "origin": l["origin_code"], "origin_name": network.nodes[l["origin_code"]]["name"],
            "destination": l["dest_code"], "destination_name": network.nodes[l["dest_code"]]["name"],
            "distance_km": F.km(l["distance_km"]), "distance_fmt": F.km_fmt(l["distance_km"]),
            "time_h": F.hours(l["time_h"]), "time_fmt": F.duration_fmt(l["time_h"]),
            "capacity_t": F.tons(l["capacity_t"]), "capacity_fmt": F.tons_fmt(l["capacity_t"]),
            "cost_per_tkm": round(l["cost_per_tkm"], 3),
            "closed": bool(l.get("closed")), "closure_reason": l.get("closure_reason"),
            "approximate": bool(l.get("approximate")),
        },
    } for l in network.links]}
    stats = {}
    for l in network.links:
        m = stats.setdefault(l["mode"], {"mode": l["mode"], "label": F.MODE_LABELS[l["mode"]],
                                         "links": 0, "km": 0})
        m["links"] += 1
        m["km"] += F.km(l["distance_km"])
    for m in stats.values():
        m["km_fmt"] = F.km_fmt(m["km"])
    return {"nodes": nodes, "links": links, "stats": list(stats.values())}
