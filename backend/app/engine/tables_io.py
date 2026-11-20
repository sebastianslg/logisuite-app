"""
tables_io.py
Exportación a Excel y carga masiva (Excel o CSV) de la flota, los conductores y el inventario de las bodegas.

Mismo recorrido que la carga de envíos (`shipments_io.py`): primero se valida todo sin guardar (vista previa) y al confirmar
cada fila válida se crea con la misma función del motor que usa el formulario (`fleet.create_vehicle`, `fleet.save_driver`,
`warehouses.add_item`), así que cada fila queda con sus reglas y su línea en el historial. Las filas con error se informan
y no detienen las demás. Los encabezados van en minúscula, sin importar el orden.

  vehiculos   obligatorias: placa, modo, tipo
              opcionales:   marca, modelo, anio, capacidad_t, capacidad_m3, bodega (código), conductor (nombre exacto),
                            odometro_km, ultimo_servicio, km_ultimo_servicio, dias_servicio, km_servicio, soat_vence,
                            rtm_vence, notas
  conductores obligatorias: nombre, categoria, licencia_vence      opcional: estado (Activo | Inactivo)
  inventario  obligatorias: bodega (código), sku, nombre
              opcionales:   categoria, unidad, cantidad, minimo, maximo, volumen_m3, peso_kg, costo_usd, zona
"""
from __future__ import annotations

import base64
import binascii
import io
from datetime import datetime

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

from app.database.db import run_query
from app.engine import fleet, warehouses
from app.engine.common import OperationError, audit, safe_cell

MAX_ROWS = 1000
KINDS = ("vehiculos", "conductores", "inventario")

COLUMNS = {
    "vehiculos": ["placa", "modo", "tipo", "marca", "modelo", "anio", "capacidad_t", "capacidad_m3", "bodega", "conductor",
                  "odometro_km", "ultimo_servicio", "km_ultimo_servicio", "dias_servicio", "km_servicio", "soat_vence",
                  "rtm_vence", "notas"],
    "conductores": ["nombre", "categoria", "licencia_vence", "estado"],
    "inventario": ["bodega", "sku", "nombre", "categoria", "unidad", "cantidad", "minimo", "maximo", "volumen_m3", "peso_kg",
                   "costo_usd", "zona"],
}
REQUIRED = {"vehiculos": {"placa", "modo", "tipo"}, "conductores": {"nombre", "categoria", "licencia_vence"},
            "inventario": {"bodega", "sku", "nombre"}}
ALIASES = {"placa o matricula": "placa", "placa/matrícula": "placa", "año": "anio", "licencia": "licencia_vence",
           "vence": "licencia_vence", "código": "bodega", "codigo": "bodega", "odómetro_km": "odometro_km",
           "último_servicio": "ultimo_servicio", "km_último_servicio": "km_ultimo_servicio"}
SHEET = {"vehiculos": "Vehículos", "conductores": "Conductores", "inventario": "Inventario"}
_MODE_BY_LABEL = {v.lower(): k for k, v in fleet.MODE_LABELS.items()}
_MODE_BY_LABEL.update({k: k for k in fleet.MODES})
_MODE_BY_LABEL.update({"maritimo": "maritimo", "aéreo": "aereo", "férreo": "ferreo", "ferroviario": "ferreo"})


def _check_kind(kind: str) -> None:
    if kind not in KINDS:
        raise OperationError(f"Tipo de tabla no válido: elige {', '.join(KINDS)}.")


def _text(v) -> str:
    if v is None or (isinstance(v, float) and pd.isna(v)) or v is pd.NaT:
        return ""
    return str(v).strip()


def _date(v) -> str:
    """Fecha como AAAA-MM-DD; acepta la celda de fecha de Excel o texto AAAA-MM-DD / DD/MM/AAAA."""
    if isinstance(v, (pd.Timestamp, datetime)):
        return pd.Timestamp(v).date().isoformat()
    s = _text(v)
    if not s:
        return ""
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    raise OperationError(f"Fecha no reconocida: '{s}'. Usa AAAA-MM-DD o DD/MM/AAAA.")


