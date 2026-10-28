"""
history.py
Historial de trayectos: qué se movió en una ventana de días, agregado por ciudad, por departamento
y por corredor.

- Entran los envíos que salieron dentro de la ventana (los programados aún no cuentan).
- Por ciudad y departamento: envíos y toneladas que salen y que llegan, y el flete de lo que sale.
- Por corredor: se suma segmento a segmento (cada segmento es un enlace de un solo corredor), así un
  tramo que recorre varios corredores no se cuenta dos veces. Peajes y flete vienen de la ruta
  guardada; combustible y CO2e se estiman con los factores por modo de `sustainability`.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta

from app.api import format as F
from app.database.db import run_query
from app.engine import geo
from app.engine.sustainability import leg_emissions


def _department_names() -> dict[str, str]:
    return {f["properties"]["code"]: f["properties"]["name"] for f in geo.departments()["features"]}


def _city_departments() -> dict[str, str]:
    rows = run_query("SELECT city, department_code FROM mm_nodes ORDER BY node_code").to_dict(orient="records")
    out: dict[str, str] = {}
    for r in rows:
        out.setdefault(r["city"], str(r["department_code"]).zfill(2))
    return out


def history(now: datetime, days: int = 30) -> dict:
    since = now - timedelta(days=days)
    before = since - timedelta(days=days)
    all_rows = run_query(
        "SELECT shipment_code, origin_city, dest_city, weight_t, total_cost, status, departure_at, route_json, delay_h "
        "FROM mm_shipments WHERE status != 'Programado'"
    ).to_dict(orient="records")
    rows = [r for r in all_rows if since <= datetime.fromisoformat(r["departure_at"]) <= now]
    # Ventana anterior del mismo largo, para comparar (solo totales)
    prev = [r for r in all_rows if before <= datetime.fromisoformat(r["departure_at"]) < since]

    dept_of = _city_departments()
    dept_name = _department_names()

    cities: dict[str, dict] = {}
    corridors: dict[str, dict] = {}
    # Retrasos por vía y día de salida (0 = lunes): horas de retraso de los envíos que pasaron por la vía
    delays: dict[str, dict] = {}

    def city(name: str) -> dict:
        return cities.setdefault(name, {
            "city": name, "department_code": dept_of.get(name), "out": 0, "in": 0,
            "tons_out": 0.0, "tons_in": 0.0, "cost_out": 0.0, "destinations": {},
        })

    for r in rows:
        w = float(r["weight_t"])
        o, d = city(r["origin_city"]), city(r["dest_city"])
        o["out"] += 1
        o["tons_out"] += w
        o["cost_out"] += float(r["total_cost"] or 0)
        o["destinations"][r["dest_city"]] = o["destinations"].get(r["dest_city"], 0) + 1
        d["in"] += 1
        d["tons_in"] += w
        route = json.loads(r["route_json"] or "{}")
        delay = float(r.get("delay_h") or 0)
        if delay > 0:
            weekday = datetime.fromisoformat(r["departure_at"]).weekday()
            used = {seg.get("corridor"): lg["mode"] for lg in route.get("legs", []) for seg in lg.get("segments") or []
                    if seg.get("corridor")}
            for name, mode in used.items():
                dl = delays.setdefault(name, {"corridor": name, "mode": mode, "hours": [0.0] * 7, "shipments": [0] * 7})
                dl["hours"][weekday] += delay
                dl["shipments"][weekday] += 1
        for lg in route.get("legs", []):
            for seg in lg.get("segments") or []:
                name = seg.get("corridor")
                if not name:
                    continue
                c = corridors.setdefault(name, {
                    "corridor": name, "mode": lg["mode"], "trips": 0, "shipments": set(), "tons": 0.0,
                    "km": 0.0, "cost": 0.0, "tolls": 0.0, "fuel_l": 0.0, "co2e_kg": 0.0,
                })
                e = leg_emissions(lg["mode"], w, float(seg.get("distance_km") or 0))
                c["trips"] += 1
                c["shipments"].add(r["shipment_code"])
                c["tons"] += w
                c["km"] += float(seg.get("distance_km") or 0)
                c["cost"] += float(seg.get("cost") or 0)
                c["tolls"] += float(seg.get("toll_cost") or 0)
                c["fuel_l"] += e["fuel_l"]
                c["co2e_kg"] += e["co2e_kg"]

    # Departamentos: suma de sus ciudades
    depts: dict[str, dict] = {}
    for c in cities.values():
        code = c["department_code"] or "—"
        d = depts.setdefault(code, {
            "code": code, "name": dept_name.get(code, "Sin departamento"), "cities": 0,
            "out": 0, "in": 0, "tons_out": 0.0, "tons_in": 0.0, "cost_out": 0.0,
        })
        d["cities"] += 1
        for k in ("out", "in", "tons_out", "tons_in", "cost_out"):
            d[k] += c[k]

    def city_out(c: dict) -> dict:
        top = sorted(c["destinations"].items(), key=lambda kv: -kv[1])[:3]
        return {
            "city": c["city"], "department": dept_name.get(c["department_code"] or "", None),
            "out": c["out"], "in": c["in"],
            "tons_out": F.tons(c["tons_out"]), "tons_in": F.tons(c["tons_in"]),
            "tons_fmt": F.tons_fmt(c["tons_out"] + c["tons_in"]),
            "cost_out": F.money(c["cost_out"]),
            "top_destinations": [{"city": k, "shipments": v} for k, v in top],
        }

    def dept_out(d: dict) -> dict:
        return {
            "code": d["code"], "name": d["name"], "cities": d["cities"], "out": d["out"], "in": d["in"],
            "tons_out": F.tons(d["tons_out"]), "tons_in": F.tons(d["tons_in"]),
            "tons_fmt": F.tons_fmt(d["tons_out"] + d["tons_in"]), "cost_out": F.money(d["cost_out"]),
        }

    def corridor_out(c: dict) -> dict:
        return {
            "corridor": c["corridor"], "mode": c["mode"], "trips": c["trips"], "shipments": len(c["shipments"]),
            "tons": F.tons(c["tons"]), "tons_fmt": F.tons_fmt(c["tons"]),
            "km": round(c["km"]), "km_fmt": F.number(c["km"]) + " km",
            "cost": F.money(c["cost"]), "tolls": F.money(c["tolls"]),
            "fuel_l": round(c["fuel_l"]), "fuel_fmt": F.number(c["fuel_l"]) + " L",
            "co2e_kg": round(c["co2e_kg"]), "co2e_fmt": F.tons_fmt(c["co2e_kg"] / 1000) + " CO₂e",
        }

    tons = sum(float(r["weight_t"]) for r in rows)
    cost = sum(float(r["total_cost"] or 0) for r in rows)
    p_tons = sum(float(r["weight_t"]) for r in prev)
    p_cost = sum(float(r["total_cost"] or 0) for r in prev)

    def change(cur: float, old: float):
        return F.pct(100 * (cur - old) / old) if old else None

    return {
        "window_days": days,
        "since": since.isoformat(timespec="seconds"),
        "totals": {
            "shipments": len(rows), "tons": F.tons(tons), "tons_fmt": F.tons_fmt(tons),
            "cost": F.money(cost),
            "cities": len(cities), "departments": len(depts), "corridors": len(corridors),
        },
        "previous": {
            "since": before.isoformat(timespec="seconds"),
            "shipments": len(prev), "tons": F.tons(p_tons), "tons_fmt": F.tons_fmt(p_tons), "cost": F.money(p_cost),
            "change_pct": {"shipments": change(len(rows), len(prev)), "tons": change(tons, p_tons),
                           "cost": change(cost, p_cost)},
        },
        "by_city": sorted((city_out(c) for c in cities.values()), key=lambda c: -(c["out"] + c["in"])),
        "by_department": sorted((dept_out(d) for d in depts.values()), key=lambda d: -(d["out"] + d["in"])),
        "by_corridor": sorted((corridor_out(c) for c in corridors.values()), key=lambda c: -c["tons"]),
        # Las 12 vías con más horas de retraso; un envío retrasado cuenta en cada vía de su ruta
        "delays": [
            {"corridor": d["corridor"], "mode": d["mode"], "hours": [round(h, 1) for h in d["hours"]],
             "shipments": d["shipments"], "total_h": round(sum(d["hours"]), 1)}
            for d in sorted(delays.values(), key=lambda d: -sum(d["hours"]))[:12]
        ],
    }
