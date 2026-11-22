"""
schema_v18.py
Índices que faltaban para las consultas que más se repiten con el uso diario.

Se revisó con EXPLAIN QUERY PLAN sobre una base de ejemplo (5.000 envíos, 60.000 líneas de historial, 20.000 códigos de
ingreso, 1.666 tramos asignados): el historial por tabla, el consecutivo de envío, los códigos de ingreso y las sesiones
recorrían la tabla entera (SCAN) por no tener índice, y la lista de envíos ordenaba aparte en un árbol temporal.

- `mm_shipments(status, departure_at DESC)`: la lista filtra por estado y ordena por salida. Con los índices de una sola
  columna de la v15, SQLite usa el de estado y ordena aparte; con este, filtra y entrega en orden en una sola pasada.
- `audit_log(table_name, audit_id, action, record_id)`: dos consultas recorrían los 60.000 registros: el historial
  filtrado por tabla (ordenado por `audit_id`, que va en el índice para no ordenar aparte) y el consecutivo de envío que
  se calcula al crear (`operations.next_code` busca los códigos ya borrados). Con `action` y `record_id` dentro del índice,
  esa segunda consulta se responde sin tocar la tabla.
- `user_sessions(user_id)`: cerrar todas las sesiones de un usuario («salir en todos los dispositivos», desactivar una
  cuenta) borraba recorriendo la tabla entera. La búsqueda por token ya usa la clave primaria.
- `auth_codes(email, code_id)`: el ingreso por código pide el último código de un correo (la espera entre envíos y la
  verificación). Esa tabla crece con cada intento y nunca se filtraba por índice.

Es aditivo e idempotente (`CREATE INDEX IF NOT EXISTS`): no cambia ni borra ningún dato y correrla dos veces no falla.
Solo agrega índices que no existían; no repite los de la v3, v5, v7, v9, v15 ni v16.
"""

INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_v18_ship_status_departure ON mm_shipments(status, departure_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_v18_audit_table ON audit_log(table_name, audit_id, action, record_id)",
    "CREATE INDEX IF NOT EXISTS idx_v18_sessions_user ON user_sessions(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_v18_auth_codes_email ON auth_codes(email, code_id)",
]


def apply_v18_migration(conn):
    for sql in INDEXES:
        conn.execute(sql)
    conn.commit()
