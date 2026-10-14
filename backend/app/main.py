"""
main.py
API de LogiSuite TMS (FastAPI).

Endpoints principales:
  GET  /api/network/multimodal   Red multimodal como GeoJSON (nodos y enlaces).
  POST /api/routes/simulate      Ruta multimodal óptima con tramos, transbordos,
                                 tiempos, costos y recorrido animable.
  GET  /api/fleet/live           Posición interpolada de cada activo en tránsito.

Complementarios: /api/shipments, /api/shipments/{code}, /api/dashboard/summary,
/api/geo/departments, /api/locations y /api/health.

Ejecución local (desde backend/):  uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import json
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field

from app.api import format as F
from app.api import serializers as S
from app.database.db import run_query
from app.engine import geo, sustainability as SU, telemetry
from app.engine.dispatch import status_at
from app.engine.multimodal import MultimodalNetwork, RoutingError

SYNC_INTERVAL_S = 15  # la operación se pone al día como máximo cada 15 s
_last_sync = 0.0


@lru_cache(maxsize=1)
def network() -> MultimodalNetwork:
    return MultimodalNetwork.from_db()


def _sync() -> datetime:
    """Actualiza estados y repone despachos, con un mínimo de intervalo."""
    global _last_sync
    now = datetime.now()
    if time.monotonic() - _last_sync >= SYNC_INTERVAL_S:
        telemetry.sync(network(), now)
        _last_sync = time.monotonic()
    return now


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from app.init_db import init_database
    init_database(reset=False)
    yield


app = FastAPI(title="LogiSuite TMS API", version="2.0.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/locations")
def locations() -> dict:
    """Ciudades y nodos seleccionables como origen o destino."""
    net = network()
    cities = []
    for city, codes in sorted(net.cities.items()):
        nodes = [net.nodes[c] for c in codes]
        cities.append({
            "city": city,
            "department_code": nodes[0]["department_code"],
            "kinds": sorted({n["kind"] for n in nodes}),
            "modes": sorted(set().union(*(net.modes_at(c) for c in codes))),
            "nodes": [{"code": n["node_code"], "name": n["name"], "kind": n["kind"]} for n in nodes],
        })
    return {"cities": cities}


@app.get("/api/network/multimodal")
def multimodal_network() -> dict:
    return S.network_geojson(network())


class SimulateRequest(BaseModel):
    origen: str = Field(..., min_length=2, examples=["Leticia"])
    destino: str = Field(..., min_length=2, examples=["Cartagena"])
    prioridad: Literal["tiempo", "costo", "balanceado"] = "balanceado"
    peso_t: float = Field(10.0, gt=0, le=20000)


@app.post("/api/routes/simulate")
def simulate_route(req: SimulateRequest) -> dict:
    net = network()
    try:
        best = net.route(req.origen, req.destino, req.peso_t, req.prioridad)
    except RoutingError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    alternatives = [S.route_summary(r) for r in net.compare(req.origen, req.destino, req.peso_t)]
    return {"route": S.route(best), "alternatives": alternatives}


@app.get("/api/fleet/live")
def fleet_live() -> dict:
    now = _sync()
    assets = []
    for item in telemetry.live_fleet(now):
        s, st, pos, lg = item["shipment"], item["state"], item["position"], item["leg"]
        asset = lg.get("asset", {})
        mode = lg["mode"]
        assets.append({
            "id": asset.get("id", s["shipment_code"]),
            "asset_type": asset.get("type"), "carrier": asset.get("carrier"),
            "units": asset.get("units", 1),
            "shipment_code": s["shipment_code"], "status": st["status"],
            "mode": mode, "mode_label": F.MODE_LABELS[mode],
            "lon": F.coord(pos["lon"]), "lat": F.coord(pos["lat"]),
            "bearing": round(pos.get("bearing", 0.0)),
            "progress_pct": F.pct(st["progress"] * 100),
            "origin": s["origin_city"], "destination": s["dest_city"],
            "next_stop": lg["to"]["name"],
            "cargo": s["cargo"], "weight_fmt": F.tons_fmt(s["weight_t"]),
            "eta_at": s["eta_at"],
            # Recorrido completo con el tiempo relativo a "ahora" (0 = posición actual)
            "trip": S.trip(item["route"]["timeline"], offset_h=st["route_h"]),
        })
    by_mode: dict = {}
    for a in assets:
        by_mode[a["mode"]] = by_mode.get(a["mode"], 0) + 1
    return {"generated_at": now.isoformat(timespec="seconds"), "count": len(assets),
            "by_mode": by_mode, "assets": assets}


@app.get("/api/shipments")
def shipments(status: str | None = None, limit: int = 300) -> dict:
    now = _sync()
    sql, params = "SELECT * FROM mm_shipments", []
    if status:
        sql += " WHERE status = ?"
        params.append(status)
    sql += " ORDER BY departure_at DESC LIMIT ?"
    params.append(max(1, min(limit, 1000)))
    rows = run_query(sql, tuple(params)).to_dict(orient="records")
    items = [S.shipment(r, status_at(r, now)) for r in rows]
    return {"count": len(items), "items": items}


@app.get("/api/shipments/{code}")
def shipment_detail(code: str) -> dict:
    now = _sync()
    rows = run_query("SELECT * FROM mm_shipments WHERE shipment_code = ?", (code,))
    if rows.empty:
        raise HTTPException(status_code=404, detail=f"Envío {code} no encontrado")
    r = rows.to_dict(orient="records")[0]
    return S.shipment(r, status_at(r, now), detail=True)


def _recent_shipments(now: datetime, days: int = 30) -> list:
    since = (now - timedelta(days=days)).isoformat(timespec="minutes")
    return run_query("SELECT * FROM mm_shipments WHERE departure_at >= ? AND status != 'Programado'",
                     (since,)).to_dict(orient="records")


@app.get("/api/geo/departments")
def geo_departments() -> dict:
    """Departamentos (DANE) con las toneladas que los atraviesan en 30 días."""
    now = _sync()
    traffic = geo.department_traffic(_recent_shipments(now))
    peak = max(traffic.values(), default=0.0) or 1.0
    base = geo.departments()
    features = []
    for f in base["features"]:
        code = f["properties"]["code"]
        t = traffic.get(code, 0.0)
        features.append({**f, "properties": {
            **f["properties"], "traffic_t": F.tons(t), "traffic_fmt": F.tons_fmt(t),
            # Escala raíz: el granel (miles de t) no aplasta a los demás
            "intensity": round((t / peak) ** 0.5, 3),
        }})
    return {"type": "FeatureCollection", "metadata": base.get("metadata", {}), "features": features}


@app.get("/api/dashboard/summary")
def dashboard_summary() -> dict:
    now = _sync()
    rows = run_query("SELECT * FROM mm_shipments").to_dict(orient="records")
    counts = {k: 0 for k in ("Programado", "En Ruta", "Transferencia Modal", "Retrasado", "Entregado")}
    in_transit_t, in_transit_cost = 0.0, 0.0
    tkm_by_mode: dict = {}
    corridor_t: dict = {}
    delivered, on_time = 0, 0
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
        if r["status"] in telemetry.ACTIVE_STATUSES:
            in_transit_t += r["weight_t"]
            in_transit_cost += r["total_cost"]
        if r["status"] == "Entregado":
            delivered += 1
            on_time += 1 if not r["delay_h"] else 0
        if r["status"] == "Programado":
            continue
        route = json.loads(r["route_json"])
        for lg in route["legs"]:
            tkm_by_mode[lg["mode"]] = tkm_by_mode.get(lg["mode"], 0.0) + r["weight_t"] * lg["distance_km"]
            for c in lg["corridors"]:
                corridor_t[c] = corridor_t.get(c, 0.0) + r["weight_t"]

    total_tkm = sum(tkm_by_mode.values()) or 1.0
    modal_split = [{
        "mode": m, "label": F.MODE_LABELS[m], "tkm": round(v),
        "tkm_fmt": F.number(v / 1e6, 2) + " M t-km", "share_pct": F.pct(100 * v / total_tkm),
    } for m, v in sorted(tkm_by_mode.items(), key=lambda kv: -kv[1])]
    top_corridors = [{"corridor": c, "tons": F.tons(t), "tons_fmt": F.tons_fmt(t)}
                     for c, t in sorted(corridor_t.items(), key=lambda kv: -kv[1])[:6]]
    active = counts["En Ruta"] + counts["Transferencia Modal"] + counts["Retrasado"]
    otif = 100 * on_time / delivered if delivered else None

    # Serie de despachos de los últimos 14 días (para el sparkline)
    days = [(now - timedelta(days=d)).date() for d in range(13, -1, -1)]
    per_day = {d: 0 for d in days}
    for r in rows:
        d = datetime.fromisoformat(r["departure_at"]).date()
        if d in per_day:
            per_day[d] += 1

    return {
        "generated_at": now.isoformat(timespec="seconds"),
        "status_counts": counts,
        "kpis": {
            "active": {"value": active, "fmt": F.number(active)},
            "in_transfer": {"value": counts["Transferencia Modal"],
                            "fmt": F.number(counts["Transferencia Modal"])},
            "delayed": {"value": counts["Retrasado"], "fmt": F.number(counts["Retrasado"])},
            "tons_in_transit": {"value": F.tons(in_transit_t), "fmt": F.tons_fmt(in_transit_t)},
            "cost_in_transit": {"value": F.money(in_transit_cost), "fmt": F.money_fmt(in_transit_cost)},
            "otif": {"value": F.pct(otif) if otif is not None else None,
                     "fmt": F.pct_fmt(otif) if otif is not None else "N/D"},
            "delivered": {"value": delivered, "fmt": F.number(delivered)},
            "scheduled": {"value": counts["Programado"], "fmt": F.number(counts["Programado"])},
        },
        "modal_split": modal_split,
        "top_corridors": top_corridors,
        "dispatches_14d": [{"date": d.isoformat(), "count": per_day[d]} for d in days],
        "network": {"nodes": len(network().nodes), "links": len(network().links),
                    "modes": S.network_geojson(network())["stats"]},
    }


# ---------------------------------------------------------------------------
# Logística verde: combustible y huella de carbono (estimación por factores de modo)
# ---------------------------------------------------------------------------
@app.get("/api/sustainability/summary")
def sustainability_summary(days: int = 30) -> dict:
    """CO2e y combustible de los últimos `days` días, por modo, envío y día."""
    now = _sync()
    days = max(1, min(days, 365))
    rows = _recent_shipments(now, days)
    by_mode = {m: {"tkm": 0.0, "co2e_kg": 0.0, "fuel_l": 0.0} for m in SU.MODE_ORDER}
    per_day = {(now - timedelta(days=d)).date(): 0.0 for d in range(13, -1, -1)}
    per_shipment = []
    for r in rows:
        e = SU.shipment_emissions(json.loads(r["route_json"]), r["weight_t"])
        for m, v in e["by_mode"].items():
            for k, x in v.items():
                by_mode[m][k] += x
        d = datetime.fromisoformat(r["departure_at"]).date()
        if d in per_day:
            per_day[d] += e["co2e_kg"]
        per_shipment.append({"r": r, "e": e})

    tkm = sum(v["tkm"] for v in by_mode.values())
    co2 = sum(v["co2e_kg"] for v in by_mode.values())
    fuel = sum(v["fuel_l"] for v in by_mode.values())
    base = SU.road_baseline(tkm)
    saved_pct = 100 * (base["co2e_kg"] - co2) / base["co2e_kg"] if base["co2e_kg"] else 0.0
    fuel_ratio = 100 * fuel / base["fuel_l"] if base["fuel_l"] else 0.0

    modes = []
    for m in SU.MODE_ORDER:
        v, f = by_mode[m], SU.FACTORS[m]
        modes.append({
            "mode": m, "label": F.MODE_LABELS[m], "fuel_type": f.fuel,
            "tkm": round(v["tkm"]), "tkm_fmt": F.number(v["tkm"] / 1e6, 2) + " M t-km",
            "co2e_kg": round(v["co2e_kg"]), "co2e_fmt": F.tons_fmt(v["co2e_kg"] / 1000),
            "fuel_l": round(v["fuel_l"]), "fuel_fmt": F.number(v["fuel_l"]) + " L",
            "intensity_g_tkm": f.g_co2e_per_tkm,
            "co2e_share_pct": F.pct(100 * v["co2e_kg"] / co2) if co2 else 0.0,
        })
    top = sorted(per_shipment, key=lambda x: -x["e"]["co2e_kg"])[:6]
    return {
        "generated_at": now.isoformat(timespec="seconds"),
        "window_days": days, "shipments": len(rows),
        "totals": {
            "co2e_kg": round(co2), "co2e_fmt": F.tons_fmt(co2 / 1000),
            "fuel_l": round(fuel), "fuel_fmt": F.number(fuel) + " L",
            "tkm": round(tkm), "tkm_fmt": F.number(tkm / 1e6, 2) + " M t-km",
            "intensity_g_tkm": round(1000 * co2 / tkm, 1) if tkm else 0.0,
            "baseline_co2e_fmt": F.tons_fmt(base["co2e_kg"] / 1000),
            "baseline_fuel_fmt": F.number(base["fuel_l"]) + " L",
            # Positivo = la multimodalidad emite menos que mover todo por carretera
            "saved_vs_road_pct": F.pct(saved_pct),
            "fuel_vs_road_pct": F.pct(fuel_ratio),
        },
        "by_mode": modes,
        "co2e_14d": [{"date": d.isoformat(), "co2e_kg": round(v)} for d, v in per_day.items()],
        "top_emitters": [{
            "code": x["r"]["shipment_code"],
            "route": f"{x['r']['origin_city']} → {x['r']['dest_city']}",
            "modes": x["r"]["modes"].split(","),
            "co2e_kg": round(x["e"]["co2e_kg"]), "co2e_fmt": F.tons_fmt(x["e"]["co2e_kg"] / 1000),
            "fuel_fmt": F.number(x["e"]["fuel_l"]) + " L",
        } for x in top],
        "method": {
            "note": "Estimación por factores de intensidad por modo (pozo a rueda); no es un inventario certificado.",
            "factors": [{"mode": m, "g_co2e_per_tkm": SU.FACTORS[m].g_co2e_per_tkm,
                         "fuel": SU.FACTORS[m].fuel} for m in SU.MODE_ORDER],
        },
    }


@app.get("/api/sustainability/fuel-live")
def sustainability_fuel_live() -> dict:
    """Telemetría de combustible por activo en tránsito (consumido y restante estimados)."""
    now = _sync()
    assets = []
    for item in telemetry.live_fleet(now):
        s, st, lg = item["shipment"], item["state"], item["leg"]
        fb = SU.fuel_burned(item["route"], s["weight_t"], st["route_h"])
        mode = lg["mode"]
        asset = lg.get("asset", {})
        assets.append({
            "id": asset.get("id", s["shipment_code"]), "shipment_code": s["shipment_code"],
            "mode": mode, "mode_label": F.MODE_LABELS[mode], "fuel_type": SU.FACTORS[mode].fuel,
            "origin": s["origin_city"], "destination": s["dest_city"],
            "progress_pct": F.pct(st["progress"] * 100),
            "burned_l": round(fb["burned_l"]), "total_l": round(fb["total_l"]),
            "burned_pct": F.pct(100 * fb["burned_l"] / fb["total_l"]) if fb["total_l"] else 0.0,
            "co2e_kg": round(fb["total_l"] * SU.FACTORS[mode].kg_co2e_per_l),
        })
    assets.sort(key=lambda a: -a["burned_l"])
    burned = sum(a["burned_l"] for a in assets)
    total = sum(a["total_l"] for a in assets)
    return {"generated_at": now.isoformat(timespec="seconds"), "count": len(assets),
            "burned_l": burned, "burned_fmt": F.number(burned) + " L",
            "total_l": total, "total_fmt": F.number(total) + " L",
            "burned_pct": F.pct(100 * burned / total) if total else 0.0,
            "assets": assets}
