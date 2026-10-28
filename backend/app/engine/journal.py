"""
journal.py
Bitácora de cada envío (notas e incidencias en ruta) y sus documentos adjuntos.

Incidencias: una incidencia puede sumar horas de retraso. No toca la ruta ni el motor: el
retraso se aplica con `operations.update_shipment` (lo mismo que editar el campo «Retraso» a
mano), así la ETA y el estado se recalculan igual y el cambio queda en el historial.

Adjuntos: el archivo se guarda en disco junto a la base (`<carpeta de la base>/adjuntos/<código>/`)
con un nombre interno propio; el nombre original solo se usa al descargar. Se aceptan documentos e
imágenes comunes hasta 10 MB.
"""
from __future__ import annotations

import base64
import binascii
import os
import re
from datetime import datetime

import app.database.db as db
from app.database.db import run_query, run_write
from app.engine.common import OperationError, _now_iso, _user, audit, records

KINDS = {
    "nota": "Nota",
    "retraso": "Retraso",
    "derrumbe": "Derrumbe",
    "paro": "Paro o bloqueo",
    "clima": "Clima",
    "mecanica": "Falla mecánica",
    "otro": "Otro",
}
MAX_DELAY_H = 240
MAX_BYTES = 10 * 1024 * 1024
ALLOWED = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def attachments_dir() -> str:
    # Se lee en cada llamada: la ruta de la base puede cambiar (pruebas con base temporal)
    return os.path.join(os.path.dirname(db.DB_PATH), "adjuntos")


def _exists(code: str) -> dict:
    rows = run_query("SELECT shipment_code, delay_h, status FROM mm_shipments WHERE shipment_code = ?", (code,))
    if rows.empty:
        raise LookupError(code)
    return rows.to_dict(orient="records")[0]


# ---------------------------------------------------------------------------
# Bitácora
# ---------------------------------------------------------------------------
def _event_out(e: dict) -> dict:
    return {**e, "kind_label": KINDS.get(e["kind"], e["kind"]), "delay_h": float(e["delay_h"] or 0),
            "incident": e["kind"] != "nota"}


def events(code: str) -> list:
    _exists(code)
    rows = records(run_query("SELECT * FROM mm_shipment_events WHERE shipment_code = ? ORDER BY created_at, event_id",
                             (code,)))
    return [_event_out(e) for e in rows]


def recent_incidents(days: int = 7, limit: int = 50) -> list:
    since = datetime.now().timestamp() - days * 86400
    since_iso = datetime.fromtimestamp(since).isoformat(timespec="seconds")
    rows = records(run_query(
        "SELECT e.*, s.origin_city, s.dest_city FROM mm_shipment_events e "
        "LEFT JOIN mm_shipments s ON s.shipment_code = e.shipment_code "
        "WHERE e.kind != 'nota' AND e.created_at >= ? ORDER BY e.created_at DESC LIMIT ?",
        (since_iso, max(1, min(limit, 500)))))
    return [_event_out(e) for e in rows]


def add_event(net, code: str, kind: str, body: str, delay_h: float, user: str | None, now: datetime) -> dict:
    """Agrega una nota o incidencia. Si suma retraso, lo aplica al envío (recalcula la ETA)."""
    from app.engine import operations as ops  # evita el import circular

    s = _exists(code)
    if kind not in KINDS:
        raise OperationError(f"Tipo de registro desconocido: {kind}.")
    body = (body or "").strip()
    if not body:
        raise OperationError("Escribe qué pasó.")
    if len(body) > 2000:
        raise OperationError("El texto no puede pasar de 2.000 caracteres.")
    delay_h = float(delay_h or 0)
    if kind == "nota" and delay_h:
        raise OperationError("Una nota no suma retraso; regístralo como incidencia.")
    if not 0 <= delay_h <= MAX_DELAY_H:
        raise OperationError(f"El retraso debe estar entre 0 y {MAX_DELAY_H} horas.")
    if delay_h and s["status"] == "Entregado":
        raise OperationError("El envío ya se entregó: no se le puede sumar retraso.")
    if delay_h:
        new_delay = round(float(s["delay_h"] or 0) + delay_h, 1)
        ops.update_shipment(net, code, {"delay_h": new_delay}, user, now)
    event_id = run_write(
        "INSERT INTO mm_shipment_events (shipment_code, kind, body, delay_h, created_at, created_by) VALUES (?,?,?,?,?,?)",
        (code, kind, body, delay_h, _now_iso(), _user(user)))
    audit(user, "INSERT", "mm_shipment_events", code,
          f"{KINDS[kind]}: {body[:120]}" + (f" (+{delay_h:g} h de retraso)" if delay_h else ""))
    row = records(run_query("SELECT * FROM mm_shipment_events WHERE event_id = ?", (event_id,)))[0]
    return _event_out(row)


def resolve_event(code: str, event_id: int, user: str | None) -> dict:
    rows = records(run_query("SELECT * FROM mm_shipment_events WHERE event_id = ? AND shipment_code = ?",
                             (event_id, code)))
    if not rows:
        raise LookupError(event_id)
    e = rows[0]
    if e["kind"] == "nota":
        raise OperationError("Las notas no se resuelven.")
    if not e["resolved_at"]:
        run_write("UPDATE mm_shipment_events SET resolved_at = ?, resolved_by = ? WHERE event_id = ?",
                  (_now_iso(), _user(user), event_id))
        audit(user, "UPDATE", "mm_shipment_events", code, f"Incidencia resuelta: {e['body'][:120]}")
    return _event_out(records(run_query("SELECT * FROM mm_shipment_events WHERE event_id = ?", (event_id,)))[0])


