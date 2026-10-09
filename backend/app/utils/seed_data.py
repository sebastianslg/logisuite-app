"""
seed_data.py
Carga de datos de prueba realistas de la red logística de Colombia: CEDIs en
los parques logísticos de Funza, Girardota, Yumbo, Barranquilla y Bucaramanga,
los puertos de Cartagena (SPRC Mamonal) y Buenaventura, flota con nomenclatura
local y placas colombianas, y fletes sobre los corredores troncales.
"""
from datetime import datetime, timedelta
from app.database.db import run_write, run_query
from app.models.freight import compute_transport_cost


def seed_all():
    ensure_core_seeded()
    seed_v2_only()


def ensure_core_seeded():
    """Siembra las tablas centrales (nodos, corredores, almacenes, inventario,
    flota, envíos, aduanas) SOLO si están vacías. A diferencia de seed_all(),
    es seguro llamarla sobre una base que ya existe: no depende de si el
    archivo .db es nuevo, sino de si la tabla `nodes` tiene datos.

    Esto corrige un caso real: una base de datos que llegó a existir sin
    haberse sembrado del todo (por ejemplo, un despliegue que se interrumpió a
    mitad de camino) se quedaba con nodos, vehículos y envíos en cero para
    siempre, porque solo se sembraba en la rama "is_new" de init_database().
    Sin nodos ni envíos, los reportes de todos los módulos aparecen vacíos —
    lo que el usuario percibe como "las exportaciones no funcionan"."""
    existentes = run_query("SELECT COUNT(*) c FROM nodes").iloc[0]["c"]
    if existentes > 0:
        return
    _seed_nodes()
    _seed_corridors()
    _seed_warehouses_inventory()
    _seed_vehicles_drivers()
    _seed_shipments_routes()
    _seed_customs()


# ---------------------------------------------------------------------------
# Red logística de Colombia
# ---------------------------------------------------------------------------
# Coordenadas de los parques logísticos reales donde operan los CEDIs de las
# grandes cadenas del país, y de los dos puertos que mueven la mayor parte del
# comercio exterior colombiano. node_type usa los valores del CHECK del
# esquema: los CEDIs son 'CD' y los puertos 'Gateway'.
NODES = [
    # nombre, tipo, lat, lon, ciudad
    ("CEDI Bogotá (Funza)", "CD", 4.7166, -74.2119, "Funza"),
    ("CEDI Medellín (Girardota)", "CD", 6.3770, -75.4460, "Girardota"),
    ("CEDI Cali (Yumbo)", "CD", 3.5852, -76.4954, "Yumbo"),
    ("CEDI Barranquilla", "CD", 10.9685, -74.7813, "Barranquilla"),
    ("CEDI Bucaramanga", "CD", 7.0700, -73.1690, "Girón"),
    ("SPRC Cartagena (Mamonal)", "Gateway", 10.3600, -75.5050, "Cartagena"),
    ("Puerto de Buenaventura", "Gateway", 3.8906, -77.0786, "Buenaventura"),
    ("Hub Logístico Ibagué", "Hub", 4.4389, -75.2322, "Ibagué"),
    ("Cliente Bogotá (Corabastos)", "Cliente", 4.6280, -74.1530, "Bogotá"),
    ("Cliente Medellín (Itagüí)", "Cliente", 6.1719, -75.6114, "Itagüí"),
    ("Cliente Cali (Sur)", "Cliente", 3.3800, -76.5300, "Cali"),
    ("Cliente Barranquilla (Centro)", "Cliente", 10.9878, -74.7889, "Barranquilla"),
    ("Cliente Bucaramanga (Centro)", "Cliente", 7.1254, -73.1198, "Bucaramanga"),
    ("Cliente Pereira", "Cliente", 4.8143, -75.6946, "Pereira"),
]

