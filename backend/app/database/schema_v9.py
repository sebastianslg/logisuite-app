"""
schema_v9.py
Costo real de cada envío: lo que de verdad costó (facturas del transportador, peajes, manipulación), para
compararlo con el costo que estimó el motor. Columnas nuevas en mm_shipments, vacías hasta que alguien lo
registre: actual_cost (USD), actual_cost_note, actual_cost_at y actual_cost_by.

Es aditivo: solo agrega las columnas que falten.
"""

COLUMNS = {
    "actual_cost": "REAL",
    "actual_cost_note": "TEXT",
    "actual_cost_at": "TEXT",
    "actual_cost_by": "TEXT",
}


def apply_v9_migration(conn):
    have = {r[1] for r in conn.execute("PRAGMA table_info(mm_shipments)").fetchall()}
    for name, kind in COLUMNS.items():
        if name not in have:
            conn.execute(f"ALTER TABLE mm_shipments ADD COLUMN {name} {kind}")
    conn.commit()
