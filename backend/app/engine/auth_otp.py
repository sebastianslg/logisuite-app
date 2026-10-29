"""
auth_otp.py
Autenticación sin contraseñas (Passwordless OTP por correo electrónico) y gestión de roles y empresas.
- Generación de código numérico aleatorio de 6 dígitos con expiración de 10 minutos.
- Almacenamiento seguro del código (hash SHA-256 con salt aleatorio).
- Manejo de sesiones de usuario con tokens seguros de 32 bytes.
- Soporte para envío SMTP si está configurado en .env (SMTP_HOST, etc.) y modo desarrollo/test con registro local.
- Jerarquía de roles: admin (3), operador (2), lector (1).
"""
import hashlib
import hmac
import logging
import os
import re
import secrets
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage
from typing import Optional

from app.database.db import run_query, run_write
from app.engine.common import OperationError, audit

logger = logging.getLogger("westvane.auth")

ROLES = ("admin", "operador", "lector")
ROLE_LEVEL = {"lector": 1, "operador": 2, "admin": 3}
CODE_TTL_MINUTES = 10
SESSION_TTL_DAYS = 30
MAX_ATTEMPTS = 5

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Almacén de depuración en memoria para pruebas automáticas cuando no hay servidor SMTP
_LAST_GENERATED_CODES: dict[str, str] = {}


def _now() -> datetime:
    return datetime.now()


def _now_str() -> str:
    return _now().strftime("%Y-%m-%d %H:%M:%S")


def _hash_code(code: str, salt: str | None = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.sha256(f"{salt}:{code}".encode()).hexdigest()
    return hashed, salt


def _verify_code(code: str, stored_hash: str, salt: str) -> bool:
    candidate = hashlib.sha256(f"{salt}:{code}".encode()).hexdigest()
    return hmac.compare_digest(candidate, stored_hash)


def normalize_email(email: str) -> str:
    clean = (email or "").strip().lower()
    if not clean or not EMAIL_REGEX.match(clean):
        raise OperationError("Correo electrónico no válido.")
    return clean


def send_email_code(email: str, code: str) -> None:
    """Envía el código por correo si SMTP está configurado; si no, lo registra en log."""
    _LAST_GENERATED_CODES[email] = code
    smtp_host = os.getenv("SMTP_HOST")
    if not smtp_host:
        logger.info("Código OTP para %s: %s (SMTP no configurado, modo local/desarrollo)", email, code)
        return

    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    sender = os.getenv("SMTP_FROM", "no-reply@westvane.com")

    msg = EmailMessage()
    msg["Subject"] = f"{code} es tu código de acceso a Westvane TMS"
    msg["From"] = sender
    msg["To"] = email
    msg.set_content(
        f"Hola,\n\nTu código de verificación para ingresar a Westvane TMS es:\n\n"
        f"    {code}\n\n"
        f"Este código vence en {CODE_TTL_MINUTES} minutos. Si no solicitaste este acceso, puedes ignorar este mensaje.\n\n"
        f"Westvane TMS - Gestión de Transporte Multimodal en Colombia"
    )

    try:
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10) as server:
                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)
                server.send_message(msg)
        logger.info("Código OTP enviado por SMTP a %s", email)
    except Exception as exc:
        logger.error("Error enviando correo SMTP a %s: %s", email, exc)
        # No bloqueamos el proceso para permitir fallback en caso de indisponibilidad temporal


