"""
tracking.py
Seguimiento público de un envío: un enlace con token, de solo lectura, para que el cliente vea dónde va su carga.

La vista pública solo muestra lo que el cliente necesita: ruta, estado, avance, llegada estimada, retraso, modos y
paradas. NO incluye costos, cliente, peso, quién lo registró, notas, incidencias ni documentos. Revocar el enlace lo
apaga al instante. El token es largo y al azar (no se puede adivinar).
"""
from __future__ import annotations

import json
import secrets
from datetime import datetime

from app.api import format as F
from app.database.db import run_query, run_write
from app.engine.common import OperationError, _now_iso, _user, audit, records
from app.engine.dispatch import status_at

MAX_ACTIVE_PER_SHIPMENT = 5


def create(code: str, user: str | None) -> dict:
    if run_query("SELECT 1 FROM mm_shipments WHERE shipment_code = ?", (code,)).empty:
        raise LookupError(code)
    active = run_query("SELECT COUNT(*) AS n FROM mm_tracking_links WHERE shipment_code = ? AND revoked_at IS NULL", (code,))
    if int(active.iloc[0]["n"]) >= MAX_ACTIVE_PER_SHIPMENT:
        raise OperationError(f"Este envío ya tiene {MAX_ACTIVE_PER_SHIPMENT} enlaces activos: revoca alguno primero.")
    token = secrets.token_urlsafe(18)
    run_write("INSERT INTO mm_tracking_links (token, shipment_code, created_at, created_by) VALUES (?,?,?,?)",
              (token, code, _now_iso(), _user(user)))
    audit(user, "EXPORT", "mm_tracking_links", code, f"Enlace de seguimiento creado ({token[:6]}…)")
    return {"token": token, "path": f"/seguimiento/{token}", "shipment_code": code}


def links(code: str) -> list:
    return records(run_query(
        "SELECT token, created_at, created_by FROM mm_tracking_links WHERE shipment_code = ? AND revoked_at IS NULL "
        "ORDER BY created_at DESC", (code,)))


def revoke(code: str, token: str, user: str | None) -> None:
    rows = run_query("SELECT 1 FROM mm_tracking_links WHERE token = ? AND shipment_code = ? AND revoked_at IS NULL", (token, code))
    if rows.empty:
        raise LookupError(token)
    run_write("UPDATE mm_tracking_links SET revoked_at = ? WHERE token = ?", (_now_iso(), token))
    audit(user, "REVOKE", "mm_tracking_links", code, f"Enlace de seguimiento revocado ({token[:6]}…)")


def public_view(token: str, now: datetime) -> dict:
    """Lo que ve el cliente. LookupError si el enlace no existe o está revocado."""
    link = run_query("SELECT shipment_code FROM mm_tracking_links WHERE token = ? AND revoked_at IS NULL", (token,))
    if link.empty:
        raise LookupError(token)
    code = link.iloc[0]["shipment_code"]
    rows = run_query("SELECT * FROM mm_shipments WHERE shipment_code = ?", (code,))
    if rows.empty:  # el envío se borró: el enlace deja de servir
        raise LookupError(token)
    s = rows.to_dict(orient="records")[0]
    route = json.loads(s["route_json"])
    state = status_at(s, now, route)
    eta = datetime.fromisoformat(s["eta_at"])
    legs = [{"mode": l["mode"], "mode_label": F.MODE_LABELS[l["mode"]], "from": l["from"]["name"], "to": l["to"]["name"],
             "start_h": round(l["start_h"], 2), "end_h": round(l["end_h"], 2)} for l in route.get("legs", [])]
    return {
        "code": code, "origin": s["origin_city"], "destination": s["dest_city"], "cargo": s["cargo"],
        "status": s["status"], "progress_pct": F.pct(state["progress"] * 100),
        "departure_at": s["departure_at"], "eta_at": s["eta_at"], "eta_fmt": eta.strftime("%d/%m/%Y %H:%M"),
        "delay_h": F.hours(s["delay_h"]), "delay_fmt": F.duration_fmt(s["delay_h"]) if s["delay_h"] else None,
        "route_h": round(state["route_h"], 2), "legs": legs,
        "modes": [F.MODE_LABELS[m] for m in (s["modes"].split(",") if s["modes"] else [])],
        "updated_at": now.isoformat(timespec="seconds"),
    }
