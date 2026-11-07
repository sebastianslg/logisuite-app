"""
client_notify.py
Avisos al cliente por correo cuando su envío cambia de estado: salió, se retrasó o llegó.

- La dirección es opcional y se guarda en el envío (`client_email`). Sin ella, no se envía nada.
- El estado de un envío se deriva del reloj, no de una acción: por eso no hay un «evento» que disparar. Cada pasada compara
  el estado de ahora con el último que ya se avisó (`last_notified_status`) y solo envía cuando cambia.
- Solo se avisa de tres cambios: **En Ruta** (salió), **Retrasado** y **Entregado**. Los estados intermedios
  (Transferencia Modal) no generan correo, para no llenar la bandeja del cliente.
- El correo lleva el código, origen, destino y el enlace de seguimiento si el envío tiene uno activo; nunca costos, cliente,
  peso ni datos internos.
- La dirección es un dato personal: se borra con el plazo de conservación (ATTACHMENT_RETENTION_DAYS) y al borrar el envío.
"""
from __future__ import annotations

from datetime import datetime

from app.database.db import run_query, run_write
from app.engine import mail
from app.engine.auth_otp import normalize_email
from app.engine.common import OperationError, audit, records
from app.engine.dispatch import status_at

# Estados que sí se avisan, con el asunto y la primera línea del correo
NOTIFY = {
    "En Ruta": ("Salió tu envío {code}", "Tu envío {code} ya salió de {origen} hacia {destino}."),
    "Retrasado": ("Tu envío {code} va con retraso", "Tu envío {code} ({origen} a {destino}) va con un retraso de {retraso}."),
    "Entregado": ("Tu envío {code} llegó", "Tu envío {code} llegó a {destino}."),
}


def set_client_email(code: str, email: str | None, user: str | None) -> dict:
    """Guarda (o borra, con None) el correo del cliente para avisarle. Valida el formato."""
    rows = run_query("SELECT shipment_code FROM mm_shipments WHERE shipment_code = ?", (code,))
    if rows.empty:
        raise LookupError(code)
    if email is None or not str(email).strip():
        run_write("UPDATE mm_shipments SET client_email = NULL, last_notified_status = NULL WHERE shipment_code = ?", (code,))
        audit(user, "UPDATE", "mm_shipments", code, "Correo del cliente borrado: no se le avisará más")
        return {"code": code, "client_email": None}
    limpio = normalize_email(email)
    run_write("UPDATE mm_shipments SET client_email = ?, last_notified_status = NULL WHERE shipment_code = ?", (limpio, code))
    audit(user, "UPDATE", "mm_shipments", code, f"Avisos al cliente activados ({mail.mask(limpio)})")
    return {"code": code, "client_email": limpio}


def _link(code: str) -> str | None:
    """El enlace de seguimiento activo más reciente, si hay."""
    rows = run_query("SELECT token FROM mm_tracking_links WHERE shipment_code = ? AND revoked_at IS NULL "
                     "ORDER BY created_at DESC LIMIT 1", (code,))
    if rows.empty:
        return None
    try:
        return mail.public_url(f"/seguimiento/{rows.iloc[0]['token']}")
    except OperationError:
        return None


def check(now: datetime) -> int:
    """Envía los avisos que toquen. Devuelve cuántos correos salieron.

    Se llama desde la sincronización periódica (cada pocos minutos). Si no hay SMTP configurado, no hace nada."""
    if not mail.configured():
        return 0
    # Se miran los envíos con correo del cliente; el filtro fino (estado distinto al avisado) se hace abajo.
    pendientes = records(run_query("SELECT * FROM mm_shipments WHERE client_email IS NOT NULL AND client_email != ''"))
    enviados = 0
    for s in pendientes:
        estado = status_at(s, now)["status"]
        if estado not in NOTIFY or estado == (s.get("last_notified_status") or ""):
            continue
        asunto, cuerpo = NOTIFY[estado]
        datos = {"code": s["shipment_code"], "origen": s["origin_city"], "destino": s["dest_city"],
                 "retraso": f"{float(s.get('delay_h') or 0):g} h"}
        texto = cuerpo.format(**datos)
        enlace = _link(s["shipment_code"])
        if enlace:
            texto += f"\n\nPuedes verlo aquí: {enlace}"
        texto += "\n\nWestvane TMS"
        try:
            mail.send_text(s["client_email"], asunto.format(**datos), texto)
        except OperationError:
            continue  # el motivo queda en el registro del servidor; se reintenta en la próxima pasada
        run_write("UPDATE mm_shipments SET last_notified_status = ? WHERE shipment_code = ?", (estado, s["shipment_code"]))
        audit("sistema", "EMAIL", "mm_shipments", s["shipment_code"],
              f"Aviso al cliente ({mail.mask(s['client_email'])}): {asunto.format(**datos)}")
        enviados += 1
    return enviados


def purge_emails(now: datetime, days: int) -> int:
    """Borra la dirección del cliente de los envíos entregados hace más de `days` días (dato personal)."""
    if not days:
        return 0
    from datetime import timedelta

    cutoff = (now - timedelta(days=days)).isoformat(timespec="minutes")
    rows = records(run_query("SELECT shipment_code FROM mm_shipments WHERE client_email IS NOT NULL AND status = 'Entregado' "
                             "AND eta_at < ?", (cutoff,)))
    for r in rows:
        run_write("UPDATE mm_shipments SET client_email = NULL WHERE shipment_code = ?", (r["shipment_code"],))
        audit("sistema", "UPDATE", "mm_shipments", r["shipment_code"],
              f"Correo del cliente borrado por el plazo de conservación ({days} días)")
    return len(rows)
