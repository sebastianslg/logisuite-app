"""
auth.py
Autenticación básica por roles (admin / operador / lector).
Las contraseñas se almacenan con hash PBKDF2-HMAC-SHA256 y salt aleatorio por
usuario (solo librería estándar, sin dependencias externas).

Jerarquía de permisos:
    lector    -> solo lectura (ve datos y reportes)
    operador  -> lectura + escritura (registra movimientos, envíos, etc.)
    admin     -> todo, incluye gestión de usuarios y parámetros del sistema
"""
import hashlib
import hmac
import os
from datetime import datetime
from typing import Optional

from app.database.db import run_query, run_write

# Jerarquía numérica de roles: un rol cubre todos los de nivel inferior
ROLE_LEVEL = {"lector": 1, "operador": 2, "admin": 3}

PBKDF2_ITERATIONS = 120_000


def hash_password(password: str, salt: str = None) -> tuple:
    """Devuelve (hash_hex, salt_hex). Si no se pasa salt, se genera uno nuevo."""
    if salt is None:
        salt = os.urandom(16).hex()
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"),
                              bytes.fromhex(salt), PBKDF2_ITERATIONS)
    return dk.hex(), salt


def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    """Comparación en tiempo constante para evitar timing attacks."""
    candidate, _ = hash_password(password, salt)
    return hmac.compare_digest(candidate, stored_hash)


def create_user(username: str, full_name: str, password: str, role: str) -> int:
    """Crea un usuario nuevo. Lanza ValueError si el rol no es válido."""
    if role not in ROLE_LEVEL:
        raise ValueError(f"Rol inválido: {role}")
    pwd_hash, salt = hash_password(password)
    return run_write(
        """INSERT INTO users (username, full_name, password_hash, salt, role, active, created_at)
           VALUES (?,?,?,?,?,1,?)""",
        (username, full_name, pwd_hash, salt, role, datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
    )


def authenticate(username: str, password: str) -> Optional[dict]:
    """Devuelve el dict del usuario si las credenciales son correctas, si no None."""
    df = run_query("SELECT * FROM users WHERE username = ? AND active = 1", (username,))
    if df.empty:
        return None
    user = df.to_dict(orient="records")[0]
    if verify_password(password, user["password_hash"], user["salt"]):
        return {"user_id": user["user_id"], "username": user["username"],
                "full_name": user["full_name"], "role": user["role"]}
    return None


def list_users() -> list:
    return run_query(
        "SELECT user_id, username, full_name, role, active, created_at FROM users ORDER BY user_id"
    ).to_dict(orient="records")


def set_user_active(user_id: int, active: int) -> None:
    run_write("UPDATE users SET active = ? WHERE user_id = ?", (active, user_id))


def change_password(user_id: int, new_password: str) -> None:
    pwd_hash, salt = hash_password(new_password)
    run_write("UPDATE users SET password_hash = ?, salt = ? WHERE user_id = ?",
               (pwd_hash, salt, user_id))


def has_role(user: Optional[dict], minimum_role: str) -> bool:
    """True si el usuario tiene al menos el nivel de rol indicado."""
    if not user:
        return False
    return ROLE_LEVEL.get(user["role"], 0) >= ROLE_LEVEL.get(minimum_role, 99)
