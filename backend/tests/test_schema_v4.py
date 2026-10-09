"""
Pruebas del esquema v4: migración aditiva, estado de corredores y TRM.
Usan una base SQLite en memoria; no tocan la base de la aplicación.
Ejecución: pytest -v  (desde backend/)
"""
import sqlite3

import pytest

from app.database.schema_v3 import SCHEMA_V3_SQL
from app.database.schema_v4 import SCHEMA_V4_SQL, apply_v4_migration


@pytest.fixture
def conn():
    c = sqlite3.connect(":memory:")
    c.executescript(SCHEMA_V3_SQL)
    c.executescript("""
        CREATE TABLE IF NOT EXISTS system_params (
            param_key TEXT PRIMARY KEY, param_value TEXT NOT NULL, description TEXT);
    """)
    c.executescript(SCHEMA_V4_SQL)
    apply_v4_migration(c)
    yield c
    c.close()


def _columnas(conn, tabla):
    return {row[1] for row in conn.execute(f"PRAGMA table_info({tabla})")}


class TestMigracion:

    def test_agrega_columnas_nuevas_a_envios(self, conn):
        assert {"source", "forced_modes", "forced_corridors", "created_by",
                "updated_at", "updated_by", "route_status"} <= _columnas(conn, "mm_shipments")

    def test_es_idempotente(self, conn):
        apply_v4_migration(conn)
        apply_v4_migration(conn)
        cuenta = conn.execute("SELECT COUNT(*) FROM system_params WHERE param_key LIKE 'FX_%'").fetchone()[0]
        assert cuenta == 3

    def test_no_sobrescribe_trm_ingresada(self, conn):
        conn.execute("UPDATE system_params SET param_value = '4100' WHERE param_key = 'FX_USD_COP'")
        apply_v4_migration(conn)
        valor = conn.execute("SELECT param_value FROM system_params WHERE param_key = 'FX_USD_COP'").fetchone()[0]
        assert valor == "4100"

    def test_envios_semilla_quedan_como_seed_y_ruta_ok(self, conn):
        conn.execute("""
            INSERT INTO mm_shipments (shipment_code, origin_city, dest_city, cargo, weight_t, priority,
                status, client, departure_at, eta_at, distance_km, total_time_h, total_cost,
                modes, route_json, created_at)
            VALUES ('LS-TEST-0001', 'Bogotá', 'Cali', 'Carga', 5, 'costo', 'Programado', 'X',
                '2026-01-01T00:00:00', '2026-01-02T00:00:00', 500, 10, 1000, 'terrestre', '[]',
                '2026-01-01T00:00:00')
        """)
        fila = conn.execute("SELECT source, route_status FROM mm_shipments WHERE shipment_code = 'LS-TEST-0001'").fetchone()
        assert fila == ("seed", "ok")


class TestEstadoDeCorredores:

    def test_inserta_con_activo_por_defecto(self, conn):
        conn.execute("INSERT INTO mm_corridor_status (corridor, changed_at) VALUES ('Ruta del Sol', '2026-10-09T00:00:00')")
        activo = conn.execute("SELECT active FROM mm_corridor_status WHERE corridor = 'Ruta del Sol'").fetchone()[0]
        assert activo == 1

    def test_corredor_se_registra_una_sola_vez(self, conn):
        conn.execute("INSERT INTO mm_corridor_status (corridor, changed_at) VALUES ('Ruta del Sol', 'x')")
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO mm_corridor_status (corridor, changed_at) VALUES ('Ruta del Sol', 'y')")


class TestTRM:

    def test_parametros_fx_existen_vacios(self, conn):
        filas = dict(conn.execute("SELECT param_key, param_value FROM system_params WHERE param_key LIKE 'FX_%'").fetchall())
        assert filas == {"FX_USD_COP": "", "FX_DATE": "", "FX_SOURCE": ""}
