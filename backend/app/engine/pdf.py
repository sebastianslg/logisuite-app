"""
pdf.py
Reportes PDF de envíos (reportlab): uno por envío o un consolidado.

Cada envío incluye resumen, tramos, transbordos, costos, documentos requeridos
y estado. Los montos van en USD o en COP con la TRM configurada (se imprime
la tasa, su fecha y su fuente). Los documentos son los que normalmente exige
cada modo; el sistema no los emite ni verifica.

La fuente estándar Helvetica usa la codificación WinAnsi: admite tildes y
eñes, pero no flechas, así que los textos usan "a" o "->".
"""
from __future__ import annotations

import io
import json
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer,
                                Table, TableStyle)

from app.api import format as F
from app.engine.dispatch import status_at

DOCS_BY_MODE = {
    "terrestre": ["Manifiesto electrónico de carga (RNDC)", "Remesa terrestre de carga"],
    "fluvial": ["Manifiesto de carga fluvial", "Conocimiento de embarque fluvial"],
    "maritimo": ["Conocimiento de embarque (B/L)", "Manifiesto de carga marítimo"],
    "aereo": ["Guía aérea (AWB)", "Manifiesto de carga aérea"],
    "ferreo": ["Carta de porte ferroviaria"],
}
DOCS_ALWAYS = ["Factura comercial o remisión", "Lista de empaque", "Póliza de seguro de la mercancía"]

INK = colors.HexColor("#0f172a")
MUTED = colors.HexColor("#64748b")
LINE = colors.HexColor("#cbd5e1")
HEAD = colors.HexColor("#e2e8f0")
ALERT = colors.HexColor("#b91c1c")


def _styles():
    ss = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("t", parent=ss["Title"], fontSize=16, leading=20, alignment=0,
                                textColor=INK, spaceAfter=2),
        "h2": ParagraphStyle("h2", parent=ss["Heading2"], fontSize=11.5, leading=14, textColor=INK,
                             spaceBefore=8, spaceAfter=4),
        "body": ParagraphStyle("b", parent=ss["BodyText"], fontSize=8.5, leading=11, textColor=INK),
        "muted": ParagraphStyle("m", parent=ss["BodyText"], fontSize=7.5, leading=10, textColor=MUTED),
        "alert": ParagraphStyle("a", parent=ss["BodyText"], fontSize=8.5, leading=11, textColor=ALERT),
        "cell": ParagraphStyle("c", parent=ss["BodyText"], fontSize=7.5, leading=9.5, textColor=INK),
    }


class Money:
    def __init__(self, currency: str, fx: dict):
        self.currency = currency
        self.fx = fx
        if currency == "COP" and not fx.get("rate"):
            raise ValueError("No hay TRM configurada: ingrésala en Configuración para exportar en COP.")

    def __call__(self, usd: float) -> str:
        if self.currency == "COP":
            return f"COP {F.number(usd * self.fx['rate'])}"
        return F.money_fmt(usd)

    def note(self) -> str:
        if self.currency == "COP":
            return (f"Montos en pesos colombianos. TRM {F.number(self.fx['rate'], 2)} COP/USD, "
                    f"vigente al {self.fx['date']}, fuente: {self.fx['source']}. "
                    "Los costos se calculan en USD y se convierten con esta tasa.")
        return "Montos en dólares estadounidenses (USD), moneda base del sistema."


def _table(rows, widths, st, header=True, zebra=True):
    data = [[Paragraph(str(c), st["cell"]) for c in r] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [("GRID", (0, 0), (-1, -1), 0.4, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
             ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), HEAD))
    t.setStyle(TableStyle(style))
    return t


def _kv(pairs, st):
    rows = [[Paragraph(f"<b>{k}</b>", st["cell"]), Paragraph(str(v), st["cell"])] for k, v in pairs]
    t = Table(rows, colWidths=[38 * mm, 52 * mm])
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, LINE), ("BACKGROUND", (0, 0), (0, -1), HEAD),
                           ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5)]))
    return t


