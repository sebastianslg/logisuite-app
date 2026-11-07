"""
schema_v15.py
Índices para las consultas que crecieron con la auditoría, los avisos al cliente y la lista de envíos.

Sin ellos, cada filtro del historial recorre la tabla entera y la lista ordena todo en cada petición. Con 400 envíos no se
nota; con miles, sí. Son aditivos e idempotentes (`IF NOT EXISTS`) y no cambian ningún dato.
"""

INDEXES = [
    # Historial: se ordena y se filtra por fecha, y se filtra por persona y por registro
    "CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(username, timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(record_id)",
    # Lista de envíos: orden por salida y filtro por estado
    "CREATE INDEX IF NOT EXISTS idx_ship_departure ON mm_shipments(departure_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_ship_status ON mm_shipments(status)",
    # Avisos al cliente: solo interesan los que tienen correo
    "CREATE INDEX IF NOT EXISTS idx_ship_client_email ON mm_shipments(client_email) WHERE client_email IS NOT NULL",
    # Seguimiento público y enlaces activos
    "CREATE INDEX IF NOT EXISTS idx_tracking_ship ON mm_tracking_links(shipment_code, revoked_at)",
]


def apply_v15_migration(conn):
    for sql in INDEXES:
        conn.execute(sql)
    conn.commit()
