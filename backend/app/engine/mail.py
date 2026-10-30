"""
mail.py
Correos de la aplicación por el SMTP del .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM).

- Sin SMTP configurado no se envía nada (`configured()` es False y las funciones lo dicen; no fallan en silencio).
- `send_text` es síncrono con 10 s de tiempo máximo: quien lo llama decide si espera (el envío de un enlace al cliente)
  o lo manda a un hilo (avisos al administrador: `send_admin_async`).
- Nunca se registra el cuerpo ni la clave. En el historial solo queda la dirección enmascarada (`mask`).
"""
from __future__ import annotations

import logging
import os
import smtplib
import threading
from email.message import EmailMessage

from app.engine.common import OperationError

logger = logging.getLogger("westvane.mail")
TIMEOUT_S = 10


def configured() -> bool:
    return bool(os.getenv("SMTP_HOST"))


def mask(email: str) -> str:
    """juan.perez@empresa.com -> j***@empresa.com (el historial no guarda la dirección completa de un tercero)."""
    local, _, domain = (email or "").partition("@")
    return f"{local[:1]}***@{domain}" if domain else "***"


def public_url(path: str) -> str:
    """Enlace absoluto a la app (DOMAIN del .env)."""
    domain = os.getenv("DOMAIN", "").strip()
    if not domain:
        raise OperationError("Falta DOMAIN en la configuración del servidor: no se puede armar el enlace.")
    return f"https://{domain}{path}"


def send_text(to: str, subject: str, body: str, attachments: list | None = None) -> None:
    """Envía un correo de texto, con adjuntos opcionales [(bytes, nombre, "tipo/subtipo")]. Lanza OperationError si no
    hay SMTP o si el servidor de correo lo rechaza."""
    host = os.getenv("SMTP_HOST")
    if not host:
        raise OperationError("El envío de correo no está configurado en el servidor.")
    port = int(os.getenv("SMTP_PORT", "587"))
    user, password = os.getenv("SMTP_USER", ""), os.getenv("SMTP_PASS", "")
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = os.getenv("SMTP_FROM") or user
    msg["To"] = to
    msg.set_content(body)
    for data, name, mime in attachments or []:
        maintype, _, subtype = mime.partition("/")
        msg.add_attachment(data, maintype=maintype, subtype=subtype or "octet-stream", filename=name)
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=TIMEOUT_S) as server:
                if user and password:
                    server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=TIMEOUT_S) as server:
                server.starttls()
                if user and password:
                    server.login(user, password)
                server.send_message(msg)
    except Exception as exc:  # el motivo va al registro del servidor, no al navegador
        logger.error("No se pudo enviar el correo a %s: %s", mask(to), exc)
        raise OperationError("No se pudo enviar el correo: el servidor de correo no respondió. Intenta de nuevo.")


def admin_email() -> str | None:
    """Destino de los avisos: NOTIFY_EMAIL (el buzón de Westvane); si no existe, ADMIN_EMAIL. El ingreso sigue en ADMIN_EMAIL."""
    return (os.getenv("NOTIFY_EMAIL") or os.getenv("ADMIN_EMAIL") or "").strip() or None


# Tipos de aviso al administrador. Cada uno se apaga por separado en Configuración (system_params, MAIL_ALERT_<TIPO>).
ALERT_KINDS = {
    "vencimientos": "Resumen diario de SOAT, técnico-mecánicas y licencias por vencer",
    "novedades": "Aviso cuando una entrega llega con novedad",
    "semanal": "Reporte operativo de la semana en PDF, los lunes",
}
# Los avisos que piden atención arrancan encendidos; el reporte semanal es opcional: el dueño decide si lo quiere
DEFAULT_ON = {"vencimientos": True, "novedades": True, "semanal": False}


def alert_enabled(kind: str) -> bool:
    from app.database.db import run_query
    rows = run_query("SELECT param_value FROM system_params WHERE param_key = ?", (f"MAIL_ALERT_{kind.upper()}",))
    return DEFAULT_ON.get(kind, True) if rows.empty else str(rows.iloc[0]["param_value"]).lower() == "true"


def once_today(key: str, now) -> bool:
    """True la primera vez que se pide hoy. Se recuerda en la base, así que sobrevive a los reinicios del servidor (cada
    despliegue reinicia la app y, sin esto, repetiría el aviso diario)."""
    from app.database.db import run_query, run_write
    day = now.strftime("%Y-%m-%d")
    name = f"MAIL_LAST_{key.upper()}"
    rows = run_query("SELECT param_value FROM system_params WHERE param_key = ?", (name,))
    if not rows.empty and str(rows.iloc[0]["param_value"]) == day:
        return False
    run_write("""INSERT INTO system_params (param_key, param_value, description) VALUES (?,?,?)
                 ON CONFLICT(param_key) DO UPDATE SET param_value = excluded.param_value""",
              (name, day, "Último día en que salió este aviso por correo"))
    return True


def set_alert(kind: str, enabled: bool, user: str | None) -> None:
    from app.database.db import run_write
    from app.engine.common import audit
    if kind not in ALERT_KINDS:
        raise OperationError("Tipo de aviso no válido.")
    run_write("""INSERT INTO system_params (param_key, param_value, description) VALUES (?,?,?)
                 ON CONFLICT(param_key) DO UPDATE SET param_value = excluded.param_value""",
              (f"MAIL_ALERT_{kind.upper()}", "true" if enabled else "false", ALERT_KINDS[kind]))
    audit(user, "UPDATE", "system_params", f"MAIL_ALERT_{kind.upper()}",
          f"Aviso por correo «{ALERT_KINDS[kind]}»: {'activado' if enabled else 'desactivado'}")


def alerts_state() -> dict:
    to = admin_email()
    return {"configured": configured(), "admin_email": mask(to) if to else None,
            "alerts": [{"kind": k, "label": label, "enabled": alert_enabled(k)} for k, label in ALERT_KINDS.items()]}


def send_admin_async(subject: str, body: str, kind: str | None = None, attachments: list | None = None) -> bool:
    """Aviso al administrador (ADMIN_EMAIL) en segundo plano. False si no hay SMTP o ADMIN_EMAIL, o si ese tipo de aviso
    está apagado. Cada correo termina diciendo cómo dejar de recibirlo."""
    to = admin_email()
    if not to or not configured():
        return False
    if kind is not None and not alert_enabled(kind):
        return False
    try:
        where = public_url("/configuracion")
    except OperationError:
        where = "la pantalla Configuración de Westvane"
    body = f"{body}\n\n--\nPara dejar de recibir estos avisos: {where} (sección «Avisos por correo»)."

    def run() -> None:
        try:
            send_text(to, subject, body, attachments)
        except OperationError:
            pass  # ya quedó en el registro del servidor

    threading.Thread(target=run, daemon=True).start()
    return True
