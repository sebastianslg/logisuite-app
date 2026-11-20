"""
schema_v14.py
Avisos al cliente por correo cuando su envío cambia de estado.

- `mm_shipments.client_email`: dirección del cliente para avisarle (opcional, vacía por defecto). Es un dato personal: se
  borra con el plazo de conservación de adjuntos y al borrar el envío.
- `mm_shipments.last_notified_status`: último estado que ya se le avisó, para no repetir el correo en cada pasada. El estado
  de un envío se deriva del reloj, así que no hay un «evento» que disparar: se compara lo avisado con lo que toca ahora.

Es aditivo e idempotente: solo agrega las columnas que falten.
"""

COLUMNS = {
    "client_email": "TEXT",
    "last_notified_status": "TEXT",
}


def apply_v14_migration(conn):
    have = {r[1] for r in conn.execute("PRAGMA table_info(mm_shipments)").fetchall()}
    for name, kind in COLUMNS.items():
        if name not in have:
            conn.execute(f"ALTER TABLE mm_shipments ADD COLUMN {name} {kind}")
    conn.commit()
