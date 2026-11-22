"""
auth_otp.py
Autenticación sin contraseñas (Passwordless OTP por correo electrónico) y gestión de roles y empresas.
- Generación de código numérico aleatorio de 6 dígitos con expiración de 10 minutos.
- Almacenamiento seguro del código (hash SHA-256 con salt aleatorio).
- Manejo de sesiones de usuario con tokens seguros de 32 bytes.
- Envío por SMTP (SMTP_HOST, etc. en .env). Sin SMTP el servidor NO entrega códigos: iniciar sesión queda
  deshabilitado. Solo con WESTVANE_DEV_OTP=1 (desarrollo y pruebas) el código se registra en el log y se devuelve en
  la respuesta (`dev_code`); en producción esa variable no se define nunca.
- El primer administrador sale de ADMIN_EMAIL (y ADMIN_NAME) en el .env; administrar usuarios y empresas exige
  sesión de administrador.
- Jerarquía de roles: admin (3), operador (2), lector (1).
- Además del código, una cuenta puede tener contraseña (PBKDF2-SHA256): se ingresa con el usuario o el correo. Se le pone
  desde la consola del servidor (`python -m app.crear_acceso`), nunca desde la web. Tras 5 fallos seguidos la cuenta no
  acepta contraseña por 15 minutos.
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

from app.database.db import fetch_all, run_query, run_write
from app.engine.common import OperationError, audit

logger = logging.getLogger("westvane.auth")

ROLES = ("admin", "operador", "lector")
ROLE_LEVEL = {"lector": 1, "operador": 2, "admin": 3}
CODE_TTL_MINUTES = 10
SESSION_TTL_DAYS = 30
MAX_ATTEMPTS = 5

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

PASSWORD_PREFIX = "pbkdf2$"
PASSWORD_ITERATIONS = 310_000
PASSWORD_MIN_LEN = 10
MAX_PASSWORD_FAILURES = 5
LOCK_MINUTES = 15

OTP_COOLDOWN_S = 60  # segundos mínimos entre dos códigos pedidos para el mismo correo
AUTH_CODE_RETENTION_DAYS = 7  # días que se conservan los códigos ya usados o vencidos antes de borrarlos


def dev_otp_enabled() -> bool:
    """Modo de desarrollo y pruebas: el código se devuelve en la respuesta. Nunca en producción."""
    return os.getenv("WESTVANE_DEV_OTP") == "1"


def mail_configured() -> bool:
    return bool(os.getenv("SMTP_HOST"))


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
    """Envía el código por correo (SMTP). Sin SMTP solo registra el código en el modo de desarrollo."""
    smtp_host = os.getenv("SMTP_HOST")
    if not smtp_host:
        # Solo en modo de desarrollo: sin correo configurado, en producción nunca se llega aquí (request_otp lo impide)
        logger.info("Código OTP para %s: %s (modo de desarrollo, sin SMTP)", email, code)
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
    if not mail_configured() and not dev_otp_enabled():
        raise OperationError("El envío de correo no está configurado en el servidor: por ahora no se puede iniciar sesión.")

    generic = {
        "ok": True,
        "message": f"Si {norm_email} está registrado, recibirá un código. Válido por {CODE_TTL_MINUTES} minutos.",
        "expires_in_minutes": CODE_TTL_MINUTES,
        "dev_code": None,
    }
    # La respuesta no revela si el correo existe (no se puede averiguar quién tiene cuenta)
    u_df = run_query("SELECT user_id, active FROM users WHERE LOWER(email) = ?", (norm_email,))
    if u_df.empty or not u_df.iloc[0]["active"]:
        return generic

    # Un código nuevo por correo cada OTP_COOLDOWN_S (en silencio): frena el reenvío masivo y el reintento de códigos
    cooldown = int(os.getenv("WESTVANE_OTP_COOLDOWN_S", str(OTP_COOLDOWN_S)))
    if cooldown > 0:
        recent = run_query("SELECT created_at FROM auth_codes WHERE email = ? ORDER BY code_id DESC LIMIT 1", (norm_email,))
        if not recent.empty:
            last = datetime.strptime(recent.iloc[0]["created_at"], "%Y-%m-%d %H:%M:%S")
            if (_now() - last).total_seconds() < cooldown:
                return generic  # misma respuesta que para un correo sin cuenta: un error aquí delataría quién está registrado

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
    return {**generic, "dev_code": code if dev_otp_enabled() else None}


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
    return _open_session(user, f"Inicio de sesión con código por correo ({norm_email})")


def _open_session(user: dict, how: str) -> dict:
    """Crea la sesión (token de 32 bytes, SESSION_TTL_DAYS días) y la deja en el historial."""
    now_str = _now_str()
    session_id = secrets.token_urlsafe(32)
    session_exp = (_now() + timedelta(days=SESSION_TTL_DAYS)).strftime("%Y-%m-%d %H:%M:%S")
    run_write(
        "INSERT INTO user_sessions (session_id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
        (session_id, int(user["user_id"]), session_exp, now_str),
    )
    audit(user["username"], "LOGIN", "users", str(user["user_id"]), how)

    return {"token": session_id, "user": _public_user(user)}


def _clean(v):
    """None para los vacíos que pandas entrega como NaN (romperían el JSON) y enteros de Python para los de numpy."""
    if v is None or (isinstance(v, float) and v != v):
        return None
    return v.item() if hasattr(v, "item") else v


def _public_user(r: dict) -> dict:
    cid = _clean(r.get("company_id"))
    return {
        "user_id": int(r["user_id"]),
        "username": r["username"],
        "full_name": r["full_name"],
        "email": _clean(r.get("email")),
        "role": r["role"],
        "company": {"company_id": int(cid), "name": _clean(r.get("company_name")), "nit": _clean(r.get("company_nit"))}
        if cid is not None else None,
        # Las cuentas creadas solo con código al correo no tienen contraseña: no se les muestra «cambiar contraseña»
        "has_password": str(r.get("password_hash") or "").startswith(PASSWORD_PREFIX),
    }


def get_user_by_session(session_id: str | None) -> Optional[dict]:
    """Valida un token de sesión y devuelve el usuario asociado."""
    if not session_id or not session_id.strip():
        return None

    now_str = _now_str()
    rows = fetch_all(
        """SELECT u.user_id, u.username, u.full_name, u.email, u.role, u.active, u.password_hash,
                  c.company_id, c.name as company_name, c.nit as company_nit,
                  s.expires_at
           FROM user_sessions s
           JOIN users u ON s.user_id = u.user_id
           LEFT JOIN companies c ON u.company_id = c.company_id
           WHERE s.session_id = ? AND u.active = 1""",
        (session_id.strip(),),
    )
    if not rows:
        return None

    r = rows[0]
    if r["expires_at"] < now_str:
        run_write("DELETE FROM user_sessions WHERE session_id = ?", (session_id,))
        return None

    return _public_user(r)


def logout(session_id: str | None, current_user: str | None = None) -> None:
    if session_id:
        run_write("DELETE FROM user_sessions WHERE session_id = ?", (session_id.strip(),))
        if current_user:
            audit(current_user, "LOGOUT", "users", None, "Cierre de sesión")


def purge_expired_auth(now: datetime | None = None) -> dict:
    """Borra lo que ya no sirve para entrar: las sesiones vencidas y los códigos de ingreso usados o vencidos hace
    más de AUTH_CODE_RETENTION_DAYS días. Devuelve cuántos borró de cada uno.

    Las sesiones vigentes y los códigos recientes se quedan: un código se guarda unos días por si hay que revisar un
    intento fallido, y una sesión se borra solo cuando ya no vale (get_user_by_session la rechaza igual). Las fechas
    son texto «AAAA-MM-DD HH:MM:SS», que ordena como el tiempo, igual que en el resto del módulo. No se registra en
    el log ningún código ni token: solo se cuenta."""
    now = now or _now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    cutoff = (now - timedelta(days=AUTH_CODE_RETENTION_DAYS)).strftime("%Y-%m-%d %H:%M:%S")

    sesiones = run_write("DELETE FROM user_sessions WHERE expires_at < ?", (now_str,))
    codigos = run_write(
        """DELETE FROM auth_codes
           WHERE (used_at IS NOT NULL AND used_at < ?) OR expires_at < ?""",
        (cutoff, cutoff),
    )
    return {"sesiones": int(sesiones or 0), "codigos": int(codigos or 0)}


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
    return fetch_all(
        """SELECT u.user_id, u.username, u.full_name, u.email, u.role, u.active, u.created_at,
                  c.company_id, c.name as company_name
           FROM users u
           LEFT JOIN companies c ON u.company_id = c.company_id
           ORDER BY u.user_id ASC"""
    )


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


def update_user_active(user_id: int, active: bool, operator: str | None = None, acting_user_id: int | None = None) -> dict:
    """Activa o desactiva a un usuario. Desactivar le cierra las sesiones y le impide pedir códigos. No se puede
    desactivar a quien está administrando ni al último administrador activo."""
    u = run_query("SELECT user_id, email, role, active FROM users WHERE user_id = ?", (user_id,))
    if u.empty:
        raise OperationError("Usuario no encontrado.")
    row = u.iloc[0]
    if bool(row["active"]) == active:
        return {"user_id": user_id, "active": int(active)}
    if not active:
        if acting_user_id is not None and user_id == acting_user_id:
            raise OperationError("No puedes desactivarte a ti mismo: perderías el acceso.")
        if row["role"] == "admin":
            admins = run_query("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND email IS NOT NULL").iloc[0]["n"]
            if admins <= 1:
                raise OperationError("Debe quedar al menos un administrador: no se puede desactivar al último.")
    run_write("UPDATE users SET active = ? WHERE user_id = ?", (1 if active else 0, user_id))
    if not active:
        run_write("DELETE FROM user_sessions WHERE user_id = ?", (user_id,))
    audit(operator, "UPDATE", "users", str(user_id), f"Usuario {'activado' if active else 'desactivado'} ({row['email']})")
    return {"user_id": user_id, "active": int(active)}


def ensure_bootstrap_admin() -> None:
    """Primer administrador: el correo de ADMIN_EMAIL (con ADMIN_NAME) del .env. Se crea si falta y, si ya existe,
    se asegura de que sea administrador activo. Sin ADMIN_EMAIL no hace nada."""
    raw = (os.getenv("ADMIN_EMAIL") or "").strip()
    if not raw:
        return
    try:
        email = normalize_email(raw)
    except OperationError:
        logger.error("ADMIN_EMAIL no es un correo válido: no se creó el administrador inicial.")
        return
    found = run_query("SELECT user_id, role, active FROM users WHERE LOWER(email) = ?", (email,))
    if found.empty:
        create_user_record(email, os.getenv("ADMIN_NAME") or "Administrador", "admin", None, operator="sistema")
    elif found.iloc[0]["role"] != "admin" or not found.iloc[0]["active"]:
        run_write("UPDATE users SET role = 'admin', active = 1 WHERE user_id = ?", (int(found.iloc[0]["user_id"]),))
        audit("sistema", "UPDATE", "users", str(int(found.iloc[0]["user_id"])), f"Administrador inicial restablecido ({email})")


def update_user_role(user_id: int, role: str, operator: str | None = None) -> dict:
    if role not in ROLE_LEVEL:
        raise OperationError(f"Rol no válido: '{role}'.")
    cur = run_query("SELECT role, active FROM users WHERE user_id = ?", (user_id,))
    if not cur.empty and cur.iloc[0]["role"] == "admin" and role != "admin" and cur.iloc[0]["active"]:
        admins = run_query("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND email IS NOT NULL").iloc[0]["n"]
        if admins <= 1:
            raise OperationError("Debe quedar al menos un administrador: no se puede quitar el rol al último.")

    u = run_query("SELECT user_id, username, email, role FROM users WHERE user_id = ?", (user_id,))
    if u.empty:
        raise OperationError("Usuario no encontrado.")

    old_role = u.iloc[0]["role"]
    run_write("UPDATE users SET role = ? WHERE user_id = ?", (role, user_id))
    audit(operator, "UPDATE", "users", str(user_id), f"Cambio de rol de {old_role} a {role}")
    return {"user_id": user_id, "role": role}


# ---------------------------------------------------------------------------
# Contraseña (usuario o correo + contraseña)
# ---------------------------------------------------------------------------

def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), PASSWORD_ITERATIONS).hex()
    return f"{PASSWORD_PREFIX}{PASSWORD_ITERATIONS}${digest}", salt


def _password_matches(password: str, stored: str | None, salt: str | None) -> bool:
    """Solo valen los hash con el prefijo pbkdf2$: el relleno de las cuentas sin contraseña nunca coincide."""
    if not stored or not salt or not stored.startswith(PASSWORD_PREFIX):
        return False
    try:
        _, iterations, digest = stored.split("$")
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), int(iterations)).hex()
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(candidate, digest)


USERNAME_REGEX = re.compile(r"^[a-z0-9][a-z0-9._-]{2,39}$")
WRONG = "Usuario, correo o contraseña incorrectos."


def login_password(identifier: str, password: str) -> dict:
    """Ingreso con el usuario o el correo y la contraseña. El mensaje de error es el mismo si la cuenta no existe, no tiene
    contraseña o la contraseña no coincide (no deja averiguar quién tiene cuenta)."""
    ident = (identifier or "").strip().lower()
    if not ident or not password:
        raise OperationError("Escribe tu usuario o correo y tu contraseña.")
    found = fetch_all(
        """SELECT u.user_id, u.username, u.full_name, u.email, u.role, u.active, u.password_hash, u.salt,
                  u.failed_logins, u.locked_until,
                  c.company_id, c.name AS company_name, c.nit AS company_nit
           FROM users u LEFT JOIN companies c ON u.company_id = c.company_id
           WHERE LOWER(u.username) = ? OR LOWER(u.email) = ?
           ORDER BY (LOWER(u.username) = ?) DESC LIMIT 1""",
        (ident, ident, ident),
    )
    if not found:
        hash_password(password)  # mismo tiempo de respuesta que con una cuenta real
        raise OperationError(WRONG)
    user = found[0]
    now = _now()
    locked = user.get("locked_until")
    if isinstance(locked, str) and locked > now.strftime("%Y-%m-%d %H:%M:%S"):
        raise OperationError(f"Demasiados intentos fallidos. Espera {LOCK_MINUTES} minutos o ingresa con el código al correo.")
    if not _password_matches(password, user["password_hash"], user["salt"]) or not user["active"]:
        fails = int(user["failed_logins"] or 0) + 1
        lock = (now + timedelta(minutes=LOCK_MINUTES)).strftime("%Y-%m-%d %H:%M:%S") if fails >= MAX_PASSWORD_FAILURES else None
        run_write("UPDATE users SET failed_logins = ?, locked_until = ? WHERE user_id = ?",
                  (0 if lock else fails, lock, int(user["user_id"])))
        if lock:
            audit("sistema", "UPDATE", "users", str(int(user["user_id"])),
                  f"Contraseña bloqueada {LOCK_MINUTES} min por {MAX_PASSWORD_FAILURES} intentos fallidos")
        raise OperationError(WRONG)
    run_write("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE user_id = ?", (int(user["user_id"]),))
    return _open_session(user, "Inicio de sesión con contraseña")


def change_password(session_id: str | None, current: str, new: str) -> dict:
    """Cambia la contraseña de la cuenta de la sesión. Exige la actual, mínimo PASSWORD_MIN_LEN, y cierra las demás
    sesiones de esa cuenta (la de esta petición sigue abierta). El historial no guarda la contraseña."""
    user = get_user_by_session(session_id)
    if not user:
        raise OperationError("Inicia sesión para cambiar tu contraseña.")
    row = fetch_all("SELECT user_id, username, password_hash, salt FROM users WHERE user_id = ?", (user["user_id"],))[0]
    if not str(row["password_hash"] or "").startswith(PASSWORD_PREFIX):
        raise OperationError("Esta cuenta no usa contraseña: entra con el código al correo.")
    if not _password_matches(current or "", row["password_hash"], row["salt"]):
        raise OperationError("La contraseña actual no es correcta.")
    if len(new or "") < PASSWORD_MIN_LEN:
        raise OperationError(f"La contraseña nueva debe tener al menos {PASSWORD_MIN_LEN} caracteres.")
    if new == current:
        raise OperationError("La contraseña nueva debe ser distinta de la actual.")
    hashed, salt = hash_password(new)
    run_write("UPDATE users SET password_hash = ?, salt = ?, failed_logins = 0, locked_until = NULL WHERE user_id = ?",
              (hashed, salt, int(row["user_id"])))
    # Las demás sesiones de esta cuenta se cierran; la actual se conserva
    run_write("DELETE FROM user_sessions WHERE user_id = ? AND session_id != ?", (int(row["user_id"]), (session_id or "").strip()))
    audit(row["username"], "UPDATE", "users", str(int(row["user_id"])), "Contraseña cambiada por la propia cuenta")
    return {"ok": True, "message": "Contraseña cambiada. Las demás sesiones de tu cuenta se cerraron."}


def set_password_account(username: str, password: str, full_name: str, role: str = "admin",
                         email: str | None = None, operator: str = "consola") -> dict:
    """Crea la cuenta (o le cambia la contraseña si ya existe) desde la consola del servidor. Al cambiar la contraseña se
    cierran sus sesiones abiertas: quien la tenía antes deja de entrar."""
    user = (username or "").strip().lower()
    if not USERNAME_REGEX.match(user):
        raise OperationError("El usuario debe tener de 3 a 40 letras minúsculas, números, punto, guion o guion bajo.")
    if len(password or "") < PASSWORD_MIN_LEN:
        raise OperationError(f"La contraseña debe tener al menos {PASSWORD_MIN_LEN} caracteres.")
    if role not in ROLE_LEVEL:
        raise OperationError(f"Rol no válido: '{role}'.")
    mail = normalize_email(email) if email else None
    if mail:
        other = run_query("SELECT user_id FROM users WHERE LOWER(email) = ? AND LOWER(username) != ?", (mail, user))
        if not other.empty:
            raise OperationError(f"El correo {mail} ya es de otra cuenta.")
    pw_hash, salt = hash_password(password)
    existing = run_query("SELECT user_id FROM users WHERE LOWER(username) = ?", (user,))
    if existing.empty:
        uid = run_write(
            """INSERT INTO users (username, full_name, email, role, company_id, password_hash, salt, active, created_at)
               VALUES (?, ?, ?, ?, NULL, ?, ?, 1, ?)""",
            (user, (full_name or user).strip(), mail, role, pw_hash, salt, _now_str()),
        )
        audit(operator, "INSERT", "users", str(uid), f"Cuenta con contraseña creada: {user} ({role})")
    else:
        uid = int(existing.iloc[0]["user_id"])
        run_write("""UPDATE users SET password_hash = ?, salt = ?, role = ?, active = 1, failed_logins = 0, locked_until = NULL,
                     full_name = COALESCE(NULLIF(?, ''), full_name), email = COALESCE(?, email) WHERE user_id = ?""",
                  (pw_hash, salt, role, (full_name or "").strip(), mail, uid))
        run_write("DELETE FROM user_sessions WHERE user_id = ?", (uid,))
        audit(operator, "UPDATE", "users", str(uid), f"Contraseña cambiada: {user} ({role})")
    return {"user_id": uid, "username": user, "role": role, "email": mail}


def ensure_dev_password_user() -> None:
    """Solo en desarrollo y pruebas (WESTVANE_DEV_OTP=1): cuenta «pruebas» con contraseña conocida para el navegador de
    pruebas. En producción esa variable no existe y no se crea nada."""
    if not dev_otp_enabled():
        return
    if run_query("SELECT user_id FROM users WHERE username = 'pruebas'").empty:
        set_password_account("pruebas", "pruebas-e2e-local", "Cuenta de pruebas", "lector",
                             "pruebas@westvane.invalid", operator="sistema")
