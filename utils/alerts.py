"""
alerts.py
Centro de alertas consolidadas: recorre todos los módulos y devuelve una lista
unificada de situaciones que requieren atención, con severidad y enlace al
módulo correspondiente.
"""
from datetime import datetime
from typing import List

from database.db import run_query

SEVERITY_ORDER = {"critica": 0, "alta": 1, "media": 2, "baja": 3}


def _today():
    return datetime.today().date()


def stock_alerts() -> List[dict]:
    """Stock bajo mínimo (crítico) y sobre máximo (exceso de capital inmovilizado)."""
    df = run_query("""
        SELECT i.item_id, i.sku, i.name, i.quantity, i.min_stock, i.max_stock,
               n.name AS almacen
        FROM inventory_items i
        JOIN warehouses w ON i.warehouse_id = w.warehouse_id
        JOIN nodes n ON w.node_id = n.node_id
    """)
    alertas = []
    for r in df.to_dict(orient="records"):
        if r["quantity"] <= r["min_stock"]:
            alertas.append({
                "severidad": "critica", "modulo": "Warehouse", "tipo": "Stock crítico",
                "titulo": f"{r['sku']} — {r['name']}",
                "detalle": f"{r['quantity']:.0f} unidades en {r['almacen']} (mínimo: {r['min_stock']:.0f})",
                "referencia": r["sku"],
            })
        elif r["quantity"] >= r["max_stock"]:
            alertas.append({
                "severidad": "media", "modulo": "Warehouse", "tipo": "Sobre-stock",
                "titulo": f"{r['sku']} — {r['name']}",
                "detalle": f"{r['quantity']:.0f} unidades en {r['almacen']} (máximo: {r['max_stock']:.0f})",
                "referencia": r["sku"],
            })
    return alertas


