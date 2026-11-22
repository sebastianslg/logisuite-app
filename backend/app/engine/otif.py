"""
otif.py
Cumplimiento de las entregas por modo y por cliente («a tiempo y completo»).

El «in full» de OTIF no se puede medir: la plataforma no guarda cuántas unidades se pidieron frente a cuántas se
entregaron, y no se inventa. Lo que sí se mide —y es exactamente lo que muestra el resumen del tablero como
OTIF— es la entrega a tiempo: un envío entregado con `delay_h` en cero. Aquí se reutiliza esa definición, para
que la cifra de «Hoy» y la del reporte midan lo mismo; donde se muestra se rotula «entregas a tiempo», no «OTIF».
Ojo con la ventana: este módulo solo mira los últimos `WINDOW_DAYS` días por fecha de entrega, mientras el tablero
cuenta toda la base de entregados sin filtrar, aunque su tarjeta diga «OTIF 30 días».

El modo del envío es el del tramo más largo de su ruta (el que domina la distancia), no el primero de `modes`:
un envío que solo baja al puerto por carretera no se cuenta como terrestre. El cliente es el texto del envío,
igual que en el resumen por cliente (`clients.summary`): dos grafías distintas son dos clientes.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta

from app.api import format as F
from app.engine.dispatch import status_at

# La ventana de este módulo: 30 días contados por fecha de entrega real. El tablero rotula «OTIF 30 días» pero
# hoy cuenta toda la base de entregados, sin ventana: las dos cifras solo coinciden si nada queda fuera de 30 días.
WINDOW_DAYS = 30
MAX_CLIENTS = 10
OTHERS = "Otros"


def delivered_at(row: dict) -> datetime:
    """Cuándo llegó de verdad: la salida más la duración de la ruta más el retraso (no hay columna de entrega)."""
    return datetime.fromisoformat(row["departure_at"]) + timedelta(
        hours=float(row["total_time_h"] or 0) + float(row["delay_h"] or 0))


def on_time(row: dict) -> bool:
    """A tiempo = sin retraso registrado: el mismo `delay_h = 0` que cuenta el resumen del tablero."""
    return float(row.get("delay_h") or 0) == 0


def main_mode(row: dict) -> str:
    """Modo del tramo más largo de la ruta; si no trae tramos, el primero de `modes`."""
    legs = []
    try:
        legs = json.loads(row["route_json"]).get("legs") or []
    except (KeyError, TypeError, ValueError):
        pass
    if legs:
        return max(legs, key=lambda leg: float(leg.get("distance_km") or 0))["mode"]
    return (row.get("modes") or "").split(",")[0] or "desconocido"


def delivered_in_window(rows: list, now: datetime, days: int = WINDOW_DAYS, states: dict | None = None) -> list:
    """Los entregados cuya entrega real cae en los últimos `days` días; el borde inferior cuenta.

    El estado se deriva con `status_at` —lo mismo que hace la pantalla del día— y no se lee el guardado: entre
    sincronizaciones la columna se queda atrás y la misma pantalla se contradiría. `states` permite pasar los
    estados ya calculados (código a estado) para no derivarlos dos veces; si falta uno, se deriva aquí.
    """
    since = now - timedelta(days=days)
    out = []
    for r in rows:
        estado = (states or {}).get(r["shipment_code"])
        if estado is None:
            estado = status_at(r, now)["status"]
        if estado == "Entregado" and since <= delivered_at(r) <= now:
            out.append(r)
    return out


def _count(rows: list) -> dict:
    return {"entregas": len(rows), "a_tiempo": sum(1 for r in rows if on_time(r))}


def _pct(on_time_n: int, total: int) -> float | None:
    """Porcentaje a un decimal, como el tablero; sin entregas no es 0 %: no hay dato (None)."""
    return F.pct(100 * on_time_n / total) if total else None


def summarize(delivered: list) -> dict:
    """Total, por modo y por cliente de una lista de envíos ya entregados.

    `pct` es None cuando no hay entregas (no 0: no hay nada que cumplir). Los modos van de más a menos entregas
    (y por nombre para que el orden no cambie entre llamadas); los clientes también, con los primeros
    `MAX_CLIENTS` y el resto sumado en «Otros» para que la tabla del reporte no crezca sin fin.
    """
    modes: dict = {}
    for r in delivered:
        modes.setdefault(main_mode(r), []).append(r)
    by_mode = []
    for mode, items in modes.items():
        c = _count(items)
        by_mode.append({"mode": mode, "label": F.MODE_LABELS.get(mode, mode),
                        "entregas": c["entregas"], "a_tiempo": c["a_tiempo"],
                        "pct": _pct(c["a_tiempo"], c["entregas"])})
    by_mode.sort(key=lambda x: (-x["entregas"], x["label"]))

    clients: dict = {}
    for r in delivered:
        clients.setdefault((r.get("client") or "").strip() or "Sin cliente", []).append(r)
    rows = []
    for name, items in clients.items():
        c = _count(items)
        rows.append({"client": name, "entregas": c["entregas"], "a_tiempo": c["a_tiempo"],
                     "pct": _pct(c["a_tiempo"], c["entregas"])})
    rows.sort(key=lambda x: (-x["entregas"], x["client"]))

    by_client = rows[:MAX_CLIENTS]
    if len(rows) > MAX_CLIENTS:
        # El resto se suma antes de calcular el porcentaje: no es el promedio de los porcentajes
        rest = rows[MAX_CLIENTS:]
        n = sum(x["entregas"] for x in rest)
        k = sum(x["a_tiempo"] for x in rest)
        by_client.append({"client": OTHERS, "entregas": n, "a_tiempo": k, "pct": _pct(k, n)})

    total = _count(delivered)
    return {"entregas": total["entregas"], "a_tiempo": total["a_tiempo"],
            "pct": _pct(total["a_tiempo"], total["entregas"]),
            "by_mode": by_mode, "by_client": by_client}
