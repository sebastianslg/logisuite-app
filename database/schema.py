"""
schema.py
Esquema relacional completo del sistema de Logística, Distribución y Transporte.
Todas las tablas usan claves foráneas estrictas (PRAGMA foreign_keys = ON) para
garantizar la integridad referencial entre los 5 módulos funcionales.
"""

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

-- =========================================================
-- NÚCLEO DE RED (nodos y corredores) - usado por todos los módulos
-- =========================================================
CREATE TABLE IF NOT EXISTS nodes (
    node_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    node_type TEXT NOT NULL CHECK (node_type IN
        ('Planta', 'Almacen', 'CD', 'Cliente', 'Hub', 'Gateway')),
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    city TEXT,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS corridors (
    corridor_id INTEGER PRIMARY KEY AUTOINCREMENT,
    origin_node_id INTEGER NOT NULL,
    dest_node_id INTEGER NOT NULL,
    distance_km REAL NOT NULL,
    transit_time_h REAL NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('Terrestre','Maritimo','Aereo','Fluvial')),
    cost_per_km REAL NOT NULL DEFAULT 1.0,
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (origin_node_id) REFERENCES nodes(node_id) ON DELETE CASCADE,
    FOREIGN KEY (dest_node_id) REFERENCES nodes(node_id) ON DELETE CASCADE
);

-- =========================================================
-- MODULO 1: WAREHOUSE MANAGEMENT
-- =========================================================
CREATE TABLE IF NOT EXISTS warehouses (
    warehouse_id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id INTEGER NOT NULL UNIQUE,
    capacity_m3 REAL NOT NULL,
    manager TEXT,
    FOREIGN KEY (node_id) REFERENCES nodes(node_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_items (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    zone TEXT NOT NULL CHECK (zone IN ('Alta','Media','Baja')),
    quantity REAL NOT NULL DEFAULT 0,
    min_stock REAL NOT NULL DEFAULT 0,
    max_stock REAL NOT NULL DEFAULT 0,
    unit_cost REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS warehouse_movements (
    movement_id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN
        ('Inbound-Recepcion','Inbound-Inspeccion','Outbound-Picking',
         'Outbound-Empaque','Outbound-Despacho')),
    quantity REAL NOT NULL,
    movement_date TEXT NOT NULL,
    reference TEXT,
    FOREIGN KEY (item_id) REFERENCES inventory_items(item_id) ON DELETE CASCADE
);

-- =========================================================
-- MODULO 2: FREIGHT MANAGEMENT
-- =========================================================
CREATE TABLE IF NOT EXISTS shipments (
    shipment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    origin_node_id INTEGER NOT NULL,
    dest_node_id INTEGER NOT NULL,
    cargo_units INTEGER NOT NULL,
    weight_kg REAL NOT NULL,
    volume_m3 REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Registrado' CHECK (status IN
        ('Registrado','Consolidado','En Transito','Entregado','Retrasado')),
    promised_date TEXT,
    delivered_date TEXT,
    -- Motor de costos: 3 componentes explícitos
    transaction_cost REAL NOT NULL DEFAULT 0,   -- seguros, aduanas, tramites
    distance_friction_cost REAL NOT NULL DEFAULT 0, -- tiempo/energia segun corredor
    shipment_cost REAL NOT NULL DEFAULT 0,      -- unidad de carga/empaque/masificacion
    total_cost REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (origin_node_id) REFERENCES nodes(node_id),
    FOREIGN KEY (dest_node_id) REFERENCES nodes(node_id)
);

-- =========================================================
-- MODULO 3: TRANSPORTATION MANAGEMENT
-- =========================================================
CREATE TABLE IF NOT EXISTS routes (
    route_id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER NOT NULL,
    path_json TEXT NOT NULL,       -- lista de node_id en orden
    algorithm TEXT NOT NULL,       -- 'dijkstra_distancia' / 'dijkstra_costo'
    total_distance_km REAL NOT NULL,
    total_cost REAL NOT NULL,
    eta_hours REAL NOT NULL,
    actual_hours REAL,
    vehicle_id INTEGER,
    driver_id INTEGER,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
);

-- =========================================================
-- MODULO 4: FLEET MANAGEMENT
-- =========================================================
CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate TEXT NOT NULL UNIQUE,
    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN
        ('Camion 2 ejes','Camion 3 ejes','Tractomula','Furgon','Van')),
    capacity_kg REAL NOT NULL,
    capacity_m3 REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Disponible' CHECK (status IN
        ('Disponible','En Ruta','Mantenimiento','Fuera de Servicio')),
    odometer_km REAL NOT NULL DEFAULT 0,
    home_node_id INTEGER,
    FOREIGN KEY (home_node_id) REFERENCES nodes(node_id)
);

CREATE TABLE IF NOT EXISTS drivers (
    driver_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    license_number TEXT NOT NULL UNIQUE,
    license_category TEXT NOT NULL,
    license_expiry TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo','Inactivo','Suspendido'))
);

CREATE TABLE IF NOT EXISTS maintenance_records (
    maintenance_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('Preventivo','Correctivo')),
    maintenance_date TEXT NOT NULL,
    odometer_km REAL NOT NULL,
    cost REAL NOT NULL DEFAULT 0,
    description TEXT,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE
);

-- =========================================================
-- MODULO 5: CUSTOMS MANAGEMENT
-- =========================================================
CREATE TABLE IF NOT EXISTS customs_documents (
    doc_id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL CHECK (doc_type IN
        ('Bill of Lading','Manifiesto de Carga','Declaracion de Importacion',
         'Declaracion de Exportacion','Certificado de Origen')),
    doc_number TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    expiry_date TEXT,
    status TEXT NOT NULL DEFAULT 'Pendiente' CHECK (status IN
        ('Pendiente','En Revision','Liberado','Rechazado')),
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customs_duties (
    duty_id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER NOT NULL,
    tariff_pct REAL NOT NULL DEFAULT 0,
    taxable_value REAL NOT NULL DEFAULT 0,
    taxes REAL NOT NULL DEFAULT 0,
    total_duty REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE
);
"""
