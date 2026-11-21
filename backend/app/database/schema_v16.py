"""
schema_v16.py
Solicitudes de demostración que llegan desde la presentación comercial (/).

Son datos personales de contacto (nombre, correo, teléfono): se guardan con el texto exacto de la autorización que la persona
aceptó y un resumen de su IP (no la IP), y se pueden borrar desde la app. Es aditivo: solo crea la tabla si falta.
"""

DEMO_REQUESTS = """
CREATE TABLE IF NOT EXISTS demo_requests (
    request_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at    TEXT NOT NULL,
    name          TEXT NOT NULL,
    company       TEXT NOT NULL,
    email         TEXT NOT NULL,
    phone         TEXT,
    role          TEXT,
    fleet_size    TEXT,
    message       TEXT,
    consent_text  TEXT NOT NULL,
    ip_hash       TEXT,
    handled_at    TEXT,
    handled_by    TEXT
)
"""


def apply_v16_migration(conn):
    conn.execute(DEMO_REQUESTS)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_demo_created ON demo_requests(created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_demo_ip ON demo_requests(ip_hash, created_at)")
    conn.commit()
