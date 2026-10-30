"""
schema_v13.py
Usuarios y empresas con roles: soporte para autenticación por código de verificación por correo (OTP passwordless).
- Tabla `companies` para empresas/organizaciones asociadas a los usuarios.
- Nuevas columnas en `users`: `email` (TEXT) y `company_id` (INTEGER, referencia a `companies`).
- Tabla `auth_codes` para almacenar códigos OTP hasheados, intentos y expiración.
- Tabla `user_sessions` para tokens de sesión activos.

Aditivo e idempotente: solo crea tablas inexistentes y agrega columnas que no existan.
"""
from datetime import datetime

SCHEMA_V13_SQL = """
CREATE TABLE IF NOT EXISTS companies (
    company_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    nit TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_codes (
    code_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_sessions (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def apply_v13_migration(conn):
    conn.executescript(SCHEMA_V13_SQL)

    # Revisar columnas de users
    cols = {r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
    if "email" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN email TEXT")
    if "company_id" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN company_id INTEGER REFERENCES companies(company_id)")

    # Empresa por defecto
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    has_company = conn.execute("SELECT COUNT(*) FROM companies").fetchone()[0]
    if has_company == 0:
        conn.execute(
            "INSERT INTO companies (name, nit, active, created_at) VALUES (?, ?, 1, ?)",
            ("Westvane Logistics S.A.S.", None, now_iso),
        )

    first_company_id = conn.execute("SELECT company_id FROM companies LIMIT 1").fetchone()
    cid = first_company_id[0] if first_company_id else 1

    # Asignar correos deterministas y empresa a usuarios semilla existentes si no tienen email
    conn.execute("UPDATE users SET email = 'admin@westvane.invalid', company_id = ? WHERE username = 'admin' AND email IS NULL", (cid,))
    conn.execute("UPDATE users SET email = 'operador@westvane.invalid', company_id = ? WHERE username = 'operador' AND email IS NULL", (cid,))
    conn.execute("UPDATE users SET email = 'lector@westvane.invalid', company_id = ? WHERE username = 'lector' AND email IS NULL", (cid,))

    conn.commit()
