"""
demo.py
Solicitudes de demostración que llegan desde la presentación comercial (/).

- Cualquiera puede enviar una (la presentación es pública); se frena el abuso con un campo trampa para robots, el límite
  general de escrituras de `api/guard.py` y un tope de solicitudes por conexión al día.
- Son datos personales de contacto: se guarda el texto exacto de la autorización aceptada y un resumen de la IP (no la IP).
- Cada solicitud avisa por correo al buzón de Westvane (`NOTIFY_EMAIL`, tipo de aviso «demos», apagable). A quien la envía
  no se le escribe: un formulario público que manda correos a cualquier dirección sería un relevo de spam.
- Solo un administrador las ve, las marca como atendidas o las borra.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta

from app.database.db import run_query, run_write
from app.engine import legal, mail
from app.engine.common import OperationError, audit, records

CONSENT_TEXT = ("Autorizo a Westvane a usar estos datos solo para responder mi solicitud y contactarme sobre la "
                "demostración, según la política de privacidad.")
FLEET_SIZES = ("1 a 10 vehículos", "11 a 50 vehículos", "51 a 200 vehículos", "Más de 200 vehículos", "No tenemos flota propia")
MAX_PER_DAY = 5
_EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")
_PHONE = re.compile(r"^[+\d][\d\s().-]{6,19}$")


def _text(value, label: str, *, required: bool = True, min_len: int = 2, max_len: int = 120) -> str | None:
    s = " ".join(str(value or "").split())
    if not s:
        if required:
            raise OperationError(f"Falta {label}.")
        return None
    if len(s) < min_len:
        raise OperationError(f"{label[0].upper()}{label[1:]} es muy corto.")
    if len(s) > max_len:
        raise OperationError(f"{label[0].upper()}{label[1:]} pasa de {max_len} caracteres.")
    return s


def submit(data: dict, ip: str | None, now: datetime) -> dict:
    """Guarda la solicitud y avisa al buzón. Devuelve solo el número de la solicitud (nada que filtre datos)."""
    if str(data.get("website") or "").strip():
        # Campo trampa: invisible para personas, lo llenan los robots. Se responde igual que a un envío válido.
        return {"ok": True, "request_id": None}
    if not data.get("accepted"):
        raise OperationError("Para enviarla, acepte el uso de sus datos para responder la solicitud.")
    name = _text(data.get("name"), "su nombre", max_len=80)
    company = _text(data.get("company"), "el nombre de la empresa")
    email = (str(data.get("email") or "").strip().lower())
    if not _EMAIL.match(email) or len(email) > 254:
        raise OperationError("Revise el correo: no parece una dirección válida.")
    phone = _text(data.get("phone"), "el teléfono", required=False, min_len=7, max_len=20)
    if phone and not _PHONE.match(phone):
        raise OperationError("Revise el teléfono: use solo números, espacios, +, guiones o paréntesis.")
    role = _text(data.get("role"), "el cargo", required=False, max_len=80)
    fleet = data.get("fleet_size") or None
    if fleet is not None and fleet not in FLEET_SIZES:
        raise OperationError("Elija el tamaño de la flota de la lista.")
    message = _text(data.get("message"), "el mensaje", required=False, min_len=1, max_len=1500)

    digest = legal.ip_hash(ip)
    since = (now - timedelta(days=1)).isoformat(timespec="seconds")
    if digest and len(run_query("SELECT 1 FROM demo_requests WHERE ip_hash = ? AND created_at >= ?", (digest, since))) >= MAX_PER_DAY:
        raise OperationError("Ya recibimos varias solicitudes desde esta conexión hoy. Le escribiremos pronto.")

    rid = run_write("""INSERT INTO demo_requests (created_at, name, company, email, phone, role, fleet_size, message,
                       consent_text, ip_hash) VALUES (?,?,?,?,?,?,?,?,?,?)""",
                    (now.isoformat(timespec="seconds"), name, company, email, phone, role, fleet, message, CONSENT_TEXT, digest))
    audit("presentación", "INSERT", "demo_requests", str(rid), f"Solicitud de demostración de {company}")
    body = "\n".join(line for line in [
        f"{name} pidió una demostración de Westvane.",
        "",
        f"Empresa: {company}",
        f"Cargo: {role}" if role else None,
        f"Correo: {email}",
        f"Teléfono: {phone}" if phone else None,
        f"Flota: {fleet}" if fleet else None,
        "",
        f"Mensaje: {message}" if message else "Sin mensaje.",
        "",
        "La solicitud queda en Administración › Solicitudes de demostración.",
    ] if line is not None)
    mail.send_admin_async(f"Solicitud de demostración: {company}", body, kind="demos")
    return {"ok": True, "request_id": rid}


def list_requests(limit: int = 200) -> list:
    return records(run_query("""SELECT request_id, created_at, name, company, email, phone, role, fleet_size, message,
                                       handled_at, handled_by FROM demo_requests ORDER BY request_id DESC LIMIT ?""",
                             (max(1, min(limit, 1000)),)))


def set_handled(request_id: int, handled: bool, user: str | None, now: datetime) -> dict:
    if run_query("SELECT 1 FROM demo_requests WHERE request_id = ?", (request_id,)).empty:
        raise LookupError(request_id)
    run_write("UPDATE demo_requests SET handled_at = ?, handled_by = ? WHERE request_id = ?",
              (now.isoformat(timespec="seconds") if handled else None, user if handled else None, request_id))
    audit(user, "UPDATE", "demo_requests", str(request_id), "Solicitud atendida" if handled else "Solicitud pendiente otra vez")
    return next(r for r in list_requests(1000) if r["request_id"] == request_id)


def delete(request_id: int, user: str | None) -> None:
    rows = run_query("SELECT company FROM demo_requests WHERE request_id = ?", (request_id,))
    if rows.empty:
        raise LookupError(request_id)
    run_write("DELETE FROM demo_requests WHERE request_id = ?", (request_id,))
    audit(user, "DELETE", "demo_requests", str(request_id), f"Solicitud de demostración borrada ({rows.iloc[0]['company']})")
