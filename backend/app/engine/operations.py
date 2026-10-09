"""
operations.py
Acciones de operación sobre la red y los envíos:

  - Cierre y reapertura de vías (por corredor) con redirección automática.
  - Alta, edición y borrado de envíos con la ruta calculada al guardar.
  - Parámetros de TRM y de reposición automática.
  - Historial de cambios en audit_log.

No hay autenticación: el usuario que firma cada cambio es el nombre que se
escribe en la interfaz (texto libre, no verificado).

Redirección de un envío cuando una vía de su ruta se cierra
-----------------------------------------------------------
Se busca el primer tramo pendiente (que aún no termina) que usa una vía
cerrada. Su nodo de partida es el "pivote":

  - Envío programado (no ha salido): se recalcula la ruta completa.
  - El vehículo aún no llega al pivote: se conserva la ruta hasta el pivote y
    desde ahí se calcula una nueva hasta el destino.
  - El vehículo está en el tramo afectado: se conserva lo recorrido, se añade
    un tramo de retorno al pivote (mismo tiempo que lleva en el tramo) y desde
    el pivote se calcula la nueva ruta.

Si no existe alternativa el envío queda con route_status = 'sin_ruta' y
conserva su ruta anterior como referencia. Al reabrir una vía, los envíos sin
ruta que ya no usan vías cerradas vuelven a 'ok', y los programados que se
habían redirigido se recalculan desde cero.
"""
from __future__ import annotations

import json
import random
import re
from datetime import datetime, timedelta

from app.database.db import run_query, run_write
from app.engine.dispatch import _asset_for, status_at
from app.engine.multimodal import PRIORITIES, MultimodalNetwork, RoutingError, haversine_km

MODES = ("terrestre", "fluvial", "maritimo", "aereo", "ferreo")
ANON = "anónimo"


class OperationError(ValueError):
    """Dato inválido o acción imposible (se responde con 4xx)."""


def _now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _user(name: str | None) -> str:
    name = (name or "").strip()
    return name[:60] if name else ANON


# ---------------------------------------------------------------------------
# Historial
# ---------------------------------------------------------------------------
def audit(user: str | None, action: str, table: str, record: str | None, detail: str) -> None:
    run_write("""INSERT INTO audit_log (username, action, table_name, record_id, detail, timestamp)
                 VALUES (?,?,?,?,?,?)""", (_user(user), action, table, record, detail, _now_iso()))


def audit_entries(limit: int = 200, table: str | None = None, record: str | None = None) -> list:
    sql, params = "SELECT * FROM audit_log WHERE 1=1", []
    if table:
        sql += " AND table_name = ?"
        params.append(table)
    if record:
        sql += " AND record_id = ?"
        params.append(record)
    sql += " ORDER BY audit_id DESC LIMIT ?"
    params.append(max(1, min(limit, 1000)))
    return run_query(sql, tuple(params)).to_dict(orient="records")


# ---------------------------------------------------------------------------
# Parámetros
# ---------------------------------------------------------------------------
def _param(key: str, default: str = "") -> str:
    rows = run_query("SELECT param_value FROM system_params WHERE param_key = ?", (key,))
    return default if rows.empty else str(rows.iloc[0]["param_value"])


def _set_param(key: str, value: str, description: str = "") -> None:
    run_write("""INSERT INTO system_params (param_key, param_value, description) VALUES (?,?,?)
                 ON CONFLICT(param_key) DO UPDATE SET param_value = excluded.param_value""",
              (key, value, description))


def get_fx() -> dict:
    raw = _param("FX_USD_COP")
    try:
        rate = float(raw) if raw else None
    except ValueError:
        rate = None
    return {"rate": rate, "date": _param("FX_DATE") or None, "source": _param("FX_SOURCE") or None}