# Corredores viales troncales (distancias y tiempos de tractomula por
# carretera) más el enlace marítimo entre puertos vía Canal de Panamá.
CORRIDORS = [
    # origen, destino, km, horas, modo, USD/km
    ("CEDI Bogotá (Funza)", "Hub Logístico Ibagué", 195, 4.5, "Terrestre", 1.6),
    ("Hub Logístico Ibagué", "CEDI Cali (Yumbo)", 270, 6.5, "Terrestre", 1.6),
    ("CEDI Cali (Yumbo)", "Puerto de Buenaventura", 120, 3.0, "Terrestre", 1.8),
    ("CEDI Bogotá (Funza)", "CEDI Medellín (Girardota)", 430, 9.5, "Terrestre", 1.5),
    ("CEDI Medellín (Girardota)", "SPRC Cartagena (Mamonal)", 640, 13.0, "Terrestre", 1.4),
    ("CEDI Bogotá (Funza)", "CEDI Bucaramanga", 400, 9.0, "Terrestre", 1.5),
    ("CEDI Bucaramanga", "CEDI Barranquilla", 570, 11.0, "Terrestre", 1.4),
    ("CEDI Bucaramanga", "SPRC Cartagena (Mamonal)", 620, 12.0, "Terrestre", 1.4),
    ("CEDI Barranquilla", "SPRC Cartagena (Mamonal)", 125, 2.5, "Terrestre", 1.7),
    ("CEDI Bogotá (Funza)", "CEDI Barranquilla", 1000, 18.0, "Terrestre", 1.35),
    ("CEDI Medellín (Girardota)", "CEDI Cali (Yumbo)", 420, 9.0, "Terrestre", 1.5),
    ("Hub Logístico Ibagué", "Cliente Pereira", 160, 3.5, "Terrestre", 1.7),
    ("CEDI Medellín (Girardota)", "Cliente Pereira", 230, 5.0, "Terrestre", 1.7),
    ("CEDI Cali (Yumbo)", "Cliente Pereira", 210, 4.5, "Terrestre", 1.7),
    ("CEDI Bogotá (Funza)", "Cliente Bogotá (Corabastos)", 22, 0.9, "Terrestre", 2.1),
    ("CEDI Medellín (Girardota)", "Cliente Medellín (Itagüí)", 35, 1.0, "Terrestre", 2.1),
    ("CEDI Cali (Yumbo)", "Cliente Cali (Sur)", 25, 0.8, "Terrestre", 2.1),
    ("CEDI Barranquilla", "Cliente Barranquilla (Centro)", 8, 0.4, "Terrestre", 2.1),
    ("CEDI Bucaramanga", "Cliente Bucaramanga (Centro)", 12, 0.5, "Terrestre", 2.1),
    ("SPRC Cartagena (Mamonal)", "Puerto de Buenaventura", 1450, 72.0, "Maritimo", 0.55),
]


def _seed_nodes():
    for name, ntype, lat, lon, city in NODES:
        run_write(
            "INSERT INTO nodes (name, node_type, latitude, longitude, city, active) VALUES (?,?,?,?,?,1)",
            (name, ntype, lat, lon, city),
        )


def _node_id(name: str) -> int:
    df = run_query("SELECT node_id FROM nodes WHERE name = ?", (name,))
    return int(df.iloc[0]["node_id"])


def _seed_corridors():
    for o, d, dist, t, mode, cost_km in CORRIDORS:
        run_write(
            """INSERT INTO corridors (origin_node_id, dest_node_id, distance_km, transit_time_h,
               mode, cost_per_km, active) VALUES (?,?,?,?,?,?,1)""",
            (_node_id(o), _node_id(d), dist, t, mode, cost_km),
        )


