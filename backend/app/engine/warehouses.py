"""
warehouses.py
Bodegas de Westvane: varias por ciudad, cada una con un rol, su inventario, el
historial de movimientos y los traslados entre bodegas.

Reglas
------
- La ocupación se calcula (Σ cantidad × volumen) y nunca se guarda.
- Una entrada no puede superar la capacidad en m³ de la bodega.
- Una salida o merma no puede dejar el inventario en negativo.
- Un traslado entre ciudades crea un envío por la red multimodal con la ruta
  óptima; el inventario sale de la bodega de origen al crearlo y entra en la de
  destino cuando el envío llega (`settle_transfers`, que corre con cada
  sincronización). Si el envío se borra, el inventario vuelve al origen.
- Un traslado dentro de la misma ciudad se recibe al instante.
- Una bodega no se puede borrar si tiene inventario, vehículos alojados o
  traslados en tránsito.
"""
from __future__ import annotations

import math
import random
from datetime import datetime, timedelta

from app.data.colombia_bodegas import BODEGAS, MANAGERS, ROLES, STOCK_PROFILES
from app.database.db import run_query, run_write
from app.engine.common import OperationError, _now_iso, _user, audit, records
from app.engine.multimodal import haversine_km

STATUSES = ("Operativa", "Mantenimiento", "Cerrada")
MOVE_KINDS = ("Entrada", "Salida", "Ajuste", "Merma")
OCCUPANCY_ALERT = 90.0  # % desde el que se avisa


def _f(v, name: str, lo: float | None = None, hi: float | None = None) -> float:
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


def _text(v, name: str, required: bool = True, max_len: int = 120) -> str | None:
    s = (v or "").strip() if isinstance(v, str) or v is None else str(v).strip()
    if required and not s:
        raise OperationError(f"{name} es obligatorio.")
    if len(s) > max_len:
        raise OperationError(f"{name} es demasiado largo (máximo {max_len} caracteres).")
    return s or None


# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------
def roles() -> list:
    return [{"key": k, "label": v[0], "description": v[1], "stores": v[2]} for k, v in ROLES.items()]


def _stock_state(r: dict) -> str:
    if r["qty"] < r["min_qty"]:
        return "Bajo"
    if r["max_qty"] > 0 and r["qty"] > r["max_qty"]:
        return "Exceso"
    return "Normal"


def _used_m3(rows: list) -> float:
    return sum(r["qty"] * r["volume_m3"] for r in rows)


def _incoming_m3(warehouse_id: int) -> float:
    """Volumen de traslados en tránsito que van hacia la bodega (ya reservado)."""
    df = run_query("""SELECT t.qty, s.volume_m3 FROM wh_transfers t
                      JOIN wh_stock s ON s.warehouse_id = t.from_wh AND s.sku = t.sku
                      WHERE t.to_wh = ? AND t.status = 'En tránsito'""", (warehouse_id,))
    return float((df["qty"] * df["volume_m3"]).sum()) if not df.empty else 0.0


def _decorate(w: dict, stock: list, vehicles: int, in_transit: int) -> dict:
    used = _used_m3(stock)
    cap = w["capacity_m3"] or 1.0
    low = [s for s in stock if _stock_state(s) == "Bajo"]
    over = [s for s in stock if _stock_state(s) == "Exceso"]
    occ = 100 * used / cap
    alerts = []
    if w["status"] != "Operativa":
        alerts.append(f"Bodega {w['status'].lower()}")
    if occ >= OCCUPANCY_ALERT:
        alerts.append(f"Ocupación al {occ:.0f} %")
    if low:
        alerts.append(f"{len(low)} {'producto' if len(low) == 1 else 'productos'} bajo el mínimo")
    if over:
        alerts.append(f"{len(over)} {'producto' if len(over) == 1 else 'productos'} en exceso")
    role = ROLES.get(w["role"], (w["role"], "", ""))
    return {
        **w,
        "role_label": role[0], "role_description": role[1], "stores": role[2],
        "temp_controlled": bool(w["temp_controlled"]), "hazmat": bool(w["hazmat"]), "bonded": bool(w["bonded"]),
        "used_m3": round(used, 1), "occupancy_pct": round(occ, 1),
        "free_m3": round(max(cap - used, 0), 1),
        "stock_lines": len(stock), "low_stock": len(low), "over_stock": len(over),
        "vehicles": vehicles, "in_transit": in_transit, "alerts": alerts,
    }


def _all_stock() -> dict:
    df = run_query("SELECT * FROM wh_stock")
    out: dict = {}
    for r in records(df):
        out.setdefault(r["warehouse_id"], []).append(r)
    return out


def _vehicle_counts() -> dict:
    df = run_query("SELECT home_warehouse_id w, COUNT(*) c FROM fl_vehicles "
                   "WHERE retired = 0 AND home_warehouse_id IS NOT NULL GROUP BY home_warehouse_id")
    return {int(r["w"]): int(r["c"]) for r in records(df)}