def set_fx(rate: float, date: str, source: str, user: str | None) -> dict:
    if not (rate and 100 <= rate <= 100_000):
        raise OperationError("La TRM debe estar entre 100 y 100.000 COP por dólar.")
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except (TypeError, ValueError):
        raise OperationError("La fecha de la TRM debe tener formato AAAA-MM-DD.")
    source = (source or "").strip()
    if not source:
        raise OperationError("Indica la fuente de la TRM.")
    before = get_fx()
    _set_param("FX_USD_COP", f"{rate:g}")
    _set_param("FX_DATE", date)
    _set_param("FX_SOURCE", source[:120])
    audit(user, "UPDATE", "system_params", "FX_USD_COP",
          f"TRM {before['rate'] or 'sin configurar'} -> {rate:g} COP/USD ({date}, {source})")
    return get_fx()


def auto_replenish() -> bool:
    return _param("AUTO_REPLENISH", "true").lower() == "true"


def set_auto_replenish(enabled: bool, user: str | None) -> bool:
    _set_param("AUTO_REPLENISH", "true" if enabled else "false")
    audit(user, "UPDATE", "system_params", "AUTO_REPLENISH",
          "Reposición automática " + ("activada" if enabled else "desactivada"))
    return enabled


# ---------------------------------------------------------------------------
# Códigos de envío
# ---------------------------------------------------------------------------
def next_code(when: datetime) -> str:
    """LS-AAMM-NNNN con NNNN consecutivo global (no se reutiliza tras borrar)."""
    codes = run_query("SELECT shipment_code FROM mm_shipments")["shipment_code"].tolist()
    nums = [int(m.group(1)) for c in codes if (m := re.search(r"-(\d+)$", c))]
    last = max(nums, default=0)
    # Un consecutivo borrado no vuelve a usarse: se registra en el historial
    logged = run_query("SELECT record_id FROM audit_log WHERE table_name = 'mm_shipments' "
                       "AND action = 'DELETE'")["record_id"].tolist()
    nums_del = [int(m.group(1)) for c in logged if c and (m := re.search(r"-(\d+)$", c))]
    return f"LS-{when:%y%m}-{max([last, *nums_del]) + 1:04d}"


# ---------------------------------------------------------------------------
# Vías (corredores)
# ---------------------------------------------------------------------------
def _split(v) -> list:
    if not v:
        return []
    if isinstance(v, (list, tuple, set)):
        return [str(x).strip() for x in v if str(x).strip()]
    return [x.strip() for x in str(v).split(",") if x.strip()]


def corridors(net: MultimodalNetwork, now: datetime) -> list:
    status = {r["corridor"]: r for r in
              run_query("SELECT * FROM mm_corridor_status").to_dict(orient="records")}
    usage: dict = {}
    for r in _open_shipments():
        route = json.loads(r["route_json"])
        st = status_at(r, now, route)
        if st["status"] == "Entregado":
            continue
        pending = {c for l in route["legs"] if l["end_h"] > st["route_h"] and not l.get("interrupted")
                   for sg in _segments(l) if sg["end_h"] > st["route_h"] for c in _seg_corridors(sg)}
        for c in pending:
            usage.setdefault(c, []).append(r["shipment_code"])
    out: dict = {}
    for l in net.links:
        c = out.setdefault(l["corridor"], {
            "corridor": l["corridor"], "modes": set(), "links": 0, "distance_km": 0.0,
            "approximate": False, "segments": []})
        c["modes"].add(l["mode"])
        c["links"] += 1
        c["distance_km"] += l["distance_km"]
        c["approximate"] = c["approximate"] or bool(l.get("approximate"))
        c["segments"].append(f"{net.nodes[l['origin_code']]['name']} - {net.nodes[l['dest_code']]['name']}")
    for name, c in out.items():
        s = status.get(name)
        c["modes"] = sorted(c["modes"])
        c["active"] = not s or bool(s["active"])
        c["reason"] = s["reason"] if s and not s["active"] else None
        c["changed_at"] = s["changed_at"] if s else None
        c["changed_by"] = s["changed_by"] if s else None
        c["shipments"] = sorted(usage.get(name, []))
    return sorted(out.values(), key=lambda c: (c["active"], c["modes"][0], c["corridor"]))


