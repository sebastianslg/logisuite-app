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

Operación (sin autenticación; el campo `usuario` es un nombre declarado):
  GET/POST            /api/corridors, /api/corridors/status   Vías y su cierre
  POST/PUT/DELETE     /api/shipments[/{code}]                 Envíos editables
  POST                /api/shipments/preview                  Ruta sin guardar
  GET/PUT             /api/settings[/fx|/replenish]           TRM y reposición
  GET                 /api/audit                              Historial
  GET                 /api/shipments/{code}/pdf               PDF individual
  GET/POST/DELETE     /api/exports[/{token}]                  Enlaces para compartir

Ejecución local (desde backend/):  uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import json
import os
import secrets
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Literal

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field

from app.api import format as F
from app.api import serializers as S
from app.database.db import run_query, run_write
from app.engine import geo, operations as ops, pdf, telemetry
from app.engine.dispatch import status_at
from app.engine.multimodal import MultimodalNetwork, RoutingError

SYNC_INTERVAL_S = 15  # la operación se pone al día como máximo cada 15 s
_last_sync = 0.0


@lru_cache(maxsize=1)
def network() -> MultimodalNetwork:
    return MultimodalNetwork.from_db()


def _network(reload: bool = False) -> MultimodalNetwork:
    if reload:
        network.cache_clear()
    return network()


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
    allow_methods=["GET", "POST", "PUT", "DELETE"],
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
    modos: list[str] = Field(default_factory=list)
    vias: list[str] = Field(default_factory=list)


@app.post("/api/routes/simulate")
def simulate_route(req: SimulateRequest) -> dict:
    net = network()
    kw = {"allowed_modes": req.modos or None, "required_corridors": req.vias or None}
    try:
        best = net.route(req.origen, req.destino, req.peso_t, req.prioridad, **kw)
    except RoutingError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    alternatives = []
    for p in ("tiempo", "costo", "balanceado"):
        try:
            alternatives.append(S.route_summary(net.route(req.origen, req.destino, req.peso_t, p, **kw)))
        except RoutingError as exc:
            alternatives.append({"priority": p, "found": False, "error": str(exc)})
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


def _shipment_row(code: str) -> dict:
    rows = run_query("SELECT * FROM mm_shipments WHERE shipment_code = ?", (code,))
    if rows.empty:
        raise HTTPException(status_code=404, detail=f"Envío {code} no encontrado")
    return rows.to_dict(orient="records")[0]


@app.get("/api/shipments/{code}")
def shipment_detail(code: str) -> dict:
    now = _sync()
    r = _shipment_row(code)
    return S.shipment(r, status_at(r, now), detail=True)


# ---------------------------------------------------------------------------
# Envíos editables
# ---------------------------------------------------------------------------
Mode = Literal["terrestre", "fluvial", "maritimo", "aereo", "ferreo"]


class ShipmentIn(BaseModel):
    origin: str
    destination: str
    cargo: str = ""
    weight_t: float
    priority: Literal["tiempo", "costo", "balanceado"] = "balanceado"
    client: str = ""
    departure_at: str
    delay_h: float = 0.0
    forced_modes: list[Mode] = Field(default_factory=list)
    forced_corridors: list[str] = Field(default_factory=list)
    usuario: str | None = None


class ShipmentPatch(BaseModel):
    origin: str | None = None
    destination: str | None = None
    cargo: str | None = None
    weight_t: float | None = None
    priority: Literal["tiempo", "costo", "balanceado"] | None = None
    client: str | None = None
    departure_at: str | None = None
    delay_h: float | None = None
    forced_modes: list[Mode] | None = None
    forced_corridors: list[str] | None = None
    usuario: str | None = None


def _op_error(exc: Exception):
    raise HTTPException(status_code=422, detail=str(exc))


@app.post("/api/shipments/preview")
def shipment_preview(body: ShipmentIn) -> dict:
    try:
        return {"route": S.route(ops.preview(network(), body.model_dump()))}
    except ops.OperationError as exc:
        _op_error(exc)


@app.post("/api/shipments", status_code=201)
def shipment_create(body: ShipmentIn) -> dict:
    now = datetime.now()
    try:
        code = ops.create_shipment(network(), body.model_dump(exclude={"usuario"}), body.usuario, now)
    except ops.OperationError as exc:
        _op_error(exc)
    r = _shipment_row(code)
    return S.shipment(r, status_at(r, now), detail=True)


@app.put("/api/shipments/{code}")
def shipment_update(code: str, body: ShipmentPatch) -> dict:
    now = datetime.now()
    data = {k: v for k, v in body.model_dump(exclude={"usuario"}).items() if v is not None}
    try:
        ops.update_shipment(network(), code, data, body.usuario, now)
    except LookupError:
        raise HTTPException(status_code=404, detail=f"Envío {code} no encontrado")
    except ops.OperationError as exc:
        _op_error(exc)
    r = _shipment_row(code)
    return S.shipment(r, status_at(r, now), detail=True)


@app.delete("/api/shipments/{code}")
def shipment_delete(code: str, usuario: str | None = None) -> dict:
    try:
        ops.delete_shipment(code, usuario)
    except LookupError:
        raise HTTPException(status_code=404, detail=f"Envío {code} no encontrado")
    return {"deleted": code}


# ---------------------------------------------------------------------------
# Vías
# ---------------------------------------------------------------------------
@app.get("/api/corridors")
def corridors() -> dict:
    now = _sync()
    items = ops.corridors(network(), now)
    for c in items:
        c["distance_fmt"] = F.km_fmt(c["distance_km"])
        c["distance_km"] = F.km(c["distance_km"])
    return {"count": len(items), "closed": sum(1 for c in items if not c["active"]), "items": items}


