"""
auth.py
Autenticación básica por roles (admin / operador / lector).
Las contraseñas se almacenan con hash PBKDF2-HMAC-SHA256 y salt aleatorio por
usuario (solo librería estándar, sin dependencias externas, para no complicar
el despliegue en Streamlit Community Cloud).

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

import streamlit as st

from database.db import run_query, run_write

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


# ---------------------------------------------------------------------------
# Integración con Streamlit (sesión)
# ---------------------------------------------------------------------------
def current_user() -> Optional[dict]:
    """Usuario autenticado en la sesión actual, o None."""
    return st.session_state.get("auth_user")


def is_authenticated() -> bool:
    return current_user() is not None


def has_role(minimum_role: str) -> bool:
    """True si el usuario actual tiene al menos el nivel de rol indicado."""
    user = current_user()
    if not user:
        return False
    return ROLE_LEVEL.get(user["role"], 0) >= ROLE_LEVEL.get(minimum_role, 99)


def can_write() -> bool:
    """Atajo: ¿el usuario puede modificar datos? (operador o admin)."""
    return has_role("operador")


def logout() -> None:
    st.session_state.pop("auth_user", None)


def login_form() -> bool:
    """Renderiza el formulario de login. Devuelve True si hay sesión activa.

    Si AUTH_ENABLED está desactivado en system_params, deja pasar a todos como
    admin (modo demo, útil para evaluación académica sin fricción)."""
    if not auth_enabled():
        st.session_state["auth_user"] = {"user_id": 0, "username": "demo",
                                          "full_name": "Modo demo", "role": "admin"}
        return True

    if is_authenticated():
        return True

    st.title("🔐 LogiSuite — Iniciar sesión")
    st.caption("Ingresa tus credenciales para acceder al sistema.")
    with st.form("login_form"):
        username = st.text_input("Usuario")
        password = st.text_input("Contraseña", type="password")
        submitted = st.form_submit_button("Ingresar", type="primary")
        if submitted:
            user = authenticate(username, password)
            if user:
                st.session_state["auth_user"] = user
                from utils.audit import log_action
                log_action("LOGIN", "users", str(user["user_id"]), f"Ingreso de {username}")
                st.rerun()
            else:
                st.error("Usuario o contraseña incorrectos.")
    st.info("Usuarios de prueba: **admin/admin123**, **operador/oper123**, **lector/lect123**",
            icon="ℹ️")
    return False


def auth_enabled() -> bool:
    """Lee el parámetro AUTH_ENABLED de system_params (por defecto desactivado)."""
    try:
        df = run_query("SELECT param_value FROM system_params WHERE param_key = 'AUTH_ENABLED'")
        if df.empty:
            return False
        return str(df.iloc[0]["param_value"]).lower() in ("1", "true", "si", "sí", "yes")
    except Exception:
        return False


def render_sidebar_user() -> None:
    """Muestra el usuario activo y el botón de salir en la barra lateral."""
    user = current_user()
    if not user:
        return
    with st.sidebar:
        st.markdown(f"**👤 {user['full_name']}**")
        st.caption(f"Rol: {user['role']}")
        if auth_enabled() and st.button("Cerrar sesión", use_container_width=True):
            logout()
            st.rerun()


def require_write_or_warn() -> bool:
    """Devuelve True si puede escribir; si no, muestra un aviso y devuelve False."""
    if can_write():
        return True
    st.warning("Tu rol es de solo lectura. No puedes modificar datos en esta sección.",
               icon="🔒")
    return False
