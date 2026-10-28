"""
schema_v9.py
Costo real de cada envío: lo que de verdad costó (facturas del transportador, peajes, manipulación), para
compararlo con el costo que estimó el motor. Columnas nuevas en mm_shipments, vacías hasta que alguien lo
registre: actual_cost (USD), actual_cost_note, actual_cost_at y actual_cost_by.

También crea mm_tracking_links: enlaces públicos de solo lectura para que un cliente siga su envío (estado, avance,
ETA y paradas; sin costos ni datos internos). Un token por enlace, revocable.

Es aditivo: solo agrega las columnas y tablas que falten.
"""

COLUMNS = {
    "actual_cost": "REAL",
    "actual_cost_note": "TEXT",
    "actual_cost_at": "TEXT",
    "actual_cost_by": "TEXT",
}


TRACKING_SQL = """
CREATE TABLE IF NOT EXISTS mm_tracking_links (
    token         TEXT PRIMARY KEY,
    shipment_code TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    created_by    TEXT,
    revoked_at    TEXT
);
CREATE INDEX IF NOT EXISTS ix_tracking_shipment ON mm_tracking_links (shipment_code);
"""


def apply_v9_migration(conn):
    conn.executescript(TRACKING_SQL)
    have = {r[1] for r in conn.execute("PRAGMA table_info(mm_shipments)").fetchall()}
    for name, kind in COLUMNS.items():
        if name not in have:
            conn.execute(f"ALTER TABLE mm_shipments ADD COLUMN {name} {kind}")
    conn.commit()
