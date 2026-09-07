"""
inventory_analytics.py
Analítica avanzada de inventario para el módulo Warehouse Management:

  - Pronóstico de demanda: media móvil simple (SMA) y suavizado exponencial
    simple (SES, método de Brown).
  - Cantidad Económica de Pedido (EOQ, modelo de Wilson).
  - Punto de Reorden (ROP) con stock de seguridad basado en nivel de servicio.
  - Clasificación ABC por valor de consumo (regla de Pareto 80/15/5).

Todas las fórmulas están documentadas para trazabilidad académica.
"""
import math
from datetime import datetime
from typing import List, Optional

import pandas as pd

from database.db import run_query

# Factor Z de la distribución normal estándar para niveles de servicio comunes
Z_SCORES = {0.50: 0.00, 0.75: 0.674, 0.80: 0.842, 0.85: 1.036, 0.90: 1.282,
            0.95: 1.645, 0.975: 1.960, 0.98: 2.054, 0.99: 2.326, 0.995: 2.576}


def z_for_service_level(service_level: float) -> float:
    """Devuelve el factor Z (una cola) para el nivel de servicio indicado.

    Acepta las dos convenciones de forma indistinta para evitar errores de
    unidades: fracción (0.95) o porcentaje (95). Cualquier valor mayor que 1
    se interpreta como porcentaje y se normaliza dividiendo entre 100.

    IMPORTANTE: se usa Z de UNA cola, que es el correcto para stock de
    seguridad (solo penaliza el faltante, no el exceso). Z(95%) = 1.645.
    """
    sl = float(service_level)
    if sl > 1.0:            # viene en porcentaje (ej. 95) -> 0.95
        sl = sl / 100.0
    sl = min(max(sl, 0.50), 0.9999)   # se acota al rango soportado
    key = min(Z_SCORES.keys(), key=lambda k: abs(k - sl))
    return Z_SCORES[key]


# ---------------------------------------------------------------------------
# PRONÓSTICO DE DEMANDA
# ---------------------------------------------------------------------------
def demand_series(item_id: int) -> pd.DataFrame:
    """Serie histórica de demanda (despachos) de un SKU, agregada por fecha."""
    df = run_query(
        """SELECT movement_date AS fecha, SUM(quantity) AS demanda
           FROM warehouse_movements
           WHERE item_id = ? AND movement_type = 'Outbound-Despacho'
           GROUP BY movement_date ORDER BY movement_date""",
        (item_id,),
    )
    return df


def moving_average_forecast(values: List[float], window: int = 3,
                             periods_ahead: int = 1) -> dict:
    """Media móvil simple (SMA).

    Fórmula: F(t+1) = (D(t) + D(t-1) + ... + D(t-n+1)) / n

    Devuelve el pronóstico y el error absoluto medio (MAE) del ajuste."""
    if not values:
        return {"forecast": None, "mae": None, "fitted": [], "method": "SMA"}
    n = min(window, len(values))
    forecast = sum(values[-n:]) / n

    # Ajuste histórico para medir el error
    fitted, errors = [], []
    for i in range(n, len(values)):
        f = sum(values[i - n:i]) / n
        fitted.append(f)
        errors.append(abs(values[i] - f))
    mae = sum(errors) / len(errors) if errors else None
    return {"forecast": round(forecast, 2), "mae": round(mae, 2) if mae is not None else None,
            "fitted": fitted, "method": f"SMA({n})",
            "forecast_series": [round(forecast, 2)] * periods_ahead}


def exponential_smoothing_forecast(values: List[float], alpha: float = 0.3,
                                    periods_ahead: int = 1) -> dict:
    """Suavizado exponencial simple (SES).

    Fórmula: F(t+1) = alpha * D(t) + (1 - alpha) * F(t)
    con F(1) = D(1) como inicialización.

    alpha alto -> reacciona rápido a cambios recientes;
    alpha bajo -> suaviza más el ruido."""
    if not values:
        return {"forecast": None, "mae": None, "fitted": [], "method": "SES"}
    level = values[0]
    fitted, errors = [level], []
    for d in values[1:]:
        errors.append(abs(d - level))
        level = alpha * d + (1 - alpha) * level
        fitted.append(level)
    mae = sum(errors) / len(errors) if errors else None
    return {"forecast": round(level, 2), "mae": round(mae, 2) if mae is not None else None,
            "fitted": fitted, "method": f"SES(alpha={alpha})",
            "forecast_series": [round(level, 2)] * periods_ahead}