def set_corridor_status(net_factory, corridor: str, active: bool, reason: str | None,
                        user: str | None, now: datetime) -> dict:
    """Cierra o reabre un corredor y reconcilia los envíos. `net_factory` es una
    función que devuelve la red recargada (después de invalidar la caché)."""
    net = net_factory()
    if corridor not in net.corridors:
        raise OperationError(f"Vía desconocida: '{corridor}'.")
    reason = (reason or "").strip()
    if not active and not reason:
        raise OperationError("Indica el motivo del cierre.")
    current = run_query("SELECT active FROM mm_corridor_status WHERE corridor = ?", (corridor,))
    was_active = current.empty or bool(current.iloc[0]["active"])
    if was_active == active:
        raise OperationError(f"La vía ya está {'activa' if active else 'cerrada'}.")
    run_write("""INSERT INTO mm_corridor_status (corridor, active, reason, changed_at, changed_by)
                 VALUES (?,?,?,?,?)
                 ON CONFLICT(corridor) DO UPDATE SET active = excluded.active,
                     reason = excluded.reason, changed_at = excluded.changed_at,
                     changed_by = excluded.changed_by""",
              (corridor, int(active), None if active else reason, _now_iso(), _user(user)))
    audit(user, "REOPEN" if active else "CLOSE", "mm_corridor_status", corridor,
          ("Vía reabierta" if active else f"Vía cerrada: {reason}"))
    net = net_factory(reload=True)
    summary = reconcile(net, now, user,
                        cause=(f"reapertura de {corridor}" if active else f"cierre de {corridor}"))
    return {"corridor": corridor, "active": active, **summary}


# ---------------------------------------------------------------------------
# Reconciliación de rutas con el estado de la red
# ---------------------------------------------------------------------------
def _open_shipments() -> list:
    return run_query("SELECT * FROM mm_shipments WHERE status != 'Entregado'").to_dict(orient="records")


def _plan(net: MultimodalNetwork, origin: str, dest: str, weight: float, priority: str,
          forced_modes: list, forced_corridors: list) -> dict:
    return net.route(origin, dest, weight, priority,
                     allowed_modes=forced_modes or None, required_corridors=forced_corridors or None)


def _attach_assets(route: dict, weight: float, seed: str) -> None:
    rng = random.Random(seed)
    for leg in route["legs"]:
        leg.setdefault("asset", _asset_for(leg["mode"], weight, rng))


def _route_fields(route: dict, departure: datetime) -> dict:
    legs = route["legs"]
    total_h = route["timeline"][-1]["t_h"] if route["timeline"] else 0.0
    return {
        "distance_km": sum(l["distance_km"] for l in legs),
        "total_time_h": total_h,
        "total_cost": sum(l["cost"] for l in legs) + sum(t["cost"] for t in route["transfers"]),
        "modes": ",".join(l["mode"] for l in legs),
        "n_transfers": len(route["transfers"]),
        "eta_at": (departure + timedelta(hours=total_h)).isoformat(timespec="minutes"),
        "route_json": json.dumps({k: route[k] for k in ("legs", "transfers", "timeline")}),
    }


def _shift(items: list, dt: float, keys=("start_h", "end_h", "t_h")) -> list:
    out = []
    for it in items:
        it = dict(it)
        for k in keys:
            if k in it:
                it[k] = it[k] + dt
        if "segments" in it:
            it["segments"] = _shift(it["segments"], dt, keys)
        out.append(it)
    return out


def _interp(timeline: list, h: float) -> tuple:
    for a, b in zip(timeline, timeline[1:]):
        if a["t_h"] <= h <= b["t_h"]:
            span = b["t_h"] - a["t_h"]
            f = (h - a["t_h"]) / span if span > 0 else 0.0
            return a["lon"] + (b["lon"] - a["lon"]) * f, a["lat"] + (b["lat"] - a["lat"]) * f
    p = timeline[-1]
    return p["lon"], p["lat"]