def _seed_warehouses_inventory():
    whs = [("CEDI Bogotá (Funza)", 12000, "Laura Gómez"),
           ("CEDI Medellín (Girardota)", 9500, "Carlos Restrepo"),
           ("CEDI Cali (Yumbo)", 8200, "Ana María Torres"),
           ("CEDI Barranquilla", 7000, "Javier Charris"),
           ("CEDI Bucaramanga", 4800, "Pedro León")]
    wh_ids = {}
    for node_name, cap, mgr in whs:
        wid = run_write("INSERT INTO warehouses (node_id, capacity_m3, manager) VALUES (?,?,?)",
                         (_node_id(node_name), cap, mgr))
        wh_ids[node_name] = wid

    items = [
        ("CEDI Bogotá (Funza)", "SKU-1001", "Café Excelso UGQ (saco 70 kg)", "Alta", 1800, 500, 3000, 245.0),
        ("CEDI Bogotá (Funza)", "SKU-1002", "Flor de corte - caja tabaco", "Alta", 950, 300, 1600, 38.0),
        ("CEDI Bogotá (Funza)", "SKU-1003", "Llanta 295/80R22.5", "Baja", 40, 60, 240, 410.0),
        ("CEDI Medellín (Girardota)", "SKU-2001", "Textil - rollo índigo 100 m", "Alta", 1200, 400, 2000, 95.0),
        ("CEDI Medellín (Girardota)", "SKU-2002", "Electrodoméstico línea blanca", "Media", 260, 80, 500, 320.0),
        ("CEDI Cali (Yumbo)", "SKU-3001", "Azúcar refinada (bulto 50 kg)", "Alta", 4200, 1500, 7000, 31.0),
        ("CEDI Cali (Yumbo)", "SKU-3002", "Papel kraft (bobina)", "Media", 180, 60, 400, 690.0),
        ("CEDI Barranquilla", "SKU-4001", "Resina PET (big bag 1 t)", "Media", 120, 40, 260, 1150.0),
        ("CEDI Barranquilla", "SKU-4002", "Cemento gris (bulto 50 kg)", "Alta", 6000, 2000, 10000, 7.5),
        ("CEDI Bucaramanga", "SKU-5001", "Fertilizante NPK (bulto 50 kg)", "Baja", 90, 120, 600, 36.0),
    ]
    item_ids = {}
    for wh_name, sku, name, zone, qty, mn, mx, cost in items:
        iid = run_write(
            """INSERT INTO inventory_items (warehouse_id, sku, name, zone, quantity, min_stock,
               max_stock, unit_cost) VALUES (?,?,?,?,?,?,?,?)""",
            (wh_ids[wh_name], sku, name, zone, qty, mn, mx, cost),
        )
        item_ids[sku] = iid

    base = datetime.today() - timedelta(days=20)
    moves = [
        ("SKU-1001", "Inbound-Recepcion", 900, 0), ("SKU-1001", "Inbound-Inspeccion", 900, 1),
        ("SKU-1001", "Outbound-Picking", 420, 5), ("SKU-1001", "Outbound-Empaque", 420, 5),
        ("SKU-1001", "Outbound-Despacho", 420, 6),
        ("SKU-1002", "Inbound-Recepcion", 700, 3), ("SKU-1002", "Outbound-Despacho", 520, 4),
        ("SKU-2001", "Inbound-Recepcion", 800, 2), ("SKU-2001", "Outbound-Despacho", 450, 10),
        ("SKU-3001", "Inbound-Recepcion", 3000, 3), ("SKU-3001", "Outbound-Despacho", 2100, 12),
        ("SKU-4002", "Inbound-Recepcion", 4000, 6), ("SKU-4002", "Outbound-Despacho", 3100, 14),
        ("SKU-5001", "Outbound-Despacho", 140, 15),
    ]
    for sku, mtype, qty, day_offset in moves:
        date = (base + timedelta(days=day_offset)).strftime("%Y-%m-%d")
        run_write(
            """INSERT INTO warehouse_movements (item_id, movement_type, quantity, movement_date,
               reference) VALUES (?,?,?,?,?)""",
            (item_ids[sku], mtype, qty, date, f"REF-{sku}-{day_offset}"),
        )


# Tipologías de la flota: (tipo en el esquema, kg, m3). El nombre comercial
# (Tractomula 3S3, Dobletroque, ...) vive en models.fleet.VEHICLE_CLASSES.
FLEET_SPECS = {
    "Tractomula": (35000, 80),     # Tractomula 3S3
    "Camion 3 ejes": (18000, 45),  # Dobletroque
    "Camion 2 ejes": (10000, 36),  # Camión Sencillo
    "Furgon": (5000, 22),          # Turbo NPR
}

