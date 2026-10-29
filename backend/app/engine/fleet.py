"""
fleet.py
Flota de vehículos de Westvane: los cinco modos (camiones y furgones, aviones de
carga, convoyes de barcazas, buques y trenes).

El estado de un vehículo NO se guarda: se deriva en cada lectura. Prioridad:

    Dado de baja            retirado de la flota
    En mantenimiento        hay un mantenimiento en curso o dentro de su ventana
    Inhabilitado            falla abierta que impide operar, o conductor con licencia vencida
    Mantenimiento vencido   pasó el plazo (días) o el kilometraje del siguiente servicio
    En ruta                 asignado a un tramo que está ocurriendo ahora
    Reservado               asignado a un tramo que sale en las próximas 24 h
    Disponible              nada de lo anterior

Solo "Disponible", "Reservado" y "En ruta" son operables. Un vehículo no operable
no se asigna a ningún envío nuevo y, si ya tenía envíos pendientes, se sustituye
por otro de su modo (o el tramo pasa a un transportista tercero) y el envío queda
con una nota y en el historial.

El kilometraje del odómetro sube solo con lo que el vehículo recorre en los envíos:
base + km de los tramos terminados (+ la parte avanzada del tramo en curso).
Eso hace que "km para el próximo mantenimiento" baje de verdad con la operación.

Asignación a envíos
-------------------
Cada tramo de un envío usa vehículos de la flota propia del modo del tramo:
  - sin cruces de horario (con un margen para descargar y volver a salir),
  - que estén operables en esa ventana, con capacidad suficiente,
  - prefiriendo el que está alojado más cerca del punto de salida del tramo.
Por carretera una carga grande se reparte en hasta 4 vehículos propios; más allá, o si
no hay vehículo libre, el tramo se terceriza (un transportista externo), como hace
cualquier operador logístico.
"""
from __future__ import annotations

import json
import math
import random
from datetime import date, datetime, timedelta

from app.data.colombia_flota import (CATALOG, DRIVER_NAMES, FAULT_CATEGORIES, NAVES, SEED_FLEET, SEVERITIES,
                                     WORKSHOPS)
from app.database.db import run_query, run_write
from app.engine.common import OperationError, _now_iso, _user, audit, records
from app.engine.multimodal import haversine_km

MODES = ("terrestre", "fluvial", "maritimo", "aereo", "ferreo")
MODE_LABELS = {"terrestre": "Terrestre", "fluvial": "Fluvial", "maritimo": "Marítimo", "aereo": "Aéreo", "ferreo": "Férreo"}
OPERABLE = ("Disponible", "Reservado", "En ruta")
STATUSES = ("Disponible", "Reservado", "En ruta", "En mantenimiento", "Inhabilitado", "Mantenimiento vencido", "Dado de baja")
MAX_OWN_UNITS = 4          # vehículos propios por tramo antes de tercerizar
RESERVED_WINDOW_H = 24     # "Reservado": sale dentro de estas horas
TURNAROUND_H = {"terrestre": 2.0, "aereo": 3.0, "fluvial": 6.0, "maritimo": 12.0, "ferreo": 6.0}
SOON_FRACTION = 0.15       # "Próximo" cuando queda este % del intervalo
SOON_MIN_DAYS = 7
DOC_SOON_DAYS = 30        # SOAT o técnico-mecánica «por vencer»
DOCUMENTS = (("soat_expiry", "SOAT"), ("rtm_expiry", "Revisión técnico-mecánica"))


def _dt(s) -> datetime:
    return datetime.fromisoformat(str(s))


def _iso(d: datetime) -> str:
    return d.isoformat(timespec="minutes")


def _f(v, name: str, lo=None, hi=None) -> float:
    try:
        x = float(str(v).replace(",", ".")) if isinstance(v, str) else float(v)
    except (TypeError, ValueError):
        raise OperationError(f"{name} debe ser un número.")
    if not math.isfinite(x):
        raise OperationError(f"{name} no es válido.")
    if lo is not None and x < lo:
        raise OperationError(f"{name} no puede ser menor que {lo:g}.")
    if hi is not None and x > hi:
        raise OperationError(f"{name} no puede ser mayor que {hi:g}.")
    return x


def _text(v, name: str, required=True, max_len=120) -> str | None:
    s = "" if v is None else str(v).strip()
    if required and not s:
        raise OperationError(f"{name} es obligatorio.")
    if len(s) > max_len:
        raise OperationError(f"{name} es demasiado largo (máximo {max_len} caracteres).")
    return s or None


def _date(v, name: str) -> datetime:
    try:
        return datetime.fromisoformat(str(v)[:19] if len(str(v)) > 10 else str(v))
    except (TypeError, ValueError):
        raise OperationError(f"{name} no es una fecha válida.")


# ---------------------------------------------------------------------------
# Catálogo
# ---------------------------------------------------------------------------
def catalog() -> dict:
    return {
        "modes": [{"key": m, "label": MODE_LABELS[m],
                   "types": [{"name": t, "capacity_t": c[0], "capacity_m3": c[1], "service_interval_days": c[2],
                              "service_interval_km": c[3], "makes": [{"make": a, "model": b} for a, b in c[4]]}
                             for t, c in CATALOG[m].items()]} for m in MODES],
        "fault_categories": FAULT_CATEGORIES,
        "severities": list(SEVERITIES),
        "maintenance_kinds": ["Preventivo", "Correctivo", "Inspección"],
        "workshops": WORKSHOPS,
    }


# ---------------------------------------------------------------------------
# Contexto: lo que se necesita para derivar el estado de todos los vehículos
# ---------------------------------------------------------------------------
def _ctx(now: datetime) -> dict:
    vehicles = records(run_query("""SELECT v.*, w.name AS home_name, w.city AS home_city, w.latitude AS home_lat,
                            w.longitude AS home_lon, w.code AS home_code
                            FROM fl_vehicles v LEFT JOIN wh_warehouses w ON w.warehouse_id = v.home_warehouse_id
                            ORDER BY v.vehicle_id"""))
    drivers = {int(r["driver_id"]): r for r in records(run_query("SELECT * FROM fl_drivers"))}

    def grouped(sql: str) -> dict:
        out: dict = {}
        for r in records(run_query(sql)):
            out.setdefault(int(r["vehicle_id"]), []).append(r)
        return out

    return {"now": now, "vehicles": vehicles, "drivers": drivers,
            "faults": grouped("SELECT * FROM fl_faults ORDER BY fault_id DESC"),
            "maint": grouped("SELECT * FROM fl_maintenance ORDER BY scheduled_start DESC"),
            "assign": grouped("SELECT * FROM fl_assignments ORDER BY start_at")}


def _odometer(v: dict, assigns: list, now: datetime) -> float:
    km = float(v["odometer_base_km"])
    for a in assigns:
        s, e = _dt(a["start_at"]), _dt(a["end_at"])
        if e <= now:
            km += a["km"]
        elif s < now:
            km += a["km"] * (now - s).total_seconds() / max((e - s).total_seconds(), 1.0)
    return km


def _service(v: dict, odometer: float, now: datetime) -> dict:
    days = int(v["service_interval_days"])
    interval_km = float(v["service_interval_km"])
    last = _dt(v["last_service_at"]) if v["last_service_at"] else _dt(v["created_at"])
    due = last + timedelta(days=days)
    days_left = (due - now).total_seconds() / 86400
    due_km = float(v["last_service_km"]) + interval_km
    km_left = due_km - odometer
    used_days = 1 - days_left / days if days else 1
    used_km = 1 - km_left / interval_km if interval_km else 1
    limiting = "días" if used_days >= used_km else "km"
    soon = days_left <= max(SOON_MIN_DAYS, SOON_FRACTION * days) or km_left <= SOON_FRACTION * interval_km
    state = "Vencido" if days_left < 0 or km_left < 0 else ("Próximo" if soon else "Al día")
    return {"state": state, "due_at": due.date().isoformat(), "days_left": round(days_left, 1),
            "due_km": round(due_km), "km_left": round(km_left), "interval_days": days, "interval_km": interval_km,
            "pct_used": round(min(max(used_days, used_km), 1.5) * 100, 1), "limiting": limiting,
            "last_service_at": last.date().isoformat()}


def _documents(v: dict, now: datetime) -> list:
    """SOAT y técnico-mecánica de un vehículo de carretera (vigentes hasta el día del vencimiento, inclusive)."""
    if v["mode"] != "terrestre":
        return []
    out = []
    for key, label in DOCUMENTS:
        exp = v.get(key)
        if not exp:
            out.append({"key": key, "label": label, "expiry": None, "days_left": None, "state": "Sin registrar"})
            continue
        days = (date.fromisoformat(exp) - now.date()).days
        state = "Vencido" if days < 0 else "Por vencer" if days <= DOC_SOON_DAYS else "Vigente"
        out.append({"key": key, "label": label, "expiry": exp, "days_left": days, "state": state})
    return out


def _doc_valid_through(v: dict, end: datetime) -> bool:
    """¿Sus documentos siguen vigentes hasta `end`? Los que no están registrados no bloquean."""
    if v["mode"] != "terrestre":
        return True
    return all(not v.get(k) or end.date() <= date.fromisoformat(v[k]) for k, _ in DOCUMENTS)


