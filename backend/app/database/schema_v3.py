"""
schema_v3.py
Red multimodal: nodos (CEDIs, puertos marítimos y fluviales, aeropuertos,
terminales férreas, ciudades de paso), enlaces por modo con su trazado real y
envíos multimodales con sus tramos.

Es aditivo (CREATE TABLE IF NOT EXISTS) y no modifica las tablas del esquema
base: sus CHECK no admiten aeropuertos ni el modo férreo, y alterarlos
obligaría a reconstruir bases ya desplegadas.
"""

SCHEMA_V3_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mm_nodes (
    node_code TEXT PRIMARY KEY,                 -- ej. 'LET-AIR', 'PORT-CTG'
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN
        ('cedi', 'ciudad', 'puerto_maritimo', 'puerto_fluvial', 'aeropuerto', 'terminal_ferrea')),
    city TEXT NOT NULL,                         -- agrupa nodos de una misma ciudad
    department_code TEXT NOT NULL,              -- código DANE del departamento
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    iata TEXT,                                  -- solo aeropuertos
    transfer_time_h REAL NOT NULL DEFAULT 2.0,  -- transbordo entre modos en el nodo
    transfer_cost_per_t REAL NOT NULL DEFAULT 8.0,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS mm_links (
    link_id INTEGER PRIMARY KEY AUTOINCREMENT,
    origin_code TEXT NOT NULL,
    dest_code TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('terrestre', 'fluvial', 'maritimo', 'aereo', 'ferreo')),
    corridor TEXT NOT NULL,                     -- ej. 'Ruta del Sol', 'Río Magdalena'
    distance_km REAL NOT NULL,
    time_h REAL NOT NULL,
    cost_per_tkm REAL NOT NULL,                 -- USD por tonelada-kilómetro
    fixed_cost REAL NOT NULL DEFAULT 0,         -- USD por despacho (cargue, peajes, tasas)
    capacity_t REAL NOT NULL,                   -- carga máxima por despacho
    geometry_json TEXT NOT NULL,                -- [[lon, lat], ...] del trazado
    bidirectional INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (origin_code) REFERENCES mm_nodes(node_code) ON DELETE CASCADE,
    FOREIGN KEY (dest_code) REFERENCES mm_nodes(node_code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mm_shipments (
    shipment_code TEXT PRIMARY KEY,             -- ej. 'LS-2610-0001'
    origin_city TEXT NOT NULL,
    dest_city TEXT NOT NULL,
    cargo TEXT NOT NULL,
    weight_t REAL NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('costo', 'tiempo', 'balanceado')),
    status TEXT NOT NULL CHECK (status IN
        ('Programado', 'En Ruta', 'Transferencia Modal', 'Entregado', 'Retrasado')),
    client TEXT NOT NULL,
    departure_at TEXT NOT NULL,                 -- ISO 8601
    eta_at TEXT NOT NULL,
    delay_h REAL NOT NULL DEFAULT 0,            -- retraso operativo sobre el ETA
    distance_km REAL NOT NULL,
    total_time_h REAL NOT NULL,
    total_cost REAL NOT NULL,
    modes TEXT NOT NULL,                        -- modos en orden, separados por coma
    n_transfers INTEGER NOT NULL DEFAULT 0,
    route_json TEXT NOT NULL,                   -- tramos calculados por el motor
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mm_links_origin ON mm_links(origin_code);
CREATE INDEX IF NOT EXISTS idx_mm_links_dest ON mm_links(dest_code);
CREATE INDEX IF NOT EXISTS idx_mm_shipments_status ON mm_shipments(status);
"""
