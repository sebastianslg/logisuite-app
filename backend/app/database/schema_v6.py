"""
schema_v6.py
Costos de mover una carga, desglosados:

- mm_links.tolls_cop: peajes que paga un despacho por el tramo, en pesos. Va en 0
  hasta cargar las tarifas oficiales; se convierte a USD con la TRM vigente.
- system_params: TAX_IVA_PCT e TAX_ICA_PCT, impuestos sobre el costo del tramo en
  porcentaje. Los valores de partida son provisionales y deben confirmarse con
  contador y con el municipio de origen.

Es aditivo, igual que v4: las columnas se agregan solo si faltan.
"""

# Peajes por tramo: el valor es por despacho y en pesos. La nota y la fuente dicen de dónde salió.
TOLL_COLUMNS = [
    ("tolls_cop", "REAL NOT NULL DEFAULT 0"),
    ("tolls_note", "TEXT"),
    ("tolls_source", "TEXT"),
    ("tolls_updated_at", "TEXT"),
]

# Estimaciones provisionales, solo para tramos con una tarifa de referencia verificable.
# Camión de dos ejes = tarifa de carro × 1,73 (Autopista Norte, jul. 2026: $27.800 / $16.100).
# Se aplican solo a filas que nadie ha editado (tolls_updated_at IS NULL).
TOLL_ESTIMATES = [
    ("Vía al Llano", "CEDI-BOG", "CITY-VVC", 29500,
     "Estimado: peaje Naranjal (carro $17.026) × 1,73 para camión de dos ejes. Confirmar con la tarifa oficial."),
]

V6_PARAMS = [
    ("TAX_IVA_PCT", "19", "IVA sobre el costo de transporte (%). Tarifa general; confirmar su aplicación al flete con contador"),
    ("TAX_ICA_PCT", "0", "ICA municipal sobre el transporte (%). Pendiente: tarifa del municipio de origen"),
]


def apply_v6_migration(conn):
    """Agrega las columnas de peajes a mm_links y siembra los impuestos sin sobrescribir valores ya ingresados."""
    existentes = {row[1] for row in conn.execute("PRAGMA table_info(mm_links)")}
    for nombre, definicion in TOLL_COLUMNS:
        if nombre not in existentes:
            conn.execute(f"ALTER TABLE mm_links ADD COLUMN {nombre} {definicion}")
    for corredor, origen, destino, pesos, nota in TOLL_ESTIMATES:
        conn.execute(
            "UPDATE mm_links SET tolls_cop = ?, tolls_note = ?, tolls_source = 'Estimación' "
            "WHERE corridor = ? AND origin_code = ? AND dest_code = ? AND mode = 'terrestre' AND tolls_updated_at IS NULL",
            (pesos, nota, corredor, origen, destino),
        )
    for clave, valor, descripcion in V6_PARAMS:
        conn.execute(
            "INSERT OR IGNORE INTO system_params (param_key, param_value, description) VALUES (?,?,?)",
            (clave, valor, descripcion),
        )
    conn.commit()
