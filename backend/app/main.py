"""
main.py
API de Westvane TMS (FastAPI).

Endpoints principales:
  GET  /api/network/multimodal   Red multimodal como GeoJSON (nodos y enlaces).
  POST /api/routes/simulate      Ruta multimodal óptima con tramos, transbordos,
                                 tiempos, costos y recorrido animable.
  GET  /api/fleet/live           Posición interpolada de cada activo en tránsito.

Complementarios: /api/shipments, /api/shipments/{code}, /api/dashboard/summary,
/api/geo/departments, /api/locations y /api/health.

Operación (sin autenticación; el campo `usuario` es un nombre declarado):
  GET/POST            /api/corridors, /api/corridors/status   Vías y su cierre
  GET/POST/PUT/DELETE /api/fleet/..., /api/warehouses/...      Flota de vehículos y bodegas (api/fleet_wh.py)
  GET/POST            /api/nodes/status                       Nodos (aeropuertos, puertos) y su cierre
  POST/PUT/DELETE     /api/shipments[/{code}]                 Envíos editables
  POST                /api/shipments/preview                  Ruta sin guardar
  GET/PUT             /api/settings[/fx|/replenish]           TRM y reposición
  GET                 /api/audit                              Historial
  GET                 /api/shipments/{code}/pdf               PDF individual
  GET/POST/DELETE     /api/exports[/{token}]                  Enlaces para compartir
  GET/POST            /api/shipments/{code}/events            Bitácora: notas e incidencias en ruta
  GET/POST/DELETE     /api/shipments/{code}/attachments       Documentos adjuntos del envío
  POST                /api/shipments/import                   Carga masiva desde Excel o CSV (vista previa y confirmar)
  GET                 /api/reports/operations                 Reporte operativo del período en PDF
  GET                 /api/clients                            Resumen por cliente
  POST                /api/settings/fx/official               TRM oficial desde datos.gov.co

Ejecución local (desde backend/):  uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import asyncio
import json
import os
import secrets
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Literal

from fastapi import FastAPI, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field

from app.api import format as F
from app.api import guard
from app.api import serializers as S
from app.database.db import run_query, run_write
from app.data.colombia_ciudades import category_of
from app.engine import (clients, fleet, fx, geo, history, journal, legal, operations as ops, pdf, report,
                        shipments_io, sustainability as SU, telemetry, tolls, trends, warehouses, xlsx)
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


_sync_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Caché corta de lecturas. Varias pestañas, el resumen y los sondeos de 20 s piden lo mismo; sin caché,
# cada petición recalcula el resumen, la flota y la huella (pandas) y bajo carga se encolan segundos.
# Una respuesta GET en JSON se reutiliza hasta CACHE_TTL_S; cualquier escritura (POST/PUT/DELETE) o una
# sincronización de la operación la invalida, así nunca se ve un dato anterior a un cambio propio.
CACHE_TTL_S = float(os.environ.get("WESTVANE_CACHE_TTL", "5"))  # 0 la desactiva (pruebas)
CACHE_MAX = 256
_cache: dict[str, tuple[int, float, bytes, str]] = {}
_cache_version = 0
_cache_lock = threading.Lock()
_inflight: dict[str, "asyncio.Future"] = {}
# Lecturas que no se cachean: salud, PDF y archivos generados
_NO_CACHE = ("/api/health", "/api/client-errors", "/api/exports/", "/api/tolls/export", "/api/reports/", "/api/shipments/import/")


def _bump_cache() -> None:
    global _cache_version
    with _cache_lock:
        _cache_version += 1
        _cache.clear()


_last_purge_day = ""


def _purge_attachments_daily(now: datetime) -> None:
    """Una vez al día aplica el plazo de conservación de adjuntos (ATTACHMENT_RETENTION_DAYS)."""
    global _last_purge_day
    day = now.strftime("%Y-%m-%d")
    if day != _last_purge_day:
        _last_purge_day = day
        journal.purge_expired(now)


def _sync() -> datetime:
    """Actualiza estados y repone despachos, con un mínimo de intervalo.

    Los endpoints corren en varios hilos: solo uno sincroniza a la vez. Si otro ya lo está haciendo, esta
    petición no espera ni escribe en paralelo (SQLite se bloquearía); sigue con los datos de hace unos segundos.
    """
    global _last_sync
    now = datetime.now()
    if time.monotonic() - _last_sync >= SYNC_INTERVAL_S and _sync_lock.acquire(blocking=False):
        try:
            if time.monotonic() - _last_sync >= SYNC_INTERVAL_S:
                telemetry.sync(network(), now)
                _last_sync = time.monotonic()
                _purge_attachments_daily(now)
                _bump_cache()
        finally:
            _sync_lock.release()
    return now


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from app.database.db import enable_wal
    from app.init_db import init_database
    init_database(reset=False)
    enable_wal()
    yield


# En producción no se publica la documentación interactiva de la API (/docs, /redoc, /openapi.json):
# describe cada ruta y parámetro a quien la busque. WESTVANE_ENV=production la apaga (docker-compose.prod.yml).
_PROD = os.environ.get("WESTVANE_ENV") == "production"
app = FastAPI(
    title="Westvane TMS API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url=None if _PROD else "/docs",
    redoc_url=None if _PROD else "/redoc",
    openapi_url=None if _PROD else "/openapi.json",
)


@app.middleware("http")
async def read_cache(request: Request, call_next):
    path = request.url.path
    if request.method != "GET":
        response = await call_next(request)
        if request.method in ("POST", "PUT", "DELETE"):
            _bump_cache()
        return response
    if CACHE_TTL_S <= 0 or not path.startswith("/api/") or path.startswith(_NO_CACHE) or path.endswith("/pdf"):
        return await call_next(request)
    key = f"{path}?{request.url.query}"
    hit = _cache.get(key)
    if hit and hit[0] == _cache_version and time.monotonic() - hit[1] < CACHE_TTL_S:
        return Response(hit[2], media_type=hit[3], headers={"x-cache": "hit"})
    # Vuelo único: si la misma lectura ya se está calculando, se espera ese resultado en vez de repetirla
    pending = _inflight.get(key)
    if pending is not None:
        try:
            body, media = await asyncio.wait_for(asyncio.shield(pending), timeout=30)
            return Response(body, media_type=media, headers={"x-cache": "shared"})
        except Exception:
            pass  # la primera falló o tardó demasiado: esta petición calcula por su cuenta
    future: asyncio.Future = asyncio.get_running_loop().create_future()
    _inflight[key] = future
    version = _cache_version
    try:
        response = await call_next(request)
        if response.status_code != 200 or "application/json" not in response.headers.get("content-type", ""):
            future.set_exception(RuntimeError("sin caché"))
            return response
        body = b"".join([chunk async for chunk in response.body_iterator])
        media = response.headers["content-type"]
        future.set_result((body, media))
        with _cache_lock:
            if version == _cache_version:
                if len(_cache) >= CACHE_MAX:
                    _cache.clear()
                _cache[key] = (version, time.monotonic(), body, media)
        return Response(body, status_code=200, media_type=media, headers={"x-cache": "miss"})
    except BaseException as exc:
        if not future.done():
            future.set_exception(RuntimeError(str(exc)))
        raise
    finally:
        if _inflight.get(key) is future:
            del _inflight[key]
        # Si nadie esperaba el resultado fallido, se marca como visto para que asyncio no avise en el log
        if future.done() and not future.cancelled():
            future.exception()


@app.middleware("http")
async def abuse_guard(request: Request, call_next):
    """Tamaño máximo del cuerpo y límite de escrituras por cliente (ver app/api/guard.py)."""
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.url.path.startswith("/api/"):
        if guard.body_too_large(request.headers.get("content-length")):
            return Response(json.dumps({"detail": "La solicitud es demasiado grande (máximo 16 MB)."}),
                            status_code=413, media_type="application/json")
        key = guard.client_key(request.headers.get("x-forwarded-for"), request.client.host if request.client else None)
        wait = guard.check_rate(key, request.url.path)
        if wait is not None:
            return Response(json.dumps({"detail": "Demasiadas solicitudes seguidas; espera un momento y vuelve a intentar."}),
                            status_code=429, media_type="application/json", headers={"Retry-After": str(int(wait))})
    return await call_next(request)


app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


@app.middleware("http")
async def api_v1_alias(request: Request, call_next):
    """/api/v1/... es la misma API que /api/...: la versión explícita para integraciones de terceros.
    Si algún día cambia un contrato, /api/v2 convivirá con la anterior. Se registra al final: corre primero."""
    path = request.scope["path"]
    if path.startswith("/api/v1/"):
        request.scope["path"] = "/api/" + path[len("/api/v1/"):]
        request.scope["raw_path"] = request.scope["path"].encode()
    response = await call_next(request)
    response.headers["X-API-Version"] = "1"
    return response


# Flota de vehículos y red de bodegas (endpoints en api/fleet_wh.py)
from app.api import fleet_wh  # noqa: E402

fleet_wh.register(app, sync=lambda: _sync(), network=lambda: network())


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
        modes = sorted(set().union(*(net.modes_at(c) for c in codes)))
        # Vías hacia OTRA ciudad: un conector local aeropuerto-puerto no cuenta como acceso por tierra
        road_modes = {l["mode"] for l in net.links
                      if (l["origin_code"] in codes and net.nodes[l["dest_code"]]["city"] != city)
                      or (l["dest_code"] in codes and net.nodes[l["origin_code"]]["city"] != city)}
        cities.append({
            "city": city,
            "department_code": nodes[0]["department_code"],
            "category": category_of(city, sorted(road_modes)),
            "lat": nodes[0]["latitude"], "lon": nodes[0]["longitude"],
            "kinds": sorted({n["kind"] for n in nodes}),
            "modes": modes,
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


def _footprint(legs: list, weight_t: float) -> dict:
    """Huella (CO2e y combustible) de una ruta, con cifras y textos listos para mostrar."""
    fp = SU.route_footprint(legs, weight_t)
    return {
        "co2e_kg": round(fp["co2e_kg"]), "co2e_fmt": F.number(fp["co2e_kg"]) + " kg",
        "fuel_l": round(fp["fuel_l"]), "fuel_fmt": F.number(fp["fuel_l"]) + " L",
        "intensity_g_tkm": round(fp["intensity_g_tkm"], 1),
        "baseline_co2e_kg": round(fp["baseline"]["co2e_kg"]),
        "baseline_fuel_l": round(fp["baseline"]["fuel_l"]),
        "saved_vs_road_pct": F.pct(fp["saved_vs_road_pct"]),
        "per_leg": [{"co2e_kg": round(e["co2e_kg"], 1), "fuel_l": round(e["fuel_l"], 1)} for e in fp["per_leg"]],
        "by_mode": [{"mode": m, "label": F.MODE_LABELS[m], "fuel_type": SU.FACTORS[m].fuel,
                     "co2e_kg": round(v["co2e_kg"]), "fuel_l": round(v["fuel_l"])}
                    for m, v in fp["by_mode"].items()],
    }


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
            alt = net.route(req.origen, req.destino, req.peso_t, p, **kw)
        except RoutingError as exc:
            alternatives.append({"priority": p, "found": False, "error": str(exc)})
            continue
        summary = S.route_summary(alt)
        fp = SU.route_footprint(alt["legs"], req.peso_t)
        summary.update({"co2e_kg": round(fp["co2e_kg"]), "co2e_fmt": F.number(fp["co2e_kg"]) + " kg",
                        "fuel_l": round(fp["fuel_l"]), "fuel_fmt": F.number(fp["fuel_l"]) + " L"})
        alternatives.append(summary)
    return {"route": S.route(best), "alternatives": alternatives,
            "footprint": _footprint(best["legs"], req.peso_t)}


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


def _detail(r: dict, now: datetime) -> dict:
    """Envío con su recorrido y su huella (CO2e y combustible)."""
    out = S.shipment(r, status_at(r, now), detail=True)
    out["footprint"] = _footprint(json.loads(r["route_json"])["legs"], r["weight_t"])
    return out


def _shipment_row(code: str) -> dict:
    rows = run_query("SELECT * FROM mm_shipments WHERE shipment_code = ?", (code,))
    if rows.empty:
        raise HTTPException(status_code=404, detail=f"Envío {code} no encontrado")
    return rows.to_dict(orient="records")[0]


@app.get("/api/shipments/{code}")
def shipment_detail(code: str) -> dict:
    now = _sync()
    r = _shipment_row(code)
    return _detail(r, now)


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
        route = ops.preview(network(), body.model_dump())
        return {"route": S.route(route), "footprint": _footprint(route["legs"], body.weight_t)}
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
    return _detail(r, now)


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
    return _detail(r, now)


@app.delete("/api/shipments/{code}")
def shipment_delete(code: str, usuario: str | None = None) -> dict:
    try:
        ops.delete_shipment(code, usuario)
    except LookupError:
        raise HTTPException(status_code=404, detail=f"Envío {code} no encontrado")
    journal.purge(code)
    return {"deleted": code}


# ---------------------------------------------------------------------------
# Carga masiva, bitácora y adjuntos de envíos
# ---------------------------------------------------------------------------
class ImportIn(BaseModel):
    filename: str = Field(..., min_length=1, max_length=200)
    content_b64: str = Field(..., min_length=1)
    commit: bool = False
    usuario: str | None = None
    # Al guardar: quien importa declara que tiene autorización para los datos personales del archivo
    autorizado: bool = False


_NEEDS_AUTH = "Confirma que tienes autorización para compartir los datos personales que contiene el archivo."


@app.post("/api/shipments/import")
def shipments_import(body: ImportIn) -> dict:
    """Sin `commit`: valida cada fila y muestra la ruta que tendría. Con `commit`: crea las filas válidas."""
    if body.commit and not body.autorizado:
        raise HTTPException(status_code=422, detail=_NEEDS_AUTH)
    try:
        return shipments_io.import_shipments(network(), body.filename, body.content_b64, body.usuario,
                                              datetime.now(), body.commit)
    except ops.OperationError as exc:
        _op_error(exc)


@app.get("/api/shipments/import/template")
def shipments_import_template() -> Response:
    return Response(shipments_io.template(),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": 'attachment; filename="plantilla-envios-westvane.xlsx"'})


EventKind = Literal["nota", "retraso", "derrumbe", "paro", "clima", "mecanica", "otro"]


class EventIn(BaseModel):
    kind: EventKind = "nota"
    body: str = Field(..., min_length=1, max_length=2000)
    delay_h: float = Field(0, ge=0, le=journal.MAX_DELAY_H)
    usuario: str | None = None


def _not_found(code: str):
    raise HTTPException(status_code=404, detail=f"Envío {code} no encontrado")


@app.get("/api/shipments/{code}/events")
def shipment_events(code: str) -> dict:
    try:
        items = journal.events(code)
    except LookupError:
        _not_found(code)
    return {"count": len(items), "items": items}


@app.post("/api/shipments/{code}/events", status_code=201)
def shipment_event_add(code: str, body: EventIn) -> dict:
    global _last_sync
    try:
        event = journal.add_event(network(), code, body.kind, body.body, body.delay_h, body.usuario, datetime.now())
    except LookupError:
        _not_found(code)
    except ops.OperationError as exc:
        _op_error(exc)
    if body.delay_h:
        _last_sync = 0.0  # el estado del envío cambia (puede pasar a Retrasado)
    return event


@app.post("/api/shipments/{code}/events/{event_id}/resolve")
def shipment_event_resolve(code: str, event_id: int, usuario: str | None = None) -> dict:
    try:
        return journal.resolve_event(code, event_id, usuario)
    except LookupError:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    except ops.OperationError as exc:
        _op_error(exc)


@app.delete("/api/shipments/{code}/events/{event_id}")
def shipment_event_delete(code: str, event_id: int, usuario: str | None = None) -> dict:
    try:
        journal.delete_event(code, event_id, usuario)
    except LookupError:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    except ops.OperationError as exc:
        _op_error(exc)
    return {"deleted": event_id}


@app.get("/api/incidents")
def incidents(days: int = 7) -> dict:
    """Incidencias de todos los envíos en los últimos `days` días (para el reporte y el resumen)."""
    items = journal.recent_incidents(max(1, min(days, 365)))
    return {"count": len(items), "open": sum(1 for e in items if not e["resolved_at"]), "items": items}


class AttachmentIn(BaseModel):
    filename: str = Field(..., min_length=1, max_length=200)
    content_b64: str = Field(..., min_length=1)
    usuario: str | None = None
    # Quien sube el documento declara que tiene autorización para los datos personales que contenga
    autorizado: bool = False


@app.get("/api/shipments/{code}/attachments")
def shipment_attachments(code: str) -> dict:
    try:
        items = journal.attachments(code)
    except LookupError:
        _not_found(code)
    return {"count": len(items), "items": items}


@app.post("/api/shipments/{code}/attachments", status_code=201)
def shipment_attachment_add(code: str, body: AttachmentIn) -> dict:
    if not body.autorizado:
        raise HTTPException(status_code=422, detail=_NEEDS_AUTH)
    try:
        return journal.add_attachment(code, body.filename, body.content_b64, body.usuario)
    except LookupError:
        _not_found(code)
    except ops.OperationError as exc:
        _op_error(exc)


@app.get("/api/shipments/{code}/attachments/{attachment_id}")
def shipment_attachment_file(code: str, attachment_id: int, descargar: bool = False) -> Response:
    try:
        data, media, name = journal.attachment_file(code, attachment_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    disposition = "attachment" if descargar else "inline"
    # El nombre original va codificado (RFC 5987) para tildes y eñes
    from urllib.parse import quote
    return Response(data, media_type=media, headers={
        "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(name)}",
        "X-Content-Type-Options": "nosniff",
    })


@app.delete("/api/shipments/{code}/attachments/{attachment_id}")
def shipment_attachment_delete(code: str, attachment_id: int, usuario: str | None = None) -> dict:
    try:
        journal.delete_attachment(code, attachment_id, usuario)
    except LookupError:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    return {"deleted": attachment_id}


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


@app.get("/api/nodes/status")
def nodes_status() -> dict:
    now = _sync()
    items = ops.nodes_status(network(), now)
    return {"count": len(items), "closed": sum(1 for n in items if not n["active"]), "items": items}


class NodeStatusIn(BaseModel):
    code: str
    active: bool
    reason: str | None = None
    usuario: str | None = None


@app.post("/api/nodes/status")
def node_status(body: NodeStatusIn) -> dict:
    global _last_sync
    try:
        result = ops.set_node_status(_network, body.code, body.active, body.reason,
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


@app.post("/api/settings/fx/official")
def settings_fx_official(usuario: str | None = None) -> dict:
    """Trae la TRM oficial del día (datos.gov.co). Si no hay conexión, responde 502 y no cambia nada."""
    try:
        return fx.update_from_official(usuario)
    except ops.OperationError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


class ReplenishIn(BaseModel):
    enabled: bool
    usuario: str | None = None


@app.put("/api/settings/replenish")
def settings_replenish(body: ReplenishIn) -> dict:
    return {"auto_replenish": ops.set_auto_replenish(body.enabled, body.usuario)}


class TollIn(BaseModel):
    tolls_cop: float = Field(..., ge=0)
    note: str | None = None
    source: str | None = None
    usuario: str | None = None


class TollImportIn(BaseModel):
    filename: str
    content_b64: str
    usuario: str | None = None


@app.get("/api/tolls")
def tolls_list() -> dict:
    items = tolls.list_tolls()
    return {"count": len(items), "items": items}


@app.get("/api/tolls/export")
def tolls_export() -> Response:
    return Response(
        content=tolls.export_csv(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="peajes-westvane.csv"'},
    )


@app.put("/api/tolls/{link_id}")
def toll_update(link_id: int, body: TollIn) -> dict:
    try:
        result = tolls.update_toll(link_id, body.tolls_cop, body.note, body.source, body.usuario)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ops.OperationError as exc:
        _op_error(exc)
    _network(reload=True)
    return result


@app.post("/api/tolls/import")
def toll_import(body: TollImportIn) -> dict:
    try:
        result = tolls.import_file(body.filename, body.content_b64, body.usuario)
    except (ops.OperationError, ValueError) as exc:
        _op_error(exc)
    _network(reload=True)
    return result


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


class ActualCostIn(BaseModel):
    # None borra el costo registrado
    amount: float | None = Field(None, ge=0)
    moneda: Literal["USD", "COP"] = "USD"
    note: str | None = Field(None, max_length=300)
    usuario: str | None = None


@app.put("/api/shipments/{code}/actual-cost")
def shipment_actual_cost(code: str, body: ActualCostIn) -> dict:
    """Lo que de verdad costó el envío (facturas), para compararlo con el costo estimado por el motor."""
    amount = body.amount
    if amount is not None and body.moneda == "COP":
        rate = ops.get_fx().get("rate")
        if not rate:
            raise HTTPException(status_code=422, detail="No hay TRM configurada: ingrésala en Configuración o registra el valor en USD.")
        amount = amount / rate
    try:
        return journal.set_actual_cost(code, amount, body.note, body.usuario)
    except LookupError:
        _not_found(code)
    except ops.OperationError as exc:
        _op_error(exc)


@app.get("/api/shipments/{code}/remesa")
def shipment_remesa(code: str, descargar: bool = False) -> Response:
    """Remesa de carga para imprimir y firmar (formato de referencia; no reemplaza la del RNDC)."""
    now = _sync()
    row = _shipment_row(code)
    data = pdf.remesa(row, now, legal.responsible()["name"])
    disposition = "attachment" if descargar else "inline"
    return Response(data, media_type="application/pdf",
                    headers={"Content-Disposition": f'{disposition}; filename="remesa-{code}.pdf"'})


class ExportIn(BaseModel):
    codes: list[str] = Field(..., min_length=1, max_length=300)
    moneda: Currency = "USD"
    usuario: str | None = None


@app.post("/api/exports/xlsx")
def export_xlsx(body: ExportIn) -> Response:
    """Envíos elegidos (por ejemplo, la tabla filtrada) en Excel, con montos en la moneda pedida."""
    now = _sync()
    placeholders = ",".join("?" for _ in body.codes)
    rows = run_query(f"SELECT * FROM mm_shipments WHERE shipment_code IN ({placeholders})", tuple(body.codes))
    if rows.empty:
        raise HTTPException(status_code=404, detail="Ninguno de los envíos existe")
    order = {c: i for i, c in enumerate(body.codes)}
    records = sorted(rows.to_dict(orient="records"), key=lambda r: order.get(r["shipment_code"], 0))
    try:
        data = xlsx.render(records, body.moneda, ops.get_fx(), now)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    name = f"envios-{now:%Y%m%d-%H%M}.xlsx"
    return Response(data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


@app.get("/api/history")
def history_view(days: int = 30) -> dict:
    """Historial de trayectos por ciudad, departamento y corredor en los últimos `days` días."""
    if not 1 <= days <= 365:
        raise HTTPException(status_code=422, detail="La ventana debe estar entre 1 y 365 días.")
    return history.history(_sync(), days)


@app.get("/api/reports/operations")
def report_operations(days: int = 7, moneda: Currency = "USD", descargar: bool = False) -> Response:
    """Reporte operativo del período en PDF (por defecto, la última semana)."""
    if not 1 <= days <= 90:
        raise HTTPException(status_code=422, detail="El período debe estar entre 1 y 90 días.")
    now = _sync()
    try:
        data = report.render(network(), days, moneda, ops.get_fx(), now)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    name = f"reporte-operativo-{now:%Y%m%d}.pdf"
    return Response(data, media_type="application/pdf",
                    headers={"Content-Disposition": f'{"attachment" if descargar else "inline"}; filename="{name}"'})


@app.get("/api/clients")
def clients_summary() -> dict:
    now = _sync()
    rows = run_query("SELECT shipment_code, client, origin_city, dest_city, weight_t, total_cost, modes, status, "
                     "departure_at, total_time_h, delay_h, route_json, actual_cost FROM mm_shipments").to_dict(orient="records")
    items = clients.summary(rows, now)
    return {"count": len(items), "items": items}


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


def _alerts(rows: list, fs: dict, ws: dict) -> dict:
    """Lo que requiere una decisión ahora: flota, bodegas, cierres, envíos sin ruta, redirigidos y retrasados."""
    return {
        "fleet": {
            "disabled": fs["by_status"].get("Inhabilitado", 0),
            "in_shop": fs["by_status"].get("En mantenimiento", 0),
            "overdue": fs["by_status"].get("Mantenimiento vencido", 0),
            "open_faults": len(fs["open_faults"]),
        },
        "warehouses": {
            "low_stock": ws["low_stock_lines"],
            "full": list(ws["full_warehouses"]),
        },
        "closed_corridors": sorted(network().closed_corridors),
        "closed_nodes": [{"code": c, "name": network().nodes[c]["name"], "reason": r}
                         for c, r in sorted(network().closed_nodes.items())],
        "no_route": sorted(r["shipment_code"] for r in rows
                           if r.get("route_status") == "sin_ruta" and r["status"] != "Entregado"),
        "rerouted": sorted(r["shipment_code"] for r in rows
                           if str(r.get("route_note") or "").startswith("Redirigida")
                           and r["status"] != "Entregado"),
        "delayed": [{"code": r["shipment_code"], "origin": r["origin_city"],
                     "destination": r["dest_city"], "delay_fmt": F.duration_fmt(r["delay_h"])}
                    for r in sorted((r for r in rows if r["status"] == "Retrasado"),
                                    key=lambda r: -float(r["delay_h"] or 0))[:6]],
    }


@app.get("/api/alerts")
def alerts() -> dict:
    """Solo las alertas (para el aviso global del dock): más liviano que el resumen completo."""
    now = _sync()
    rows = run_query(
        "SELECT shipment_code, status, route_status, route_note, origin_city, dest_city, delay_h FROM mm_shipments"
    ).to_dict(orient="records")
    data = _alerts(rows, fleet.summary(now), warehouses.summary())
    fl, wh = data["fleet"], data["warehouses"]
    urgent = (fl["disabled"] + fl["in_shop"] > 0) + bool(data["no_route"]) + bool(data["closed_corridors"]) + bool(data["closed_nodes"])
    warn = (fl["overdue"] > 0) + bool(wh["low_stock"] or wh["full"]) + bool(data["rerouted"]) + bool(data["delayed"])
    return {"generated_at": now.isoformat(timespec="seconds"), "urgent": urgent, "total": urgent + warn, "alerts": data}


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
    all_corridors = [{"corridor": c, "tons": F.tons(t), "tons_fmt": F.tons_fmt(t)}
                     for c, t in sorted(corridor_t.items(), key=lambda kv: -kv[1])]
    top_corridors = all_corridors[:6]
    active = counts["En Ruta"] + counts["Transferencia Modal"] + counts["Retrasado"]
    otif = 100 * on_time / delivered if delivered else None

    # Serie de despachos de los últimos 14 días (para el sparkline)
    days = [(now - timedelta(days=d)).date() for d in range(13, -1, -1)]
    per_day = {d: 0 for d in days}
    for r in rows:
        d = datetime.fromisoformat(r["departure_at"]).date()
        if d in per_day:
            per_day[d] += 1

    fs, ws = fleet.summary(now), warehouses.summary()
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
        "all_corridors": all_corridors,
        "dispatches_14d": [{"date": d.isoformat(), "count": per_day[d]} for d in days],
        "trends": trends.trends(rows, now),
        "alerts": _alerts(rows, fs, ws),
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


# ---------------------------------------------------------------------------
# Documentos legales y registro de aceptaciones (app/engine/legal.py)
# ---------------------------------------------------------------------------
class ConsentItemIn(BaseModel):
    document: str = Field(..., max_length=40)
    version: str | None = Field(None, max_length=20)
    accepted: bool = True
    text: str = Field(..., min_length=1, max_length=500)


class ConsentIn(BaseModel):
    browser_id: str = Field(..., min_length=16, max_length=64)
    subject: str | None = Field(None, max_length=60)
    context: str = Field(..., max_length=20)
    items: list[ConsentItemIn] = Field(..., min_length=1, max_length=10)


@app.get("/api/legal")
def legal_info() -> dict:
    """Versiones vigentes de los documentos y datos del responsable (de LEGAL_* en el entorno)."""
    return legal.info()


@app.get("/api/consents")
def consents_status(browser_id: str) -> dict:
    try:
        return legal.status(browser_id)
    except ops.OperationError as exc:
        _op_error(exc)


@app.post("/api/consents", status_code=201)
def consents_record(body: ConsentIn, request: Request) -> dict:
    ip = guard.client_key(request.headers.get("x-forwarded-for"), request.client.host if request.client else None)
    try:
        return legal.record(body.browser_id, body.subject, body.context,
                            [i.model_dump() for i in body.items], ip, request.headers.get("user-agent"))
    except ops.OperationError as exc:
        _op_error(exc)


@app.get("/api/consents/export")
def consents_export() -> Response:
    """Registro completo en CSV (para atender una consulta o un reclamo del titular)."""
    return Response(legal.export_csv(), media_type="text/csv; charset=utf-8", headers={
        "Content-Disposition": f"attachment; filename=registro-aceptaciones-{datetime.now():%Y%m%d}.csv"})


# ---------------------------------------------------------------------------
# Errores del navegador (para enterarse de un fallo sin que nadie lo reporte)
# ---------------------------------------------------------------------------
class ClientErrorIn(BaseModel):
    path: str = Field(..., max_length=300)
    message: str = Field(..., min_length=1, max_length=1000)
    stack: str | None = Field(None, max_length=4000)
    release: str | None = Field(None, max_length=40)


@app.post("/api/client-errors", status_code=204)
def client_error(body: ClientErrorIn, request: Request) -> Response:
    path = body.path.split("?")[0].split("#")[0][:300]  # sin parámetros: pueden llevar datos
    run_write("INSERT INTO mm_client_errors (created_at, path, message, stack, user_agent, release) VALUES (?,?,?,?,?,?)",
              (datetime.now().isoformat(timespec="seconds"), path, body.message, body.stack,
               (request.headers.get("user-agent") or "")[:200], body.release))
    run_write("DELETE FROM mm_client_errors WHERE error_id <= (SELECT MAX(error_id) - 500 FROM mm_client_errors)")
    return Response(status_code=204)


@app.get("/api/client-errors")
def client_errors(limit: int = 50) -> dict:
    rows = run_query("SELECT error_id, created_at, path, message, stack, user_agent, release FROM mm_client_errors "
                     "ORDER BY error_id DESC LIMIT ?", (max(1, min(limit, 200)),))
    items = rows.astype(object).where(rows.notna(), None).to_dict(orient="records")
    return {"count": len(items), "items": items}
