"""
schema_v5.py
Flota de vehículos y red de bodegas (aditivo, idempotente).

Vehículos (`fl_*`) cubren los cinco modos: camiones y furgones, aviones de carga,
convoyes de barcazas, buques y trenes. Su estado NO se guarda: se deriva en cada
lectura a partir de las fallas abiertas, los mantenimientos, las asignaciones a
envíos y el kilometraje (ver engine/fleet.py).

Bodegas (`wh_*`) son varias por ciudad, cada una con un rol (centro nacional,
regional, última milla, frío, puerto, aduanera, aérea, devoluciones), su propio
inventario, un historial de movimientos y traslados entre bodegas que crean un
envío y se reciben al llegar.

Las tablas heredadas (`vehicles`, `warehouses`, ...) de la interfaz antigua no
se usan ni se tocan.
"""

SCHEMA_V5_SQL = """
-- ------------------------------------------------------------------ Bodegas
CREATE TABLE IF NOT EXISTS wh_warehouses (
    warehouse_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,                  -- ej. BOG-FUN-01
    name TEXT NOT NULL,
    city TEXT NOT NULL,                         -- coincide con mm_nodes.city
    node_code TEXT,                             -- nodo de la red que la sirve
    role TEXT NOT NULL,                         -- ver engine/warehouses.ROLES
    capacity_m3 REAL NOT NULL DEFAULT 0,
    capacity_pallets INTEGER NOT NULL DEFAULT 0,
    docks INTEGER NOT NULL DEFAULT 1,           -- muelles de carga
    latitude REAL,
    longitude REAL,
    manager TEXT,
    shift TEXT,                                 -- horario de operación
    temp_controlled INTEGER NOT NULL DEFAULT 0, -- cadena de frío
    hazmat INTEGER NOT NULL DEFAULT 0,          -- mercancías peligrosas
    bonded INTEGER NOT NULL DEFAULT 0,          -- depósito aduanero
    status TEXT NOT NULL DEFAULT 'Operativa'
        CHECK (status IN ('Operativa', 'Mantenimiento', 'Cerrada')),
    strategic_reason TEXT,                      -- por qué está donde está
    source TEXT NOT NULL DEFAULT 'semilla',
    created_at TEXT NOT NULL,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS wh_stock (
    stock_id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'un',
    qty REAL NOT NULL DEFAULT 0 CHECK (qty >= 0),
    min_qty REAL NOT NULL DEFAULT 0,
    max_qty REAL NOT NULL DEFAULT 0,
    volume_m3 REAL NOT NULL DEFAULT 0.01,       -- volumen por unidad
    weight_kg REAL NOT NULL DEFAULT 1,          -- peso por unidad
    unit_cost_usd REAL NOT NULL DEFAULT 0,
    zone TEXT,                                  -- ej. A-03, Frío-1
    updated_at TEXT,
    UNIQUE (warehouse_id, sku),
    FOREIGN KEY (warehouse_id) REFERENCES wh_warehouses(warehouse_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wh_movements (
    move_id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL,
    sku TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN
        ('Entrada', 'Salida', 'Traslado salida', 'Traslado entrada', 'Ajuste', 'Merma')),
    qty REAL NOT NULL,                          -- siempre positiva; el tipo da el signo
    at TEXT NOT NULL,
    reference TEXT,
    by_user TEXT,
    note TEXT,
    FOREIGN KEY (warehouse_id) REFERENCES wh_warehouses(warehouse_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wh_movements_wh ON wh_movements (warehouse_id, at DESC);

CREATE TABLE IF NOT EXISTS wh_transfers (
    transfer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_wh INTEGER NOT NULL,
    to_wh INTEGER NOT NULL,
    sku TEXT NOT NULL,
    qty REAL NOT NULL,
    shipment_code TEXT,                         -- envío que lo lleva (NULL si es en la misma ciudad)
    status TEXT NOT NULL DEFAULT 'En tránsito'
        CHECK (status IN ('En tránsito', 'Recibido', 'Cancelado')),
    created_at TEXT NOT NULL,
    created_by TEXT,
    received_at TEXT,
    FOREIGN KEY (from_wh) REFERENCES wh_warehouses(warehouse_id),
    FOREIGN KEY (to_wh) REFERENCES wh_warehouses(warehouse_id)
);

-- ------------------------------------------------------------------- Flota
CREATE TABLE IF NOT EXISTS fl_drivers (
    driver_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    license_cat TEXT NOT NULL,                  -- ej. C3, B1; "Capitán", "Piloto"...
    license_expiry TEXT NOT NULL,               -- AAAA-MM-DD
    status TEXT NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo', 'Inactivo')),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fl_vehicles (
    vehicle_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,                  -- placa, matrícula o nombre
    mode TEXT NOT NULL CHECK (mode IN ('terrestre', 'fluvial', 'maritimo', 'aereo', 'ferreo')),
    vehicle_type TEXT NOT NULL,
    make TEXT,
    model TEXT,
    year INTEGER,
    capacity_t REAL NOT NULL CHECK (capacity_t > 0),
    capacity_m3 REAL,
    home_warehouse_id INTEGER,                  -- bodega donde se aloja
    driver_id INTEGER,
    odometer_base_km REAL NOT NULL DEFAULT 0,   -- lo recorrido antes de la operación simulada
    last_service_at TEXT,                       -- fecha del último mantenimiento
    last_service_km REAL NOT NULL DEFAULT 0,
    service_interval_days INTEGER NOT NULL DEFAULT 90,
    service_interval_km REAL NOT NULL DEFAULT 15000,
    retired INTEGER NOT NULL DEFAULT 0,         -- dado de baja
    retired_reason TEXT,
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'semilla',
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY (home_warehouse_id) REFERENCES wh_warehouses(warehouse_id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES fl_drivers(driver_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fl_maintenance (
    maint_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('Preventivo', 'Correctivo', 'Inspección')),
    status TEXT NOT NULL DEFAULT 'Programado'
        CHECK (status IN ('Programado', 'En curso', 'Completado', 'Cancelado')),
    scheduled_start TEXT NOT NULL,
    scheduled_end TEXT NOT NULL,
    workshop TEXT,
    est_cost_usd REAL NOT NULL DEFAULT 0,
    cost_usd REAL,
    odometer_km REAL,                           -- lectura al cerrar
    notes TEXT,
    completed_at TEXT,
    fault_id INTEGER,                           -- falla que originó el correctivo
    created_at TEXT NOT NULL,
    created_by TEXT,
    FOREIGN KEY (vehicle_id) REFERENCES fl_vehicles(vehicle_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fl_maint_vehicle ON fl_maintenance (vehicle_id, scheduled_start);

CREATE TABLE IF NOT EXISTS fl_faults (
    fault_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('Leve', 'Moderada', 'Crítica')),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    blocks_operation INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'Abierta'
        CHECK (status IN ('Abierta', 'En reparación', 'Resuelta')),
    reported_at TEXT NOT NULL,
    reported_by TEXT,
    shipment_code TEXT,                         -- envío que llevaba al fallar
    resolved_at TEXT,
    resolution TEXT,
    repair_cost_usd REAL,
    FOREIGN KEY (vehicle_id) REFERENCES fl_vehicles(vehicle_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fl_faults_vehicle ON fl_faults (vehicle_id, status);

CREATE TABLE IF NOT EXISTS fl_assignments (
    assign_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    shipment_code TEXT NOT NULL,
    leg_index INTEGER NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    km REAL NOT NULL DEFAULT 0,                 -- km de este tramo (suma al odómetro al terminar)
    load_t REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (vehicle_id) REFERENCES fl_vehicles(vehicle_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fl_assign_vehicle ON fl_assignments (vehicle_id, start_at);
CREATE INDEX IF NOT EXISTS idx_fl_assign_ship ON fl_assignments (shipment_code);
"""
