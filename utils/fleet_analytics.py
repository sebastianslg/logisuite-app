"""
fleet_analytics.py
Analítica avanzada para Fleet Management y cálculo de huella de carbono:

  - Costo Total de Propiedad (TCO) por vehículo.
  - Predicción del próximo mantenimiento preventivo por kilometraje.
  - Huella de carbono por envío (factores de emisión por modo de transporte).
"""
import math
from datetime import datetime, timedelta
from typing import List, Optional

from database.db import run_query

# ---------------------------------------------------------------------------
# FACTORES DE EMISIÓN (kg CO2e por tonelada-kilómetro)
# Valores de referencia tipo GLEC/DEFRA para transporte de carga.
# ---------------------------------------------------------------------------
EMISSION_FACTORS = {
    "Terrestre": 0.105,   # camión de carga pesada
    "Maritimo": 0.016,    # buque portacontenedores
    "Aereo": 0.602,       # carga aérea
    "Fluvial": 0.031,     # barcaza fluvial
}

# Consumo de combustible de referencia por tipología (litros por 100 km)
FUEL_CONSUMPTION_L_100KM = {
    "Tractomula": 38.0,
    "Camion 3 ejes": 28.0,
    "Camion 2 ejes": 20.0,
    "Furgon": 14.0,
    "Van": 10.0,
}

# Valor de compra de referencia por tipología (USD), usado para depreciación
VEHICLE_PURCHASE_VALUE = {
    "Tractomula": 120_000.0,
    "Camion 3 ejes": 75_000.0,
    "Camion 2 ejes": 48_000.0,
    "Furgon": 32_000.0,
    "Van": 24_000.0,
}

DEFAULT_FUEL_PRICE = 1.05          # USD por litro
DEFAULT_USEFUL_LIFE_YEARS = 10     # vida útil para depreciación lineal
DEFAULT_RESIDUAL_PCT = 0.20        # valor residual al final de la vida útil


# ---------------------------------------------------------------------------
# HUELLA DE CARBONO
# ---------------------------------------------------------------------------
def compute_emissions(distance_km: float, weight_kg: float, mode: str = "Terrestre") -> dict:
    """Huella de carbono de un envío.

    Fórmula: kg CO2e = toneladas * km * factor_emision(modo)

    Es el método estándar de tonelada-kilómetro: la carga y la distancia son
    proporcionales a la emisión, ponderadas por la eficiencia del modo."""
    factor = EMISSION_FACTORS.get(mode, EMISSION_FACTORS["Terrestre"])
    tons = weight_kg / 1000.0
    ton_km = tons * distance_km
    kg_co2e = ton_km * factor
    return {
        "modo": mode,
        "factor_kg_co2e_por_ton_km": factor,
        "toneladas": round(tons, 3),
        "distancia_km": round(distance_km, 1),
        "ton_km": round(ton_km, 2),
        "kg_co2e": round(kg_co2e, 2),
        "ton_co2e": round(kg_co2e / 1000.0, 4),
    }


def compare_modes_emissions(distance_km: float, weight_kg: float) -> List[dict]:
    """Compara la huella de carbono del mismo envío en todos los modos."""
    resultados = []
    for mode in EMISSION_FACTORS:
        r = compute_emissions(distance_km, weight_kg, mode)
        resultados.append(r)
    return sorted(resultados, key=lambda x: x["kg_co2e"])


# ---------------------------------------------------------------------------
# TCO - COSTO TOTAL DE PROPIEDAD
# ---------------------------------------------------------------------------
def compute_tco(vehicle_id: int, fuel_price: float = DEFAULT_FUEL_PRICE,
                 useful_life_years: int = DEFAULT_USEFUL_LIFE_YEARS) -> Optional[dict]:
    """TCO = combustible estimado + mantenimiento histórico + depreciación anual.

    Combustible: (odómetro / 100) * consumo_l_100km * precio_litro
    Depreciación lineal: (valor_compra - valor_residual) / vida_util
    Mantenimiento: suma real de maintenance_records para ese vehículo.

    Devuelve también el costo por kilómetro recorrido, que es el indicador
    comparable entre vehículos de distinta tipología."""
    df = run_query("SELECT * FROM vehicles WHERE vehicle_id = ?", (vehicle_id,))
    if df.empty:
        return None
    v = df.to_dict(orient="records")[0]

    vtype = v["vehicle_type"]
    odometer = float(v["odometer_km"])

    consumo = FUEL_CONSUMPTION_L_100KM.get(vtype, 20.0)
    litros = (odometer / 100.0) * consumo
    costo_combustible = litros * fuel_price

    maint_df = run_query(
        "SELECT COALESCE(SUM(cost),0) total, COUNT(*) n FROM maintenance_records WHERE vehicle_id = ?",
        (vehicle_id,),
    )
    costo_mantenimiento = float(maint_df.iloc[0]["total"])
    n_mantenimientos = int(maint_df.iloc[0]["n"])

    valor_compra = VEHICLE_PURCHASE_VALUE.get(vtype, 40_000.0)
    valor_residual = valor_compra * DEFAULT_RESIDUAL_PCT
    depreciacion_anual = (valor_compra - valor_residual) / useful_life_years

    tco_total = costo_combustible + costo_mantenimiento + depreciacion_anual
    costo_por_km = tco_total / odometer if odometer > 0 else None

    return {
        "vehicle_id": vehicle_id,
        "placa": v["plate"],
        "tipo": vtype,
        "odometro_km": odometer,
        "litros_estimados": round(litros, 1),
        "costo_combustible": round(costo_combustible, 2),
        "costo_mantenimiento": round(costo_mantenimiento, 2),
        "n_mantenimientos": n_mantenimientos,
        "valor_compra_referencia": valor_compra,
        "depreciacion_anual": round(depreciacion_anual, 2),
        "tco_total": round(tco_total, 2),
        "costo_por_km": round(costo_por_km, 3) if costo_por_km else None,
    }