def best_forecast(values: List[float], window: int = 3, alpha: float = 0.3) -> dict:
    """Compara SMA vs. SES y devuelve ambos más cuál tiene menor MAE."""
    sma = moving_average_forecast(values, window)
    ses = exponential_smoothing_forecast(values, alpha)
    candidates = [c for c in (sma, ses) if c["mae"] is not None]
    best = min(candidates, key=lambda c: c["mae"])["method"] if candidates else None
    return {"sma": sma, "ses": ses, "mejor_metodo": best}


# ---------------------------------------------------------------------------
# EOQ - CANTIDAD ECONÓMICA DE PEDIDO (modelo de Wilson)
# ---------------------------------------------------------------------------
def compute_eoq(annual_demand: float, order_cost: float, holding_cost_unit: float) -> dict:
    """EOQ = sqrt( (2 * D * S) / H )

    D = demanda anual (unidades/año)
    S = costo de emitir un pedido (USD/pedido)
    H = costo de mantener una unidad en inventario un año (USD/unidad/año)

    Devuelve además el número de pedidos al año, el tiempo entre pedidos y el
    costo total anual de inventario en el óptimo."""
    if annual_demand <= 0 or order_cost <= 0 or holding_cost_unit <= 0:
        return {"eoq": None, "error": "Los tres parámetros deben ser mayores que cero."}

    eoq = math.sqrt((2 * annual_demand * order_cost) / holding_cost_unit)
    orders_per_year = annual_demand / eoq
    days_between = 365 / orders_per_year
    ordering_cost_total = orders_per_year * order_cost
    holding_cost_total = (eoq / 2) * holding_cost_unit
    total_cost = ordering_cost_total + holding_cost_total

    return {
        "eoq": round(eoq, 2),
        "pedidos_por_anio": round(orders_per_year, 2),
        "dias_entre_pedidos": round(days_between, 1),
        "costo_pedidos_anual": round(ordering_cost_total, 2),
        "costo_mantenimiento_anual": round(holding_cost_total, 2),
        "costo_total_anual": round(total_cost, 2),
    }


# ---------------------------------------------------------------------------
# ROP - PUNTO DE REORDEN
# ---------------------------------------------------------------------------
def compute_rop(avg_daily_demand: float, lead_time_days: float,
                 demand_std_dev: float = 0.0, service_level: float = 0.95) -> dict:
    """ROP = (d * L) + SS,  con SS = Z * sigma_d * sqrt(L)

    d       = demanda diaria promedio
    L       = lead time (días)
    sigma_d = desviación estándar de la demanda diaria
    Z       = factor de la normal para el nivel de servicio deseado

    El stock de seguridad (SS) absorbe la variabilidad de la demanda durante
    el lead time."""
    z = z_for_service_level(service_level)
    demand_during_lt = avg_daily_demand * lead_time_days
    safety_stock = z * demand_std_dev * math.sqrt(lead_time_days) if demand_std_dev > 0 else 0.0
    rop = demand_during_lt + safety_stock
    return {
        "rop": round(rop, 2),
        "demanda_durante_lead_time": round(demand_during_lt, 2),
        "stock_seguridad": round(safety_stock, 2),
        "z_utilizado": z,
        "nivel_servicio": service_level,
    }