def _derive(v: dict, ctx: dict) -> dict:
    now = ctx["now"]
    vid = int(v["vehicle_id"])
    assigns = ctx["assign"].get(vid, [])
    faults = ctx["faults"].get(vid, [])
    maints = ctx["maint"].get(vid, [])
    driver = ctx["drivers"].get(int(v["driver_id"])) if v.get("driver_id") else None
    odo = _odometer(v, assigns, now)
    svc = _service(v, odo, now)
    open_faults = [f for f in faults if f["status"] != "Resuelta"]
    blocking = [f for f in open_faults if f["blocks_operation"]]
    # mantenimiento: en curso, o con la ventana abierta ahora
    in_maint = next((m for m in maints if m["status"] == "En curso"
                     or (m["status"] == "Programado" and _dt(m["scheduled_start"]) <= now < _dt(m["scheduled_end"]))), None)
    upcoming = sorted([m for m in maints if m["status"] == "Programado" and _dt(m["scheduled_start"]) > now],
                      key=lambda m: m["scheduled_start"])
    current = next((a for a in assigns if _dt(a["start_at"]) <= now < _dt(a["end_at"])), None)
    soon_assign = next((a for a in assigns if now <= _dt(a["start_at"]) <= now + timedelta(hours=RESERVED_WINDOW_H)), None)

    blockers, warnings = [], []
    lic_days = None
    if driver:
        lic_days = (_dt(driver["license_expiry"]) - now).total_seconds() / 86400
        if driver["status"] == "Activo" and lic_days < 0:
            blockers.append(f"Conductor {driver['name']} con la licencia vencida hace {int(-lic_days)} d")
        elif driver["status"] == "Activo" and lic_days <= 30:
            warnings.append(f"La licencia de {driver['name']} vence en {max(int(lic_days), 0)} d")
    for f in blocking:
        blockers.append(f"Falla {f['severity'].lower()} abierta: {f['category'].lower()} — {f['description'][:70]}")
    for f in open_faults:
        if not f["blocks_operation"]:
            warnings.append(f"Falla leve abierta: {f['category'].lower()} — {f['description'][:70]}")
    documents = _documents(v, now)
    for doc in documents:
        if doc["state"] == "Vencido":
            blockers.append(f"{doc['label']} vencido desde el {doc['expiry']}: no puede circular")
        elif doc["state"] == "Por vencer":
            warnings.append(f"{doc['label']} vence en {doc['days_left']} d ({doc['expiry']})")
    if svc["state"] == "Vencido":
        why = (f"hace {int(-svc['days_left'])} d" if svc["days_left"] < 0 else f"por {int(-svc['km_left']):,} km".replace(",", "."))
        blockers_service = f"Mantenimiento vencido {why}"
    else:
        blockers_service = None
        if svc["state"] == "Próximo":
            warnings.append(f"Mantenimiento próximo: {max(int(svc['days_left']), 0)} d o {max(svc['km_left'], 0):,} km".replace(",", "."))

    if v["retired"]:
        status = "Dado de baja"
    elif in_maint:
        status = "En mantenimiento"
    elif blockers:
        status = "Inhabilitado"
    elif blockers_service:
        status = "Mantenimiento vencido"
        blockers.append(blockers_service)
    elif current:
        status = "En ruta"
    elif soon_assign:
        status = "Reservado"
    else:
        status = "Disponible"
    if v["retired"]:
        blockers = [f"Dado de baja{': ' + v['retired_reason'] if v['retired_reason'] else ''}"]
    elif in_maint:
        blockers = [f"En {in_maint['kind'].lower()} hasta {in_maint['scheduled_end'][:16].replace('T', ' ')}"] + blockers

    return {
        "id": vid, "code": v["code"], "mode": v["mode"], "mode_label": MODE_LABELS[v["mode"]],
        "vehicle_type": v["vehicle_type"], "make": v["make"], "model": v["model"], "year": v["year"],
        "capacity_t": v["capacity_t"], "capacity_m3": v["capacity_m3"],
        "home_warehouse_id": v["home_warehouse_id"], "home_name": v.get("home_name"),
        "home_city": v.get("home_city"), "home_code": v.get("home_code"),
        "driver": ({"id": int(driver["driver_id"]), "name": driver["name"], "license_cat": driver["license_cat"],
                    "license_expiry": driver["license_expiry"], "license_days_left": round(lic_days, 1),
                    "status": driver["status"]} if driver else None),
        "documents": documents, "soat_expiry": v.get("soat_expiry"), "rtm_expiry": v.get("rtm_expiry"),
        "odometer_km": round(odo), "status": status, "operable": status in OPERABLE,
        "blockers": blockers, "warnings": warnings, "service": svc,
        "open_faults": len(open_faults), "blocking_faults": len(blocking),
        "next_maintenance": ({"id": upcoming[0]["maint_id"], "kind": upcoming[0]["kind"],
                              "start": upcoming[0]["scheduled_start"], "end": upcoming[0]["scheduled_end"],
                              "workshop": upcoming[0]["workshop"]} if upcoming else None),
        "in_maintenance": ({"id": in_maint["maint_id"], "kind": in_maint["kind"], "end": in_maint["scheduled_end"],
                            "workshop": in_maint["workshop"]} if in_maint else None),
        "current": ({"shipment_code": current["shipment_code"], "end_at": current["end_at"], "leg": current["leg_index"]}
                    if current else None),
        "upcoming_assignments": sum(1 for a in assigns if _dt(a["start_at"]) > now),
        "trips_total": len(assigns), "retired": bool(v["retired"]), "retired_reason": v.get("retired_reason"),
        "notes": v.get("notes"), "source": v.get("source"),
        "service_interval_days": v["service_interval_days"], "service_interval_km": v["service_interval_km"],
        "last_service_at": v["last_service_at"], "last_service_km": v["last_service_km"],
    }


def list_vehicles(now: datetime, mode: str | None = None, status: str | None = None, q: str | None = None,
                  warehouse_id: int | None = None) -> list:
    ctx = _ctx(now)
    out = []
    needle = (q or "").strip().lower()
    for v in ctx["vehicles"]:
        if mode and v["mode"] != mode:
            continue
        if warehouse_id and v["home_warehouse_id"] != warehouse_id:
            continue
        d = _derive(v, ctx)
        if status and d["status"] != status:
            continue
        if needle and needle not in " ".join(str(x or "") for x in (d["code"], d["vehicle_type"], d["make"], d["model"],
                                                                     d["home_name"], d["home_city"],
                                                                     (d["driver"] or {}).get("name"))).lower():
            continue
        out.append(d)
    return out


def _vehicle_row(vehicle_id: int) -> dict:
    df = run_query("SELECT * FROM fl_vehicles WHERE vehicle_id = ?", (vehicle_id,))
    if df.empty:
        raise OperationError("El vehículo no existe.")
    return records(df)[0]


def vehicle_detail(vehicle_id: int, now: datetime) -> dict:
    _vehicle_row(vehicle_id)
    ctx = _ctx(now)
    v = next(x for x in ctx["vehicles"] if int(x["vehicle_id"]) == vehicle_id)
    d = _derive(v, ctx)
    faults = ctx["faults"].get(vehicle_id, [])
    maints = ctx["maint"].get(vehicle_id, [])
    assigns = ctx["assign"].get(vehicle_id, [])
    ships = {}
    codes = sorted({a["shipment_code"] for a in assigns})
    if codes:
        df = run_query(f"SELECT shipment_code, origin_city, dest_city, cargo, status FROM mm_shipments "
                       f"WHERE shipment_code IN ({','.join('?' * len(codes))})", tuple(codes))
        ships = {r["shipment_code"]: r for r in records(df)}
    trips = []
    for a in sorted(assigns, key=lambda x: x["start_at"], reverse=True)[:30]:
        s = ships.get(a["shipment_code"], {})
        trips.append({**a, "origin": s.get("origin_city"), "destination": s.get("dest_city"), "cargo": s.get("cargo"),
                      "shipment_status": s.get("status"),
                      "phase": ("En curso" if _dt(a["start_at"]) <= now < _dt(a["end_at"])
                                else "Próximo" if _dt(a["start_at"]) > now else "Terminado")})
    d.update(
        faults=faults, maintenance=maints, trips=trips,
        maintenance_cost_usd=round(sum(float(m["cost_usd"] or 0) for m in maints if m["status"] == "Completado"), 2),
        faults_total=len(faults),
    )
    return d


def summary(now: datetime) -> dict:
    vs = list_vehicles(now)
    by_status = {s: 0 for s in STATUSES}
    by_mode: dict = {}
    for v in vs:
        by_status[v["status"]] += 1
        m = by_mode.setdefault(v["mode"], {"mode": v["mode"], "label": v["mode_label"], "total": 0, "operable": 0})
        if not v["retired"]:
            m["total"] += 1
            m["operable"] += 1 if v["operable"] else 0
    active = [v for v in vs if not v["retired"]]
    soon = sorted((v for v in active if v["service"]["state"] in ("Próximo", "Vencido")),
                  key=lambda v: v["service"]["days_left"])
    faults = records(run_query("""SELECT f.*, v.code, v.vehicle_type FROM fl_faults f JOIN fl_vehicles v ON v.vehicle_id = f.vehicle_id
                          WHERE f.status != 'Resuelta' ORDER BY CASE f.severity WHEN 'Crítica' THEN 0 WHEN 'Moderada' THEN 1 ELSE 2 END,
                          f.reported_at DESC"""))
    upcoming = records(run_query("""SELECT m.*, v.code, v.vehicle_type, v.mode FROM fl_maintenance m JOIN fl_vehicles v ON v.vehicle_id = m.vehicle_id
                            WHERE m.status IN ('Programado', 'En curso') ORDER BY m.scheduled_start"""))
    drivers_expiring = [v for v in active if v["driver"] and v["driver"]["status"] == "Activo" and v["driver"]["license_days_left"] <= 30]
    docs_due = sorted(({"id": v["id"], "code": v["code"], "label": d["label"], "state": d["state"], "expiry": d["expiry"],
                         "days_left": d["days_left"]} for v in active for d in v["documents"]
                        if d["state"] in ("Vencido", "Por vencer")), key=lambda x: x["days_left"])
    cost90 = run_query("SELECT COALESCE(SUM(cost_usd), 0) c FROM fl_maintenance WHERE status = 'Completado' AND completed_at >= ?",
                       (_iso(now - timedelta(days=90)),)).iloc[0]["c"]
    total = len(active) or 1
    return {
        "total": len(active), "by_status": by_status, "by_mode": sorted(by_mode.values(), key=lambda m: -m["total"]),
        "availability_pct": round(100 * sum(1 for v in active if v["operable"]) / total, 1),
        "maintenance_due": [{"id": v["id"], "code": v["code"], "vehicle_type": v["vehicle_type"], "mode": v["mode"],
                             "state": v["service"]["state"], "days_left": v["service"]["days_left"],
                             "km_left": v["service"]["km_left"], "limiting": v["service"]["limiting"]} for v in soon[:12]],
        "open_faults": faults, "upcoming_maintenance": upcoming[:20],
        "licenses_expiring": [{"id": v["id"], "code": v["code"], "driver": v["driver"]["name"],
                               "days_left": v["driver"]["license_days_left"]} for v in drivers_expiring],
        "documents_due": docs_due,
        "maintenance_cost_90d_usd": round(float(cost90), 2),
    }