def _segments(leg: dict) -> list:
    """Segmentos de un tramo. Rutas guardadas antes de existir los segmentos
    se tratan como un único segmento con todas sus vías."""
    if leg.get("segments"):
        return leg["segments"]
    return [{"from": leg["from"]["code"], "to": leg["to"]["code"], "corridor": None,
             "corridors": leg["corridors"], "start_h": leg["start_h"], "end_h": leg["end_h"],
             "time_h": leg["time_h"], "distance_km": leg["distance_km"], "cost": leg["cost"]}]


def _seg_corridors(seg: dict) -> set:
    return set(seg.get("corridors") or [seg["corridor"]])


def _blocked(seg: dict, mode: str, h: float, closed: set) -> bool:
    """Segmento pendiente que usa una vía cerrada. Un vuelo en curso no se
    devuelve: el cierre de una ruta aérea solo afecta vuelos por despegar."""
    if seg["end_h"] <= h or not (_seg_corridors(seg) & closed):
        return False
    return not (mode == "aereo" and seg["start_h"] <= h)


def _path_between(timeline: list, t0: float, t1: float) -> list:
    return [[p["lon"], p["lat"]] for p in timeline if t0 - 1e-9 <= p["t_h"] <= t1 + 1e-9]


def _sub_leg(net: MultimodalNetwork, leg: dict, segs: list, timeline: list) -> dict:
    """Parte de un tramo formada por sus primeros segmentos."""
    end = segs[-1]["end_h"]
    return {**leg, "to": net._node_brief(segs[-1]["to"]) if segs[-1]["to"] in net.nodes else leg["to"],
            "corridors": list(dict.fromkeys(c for s in segs for c in _seg_corridors(s))),
            "distance_km": sum(s["distance_km"] for s in segs), "time_h": end - leg["start_h"],
            "cost": sum(s["cost"] for s in segs), "end_h": end, "segments": segs,
            "path": _path_between(timeline, leg["start_h"], end)}


