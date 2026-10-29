"""
schema_v10.py
Corrección de tres distancias terrestres que declaraban menos kilómetros que la línea recta entre sus extremos
(imposible por carretera). No hay cifra oficial de INVÍAS en el repo; los valores son los siguientes:

- Honda - Ibagué: 95 -> 102 km. Cifra de un sitio de viajes (Bookaway); coincide con la línea recta, así que es un
  piso y probablemente se queda corta.
- Bosconia - Valledupar: 90 -> 94 km. Estimación de ruta de Rome2rio; no es una medición oficial.
- CEDI Cali (Yumbo) - Santander de Quilichao: 45 -> 80 km. Sin cifra desde Yumbo (los 45 km publicados son desde el
  centro de Cali): línea recta (64 km) por 1,25, factor de sinuosidad típico.

Las tres quedan marcadas `approximate`. Los tiempos conservan la velocidad media del tramo. Solo se tocan filas que
aún tienen el valor anterior: si alguien editó la distancia, se respeta. Es idempotente y no cambia el esquema.
"""

# origen, destino, corredor, km anterior, km nuevo, horas nuevas
DISTANCE_FIXES = [
    ("CITY-HND", "CITY-IBG", "Vía Honda - Ibagué", 95, 102, 2.8),
    ("CITY-BOS", "CITY-VUP", "Vía Bosconia - Valledupar", 90, 94, 1.9),
    ("CEDI-CLO", "CITY-SQU", "Panamericana (Cali - Popayán)", 45, 80, 1.7),
]


def apply_v10_migration(conn):
    for origen, destino, corredor, antes, ahora, horas in DISTANCE_FIXES:
        conn.execute(
            "UPDATE mm_links SET distance_km = ?, time_h = ?, approximate = 1 "
            "WHERE origin_code = ? AND dest_code = ? AND corridor = ? AND mode = 'terrestre' AND distance_km = ?",
            (ahora, horas, origen, destino, corredor, antes),
        )
    conn.commit()