# ---------------------------------------------------------------------------
# Altas, cambios y bajas de vehículos
# ---------------------------------------------------------------------------
def _validate_vehicle(data: dict, existing: dict | None = None) -> dict:
    d = {**(existing or {}), **{k: v for k, v in data.items() if v is not None}}
    mode = d.get("mode")
    if mode not in MODES:
        raise OperationError("Elige el modo del vehículo.")
    vtype = _text(d.get("vehicle_type"), "El tipo de vehículo", max_len=60)
    if vtype not in CATALOG[mode]:
        raise OperationError(f"'{vtype}' no es un tipo del modo {MODE_LABELS[mode].lower()}.")
    cap_t, cap_m3, days, km, _ = CATALOG[mode][vtype]
    year = int(_f(d.get("year") or datetime.now().year - 3, "El año", 1960, datetime.now().year + 1))
    home = d.get("home_warehouse_id")
    if home in ("", None):
        home = None
    else:
        home = int(home)
        if run_query("SELECT 1 FROM wh_warehouses WHERE warehouse_id = ?", (home,)).empty:
            raise OperationError("La bodega donde se aloja no existe.")
    driver = d.get("driver_id")
    driver = None if driver in ("", None) else int(driver)
    if driver is not None:
        if run_query("SELECT 1 FROM fl_drivers WHERE driver_id = ?", (driver,)).empty:
            raise OperationError("El conductor no existe.")
        other = run_query("SELECT code FROM fl_vehicles WHERE driver_id = ? AND retired = 0 AND vehicle_id != ?",
                          (driver, int(d.get("vehicle_id") or 0)))
        if not other.empty:
            raise OperationError(f"Ese conductor ya está asignado al vehículo {other.iloc[0]['code']}.")
    docs = {}
    for key, label in DOCUMENTS:
        raw = d.get(key)
        docs[key] = (_date(raw, f"El vencimiento del {label}").date().isoformat()
                     if raw not in (None, "") and mode == "terrestre" else None)
    last = d.get("last_service_at")
    last = (_date(last, "La fecha del último mantenimiento").date().isoformat() if last else datetime.now().date().isoformat())
    return {
        "code": (_text(d.get("code"), "La placa o matrícula", max_len=30) or "").upper(),
        "mode": mode, "vehicle_type": vtype,
        "make": _text(d.get("make"), "La marca", required=False, max_len=40),
        "model": _text(d.get("model"), "El modelo", required=False, max_len=40),
        "year": year,
        "capacity_t": _f(d.get("capacity_t") or cap_t, "La capacidad (t)", 0.05, 100000),
        "capacity_m3": _f(d.get("capacity_m3") or cap_m3, "El volumen (m³)", 0.1, 1000000),
        "home_warehouse_id": home, "driver_id": driver,
        "odometer_base_km": _f(d.get("odometer_base_km") or 0, "El kilometraje", 0, 100000000),
        "last_service_at": last,
        "last_service_km": _f(d.get("last_service_km") if d.get("last_service_km") not in (None, "") else d.get("odometer_base_km") or 0,
                              "El kilometraje del último mantenimiento", 0, 100000000),
        "service_interval_days": int(_f(d.get("service_interval_days") or days, "Los días entre mantenimientos", 1, 3650)),
        "service_interval_km": _f(d.get("service_interval_km") or km, "Los km entre mantenimientos", 1, 10000000),
        "notes": _text(d.get("notes"), "Las notas", required=False, max_len=300),
        **docs,
    }