def license_alerts(days_threshold: int = 30) -> List[dict]:
    """Licencias de conducción próximas a vencer o ya vencidas."""
    df = run_query("SELECT * FROM drivers WHERE status = 'Activo'")
    alertas = []
    for r in df.to_dict(orient="records"):
        try:
            exp = datetime.strptime(r["license_expiry"], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            continue
        dias = (exp - _today()).days
        if dias < 0:
            alertas.append({
                "severidad": "critica", "modulo": "Fleet", "tipo": "Licencia vencida",
                "titulo": r["name"],
                "detalle": f"Licencia {r['license_number']} venció hace {abs(dias)} días",
                "referencia": r["license_number"],
            })
        elif dias <= days_threshold:
            alertas.append({
                "severidad": "alta", "modulo": "Fleet", "tipo": "Licencia por vencer",
                "titulo": r["name"],
                "detalle": f"Licencia {r['license_number']} vence en {dias} días",
                "referencia": r["license_number"],
            })
    return alertas


def customs_alerts(days_threshold: int = 15) -> List[dict]:
    """Documentos aduaneros por vencer y trámites estancados."""
    df = run_query("SELECT * FROM customs_documents")
    alertas = []
    for r in df.to_dict(orient="records"):
        expiry = r.get("expiry_date")
        if expiry and isinstance(expiry, str):
            try:
                exp = datetime.strptime(expiry, "%Y-%m-%d").date()
                dias = (exp - _today()).days
                if dias < 0:
                    alertas.append({
                        "severidad": "critica", "modulo": "Customs", "tipo": "Documento vencido",
                        "titulo": f"{r['doc_type']} {r['doc_number']}",
                        "detalle": f"Venció hace {abs(dias)} días (envío #{r['shipment_id']})",
                        "referencia": r["doc_number"],
                    })
                elif dias <= days_threshold:
                    alertas.append({
                        "severidad": "alta", "modulo": "Customs", "tipo": "Documento por vencer",
                        "titulo": f"{r['doc_type']} {r['doc_number']}",
                        "detalle": f"Vence en {dias} días (envío #{r['shipment_id']})",
                        "referencia": r["doc_number"],
                    })
            except (ValueError, TypeError):
                pass
        if r["status"] == "Rechazado":
            alertas.append({
                "severidad": "critica", "modulo": "Customs", "tipo": "Trámite rechazado",
                "titulo": f"{r['doc_type']} {r['doc_number']}",
                "detalle": f"Documento rechazado en aduana (envío #{r['shipment_id']})",
                "referencia": r["doc_number"],
            })
    return alertas


def shipment_alerts() -> List[dict]:
    """Envíos retrasados o con fecha prometida vencida sin entregar."""
    df = run_query("""
        SELECT s.*, no.name AS origen, nd.name AS destino
        FROM shipments s
        JOIN nodes no ON s.origin_node_id = no.node_id
        JOIN nodes nd ON s.dest_node_id = nd.node_id
    """)
    alertas = []
    for r in df.to_dict(orient="records"):
        if r["status"] == "Retrasado":
            alertas.append({
                "severidad": "alta", "modulo": "Freight", "tipo": "Envío retrasado",
                "titulo": f"Envío #{r['shipment_id']}",
                "detalle": f"{r['origen']} → {r['destino']} marcado como retrasado",
                "referencia": str(r["shipment_id"]),
            })
        elif r["status"] in ("Registrado", "Consolidado", "En Transito") and r.get("promised_date"):
            try:
                prom = datetime.strptime(r["promised_date"], "%Y-%m-%d").date()
                if prom < _today():
                    dias = (_today() - prom).days
                    alertas.append({
                        "severidad": "critica", "modulo": "Freight", "tipo": "Fecha prometida vencida",
                        "titulo": f"Envío #{r['shipment_id']}",
                        "detalle": f"{r['origen']} → {r['destino']}, {dias} días de atraso sin entregar",
                        "referencia": str(r["shipment_id"]),
                    })
            except (ValueError, TypeError):
                pass
    return alertas


def fleet_alerts() -> List[dict]:
    """Vehículos fuera de servicio o en mantenimiento prolongado."""
    df = run_query("SELECT * FROM vehicles")
    alertas = []
    for r in df.to_dict(orient="records"):
        if r["status"] == "Fuera de Servicio":
            alertas.append({
                "severidad": "alta", "modulo": "Fleet", "tipo": "Vehículo fuera de servicio",
                "titulo": r["plate"],
                "detalle": f"{r['vehicle_type']} no disponible para asignación",
                "referencia": r["plate"],
            })
        elif r["status"] == "Mantenimiento":
            alertas.append({
                "severidad": "media", "modulo": "Fleet", "tipo": "Vehículo en mantenimiento",
                "titulo": r["plate"],
                "detalle": f"{r['vehicle_type']} temporalmente fuera de operación",
                "referencia": r["plate"],
            })
    return alertas


def maintenance_alerts() -> List[dict]:
    """Mantenimientos preventivos vencidos o próximos, según la predicción."""
    try:
        from utils.fleet_analytics import maintenance_forecast_all
        pronosticos = maintenance_forecast_all()
    except Exception:
        return []
    alertas = []
    for p in pronosticos:
        if p["vencido"]:
            alertas.append({
                "severidad": "critica", "modulo": "Fleet", "tipo": "Mantenimiento vencido",
                "titulo": p["placa"],
                "detalle": f"Excedió el intervalo preventivo por {abs(p['km_faltantes']):.0f} km",
                "referencia": p["placa"],
            })
        elif p["alerta"]:
            alertas.append({
                "severidad": "media", "modulo": "Fleet", "tipo": "Mantenimiento próximo",
                "titulo": p["placa"],
                "detalle": f"Faltan {p['km_faltantes']:.0f} km (aprox. {p['fecha_estimada']})",
                "referencia": p["placa"],
            })
    return alertas


def get_all_alerts() -> List[dict]:
    """Consolida todas las alertas del sistema, ordenadas por severidad."""
    alertas = []
    for fn in (stock_alerts, license_alerts, customs_alerts, shipment_alerts,
               fleet_alerts, maintenance_alerts):
        try:
            alertas.extend(fn())
        except Exception:
            continue
    return sorted(alertas, key=lambda a: SEVERITY_ORDER.get(a["severidad"], 99))


def alert_counts() -> dict:
    """Conteo de alertas por severidad, para los badges de la interfaz."""
    alertas = get_all_alerts()
    conteo = {"critica": 0, "alta": 0, "media": 0, "baja": 0}
    for a in alertas:
        conteo[a["severidad"]] = conteo.get(a["severidad"], 0) + 1
    conteo["total"] = len(alertas)
    return conteo