def _dt(iso: str) -> str:
    return datetime.fromisoformat(iso).strftime("%d/%m/%Y %H:%M")


def shipment_story(s: dict, money: Money, now: datetime, st: dict) -> list:
    route = json.loads(s["route_json"])
    state = status_at(s, now, route)
    legs, transfers = route["legs"], route["transfers"]
    status = state["status"]
    out = [Paragraph(f"Envío {s['shipment_code']}", st["title"]),
           Paragraph(f"{s['origin_city']} a {s['dest_city']} · {s['cargo']} · Estado: <b>{status}</b> "
                     f"· Avance {F.pct_fmt(state['progress'] * 100)}", st["body"])]
    if (s.get("route_status") or "ok") == "sin_ruta":
        out.append(Paragraph(f"SIN RUTA DISPONIBLE. {s.get('route_note') or ''}", st["alert"]))
    elif s.get("route_note"):
        out.append(Paragraph(f"Nota de ruta: {s['route_note']}", st["body"]))
    out.append(Spacer(1, 4))

    left = [("Cliente", s["client"]), ("Carga", s["cargo"]), ("Peso", F.tons_fmt(s["weight_t"])),
            ("Prioridad", s["priority"].capitalize()),
            ("Origen del registro", {"seed": "Carga inicial", "auto": "Reposición automática",
                                     "manual": "Creado por usuario"}.get(s.get("source") or "seed")),
            ("Modos forzados", s.get("forced_modes") or "Ninguno"),
            ("Vías forzadas", s.get("forced_corridors") or "Ninguna")]
    right = [("Salida", _dt(s["departure_at"])), ("ETA planeado", _dt(s["eta_at"])),
             ("Retraso", F.duration_fmt(s["delay_h"]) if s["delay_h"] else "Sin retraso"),
             ("Distancia", F.km_fmt(s["distance_km"])), ("Tiempo de ruta", F.duration_fmt(s["total_time_h"])),
             ("Transbordos", str(s["n_transfers"])), ("Costo total", money(s["total_cost"]))]
    grid = Table([[_kv(left, st), _kv(right, st)]], colWidths=[92 * mm, 92 * mm])
    grid.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    out.append(grid)

    out.append(Paragraph("Tramos", st["h2"]))
    rows = [["#", "Modo", "Desde", "Hasta", "Vías", "Distancia", "Tiempo", "Costo", "Vehículo"]]
    for i, l in enumerate(legs, 1):
        a = l.get("asset") or {}
        flag = " (interrumpido)" if l.get("interrupted") else (" (retorno)" if l.get("detour") else "")
        rows.append([i, F.MODE_LABELS[l["mode"]] + flag, l["from"]["name"], l["to"]["name"],
                     ", ".join(l["corridors"]), F.km_fmt(l["distance_km"]), F.duration_fmt(l["time_h"]),
                     money(l["cost"]), f"{a.get('type', '-')} {a.get('id', '')}".strip()])
    out.append(_table(rows, [6 * mm, 18 * mm, 26 * mm, 26 * mm, 32 * mm, 16 * mm, 15 * mm, 20 * mm, 25 * mm], st))

    out.append(Paragraph("Transbordos", st["h2"]))
    if transfers:
        rows = [["Nodo", "Cambio", "Tiempo", "Costo"]]
        for t in transfers:
            rows.append([t["node"]["name"], f"{F.MODE_LABELS[t['from_mode']]} -> {F.MODE_LABELS[t['to_mode']]}",
                         F.duration_fmt(t["time_h"]), money(t["cost"])])
        out.append(_table(rows, [70 * mm, 50 * mm, 30 * mm, 34 * mm], st))
    else:
        out.append(Paragraph("Ruta sin transbordos.", st["body"]))

    legs_cost = sum(l["cost"] for l in legs)
    tr_cost = sum(t["cost"] for t in transfers)
    out.append(KeepTogether([
        Paragraph("Costos", st["h2"]),
        _table([["Concepto", "Monto"], ["Fletes por tramo", money(legs_cost)],
                ["Manipulación en transbordos", money(tr_cost)],
                ["Total", money(legs_cost + tr_cost)],
                ["Costo por tonelada", money((legs_cost + tr_cost) / s["weight_t"])]],
               [120 * mm, 64 * mm], st),
        Paragraph(money.note(), st["muted"]),
    ]))

    modes = list(dict.fromkeys(l["mode"] for l in legs))
    docs = DOCS_ALWAYS + [d for m in modes for d in DOCS_BY_MODE[m]]
    out.append(KeepTogether([
        Paragraph("Documentos requeridos", st["h2"]),
        _table([["Documento", "Aplica a"]] + [[d, "Todo el envío" if d in DOCS_ALWAYS else
                                              ", ".join(F.MODE_LABELS[m] for m in modes if d in DOCS_BY_MODE[m])]
                                             for d in docs], [120 * mm, 64 * mm], st),
        Paragraph("Lista de referencia según los modos de la ruta. LogiSuite no emite ni valida estos "
                  "documentos.", st["muted"]),
    ]))
    if s.get("created_by") or s.get("updated_by"):
        out.append(Spacer(1, 6))
        who = []
        if s.get("created_by"):
            who.append(f"Creado por {s['created_by']}")
        if s.get("updated_by"):
            who.append(f"última edición por {s['updated_by']} el {_dt(s['updated_at'])}")
        text = " · ".join(who)
        out.append(Paragraph(text[0].upper() + text[1:] + " (nombre declarado, sin autenticación).", st["muted"]))
    return out