def _transit_counts() -> dict:
    df = run_query("SELECT from_wh, to_wh FROM wh_transfers WHERE status = 'En tránsito'")
    out: dict = {}
    for r in records(df):
        for k in ("from_wh", "to_wh"):
            out[int(r[k])] = out.get(int(r[k]), 0) + 1
    return out


def list_warehouses() -> list:
    ws = records(run_query("SELECT * FROM wh_warehouses ORDER BY city, role, name"))
    stock, veh, tr = _all_stock(), _vehicle_counts(), _transit_counts()
    return [_decorate(w, stock.get(w["warehouse_id"], []), veh.get(w["warehouse_id"], 0),
                      tr.get(w["warehouse_id"], 0)) for w in ws]


def _get_row(warehouse_id: int) -> dict:
    df = run_query("SELECT * FROM wh_warehouses WHERE warehouse_id = ?", (warehouse_id,))
    if df.empty:
        raise OperationError("La bodega no existe.")
    return records(df)[0]


def get_warehouse(warehouse_id: int, now: datetime) -> dict:
    from app.engine import fleet  # evita el ciclo flota <-> bodegas
    w = _get_row(warehouse_id)
    stock = records(run_query("SELECT * FROM wh_stock WHERE warehouse_id = ? ORDER BY category, name",
                      (warehouse_id,)))
    for s in stock:
        s["state"] = _stock_state(s)
        s["volume_total_m3"] = round(s["qty"] * s["volume_m3"], 2)
        s["value_usd"] = round(s["qty"] * s["unit_cost_usd"], 2)
    moves = records(run_query("SELECT * FROM wh_movements WHERE warehouse_id = ? ORDER BY move_id DESC LIMIT 80",
                      (warehouse_id,)))
    transfers = records(run_query("""SELECT t.*, a.name from_name, a.city from_city, b.name to_name, b.city to_city
                             FROM wh_transfers t JOIN wh_warehouses a ON a.warehouse_id = t.from_wh
                             JOIN wh_warehouses b ON b.warehouse_id = t.to_wh
                             WHERE t.from_wh = ? OR t.to_wh = ? ORDER BY t.transfer_id DESC LIMIT 40""",
                          (warehouse_id, warehouse_id)))
    vehicles = fleet.list_vehicles(now, warehouse_id=warehouse_id)
    out = _decorate(w, stock, len(vehicles), sum(1 for t in transfers if t["status"] == "En tránsito"))
    out.update(stock=stock, movements=moves, transfers=transfers, vehicles_list=vehicles)
    out["value_usd"] = round(sum(s["value_usd"] for s in stock), 2)
    return out


def summary() -> dict:
    ws = list_warehouses()
    cap = sum(w["capacity_m3"] for w in ws) or 1.0
    used = sum(w["used_m3"] for w in ws)
    by_role: dict = {}
    for w in ws:
        r = by_role.setdefault(w["role"], {"role": w["role"], "label": w["role_label"], "count": 0,
                                           "capacity_m3": 0.0, "used_m3": 0.0})
        r["count"] += 1
        r["capacity_m3"] += w["capacity_m3"]
        r["used_m3"] += w["used_m3"]
    for r in by_role.values():
        r["occupancy_pct"] = round(100 * r["used_m3"] / (r["capacity_m3"] or 1), 1)
    cities: dict = {}
    for w in ws:
        cities[w["city"]] = cities.get(w["city"], 0) + 1
    return {
        "warehouses": len(ws), "cities": len(cities),
        "operating": sum(1 for w in ws if w["status"] == "Operativa"),
        "capacity_m3": round(cap), "used_m3": round(used), "occupancy_pct": round(100 * used / cap, 1),
        "low_stock_lines": sum(w["low_stock"] for w in ws),
        "over_stock_lines": sum(w["over_stock"] for w in ws),
        "full_warehouses": [w["code"] for w in ws if w["occupancy_pct"] >= OCCUPANCY_ALERT],
        "in_transit": int(run_query("SELECT COUNT(*) c FROM wh_transfers WHERE status = 'En tránsito'").iloc[0]["c"]),
        "by_role": sorted(by_role.values(), key=lambda r: -r["count"]),
        "network": spokes(ws),
    }


