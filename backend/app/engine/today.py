"""
today.py
Tablero «Hoy» del despachador: lo que pide atención en las próximas 24 horas, en una sola lectura.

- Salidas: envíos programados que salen en las próximas 24 h, con el vehículo del primer tramo.
- Llegadas: envíos en ruta cuya llegada (con su retraso) cae en las próximas 24 h.
- Por firmar: envíos que llegaron en los últimos 7 días y aún no tienen prueba de entrega.
- Incidencias: las registradas en las últimas 24 h.
- Flota: SOAT o técnico-mecánica vencidos o que vencen en 7 días.
- Cumplimiento: entregas a tiempo de los últimos 30 días, en total y por modo (los clientes van en el reporte).

Las horas van como «en cuántas horas» (`in_h`) además de la fecha: la pantalla no recalcula nada con el reloj del
navegador, así el texto del servidor y el del navegador coinciden.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta

from app.api import format as F
from app.database.db import fetch_all
from app.engine import fleet, journal, otif
from app.engine.dispatch import status_at

WINDOW_H = 24
SIGN_DAYS = 7
DOC_DAYS = 7


def _arrival(s: dict) -> datetime:
    return datetime.fromisoformat(s["departure_at"]) + timedelta(hours=float(s["total_time_h"] or 0) + float(s["delay_h"] or 0))


def _brief(s: dict, at: datetime, now: datetime) -> dict:
    legs = json.loads(s["route_json"]).get("legs", [])
    asset = (legs[0].get("asset") or {}) if legs else {}
    return {"code": s["shipment_code"], "origin": s["origin_city"], "destination": s["dest_city"], "cargo": s["cargo"],
            "client": s["client"], "modes": s["modes"].split(",") if s["modes"] else [], "at": at.isoformat(timespec="minutes"),
            "in_h": round((at - now).total_seconds() / 3600, 1), "delay_h": float(s["delay_h"] or 0),
            "vehicle": asset.get("id"), "outsourced": bool(asset.get("outsourced")),
            "no_route": s.get("route_status") == "sin_ruta"}


def board(now: datetime) -> dict:
    horizon = now + timedelta(hours=WINDOW_H)
    since = now - timedelta(days=SIGN_DAYS)
    signed = {r["shipment_code"] for r in fetch_all("SELECT shipment_code FROM mm_deliveries")}
    ships = fetch_all("SELECT * FROM mm_shipments WHERE departure_at <= ?", (horizon.isoformat(timespec="minutes"),))
    departures, arrivals, to_sign = [], [], []
    estados = {}
    for s in ships:
        dep = datetime.fromisoformat(s["departure_at"])
        state = status_at(s, now)["status"]
        estados[s["shipment_code"]] = state
        arr = _arrival(s)
        if state == "Programado" and now <= dep <= horizon:
            departures.append(_brief(s, dep, now))
        elif state != "Programado" and state != "Entregado" and now <= arr <= horizon:
            arrivals.append(_brief(s, arr, now))
        elif state == "Entregado" and since <= arr <= now and s["shipment_code"] not in signed:
            to_sign.append(_brief(s, arr, now))
    departures.sort(key=lambda x: x["at"])
    arrivals.sort(key=lambda x: x["at"])
    to_sign.sort(key=lambda x: x["at"], reverse=True)
    incidents = [{"code": e["shipment_code"], "kind_label": e["kind_label"], "body": e["body"], "delay_h": e["delay_h"],
                  "at": e["created_at"], "resolved": bool(e.get("resolved_at")), "origin": e.get("origin_city"),
                  "destination": e.get("dest_city")} for e in journal.recent_incidents(days=1, limit=20)]
    docs = [d for d in fleet.summary(now)["documents_due"] if d["days_left"] <= DOC_DAYS]
    # Cumplimiento: la misma definición y el mismo umbral que el tablero (entregado con delay_h en cero), con el
    # estado derivado que ya se calculó arriba —el mismo que usa «Por firmar»—, no el guardado, que se queda atrás
    # entre sincronizaciones y haría que esta pantalla se contradijera. Se arma con la lectura de envíos que ya se
    # hizo, así que no paga una consulta pesada más.
    total = otif.summarize(otif.delivered_in_window(ships, now, otif.WINDOW_DAYS, estados))
    cumplimiento = {
        "window_days": otif.WINDOW_DAYS, "entregas": total["entregas"], "a_tiempo": total["a_tiempo"],
        "pct": total["pct"],
        "pct_fmt": F.pct_fmt(total["pct"]) if total["pct"] is not None else "N/D",
        # Los clientes quedan en el reporte; aquí bastan el total y el modo para la pantalla del día
        "by_mode": total["by_mode"],
        "note": "Entregas a tiempo: envío entregado sin retraso registrado. "
                "No mide cantidad entregada frente a la pedida.",
    }
    return {
        "now": now.isoformat(timespec="minutes"), "window_h": WINDOW_H,
        "departures": departures, "arrivals": arrivals, "to_sign": to_sign[:30], "incidents": incidents, "fleet_documents": docs,
        "cumplimiento": cumplimiento,
        "counts": {"departures": len(departures), "arrivals": len(arrivals), "to_sign": len(to_sign),
                   "incidents": len(incidents), "fleet_documents": len(docs),
                   "late_arrivals": sum(1 for a in arrivals if a["delay_h"] > 0)},
    }
