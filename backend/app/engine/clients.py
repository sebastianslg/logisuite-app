"""
clients.py
Resumen por cliente: cuántos envíos tiene, cuántos van en ruta, cuánto ha movido y pagado en flete,
qué tan puntuales han sido sus entregas, por qué modos y en qué rutas. Se agrega desde mm_shipments
(el cliente es el texto del envío, así que dos grafías distintas cuentan como dos clientes).
"""
from __future__ import annotations

from datetime import datetime

from app.api import format as F
from app.engine.dispatch import status_at

ACTIVE = ("En Ruta", "Transferencia Modal", "Retrasado")


def summary(rows: list, now: datetime) -> list:
    clients: dict[str, dict] = {}
    for r in rows:
        name = (r.get("client") or "").strip() or "Sin cliente"
        c = clients.setdefault(name, {
            "client": name, "shipments": 0, "active": 0, "delayed": 0, "scheduled": 0, "delivered": 0,
            "on_time": 0, "tons": 0.0, "cost": 0.0, "modes": {}, "routes": {}, "last_departure": None,
            "codes": [], "actual": 0.0, "actual_est": 0.0, "actual_n": 0,
        })
        st = status_at(r, now)["status"]
        c["shipments"] += 1
        c["tons"] += float(r["weight_t"])
        c["cost"] += float(r["total_cost"] or 0)
        if st in ACTIVE:
            c["active"] += 1
            c["delayed"] += st == "Retrasado"
        elif st == "Programado":
            c["scheduled"] += 1
        else:
            c["delivered"] += 1
            c["on_time"] += 0 if r["delay_h"] else 1
        for m in str(r.get("modes") or "").split(","):
            if m:
                c["modes"][m] = c["modes"].get(m, 0) + 1
        key = f"{r['origin_city']} → {r['dest_city']}"
        c["routes"][key] = c["routes"].get(key, 0) + 1
        if not c["last_departure"] or r["departure_at"] > c["last_departure"]:
            c["last_departure"] = r["departure_at"]
        c["codes"].append((r["departure_at"], r["shipment_code"]))
        actual = r.get("actual_cost")
        if actual is not None and actual == actual:  # registrado y no NaN
            c["actual"] += float(actual)
            c["actual_est"] += float(r["total_cost"] or 0)
            c["actual_n"] += 1

    out = []
    for c in clients.values():
        recent = [code for _, code in sorted(c["codes"], reverse=True)[:8]]
        out.append({
            "client": c["client"], "shipments": c["shipments"], "active": c["active"], "delayed": c["delayed"],
            "scheduled": c["scheduled"], "delivered": c["delivered"],
            "on_time_pct": F.pct(100 * c["on_time"] / c["delivered"]) if c["delivered"] else None,
            "tons": F.tons(c["tons"]), "tons_fmt": F.tons_fmt(c["tons"]),
            "cost": F.money(c["cost"]),
            "avg_cost_per_t": F.money(c["cost"] / c["tons"]) if c["tons"] else 0,
            "modes": [{"mode": m, "label": F.MODE_LABELS.get(m, m), "count": n}
                      for m, n in sorted(c["modes"].items(), key=lambda kv: -kv[1])],
            "top_routes": [{"route": k, "count": n} for k, n in sorted(c["routes"].items(), key=lambda kv: -kv[1])[:4]],
            "last_departure": c["last_departure"],
            "recent": recent,
            # Costo real contra estimado, solo sobre los envíos con costo real registrado
            "actual": {"shipments": c["actual_n"], "amount": F.money(c["actual"]), "estimated": F.money(c["actual_est"]),
                       "variance_pct": F.pct(100 * (c["actual"] - c["actual_est"]) / c["actual_est"])}
            if c["actual_n"] and c["actual_est"] else None,
        })
    return sorted(out, key=lambda c: -c["cost"])

