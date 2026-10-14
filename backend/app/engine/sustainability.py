"""
sustainability.py
Estimación de combustible y huella de carbono (CO2e) de la operación.

Método: emisiones = t-km x factor de intensidad del modo (g CO2e por t-km,
pozo a rueda). El combustible se deriva de las mismas emisiones dividiendo por
el factor del combustible (kg CO2e por litro), de modo que ambas cifras son
siempre coherentes entre sí.

Los factores son valores por defecto de referencia sectorial (orden de magnitud
del marco GLEC); sirven para comparar modos y escenarios, no son un inventario
certificado. Ajustarlos a los datos reales de cada transportista es el paso
natural para auditar.
"""
from __future__ import annotations

from dataclasses import dataclass

# Orden fijo de modos (el mismo de la interfaz)
MODE_ORDER = ("maritimo", "terrestre", "aereo", "ferreo", "fluvial")


@dataclass(frozen=True)
class ModeFactor:
    g_co2e_per_tkm: float   # intensidad de carbono, pozo a rueda
    fuel: str               # combustible predominante
    kg_co2e_per_l: float    # kg CO2e por litro de ese combustible, pozo a rueda


FACTORS: dict[str, ModeFactor] = {
    "terrestre": ModeFactor(80.0, "Diésel", 3.24),
    "ferreo": ModeFactor(22.0, "Diésel", 3.24),
    "fluvial": ModeFactor(31.0, "Diésel", 3.24),
    "maritimo": ModeFactor(16.0, "Combustible marino", 3.50),
    "aereo": ModeFactor(602.0, "Jet A-1", 3.15),
}

ROAD = "terrestre"


def leg_emissions(mode: str, weight_t: float, distance_km: float) -> dict:
    """CO2e (kg), combustible (L) y t-km de un tramo."""
    f = FACTORS[mode]
    tkm = weight_t * distance_km
    kg = tkm * f.g_co2e_per_tkm / 1000.0
    return {"tkm": tkm, "co2e_kg": kg, "fuel_l": kg / f.kg_co2e_per_l}


def shipment_emissions(route: dict, weight_t: float) -> dict:
    """Totales de un envío y su desglose por modo."""
    by_mode: dict[str, dict] = {}
    for lg in route["legs"]:
        e = leg_emissions(lg["mode"], weight_t, lg["distance_km"])
        acc = by_mode.setdefault(lg["mode"], {"tkm": 0.0, "co2e_kg": 0.0, "fuel_l": 0.0})
        for k, v in e.items():
            acc[k] += v
    total = {k: sum(m[k] for m in by_mode.values()) for k in ("tkm", "co2e_kg", "fuel_l")}
    return {**total, "by_mode": by_mode}


def road_baseline(tkm: float) -> dict:
    """Escenario de referencia: todo el transporte por carretera."""
    f = FACTORS[ROAD]
    kg = tkm * f.g_co2e_per_tkm / 1000.0
    return {"co2e_kg": kg, "fuel_l": kg / f.kg_co2e_per_l}


def fuel_burned(route: dict, weight_t: float, route_h: float) -> dict:
    """Combustible consumido hasta `route_h` (horas de ruta) y el total del envío."""
    burned = total = 0.0
    for lg in route["legs"]:
        leg_l = leg_emissions(lg["mode"], weight_t, lg["distance_km"])["fuel_l"]
        total += leg_l
        span = max(lg["end_h"] - lg["start_h"], 1e-9)
        burned += leg_l * min(max((route_h - lg["start_h"]) / span, 0.0), 1.0)
    return {"burned_l": burned, "total_l": total}
