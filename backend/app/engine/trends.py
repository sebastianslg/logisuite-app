"""
trends.py
Tendencias de la operación para el resumen: cómo estaban las cifras principales al cierre de
cada uno de los últimos 14 días y cuánto cambiaron frente a la semana anterior.

No hay fotos guardadas del pasado: el estado de cada envío en un instante se reconstruye con
`status_at` (la misma función que decide el estado ahora), a partir de su salida, su duración y
su retraso actual. Si a un envío se le sumó retraso después, el pasado se ve con ese retraso:
es una reconstrucción con los datos de hoy, no un registro histórico.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta

from app.api import format as F
from app.engine.dispatch import status_at

ACTIVE = ("En Ruta", "Transferencia Modal", "Retrasado")


def _change(cur: float, prev: float) -> float | None:
    if not prev:
        return None
    return F.pct(100 * (cur - prev) / prev)


def trends(rows: list, now: datetime, days: int = 14) -> dict:
    routes = {}
    for r in rows:
        try:
            routes[r["shipment_code"]] = json.loads(r["route_json"])
        except (TypeError, ValueError):
            routes[r["shipment_code"]] = {"transfers": []}

    series = []
    for d in range(days - 1, -1, -1):
        day = (now - timedelta(days=d)).date()
        # Cierre del día; para hoy, el instante actual
        at = now if d == 0 else datetime.combine(day, datetime.max.time()).replace(microsecond=0)
        in_transit = delayed = 0
        cost = 0.0
        dispatched = 0
        tons = 0.0
        for r in rows:
            dep = datetime.fromisoformat(r["departure_at"])
            if dep.date() == day:
                dispatched += 1
                tons += float(r["weight_t"])
            if dep > at:
                continue
            st = status_at(r, at, routes[r["shipment_code"]])["status"]
            if st in ACTIVE:
                in_transit += 1
                cost += float(r["total_cost"] or 0)
                if st == "Retrasado":
                    delayed += 1
        series.append({"date": day.isoformat(), "in_transit": in_transit, "delayed": delayed,
                       "cost_in_transit": F.money(cost), "dispatched": dispatched, "tons": F.tons(tons)})

    week, prev = series[-7:], series[-14:-7]
    avg = lambda s, k: sum(x[k] for x in s) / len(s) if s else 0.0  # noqa: E731
    total = lambda s, k: sum(x[k] for x in s)  # noqa: E731
    return {
        "series": series,
        "week_vs_prev": {
            # Promedio diario de lo que estuvo en ruta; suma de lo despachado
            "in_transit": _change(avg(week, "in_transit"), avg(prev, "in_transit")),
            "delayed": _change(avg(week, "delayed"), avg(prev, "delayed")),
            "cost_in_transit": _change(avg(week, "cost_in_transit"), avg(prev, "cost_in_transit")),
            "dispatched": _change(total(week, "dispatched"), total(prev, "dispatched")),
            "tons": _change(total(week, "tons"), total(prev, "tons")),
        },
        "note": "Reconstruido con los datos actuales de cada envío (salida, duración y retraso).",
    }