# ---------------------------------------------------------------------------
# CLASIFICACIÓN ABC
# ---------------------------------------------------------------------------
def abc_classification(a_cut: float = 80.0, b_cut: float = 95.0) -> List[dict]:
    """Clasifica los SKU por valor de consumo acumulado (Pareto).

    Valor de consumo = unidades despachadas * costo unitario.
    Clase A: hasta a_cut % acumulado · Clase B: hasta b_cut % · Clase C: el resto.

    Si un SKU no tiene despachos registrados, se usa el valor del stock actual
    como proxy para que igual quede clasificado."""
    df = run_query("""
        SELECT i.item_id, i.sku, i.name, i.zone, i.quantity, i.unit_cost,
               n.name AS warehouse_name,
               COALESCE(SUM(CASE WHEN m.movement_type='Outbound-Despacho'
                    THEN m.quantity ELSE 0 END), 0) AS despachos
        FROM inventory_items i
        JOIN warehouses w ON i.warehouse_id = w.warehouse_id
        JOIN nodes n ON w.node_id = n.node_id
        LEFT JOIN warehouse_movements m ON m.item_id = i.item_id
        GROUP BY i.item_id
    """)
    if df.empty:
        return []

    df["valor_consumo"] = df["despachos"] * df["unit_cost"]
    # Proxy para SKU sin despachos: valor del inventario en mano.
    # Se marca explícitamente la base usada, porque mezclar valor de consumo
    # con valor de stock en un mismo ranking Pareto debe quedar visible para
    # que la lectura del análisis sea honesta (un SKU clasificado por stock
    # aún no tiene historial de demanda que respalde su posición).
    df["base"] = "Consumo (despachos)"
    sin_consumo = df["valor_consumo"] <= 0
    df.loc[sin_consumo, "valor_consumo"] = df.loc[sin_consumo, "quantity"] * df.loc[sin_consumo, "unit_cost"]
    df.loc[sin_consumo, "base"] = "Stock (sin despachos)"

    df = df.sort_values("valor_consumo", ascending=False).reset_index(drop=True)
    total = df["valor_consumo"].sum()
    if total <= 0:
        df["pct"] = 0.0
        df["pct_acumulado"] = 0.0
        df["clase"] = "C"
        return df.to_dict(orient="records")

    df["pct"] = 100 * df["valor_consumo"] / total
    df["pct_acumulado"] = df["pct"].cumsum()

    def _clase(pct_acum):
        if pct_acum <= a_cut:
            return "A"
        if pct_acum <= b_cut:
            return "B"
        return "C"

    df["clase"] = df["pct_acumulado"].apply(_clase)
    for col in ("valor_consumo", "pct", "pct_acumulado"):
        df[col] = df[col].round(2)
    return df.to_dict(orient="records")


# ---------------------------------------------------------------------------
# OCUPACIÓN POR ZONA
# ---------------------------------------------------------------------------
def zone_occupancy() -> List[dict]:
    """Ocupación agregada por almacén y zona de rotación (para el mapa de calor)."""
    df = run_query("""
        SELECT n.name AS almacen, i.zone AS zona,
               SUM(i.quantity) AS unidades,
               SUM(i.quantity * i.unit_cost) AS valor,
               COUNT(*) AS skus
        FROM inventory_items i
        JOIN warehouses w ON i.warehouse_id = w.warehouse_id
        JOIN nodes n ON w.node_id = n.node_id
        GROUP BY n.name, i.zone
    """)
    return df.to_dict(orient="records") if not df.empty else []


def sku_traceability(item_id: int) -> List[dict]:
    """Línea de tiempo completa de movimientos de un SKU, con saldo acumulado."""
    df = run_query("""
        SELECT m.movement_id, m.movement_date, m.movement_type, m.quantity, m.reference,
               i.sku, i.name AS producto
        FROM warehouse_movements m
        JOIN inventory_items i ON m.item_id = i.item_id
        WHERE m.item_id = ?
        ORDER BY m.movement_date, m.movement_id
    """, (item_id,))
    if df.empty:
        return []
    saldo = 0.0
    registros = []
    for r in df.to_dict(orient="records"):
        delta = r["quantity"] if r["movement_type"].startswith("Inbound") else -r["quantity"]
        saldo += delta
        r["delta"] = delta
        r["saldo_acumulado"] = saldo
        registros.append(r)
    return registros
