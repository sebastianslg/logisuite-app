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
    """Renderiza la pantalla de inicio de sesión. Devuelve True si hay sesión
    activa. Es la primera pantalla que ve cualquier persona en cualquier
    página: no existe una forma de entrar a la aplicación sin autenticarse
    primero, por diseño (no depende de ningún parámetro que pueda dejarlo
    desactivado por accidente)."""
    if is_authenticated():
        return True

    _render_login_screen()
    return False


def _render_login_screen() -> None:
    """Pantalla de login a página completa: banner de marca con degradado e
    ilustración de bodega (consistente con el hero de la portada), tarjeta de
    formulario centrada y credenciales de prueba visibles para evaluación."""
    from utils.theme import BRAND
    from utils.illustrations import warehouse_scene_svg, page_background_css

    st.markdown(page_background_css(dark=False), unsafe_allow_html=True)

    st.markdown(f"""
    <style>
    [data-testid="stSidebar"] {{ display: none; }}
    .lg-login-hero {{
        background: linear-gradient(120deg, {BRAND['secondary']} 0%,
                    {BRAND['primary_dark']} 55%, {BRAND['primary']} 100%);
        border-radius: 18px; padding: 32px 40px; text-align:left;
        margin-bottom: 26px; box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        display:flex; align-items:center; justify-content:space-between; gap:20px;
        flex-wrap: wrap;
    }}
    .lg-login-hero h1 {{ color:#FFFFFF; font-size:2.1rem; font-weight:800; margin:10px 0 6px 0; }}
    .lg-login-hero p {{ color:rgba(255,255,255,0.88); font-size:1rem; margin:0; }}
    .lg-login-badge {{
        display:inline-block; background: rgba(255,255,255,0.18); color:#fff;
        padding: 4px 16px; border-radius: 999px; font-size: 0.78rem; margin-bottom: 10px;
        letter-spacing: 0.04em;
    }}
    .lg-login-text {{ text-align:left; min-width: 260px; }}
    </style>
    <div class="lg-login-hero">
        <div class="lg-login-text">
            <span class="lg-login-badge">🚛 LOGÍSTICA · DISTRIBUCIÓN · TRANSPORTE</span>
            <h1>LogiSuite</h1>
            <p>Plataforma integral de logística, distribución y transporte</p>
        </div>
        <div>{warehouse_scene_svg(width=280, height=170)}</div>
    </div>
    """, unsafe_allow_html=True)

    _, mid, _ = st.columns([1, 1.3, 1])
    with mid:
        with st.container(border=True):
            st.markdown("#### 🔐 Iniciar sesión")
            st.caption("Ingresa tus credenciales para acceder al sistema.")
            with st.form("login_form"):
                username = st.text_input("Usuario", placeholder="usuario")
                password = st.text_input("Contraseña", type="password", placeholder="••••••••")
                submitted = st.form_submit_button("Ingresar", type="primary",
                                                    use_container_width=True)
                if submitted:
                    user = authenticate(username, password)
                    if user:
                        st.session_state["auth_user"] = user
                        from utils.audit import log_action
                        log_action("LOGIN", "users", str(user["user_id"]),
                                    f"Ingreso de {username}")
                        st.rerun()
                    else:
                        st.error("Usuario o contraseña incorrectos.")

            with st.expander("👀 Usuarios de prueba (evaluación académica)"):
                st.markdown(
                    "| Usuario | Contraseña | Rol |\n|---|---|---|\n"
                    "| `admin` | `admin123` | Administrador |\n"
                    "| `operador` | `oper123` | Operador |\n"
                    "| `lector` | `lect123` | Solo lectura |"
                )
    st.caption("© LogiSuite — Proyecto académico de Distribución y Transporte")


def auth_enabled() -> bool:
    """Lee AUTH_ENABLED de system_params. Por defecto (parámetro ausente o
    base recién creada) el login es OBLIGATORIO: la aplicación no debe quedar
    accesible sin autenticarse a menos que un administrador lo desactive
    explícitamente desde Administración → Parámetros del sistema."""
    try:
        df = run_query("SELECT param_value FROM system_params WHERE param_key = 'AUTH_ENABLED'")
        if df.empty:
            return True
        return str(df.iloc[0]["param_value"]).lower() in ("1", "true", "si", "sí", "yes")
    except Exception:
        return True


def render_sidebar_user() -> None:
    """Muestra el usuario activo y el botón de salir en la barra lateral."""
    user = current_user()
    if not user:
        return
    with st.sidebar:
        st.markdown(f"**👤 {user['full_name']}**")
        st.caption(f"Rol: {user['role']}")
        if st.button("Cerrar sesión", use_container_width=True):
            logout()
            st.rerun()


def require_write_or_warn() -> bool:
    """Devuelve True si puede escribir; si no, muestra un aviso y devuelve False."""
    if can_write():
        return True
    st.warning("Tu rol es de solo lectura. No puedes modificar datos en esta sección.",
               icon="🔒")
    return False