def reroute(net: MultimodalNetwork, s: dict, now: datetime) -> dict:
    """Nueva ruta (dict del motor con legs/transfers/timeline) que evita las vías
    cerradas. Lanza RoutingError si no hay alternativa."""
    route = json.loads(s["route_json"])
    st = status_at(s, now, route)
    forced_modes, forced_corr = _split(s.get("forced_modes")), _split(s.get("forced_corridors"))
    closed = net.closed_corridors
    if st["status"] == "Programado":
        return _plan(net, s["origin_city"], s["dest_city"], s["weight_t"], s["priority"],
                     forced_modes, forced_corr)

    h = st["route_h"]
    legs, timeline = route["legs"], route["timeline"]
    hit = next(((i, j) for i, l in enumerate(legs) if l["end_h"] > h
                for j, sg in enumerate(_segments(l)) if _blocked(sg, l["mode"], h, closed)),
               None)
    if hit is None:
        return route
    i, j = hit
    leg = legs[i]
    segs = _segments(leg)
    seg = segs[j]
    pivot, tp = seg["from"], seg["start_h"]
    new_legs = [dict(l) for l in legs[:i]]
    if j > 0:
        new_legs.append(_sub_leg(net, leg, segs[:j], timeline))
    on_closed = tp <= h  # el vehículo ya va por el segmento cerrado

    if on_closed:
        new_transfers = [t for t in route["transfers"] if t["start_h"] < tp]
        ran = h - tp
        frac = ran / seg["time_h"] if seg["time_h"] else 0.0
        lon, lat = _interp(timeline, h)
        walked = [p for p in timeline if tp <= p["t_h"] <= h]
        here = {"lon": lon, "lat": lat, "t_h": h, "mode": leg["mode"]}
        point = {"code": "DESVIO", "name": "Punto de desvío", "city": "", "kind": "ciudad",
                 "lat": lat, "lon": lon}
        pivot_brief = net._node_brief(pivot) if pivot in net.nodes else leg["from"]
        cut = sorted(_seg_corridors(seg) & closed)
        part = {"mode": leg["mode"], "from": pivot_brief, "to": point,
                "corridors": sorted(_seg_corridors(seg)), "distance_km": seg["distance_km"] * frac,
                "time_h": ran, "cost": seg["cost"] * frac, "start_h": tp, "end_h": h,
                "path": [[p["lon"], p["lat"]] for p in walked] + [[lon, lat]],
                "asset": leg.get("asset"), "interrupted": True}
        back = {**part, "from": point, "to": pivot_brief, "start_h": h, "end_h": h + ran,
                "corridors": [f"Retorno por cierre ({', '.join(cut)})"],
                "path": list(reversed(part["path"])), "interrupted": False, "detour": True}
        new_legs += [part, back]
        new_timeline = [p for p in timeline if p["t_h"] <= h] + [here]
        new_timeline += [{**p, "t_h": h + (h - p["t_h"])} for p in reversed(walked)]
        start, arriving_mode = h + ran, leg["mode"]
    else:
        # Llegada al pivote: dentro del tramo (j > 0) o al final del tramo anterior
        arrival = tp if j > 0 else (legs[i - 1]["end_h"] if i > 0 else 0.0)
        arriving_mode = leg["mode"] if j > 0 else (legs[i - 1]["mode"] if i > 0 else None)
        new_transfers = [t for t in route["transfers"] if t["start_h"] < arrival]
        new_timeline = [p for p in timeline if p["t_h"] <= arrival + 1e-9]
        start = max(h, arrival)
        if start > arrival and new_timeline:
            new_timeline.append({**new_timeline[-1], "t_h": start, "mode": "transbordo"})

    done = {c for l in new_legs for c in l["corridors"]}
    tail = _plan(net, pivot, s["dest_city"], s["weight_t"], s["priority"],
                 forced_modes, [c for c in forced_corr if c not in done])
    if arriving_mode and tail["legs"] and tail["legs"][0]["mode"] != arriving_mode:
        node = net.nodes[pivot]
        new_transfers.append({
            "node": net._node_brief(pivot), "from_mode": arriving_mode,
            "to_mode": tail["legs"][0]["mode"], "start_h": start,
            "time_h": node["transfer_time_h"], "cost": node["transfer_cost_per_t"] * s["weight_t"]})
        new_timeline += [{"lon": node["longitude"], "lat": node["latitude"], "t_h": start, "mode": "transbordo"},
                         {"lon": node["longitude"], "lat": node["latitude"],
                          "t_h": start + node["transfer_time_h"], "mode": "transbordo"}]
        start += node["transfer_time_h"]
    new_legs += _shift(tail["legs"], start)
    new_transfers += _shift(tail["transfers"], start)
    new_timeline += _shift(tail["timeline"], start)
    return {"legs": new_legs, "transfers": new_transfers, "timeline": new_timeline}


def _uses_closed(route: dict, route_h: float, closed: set) -> bool:
    return any(_blocked(sg, l["mode"], route_h, closed)
               for l in route["legs"] if l["end_h"] > route_h for sg in _segments(l))


def reconcile(net: MultimodalNetwork, now: datetime, user: str | None, cause: str) -> dict:
    rerouted, no_route, restored, replanned = [], [], [], []
    closed = net.closed_corridors
    for s in _open_shipments():
        route = json.loads(s["route_json"])
        st = status_at(s, now, route)
        if st["status"] == "Entregado":
            continue
        code = s["shipment_code"]
        affected = _uses_closed(route, st["route_h"], closed)
        # Un programado que se había redirigido vuelve a optimizarse al reabrir
        replan = (not affected and st["status"] == "Programado"
                  and (s.get("route_note") or s.get("route_status") == "sin_ruta"))
        if not affected and not replan:
            if s.get("route_status") == "sin_ruta":
                run_write("UPDATE mm_shipments SET route_status = 'ok', route_note = ? "
                          "WHERE shipment_code = ?", (f"Ruta restablecida por {cause}", code))
                audit(user, "UPDATE", "mm_shipments", code, f"Ruta restablecida por {cause}")
                restored.append(code)
            continue
        try:
            new = reroute(net, s, now)
        except RoutingError as exc:
            if s.get("route_status") != "sin_ruta":
                run_write("UPDATE mm_shipments SET route_status = 'sin_ruta', route_note = ? "
                          "WHERE shipment_code = ?", (f"Sin ruta por {cause}: {exc}", code))
                audit(user, "UPDATE", "mm_shipments", code, f"Sin ruta disponible por {cause}")
            no_route.append(code)
            continue
        _attach_assets(new, s["weight_t"], code)
        departure = datetime.fromisoformat(s["departure_at"])
        fields = _route_fields(new, departure)
        note = (f"Recalculada por {cause}" if replan else f"Redirigida por {cause}")
        fields.update(route_status="ok", route_note=note, updated_at=_now_iso(), updated_by=_user(user))
        fields["status"] = status_at({**s, **fields}, now)["status"]
        _update_shipment_row(code, fields)
        audit(user, "UPDATE", "mm_shipments", code, note)
        (replanned if replan else rerouted).append(code)
    return {"rerouted": rerouted, "no_route": no_route, "restored": restored, "replanned": replanned}