def spokes(ws: list | None = None) -> list:
    """Cada bodega con su "centro padre": así se ve cómo fluye la carga (hub-and-spoke).
    Centro nacional: sin padre. Regional: el centro nacional más cercano. El resto: el centro
    (nacional o regional) de su ciudad, o el más cercano."""
    ws = ws if ws is not None else list_warehouses()
    hubs = [w for w in ws if w["role"] == "hub"]
    centers = [w for w in ws if w["role"] in ("hub", "regional")]

    def nearest(w, pool):
        pool = [p for p in pool if p["warehouse_id"] != w["warehouse_id"]]
        if not pool or w.get("latitude") is None:
            return None
        return min(pool, key=lambda p: haversine_km(w["latitude"], w["longitude"], p["latitude"], p["longitude"]))

    out = []
    for w in ws:
        parent = None
        if w["role"] == "regional":
            parent = nearest(w, hubs)
        elif w["role"] != "hub":
            same = [c for c in centers if c["city"] == w["city"] and c["warehouse_id"] != w["warehouse_id"]]
            parent = (min(same, key=lambda c: 0 if c["role"] == "hub" else 1) if same else nearest(w, centers))
        out.append({"id": w["warehouse_id"], "code": w["code"], "name": w["name"], "city": w["city"],
                    "role": w["role"], "lat": w["latitude"], "lon": w["longitude"],
                    "parent": parent["code"] if parent else None})
    return out


# ---------------------------------------------------------------------------
# Altas, cambios y bajas de bodegas
# ---------------------------------------------------------------------------
def _validate_warehouse(data: dict, existing: dict | None = None) -> dict:
    d = {**(existing or {}), **{k: v for k, v in data.items() if v is not None}}
    out = {
        "name": _text(d.get("name"), "El nombre", max_len=80),
        "city": _text(d.get("city"), "La ciudad", max_len=60),
        "role": d.get("role"),
        "capacity_m3": _f(d.get("capacity_m3"), "La capacidad (m³)", 50, 500000),
        "capacity_pallets": int(_f(d.get("capacity_pallets") or 0, "Los pallets", 0, 500000)),
        "docks": int(_f(d.get("docks") if d.get("docks") not in (None, "") else 1, "Los muelles", 0, 200)),
        "manager": _text(d.get("manager"), "El responsable", required=False, max_len=60),
        "shift": _text(d.get("shift"), "El horario", required=False, max_len=40),
        "status": d.get("status") or "Operativa",
        "strategic_reason": _text(d.get("strategic_reason"), "La razón estratégica", required=False, max_len=300),
        "temp_controlled": 1 if d.get("temp_controlled") else 0,
        "hazmat": 1 if d.get("hazmat") else 0,
        "bonded": 1 if d.get("bonded") else 0,
        "node_code": _text(d.get("node_code"), "El nodo", required=False, max_len=30),
        "latitude": None if d.get("latitude") in (None, "") else _f(d.get("latitude"), "La latitud", -5, 14),
        "longitude": None if d.get("longitude") in (None, "") else _f(d.get("longitude"), "La longitud", -82, -66),
    }
    if out["role"] not in ROLES:
        raise OperationError("El rol de la bodega no es válido.")
    if out["status"] not in STATUSES:
        raise OperationError("El estado de la bodega no es válido.")
    if out["role"] == "frio":
        out["temp_controlled"] = 1
    if out["role"] == "peligrosos":
        out["hazmat"] = 1
    if out["role"] in ("aduanera", "frontera"):
        out["bonded"] = 1
    return out


def _resolve_node(net, city: str, node_code: str | None) -> tuple:
    """Nodo de la red de esa ciudad y sus coordenadas, para ubicar la bodega en el mapa."""
    if net is None:
        return node_code, None, None
    if node_code and node_code in net.nodes:
        n = net.nodes[node_code]
        return node_code, n["latitude"], n["longitude"]
    codes = net.cities.get(city) or []
    if not codes:
        raise OperationError(f"La ciudad '{city}' no está en la red: elige una ciudad que tenga nodo.")
    rank = ["cedi", "ciudad", "aeropuerto", "puerto_maritimo", "puerto_fluvial", "terminal_ferrea"]
    code = sorted(codes, key=lambda c: rank.index(net.nodes[c]["kind"]) if net.nodes[c]["kind"] in rank else 9)[0]
    return code, net.nodes[code]["latitude"], net.nodes[code]["longitude"]


def _next_code(city: str, role: str) -> str:
    base = "".join(ch for ch in city.upper() if ch.isalpha())[:3] or "BOD"
    n = 1
    while not run_query("SELECT 1 FROM wh_warehouses WHERE code = ?", (f"{base}-{role[:3].upper()}-{n:02d}",)).empty:
        n += 1
    return f"{base}-{role[:3].upper()}-{n:02d}"