def create_vehicle(data: dict, user: str | None, now: datetime) -> dict:
    v = _validate_vehicle(data)
    if not run_query("SELECT 1 FROM fl_vehicles WHERE code = ?", (v["code"],)).empty:
        raise OperationError(f"Ya existe un vehículo con la placa o matrícula {v['code']}.")
    vid = run_write("""INSERT INTO fl_vehicles (code, mode, vehicle_type, make, model, year, capacity_t, capacity_m3,
                       home_warehouse_id, driver_id, odometer_base_km, last_service_at, last_service_km,
                       service_interval_days, service_interval_km, notes, soat_expiry, rtm_expiry, source, created_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (v["code"], v["mode"], v["vehicle_type"], v["make"], v["model"], v["year"], v["capacity_t"],
                     v["capacity_m3"], v["home_warehouse_id"], v["driver_id"], v["odometer_base_km"],
                     v["last_service_at"], v["last_service_km"], v["service_interval_days"], v["service_interval_km"],
                     v["notes"], v["soat_expiry"], v["rtm_expiry"], "usuario", _now_iso()))
    audit(user, "CREATE", "fl_vehicles", v["code"], f"Vehículo creado: {v['vehicle_type']} {v['code']}")
    return vehicle_detail(vid, now)


def update_vehicle(vehicle_id: int, data: dict, user: str | None, now: datetime) -> dict:
    cur = _vehicle_row(vehicle_id)
    v = _validate_vehicle(data, cur)
    dup = run_query("SELECT 1 FROM fl_vehicles WHERE code = ? AND vehicle_id != ?", (v["code"], vehicle_id))
    if not dup.empty:
        raise OperationError(f"Ya existe otro vehículo con la placa o matrícula {v['code']}.")
    if v["capacity_t"] < cur["capacity_t"] and not run_query(
            "SELECT 1 FROM fl_assignments WHERE vehicle_id = ? AND load_t > ? AND end_at > ?",
            (vehicle_id, v["capacity_t"], _iso(now))).empty:
        raise OperationError("Tiene tramos pendientes con más carga que la nueva capacidad.")
    run_write("""UPDATE fl_vehicles SET code=?, mode=?, vehicle_type=?, make=?, model=?, year=?, capacity_t=?,
                 capacity_m3=?, home_warehouse_id=?, driver_id=?, odometer_base_km=?, last_service_at=?,
                 last_service_km=?, service_interval_days=?, service_interval_km=?, notes=?, soat_expiry=?,
                 rtm_expiry=?, updated_at=? WHERE vehicle_id=?""",
              (v["code"], v["mode"], v["vehicle_type"], v["make"], v["model"], v["year"], v["capacity_t"], v["capacity_m3"],
               v["home_warehouse_id"], v["driver_id"], v["odometer_base_km"], v["last_service_at"], v["last_service_km"],
               v["service_interval_days"], v["service_interval_km"], v["notes"], v["soat_expiry"], v["rtm_expiry"],
               _now_iso(), vehicle_id))
    changes = [f"{label}: {cur.get(k) or '—'} → {v[k] or '—'}" for k, label in DOCUMENTS if (cur.get(k) or None) != v[k]]
    audit(user, "UPDATE", "fl_vehicles", v["code"], "Vehículo editado" + (" (" + "; ".join(changes) + ")" if changes else ""))
    moved = _enforce_documents_for(vehicle_id, now, user)
    out = vehicle_detail(vehicle_id, now)
    if moved:
        out["reassigned"] = moved
    return out


def _doc_cutoff(v: dict) -> datetime | None:
    """Primer instante en que el vehículo deja de tener los documentos vigentes (o None)."""
    if v["mode"] != "terrestre":
        return None
    exps = [date.fromisoformat(v[k]) for k, _ in DOCUMENTS if v.get(k)]
    return datetime.combine(min(exps) + timedelta(days=1), datetime.min.time()) if exps else None


def _enforce_documents_for(vehicle_id: int, now: datetime, user: str | None) -> dict | None:
    """Saca al vehículo de los tramos pendientes que terminan después de que se vence su SOAT o su técnico-mecánica."""
    v = _vehicle_row(vehicle_id)
    cut = _doc_cutoff(v)
    if cut is None or run_query("SELECT 1 FROM fl_assignments WHERE vehicle_id = ? AND end_at > ? AND end_at > ? LIMIT 1",
                                (vehicle_id, _iso(cut), _iso(now))).empty:
        return None
    return replace_assignments(vehicle_id, now, reason=f"SOAT o técnico-mecánica de {v['code']} vencidos en ese viaje",
                               user=user, ends_after=cut)


def enforce_documents(now: datetime) -> int:
    """Una vez al día: ningún vehículo queda en un tramo que termina con el SOAT o la técnico-mecánica vencidos."""
    n = 0
    for r in records(run_query("SELECT vehicle_id FROM fl_vehicles WHERE mode = 'terrestre' AND retired = 0 "
                               "AND (soat_expiry IS NOT NULL OR rtm_expiry IS NOT NULL)")):
        moved = _enforce_documents_for(int(r["vehicle_id"]), now, "sistema")
        if moved:
            n += len(moved["replaced"]) + len(moved["outsourced"])
    return n


def retire_vehicle(vehicle_id: int, reason: str | None, user: str | None, now: datetime) -> dict:
    cur = _vehicle_row(vehicle_id)
    reason = _text(reason, "El motivo de la baja", max_len=200)
    run_write("UPDATE fl_vehicles SET retired = 1, retired_reason = ?, updated_at = ? WHERE vehicle_id = ?",
              (reason, _now_iso(), vehicle_id))
    audit(user, "CLOSE", "fl_vehicles", cur["code"], f"Vehículo dado de baja: {reason}")
    moved = replace_assignments(vehicle_id, now, reason=f"baja de {cur['code']}", user=user)
    out = vehicle_detail(vehicle_id, now)
    out["reassigned"] = moved
    return out


def reactivate_vehicle(vehicle_id: int, user: str | None, now: datetime) -> dict:
    cur = _vehicle_row(vehicle_id)
    run_write("UPDATE fl_vehicles SET retired = 0, retired_reason = NULL, updated_at = ? WHERE vehicle_id = ?",
              (_now_iso(), vehicle_id))
    audit(user, "REOPEN", "fl_vehicles", cur["code"], "Vehículo reincorporado a la flota")
    return vehicle_detail(vehicle_id, now)


def delete_vehicle(vehicle_id: int, user: str | None) -> dict:
    cur = _vehicle_row(vehicle_id)
    if not run_query("SELECT 1 FROM fl_assignments WHERE vehicle_id = ? LIMIT 1", (vehicle_id,)).empty:
        raise OperationError("El vehículo tiene viajes en su historial: dalo de baja en lugar de borrarlo.")
    run_write("DELETE FROM fl_vehicles WHERE vehicle_id = ?", (vehicle_id,))
    audit(user, "DELETE", "fl_vehicles", cur["code"], "Vehículo borrado")
    return {"deleted": cur["code"]}


# ---------------------------------------------------------------------------
# Conductores
# ---------------------------------------------------------------------------
def list_drivers(now: datetime) -> list:
    rows = records(run_query("""SELECT d.*, v.code AS vehicle_code, v.vehicle_id FROM fl_drivers d
                        LEFT JOIN fl_vehicles v ON v.driver_id = d.driver_id AND v.retired = 0
                        ORDER BY d.name"""))
    for r in rows:
        days = (_dt(r["license_expiry"]) - now).total_seconds() / 86400
        r["license_days_left"] = round(days, 1)
        r["license_state"] = "Vencida" if days < 0 else ("Por vencer" if days <= 30 else "Vigente")
    return rows


def _driver_row(driver_id: int) -> dict:
    df = run_query("SELECT * FROM fl_drivers WHERE driver_id = ?", (driver_id,))
    if df.empty:
        raise OperationError("El conductor no existe.")
    return records(df)[0]


def save_driver(driver_id: int | None, data: dict, user: str | None, now: datetime) -> dict:
    cur = _driver_row(driver_id) if driver_id else {}
    d = {**cur, **{k: v for k, v in data.items() if v is not None}}
    name = _text(d.get("name"), "El nombre", max_len=80)
    cat = _text(d.get("license_cat"), "La categoría de licencia", max_len=30)
    expiry = _date(d.get("license_expiry"), "El vencimiento de la licencia").date().isoformat()
    status = d.get("status") or "Activo"
    if status not in ("Activo", "Inactivo"):
        raise OperationError("El estado del conductor no es válido.")
    if driver_id:
        run_write("UPDATE fl_drivers SET name=?, license_cat=?, license_expiry=?, status=? WHERE driver_id=?",
                  (name, cat, expiry, status, driver_id))
        audit(user, "UPDATE", "fl_drivers", str(driver_id), f"Conductor editado: {name}")
    else:
        driver_id = run_write("INSERT INTO fl_drivers (name, license_cat, license_expiry, status, created_at) VALUES (?,?,?,?,?)",
                              (name, cat, expiry, status, _now_iso()))
        audit(user, "CREATE", "fl_drivers", str(driver_id), f"Conductor creado: {name}")
    return next(r for r in list_drivers(now) if r["driver_id"] == driver_id)


def delete_driver(driver_id: int, user: str | None) -> dict:
    cur = _driver_row(driver_id)
    run_write("UPDATE fl_vehicles SET driver_id = NULL WHERE driver_id = ?", (driver_id,))
    run_write("DELETE FROM fl_drivers WHERE driver_id = ?", (driver_id,))
    audit(user, "DELETE", "fl_drivers", str(driver_id), f"Conductor borrado: {cur['name']}")
    return {"deleted": cur["name"]}


# ---------------------------------------------------------------------------
# Mantenimientos
# ---------------------------------------------------------------------------
def _maint_row(maint_id: int) -> dict:
    df = run_query("SELECT * FROM fl_maintenance WHERE maint_id = ?", (maint_id,))
    if df.empty:
        raise OperationError("El mantenimiento no existe.")
    return records(df)[0]


def schedule_maintenance(vehicle_id: int, data: dict, user: str | None, now: datetime) -> dict:
    veh = _vehicle_row(vehicle_id)
    if veh["retired"]:
        raise OperationError("El vehículo está dado de baja.")
    kind = data.get("kind") or "Preventivo"
    if kind not in ("Preventivo", "Correctivo", "Inspección"):
        raise OperationError("Tipo de mantenimiento inválido.")
    start = _date(data.get("scheduled_start"), "La fecha de inicio")
    if data.get("scheduled_end"):
        end = _date(data["scheduled_end"], "La fecha de fin")
    else:
        end = start + timedelta(hours=_f(data.get("duration_h") or 8, "La duración (h)", 0.5, 24 * 60))
    if end <= start:
        raise OperationError("El mantenimiento debe terminar después de empezar.")
    if end <= now:
        raise OperationError("La ventana de mantenimiento ya pasó: elige una fecha futura.")
    clash = run_query("""SELECT 1 FROM fl_maintenance WHERE vehicle_id = ? AND status IN ('Programado', 'En curso')
                         AND scheduled_start < ? AND scheduled_end > ?""", (vehicle_id, _iso(end), _iso(start)))
    if not clash.empty:
        raise OperationError("Ya hay otro mantenimiento programado que se cruza con esas fechas.")
    fault_id = data.get("fault_id")
    if fault_id:
        f = run_query("SELECT * FROM fl_faults WHERE fault_id = ? AND vehicle_id = ?", (int(fault_id), vehicle_id))
        if f.empty:
            raise OperationError("La falla no corresponde a este vehículo.")
        run_write("UPDATE fl_faults SET status = 'En reparación' WHERE fault_id = ? AND status = 'Abierta'", (int(fault_id),))
    mid = run_write("""INSERT INTO fl_maintenance (vehicle_id, kind, status, scheduled_start, scheduled_end, workshop,
                       est_cost_usd, notes, fault_id, created_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                    (vehicle_id, kind, "Programado", _iso(start), _iso(end),
                     _text(data.get("workshop"), "El taller", required=False, max_len=80),
                     _f(data.get("est_cost_usd") or 0, "El costo estimado", 0, 1e9),
                     _text(data.get("notes"), "Las notas", required=False, max_len=300),
                     int(fault_id) if fault_id else None, _now_iso(), _user(user)))
    audit(user, "CREATE", "fl_maintenance", str(mid),
          f"{kind} programado para {veh['code']} del {_iso(start)} al {_iso(end)}")
    moved = replace_assignments(vehicle_id, now, window=(start, end), reason=f"mantenimiento de {veh['code']}", user=user)
    out = vehicle_detail(vehicle_id, now)
    out["reassigned"] = moved
    return out


def start_maintenance(maint_id: int, user: str | None, now: datetime) -> dict:
    m = _maint_row(maint_id)
    if m["status"] != "Programado":
        raise OperationError("Solo se puede iniciar un mantenimiento programado.")
    veh = _vehicle_row(m["vehicle_id"])
    end = max(_dt(m["scheduled_end"]), now + timedelta(hours=1))
    run_write("UPDATE fl_maintenance SET status = 'En curso', scheduled_start = ?, scheduled_end = ? WHERE maint_id = ?",
              (_iso(min(_dt(m["scheduled_start"]), now)), _iso(end), maint_id))
    audit(user, "UPDATE", "fl_maintenance", str(maint_id), f"Mantenimiento iniciado en {veh['code']}")
    moved = replace_assignments(m["vehicle_id"], now, window=(now, end), reason=f"mantenimiento de {veh['code']}", user=user)
    out = vehicle_detail(m["vehicle_id"], now)
    out["reassigned"] = moved
    return out


def complete_maintenance(maint_id: int, data: dict, user: str | None, now: datetime) -> dict:
    m = _maint_row(maint_id)
    if m["status"] not in ("Programado", "En curso"):
        raise OperationError("Ese mantenimiento ya está cerrado.")
    veh = _vehicle_row(m["vehicle_id"])
    ctx = _ctx(now)
    odo = _odometer(veh, ctx["assign"].get(int(m["vehicle_id"]), []), now)
    if data.get("odometer_km") not in (None, ""):
        odo = _f(data["odometer_km"], "El kilometraje", 0, 100000000)
    cost = _f(data.get("cost_usd") if data.get("cost_usd") not in (None, "") else m["est_cost_usd"], "El costo", 0, 1e9)
    run_write("""UPDATE fl_maintenance SET status = 'Completado', cost_usd = ?, odometer_km = ?, completed_at = ?, notes = ?
                 WHERE maint_id = ?""",
              (cost, round(odo), _iso(now), _text(data.get("notes"), "Las notas", required=False, max_len=300) or m["notes"], maint_id))
    resets = data.get("resets_service")
    if resets is None:
        resets = m["kind"] in ("Preventivo", "Inspección")
    if resets:
        # el contador de días y de km del siguiente servicio vuelve a cero
        run_write("UPDATE fl_vehicles SET last_service_at = ?, last_service_km = ?, updated_at = ? WHERE vehicle_id = ?",
                  (now.date().isoformat(), round(odo), _now_iso(), m["vehicle_id"]))
        # el odómetro base absorbe lo ya recorrido para que "km_left" sea coherente con last_service_km
    if m["fault_id"]:
        run_write("""UPDATE fl_faults SET status = 'Resuelta', resolved_at = ?, resolution = COALESCE(resolution, ?),
                     repair_cost_usd = COALESCE(repair_cost_usd, ?) WHERE fault_id = ? AND status != 'Resuelta'""",
                  (_iso(now), f"Reparado en {m['workshop'] or 'taller'} ({m['kind'].lower()})", cost, m["fault_id"]))
    audit(user, "UPDATE", "fl_maintenance", str(maint_id), f"{m['kind']} completado en {veh['code']} (US$ {cost:,.0f})".replace(",", "."))
    return vehicle_detail(m["vehicle_id"], now)


def cancel_maintenance(maint_id: int, user: str | None, now: datetime) -> dict:
    m = _maint_row(maint_id)
    if m["status"] not in ("Programado", "En curso"):
        raise OperationError("Ese mantenimiento ya está cerrado.")
    run_write("UPDATE fl_maintenance SET status = 'Cancelado' WHERE maint_id = ?", (maint_id,))
    audit(user, "UPDATE", "fl_maintenance", str(maint_id), "Mantenimiento cancelado")
    return vehicle_detail(m["vehicle_id"], now)


def list_maintenance(now: datetime, status: str | None = None, limit: int = 200) -> list:
    sql = """SELECT m.*, v.code, v.vehicle_type, v.mode FROM fl_maintenance m JOIN fl_vehicles v ON v.vehicle_id = m.vehicle_id"""
    params: list = []
    if status:
        sql += " WHERE m.status = ?"
        params.append(status)
    sql += " ORDER BY m.scheduled_start DESC LIMIT ?"
    params.append(max(1, min(limit, 1000)))
    return records(run_query(sql, tuple(params)))


# ---------------------------------------------------------------------------
# Fallas
# ---------------------------------------------------------------------------
def _fault_row(fault_id: int) -> dict:
    df = run_query("SELECT * FROM fl_faults WHERE fault_id = ?", (fault_id,))
    if df.empty:
        raise OperationError("La falla no existe.")
    return records(df)[0]


def report_fault(vehicle_id: int, data: dict, user: str | None, now: datetime) -> dict:
    veh = _vehicle_row(vehicle_id)
    severity = data.get("severity")
    if severity not in SEVERITIES:
        raise OperationError("Elige la gravedad de la falla.")
    category = data.get("category")
    if category not in FAULT_CATEGORIES:
        raise OperationError("Elige la categoría de la falla.")
    description = _text(data.get("description"), "La descripción", max_len=300)
    if len(description) < 5:
        raise OperationError("Describe la falla con algo más de detalle.")
    blocks = data.get("blocks_operation")
    blocks = (severity != "Leve") if blocks is None else bool(blocks)
    if severity == "Crítica":
        blocks = True  # una falla crítica siempre inhabilita
    fid = run_write("""INSERT INTO fl_faults (vehicle_id, severity, category, description, blocks_operation, status,
                       reported_at, reported_by, shipment_code) VALUES (?,?,?,?,?,?,?,?,?)""",
                    (vehicle_id, severity, category, description, 1 if blocks else 0, "Abierta", _iso(now),
                     _user(user), _text(data.get("shipment_code"), "El envío", required=False, max_len=30)))
    audit(user, "CREATE", "fl_faults", str(fid),
          f"Falla {severity.lower()} en {veh['code']} ({category}): {description[:80]}"
          + (" — vehículo inhabilitado" if blocks else ""))
    moved = replace_assignments(vehicle_id, now, reason=f"falla en {veh['code']}", user=user) if blocks else {"replaced": [], "outsourced": []}
    out = vehicle_detail(vehicle_id, now)
    out["reassigned"] = moved
    return out


def update_fault(fault_id: int, data: dict, user: str | None, now: datetime) -> dict:
    f = _fault_row(fault_id)
    veh = _vehicle_row(f["vehicle_id"])
    status = data.get("status") or f["status"]
    if status not in ("Abierta", "En reparación", "Resuelta"):
        raise OperationError("Estado de falla inválido.")
    if f["status"] == "Resuelta" and status != "Resuelta":
        raise OperationError("La falla ya está resuelta: reporta una nueva si reaparece.")
    resolution, cost = f["resolution"], f["repair_cost_usd"]
    resolved_at = f["resolved_at"]
    if status == "Resuelta":
        resolution = _text(data.get("resolution") or f["resolution"], "La solución aplicada", max_len=300)
        cost = _f(data["repair_cost_usd"], "El costo de la reparación", 0, 1e9) if data.get("repair_cost_usd") not in (None, "") else cost
        resolved_at = resolved_at or _iso(now)
    blocks = f["blocks_operation"] if data.get("blocks_operation") is None else int(bool(data["blocks_operation"]))
    if f["severity"] == "Crítica" and not blocks and status != "Resuelta":
        raise OperationError("Una falla crítica no puede dejarse operando: repárala primero.")
    run_write("""UPDATE fl_faults SET status=?, resolution=?, repair_cost_usd=?, resolved_at=?, blocks_operation=?
                 WHERE fault_id=?""", (status, resolution, cost, resolved_at, blocks, fault_id))
    audit(user, "UPDATE", "fl_faults", str(fault_id), f"Falla de {veh['code']}: {status}"
          + ("" if blocks == f["blocks_operation"] else (" (puede operar)" if not blocks else " (no puede operar)")))
    return vehicle_detail(f["vehicle_id"], now)


def list_faults(status: str | None = None, limit: int = 200) -> list:
    sql = "SELECT f.*, v.code, v.vehicle_type, v.mode FROM fl_faults f JOIN fl_vehicles v ON v.vehicle_id = f.vehicle_id"
    params: list = []
    if status == "abiertas":
        sql += " WHERE f.status != 'Resuelta'"
    elif status:
        sql += " WHERE f.status = ?"
        params.append(status)
    sql += " ORDER BY f.fault_id DESC LIMIT ?"
    params.append(max(1, min(limit, 1000)))
    return records(run_query(sql, tuple(params)))


# ---------------------------------------------------------------------------
# Asignación de vehículos a los tramos de un envío
# ---------------------------------------------------------------------------
def _overlap(a0, a1, b0, b1) -> bool:
    return a0 < b1 and b0 < a1


def _can_serve(v: dict, d: dict, ctx: dict, start: datetime, end: datetime, ignore: str | None = None) -> bool:
    """¿Puede este vehículo cubrir la ventana [start, end]? `d` es su estado derivado."""
    if v["retired"]:
        return False
    now = ctx["now"]
    vid = int(v["vehicle_id"])
    buf = timedelta(hours=TURNAROUND_H.get(v["mode"], 2.0))
    if end > now:  # lo que impide operar solo importa hacia adelante
        if d["blocking_faults"]:
            return False
        drv = d["driver"]
        if drv and drv["status"] == "Activo" and _dt(drv["license_expiry"]) < start:
            return False
        if not _doc_valid_through(v, end):
            return False
        svc = d["service"]
        if svc["km_left"] < 0 or _dt(svc["due_at"]) < start:
            return False
        for m in ctx["maint"].get(vid, []):
            if m["status"] in ("Programado", "En curso") and _overlap(start - buf, end + buf, _dt(m["scheduled_start"]), _dt(m["scheduled_end"])):
                return False
    for a in ctx["assign"].get(vid, []):
        if ignore and a["shipment_code"] == ignore:
            continue
        if _overlap(start - buf, end + buf, _dt(a["start_at"]), _dt(a["end_at"])):
            return False
    return True


def _pick(mode: str, load_t: float, lat, lon, start, end, ctx, derived: dict, taken: set, ignore=None,
          prefer: list | None = None, rng: random.Random | None = None) -> list:
    """Vehículos propios que cubren `load_t` en la ventana, o [] si hay que tercerizar."""
    cands = [v for v in ctx["vehicles"] if v["mode"] == mode and int(v["vehicle_id"]) not in taken
             and _can_serve(v, derived[int(v["vehicle_id"])], ctx, start, end, ignore)]
    if not cands:
        return []
    pref = set(prefer or [])

    def dist(v):
        if v.get("home_lat") is None or lat is None:
            return 9999.0
        return haversine_km(lat, lon, v["home_lat"], v["home_lon"])

    def key(v):
        return (0 if int(v["vehicle_id"]) in pref else 1, round(dist(v) / 50), v["capacity_t"], int(v["vehicle_id"]))

    fits = sorted((v for v in cands if v["capacity_t"] >= load_t), key=key)
    if fits:
        return [fits[0]]
    if mode != "terrestre":
        return []
    # carga que no cabe en un camión: se reparte entre varios, empezando por los de mayor capacidad
    picked, left = [], load_t
    for v in sorted(cands, key=lambda x: (-x["capacity_t"], dist(x), int(x["vehicle_id"]))):
        picked.append(v)
        left -= v["capacity_t"]
        if left <= 0:
            return picked if len(picked) <= MAX_OWN_UNITS else []
        if len(picked) >= MAX_OWN_UNITS:
            break
    return []


def _asset(vs: list, load_t: float) -> dict:
    codes = [v["code"] for v in vs]
    return {"id": codes[0] + (f" +{len(codes) - 1}" if len(codes) > 1 else ""),
            "type": vs[0]["vehicle_type"] if len(vs) == 1 else f"{len(vs)} × {vs[0]['vehicle_type']}",
            "units": len(vs), "carrier": "Flota propia", "own": True, "outsourced": False,
            "vehicle_ids": [int(v["vehicle_id"]) for v in vs], "plates": codes}


def _outsourced(mode: str, weight_t: float, rng: random.Random) -> dict:
    from app.engine.dispatch import _asset_for
    a = _asset_for(mode, weight_t, rng)
    third = {"terrestre": "Transportista tercero", "aereo": "Aerolínea de carga tercera",
             "fluvial": "Naviera fluvial tercera", "maritimo": "Naviera tercera", "ferreo": "Operador ferroviario tercero"}
    a.update(own=False, outsourced=True, carrier=third.get(mode, "Transportista tercero"), vehicle_ids=[], plates=[a["id"]])
    return a


def release(shipment_code: str) -> None:
    """Libera los vehículos de un envío (al borrarlo o recalcular su ruta)."""
    run_write("DELETE FROM fl_assignments WHERE shipment_code = ?", (shipment_code,))


def assign_route(shipment_code: str, route: dict, weight_t: float, departure: datetime, now: datetime | None = None) -> dict:
    """Asigna vehículos de la flota a cada tramo de `route` y los deja en leg["asset"].

    Los tramos que ya empezaron conservan su vehículo; los pendientes lo conservan si sigue
    pudiendo hacerlo y, si no, se buscan de nuevo. Devuelve cuántos tramos quedaron propios
    y cuántos terceros."""
    now = now or datetime.now()
    rng = random.Random(shipment_code)
    prior = {i: l.get("asset") for i, l in enumerate(route["legs"])}
    release(shipment_code)
    own = third = 0
    for i, leg in enumerate(route["legs"]):
        start = departure + timedelta(hours=leg["start_h"])
        end = departure + timedelta(hours=leg["end_h"])
        mode, km = leg["mode"], float(leg.get("distance_km") or 0)
        ctx = _ctx(now)  # se relee: cada tramo asignado cambia lo que está libre
        derived = {int(v["vehicle_id"]): _derive(v, ctx) for v in ctx["vehicles"] if v["mode"] == mode}
        old = prior.get(i)
        started = start <= now
        keep = None
        if old and old.get("own") and old.get("vehicle_ids"):
            by_id = {int(v["vehicle_id"]): v for v in ctx["vehicles"]}
            vs = [by_id[x] for x in old["vehicle_ids"] if x in by_id]
            if len(vs) == len(old["vehicle_ids"]) and (started or all(
                    _can_serve(v, derived[int(v["vehicle_id"])], ctx, start, end, shipment_code) for v in vs)):
                keep = vs
        elif old and old.get("outsourced") and started:
            leg["asset"] = old
            third += 1
            continue
        chosen = keep or _pick(mode, weight_t, leg.get("from", {}).get("lat"), leg.get("from", {}).get("lon"),
                               start, end, ctx, derived, set(), shipment_code, rng=rng)
        if chosen:
            leg["asset"] = _asset(chosen, weight_t)
            if keep and old and old.get("pinned"):
                leg["asset"]["pinned"] = True  # la elección manual sobrevive al recálculo de la ruta
            total_cap = sum(v["capacity_t"] for v in chosen)
            for v in chosen:
                share = weight_t * v["capacity_t"] / total_cap if total_cap else weight_t
                run_write("""INSERT INTO fl_assignments (vehicle_id, shipment_code, leg_index, start_at, end_at, km, load_t)
                             VALUES (?,?,?,?,?,?,?)""",
                          (int(v["vehicle_id"]), shipment_code, i, _iso(start), _iso(end), km / len(chosen), round(share, 3)))
            own += 1
        else:
            leg["asset"] = _outsourced(mode, weight_t, rng)
            third += 1
    return {"own": own, "outsourced": third}


def assign_shipment_row(sh: dict, now: datetime | None = None) -> dict:
    """Como assign_route, sobre un envío ya armado (dict con route_json). Actualiza route_json."""
    route = json.loads(sh["route_json"])
    res = assign_route(sh["shipment_code"], route, float(sh["weight_t"]), _dt(sh["departure_at"]), now)
    sh["route_json"] = json.dumps({k: route[k] for k in ("legs", "transfers", "timeline")})
    return res


def carry_pins(shipment_code: str, route: dict, weight_t: float) -> None:
    """Al recalcular la ruta de un envío (edición, cierre de vía), conserva el vehículo que alguien
    eligió a mano en los tramos que siguen siendo los mismos (modo, origen y destino) y cuya
    capacidad aún cubre la carga. `assign_route` lo valida contra el horario antes de mantenerlo."""
    old = run_query("SELECT route_json FROM mm_shipments WHERE shipment_code = ?", (shipment_code,))
    if old.empty:
        return
    try:
        old_legs = json.loads(old.iloc[0]["route_json"])["legs"]
    except (ValueError, KeyError, TypeError):
        return
    for i, leg in enumerate(route["legs"]):
        if i >= len(old_legs) or leg.get("asset"):
            continue
        prev = old_legs[i]
        a = prev.get("asset") or {}
        if not (a.get("pinned") and a.get("own") and a.get("vehicle_ids")):
            continue
        same = lambda l: (l["mode"], l["from"]["name"], l["to"]["name"])  # noqa: E731
        if same(prev) != same(leg):
            continue
        ids = [int(x) for x in a["vehicle_ids"]]
        cap = run_query(f"SELECT SUM(capacity_t) AS c FROM fl_vehicles WHERE vehicle_id IN ({','.join('?' * len(ids))})", tuple(ids))
        if cap.empty or float(cap.iloc[0]["c"] or 0) + 1e-9 < weight_t:
            continue
        leg["asset"] = a


def _leg_context(shipment_code: str, leg_index: int) -> tuple:
    ship = run_query("SELECT * FROM mm_shipments WHERE shipment_code = ?", (shipment_code,))
    if ship.empty:
        raise OperationError(f"El envío {shipment_code} no existe")
    sh = records(ship)[0]
    route = json.loads(sh["route_json"])
    if not 0 <= leg_index < len(route["legs"]):
        raise OperationError(f"El envío {shipment_code} no tiene el tramo {leg_index + 1}")
    leg = route["legs"][leg_index]
    dep = _dt(sh["departure_at"])
    return sh, route, leg, dep + timedelta(hours=leg["start_h"]), dep + timedelta(hours=leg["end_h"])


def _why_not(d: dict, v: dict | None = None, end: datetime | None = None) -> str:
    if d["blockers"]:
        return d["blockers"][0]
    if v is not None and end is not None and not _doc_valid_through(v, end):
        return "El SOAT o la técnico-mecánica vencen antes de terminar el tramo"
    return "Ya tiene otro tramo en ese horario"


def leg_vehicle_options(shipment_code: str, leg_index: int, now: datetime) -> dict:
    """Vehículos propios del modo del tramo, con si pueden cubrirlo en su horario y por qué no."""
    sh, route, leg, start, end = _leg_context(shipment_code, leg_index)
    load = float(sh["weight_t"])
    asset = leg.get("asset") or {}
    selected = {int(x) for x in asset.get("vehicle_ids", [])}
    lat, lon = leg.get("from", {}).get("lat"), leg.get("from", {}).get("lon")
    ctx = _ctx(now)
    items = []
    for v in ctx["vehicles"]:
        if v["mode"] != leg["mode"] or v["retired"]:
            continue
        d = _derive(v, ctx)
        ok = _can_serve(v, d, ctx, start, end, shipment_code)
        near = (round(haversine_km(lat, lon, v["home_lat"], v["home_lon"]))
                if lat is not None and v.get("home_lat") is not None else None)
        items.append({"id": int(v["vehicle_id"]), "code": v["code"], "vehicle_type": v["vehicle_type"],
                      "capacity_t": v["capacity_t"], "status": d["status"], "home_name": v.get("home_name"),
                      "distance_km": near, "available": ok, "fits": v["capacity_t"] >= load,
                      "reason": None if ok else _why_not(d, v, end), "selected": int(v["vehicle_id"]) in selected})
    items.sort(key=lambda x: (not x["selected"], not x["available"], not x["fits"],
                              x["distance_km"] if x["distance_km"] is not None else 1e9, x["code"]))
    return {"shipment_code": shipment_code, "leg_index": leg_index, "mode": leg["mode"], "load_t": load,
            "start_at": _iso(start), "end_at": _iso(end), "locked": start <= now,
            "pinned": bool(asset.get("pinned")), "multi_allowed": leg["mode"] == "terrestre",
            "max_units": MAX_OWN_UNITS if leg["mode"] == "terrestre" else 1, "items": items}


def set_leg_vehicle(shipment_code: str, leg_index: int, vehicle_ids: list | None, user: str | None,
                    now: datetime) -> dict:
    """Fija a mano los vehículos de un tramo. Con `vehicle_ids` vacío el tramo vuelve a automático.

    Solo tramos que aún no salen. Cada vehículo debe ser del modo del tramo y estar libre y operable
    en su horario, y entre todos deben cubrir la carga (por carretera hasta 4; en los demás modos, uno)."""
    sh, route, leg, start, end = _leg_context(shipment_code, leg_index)
    if start <= now:
        raise OperationError("Ese tramo ya salió: no se puede cambiar su vehículo")
    weight = float(sh["weight_t"])
    before = (leg.get("asset") or {}).get("plates") or []
    ids: list = []
    for x in vehicle_ids or []:
        try:
            i = int(x)
        except (TypeError, ValueError):
            raise OperationError("Vehículo no válido")
        if i not in ids:
            ids.append(i)

    def save(note: str) -> None:
        run_write("UPDATE mm_shipments SET route_json = ?, updated_at = ?, updated_by = ? WHERE shipment_code = ?",
                  (json.dumps({k: route[k] for k in ("legs", "transfers", "timeline")}), _now_iso(), _user(user),
                   shipment_code))
        audit(user, "UPDATE", "mm_shipments", shipment_code, note)

    if not ids:
        leg.pop("asset", None)
        assign_route(shipment_code, route, weight, _dt(sh["departure_at"]), now)
        after = (route["legs"][leg_index].get("asset") or {}).get("plates") or []
        save(f"Tramo {leg_index + 1}: vehículo vuelve a asignación automática ({', '.join(before) or '—'} → {', '.join(after) or '—'})")
        return route["legs"][leg_index]["asset"]

    if len(ids) > (MAX_OWN_UNITS if leg["mode"] == "terrestre" else 1):
        raise OperationError("Por carretera se reparten hasta %d vehículos; en los demás modos, uno" % MAX_OWN_UNITS)
    ctx = _ctx(now)
    by_id = {int(v["vehicle_id"]): v for v in ctx["vehicles"]}
    chosen = []
    for i in ids:
        v = by_id.get(i)
        if v is None:
            raise OperationError("El vehículo elegido no está en la flota")
        if v["mode"] != leg["mode"]:
            raise OperationError(f"{v['code']} no es de modo {MODE_LABELS[leg['mode']].lower()}")
        d = _derive(v, ctx)
        if not _can_serve(v, d, ctx, start, end, shipment_code):
            raise OperationError(f"{v['code']} no puede cubrir ese tramo: {_why_not(d, v, end)}")
        chosen.append(v)
    cap = sum(v["capacity_t"] for v in chosen)
    if cap + 1e-9 < weight:
        raise OperationError(f"La capacidad ({cap:g} t) no alcanza para la carga ({weight:g} t)")

    release_rows = run_query("SELECT 1 FROM fl_assignments WHERE shipment_code = ? AND leg_index = ?",
                             (shipment_code, leg_index))
    if not release_rows.empty:
        run_write("DELETE FROM fl_assignments WHERE shipment_code = ? AND leg_index = ?", (shipment_code, leg_index))
    km = float(leg.get("distance_km") or 0)
    for v in chosen:
        share = weight * v["capacity_t"] / cap if cap else weight
        run_write("""INSERT INTO fl_assignments (vehicle_id, shipment_code, leg_index, start_at, end_at, km, load_t)
                     VALUES (?,?,?,?,?,?,?)""",
                  (int(v["vehicle_id"]), shipment_code, leg_index, _iso(start), _iso(end), km / len(chosen), round(share, 3)))
    leg["asset"] = _asset(chosen, weight)
    leg["asset"]["pinned"] = True
    save(f"Tramo {leg_index + 1}: vehículo asignado a mano ({', '.join(before) or '—'} → {', '.join(v['code'] for v in chosen)})")
    return leg["asset"]


def replace_assignments(vehicle_id: int, now: datetime, window: tuple | None = None, reason: str = "",
                        user: str | None = None, ends_after: datetime | None = None) -> dict:
    """Saca a un vehículo de sus tramos pendientes (los que no han terminado, o los que caen
    en `window`) y pone otro de su modo; si no hay, el tramo se terceriza. Deja nota en el envío."""
    rows = records(run_query("SELECT * FROM fl_assignments WHERE vehicle_id = ? AND end_at > ? ORDER BY start_at",
                             (vehicle_id, _iso(now))))
    replaced, outsourced = [], []
    veh = _vehicle_row(vehicle_id)
    for a in rows:
        s, e = _dt(a["start_at"]), _dt(a["end_at"])
        if window and not _overlap(s, e, window[0], window[1]):
            continue
        if ends_after and e <= ends_after:
            continue  # ese tramo termina antes del vencimiento: se queda
        ship = run_query("SELECT * FROM mm_shipments WHERE shipment_code = ?", (a["shipment_code"],))
        if ship.empty:
            run_write("DELETE FROM fl_assignments WHERE assign_id = ?", (a["assign_id"],))
            continue
        sh = records(ship)[0]
        route = json.loads(sh["route_json"])
        leg = route["legs"][a["leg_index"]] if a["leg_index"] < len(route["legs"]) else None
        if leg is None:
            run_write("DELETE FROM fl_assignments WHERE assign_id = ?", (a["assign_id"],))
            continue
        ctx = _ctx(now)
        derived = {int(v["vehicle_id"]): _derive(v, ctx) for v in ctx["vehicles"] if v["mode"] == veh["mode"]}
        used_in_leg = {int(x) for x in (leg.get("asset") or {}).get("vehicle_ids", [])}
        used_in_leg.discard(vehicle_id)
        pick = _pick(veh["mode"], a["load_t"], leg.get("from", {}).get("lat"), leg.get("from", {}).get("lon"),
                     s, e, ctx, derived, used_in_leg | {vehicle_id}, a["shipment_code"])
        asset = dict(leg.get("asset") or {})
        ids = [x for x in asset.get("vehicle_ids", []) if x != vehicle_id]
        plates = [p for p in asset.get("plates", []) if p != veh["code"]]
        if pick and pick[0]["capacity_t"] >= a["load_t"] * 0.999:
            new = pick[0]
            ids.append(int(new["vehicle_id"]))
            plates.append(new["code"])
            run_write("UPDATE fl_assignments SET vehicle_id = ? WHERE assign_id = ?", (int(new["vehicle_id"]), a["assign_id"]))
            note = f"Vehículo {veh['code']} sustituido por {new['code']} ({reason})"
            replaced.append({"shipment_code": a["shipment_code"], "from": veh["code"], "to": new["code"]})
        else:
            third = _outsourced(veh["mode"], a["load_t"], random.Random(a["shipment_code"] + veh["code"]))
            plates.append(third["id"])
            run_write("DELETE FROM fl_assignments WHERE assign_id = ?", (a["assign_id"],))
            note = f"Sin vehículo propio libre para reemplazar a {veh['code']} ({reason}): tramo con transportista tercero"
            outsourced.append({"shipment_code": a["shipment_code"], "from": veh["code"]})
            asset["outsourced_units"] = int(asset.get("outsourced_units", 0)) + 1
        asset.update(vehicle_ids=ids, plates=plates, units=max(len(plates), 1),
                     own=bool(ids), outsourced=len(ids) < len(plates))
        asset.pop("pinned", None)  # el vehículo elegido a mano ya no puede: vuelve a ser automático
        if plates:
            asset["id"] = plates[0] + (f" +{len(plates) - 1}" if len(plates) > 1 else "")
        if len(ids) == 0:
            asset["carrier"] = _outsourced(veh["mode"], 1, random.Random(0))["carrier"]
        leg["asset"] = asset
        prev = sh.get("route_note")
        run_write("UPDATE mm_shipments SET route_json = ?, route_note = ?, updated_at = ?, updated_by = ? WHERE shipment_code = ?",
                  (json.dumps({k: route[k] for k in ("legs", "transfers", "timeline")}),
                   note if not prev or "Vehículo" in str(prev) or "vehículo" in str(prev) else f"{prev} · {note}",
                   _now_iso(), _user(user), a["shipment_code"]))
        audit(user, "UPDATE", "mm_shipments", a["shipment_code"], note)
    return {"replaced": replaced, "outsourced": outsourced}


def adopt_existing(now: datetime) -> int:
    """Una vez, en bases que ya tenían envíos: pasa los envíos no entregados a la flota real."""
    from app.engine.dispatch import status_at
    done = 0
    for s in records(run_query("SELECT * FROM mm_shipments WHERE status != 'Entregado'")):
        if status_at(s, now)["status"] == "Entregado":
            continue
        route = json.loads(s["route_json"])
        if all((l.get("asset") or {}).get("own") is not None for l in route["legs"]):
            continue  # ya tiene vehículos de la flota (o terceros) asignados
        for l in route["legs"]:
            l.pop("asset", None)
        assign_route(s["shipment_code"], route, float(s["weight_t"]), _dt(s["departure_at"]), now)
        run_write("UPDATE mm_shipments SET route_json = ? WHERE shipment_code = ?",
                  (json.dumps({k: route[k] for k in ("legs", "transfers", "timeline")}), s["shipment_code"]))
        done += 1
    return done


# ---------------------------------------------------------------------------
# Siembra
# ---------------------------------------------------------------------------
def _plate(rng: random.Random, taken: set) -> str:
    letters = "ABCDEFGHJKLMNPRSTUVWXYZ"
    while True:
        p = rng.choice("STWXUQKGN") + rng.choice(letters) + rng.choice(letters) + f"-{rng.randint(100, 999)}"
        if p not in taken:
            taken.add(p)
            return p


def seed_fleet(now: datetime) -> int:
    """Crea la flota, los conductores y su historial de mantenimiento y fallas. Solo si no hay vehículos."""
    if not run_query("SELECT 1 FROM fl_vehicles LIMIT 1").empty:
        return 0
    rng = random.Random(2610)
    wh = {r["code"]: int(r["warehouse_id"]) for r in records(run_query("SELECT warehouse_id, code FROM wh_warehouses"))}
    plates: set = set()

    names = list(DRIVER_NAMES)
    drivers: list = []
    for i, name in enumerate(names):
        cat = ("C3" if i % 3 == 0 else "C2" if i % 3 == 1 else "B2")
        days = rng.randint(90, 1100)
        if i == 5:
            days = 11           # por vencer
        if i == 19:
            days = 24           # por vencer
        if i == 33:
            days = -12          # vencida: su vehículo queda inhabilitado
        drivers.append(run_write("INSERT INTO fl_drivers (name, license_cat, license_expiry, status, created_at) VALUES (?,?,?,?,?)",
                                 (name, cat, (now + timedelta(days=days)).date().isoformat(), "Activo", _now_iso())))
    next_driver = iter(drivers)

    made: dict = {}   # (tipo, k) -> vehicle_id
    created: list = []
    nave_i = 0
    for vtype, mode, count, homes, prefix in SEED_FLEET:
        cap_t, cap_m3, days, km, makes = CATALOG[mode][vtype]
        for k in range(count):
            make, model = makes[k % len(makes)]
            if mode == "terrestre":
                code = _plate(rng, plates)
                year, odo = rng.randint(2014, 2024), rng.uniform(40, 520) * 1000
            elif mode == "aereo":
                code = f"HK-{rng.randint(4000, 5999)}"
                year, odo = rng.randint(2004, 2016), rng.uniform(2.5, 8.5) * 1e6
            elif mode == "fluvial":
                code = f"{prefix}{k + 1:02d}"
                year, odo = rng.randint(2008, 2020), rng.uniform(80, 420) * 1000
            elif mode == "maritimo":
                code = f"{prefix}{NAVES[nave_i % len(NAVES)]}"
                nave_i += 1
                year, odo = rng.randint(2006, 2018), rng.uniform(0.8, 2.6) * 1e6
            else:
                code = f"{prefix}{rng.randint(10, 60)}"
                year, odo = rng.randint(2010, 2020), rng.uniform(0.4, 1.8) * 1e6
            code = code if run_query("SELECT 1 FROM fl_vehicles WHERE code = ?", (code,)).empty else f"{code}-{k}"
            last_days = rng.randint(5, max(int(days * 0.75), 6))
            last_km = odo - rng.uniform(0.05, 0.75) * km
            driver = next(next_driver, None) if mode == "terrestre" else None
            vid = run_write("""INSERT INTO fl_vehicles (code, mode, vehicle_type, make, model, year, capacity_t, capacity_m3,
                               home_warehouse_id, driver_id, odometer_base_km, last_service_at, last_service_km,
                               service_interval_days, service_interval_km, source, created_at)
                               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                            (code, mode, vtype, make, model, year, cap_t, cap_m3, wh.get(homes[k % len(homes)]), driver,
                             round(odo), (now - timedelta(days=last_days)).date().isoformat(), round(last_km), days, km,
                             "semilla", _now_iso()))
            made[(vtype, k)] = vid
            created.append((vid, mode, vtype, days, km, last_days, odo, last_km))
    _seed_service_state(created, made, now, rng)
    from app.database.schema_v12 import seed_dates
    for vid, mode, *_ in created:
        if mode == "terrestre":
            soat, rtm = seed_dates(_vehicle_row(vid)["code"], now.date())
            run_write("UPDATE fl_vehicles SET soat_expiry = ?, rtm_expiry = ? WHERE vehicle_id = ?", (soat, rtm, vid))
    return len(created)


def _seed_service_state(created: list, made: dict, now: datetime, rng: random.Random) -> None:
    """Historial de mantenimientos, algunos próximos o vencidos, unos programados y unas fallas abiertas."""
    # algunos vencidos y otros por vencer, a propósito
    overdue = [made[("Turbo", 3)], made[("Furgón de reparto", 4)]]
    near = [made[("Tractomula 3S3", 4)], made[("Tractomula 3S3", 9)], made[("Dobletroque", 2)], made[("Camión sencillo", 1)],
            made[("Camión refrigerado", 1)], made[("Carguero B737-800BCF", 0)], made[("Convoy de barcazas", 1)]]
    for vid, mode, vtype, days, km, last_days, odo, last_km in created:
        d_last = last_days
        l_km = last_km
        if vid in overdue:
            d_last = days + rng.randint(14, 40)
        elif vid in near:
            d_last = days - rng.randint(3, 12)
        if d_last != last_days:
            run_write("UPDATE fl_vehicles SET last_service_at = ? WHERE vehicle_id = ?",
                      ((now - timedelta(days=d_last)).date().isoformat(), vid))
        shop = rng.choice(WORKSHOPS[mode])
        run_write("""INSERT INTO fl_maintenance (vehicle_id, kind, status, scheduled_start, scheduled_end, workshop, est_cost_usd,
                     cost_usd, odometer_km, notes, completed_at, created_at, created_by)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                  (vid, "Preventivo", "Completado", _iso(now - timedelta(days=d_last, hours=8)),
                   _iso(now - timedelta(days=d_last)), shop, 0, round(rng.uniform(180, 900) * (30 if mode in ("aereo", "maritimo") else 1)),
                   round(l_km), "Servicio preventivo según plan del fabricante.", _iso(now - timedelta(days=d_last)),
                   _now_iso(), "semilla"))
        if rng.random() < 0.45:
            older = d_last + days + rng.randint(-8, 8)
            run_write("""INSERT INTO fl_maintenance (vehicle_id, kind, status, scheduled_start, scheduled_end, workshop, est_cost_usd,
                         cost_usd, odometer_km, notes, completed_at, created_at, created_by)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                      (vid, "Preventivo", "Completado", _iso(now - timedelta(days=older, hours=8)),
                       _iso(now - timedelta(days=older)), rng.choice(WORKSHOPS[mode]), 0,
                       round(rng.uniform(160, 800) * (30 if mode in ("aereo", "maritimo") else 1)), max(round(l_km - km), 0),
                       "Servicio preventivo.", _iso(now - timedelta(days=older)), _now_iso(), "semilla"))

    def sched(vid, kind, start_h, dur_h, status="Programado", shop=None, est=420):
        mode = run_query("SELECT mode FROM fl_vehicles WHERE vehicle_id = ?", (vid,)).iloc[0]["mode"]
        s = now + timedelta(hours=start_h)
        return run_write("""INSERT INTO fl_maintenance (vehicle_id, kind, status, scheduled_start, scheduled_end, workshop,
                            est_cost_usd, created_at, created_by) VALUES (?,?,?,?,?,?,?,?,?)""",
                         (vid, kind, status, _iso(s), _iso(s + timedelta(hours=dur_h)), shop or rng.choice(WORKSHOPS[mode]),
                          est, _now_iso(), "semilla"))

    sched(near[0], "Preventivo", 52, 10)
    sched(near[2], "Preventivo", 96, 8)
    sched(near[5], "Inspección", 150, 20, est=3800)
    sched(near[6], "Preventivo", 200, 36, est=2600)
    sched(made[("Camión refrigerado", 3)], "Inspección", 30, 6, est=260)
    # uno en el taller ahora mismo, por una falla
    van = made[("Furgón de reparto", 1)]
    fid = run_write("""INSERT INTO fl_faults (vehicle_id, severity, category, description, blocks_operation, status, reported_at,
                       reported_by) VALUES (?,?,?,?,?,?,?,?)""",
                    (van, "Moderada", "Llantas", "Desgaste irregular en las llantas del eje delantero; vibra por encima de 70 km/h.",
                     1, "En reparación", _iso(now - timedelta(hours=20)), "semilla"))
    mid = sched(van, "Correctivo", -6, 14, status="En curso", shop="Taller Propio - Funza", est=540)
    run_write("UPDATE fl_maintenance SET fault_id = ? WHERE maint_id = ?", (fid, mid))
    # fallas abiertas
    run_write("""INSERT INTO fl_faults (vehicle_id, severity, category, description, blocks_operation, status, reported_at, reported_by)
                 VALUES (?,?,?,?,?,?,?,?)""",
              (made[("Tractomula 3S3", 6)], "Crítica", "Frenos", "Pérdida de presión en el circuito neumático al frenar en bajada.",
               1, "Abierta", _iso(now - timedelta(hours=7)), "semilla"))
    run_write("""INSERT INTO fl_faults (vehicle_id, severity, category, description, blocks_operation, status, reported_at, reported_by)
                 VALUES (?,?,?,?,?,?,?,?)""",
              (made[("Carguero B737-800BCF", 1)], "Moderada", "Hidráulico",
               "Alerta intermitente en el sensor de presión del sistema hidráulico B.", 1, "Abierta",
               _iso(now - timedelta(hours=30)), "semilla"))
    run_write("""INSERT INTO fl_faults (vehicle_id, severity, category, description, blocks_operation, status, reported_at, reported_by)
                 VALUES (?,?,?,?,?,?,?,?)""",
              (made[("Dobletroque", 0)], "Leve", "Iluminación", "Farola trasera derecha intermitente; no impide operar.",
               0, "Abierta", _iso(now - timedelta(days=3)), "semilla"))
    # historial resuelto
    past = [(("Tractomula 3S3", 2), "Moderada", "Motor", "Recalentamiento por termostato pegado.", 12, "Cambio de termostato y purga del sistema.", 380),
            (("Turbo", 0), "Leve", "Carrocería", "Puerta lateral con cierre defectuoso.", 25, "Ajuste de bisagras y cerradura.", 70),
            (("Camión refrigerado", 0), "Moderada", "Refrigeración", "El equipo de frío no sostenía 4 °C.", 18, "Recarga de gas y cambio de sensor.", 460),
            (("Buque de cabotaje", 0), "Moderada", "Casco y estructura", "Corrosión localizada en bodega 2.", 50, "Soldadura y pintura en dique.", 5200),
            (("Furgón de reparto", 2), "Leve", "Eléctrico", "Falla del cargador del tablero.", 9, "Cambio de cargador.", 40),
            (("Tren de carga", 1), "Moderada", "Suspensión", "Desgaste de balero en el vagón 37.", 33, "Reemplazo de bogie.", 3100)]
    for (key, sev, cat, desc, ago, sol, cost) in past:
        vid = made[key]
        run_write("""INSERT INTO fl_faults (vehicle_id, severity, category, description, blocks_operation, status, reported_at,
                     reported_by, resolved_at, resolution, repair_cost_usd) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                  (vid, sev, cat, desc, 0 if sev == "Leve" else 1, "Resuelta", _iso(now - timedelta(days=ago + 2)), "semilla",
                   _iso(now - timedelta(days=ago)), sol, cost))
