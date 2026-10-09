"""
format.py
Formateo numérico de la API (convención es-CO: miles con punto, decimales con
coma). Cada valor viaja dos veces: el número redondeado a una precisión útil
(para ordenar, filtrar y graficar) y su texto listo para mostrar (`*_fmt`).

Reglas: sin decimales innecesarios (`12 t`, no `12.0 t`), dinero en USD
entero, distancias en km enteros, duraciones legibles (`5 h 36 min`,
`11 d 19 h`).
"""
from __future__ import annotations

MODE_LABELS = {"terrestre": "Terrestre", "fluvial": "Fluvial", "maritimo": "Marítimo",
               "aereo": "Aéreo", "ferreo": "Férreo"}
CONNECTION_LABELS = {"terrestre": "Conexión terrestre", "fluvial": "Conexión fluvial",
                     "maritimo": "Conexión marítima", "aereo": "Conexión aérea",
                     "ferreo": "Conexión férrea"}
MODE_VEHICLE = {"terrestre": "Camión", "fluvial": "Barcaza", "maritimo": "Buque",
                "aereo": "Avión", "ferreo": "Tren"}


def _group(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def number(v: float, decimals: int = 0) -> str:
    """12450.0 -> '12.450'; 5.60 -> '5,6'; 5.0 -> '5'."""
    if decimals <= 0 or float(v).is_integer():
        return _group(int(round(v)))
    entero, frac = f"{abs(v):.{decimals}f}".split(".")
    frac = frac.rstrip("0")
    signo = "-" if v < 0 else ""
    return f"{signo}{_group(int(entero))}" + (f",{frac}" if frac else "")


def money(v: float) -> int:
    return int(round(v))


def money_fmt(v: float) -> str:
    return f"US$ {number(v)}"


def km(v: float) -> int:
    return int(round(v))


def km_fmt(v: float) -> str:
    return f"{number(v)} km"


def hours(v: float) -> float:
    return round(float(v), 1)


def duration_fmt(h: float) -> str:
    total_min = int(round(float(h) * 60))
    if total_min < 60:
        return f"{total_min} min"
    if total_min < 48 * 60:
        hh, mm = divmod(total_min, 60)
        return f"{hh} h" + (f" {mm} min" if mm else "")
    dd, rem = divmod(total_min, 24 * 60)
    hh = round(rem / 60)
    if hh == 24:
        dd, hh = dd + 1, 0
    return f"{dd} d" + (f" {hh} h" if hh else "")


def tons(v: float) -> float:
    v = float(v)
    return round(v, 1) if v < 100 else float(round(v))


def tons_fmt(v: float) -> str:
    return f"{number(tons(v), 1)} t"


def pct(v: float) -> float:
    return round(float(v), 1)


def pct_fmt(v: float) -> str:
    return f"{number(round(float(v), 1), 1)} %"


def coord(v: float) -> float:
    return round(float(v), 4)