def _update_shipment_row(code: str, fields: dict) -> None:
    cols = list(fields)
    run_write(f"UPDATE mm_shipments SET {', '.join(f'{c} = ?' for c in cols)} WHERE shipment_code = ?",
              (*[fields[c] for c in cols], code))


# ---------------------------------------------------------------------------
# Envíos creados y editados desde la interfaz
# ---------------------------------------------------------------------------
EDITABLE = ("origin", "destination", "cargo", "weight_t", "priority", "client",
            "departure_at", "delay_h", "forced_modes", "forced_corridors")


def _validate(net: MultimodalNetwork, data: dict) -> dict:
    out = {}
    for k in ("origin", "destination", "cargo", "client"):
        v = str(data.get(k) or "").strip()
        if not v:
            raise OperationError(f"El campo '{k}' es obligatorio.")
        out[k] = v[:120]
    for k in ("origin", "destination"):
        try:
            net.resolve(out[k])
        except RoutingError as exc:
            raise OperationError(str(exc))
    try:
        out["weight_t"] = float(data.get("weight_t"))
    except (TypeError, ValueError):
        raise OperationError("El peso debe ser un número.")
    if not 0 < out["weight_t"] <= 20000:
        raise OperationError("El peso debe estar entre 0 y 20.000 t.")
    out["priority"] = data.get("priority") or "balanceado"
    if out["priority"] not in PRIORITIES:
        raise OperationError("Prioridad inválida.")
    try:
        out["departure_at"] = datetime.fromisoformat(str(data.get("departure_at")))
    except (TypeError, ValueError):
        raise OperationError("La fecha de salida no es válida.")
    try:
        out["delay_h"] = float(data.get("delay_h") or 0)
    except (TypeError, ValueError):
        raise OperationError("El retraso debe ser un número de horas.")
    if not 0 <= out["delay_h"] <= 2000:
        raise OperationError("El retraso debe estar entre 0 y 2.000 h.")
    out["forced_modes"] = _split(data.get("forced_modes"))
    bad = [m for m in out["forced_modes"] if m not in MODES]
    if bad:
        raise OperationError(f"Modo inválido: {', '.join(bad)}.")
    out["forced_corridors"] = _split(data.get("forced_corridors"))
    return out


def preview(net: MultimodalNetwork, data: dict) -> dict:
    v = _validate(net, {**data, "cargo": data.get("cargo") or "-", "client": data.get("client") or "-",
                        "departure_at": data.get("departure_at") or datetime.now().isoformat()})
    try:
        return _plan(net, v["origin"], v["destination"], v["weight_t"], v["priority"],
                     v["forced_modes"], v["forced_corridors"])
    except RoutingError as exc:
        raise OperationError(str(exc))


