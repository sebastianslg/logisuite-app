"""
seed_data.py
Carga de datos de prueba realistas (red logística colombiana) para que la
aplicación funcione de inmediato tras el despliegue en la nube.
"""
from datetime import datetime, timedelta
from database.db import run_write, run_query
from models.freight import compute_transport_cost

random_dates = lambda base, n: [(base + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(n)]


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


def _seed_nodes():
    nodes = [
        ("Planta Cartagena", "Planta", 10.3910, -75.4794, "Cartagena"),
        ("Planta Barranquilla", "Planta", 10.9639, -74.7964, "Barranquilla"),
        ("CD Bogota Norte", "CD", 4.7110, -74.0721, "Bogota"),
        ("CD Medellin", "CD", 6.2442, -75.5812, "Medellin"),
        ("CD Cali", "CD", 3.4516, -76.5320, "Cali"),
        ("Almacen Bucaramanga", "Almacen", 7.1193, -73.1227, "Bucaramanga"),
        ("Hub Logistico Ibague", "Hub", 4.4389, -75.2322, "Ibague"),
        ("Gateway Puerto Cartagena", "Gateway", 10.4236, -75.5540, "Cartagena"),
        ("Gateway Puerto Buenaventura", "Gateway", 3.8801, -77.0312, "Buenaventura"),
        ("Cliente Bogota Sur", "Cliente", 4.5981, -74.1469, "Bogota"),
        ("Cliente Medellin Poblado", "Cliente", 6.2088, -75.5680, "Medellin"),
        ("Cliente Cali Norte", "Cliente", 3.4750, -76.5230, "Cali"),
        ("Cliente Barranquilla Centro", "Cliente", 10.9878, -74.7889, "Barranquilla"),
        ("Cliente Bucaramanga Centro", "Cliente", 7.1254, -73.1198, "Bucaramanga"),
        ("Cliente Pereira", "Cliente", 4.8143, -75.6946, "Pereira"),
    ]
    for name, ntype, lat, lon, city in nodes:
        run_write(
            "INSERT INTO nodes (name, node_type, latitude, longitude, city, active) VALUES (?,?,?,?,?,1)",
            (name, ntype, lat, lon, city),
        )


def _node_id(name: str) -> int:
    df = run_query("SELECT node_id FROM nodes WHERE name = ?", (name,))
    return int(df.iloc[0]["node_id"])


def _seed_corridors():
    edges = [
        ("Planta Cartagena", "Gateway Puerto Cartagena", 15, 0.5, "Terrestre", 1.8),
        ("Planta Cartagena", "CD Bogota Norte", 1050, 18, "Terrestre", 1.4),
        ("Planta Cartagena", "Almacen Bucaramanga", 620, 11, "Terrestre", 1.5),
        ("Planta Barranquilla", "Cliente Barranquilla Centro", 20, 0.6, "Terrestre", 1.8),
        ("Planta Barranquilla", "CD Bogota Norte", 990, 17, "Terrestre", 1.4),
        ("Planta Barranquilla", "Almacen Bucaramanga", 450, 9, "Terrestre", 1.5),
        ("CD Bogota Norte", "Cliente Bogota Sur", 18, 0.7, "Terrestre", 2.0),
        ("CD Bogota Norte", "Hub Logistico Ibague", 210, 4, "Terrestre", 1.6),
        ("CD Bogota Norte", "Almacen Bucaramanga", 400, 7.5, "Terrestre", 1.5),
        ("Hub Logistico Ibague", "CD Cali", 300, 6, "Terrestre", 1.5),
        ("Hub Logistico Ibague", "CD Medellin", 280, 5.5, "Terrestre", 1.5),
        ("Hub Logistico Ibague", "Cliente Pereira", 130, 2.5, "Terrestre", 1.6),
        ("CD Medellin", "Cliente Medellin Poblado", 12, 0.4, "Terrestre", 2.0),
        ("CD Cali", "Cliente Cali Norte", 15, 0.5, "Terrestre", 2.0),
        ("CD Cali", "Gateway Puerto Buenaventura", 115, 2.5, "Terrestre", 1.6),
        ("Gateway Puerto Buenaventura", "CD Medellin", 380, 8, "Terrestre", 1.5),
        ("Almacen Bucaramanga", "Cliente Bucaramanga Centro", 8, 0.3, "Terrestre", 2.0),
        ("Gateway Puerto Cartagena", "Gateway Puerto Buenaventura", 900, 60, "Maritimo", 0.6),
    ]
    for o, d, dist, t, mode, cost_km in edges:
        run_write(
            """INSERT INTO corridors (origin_node_id, dest_node_id, distance_km, transit_time_h,
               mode, cost_per_km, active) VALUES (?,?,?,?,?,?,1)""",
            (_node_id(o), _node_id(d), dist, t, mode, cost_km),
        )


def _seed_warehouses_inventory():
    whs = [("CD Bogota Norte", 5000, "Laura Gomez"), ("CD Medellin", 4200, "Carlos Ruiz"),
           ("CD Cali", 3600, "Ana Torres"), ("Almacen Bucaramanga", 2100, "Pedro Leon")]
    wh_ids = {}
    for node_name, cap, mgr in whs:
        wid = run_write("INSERT INTO warehouses (node_id, capacity_m3, manager) VALUES (?,?,?)",
                         (_node_id(node_name), cap, mgr))
        wh_ids[node_name] = wid

    items = [
        ("CD Bogota Norte", "SKU-1001", "Panel Solar 250W", "Alta", 420, 100, 800, 185.0),
        ("CD Bogota Norte", "SKU-1002", "Inversor 5kW", "Media", 60, 20, 150, 640.0),
        ("CD Bogota Norte", "SKU-1003", "Bateria Litio 5kWh", "Baja", 15, 10, 60, 1250.0),
        ("CD Medellin", "SKU-2001", "Tuberia PVC 6m", "Alta", 900, 300, 1500, 12.5),
        ("CD Medellin", "SKU-2002", "Valvula Industrial", "Media", 140, 50, 300, 78.0),
        ("CD Cali", "SKU-3001", "Motor Electrico 10HP", "Media", 35, 15, 90, 520.0),
        ("CD Cali", "SKU-3002", "Cable AWG 12", "Alta", 2200, 800, 4000, 1.1),
        ("Almacen Bucaramanga", "SKU-4001", "Kit Herramientas", "Baja", 8, 10, 50, 95.0),
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
        ("SKU-1001", "Inbound-Recepcion", 300, 0), ("SKU-1001", "Inbound-Inspeccion", 300, 1),
        ("SKU-1001", "Outbound-Picking", 120, 5), ("SKU-1001", "Outbound-Empaque", 120, 5),
        ("SKU-1001", "Outbound-Despacho", 120, 6),
        ("SKU-2001", "Inbound-Recepcion", 600, 2), ("SKU-2001", "Outbound-Despacho", 300, 10),
        ("SKU-3002", "Inbound-Recepcion", 1500, 3), ("SKU-3002", "Outbound-Despacho", 900, 12),
        ("SKU-4001", "Outbound-Despacho", 12, 15),
    ]
    for sku, mtype, qty, day_offset in moves:
        date = (base + timedelta(days=day_offset)).strftime("%Y-%m-%d")
        run_write(
            """INSERT INTO warehouse_movements (item_id, movement_type, quantity, movement_date,
               reference) VALUES (?,?,?,?,?)""",
            (item_ids[sku], mtype, qty, date, f"REF-{sku}-{day_offset}"),
        )


def _seed_vehicles_drivers():
    vehicles = [
        ("CTG-101", "Tractomula", 32000, 90, "Disponible", 85000, "Planta Cartagena"),
        ("CTG-202", "Camion 3 ejes", 17000, 55, "Disponible", 62000, "CD Bogota Norte"),
        ("MED-303", "Camion 2 ejes", 9000, 35, "En Ruta", 41000, "CD Medellin"),
        ("CAL-404", "Furgon", 4500, 20, "Disponible", 28000, "CD Cali"),
        ("BAQ-505", "Van", 1800, 10, "Mantenimiento", 55000, "Planta Barranquilla"),
    ]
    for plate, vtype, kg, m3, status, odo, home in vehicles:
        run_write(
            """INSERT INTO vehicles (plate, vehicle_type, capacity_kg, capacity_m3, status,
               odometer_km, home_node_id) VALUES (?,?,?,?,?,?,?)""",
            (plate, vtype, kg, m3, status, odo, _node_id(home)),
        )

    drivers = [
        ("Jorge Martinez", "L-88451", "C2", "2027-03-15"),
        ("Sandra Pinzon", "L-77213", "C3", "2026-10-02"),
        ("Felipe Cardenas", "L-66120", "C2", "2026-09-25"),
        ("Diana Ospina", "L-55980", "C3", "2028-01-10"),
    ]
    for name, lic, cat, exp in drivers:
        run_write(
            """INSERT INTO drivers (name, license_number, license_category, license_expiry, status)
               VALUES (?,?,?,?,'Activo')""",
            (name, lic, cat, exp),
        )

    maint = [
        # IMPORTANTE: todos los valores monetarios del sistema están en USD.
        # Estos costos se expresan en USD para que el TCO por vehículo sea
        # coherente con el precio del combustible y la depreciación, que
        # también están en USD. Mezclar COP y USD haría que el TCO no
        # signifique nada.
        (1, "Preventivo", "2026-07-01", 82000, 115.0, "Cambio de aceite y filtros"),
        (1, "Correctivo", "2026-08-10", 84500, 305.0, "Reparacion sistema de frenos"),
        (3, "Preventivo", "2026-08-20", 40000, 95.0, "Mantenimiento 40,000 km"),
        (5, "Correctivo", "2026-09-01", 54800, 535.0, "Falla de transmision"),
    ]
    for vid, mtype, date, odo, cost, desc in maint:
        run_write(
            """INSERT INTO maintenance_records (vehicle_id, maintenance_type, maintenance_date,
               odometer_km, cost, description) VALUES (?,?,?,?,?,?)""",
            (vid, mtype, date, odo, cost, desc),
        )


def _seed_shipments_routes():
    import json
    base = datetime.today() - timedelta(days=15)
    shipments = [
        ("Planta Cartagena", "Cliente Bogota Sur", 8, 12000, 40, "Entregado", 0, 4, 25000),
        ("Planta Barranquilla", "Cliente Medellin Poblado", 3, 3200, 15, "Entregado", 2, 6, 9000),
        ("CD Bogota Norte", "Cliente Cali Norte", 12, 18000, 60, "En Transito", 5, None, 42000),
        ("CD Medellin", "Cliente Pereira", 2, 1800, 8, "Registrado", 8, None, 5000),
        ("Planta Cartagena", "Cliente Bucaramanga Centro", 6, 9000, 30, "Retrasado", 3, 9, 18000),
        # --- Envíos pequeños al MISMO corredor y en la misma ventana de fechas.
        # Existen para que el motor de consolidación tenga candidatos reales que
        # agrupar: por separado cada uno paga su propio costo de transacción y
        # ninguno alcanza el umbral de masificación; consolidados, sí.
        ("CD Bogota Norte", "Cliente Bogota Sur", 2, 1500, 6, "Registrado", 10, None, 4200),
        ("CD Bogota Norte", "Cliente Bogota Sur", 1, 900, 4, "Registrado", 11, None, 2600),
        ("CD Bogota Norte", "Cliente Bogota Sur", 3, 2100, 9, "Registrado", 12, None, 5800),
        ("CD Medellin", "Cliente Medellin Poblado", 2, 1200, 5, "Registrado", 9, None, 3400),
        ("CD Medellin", "Cliente Medellin Poblado", 1, 800, 3, "Registrado", 10, None, 2100),
    ]
    # Se resuelve la ruta real sobre la red para costear cada envío con su
    # distancia y tiempo verdaderos. Usar una distancia fija para todos los
    # envíos haría que los costos, las emisiones y los ahorros por
    # consolidación no correspondieran a la topología de la red.
    from models.network import Node, Corridor
    from utils.network_algorithms import build_graph, shortest_path
    _nodes, _corridors = Node.all(), Corridor.all()
    _G = build_graph(_nodes, _corridors)

    for origin, dest, units, w, v, status, prom_off, deliv_off, value in shipments:
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
        # El camino guardado es el que realmente calculó Dijkstra sobre la red,
        # con sus nodos intermedios, no un salto directo origen-destino.
        path = ruta["path"] if ruta["found"] else [_node_id(origin), _node_id(dest)]
        # El tiempo real se simula como una desviación sobre el ETA, para que el
        # control de ETA vs. real del módulo de transporte tenga datos con los
        # que trabajar (algunos envíos llegan tarde, otros a tiempo).
        desviacion = {"Entregado": 1.05, "En Transito": 1.12, "Retrasado": 1.35}.get(status)
        horas_reales = round(tiempo_real * desviacion, 2) if desviacion else None
        run_write(
            """INSERT INTO routes (shipment_id, path_json, algorithm, total_distance_km,
               total_cost, eta_hours, actual_hours, vehicle_id, driver_id)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (sid, json.dumps(path), "dijkstra_distancia", dist_real, breakdown["total_cost"],
             tiempo_real, horas_reales, (sid % 5) + 1, (sid % 4) + 1),
        )


def _seed_customs():
    from models.customs import CustomsDuty
    docs = [
        (1, "Bill of Lading", "BL-2026-001", "2026-08-20", None, "Liberado"),
        (1, "Manifiesto de Carga", "MC-2026-001", "2026-08-20", None, "Liberado"),
        (3, "Declaracion de Exportacion", "DEX-2026-014", "2026-08-28", "2026-09-15", "En Revision"),
        (5, "Certificado de Origen", "CO-2026-007", "2026-08-25", "2026-09-10", "Pendiente"),
    ]
    for sid, dtype, num, issue, expiry, status in docs:
        run_write(
            """INSERT INTO customs_documents (shipment_id, doc_type, doc_number, issue_date,
               expiry_date, status) VALUES (?,?,?,?,?,?)""",
            (sid, dtype, num, issue, expiry, status),
        )

    duties = [(1, 8.0, 25000, 19.0), (3, 5.0, 42000, 19.0), (5, 10.0, 18000, 19.0)]
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


def _seed_users():
    """Usuarios de prueba, uno por cada rol del sistema."""
    from utils.auth import create_user
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
    from utils.fleet_analytics import compute_emissions
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
