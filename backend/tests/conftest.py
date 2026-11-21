"""Configuración común de las pruebas."""
import os

# Las pruebas escriben en la base directamente (sin HTTP) y leen enseguida: sin caché de lecturas.
os.environ.setdefault("WESTVANE_CACHE_TTL", "0")
# Sin límite de escrituras: las pruebas escriben cientos de veces por minuto (test_guard lo activa por su cuenta)
os.environ.setdefault("WESTVANE_RATE_LIMIT", "0")


def admin_headers(email: str = "admin.pruebas@westvane.invalid") -> dict:
    """Sesión de administrador para las pruebas que leen rutas solo para administradores (exportaciones con datos
    personales, errores del navegador). Crea la cuenta si falta y abre la sesión directo en la base, sin correo."""
    import secrets
    from datetime import datetime, timedelta

    from app.database.db import run_query, run_write
    from app.engine import auth_otp

    rows = run_query("SELECT user_id FROM users WHERE LOWER(email) = ?", (email,))
    user_id = (int(rows.iloc[0]["user_id"]) if not rows.empty
               else auth_otp.create_user_record(email, "Administración de pruebas", role="admin")["user_id"])
    token = secrets.token_urlsafe(32)
    now = datetime.now()
    run_write("INSERT INTO user_sessions (session_id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
              (token, user_id, (now + timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"), now.strftime("%Y-%m-%d %H:%M:%S")))
    return {"Authorization": f"Bearer {token}"}