def _row_from(net: MultimodalNetwork, v: dict, code: str, now: datetime) -> dict:
    try:
        route = _plan(net, v["origin"], v["destination"], v["weight_t"], v["priority"],
                      v["forced_modes"], v["forced_corridors"])
    except RoutingError as exc:
        raise OperationError(str(exc))
    _attach_assets(route, v["weight_t"], code)
    row = {
        "origin_city": v["origin"], "dest_city": v["destination"], "cargo": v["cargo"],
        "weight_t": v["weight_t"], "priority": v["priority"], "client": v["client"],
        "departure_at": v["departure_at"].isoformat(timespec="minutes"),
        "delay_h": round(v["delay_h"], 1),
        "forced_modes": ",".join(v["forced_modes"]) or None,
        "forced_corridors": ",".join(v["forced_corridors"]) or None,
        "route_status": "ok", "route_note": None,
        **_route_fields(route, v["departure_at"]),
    }
    row["status"] = status_at(row, now)["status"]
    return row


def create_shipment(net: MultimodalNetwork, data: dict, user: str | None, now: datetime) -> str:
    v = _validate(net, data)
    code = next_code(v["departure_at"])
    row = _row_from(net, v, code, now)
    row.update(shipment_code=code, source="manual", created_by=_user(user),
               created_at=_now_iso(), updated_at=None, updated_by=None)
    cols = list(row)
    run_write(f"INSERT INTO mm_shipments ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
              tuple(row[c] for c in cols))
    audit(user, "INSERT", "mm_shipments", code,
          f"Envío creado: {v['origin']} -> {v['destination']}, {v['cargo']}, {v['weight_t']:g} t")
    return code


def update_shipment(net: MultimodalNetwork, code: str, data: dict, user: str | None,
                    now: datetime) -> str:
    rows = run_query("SELECT * FROM mm_shipments WHERE shipment_code = ?", (code,))
    if rows.empty:
        raise LookupError(code)
    old = rows.to_dict(orient="records")[0]
    merged = {
        "origin": old["origin_city"], "destination": old["dest_city"], "cargo": old["cargo"],
        "weight_t": old["weight_t"], "priority": old["priority"], "client": old["client"],
        "departure_at": old["departure_at"], "delay_h": old["delay_h"],
        "forced_modes": old.get("forced_modes"), "forced_corridors": old.get("forced_corridors"),
        **{k: data[k] for k in EDITABLE if k in data},
    }
    v = _validate(net, merged)
    row = _row_from(net, v, code, now)
    row.update(updated_at=_now_iso(), updated_by=_user(user))
    _update_shipment_row(code, row)
    labels = {"origin_city": "origen", "dest_city": "destino"}
    diffs = []
    for k, ok in (("origin", "origin_city"), ("destination", "dest_city"), ("cargo", "cargo"),
                  ("weight_t", "weight_t"), ("priority", "priority"), ("client", "client"),
                  ("departure_at", "departure_at"), ("delay_h", "delay_h"),
                  ("forced_modes", "forced_modes"), ("forced_corridors", "forced_corridors")):
        before, after = old.get(ok), row.get(ok)
        if str(before or "") != str(after or ""):
            diffs.append(f"{labels.get(ok, k)}: {before or '-'} -> {after or '-'}")
    audit(user, "UPDATE", "mm_shipments", code,
          "Envío editado" + (": " + "; ".join(diffs) if diffs else " (ruta recalculada)"))
    return code


def delete_shipment(code: str, user: str | None) -> None:
    rows = run_query("SELECT origin_city, dest_city, cargo, source FROM mm_shipments "
                     "WHERE shipment_code = ?", (code,))
    if rows.empty:
        raise LookupError(code)
    r = rows.iloc[0]
    run_write("DELETE FROM mm_shipments WHERE shipment_code = ?", (code,))
    audit(user, "DELETE", "mm_shipments", code,
          f"Envío borrado ({'semilla' if r['source'] == 'seed' else 'manual'}): "
          f"{r['origin_city']} -> {r['dest_city']}, {r['cargo']}")


def approx_air_time_h(lat1, lon1, lat2, lon2) -> float:
    """Tiempo bloque aproximado de un carguero: 25 min de rodaje y ascenso + 600 km/h."""
    return round(0.4 + haversine_km(lat1, lon1, lat2, lon2) / 600, 1)