def create_warehouse(net, data: dict, user: str | None, now: datetime) -> dict:
    v = _validate_warehouse(data)
    node, lat, lon = _resolve_node(net, v["city"], v["node_code"])
    v["node_code"] = node
    if v["latitude"] is None:
        v["latitude"], v["longitude"] = lat, lon
        if lat is not None:  # varias bodegas en una ciudad no caen en el mismo punto
            rng = random.Random(f"{v['city']}-{v['role']}-{v['name']}")
            v["latitude"], v["longitude"] = round(lat + rng.uniform(-0.04, 0.04), 5), round(lon + rng.uniform(-0.04, 0.04), 5)
    code = _text(data.get("code"), "El código", required=False, max_len=20) or _next_code(v["city"], v["role"])
    if not run_query("SELECT 1 FROM wh_warehouses WHERE code = ?", (code,)).empty:
        raise OperationError(f"Ya existe una bodega con el código {code}.")
    wid = run_write("""INSERT INTO wh_warehouses (code, name, city, node_code, role, capacity_m3, capacity_pallets,
                       docks, latitude, longitude, manager, shift, temp_controlled, hazmat, bonded, status,
                       strategic_reason, source, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (code, v["name"], v["city"], v["node_code"], v["role"], v["capacity_m3"], v["capacity_pallets"],
                     v["docks"], v["latitude"], v["longitude"], v["manager"], v["shift"], v["temp_controlled"],
                     v["hazmat"], v["bonded"], v["status"], v["strategic_reason"], "usuario", _now_iso()))
    audit(user, "CREATE", "wh_warehouses", code, f"Bodega creada: {v['name']} ({v['city']}, {ROLES[v['role']][0]})")
    return get_warehouse(wid, now)


def update_warehouse(net, warehouse_id: int, data: dict, user: str | None, now: datetime) -> dict:
    cur = _get_row(warehouse_id)
    v = _validate_warehouse(data, cur)
    if v["city"] != cur["city"] or data.get("node_code"):
        node, lat, lon = _resolve_node(net, v["city"], data.get("node_code"))
        v["node_code"] = node
        if v["city"] != cur["city"] and lat is not None:
            v["latitude"], v["longitude"] = lat, lon
    used = _used_m3(records(run_query("SELECT qty, volume_m3 FROM wh_stock WHERE warehouse_id = ?",
                              (warehouse_id,))))
    if v["capacity_m3"] < used:
        raise OperationError(f"La capacidad no puede ser menor que lo almacenado ({used:.0f} m³).")
    run_write("""UPDATE wh_warehouses SET name=?, city=?, node_code=?, role=?, capacity_m3=?, capacity_pallets=?,
                 docks=?, latitude=?, longitude=?, manager=?, shift=?, temp_controlled=?, hazmat=?, bonded=?,
                 status=?, strategic_reason=?, updated_at=? WHERE warehouse_id=?""",
              (v["name"], v["city"], v["node_code"], v["role"], v["capacity_m3"], v["capacity_pallets"], v["docks"],
               v["latitude"], v["longitude"], v["manager"], v["shift"], v["temp_controlled"], v["hazmat"],
               v["bonded"], v["status"], v["strategic_reason"], _now_iso(), warehouse_id))
    audit(user, "UPDATE", "wh_warehouses", cur["code"], f"Bodega editada: {v['name']}")
    return get_warehouse(warehouse_id, now)


def delete_warehouse(warehouse_id: int, user: str | None) -> dict:
    w = _get_row(warehouse_id)
    if not run_query("SELECT 1 FROM wh_stock WHERE warehouse_id = ? AND qty > 0", (warehouse_id,)).empty:
        raise OperationError("La bodega todavía tiene inventario: trasládalo o dalo de baja antes de borrarla.")
    if _vehicle_counts().get(warehouse_id):
        raise OperationError("Hay vehículos alojados en esta bodega: asígnalos a otra antes de borrarla.")
    if not run_query("SELECT 1 FROM wh_transfers WHERE (from_wh = ? OR to_wh = ?) AND status = 'En tránsito'",
                     (warehouse_id, warehouse_id)).empty:
        raise OperationError("Hay traslados en tránsito desde o hacia esta bodega.")
    run_write("DELETE FROM wh_transfers WHERE from_wh = ? OR to_wh = ?", (warehouse_id, warehouse_id))
    run_write("DELETE FROM wh_warehouses WHERE warehouse_id = ?", (warehouse_id,))
    audit(user, "DELETE", "wh_warehouses", w["code"], f"Bodega borrada: {w['name']}")
    return {"deleted": w["code"]}


# ---------------------------------------------------------------------------
# Inventario
# ---------------------------------------------------------------------------
def _stock_row(warehouse_id: int, sku: str) -> dict:
    df = run_query("SELECT * FROM wh_stock WHERE warehouse_id = ? AND sku = ?", (warehouse_id, sku))
    if df.empty:
        raise OperationError(f"El producto {sku} no está en esta bodega.")
    return records(df)[0]


def add_item(warehouse_id: int, data: dict, user: str | None, now: datetime) -> dict:
    w = _get_row(warehouse_id)
    sku = (_text(data.get("sku"), "El SKU", max_len=30) or "").upper()
    if not run_query("SELECT 1 FROM wh_stock WHERE warehouse_id = ? AND sku = ?", (warehouse_id, sku)).empty:
        raise OperationError(f"El SKU {sku} ya existe en esta bodega.")
    qty = _f(data.get("qty") or 0, "La cantidad", 0, 1e9)
    vol = _f(data.get("volume_m3") if data.get("volume_m3") not in (None, "") else 0.01, "El volumen por unidad", 0.0001, 100)
    if w["temp_controlled"] == 0 and data.get("requires_cold"):
        raise OperationError("Esta bodega no tiene cadena de frío.")
    _check_space(w, qty * vol)
    run_write("""INSERT INTO wh_stock (warehouse_id, sku, name, category, unit, qty, min_qty, max_qty, volume_m3,
                 weight_kg, unit_cost_usd, zone, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (warehouse_id, sku, _text(data.get("name"), "El nombre", max_len=90),
               _text(data.get("category") or "General", "La categoría", max_len=40),
               _text(data.get("unit") or "un", "La unidad", max_len=15), qty,
               _f(data.get("min_qty") or 0, "El mínimo", 0, 1e9), _f(data.get("max_qty") or 0, "El máximo", 0, 1e9),
               vol, _f(data.get("weight_kg") if data.get("weight_kg") not in (None, "") else 1, "El peso por unidad", 0.001, 100000),
               _f(data.get("unit_cost_usd") or 0, "El costo", 0, 1e9),
               _text(data.get("zone"), "La zona", required=False, max_len=20), _now_iso()))
    if qty > 0:
        _log(warehouse_id, sku, "Entrada", qty, "Alta de producto", user, "Inventario inicial")
    audit(user, "CREATE", "wh_stock", f"{w['code']}/{sku}", f"Producto agregado: {data.get('name')}")
    return get_warehouse(warehouse_id, now)


def update_item(warehouse_id: int, sku: str, data: dict, user: str | None, now: datetime) -> dict:
    w = _get_row(warehouse_id)
    cur = _stock_row(warehouse_id, sku)
    vol = _f(data.get("volume_m3") if data.get("volume_m3") not in (None, "") else cur["volume_m3"], "El volumen", 0.0001, 100)
    extra = cur["qty"] * (vol - cur["volume_m3"])
    if extra > 0:
        _check_space(w, extra)
    run_write("""UPDATE wh_stock SET name=?, category=?, unit=?, min_qty=?, max_qty=?, volume_m3=?, weight_kg=?,
                 unit_cost_usd=?, zone=?, updated_at=? WHERE warehouse_id=? AND sku=?""",
              (_text(data.get("name") or cur["name"], "El nombre", max_len=90),
               _text(data.get("category") or cur["category"], "La categoría", max_len=40),
               _text(data.get("unit") or cur["unit"], "La unidad", max_len=15),
               _f(data["min_qty"] if data.get("min_qty") not in (None, "") else cur["min_qty"], "El mínimo", 0, 1e9),
               _f(data["max_qty"] if data.get("max_qty") not in (None, "") else cur["max_qty"], "El máximo", 0, 1e9),
               vol, _f(data["weight_kg"] if data.get("weight_kg") not in (None, "") else cur["weight_kg"], "El peso", 0.001, 100000),
               _f(data["unit_cost_usd"] if data.get("unit_cost_usd") not in (None, "") else cur["unit_cost_usd"], "El costo", 0, 1e9),
               _text(data.get("zone") if data.get("zone") is not None else cur["zone"], "La zona", required=False, max_len=20),
               _now_iso(), warehouse_id, sku))
    audit(user, "UPDATE", "wh_stock", f"{w['code']}/{sku}", "Producto editado")
    return get_warehouse(warehouse_id, now)


def remove_item(warehouse_id: int, sku: str, user: str | None, now: datetime) -> dict:
    w = _get_row(warehouse_id)
    cur = _stock_row(warehouse_id, sku)
    if cur["qty"] > 0:
        raise OperationError("El producto todavía tiene existencias: sácalas o regístralas como merma antes de quitarlo.")
    run_write("DELETE FROM wh_stock WHERE warehouse_id = ? AND sku = ?", (warehouse_id, sku))
    audit(user, "DELETE", "wh_stock", f"{w['code']}/{sku}", f"Producto quitado: {cur['name']}")
    return get_warehouse(warehouse_id, now)


def _check_space(w: dict, extra_m3: float) -> None:
    if w["status"] == "Cerrada":
        raise OperationError("La bodega está cerrada: no recibe mercancía.")
    used = _used_m3(records(run_query("SELECT qty, volume_m3 FROM wh_stock WHERE warehouse_id = ?",
                              (w["warehouse_id"],))))
    free = w["capacity_m3"] - used - _incoming_m3(w["warehouse_id"])
    if extra_m3 > free + 1e-9:
        raise OperationError(f"La bodega no tiene espacio: faltan {extra_m3 - max(free, 0):.1f} m³ "
                             f"(libres {max(free, 0):.1f} m³).")


def _log(warehouse_id: int, sku: str, kind: str, qty: float, reference: str | None,
         user: str | None, note: str | None = None) -> None:
    run_write("""INSERT INTO wh_movements (warehouse_id, sku, kind, qty, at, reference, by_user, note)
                 VALUES (?,?,?,?,?,?,?,?)""",
              (warehouse_id, sku, kind, round(qty, 3), _now_iso(), reference, _user(user), note))


def move(warehouse_id: int, data: dict, user: str | None, now: datetime) -> dict:
    """Entrada, salida, merma o ajuste (fija la cantidad contada) de un producto."""
    w = _get_row(warehouse_id)
    sku = (data.get("sku") or "").strip().upper()
    kind = data.get("kind")
    if kind not in MOVE_KINDS:
        raise OperationError("Tipo de movimiento inválido.")
    cur = _stock_row(warehouse_id, sku)
    ref = _text(data.get("reference"), "La referencia", required=False, max_len=60)
    note = _text(data.get("note"), "La nota", required=False, max_len=200)
    if kind == "Ajuste":
        new = _f(data.get("qty"), "La cantidad contada", 0, 1e9)
        diff = new - cur["qty"]
        if diff > 0:
            _check_space(w, diff * cur["volume_m3"])
        run_write("UPDATE wh_stock SET qty = ?, updated_at = ? WHERE warehouse_id = ? AND sku = ?",
                  (new, _now_iso(), warehouse_id, sku))
        _log(warehouse_id, sku, "Ajuste", abs(diff), ref, user, note or f"Conteo: de {cur['qty']:g} a {new:g}")
    else:
        qty = _f(data.get("qty"), "La cantidad", 0.0001, 1e9)
        if kind == "Entrada":
            _check_space(w, qty * cur["volume_m3"])
            new = cur["qty"] + qty
        else:
            if qty > cur["qty"] + 1e-9:
                raise OperationError(f"No hay suficiente {cur['name']}: existen {cur['qty']:g} {cur['unit']}.")
            new = cur["qty"] - qty
        run_write("UPDATE wh_stock SET qty = ?, updated_at = ? WHERE warehouse_id = ? AND sku = ?",
                  (new, _now_iso(), warehouse_id, sku))
        _log(warehouse_id, sku, kind, qty, ref, user, note)
    audit(user, "UPDATE", "wh_stock", f"{w['code']}/{sku}", f"{kind}: {cur['name']}")
    return get_warehouse(warehouse_id, now)


# ---------------------------------------------------------------------------
# Traslados entre bodegas
# ---------------------------------------------------------------------------
def create_transfer(net, data: dict, user: str | None, now: datetime) -> dict:
    from app.engine import operations as ops
    try:
        a_id, b_id = int(data.get("from_wh")), int(data.get("to_wh"))
    except (TypeError, ValueError):
        raise OperationError("Elige la bodega de origen y la de destino.")
    if a_id == b_id:
        raise OperationError("La bodega de origen y la de destino son la misma.")
    a, b = _get_row(a_id), _get_row(b_id)
    sku = (data.get("sku") or "").strip().upper()
    cur = _stock_row(a_id, sku)
    qty = _f(data.get("qty"), "La cantidad", 0.0001, 1e9)
    if a["status"] == "Cerrada":
        raise OperationError("La bodega de origen está cerrada.")
    if qty > cur["qty"] + 1e-9:
        raise OperationError(f"No hay suficiente {cur['name']} en {a['name']}: existen {cur['qty']:g} {cur['unit']}.")
    if b["temp_controlled"] == 0 and a["temp_controlled"] == 1 and cur["category"] in ("Medicamentos", "Perecederos", "Flores"):
        raise OperationError(f"{b['name']} no tiene cadena de frío para {cur['name']}.")
    if cur["category"] in ("Químicos", "Combustibles") and not b["hazmat"]:
        raise OperationError(f"{b['name']} no puede almacenar mercancías peligrosas.")
    _check_space(b, qty * cur["volume_m3"])

    shipment_code = None
    if a["city"] != b["city"]:
        weight_t = max(round(qty * cur["weight_kg"] / 1000, 3), 0.01)
        departure = (data.get("departure_at") or (now + timedelta(hours=2)).replace(minute=0, second=0, microsecond=0).isoformat())
        shipment_code = ops.create_shipment(net, {
            "origin": a["city"], "destination": b["city"], "cargo": f"Traslado: {cur['name']}",
            "weight_t": weight_t, "priority": data.get("priority") or "balanceado",
            "client": f"Traslado interno {a['code']} → {b['code']}", "departure_at": departure,
        }, user, now)
    run_write("UPDATE wh_stock SET qty = qty - ?, updated_at = ? WHERE warehouse_id = ? AND sku = ?",
              (qty, _now_iso(), a_id, sku))
    ref = shipment_code or f"Traslado {a['code']} → {b['code']}"
    _log(a_id, sku, "Traslado salida", qty, ref, user, f"Hacia {b['name']}")
    tid = run_write("""INSERT INTO wh_transfers (from_wh, to_wh, sku, qty, shipment_code, status, created_at, created_by)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    (a_id, b_id, sku, qty, shipment_code, "En tránsito", _now_iso(), _user(user)))
    audit(user, "CREATE", "wh_transfers", str(tid),
          f"Traslado de {qty:g} {cur['unit']} de {cur['name']}: {a['code']} → {b['code']}"
          + (f" (envío {shipment_code})" if shipment_code else ""))
    if shipment_code is None:  # misma ciudad: llega al instante
        _receive(tid, now)
    return {"transfer_id": tid, "shipment_code": shipment_code,
            "status": "Recibido" if shipment_code is None else "En tránsito"}


def _receive(transfer_id: int, now: datetime) -> None:
    t = records(run_query("SELECT * FROM wh_transfers WHERE transfer_id = ?", (transfer_id,)))[0]
    src = _stock_row(t["from_wh"], t["sku"]) if not run_query(
        "SELECT 1 FROM wh_stock WHERE warehouse_id = ? AND sku = ?", (t["from_wh"], t["sku"])).empty else None
    if src is None:  # el producto se quitó del origen mientras viajaba: se recrea con lo que se sabe
        raise OperationError("El producto ya no existe en la bodega de origen.")
    dest = run_query("SELECT * FROM wh_stock WHERE warehouse_id = ? AND sku = ?", (t["to_wh"], t["sku"]))
    if dest.empty:
        run_write("""INSERT INTO wh_stock (warehouse_id, sku, name, category, unit, qty, min_qty, max_qty, volume_m3,
                     weight_kg, unit_cost_usd, zone, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                  (t["to_wh"], t["sku"], src["name"], src["category"], src["unit"], t["qty"], 0, 0,
                   src["volume_m3"], src["weight_kg"], src["unit_cost_usd"], None, _now_iso()))
    else:
        run_write("UPDATE wh_stock SET qty = qty + ?, updated_at = ? WHERE warehouse_id = ? AND sku = ?",
                  (t["qty"], _now_iso(), t["to_wh"], t["sku"]))
    ref = t["shipment_code"] or f"Traslado #{transfer_id}"
    _log(t["to_wh"], t["sku"], "Traslado entrada", t["qty"], ref, t["created_by"], "Recibido de la bodega de origen")
    run_write("UPDATE wh_transfers SET status = 'Recibido', received_at = ? WHERE transfer_id = ?",
              (now.isoformat(timespec="seconds"), transfer_id))


def settle_transfers(now: datetime) -> int:
    """Recibe los traslados cuyo envío ya llegó y devuelve al origen los de envíos borrados."""
    pend = records(run_query("SELECT * FROM wh_transfers WHERE status = 'En tránsito'"))
    done = 0
    for t in pend:
        if not t["shipment_code"]:
            continue
        s = run_query("SELECT status, departure_at, total_time_h, delay_h FROM mm_shipments WHERE shipment_code = ?",
                      (t["shipment_code"],))
        if s.empty:  # el envío se borró: la mercancía no salió
            run_write("UPDATE wh_stock SET qty = qty + ?, updated_at = ? WHERE warehouse_id = ? AND sku = ?",
                      (t["qty"], _now_iso(), t["from_wh"], t["sku"]))
            _log(t["from_wh"], t["sku"], "Ajuste", t["qty"], t["shipment_code"], "sistema",
                 "Traslado cancelado: el envío se borró")
            run_write("UPDATE wh_transfers SET status = 'Cancelado' WHERE transfer_id = ?", (t["transfer_id"],))
            done += 1
            continue
        from app.engine.dispatch import status_at
        row = records(s)[0]
        if status_at({**row, "route_json": None}, now, {"transfers": []})["status"] == "Entregado":
            _receive(t["transfer_id"], now)
            done += 1
    return done


def list_transfers(limit: int = 100) -> list:
    return records(run_query("""SELECT t.*, a.name from_name, a.city from_city, a.code from_code,
                        b.name to_name, b.city to_city, b.code to_code
                        FROM wh_transfers t JOIN wh_warehouses a ON a.warehouse_id = t.from_wh
                        JOIN wh_warehouses b ON b.warehouse_id = t.to_wh
                        ORDER BY t.transfer_id DESC LIMIT ?""", (max(1, min(limit, 500)),)))


# ---------------------------------------------------------------------------
# Siembra
# ---------------------------------------------------------------------------
def seed_warehouses(net, now: datetime) -> int:
    """Crea la red de bodegas y su inventario. Idempotente: lo que ya existe no se toca."""
    created = 0
    existing = set(run_query("SELECT code FROM wh_warehouses")["code"])
    for i, (code, name, city, node, role, m3, pallets, docks, dlat, dlon, shift, reason) in enumerate(BODEGAS):
        if code in existing:
            continue
        n = net.nodes.get(node) if net else None
        lat = round(n["latitude"] + dlat, 5) if n else None
        lon = round(n["longitude"] + dlon, 5) if n else None
        rng = random.Random(code)
        wid = run_write("""INSERT INTO wh_warehouses (code, name, city, node_code, role, capacity_m3, capacity_pallets,
                           docks, latitude, longitude, manager, shift, temp_controlled, hazmat, bonded, status,
                           strategic_reason, source, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (code, name, city, node, role, m3, pallets, docks, lat, lon, MANAGERS[i % len(MANAGERS)], shift,
                         1 if role == "frio" else 0, 1 if role == "peligrosos" else 0,
                         1 if role in ("aduanera", "frontera") else 0, "Operativa", reason, "semilla", _now_iso()))
        created += 1
        # ocupación objetivo: la mayoría entre 35 % y 82 %; los puertos y la última milla de Bogotá, muy llenos
        target = 0.93 if code in ("CTG-PTO", "BOG-UM1") else rng.uniform(0.35, 0.82)
        profile = STOCK_PROFILES.get(role, [])
        weights = [rng.uniform(0.6, 1.4) for _ in profile]
        wsum = sum(weights) or 1.0
        for (sku, sname, cat, unit, vol, kg, cost, typical), wt in zip(profile, weights):
            qty = max(round(m3 * target * wt / wsum / vol), 4)
            min_q = round(qty * rng.choice([0.25, 0.3, 0.35]))
            max_q = round(qty * rng.choice([1.4, 1.6, 1.9]))
            run_write("""INSERT INTO wh_stock (warehouse_id, sku, name, category, unit, qty, min_qty, max_qty,
                         volume_m3, weight_kg, unit_cost_usd, zone, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                      (wid, sku, sname, cat, unit, qty, min_q, max_q, vol, kg, cost,
                       f"{'FR' if role == 'frio' else 'A'}-{rng.randint(1, 24):02d}", _now_iso()))
            run_write("""INSERT INTO wh_movements (warehouse_id, sku, kind, qty, at, reference, by_user, note)
                         VALUES (?,?,?,?,?,?,?,?)""",
                      (wid, sku, "Entrada", qty, (now - timedelta(days=rng.randint(2, 40))).isoformat(timespec="seconds"),
                       f"OC-{rng.randint(1000, 9999)}", "semilla", "Inventario inicial simulado"))
    _seed_stock_alerts()
    return created


def _seed_stock_alerts() -> None:
    """Deja a propósito unos pocos productos bajo el mínimo y otros en exceso, para que
    las alertas tengan algo que mostrar desde el primer día (determinista y sin pasar la capacidad)."""
    if not run_query("SELECT 1 FROM wh_movements WHERE by_user = 'semilla' AND note LIKE 'Alerta%' LIMIT 1").empty:
        return
    caps = {int(r["warehouse_id"]): float(r["capacity_m3"]) for r in
            records(run_query("SELECT warehouse_id, capacity_m3 FROM wh_warehouses"))}
    rows = records(run_query("SELECT stock_id, warehouse_id, sku, qty, min_qty, max_qty, volume_m3 FROM wh_stock ORDER BY stock_id"))
    used: dict = {}
    for r in rows:
        used[r["warehouse_id"]] = used.get(r["warehouse_id"], 0.0) + r["qty"] * r["volume_m3"]
    for i, r in enumerate(rows):
        if i % 17 == 3:  # bajo el mínimo
            new = round(r["min_qty"] * 0.6)
            run_write("UPDATE wh_stock SET qty = ? WHERE stock_id = ?", (new, r["stock_id"]))
            used[r["warehouse_id"]] -= (r["qty"] - new) * r["volume_m3"]
            run_write("""INSERT INTO wh_movements (warehouse_id, sku, kind, qty, at, reference, by_user, note)
                         VALUES (?,?,?,?,?,?,?,?)""",
                      (r["warehouse_id"], r["sku"], "Salida", max(r["qty"] - new, 1), _now_iso(), "Despacho",
                       "semilla", "Alerta: existencias por debajo del mínimo"))
        elif i % 23 == 7 and r["max_qty"]:  # exceso, si hay espacio
            new = round(r["max_qty"] * 1.12)
            extra = (new - r["qty"]) * r["volume_m3"]
            if new > r["qty"] and used[r["warehouse_id"]] + extra <= 0.95 * caps[r["warehouse_id"]]:
                run_write("UPDATE wh_stock SET qty = ? WHERE stock_id = ?", (new, r["stock_id"]))
                used[r["warehouse_id"]] += extra
