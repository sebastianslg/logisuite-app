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


def send_text(to: str, subject: str, body: str) -> None:
    """Envía un correo de texto. Lanza OperationError si no hay SMTP o si el servidor de correo lo rechaza."""
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
    return (os.getenv("ADMIN_EMAIL") or "").strip() or None


def send_admin_async(subject: str, body: str) -> bool:
    """Aviso al administrador (ADMIN_EMAIL) en segundo plano. False si no hay SMTP o ADMIN_EMAIL."""
    to = admin_email()
    if not to or not configured():
        return False

    def run() -> None:
        try:
            send_text(to, subject, body)
        except OperationError:
            pass  # ya quedó en el registro del servidor

    threading.Thread(target=run, daemon=True).start()
    return True