def _num(v):
    s = _text(v)
    if not s:
        return None
    try:
        return float(s.replace(",", "."))
    except ValueError:
        raise OperationError(f"'{s}' debe ser un número.")


# ------------------------------------------------------------------ Exportación
def _vehicles_rows(now: datetime) -> list[list]:
    drivers = {r["driver_id"]: r["name"] for r in run_query("SELECT driver_id, name FROM fl_drivers").to_dict("records")}
    owner = {r["code"]: drivers.get(r["driver_id"]) for r in run_query("SELECT code, driver_id FROM fl_vehicles").to_dict("records")}
    out = []
    for v in fleet.list_vehicles(now):
        out.append([v["code"], v["mode_label"], v["vehicle_type"], v["make"], v["model"], v["year"], v["capacity_t"],
                    v["capacity_m3"], v["home_code"], owner.get(v["code"]), v["odometer_km"], v["last_service_at"],
                    v["last_service_km"], v["service_interval_days"], v["service_interval_km"], v["soat_expiry"],
                    v["rtm_expiry"], v["notes"]])
    return out


def _drivers_rows(now: datetime) -> list[list]:
    return [[d["name"], d["license_cat"], d["license_expiry"], d["status"]] for d in fleet.list_drivers(now)]


def _stock_rows(_now: datetime) -> list[list]:
    rows = run_query("""SELECT w.code AS bodega, s.sku, s.name, s.category, s.unit, s.qty, s.min_qty, s.max_qty, s.volume_m3,
                               s.weight_kg, s.unit_cost_usd, s.zone
                        FROM wh_stock s JOIN wh_warehouses w ON w.warehouse_id = s.warehouse_id ORDER BY w.code, s.sku""")
    return [[None if pd.isna(x) else x for x in r] for r in rows.itertuples(index=False, name=None)]


_ROWS = {"vehiculos": _vehicles_rows, "conductores": _drivers_rows, "inventario": _stock_rows}


def _style(ws, ncols: int) -> None:
    bold, fill = Font(bold=True), PatternFill("solid", fgColor="EEF1F6")
    for c in range(1, ncols + 1):
        ws.cell(row=1, column=c).font = bold
        ws.cell(row=1, column=c).fill = fill
        ws.column_dimensions[get_column_letter(c)].width = 20
    ws.freeze_panes = "A2"


def export_xlsx(kind: str, now: datetime) -> bytes:
    """Todo lo que hay hoy, con los mismos encabezados que acepta la carga: se puede corregir y volver a subir."""
    _check_kind(kind)
    wb = Workbook()
    ws = wb.active
    ws.title = SHEET[kind]
    ws.append(COLUMNS[kind])
    for row in _ROWS[kind](now):
        ws.append([safe_cell(x) for x in row])
    _style(ws, len(COLUMNS[kind]))
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


_SAMPLES = {
    "vehiculos": [["ABC123", "Terrestre", "Tractomula 3S3", "Kenworth", "T800", 2021, "", "", "", "", 120000, "2026-01-15", 115000,
                   "", "", "2027-03-01", "2027-03-01", "Ejemplo: borra esta fila"]],
    "conductores": [["Ejemplo Pérez", "C3", "2027-06-30", "Activo"]],
    "inventario": [["BOG-01", "SKU-001", "Producto de ejemplo", "General", "un", 100, 20, 500, 0.05, 2, 12.5, "A1"]],
}


