"""
delivery.py
Prueba de entrega (POD): al llegar el envío a destino se registra quién recibió, la hora, si la carga llegó
conforme o con novedad (con observaciones) y la firma de quien recibe, dibujada en la pantalla.

- Solo se registra cuando el envío ya está «Entregado» (su estado se deriva de la hora, como en el resto).
- Una por envío. Para corregirla se anula (queda en el historial) y se registra de nuevo.
- La firma es un PNG de máximo 200 KB; se verifica que de verdad sea un PNG.
- El seguimiento público solo dice «Entrega confirmada» y la hora: no muestra el nombre ni la firma.
- Con ATTACHMENT_RETENTION_DAYS, el nombre y la firma se borran al cumplirse el plazo (datos personales).
"""
from __future__ import annotations

import base64
import binascii
from datetime import datetime, timedelta

from app.database.db import run_query, run_write
from app.engine.common import OperationError, _now_iso, _user, audit, records
from app.engine.dispatch import status_at

CONDITIONS = {"conforme": "Conforme", "con_novedad": "Con novedad"}
MAX_SIGNATURE_BYTES = 200_000
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
DATA_URL = "data:image/png;base64,"


def _shipment(code: str) -> dict:
    rows = run_query("SELECT * FROM mm_shipments WHERE shipment_code = ?", (code,))
    if rows.empty:
        raise LookupError(code)
    return records(rows)[0]


def _row(code: str) -> dict | None:
    rows = run_query("SELECT * FROM mm_deliveries WHERE shipment_code = ?", (code,))
    return records(rows)[0] if not rows.empty else None


def _out(d: dict) -> dict:
    sig = d.get("signature_png")
    return {
        "received_by": d["received_by"], "received_at": d["received_at"],
        "condition": d["condition"], "condition_label": CONDITIONS[d["condition"]], "notes": d["notes"],
        "signature": DATA_URL + base64.b64encode(sig).decode() if sig else None,
        "recorded_by": d["recorded_by"], "recorded_at": d["recorded_at"], "purged": bool(d.get("purged_at")),
    }


def get(code: str, now: datetime) -> dict:
    """La entrega registrada (o None) y si se puede registrar ahora."""
    s = _shipment(code)
    d = _row(code)
    arrived = status_at(s, now)["status"] == "Entregado"
    return {"code": code, "delivery": _out(d) if d else None, "arrived": arrived,
            "can_record": arrived and d is None, "eta_at": s["eta_at"]}


def _signature(raw) -> bytes:
    if not isinstance(raw, str) or not raw.startswith(DATA_URL):
        raise OperationError("Falta la firma de quien recibe.")
    try:
        data = base64.b64decode(raw[len(DATA_URL):], validate=True)
    except (binascii.Error, ValueError):
        raise OperationError("La firma no es una imagen válida.")
    if not data.startswith(PNG_MAGIC):
        raise OperationError("La firma no es una imagen PNG.")
    if len(data) > MAX_SIGNATURE_BYTES:
        raise OperationError("La firma es demasiado grande.")
    return data


def record(code: str, data: dict, user: str | None, now: datetime) -> dict:
    s = _shipment(code)
    if status_at(s, now)["status"] != "Entregado":
        raise OperationError("El envío aún no llega a destino: la entrega se registra cuando llegue.")
    if _row(code):
        raise OperationError("Ya hay una entrega registrada. Anúlala si necesitas corregirla.")
    name = " ".join(str(data.get("received_by") or "").split())
    if not 2 <= len(name) <= 80:
        raise OperationError("Escribe el nombre de quien recibe (entre 2 y 80 caracteres).")
    condition = data.get("condition") or "conforme"
    if condition not in CONDITIONS:
        raise OperationError("Estado de la carga no válido.")
    notes = (str(data.get("notes") or "")).strip()[:500] or None
    if condition == "con_novedad" and not notes:
        raise OperationError("Describe la novedad (faltante, avería, empaque abierto...).")
    at = now
    if data.get("received_at"):
        try:
            at = datetime.fromisoformat(str(data["received_at"]))
        except ValueError:
            raise OperationError("Fecha de recibo no válida.")
        if at.tzinfo is not None:
            at = at.astimezone().replace(tzinfo=None)
        if at < datetime.fromisoformat(s["departure_at"]) or at > now + timedelta(minutes=5):
            raise OperationError("La fecha de recibo debe estar entre la salida del envío y ahora.")
    sig = _signature(data.get("signature"))
    run_write("""INSERT INTO mm_deliveries (shipment_code, received_by, received_at, condition, notes, signature_png,
                 recorded_by, recorded_at) VALUES (?,?,?,?,?,?,?,?)""",
              (code, name, at.isoformat(timespec="minutes"), condition, notes, sig, _user(user), _now_iso()))
    audit(user, "INSERT", "mm_deliveries", code,
          f"Entrega registrada: recibió {name}, {CONDITIONS[condition].lower()}" + (f" ({notes[:80]})" if notes else ""))
    return get(code, now)


def void(code: str, user: str | None, now: datetime) -> dict:
    _shipment(code)
    d = _row(code)
    if d is None:
        raise OperationError("Este envío no tiene una entrega registrada.")
    run_write("DELETE FROM mm_deliveries WHERE shipment_code = ?", (code,))
    audit(user, "DELETE", "mm_deliveries", code, f"Entrega anulada (había recibido {d['received_by'] or 'dato borrado'})")
    return get(code, now)


def purge(code: str) -> None:
    """Al borrar un envío, su entrega se va con él (el historial la conserva)."""
    run_write("DELETE FROM mm_deliveries WHERE shipment_code = ?", (code,))


def purge_expired(now: datetime, days: int) -> int:
    """Borra nombre y firma de las entregas recibidas hace más de `days` días. Devuelve cuántas tocó."""
    if not days:
        return 0
    cutoff = (now - timedelta(days=days)).isoformat(timespec="minutes")
    rows = records(run_query("SELECT shipment_code FROM mm_deliveries WHERE purged_at IS NULL AND received_at < ?",
                             (cutoff,)))
    for r in rows:
        run_write("UPDATE mm_deliveries SET received_by = NULL, signature_png = NULL, purged_at = ? WHERE shipment_code = ?",
                  (_now_iso(), r["shipment_code"]))
        audit("sistema", "UPDATE", "mm_deliveries", r["shipment_code"],
              f"Nombre y firma de quien recibió borrados por plazo de conservación ({days} días)")
    return len(rows)


def public(code: str) -> dict | None:
    """Para el seguimiento del cliente: solo que hubo entrega, cuándo y si fue conforme. Sin nombre ni firma."""
    d = _row(code)
    if not d:
        return None
    return {"confirmed": True, "received_at": d["received_at"], "condition_label": CONDITIONS[d["condition"]]}


def signature_bytes(code: str) -> tuple[dict, bytes | None] | None:
    """Para la remesa en PDF."""
    d = _row(code)
    if not d:
        return None
    return d, d.get("signature_png")
