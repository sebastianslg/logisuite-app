"""
report.py
Reporte operativo en PDF de un período (por defecto, la última semana): lo que se despachó, cómo se
movió por modo, los corredores y ciudades con más carga, la huella, las incidencias registradas, los
cierres vigentes y los envíos retrasados. Con la comparación frente al período anterior del mismo largo.

Reutiliza los estilos del PDF de envíos (`pdf.py`) para que los documentos se vean de la misma familia.
"""
from __future__ import annotations

import io
import json
from datetime import datetime, timedelta

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from app.api import format as F
from app.database.db import run_query
from app.engine import history as H, journal, sustainability as SU
from app.engine.dispatch import status_at
from app.engine.pdf import Money, _footer, _styles, _table


def _delta(pct) -> str:
    if pct is None:
        return "sin dato anterior"
    sign = "+" if pct > 0 else ""
    return f"{sign}{F.number(pct, 1)} % frente al período anterior"


def render(net, days: int, currency: str, fx: dict, now: datetime) -> bytes:
    money = Money(currency, fx)
    st = _styles()
    since = now - timedelta(days=days)
    hist = H.history(now, days)
    t, prev = hist["totals"], hist["previous"]

    rows = run_query("SELECT * FROM mm_shipments").to_dict(orient="records")
    in_window = [r for r in rows if since <= datetime.fromisoformat(r["departure_at"]) <= now
                 and r["status"] != "Programado"]
    states = {r["shipment_code"]: status_at(r, now)["status"] for r in rows}
    delivered = [r for r in in_window if states[r["shipment_code"]] == "Entregado"]
    on_time = sum(1 for r in delivered if not r["delay_h"])
    active = [r for r in rows if states[r["shipment_code"]] in ("En Ruta", "Transferencia Modal", "Retrasado")]
    delayed = sorted((r for r in rows if states[r["shipment_code"]] == "Retrasado"), key=lambda r: -float(r["delay_h"] or 0))

    by_mode = {m: {"tkm": 0.0, "co2e_kg": 0.0, "fuel_l": 0.0} for m in SU.MODE_ORDER}
    for r in in_window:
        e = SU.shipment_emissions(json.loads(r["route_json"]), r["weight_t"])
        for m, v in e["by_mode"].items():
            for k, x in v.items():
                by_mode[m][k] += x
    tkm = sum(v["tkm"] for v in by_mode.values()) or 1.0
    co2 = sum(v["co2e_kg"] for v in by_mode.values())

    buf = io.BytesIO()
    title = f"Reporte operativo · {since:%d/%m/%Y} a {now:%d/%m/%Y}"
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=13 * mm, rightMargin=13 * mm,
                            topMargin=14 * mm, bottomMargin=16 * mm, title=title, author="Westvane TMS")
    story: list = [
        Paragraph(title, st["title"]),
        Paragraph(f"Últimos {days} días. Generado el {now:%d/%m/%Y %H:%M}. {money.note()}", st["muted"]),
        Spacer(1, 6),
        Paragraph("Resumen", st["h2"]),
        _table([
            ["Indicador", "Valor", "Comparación"],
            ["Envíos despachados", F.number(t["shipments"]), _delta(prev["change_pct"]["shipments"])],
            ["Toneladas movidas", t["tons_fmt"], _delta(prev["change_pct"]["tons"])],
            ["Flete", money(t["cost"]), _delta(prev["change_pct"]["cost"])],
            ["Entregados en el período", F.number(len(delivered)),
             f"{F.pct_fmt(100 * on_time / len(delivered))} a tiempo" if delivered else "—"],
            ["En ruta ahora", F.number(len(active)), f"{len(delayed)} con retraso"],
            ["CO<sub>2</sub>e estimado", F.tons_fmt(co2 / 1000) + " CO<sub>2</sub>e", f"{F.number(1000 * co2 / tkm, 1)} g por t-km"],
        ], [w * mm for w in (60, 50, 74)], st),
        Paragraph("Reparto por modo", st["h2"]),
        _table([["Modo", "t-km", "Participación", "CO<sub>2</sub>e", "Combustible"]] + [
            [F.MODE_LABELS[m], F.number(v["tkm"]), F.pct_fmt(100 * v["tkm"] / tkm),
             F.tons_fmt(v["co2e_kg"] / 1000), F.number(v["fuel_l"]) + " L"]
            for m, v in by_mode.items() if v["tkm"] > 0
        ], [w * mm for w in (40, 40, 34, 34, 36)], st),
        Paragraph("Corredores con más carga", st["h2"]),
        _table([["Corredor", "Modo", "Envíos", "Toneladas", "Flete", "Peajes"]] + [
            [c["corridor"], F.MODE_LABELS[c["mode"]], F.number(c["shipments"]), c["tons_fmt"],
             money(c["cost"]), money(c["tolls"]) if c["tolls"] else "—"]
            for c in hist["by_corridor"][:10]
        ] if hist["by_corridor"] else [["Sin movimientos en el período"]],
            [w * mm for w in (62, 24, 18, 26, 28, 26)] if hist["by_corridor"] else [184 * mm], st),
        Paragraph("Ciudades", st["h2"]),
        _table([["Ciudad", "Departamento", "Salen", "Llegan", "Toneladas", "Flete de lo que sale"]] + [
            [c["city"], c["department"] or "—", F.number(c["out"]), F.number(c["in"]), c["tons_fmt"], money(c["cost_out"])]
            for c in hist["by_city"][:10]
        ] if hist["by_city"] else [["Sin movimientos en el período"]],
            [w * mm for w in (40, 40, 18, 18, 30, 38)] if hist["by_city"] else [184 * mm], st),
    ]

    incidents = [e for e in journal.recent_incidents(days, 200)]
    story.append(Paragraph("Incidencias registradas", st["h2"]))
    if incidents:
        story.append(_table([["Fecha", "Envío", "Tipo", "Detalle", "Retraso", "Estado"]] + [
            [datetime.fromisoformat(e["created_at"]).strftime("%d/%m %H:%M"), e["shipment_code"], e["kind_label"],
             e["body"][:160], f"{F.number(e['delay_h'], 1)} h" if e["delay_h"] else "—",
             "Resuelta" if e["resolved_at"] else "Abierta"]
            for e in incidents[:40]
        ], [w * mm for w in (20, 26, 26, 72, 18, 22)], st))
    else:
        story.append(Paragraph("No se registraron incidencias en el período.", st["body"]))

    closed = sorted(net.closed_corridors)
    nodes = sorted(net.closed_nodes.items())
    story.append(Paragraph("Cierres vigentes", st["h2"]))
    if closed or nodes:
        story.append(_table([["Tipo", "Nombre", "Motivo"]]
                            + [["Vía", c, "—"] for c in closed]
                            + [["Nodo", net.nodes[c]["name"], r or "—"] for c, r in nodes],
                            [w * mm for w in (20, 80, 84)], st))
    else:
        story.append(Paragraph("No hay vías ni nodos cerrados.", st["body"]))

    story.append(Paragraph("Envíos retrasados ahora", st["h2"]))
    if delayed:
        story.append(_table([["Envío", "Ruta", "Cliente", "Retraso", "ETA"]] + [
            [r["shipment_code"], f"{r['origin_city']} a {r['dest_city']}", r["client"],
             F.duration_fmt(float(r["delay_h"] or 0)), datetime.fromisoformat(r["eta_at"]).strftime("%d/%m %H:%M")]
            for r in delayed[:30]
        ], [w * mm for w in (28, 60, 46, 24, 26)], st))
    else:
        story.append(Paragraph("Ningún envío en ruta tiene retraso.", st["body"]))

    story += [Spacer(1, 8), Paragraph(
        "Huella estimada con factores de intensidad por modo (pozo a rueda); no es un inventario certificado. "
        "Datos de operación simulados.", st["muted"])]
    stamp = f"{now:%d/%m/%Y %H:%M}"
    doc.build(story, onFirstPage=_footer(stamp), onLaterPages=_footer(stamp))
    return buf.getvalue()