def delete_event(code: str, event_id: int, user: str | None) -> None:
    """Borra una nota. Las incidencias no se borran (sumaron retraso y son parte del historial)."""
    rows = records(run_query("SELECT * FROM mm_shipment_events WHERE event_id = ? AND shipment_code = ?",
                             (event_id, code)))
    if not rows:
        raise LookupError(event_id)
    if rows[0]["kind"] != "nota":
        raise OperationError("Las incidencias no se borran: márcala como resuelta.")
    run_write("DELETE FROM mm_shipment_events WHERE event_id = ?", (event_id,))
    audit(user, "DELETE", "mm_shipment_events", code, f"Nota borrada: {rows[0]['body'][:120]}")


# ---------------------------------------------------------------------------
# Adjuntos
# ---------------------------------------------------------------------------
def _safe_name(name: str) -> str:
    base = os.path.basename(name or "").strip() or "archivo"
    base = re.sub(r"[^\w.\- ]+", "_", base, flags=re.UNICODE)
    return base[:120]


def attachments(code: str) -> list:
    _exists(code)
    return records(run_query(
        "SELECT attachment_id, shipment_code, filename, content_type, size_bytes, created_at, created_by "
        "FROM mm_attachments WHERE shipment_code = ? ORDER BY created_at DESC", (code,)))


def add_attachment(code: str, filename: str, content_b64: str, user: str | None) -> dict:
    _exists(code)
    name = _safe_name(filename)
    ext = os.path.splitext(name)[1].lower()
    if ext not in ALLOWED:
        raise OperationError("Tipo de archivo no permitido. Usa PDF, imagen (PNG, JPG, WebP), Excel, Word, CSV o texto.")
    try:
        data = base64.b64decode(content_b64, validate=True)
    except (binascii.Error, ValueError):
        raise OperationError("El archivo llegó dañado (base64 inválido).")
    if not data:
        raise OperationError("El archivo está vacío.")
    if len(data) > MAX_BYTES:
        raise OperationError("El archivo pasa de 10 MB.")
    folder = os.path.join(attachments_dir(), re.sub(r"[^\w\-]", "_", code))
    os.makedirs(folder, exist_ok=True)
    stored = f"{datetime.now():%Y%m%d%H%M%S%f}{ext}"
    with open(os.path.join(folder, stored), "wb") as fh:
        fh.write(data)
    att_id = run_write(
        "INSERT INTO mm_attachments (shipment_code, filename, content_type, size_bytes, stored_name, created_at, created_by) "
        "VALUES (?,?,?,?,?,?,?)", (code, name, ALLOWED[ext], len(data), stored, _now_iso(), _user(user)))
    audit(user, "INSERT", "mm_attachments", code, f"Adjunto agregado: {name} ({max(1, round(len(data) / 1024))} KB)")
    return records(run_query(
        "SELECT attachment_id, shipment_code, filename, content_type, size_bytes, created_at, created_by "
        "FROM mm_attachments WHERE attachment_id = ?", (att_id,)))[0]


def attachment_file(code: str, attachment_id: int) -> tuple[bytes, str, str]:
    rows = records(run_query("SELECT * FROM mm_attachments WHERE attachment_id = ? AND shipment_code = ?",
                             (attachment_id, code)))
    if not rows:
        raise LookupError(attachment_id)
    a = rows[0]
    path = os.path.join(attachments_dir(), re.sub(r"[^\w\-]", "_", code), a["stored_name"])
    if not os.path.exists(path):
        raise LookupError(attachment_id)
    with open(path, "rb") as fh:
        return fh.read(), a["content_type"], a["filename"]


def delete_attachment(code: str, attachment_id: int, user: str | None) -> None:
    rows = records(run_query("SELECT * FROM mm_attachments WHERE attachment_id = ? AND shipment_code = ?",
                             (attachment_id, code)))
    if not rows:
        raise LookupError(attachment_id)
    a = rows[0]
    path = os.path.join(attachments_dir(), re.sub(r"[^\w\-]", "_", code), a["stored_name"])
    if os.path.exists(path):
        os.remove(path)
    run_write("DELETE FROM mm_attachments WHERE attachment_id = ?", (attachment_id,))
    audit(user, "DELETE", "mm_attachments", code, f"Adjunto borrado: {a['filename']}")


def purge(code: str) -> None:
    """Al borrar un envío: sus notas, incidencias y archivos se van con él (el historial lo conserva)."""
    run_write("DELETE FROM mm_shipment_events WHERE shipment_code = ?", (code,))
    for a in records(run_query("SELECT stored_name FROM mm_attachments WHERE shipment_code = ?", (code,))):
        path = os.path.join(attachments_dir(), re.sub(r"[^\w\-]", "_", code), a["stored_name"])
        if os.path.exists(path):
            os.remove(path)
    run_write("DELETE FROM mm_attachments WHERE shipment_code = ?", (code,))