# tipo, estado, odómetro, base
FLEET = [
    ("Tractomula", "En Ruta", 186000, "CEDI Bogotá (Funza)"),
    ("Tractomula", "Disponible", 142500, "SPRC Cartagena (Mamonal)"),
    ("Tractomula", "En Ruta", 211300, "Puerto de Buenaventura"),
    ("Tractomula", "Mantenimiento", 238900, "CEDI Medellín (Girardota)"),
    ("Tractomula", "Disponible", 97800, "CEDI Barranquilla"),
    ("Camion 3 ejes", "En Ruta", 121400, "CEDI Cali (Yumbo)"),
    ("Camion 3 ejes", "Disponible", 88600, "CEDI Bucaramanga"),
    ("Camion 3 ejes", "Disponible", 64200, "CEDI Bogotá (Funza)"),
    ("Camion 2 ejes", "Disponible", 73100, "CEDI Medellín (Girardota)"),
    ("Camion 2 ejes", "En Ruta", 55400, "CEDI Bogotá (Funza)"),
    ("Camion 2 ejes", "Mantenimiento", 102700, "CEDI Cali (Yumbo)"),
    ("Furgon", "Disponible", 41800, "CEDI Bogotá (Funza)"),
    ("Furgon", "En Ruta", 38200, "CEDI Medellín (Girardota)"),
    ("Furgon", "Disponible", 26900, "CEDI Barranquilla"),
]


def _colombian_plates(n: int, seed: int = 57) -> list:
    """Placas de servicio público de carga con el formato colombiano ABC-123.
    Se generan con semilla fija para que la base sea reproducible."""
    import random
    rng = random.Random(seed)
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    # Primera letra acotada para que las placas luzcan como de vehículo de carga
    prefixes = ["S", "T", "W", "X", "U", "Q", "K", "G"]
    plates = set()
    while len(plates) < n:
        plate = (rng.choice(prefixes) + rng.choice(letters) + rng.choice(letters)
                 + "-" + f"{rng.randint(100, 999)}")
        plates.add(plate)
    return sorted(plates, key=lambda p: rng.random())


