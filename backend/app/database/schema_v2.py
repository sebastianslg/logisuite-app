"""
schema_v2.py
Extensiones del esquema relacional para las funcionalidades avanzadas:
autenticación por roles, auditoría, consolidación de carga, rutas multi-parada,
escenarios arancelarios y parámetros del sistema.

Se aplica DESPUÉS de SCHEMA_SQL (database/schema.py) mediante executescript,
usando CREATE TABLE IF NOT EXISTS para que sea idempotente y no rompa bases
de datos ya existentes.
"""

SCHEMA_V2_SQL = """
PRAGMA foreign_keys = ON;

-- =========================================================
-- AUTENTICACION Y ROLES
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','operador','lector')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

-- =========================================================
-- AUDITORIA
-- =========================================================
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    action TEXT NOT NULL,           -- INSERT / UPDATE / DELETE / LOGIN / EXPORT
    table_name TEXT NOT NULL,
    record_id TEXT,
    detail TEXT,
    timestamp TEXT NOT NULL
);

-- =========================================================
-- CONSOLIDACION DE CARGA (Freight)
-- =========================================================
CREATE TABLE IF NOT EXISTS consolidations (
    consolidation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    origin_node_id INTEGER NOT NULL,
    dest_node_id INTEGER NOT NULL,
    consolidation_date TEXT NOT NULL,
    total_weight_kg REAL NOT NULL DEFAULT 0,
    total_volume_m3 REAL NOT NULL DEFAULT 0,
    cost_before REAL NOT NULL DEFAULT 0,
    cost_after REAL NOT NULL DEFAULT 0,
    savings REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (origin_node_id) REFERENCES nodes(node_id),
    FOREIGN KEY (dest_node_id) REFERENCES nodes(node_id)
);

CREATE TABLE IF NOT EXISTS consolidation_items (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    consolidation_id INTEGER NOT NULL,
    shipment_id INTEGER NOT NULL,
    FOREIGN KEY (consolidation_id) REFERENCES consolidations(consolidation_id) ON DELETE CASCADE,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE
);

-- =========================================================
-- HUELLA DE CARBONO POR ENVIO
-- =========================================================
CREATE TABLE IF NOT EXISTS shipment_emissions (
    emission_id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER NOT NULL UNIQUE,
    mode TEXT NOT NULL,
    distance_km REAL NOT NULL,
    ton_km REAL NOT NULL,
    kg_co2e REAL NOT NULL,
    computed_at TEXT NOT NULL,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE
);

-- =========================================================
-- RUTAS MULTI-PARADA (VRP / TSP)
-- =========================================================
CREATE TABLE IF NOT EXISTS multi_stop_routes (
    ms_route_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    depot_node_id INTEGER NOT NULL,
    stops_json TEXT NOT NULL,          -- lista ordenada de node_id
    algorithm TEXT NOT NULL,           -- nearest_neighbor / nn_2opt
    total_distance_km REAL NOT NULL,
    total_time_h REAL NOT NULL,
    total_cost REAL NOT NULL,
    vehicle_id INTEGER,
    scheduled_start TEXT,
    scheduled_end TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (depot_node_id) REFERENCES nodes(node_id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
);

-- =========================================================
-- ESCENARIOS ARANCELARIOS (Customs)
-- =========================================================
CREATE TABLE IF NOT EXISTS tariff_scenarios (
    scenario_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country_origin TEXT NOT NULL,
    tariff_pct REAL NOT NULL,
    vat_pct REAL NOT NULL DEFAULT 19.0,
    other_fees_pct REAL NOT NULL DEFAULT 0,
    notes TEXT
);

-- =========================================================
-- HISTORIAL DE COSTOS POR CORREDOR (serie temporal)
-- =========================================================
CREATE TABLE IF NOT EXISTS corridor_cost_history (
    history_id INTEGER PRIMARY KEY AUTOINCREMENT,
    corridor_id INTEGER NOT NULL,
    record_date TEXT NOT NULL,
    cost_per_km REAL NOT NULL,
    fuel_index REAL NOT NULL DEFAULT 100.0,
    FOREIGN KEY (corridor_id) REFERENCES corridors(corridor_id) ON DELETE CASCADE
);

-- =========================================================
-- PARAMETROS DEL SISTEMA (clave-valor, editables desde la UI)
-- =========================================================
CREATE TABLE IF NOT EXISTS system_params (
    param_key TEXT PRIMARY KEY,
    param_value TEXT NOT NULL,
    description TEXT
);
"""
