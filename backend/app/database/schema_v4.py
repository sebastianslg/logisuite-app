"""
schema_v4.py
Modelo de datos para operación en vivo:

- mm_corridor_status: interruptor activo / cerrado por corredor, con motivo y fecha.
- mm_shipments: columnas nuevas para envíos creados desde la interfaz (origen del
  registro, modos y corredores forzados, creador, última edición y estado de ruta).
- system_params: parámetros de TRM (valor, fecha y fuente). El valor empieza vacío:
  la tasa la ingresa el usuario y no se inventa aquí.

Es aditivo. SQLite no tiene ADD COLUMN IF NOT EXISTS, así que las columnas se
agregan con `apply_v4_migration`, que consulta PRAGMA table_info y omite las
que ya existen. Así es seguro sobre bases ya desplegadas.
"""

SCHEMA_V4_SQL = """
CREATE TABLE IF NOT EXISTS mm_corridor_status (
    corridor TEXT PRIMARY KEY,                  -- coincide con mm_links.corridor
    active INTEGER NOT NULL DEFAULT 1,          -- 1 = activo, 0 = cerrado
    reason TEXT,                                -- motivo del cierre (vacío si está activo)
    changed_at TEXT NOT NULL,                   -- ISO 8601 del último cambio
    changed_by TEXT                             -- usuario que cambió el estado
);
"""

# Columnas nuevas de mm_shipments: (nombre, definición). Todas admiten NULL o tienen
# default, para no romper los envíos semilla existentes.
SHIPMENT_V4_COLUMNS = [
    ("source", "TEXT NOT NULL DEFAULT 'seed'"),          # 'seed' o 'manual'
    ("forced_modes", "TEXT"),                            # modos exigidos, separados por coma
    ("forced_corridors", "TEXT"),                        # corredores exigidos, separados por coma
    ("created_by", "TEXT"),
    ("updated_at", "TEXT"),
    ("updated_by", "TEXT"),
    ("route_status", "TEXT NOT NULL DEFAULT 'ok'"),      # 'ok' o 'sin_ruta'
]

# Parámetros de TRM. El valor queda vacío hasta que el usuario lo ingrese.
FX_PARAMS = [
    ("FX_USD_COP", "", "TRM: pesos colombianos por dólar (vacío = sin configurar)"),
    ("FX_DATE", "", "Fecha de vigencia de la TRM (AAAA-MM-DD)"),
    ("FX_SOURCE", "", "Fuente de la TRM (ej. Banco de la República, ingreso manual)"),
]


def apply_v4_migration(conn):
    """Agrega las columnas nuevas de mm_shipments si no existen y siembra los
    parámetros de TRM sin sobrescribir valores ya ingresados."""
    existentes = {row[1] for row in conn.execute("PRAGMA table_info(mm_shipments)")}
    for nombre, definicion in SHIPMENT_V4_COLUMNS:
        if nombre not in existentes:
            conn.execute(f"ALTER TABLE mm_shipments ADD COLUMN {nombre} {definicion}")
    for clave, valor, descripcion in FX_PARAMS:
        conn.execute(
            "INSERT OR IGNORE INTO system_params (param_key, param_value, description) VALUES (?,?,?)",
            (clave, valor, descripcion),
        )
    conn.commit()
