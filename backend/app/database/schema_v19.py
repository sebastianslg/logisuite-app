"""
schema_v19.py
Último ingreso de cada cuenta y navegador de cada sesión.

- `users.last_login_at`: momento del último ingreso con éxito (null mientras la cuenta no haya entrado nunca). Lo
  escriben tanto el ingreso con contraseña como el código al correo, al abrir la sesión.
- `user_sessions.user_agent`: el User-Agent resumido del navegador que abrió la sesión, ya recortado a 200 caracteres,
  para que cada persona vea sus sesiones en «Mis sesiones» sin guardar cabeceras completas. No se guarda la IP.

Es aditivo e idempotente: solo agrega las columnas que falten (`PRAGMA table_info`) y correrlo dos veces no falla;
no cambia ni borra ningún dato.
"""

COLUMNS = {
    "users": {"last_login_at": "TEXT"},
    "user_sessions": {"user_agent": "TEXT"},
}


def apply_v19_migration(conn):
    for table, columns in COLUMNS.items():
        # Una base de una versión anterior puede no tener la tabla todavía (las migraciones anteriores la crean
        # antes que esta): sin tabla no hay columna que agregar y no es un error.
        existe = conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)).fetchone()
        if not existe:
            continue
        have = {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
        for name, kind in columns.items():
            if name not in have:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {kind}")
    conn.commit()