def template(kind: str) -> bytes:
    _check_kind(kind)
    wb = Workbook()
    ws = wb.active
    ws.title = SHEET[kind]
    ws.append(COLUMNS[kind])
    for row in _SAMPLES[kind]:
        ws.append(row)
    _style(ws, len(COLUMNS[kind]))
    notes = wb.create_sheet("Instrucciones")
    notes.append(["Obligatorias", ", ".join(sorted(REQUIRED[kind]))])
    notes.append(["Opcionales", ", ".join(c for c in COLUMNS[kind] if c not in REQUIRED[kind]) or "—"])
    notes.append(["", f"Máximo {MAX_ROWS} filas por carga. Primero se muestra una vista previa; nada se guarda hasta confirmar."])
    if kind == "vehiculos":
        notes.append(["modo", ", ".join(fleet.MODE_LABELS.values())])
        notes.append(["tipo", "Uno del catálogo del modo (por ejemplo, Tractomula 3S3, Camión sencillo)."])
        notes.append(["bodega / conductor", "Código de la bodega y nombre exacto del conductor, si ya existen."])
    notes.column_dimensions["A"].width = 20
    notes.column_dimensions["B"].width = 100
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ------------------------------------------------------------------ Carga masiva
def _read(kind: str, filename: str, content_b64: str) -> pd.DataFrame:
    try:
        raw = base64.b64decode(content_b64, validate=True)
    except (binascii.Error, ValueError):
        raise OperationError("El archivo llegó dañado (base64 inválido).")
    try:
        if filename.lower().endswith((".xlsx", ".xlsm")):
            df = pd.read_excel(io.BytesIO(raw), dtype=object)
        else:
            df = pd.read_csv(io.BytesIO(raw), dtype=object, sep=None, engine="python")
    except Exception as exc:  # archivo ilegible: se informa sin tumbar la API
        raise OperationError(f"No se pudo leer el archivo: {exc}")
    df.columns = [ALIASES.get(str(c).strip().lower(), str(c).strip().lower()) for c in df.columns]
    missing = REQUIRED[kind] - set(df.columns)
    if missing:
        raise OperationError(f"Faltan columnas: {', '.join(sorted(missing))}.")
    df = df.dropna(how="all")
    if len(df) > MAX_ROWS:
        raise OperationError(f"El archivo tiene {len(df)} filas; el máximo por carga es {MAX_ROWS}.")
    if df.empty:
        raise OperationError("El archivo no tiene filas.")
    return df


def _warehouse_id(code: str) -> int:
    rows = run_query("SELECT warehouse_id FROM wh_warehouses WHERE UPPER(code) = ?", (code.upper(),))
    if rows.empty:
        raise OperationError(f"La bodega '{code}' no existe.")
    return int(rows.iloc[0]["warehouse_id"])


def _driver_id(name: str) -> int:
    """Por nombre, sin distinguir mayúsculas (se compara en Python: LOWER de SQLite no entiende las tildes)."""
    for r in run_query("SELECT driver_id, name FROM fl_drivers").to_dict("records"):
        if str(r["name"]).lower() == name.lower():
            return int(r["driver_id"])
    raise OperationError(f"El conductor '{name}' no existe: créalo primero en la pestaña de conductores.")


def _vehicle_data(row) -> dict:
    mode_txt = _text(row.get("modo")).lower()
    mode = _MODE_BY_LABEL.get(mode_txt)
    if not mode:
        raise OperationError(f"Modo no válido: '{_text(row.get('modo'))}'. Usa {', '.join(fleet.MODE_LABELS.values())}.")
    data = {"code": _text(row.get("placa")), "mode": mode, "vehicle_type": _text(row.get("tipo")),
            "make": _text(row.get("marca")), "model": _text(row.get("modelo")), "year": _num(row.get("anio")),
            "capacity_t": _num(row.get("capacidad_t")), "capacity_m3": _num(row.get("capacidad_m3")),
            "odometer_base_km": _num(row.get("odometro_km")), "last_service_at": _date(row.get("ultimo_servicio")) or None,
            "last_service_km": _num(row.get("km_ultimo_servicio")), "service_interval_days": _num(row.get("dias_servicio")),
            "service_interval_km": _num(row.get("km_servicio")), "soat_expiry": _date(row.get("soat_vence")) or None,
            "rtm_expiry": _date(row.get("rtm_vence")) or None, "notes": _text(row.get("notas"))}
    if data["year"] is not None:
        data["year"] = int(data["year"])
    home = _text(row.get("bodega"))
    if home:
        data["home_warehouse_id"] = _warehouse_id(home)
    driver = _text(row.get("conductor"))
    if driver:
        data["driver_id"] = _driver_id(driver)
    return data