def request_otp(email: str) -> dict:
    """Genera y envía un código OTP de 6 dígitos."""
    norm_email = normalize_email(email)

    # Verificar que el usuario exista y esté activo
    u_df = run_query("SELECT user_id, active FROM users WHERE LOWER(email) = ?", (norm_email,))
    if u_df.empty or not u_df.iloc[0]["active"]:
        raise OperationError("El correo no está registrado como usuario activo del sistema.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    code_hash, salt = _hash_code(code)
    now = _now()
    expires_at = (now + timedelta(minutes=CODE_TTL_MINUTES)).strftime("%Y-%m-%d %H:%M:%S")

    run_write(
        """INSERT INTO auth_codes (email, code_hash, salt, attempts, expires_at, created_at)
           VALUES (?, ?, ?, 0, ?, ?)""",
        (norm_email, code_hash, salt, expires_at, now.strftime("%Y-%m-%d %H:%M:%S")),
    )

    send_email_code(norm_email, code)
    return {
        "ok": True,
        "message": f"Código enviado a {norm_email}. Válido por {CODE_TTL_MINUTES} minutos.",
        "expires_in_minutes": CODE_TTL_MINUTES,
        # Si estamos en entorno de pruebas/desarrollo sin SMTP, se entrega el código en depuración
        "dev_code": code if not os.getenv("SMTP_HOST") else None,
    }


def verify_otp(email: str, code: str) -> dict:
    """Verifica el código OTP y entrega token de sesión."""
    norm_email = normalize_email(email)
    clean_code = (code or "").strip()
    if not clean_code or len(clean_code) != 6 or not clean_code.isdigit():
        raise OperationError("El código debe ser de 6 dígitos numéricos.")

    # Buscar el último código activo no usado
    rows = run_query(
        """SELECT code_id, code_hash, salt, attempts, expires_at
           FROM auth_codes
           WHERE email = ? AND used_at IS NULL
           ORDER BY code_id DESC LIMIT 1""",
        (norm_email,),
    )
    if rows.empty:
        raise OperationError("No hay ningún código pendiente de verificación para este correo.")

    rec = rows.iloc[0].to_dict()
    now_str = _now_str()

    if rec["expires_at"] < now_str:
        raise OperationError("El código ha vencido. Solicita uno nuevo.")

    if rec["attempts"] >= MAX_ATTEMPTS:
        raise OperationError("Has superado el número máximo de intentos. Solicita un código nuevo.")

    # Incrementar contador de intentos
    run_write("UPDATE auth_codes SET attempts = attempts + 1 WHERE code_id = ?", (rec["code_id"],))

    if not _verify_code(clean_code, rec["code_hash"], rec["salt"]):
        left = MAX_ATTEMPTS - (rec["attempts"] + 1)
        raise OperationError(f"Código incorrecto. Te quedan {max(0, left)} intentos.")

    # Marcar como usado
    run_write("UPDATE auth_codes SET used_at = ? WHERE code_id = ?", (now_str, rec["code_id"]))

    # Obtener el usuario y su empresa
    user_rows = run_query(
        """SELECT u.user_id, u.username, u.full_name, u.email, u.role, u.active,
                  c.company_id, c.name as company_name, c.nit as company_nit
           FROM users u
           LEFT JOIN companies c ON u.company_id = c.company_id
           WHERE LOWER(u.email) = ? AND u.active = 1""",
        (norm_email,),
    )
    if user_rows.empty:
        raise OperationError("Usuario inactivo o no encontrado.")

    user = user_rows.iloc[0].to_dict()

    # Generar sesión
    session_id = secrets.token_urlsafe(32)
    session_exp = (_now() + timedelta(days=SESSION_TTL_DAYS)).strftime("%Y-%m-%d %H:%M:%S")
    run_write(
        "INSERT INTO user_sessions (session_id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
        (session_id, user["user_id"], session_exp, now_str),
    )

    audit(user["username"], "LOGIN", "users", str(user["user_id"]), f"Inicio de sesión con código por correo ({norm_email})")

    return {
        "token": session_id,
        "user": {
            "user_id": user["user_id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"],
            "company": {
                "company_id": user["company_id"],
                "name": user["company_name"],
                "nit": user["company_nit"],
            } if user["company_id"] else None,
        },
    }


def get_user_by_session(session_id: str | None) -> Optional[dict]:
    """Valida un token de sesión y devuelve el usuario asociado."""
    if not session_id or not session_id.strip():
        return None

    now_str = _now_str()
    rows = run_query(
        """SELECT u.user_id, u.username, u.full_name, u.email, u.role, u.active,
                  c.company_id, c.name as company_name, c.nit as company_nit,
                  s.expires_at
           FROM user_sessions s
           JOIN users u ON s.user_id = u.user_id
           LEFT JOIN companies c ON u.company_id = c.company_id
           WHERE s.session_id = ? AND u.active = 1""",
        (session_id.strip(),),
    )
    if rows.empty:
        return None

    r = rows.iloc[0].to_dict()
    if r["expires_at"] < now_str:
        run_write("DELETE FROM user_sessions WHERE session_id = ?", (session_id,))
        return None

    return {
        "user_id": r["user_id"],
        "username": r["username"],
        "full_name": r["full_name"],
        "email": r["email"],
        "role": r["role"],
        "company": {
            "company_id": r["company_id"],
            "name": r["company_name"],
            "nit": r["company_nit"],
        } if r["company_id"] else None,
    }


def logout(session_id: str | None, current_user: str | None = None) -> None:
    if session_id:
        run_write("DELETE FROM user_sessions WHERE session_id = ?", (session_id.strip(),))
        if current_user:
            audit(current_user, "LOGOUT", "users", None, "Cierre de sesión")


# ---------------------------------------------------------------------------
# Gestión de empresas y usuarios
# ---------------------------------------------------------------------------

def list_companies() -> list[dict]:
    rows = run_query("SELECT company_id, name, nit, active, created_at FROM companies ORDER BY name ASC")
    return rows.to_dict(orient="records")


def create_company(name: str, nit: str | None = None, operator: str | None = None) -> dict:
    name_clean = (name or "").strip()
    if not name_clean:
        raise OperationError("El nombre de la empresa es obligatorio.")

    exists = run_query("SELECT company_id FROM companies WHERE LOWER(name) = ?", (name_clean.lower(),))
    if not exists.empty:
        raise OperationError(f"La empresa '{name_clean}' ya está registrada.")

    now_str = _now_str()
    cid = run_write(
        "INSERT INTO companies (name, nit, active, created_at) VALUES (?, ?, 1, ?)",
        (name_clean, (nit or "").strip() or None, now_str),
    )
    audit(operator, "INSERT", "companies", str(cid), f"Creación de empresa: {name_clean}")
    return {"company_id": cid, "name": name_clean, "nit": nit, "active": 1, "created_at": now_str}


def list_users() -> list[dict]:
    rows = run_query(
        """SELECT u.user_id, u.username, u.full_name, u.email, u.role, u.active, u.created_at,
                  c.company_id, c.name as company_name
           FROM users u
           LEFT JOIN companies c ON u.company_id = c.company_id
           ORDER BY u.user_id ASC"""
    )
    return rows.to_dict(orient="records")


def create_user_record(
    email: str,
    full_name: str,
    role: str = "operador",
    company_id: int | None = None,
    operator: str | None = None,
) -> dict:
    norm_email = normalize_email(email)
    name_clean = (full_name or "").strip()
    if not name_clean:
        raise OperationError("El nombre completo es obligatorio.")
    if role not in ROLE_LEVEL:
        raise OperationError(f"Rol no válido: '{role}'. Roles permitidos: {', '.join(ROLES)}.")

    exists = run_query("SELECT user_id FROM users WHERE LOWER(email) = ?", (norm_email,))
    if not exists.empty:
        raise OperationError(f"Ya existe un usuario registrado con el correo {norm_email}.")

    username = norm_email.split("@")[0]
    # Si el username ya existe, agregar sufijo aleatorio
    if not run_query("SELECT user_id FROM users WHERE username = ?", (username,)).empty:
        username = f"{username}_{secrets.token_hex(2)}"

    now_str = _now_str()
    # Generar salt y dummy password_hash para cumplir restricciones de schema existente
    dummy_hash, salt = _hash_code(secrets.token_hex(16))

    uid = run_write(
        """INSERT INTO users (username, full_name, email, role, company_id, password_hash, salt, active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)""",
        (username, name_clean, norm_email, role, company_id, dummy_hash, salt, now_str),
    )
    audit(operator, "INSERT", "users", str(uid), f"Creación de usuario: {norm_email} ({role})")
    return {
        "user_id": uid,
        "username": username,
        "full_name": name_clean,
        "email": norm_email,
        "role": role,
        "company_id": company_id,
        "active": 1,
        "created_at": now_str,
    }


def update_user_role(user_id: int, role: str, operator: str | None = None) -> dict:
    if role not in ROLE_LEVEL:
        raise OperationError(f"Rol no válido: '{role}'.")

    u = run_query("SELECT user_id, username, email, role FROM users WHERE user_id = ?", (user_id,))
    if u.empty:
        raise OperationError("Usuario no encontrado.")

    old_role = u.iloc[0]["role"]
    run_write("UPDATE users SET role = ? WHERE user_id = ?", (role, user_id))
    audit(operator, "UPDATE", "users", str(user_id), f"Cambio de rol de {old_role} a {role}")
    return {"user_id": user_id, "role": role}