def tco_all_vehicles(fuel_price: float = DEFAULT_FUEL_PRICE) -> List[dict]:
    """TCO de toda la flota, ordenado por costo por kilómetro."""
    vehicles = run_query("SELECT vehicle_id FROM vehicles").to_dict(orient="records")
    resultados = []
    for v in vehicles:
        r = compute_tco(v["vehicle_id"], fuel_price=fuel_price)
        if r:
            resultados.append(r)
    return sorted(resultados, key=lambda x: (x["costo_por_km"] is None, x["costo_por_km"]))


# ---------------------------------------------------------------------------
# PREDICCIÓN DE MANTENIMIENTO PREVENTIVO
# ---------------------------------------------------------------------------
def predict_next_maintenance(vehicle_id: int, interval_km: float = 20_000.0,
                              default_daily_km: float = 180.0) -> Optional[dict]:
    """Estima cuándo tocará el próximo mantenimiento preventivo.

    Método: se toma el odómetro del último preventivo, se suma el intervalo
    para obtener el kilometraje objetivo, y se estima la fecha dividiendo los
    km faltantes entre el promedio diario recorrido (calculado del historial
    de mantenimientos; si no hay suficiente historial, se usa un promedio por
    defecto)."""
    vdf = run_query("SELECT * FROM vehicles WHERE vehicle_id = ?", (vehicle_id,))
    if vdf.empty:
        return None
    v = vdf.to_dict(orient="records")[0]
    odometer = float(v["odometer_km"])

    hist = run_query(
        """SELECT maintenance_date, odometer_km FROM maintenance_records
           WHERE vehicle_id = ? ORDER BY maintenance_date""",
        (vehicle_id,),
    ).to_dict(orient="records")

    # Promedio diario de kilometraje a partir del historial disponible
    daily_km = default_daily_km
    if len(hist) >= 2:
        try:
            d0 = datetime.strptime(hist[0]["maintenance_date"], "%Y-%m-%d")
            d1 = datetime.strptime(hist[-1]["maintenance_date"], "%Y-%m-%d")
            dias = (d1 - d0).days
            km = float(hist[-1]["odometer_km"]) - float(hist[0]["odometer_km"])
            if dias > 0 and km > 0:
                daily_km = km / dias
        except (ValueError, TypeError):
            pass

    # Último preventivo registrado
    prev = run_query(
        """SELECT odometer_km, maintenance_date FROM maintenance_records
           WHERE vehicle_id = ? AND maintenance_type = 'Preventivo'
           ORDER BY odometer_km DESC LIMIT 1""",
        (vehicle_id,),
    )
    tiene_preventivo = not prev.empty
    ultimo_preventivo_km = float(prev.iloc[0]["odometer_km"]) if tiene_preventivo else None

    if tiene_preventivo:
        # Caso normal: el próximo servicio va un intervalo después del último.
        objetivo_km = ultimo_preventivo_km + interval_km
    else:
        # Sin historial de preventivos no se puede afirmar que el vehículo esté
        # vencido por todo su odómetro: se programa el siguiente múltiplo del
        # intervalo por encima del kilometraje actual. Un vehículo con 62.000 km
        # e intervalo de 20.000 queda con objetivo en 80.000, no en 20.000.
        objetivo_km = math.ceil(odometer / interval_km) * interval_km
        if objetivo_km <= odometer:
            objetivo_km = odometer + interval_km

    km_faltantes = objetivo_km - odometer
    dias_estimados = km_faltantes / daily_km if daily_km > 0 else None
    fecha_estimada = (datetime.today() + timedelta(days=dias_estimados)).strftime("%Y-%m-%d") \
        if dias_estimados is not None and dias_estimados > 0 else "VENCIDO"

    return {
        "vehicle_id": vehicle_id,
        "placa": v["plate"],
        "odometro_actual": odometer,
        "ultimo_preventivo_km": ultimo_preventivo_km,
        "intervalo_km": interval_km,
        "objetivo_km": objetivo_km,
        "km_faltantes": round(km_faltantes, 1),
        "km_diarios_estimados": round(daily_km, 1),
        "dias_estimados": round(dias_estimados, 1) if dias_estimados is not None else None,
        "fecha_estimada": fecha_estimada,
        "vencido": km_faltantes <= 0,
        "alerta": km_faltantes <= interval_km * 0.15,  # a menos del 15% del intervalo
    }


def maintenance_forecast_all(interval_km: float = 20_000.0) -> List[dict]:
    """Predicción de mantenimiento para toda la flota, priorizando urgencias."""
    vehicles = run_query("SELECT vehicle_id FROM vehicles").to_dict(orient="records")
    resultados = []
    for v in vehicles:
        r = predict_next_maintenance(v["vehicle_id"], interval_km=interval_km)
        if r:
            resultados.append(r)
    return sorted(resultados, key=lambda x: x["km_faltantes"])