def _seed_vehicles_drivers():
    plates = _colombian_plates(len(FLEET))
    for plate, (vtype, status, odo, home) in zip(plates, FLEET):
        kg, m3 = FLEET_SPECS[vtype]
        run_write(
            """INSERT INTO vehicles (plate, vehicle_type, capacity_kg, capacity_m3, status,
               odometer_km, home_node_id) VALUES (?,?,?,?,?,?,?)""",
            (plate, vtype, kg, m3, status, odo, _node_id(home)),
        )

    today = datetime.today()
    # Categorías del RUNT: C2 camión rígido, C3 vehículo articulado.
    drivers = [
        ("Jorge Martínez", "CC-79451882", "C3", 540),
        ("Sandra Pinzón", "CC-52771310", "C2", 20),     # vence pronto -> alerta
        ("Felipe Cárdenas", "CC-1020456", "C3", 12),    # vence pronto -> alerta
        ("Diana Ospina", "CC-43980112", "C3", 820),
        ("Wilson Mosquera", "CC-16288901", "C3", 365),
        ("Luz Dary Henao", "CC-42110987", "C2", 610),
        ("Edwin Barrios", "CC-72198033", "C3", 95),
        ("Yeison Rodríguez", "CC-1098712", "C2", 450),
    ]
    for name, lic, cat, days in drivers:
        exp = (today + timedelta(days=days)).strftime("%Y-%m-%d")
        run_write(
            """INSERT INTO drivers (name, license_number, license_category, license_expiry, status)
               VALUES (?,?,?,?,'Activo')""",
            (name, lic, cat, exp),
        )

    # Todos los valores monetarios del sistema están en USD, para que el TCO
    # sea coherente con el precio del combustible y la depreciación.
    maint = [
        (1, "Preventivo", 95, 176000, 420.0, "Cambio de aceite, filtros y engrase quinta rueda"),
        (1, "Correctivo", 40, 182500, 1150.0, "Reparación sistema de frenos de aire"),
        (3, "Preventivo", 60, 200000, 450.0, "Mantenimiento 200.000 km"),
        (4, "Correctivo", 6, 238900, 2300.0, "Falla de caja de cambios (en taller)"),
        (6, "Preventivo", 30, 120000, 260.0, "Revisión técnico-mecánica"),
        (11, "Correctivo", 3, 102700, 780.0, "Cambio de embrague"),
        (13, "Preventivo", 50, 36000, 140.0, "Mantenimiento 36.000 km"),
    ]
    for vid, mtype, days_ago, odo, cost, desc in maint:
        date = (today - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        run_write(
            """INSERT INTO maintenance_records (vehicle_id, maintenance_type, maintenance_date,
               odometer_km, cost, description) VALUES (?,?,?,?,?,?)""",
            (vid, mtype, date, odo, cost, desc),
        )


def _seed_shipments_routes():
    import json
    base = datetime.today() - timedelta(days=15)
    # origen, destino, unidades, kg, m3, estado, día promesa, día entrega, valor declarado USD
    # Los tres primeros se referencian en las semillas de aduanas (ids 1, 3, 5).
    shipments = [
        ("SPRC Cartagena (Mamonal)", "CEDI Bogotá (Funza)", 2, 28000, 66, "Entregado", 3, 3, 185000),
        ("CEDI Bogotá (Funza)", "Puerto de Buenaventura", 2, 30000, 70, "En Transito", 17, None, 410000),
        ("CEDI Medellín (Girardota)", "SPRC Cartagena (Mamonal)", 2, 24000, 60, "Entregado", 5, 5, 230000),
        # Entregado un día tarde: el OTIF de la base semilla no es un 100% irreal.
        ("CEDI Cali (Yumbo)", "Cliente Pereira", 6, 9000, 30, "Entregado", 7, 8, 42000),
        ("Puerto de Buenaventura", "CEDI Cali (Yumbo)", 2, 31000, 68, "Retrasado", 8, 11, 265000),
        ("CEDI Barranquilla", "CEDI Bucaramanga", 4, 16000, 42, "Retrasado", 9, 13, 88000),
        ("CEDI Bogotá (Funza)", "CEDI Barranquilla", 2, 33000, 76, "En Transito", 18, None, 150000),
        ("CEDI Bucaramanga", "Cliente Bucaramanga (Centro)", 3, 4200, 18, "En Transito", 16, None, 12500),
        # Envíos pequeños al MISMO corredor y en la misma ventana de fechas:
        # candidatos reales para el motor de consolidación de carga.
        ("CEDI Bogotá (Funza)", "Cliente Bogotá (Corabastos)", 2, 1500, 6, "Registrado", 10, None, 4200),
        ("CEDI Bogotá (Funza)", "Cliente Bogotá (Corabastos)", 1, 900, 4, "Registrado", 11, None, 2600),
        ("CEDI Bogotá (Funza)", "Cliente Bogotá (Corabastos)", 3, 2100, 9, "Registrado", 12, None, 5800),
        ("CEDI Medellín (Girardota)", "Cliente Medellín (Itagüí)", 2, 1200, 5, "Registrado", 9, None, 3400),
        ("CEDI Medellín (Girardota)", "Cliente Medellín (Itagüí)", 1, 800, 3, "Registrado", 10, None, 2100),
    ]
    # Se resuelve la ruta real sobre la red para costear cada envío con su
    # distancia y tiempo verdaderos (Dijkstra sobre los corredores viales).
    from app.models.network import Node, Corridor
    from app.utils.network_algorithms import build_graph, shortest_path
    _nodes, _corridors = Node.all(), Corridor.all()
    _G = build_graph(_nodes, _corridors)

    # Asignación de flota: cada envío toma el vehículo más pequeño que lo
    # puede cargar, rotando entre las unidades operativas de esa tipología.
    vehicles = run_query("""SELECT vehicle_id, capacity_kg FROM vehicles
                            WHERE status NOT IN ('Mantenimiento', 'Fuera de Servicio')
                            ORDER BY capacity_kg, vehicle_id""")
    n_drivers = int(run_query("SELECT COUNT(*) c FROM drivers").iloc[0]["c"])

    for i, (origin, dest, units, w, v, status, prom_off, deliv_off, value) in enumerate(shipments):
        promised = (base + timedelta(days=prom_off)).strftime("%Y-%m-%d")
        delivered = (base + timedelta(days=deliv_off)).strftime("%Y-%m-%d") if deliv_off else None

        ruta = shortest_path(_G, _node_id(origin), _node_id(dest), weight="distance")
        dist_real = ruta["distance_km"] if ruta["found"] else 500.0
        tiempo_real = ruta["time_h"] if ruta["found"] else 10.0

        breakdown = compute_transport_cost(
            distance_km=dist_real, transit_time_h=tiempo_real, weight_kg=w, volume_m3=v,
            cargo_units=units, declared_value=value,
        )
        sid = run_write(
            """INSERT INTO shipments (origin_node_id, dest_node_id, cargo_units, weight_kg,
               volume_m3, status, promised_date, delivered_date, transaction_cost,
               distance_friction_cost, shipment_cost, total_cost)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (_node_id(origin), _node_id(dest), units, w, v, status, promised, delivered,
             breakdown["transaction_cost"], breakdown["distance_friction_cost"],
             breakdown["shipment_cost"], breakdown["total_cost"]),
        )
        path = ruta["path"] if ruta["found"] else [_node_id(origin), _node_id(dest)]
        # El tiempo real se simula como una desviación sobre el ETA para que el
        # control de ETA vs. real tenga envíos a tiempo y envíos tarde.
        desviacion = {"Entregado": 1.05, "En Transito": 1.12, "Retrasado": 1.35}.get(status)
        horas_reales = round(tiempo_real * desviacion, 2) if desviacion else None

        aptos = vehicles[vehicles["capacity_kg"] >= w]
        aptos = aptos if not aptos.empty else vehicles
        smallest = aptos[aptos["capacity_kg"] == aptos["capacity_kg"].min()]
        vehicle_id = int(smallest.iloc[i % len(smallest)]["vehicle_id"])
        run_write(
            """INSERT INTO routes (shipment_id, path_json, algorithm, total_distance_km,
               total_cost, eta_hours, actual_hours, vehicle_id, driver_id)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (sid, json.dumps(path), "dijkstra_distancia", dist_real, breakdown["total_cost"],
             tiempo_real, horas_reales, vehicle_id, (sid % n_drivers) + 1),
        )


def _seed_customs():
    from app.models.customs import CustomsDuty
    today = datetime.today()

    def d(offset):
        return (today + timedelta(days=offset)).strftime("%Y-%m-%d")

    docs = [
        # 1: importación por Cartagena hacia Bogotá
        (1, "Bill of Lading", "MSCU-BL-2026-0418", d(-20), None, "Liberado"),
        (1, "Declaracion de Importacion", "DI-482026000118", d(-17), None, "Liberado"),
        (1, "Manifiesto de Carga", "MC-CTG-2026-0921", d(-17), None, "Liberado"),
        # 2: exportación por Buenaventura
        (2, "Declaracion de Exportacion", "DEX-602026004471", d(-3), d(12), "En Revision"),
        (2, "Certificado de Origen", "CO-VUCE-2026-1187", d(-4), d(25), "Pendiente"),
        # 3: exportación por Cartagena desde Medellín
        (3, "Declaracion de Exportacion", "DEX-602026003902", d(-14), d(16), "Liberado"),
        (3, "Bill of Lading", "HLCU-BL-2026-7731", d(-11), None, "Liberado"),
        # 5: importación por Buenaventura hacia Cali (retrasada en puerto)
        (5, "Bill of Lading", "CMDU-BL-2026-3350", d(-9), None, "Liberado"),
        (5, "Declaracion de Importacion", "DI-482026000502", d(-6), d(5), "En Revision"),
        (5, "Certificado de Origen", "CO-CN-2026-88412", d(-12), d(8), "Pendiente"),
    ]
    for sid, dtype, num, issue, expiry, status in docs:
        run_write(
            """INSERT INTO customs_documents (shipment_id, doc_type, doc_number, issue_date,
               expiry_date, status) VALUES (?,?,?,?,?,?)""",
            (sid, dtype, num, issue, expiry, status),
        )

    duties = [(1, 5.0, 185000, 19.0), (5, 10.0, 265000, 19.0)]
    for sid, tariff, value, vat in duties:
        calc = CustomsDuty.compute(value, tariff, vat)
        run_write(
            """INSERT INTO customs_duties (shipment_id, tariff_pct, taxable_value, taxes,
               total_duty) VALUES (?,?,?,?,?)""",
            (sid, tariff, value, calc["taxes"], calc["total_duty"]),
        )


# ===========================================================================
# SEMILLAS DE LAS EXTENSIONES v2 (usuarios, parámetros, escenarios, historial)
# ===========================================================================
def seed_v2_only():
    """Siembra únicamente las tablas nuevas del esquema v2, de forma idempotente.
    Se puede llamar sobre una base ya existente sin duplicar ni destruir datos."""
    _seed_users()
    _seed_system_params()
    _seed_tariff_scenarios()
    _seed_corridor_history()
    _seed_emissions()
    seed_multimodal()


def _seed_users():
    """Usuarios de prueba, uno por cada rol del sistema."""
    from app.utils.auth import create_user
    existentes = run_query("SELECT COUNT(*) c FROM users").iloc[0]["c"]
    if existentes > 0:
        return
    create_user("admin", "Administrador del Sistema", "admin123", "admin")
    create_user("operador", "Operador Logistico", "oper123", "operador")
    create_user("lector", "Consulta Gerencial", "lect123", "lector")


def _seed_system_params():
    """Parámetros configurables del sistema."""
    params = [
        ("AUTH_ENABLED", "true", "Activa el inicio de sesion obligatorio (true/false)"),
        ("FUEL_PRICE", "1.05", "Precio del combustible en USD por litro"),
        ("MAINTENANCE_INTERVAL_KM", "20000", "Intervalo de mantenimiento preventivo en km"),
        ("SERVICE_LEVEL_TARGET", "0.95", "Nivel de servicio objetivo para calculo de ROP"),
        ("ORDER_COST", "50", "Costo de emitir un pedido (USD) para el calculo de EOQ"),
        ("HOLDING_RATE", "0.25", "Tasa anual de mantenimiento de inventario (fraccion del costo unitario)"),
        ("LEAD_TIME_DAYS", "7", "Lead time por defecto en dias"),
    ]
    for key, value, desc in params:
        existe = run_query("SELECT 1 FROM system_params WHERE param_key = ?", (key,))
        if existe.empty:
            run_write("INSERT INTO system_params (param_key, param_value, description) VALUES (?,?,?)",
                       (key, value, desc))


def _seed_tariff_scenarios():
    """Escenarios arancelarios de referencia para el simulador aduanero."""
    existentes = run_query("SELECT COUNT(*) c FROM tariff_scenarios").iloc[0]["c"]
    if existentes > 0:
        return
    escenarios = [
        ("TLC Estados Unidos", "Estados Unidos", 0.0, 19.0, 0.5, "Arancel cero bajo el TLC vigente"),
        ("CAN (Comunidad Andina)", "Peru", 0.0, 19.0, 0.3, "Zona de libre comercio andina"),
        ("Mercosur - acuerdo parcial", "Brasil", 5.0, 19.0, 0.6, "Preferencia arancelaria parcial"),
        ("Nacion mas favorecida", "China", 10.0, 19.0, 0.8, "Arancel general sin acuerdo preferencial"),
        ("Union Europea", "Alemania", 2.5, 19.0, 0.4, "Acuerdo comercial multipartes"),
    ]
    for name, country, tariff, vat, fees, notes in escenarios:
        run_write("""INSERT INTO tariff_scenarios (name, country_origin, tariff_pct, vat_pct,
                     other_fees_pct, notes) VALUES (?,?,?,?,?,?)""",
                   (name, country, tariff, vat, fees, notes))


def _seed_corridor_history():
    """Serie temporal de costos por corredor (12 meses hacia atras), con una
    tendencia y estacionalidad suaves para que las graficas sean informativas."""
    import math
    existentes = run_query("SELECT COUNT(*) c FROM corridor_cost_history").iloc[0]["c"]
    if existentes > 0:
        return
    corridors = run_query("SELECT corridor_id, cost_per_km FROM corridors").to_dict(orient="records")
    base = datetime.today().replace(day=1)
    for c in corridors:
        for m in range(12, 0, -1):
            fecha = (base - timedelta(days=30 * m)).strftime("%Y-%m-%d")
            # Tendencia inflacionaria leve + componente estacional
            tendencia = 1 + (12 - m) * 0.004
            estacional = 1 + 0.05 * math.sin(m * math.pi / 6)
            indice_combustible = round(100 * tendencia * estacional, 1)
            costo = round(c["cost_per_km"] * tendencia * estacional, 4)
            run_write("""INSERT INTO corridor_cost_history (corridor_id, record_date,
                         cost_per_km, fuel_index) VALUES (?,?,?,?)""",
                       (c["corridor_id"], fecha, costo, indice_combustible))


def _seed_emissions():
    """Calcula y guarda la huella de carbono de los envios ya registrados."""
    from app.utils.fleet_analytics import compute_emissions
    existentes = run_query("SELECT COUNT(*) c FROM shipment_emissions").iloc[0]["c"]
    if existentes > 0:
        return
    envios = run_query("SELECT shipment_id, weight_kg FROM shipments").to_dict(orient="records")
    for e in envios:
        # Se usa la distancia registrada en la ruta asociada si existe
        ruta = run_query("SELECT total_distance_km FROM routes WHERE shipment_id = ? LIMIT 1",
                          (e["shipment_id"],))
        distancia = float(ruta.iloc[0]["total_distance_km"]) if not ruta.empty else 500.0
        calc = compute_emissions(distancia, e["weight_kg"], "Terrestre")
        run_write("""INSERT INTO shipment_emissions (shipment_id, mode, distance_km, ton_km,
                     kg_co2e, computed_at) VALUES (?,?,?,?,?,?)""",
                   (e["shipment_id"], "Terrestre", distancia, calc["ton_km"], calc["kg_co2e"],
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S")))


# ===========================================================================
# RED MULTIMODAL (esquema v3): carretera, río, mar, aire y ferrocarril
# ===========================================================================
def seed_multimodal():
    """Siembra la red multimodal de Colombia y la carga inicial de envíos.
    Idempotente: solo actúa si las tablas están vacías."""
    if run_query("SELECT COUNT(*) c FROM mm_nodes").iloc[0]["c"] == 0:
        _seed_mm_network()
    if run_query("SELECT COUNT(*) c FROM mm_shipments").iloc[0]["c"] == 0:
        _seed_mm_shipments()


def _seed_mm_network():
    import json
    from app.data.colombia_multimodal import (NODES, LINKS, MODE_PARAMS, TRANSFER_BY_KIND,
                                              CAPACITY_OVERRIDES)
    from app.engine.multimodal import haversine_km

    coords = {}
    for code, name, kind, city, dept, lat, lon, iata in NODES:
        t_h, t_cost = TRANSFER_BY_KIND[kind]
        run_write("""INSERT INTO mm_nodes (node_code, name, kind, city, department_code, latitude,
                     longitude, iata, transfer_time_h, transfer_cost_per_t)
                     VALUES (?,?,?,?,?,?,?,?,?,?)""",
                   (code, name, kind, city, dept, lat, lon, iata, t_h, t_cost))
        coords[code] = (lat, lon)

    for o, d, mode, corridor, km, hours, via in LINKS:
        points = [coords[o], *via, coords[d]]
        geometry = [[round(lon, 4), round(lat, 4)] for lat, lon in points]
        if km is None:
            km = haversine_km(*coords[o], *coords[d])
        params = MODE_PARAMS[mode]
        capacity = CAPACITY_OVERRIDES.get((o, d), params["capacity_t"])
        run_write("""INSERT INTO mm_links (origin_code, dest_code, mode, corridor, distance_km,
                     time_h, cost_per_tkm, fixed_cost, capacity_t, geometry_json)
                     VALUES (?,?,?,?,?,?,?,?,?,?)""",
                   (o, d, mode, corridor, round(km), hours, params["cost_per_tkm"],
                    params["fixed_cost"], capacity, json.dumps(geometry)))


def _seed_mm_shipments():
    from app.engine.multimodal import MultimodalNetwork
    from app.engine.dispatch import generate_initial_shipments

    network = MultimodalNetwork.from_db()
    for sh in generate_initial_shipments(network, datetime.now()):
        cols = list(sh.keys())
        run_write(f"INSERT INTO mm_shipments ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
                   tuple(sh[c] for c in cols))
