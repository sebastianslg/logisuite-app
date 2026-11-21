"""
schema_v17.py
Ingreso con usuario (o correo) y contraseña, además del código por correo.

- `users.failed_logins`: intentos fallidos seguidos con contraseña (vuelve a 0 al acertar).
- `users.locked_until`: tras 5 fallos seguidos la cuenta no acepta contraseña por 15 minutos (frena el adivinar).

La contraseña va en las columnas que ya existían (`password_hash`, `salt`), con PBKDF2-SHA256 y el prefijo `pbkdf2$`: las
cuentas creadas solo para el código por correo tienen ahí un valor de relleno que nunca coincide con una contraseña.
Es aditivo e idempotente: solo agrega las columnas que falten.
"""

COLUMNS = {
    "failed_logins": "INTEGER NOT NULL DEFAULT 0",
    "locked_until": "TEXT",
}


def apply_v17_migration(conn):
    have = {r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
    for name, kind in COLUMNS.items():
        if name not in have:
            conn.execute(f"ALTER TABLE users ADD COLUMN {name} {kind}")
    conn.commit()