class CorridorStatusIn(BaseModel):
    corridor: str
    active: bool
    reason: str | None = None
    usuario: str | None = None


@app.post("/api/corridors/status")
def corridor_status(body: CorridorStatusIn) -> dict:
    global _last_sync
    try:
        result = ops.set_corridor_status(_network, body.corridor, body.active, body.reason,
                                         body.usuario, datetime.now())
    except ops.OperationError as exc:
        _op_error(exc)
    _last_sync = 0.0
    return result


# ---------------------------------------------------------------------------
# Configuración e historial
# ---------------------------------------------------------------------------
@app.get("/api/settings")
def settings() -> dict:
    return {"fx": ops.get_fx(), "auto_replenish": ops.auto_replenish()}


class FxIn(BaseModel):
    rate: float = Field(..., gt=0)
    date: str
    source: str
    usuario: str | None = None


@app.put("/api/settings/fx")
def settings_fx(body: FxIn) -> dict:
    try:
        return {"fx": ops.set_fx(body.rate, body.date, body.source, body.usuario)}
    except ops.OperationError as exc:
        _op_error(exc)


class ReplenishIn(BaseModel):
    enabled: bool
    usuario: str | None = None


@app.put("/api/settings/replenish")
def settings_replenish(body: ReplenishIn) -> dict:
    return {"auto_replenish": ops.set_auto_replenish(body.enabled, body.usuario)}


@app.get("/api/audit")
def audit_log(limit: int = 200, table: str | None = None, record: str | None = None) -> dict:
    items = ops.audit_entries(limit, table, record)
    return {"count": len(items), "items": items}


# ---------------------------------------------------------------------------
# PDF y enlaces para compartir
# ---------------------------------------------------------------------------
def _pdf_response(codes: list, currency: str, filename: str, download: bool) -> Response:
    now = _sync()
    rows = []
    for c in codes:
        r = run_query("SELECT * FROM mm_shipments WHERE shipment_code = ?", (c,))
        if not r.empty:
            rows.append(r.to_dict(orient="records")[0])
    if not rows:
        raise HTTPException(status_code=404, detail="Ninguno de los envíos existe")
    try:
        data = pdf.render(rows, currency, ops.get_fx(), now)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    disposition = "attachment" if download else "inline"
    return Response(data, media_type="application/pdf",
                    headers={"Content-Disposition": f'{disposition}; filename="{filename}"'})


Currency = Literal["USD", "COP"]


@app.get("/api/shipments/{code}/pdf")
def shipment_pdf(code: str, moneda: Currency = "USD", descargar: bool = False) -> Response:
    _shipment_row(code)
    return _pdf_response([code], moneda, f"{code}.pdf", descargar)


class ExportIn(BaseModel):
    codes: list[str] = Field(..., min_length=1, max_length=300)
    moneda: Currency = "USD"
    usuario: str | None = None


@app.post("/api/exports/pdf")
def export_pdf(body: ExportIn, descargar: bool = False) -> Response:
    """PDF consolidado al vuelo (sin crear enlace)."""
    return _pdf_response(body.codes, body.moneda, f"envios-{datetime.now():%Y%m%d-%H%M}.pdf", descargar)


@app.post("/api/exports", status_code=201)
def export_create(body: ExportIn) -> dict:
    missing = [c for c in body.codes
               if run_query("SELECT 1 FROM mm_shipments WHERE shipment_code = ?", (c,)).empty]
    if missing:
        raise HTTPException(status_code=404, detail=f"Envíos inexistentes: {', '.join(missing)}")
    if body.moneda == "COP" and not ops.get_fx()["rate"]:
        raise HTTPException(status_code=422, detail="No hay TRM configurada para exportar en COP.")
    token = secrets.token_urlsafe(18)
    run_write("""INSERT INTO mm_share_links (token, codes, currency, created_at, created_by)
                 VALUES (?,?,?,?,?)""",
              (token, ",".join(body.codes), body.moneda, datetime.now().isoformat(timespec="seconds"),
               ops._user(body.usuario)))
    ops.audit(body.usuario, "EXPORT", "mm_share_links", token[:8],
              f"Enlace creado para {len(body.codes)} envío(s): {', '.join(body.codes[:10])}"
              + ("..." if len(body.codes) > 10 else ""))
    return {"token": token, "path": f"/api/exports/{token}"}


@app.get("/api/exports")
def export_list() -> dict:
    items = run_query("SELECT * FROM mm_share_links ORDER BY created_at DESC").to_dict(orient="records")
    for i in items:
        i["codes"] = i["codes"].split(",")
        i["path"] = f"/api/exports/{i['token']}"
    return {"count": len(items), "items": items}


def _share(token: str) -> dict:
    rows = run_query("SELECT * FROM mm_share_links WHERE token = ?", (token,))
    if rows.empty or rows.iloc[0]["revoked_at"]:
        raise HTTPException(status_code=404, detail="Enlace inexistente o revocado")
    return rows.to_dict(orient="records")[0]


@app.get("/api/exports/{token}")
def export_open(token: str, descargar: bool = False) -> Response:
    link = _share(token)
    codes = link["codes"].split(",")
    name = f"{codes[0]}.pdf" if len(codes) == 1 else f"envios-{token[:6]}.pdf"
    return _pdf_response(codes, link["currency"], name, descargar)


@app.delete("/api/exports/{token}")
def export_revoke(token: str, usuario: str | None = None) -> dict:
    _share(token)
    run_write("UPDATE mm_share_links SET revoked_at = ? WHERE token = ?",
              (datetime.now().isoformat(timespec="seconds"), token))
    ops.audit(usuario, "REVOKE", "mm_share_links", token[:8], "Enlace revocado")
    return {"revoked": token}


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