def _driver_data(row) -> dict:
    name = _text(row.get("nombre"))
    if name and any(str(n).lower() == name.lower() for n in run_query("SELECT name FROM fl_drivers")["name"]):
        raise OperationError(f"Ya existe un conductor llamado '{name}'.")
    return {"name": name, "license_cat": _text(row.get("categoria")), "license_expiry": _date(row.get("licencia_vence")),
            "status": _text(row.get("estado")).capitalize() or "Activo"}


def _item_data(row) -> dict:
    return {"sku": _text(row.get("sku")), "name": _text(row.get("nombre")), "category": _text(row.get("categoria")) or None,
            "unit": _text(row.get("unidad")) or None, "qty": _num(row.get("cantidad")), "min_qty": _num(row.get("minimo")),
            "max_qty": _num(row.get("maximo")), "volume_m3": _num(row.get("volumen_m3")), "weight_kg": _num(row.get("peso_kg")),
            "unit_cost_usd": _num(row.get("costo_usd")), "zone": _text(row.get("zona")) or None}


def import_table(kind: str, filename: str, content_b64: str, user: str | None, now: datetime, commit: bool) -> dict:
    """Sin `commit`: valida cada fila. Con `commit`: crea las válidas. Una fila repetida dentro del mismo archivo se informa."""
    _check_kind(kind)
    df = _read(kind, filename, content_b64)
    results, created, seen = [], 0, set()
    for i, (_, row) in enumerate(df.iterrows()):
        line = i + 2  # fila de la hoja (encabezado en la 1)
        try:
            if kind == "vehiculos":
                key = _text(row.get("placa")).upper()
                label = key
                if key in seen:
                    raise OperationError(f"La placa {label} está repetida en el archivo.")
                if fleet.code_taken(key):
                    raise OperationError(f"Ya existe un vehículo con la placa o matrícula {label}.")
                data = _vehicle_data(row)
                if commit:
                    fleet.create_vehicle(data, user, now)
                else:
                    fleet._validate_vehicle(data)
            elif kind == "conductores":
                data = _driver_data(row)
                key, label = data["name"].lower(), data["name"]
                if key in seen:
                    raise OperationError(f"'{label}' está repetido en el archivo.")
                if commit:
                    fleet.save_driver(None, data, user, now)
                else:
                    fleet._text(data["name"], "El nombre", max_len=80)
                    fleet._date(data["license_expiry"], "El vencimiento de la licencia")
                    if data["status"] not in ("Activo", "Inactivo"):
                        raise OperationError("El estado del conductor no es válido.")
            else:
                wid = _warehouse_id(_text(row.get("bodega")))
                data = _item_data(row)
                key, label = (wid, data["sku"].upper()), f"{_text(row.get('bodega')).upper()}/{data['sku'].upper()}"
                if key in seen:
                    raise OperationError(f"{label} está repetido en el archivo.")
                if commit:
                    warehouses.add_item(wid, data, user, now)
                elif not run_query("SELECT 1 FROM wh_stock WHERE warehouse_id = ? AND UPPER(sku) = ?", (wid, key[1])).empty:
                    raise OperationError(f"El SKU {key[1]} ya existe en esa bodega.")
                elif not data["name"] or not data["sku"]:
                    raise OperationError("Faltan el SKU o el nombre.")
            seen.add(key)
            results.append({"row": line, "ok": True, "label": label})
            created += 1 if commit else 0
        except OperationError as exc:
            results.append({"row": line, "ok": False, "error": str(exc)})
    valid = sum(1 for r in results if r["ok"])
    if commit and created:
        audit(user, "IMPORT", {"vehiculos": "fl_vehicles", "conductores": "fl_drivers", "inventario": "wh_stock"}[kind], None,
              f"Carga masiva de {kind} desde {filename}: {created} creado(s), {len(results) - valid} con error")
    return {"kind": kind, "rows": len(results), "valid": valid, "errors": len(results) - valid, "created": created,
            "committed": commit, "results": results}
