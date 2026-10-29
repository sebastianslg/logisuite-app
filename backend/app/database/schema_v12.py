"""
schema_v12.py
Documentos obligatorios de los vehículos de carretera en Colombia: SOAT (seguro obligatorio, Ley 769 de 2002) y
revisión técnico-mecánica y de emisiones contaminantes (RTM). Columnas fl_vehicles.soat_expiry y rtm_expiry
(AAAA-MM-DD, vigentes hasta ese día inclusive). Solo aplican al modo terrestre; vacías = «sin registrar».

Los vehículos de la semilla (simulados) reciben fechas deterministas a partir de su placa, casi todas vigentes y
unas pocas por vencer, para que el control se vea funcionando. Los creados por usuarios quedan sin registrar: no se
inventa un dato real. Es aditivo e idempotente: solo llena lo que esté vacío.
"""
import zlib
from datetime import date, datetime, timedelta

COLUMNS = {"soat_expiry": "TEXT", "rtm_expiry": "TEXT"}


def seed_dates(code: str, today: date) -> tuple[str, str]:
    """Vencimientos simulados para un vehículo de la semilla. Uno de cada nueve vence en menos de un mes."""
    h = zlib.crc32(code.encode())
    soat = today + timedelta(days=(14 + h % 15) if h % 9 == 0 else 45 + h % 300)
    r = zlib.crc32((code + "rtm").encode())
    rtm = today + timedelta(days=(10 + r % 18) if r % 9 == 0 else 40 + r % 320)
    return soat.isoformat(), rtm.isoformat()


def apply_v12_migration(conn):
    have = {r[1] for r in conn.execute("PRAGMA table_info(fl_vehicles)").fetchall()}
    for name, kind in COLUMNS.items():
        if name not in have:
            conn.execute(f"ALTER TABLE fl_vehicles ADD COLUMN {name} {kind}")
    today = datetime.now().date()
    rows = conn.execute("SELECT vehicle_id, code FROM fl_vehicles WHERE mode = 'terrestre' AND source = 'semilla' "
                        "AND soat_expiry IS NULL AND rtm_expiry IS NULL").fetchall()
    for vid, code in rows:
        soat, rtm = seed_dates(code, today)
        conn.execute("UPDATE fl_vehicles SET soat_expiry = ?, rtm_expiry = ? WHERE vehicle_id = ?", (soat, rtm, vid))
    conn.commit()
