"""
schema_v7.py
Bitácora y adjuntos de cada envío.

- mm_shipment_events: lo que pasa con un envío además de su ruta. Notas del operador e
  incidencias en ruta (derrumbe, paro, clima, falla mecánica, retraso, otro). Una incidencia
  puede sumar horas de retraso: el retraso se aplica al envío por la vía normal de edición
  (recalcula la ETA y queda en el historial) y aquí se guarda cuántas horas sumó.
- mm_attachments: documentos del envío (remesa, manifiesto, fotos). El archivo vive en disco,
  junto a la base (carpeta `adjuntos/`), así entra en el mismo volumen y en el respaldo.

Es aditivo: solo crea tablas e índices si faltan.
"""

SCHEMA_V7_SQL = """
CREATE TABLE IF NOT EXISTS mm_shipment_events (
    event_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_code TEXT    NOT NULL,
    kind          TEXT    NOT NULL CHECK (kind IN ('nota','retraso','derrumbe','paro','clima','mecanica','otro')),
    body          TEXT    NOT NULL,
    delay_h       REAL    NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL,
    created_by    TEXT    NOT NULL,
    resolved_at   TEXT,
    resolved_by   TEXT
);
CREATE INDEX IF NOT EXISTS ix_events_shipment ON mm_shipment_events (shipment_code, created_at);
CREATE INDEX IF NOT EXISTS ix_events_created ON mm_shipment_events (created_at);

CREATE TABLE IF NOT EXISTS mm_attachments (
    attachment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_code TEXT    NOT NULL,
    filename      TEXT    NOT NULL,
    content_type  TEXT    NOT NULL,
    size_bytes    INTEGER NOT NULL,
    stored_name   TEXT    NOT NULL,
    created_at    TEXT    NOT NULL,
    created_by    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_attachments_shipment ON mm_attachments (shipment_code);
"""


def apply_v7_migration(conn):
    conn.executescript(SCHEMA_V7_SQL)
    conn.commit()