def _footer(generated: str):
    def draw(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(MUTED)
        canvas.drawString(15 * mm, 10 * mm, f"LogiSuite TMS · generado {generated} · datos simulados")
        canvas.drawRightString(195 * mm, 10 * mm, f"Página {doc.page}")
        canvas.restoreState()
    return draw


def render(shipments: list, currency: str, fx: dict, now: datetime) -> bytes:
    """PDF de uno o varios envíos. Con más de uno, agrega una portada resumen."""
    money = Money(currency, fx)
    st = _styles()
    buf = io.BytesIO()
    title = (f"Envío {shipments[0]['shipment_code']}" if len(shipments) == 1
             else f"Consolidado de {len(shipments)} envíos")
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=13 * mm, rightMargin=13 * mm,
                            topMargin=14 * mm, bottomMargin=16 * mm, title=title, author="LogiSuite TMS")
    story: list = []
    if len(shipments) > 1:
        story += [Paragraph(title, st["title"]),
                  Paragraph(f"Generado el {now:%d/%m/%Y %H:%M}. {money.note()}", st["muted"]),
                  Spacer(1, 6)]
        rows = [["Envío", "Ruta", "Carga", "Peso", "Estado", "Modos", "ETA", "Costo"]]
        total_cost, total_t = 0.0, 0.0
        for s in shipments:
            state = status_at(s, now)["status"]
            if (s.get("route_status") or "ok") == "sin_ruta":
                state += " (sin ruta)"
            rows.append([s["shipment_code"], f"{s['origin_city']} a {s['dest_city']}", s["cargo"],
                         F.tons_fmt(s["weight_t"]), state,
                         ", ".join(F.MODE_LABELS[m] for m in s["modes"].split(",") if m),
                         _dt(s["eta_at"]), money(s["total_cost"])])
            total_cost += s["total_cost"]
            total_t += s["weight_t"]
        rows.append(["Total", "", "", F.tons_fmt(total_t), "", "", "", money(total_cost)])
        story.append(_table(rows, [w * mm for w in (22, 32, 30, 14, 24, 22, 20, 20)], st))
        story.append(PageBreak())
    for i, s in enumerate(shipments):
        if i:
            story.append(PageBreak())
        story += shipment_story(s, money, now, st)
    doc.build(story, onFirstPage=_footer(f"{now:%d/%m/%Y %H:%M}"), onLaterPages=_footer(f"{now:%d/%m/%Y %H:%M}"))
    return buf.getvalue()
