"""
schema_v11.py
Prueba de entrega (POD) de cada envío: quién recibió, cuándo, en qué estado llegó la carga y su firma
manuscrita (PNG pequeño, dibujado en pantalla). Una por envío; anularla la borra y queda en el historial.

La firma y el nombre son datos personales: con ATTACHMENT_RETENTION_DAYS se borran al cumplirse el plazo,
igual que los adjuntos (se conservan el estado y las fechas).

Es aditivo: solo crea la tabla si falta.
"""

DELIVERY_SQL = """
CREATE TABLE IF NOT EXISTS mm_deliveries (
    shipment_code TEXT PRIMARY KEY,
    received_by   TEXT,                       -- NULL cuando se borró por plazo de conservación
    received_at   TEXT NOT NULL,
    condition     TEXT NOT NULL CHECK (condition IN ('conforme', 'con_novedad')),
    notes         TEXT,
    signature_png BLOB,                       -- NULL cuando se borró por plazo de conservación
    recorded_by   TEXT NOT NULL,
    recorded_at   TEXT NOT NULL,
    purged_at     TEXT
);
"""


def apply_v11_migration(conn):
    conn.executescript(DELIVERY_SQL)
    conn.commit()
