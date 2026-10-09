"""
colombia_multimodal.py
Definición de la red logística multimodal de Colombia usada por la semilla.

Coordenadas en grados decimales (WGS84). Los trazados (`via`) son puntos de
paso por poblaciones reales del corredor, de modo que las capas del mapa
sigan la carretera, el río, la costa o la vía férrea en lugar de una recta.
Las distancias y tiempos de carretera son los de un vehículo de carga pesada;
los de río y mar, los de un convoy de barcazas o un buque de cabotaje. Las
distancias aéreas se calculan como ortodrómicas a partir de las coordenadas.

Todos los costos están en USD, como el resto del sistema.
"""

# ---------------------------------------------------------------------------
# Parámetros económicos por modo
# ---------------------------------------------------------------------------
MODE_PARAMS = {
    #             USD/t-km   USD fijo/despacho   capacidad t/despacho
    # Terrestre: la capacidad es la de un convoy de tractomulas (35 t c/u); el
    # número de vehículos se calcula al despachar. El aéreo sí está limitado
    # por la bodega del avión en un solo despacho.
    "terrestre": {"cost_per_tkm": 0.085, "fixed_cost": 150.0, "capacity_t": 2000.0},
    "fluvial":   {"cost_per_tkm": 0.030, "fixed_cost": 400.0, "capacity_t": 1200.0},
    "maritimo":  {"cost_per_tkm": 0.018, "fixed_cost": 900.0, "capacity_t": 20000.0},
    "aereo":     {"cost_per_tkm": 1.150, "fixed_cost": 450.0, "capacity_t": 45.0},
    "ferreo":    {"cost_per_tkm": 0.040, "fixed_cost": 300.0, "capacity_t": 2500.0},
}

# Transbordo entre modos según el tipo de nodo: (horas, USD por tonelada)
TRANSFER_BY_KIND = {
    "aeropuerto": (3.0, 22.0),
    "puerto_maritimo": (12.0, 14.0),
    "puerto_fluvial": (8.0, 10.0),
    "terminal_ferrea": (5.0, 7.0),
    "cedi": (2.0, 6.0),
    "ciudad": (1.5, 5.0),
}

# ---------------------------------------------------------------------------
# Nodos: código, nombre, tipo, ciudad, departamento DANE, lat, lon, IATA
# ---------------------------------------------------------------------------
NODES = [
    # CEDIs
    ("CEDI-BOG", "CEDI Bogotá (Funza)", "cedi", "Bogotá", "25", 4.7166, -74.2119, None),
    ("CEDI-MDE", "CEDI Medellín (Girardota)", "cedi", "Medellín", "05", 6.3770, -75.4460, None),
    ("CEDI-CLO", "CEDI Cali (Yumbo)", "cedi", "Cali", "76", 3.5852, -76.4954, None),
    ("CEDI-BAQ", "CEDI Barranquilla", "cedi", "Barranquilla", "08", 10.9685, -74.7813, None),
    ("CEDI-BGA", "CEDI Bucaramanga (Girón)", "cedi", "Bucaramanga", "68", 7.0700, -73.1690, None),
    # Puertos marítimos
    ("PORT-CTG", "SPRC Cartagena (Mamonal)", "puerto_maritimo", "Cartagena", "13", 10.3600, -75.5050, None),
    ("PORT-BUN", "Puerto de Buenaventura", "puerto_maritimo", "Buenaventura", "76", 3.8906, -77.0786, None),
    ("PORT-BAQ", "Puerto de Barranquilla", "puerto_maritimo", "Barranquilla", "08", 10.9653, -74.7612, None),
    ("PORT-SMR", "Puerto de Santa Marta", "puerto_maritimo", "Santa Marta", "47", 11.2470, -74.2160, None),
    # Puertos fluviales
    ("RIV-CAL", "Puerto fluvial de Calamar", "puerto_fluvial", "Calamar", "13", 10.2500, -74.9150, None),
    ("RIV-EJA", "Puerto fluvial de Barrancabermeja", "puerto_fluvial", "Barrancabermeja", "68", 7.0653, -73.8547, None),
    ("RIV-LDA", "Puerto fluvial de La Dorada", "puerto_fluvial", "La Dorada", "17", 5.4545, -74.6631, None),
    ("RIV-PAS", "Puerto fluvial de Puerto Asís", "puerto_fluvial", "Puerto Asís", "86", 0.5054, -76.4950, None),
    ("RIV-LET", "Puerto fluvial de Leticia", "puerto_fluvial", "Leticia", "91", -4.2153, -69.9406, None),
    # Aeropuertos
    ("BOG-AIR", "Aeropuerto El Dorado", "aeropuerto", "Bogotá", "11", 4.7016, -74.1469, "BOG"),
    ("CTG-AIR", "Aeropuerto Rafael Núñez", "aeropuerto", "Cartagena", "13", 10.4424, -75.5130, "CTG"),
    ("LET-AIR", "Aeropuerto Alfredo Vásquez Cobo", "aeropuerto", "Leticia", "91", -4.1935, -69.9432, "LET"),
    ("MDE-AIR", "Aeropuerto José María Córdova", "aeropuerto", "Medellín", "05", 6.1645, -75.4231, "MDE"),
    ("CLO-AIR", "Aeropuerto Alfonso Bonilla Aragón", "aeropuerto", "Cali", "76", 3.5432, -76.3816, "CLO"),
    # Terminal férrea (corredor Fenoco)
    ("RAIL-CHI", "Terminal férrea Chiriguaná", "terminal_ferrea", "Chiriguaná", "20", 9.3624, -73.6007, None),
    # Ciudades de paso de la red vial
    ("CITY-IBG", "Ibagué", "ciudad", "Ibagué", "73", 4.4389, -75.2322, None),
    ("CITY-NVA", "Neiva", "ciudad", "Neiva", "41", 2.9273, -75.2819, None),
    ("CITY-PEI", "Pereira", "ciudad", "Pereira", "66", 4.8143, -75.6946, None),
    ("CITY-PPN", "Popayán", "ciudad", "Popayán", "19", 2.4448, -76.6147, None),
    ("CITY-PSO", "Pasto", "ciudad", "Pasto", "52", 1.2136, -77.2811, None),
    ("CITY-MCO", "Mocoa", "ciudad", "Mocoa", "86", 1.1528, -76.6461, None),
    ("CITY-CAU", "Caucasia", "ciudad", "Caucasia", "05", 7.9867, -75.1937, None),
    ("CITY-SIN", "Sincelejo", "ciudad", "Sincelejo", "70", 9.3047, -75.3978, None),
    ("CITY-BOS", "Bosconia", "ciudad", "Bosconia", "20", 9.9762, -73.8899, None),
    ("CITY-VVC", "Villavicencio", "ciudad", "Villavicencio", "50", 4.1420, -73.6266, None),
    ("CITY-TUN", "Tunja", "ciudad", "Tunja", "15", 5.5353, -73.3678, None),
]

# ---------------------------------------------------------------------------
# Enlaces: origen, destino, modo, corredor, km, horas, puntos de paso (lat, lon)
# km = None -> se calcula como distancia ortodrómica (aéreo).
# ---------------------------------------------------------------------------
LINKS = [
    # ---- TERRESTRE: Ruta del Sol (Bogotá - Costa Caribe) -------------------
    ("CEDI-BOG", "RIV-LDA", "terrestre", "Ruta del Sol", 185, 4.5,
     [(5.0120, -74.4730), (5.0690, -74.5980), (5.4650, -74.6530)]),
    ("RIV-LDA", "RAIL-CHI", "terrestre", "Ruta del Sol", 560, 10.5,
     [(5.9770, -74.5880), (6.5300, -74.1000), (7.7600, -73.3900), (8.3100, -73.6200), (8.9600, -73.6200)]),
    ("RAIL-CHI", "CITY-BOS", "terrestre", "Ruta del Sol", 95, 1.8,
     [(9.6100, -73.5800)]),
    ("CITY-BOS", "PORT-SMR", "terrestre", "Ruta del Sol", 185, 3.5,
     [(10.5200, -74.1900), (11.0050, -74.2500)]),
    ("CITY-BOS", "CEDI-BAQ", "terrestre", "Ruta del Sol", 230, 4.5,
     [(10.5200, -74.1900), (11.0050, -74.2500), (11.0100, -74.6000)]),
    # ---- TERRESTRE: Troncal del Magdalena (Ruta 45) ------------------------
    ("CITY-NVA", "RIV-LDA", "terrestre", "Troncal del Magdalena", 330, 6.5,
     [(3.6200, -75.0900), (4.3030, -74.8030), (5.2000, -74.8900), (5.2050, -74.7410)]),
    ("CITY-NVA", "CITY-MCO", "terrestre", "Troncal del Magdalena", 290, 7.0,
     [(2.1950, -75.6280), (1.8530, -76.0510)]),
    # ---- TERRESTRE: Troncal de Occidente (Ruta 25) -------------------------
    ("CITY-PSO", "CITY-PPN", "terrestre", "Troncal de Occidente", 250, 6.0,
     [(1.6120, -77.1250), (2.0250, -77.0100)]),
    ("CITY-PPN", "CEDI-CLO", "terrestre", "Troncal de Occidente", 150, 3.2,
     [(3.0100, -76.4800), (3.2600, -76.5400)]),
    ("CEDI-CLO", "CITY-PEI", "terrestre", "Troncal de Occidente", 210, 4.5,
     [(3.9000, -76.3000), (4.3100, -75.9900), (4.7400, -75.9100)]),
    ("CITY-PEI", "CEDI-MDE", "terrestre", "Troncal de Occidente", 250, 5.8,
     [(5.0700, -75.5200), (5.7500, -75.6000), (6.0600, -75.6500), (6.2440, -75.5810)]),
    ("CEDI-MDE", "CITY-CAU", "terrestre", "Troncal de Occidente", 270, 6.5,
     [(6.6250, -75.4600), (7.0100, -75.4500), (7.5900, -75.3400)]),
    ("CITY-CAU", "CITY-SIN", "terrestre", "Troncal de Occidente", 210, 4.5,
     [(8.4300, -75.1800), (8.8400, -75.3100)]),
    ("CITY-SIN", "PORT-CTG", "terrestre", "Troncal de Occidente", 185, 3.5,
     [(9.7200, -75.1200), (10.0600, -75.2400)]),
    # ---- TERRESTRE: transversales y accesos -------------------------------
    ("CEDI-BOG", "CITY-IBG", "terrestre", "Transversal Bogotá - Buenaventura", 195, 4.5,
     [(4.3370, -74.3640), (4.3030, -74.8030), (4.1500, -74.8800)]),
    ("CITY-IBG", "CEDI-CLO", "terrestre", "Transversal Bogotá - Buenaventura", 270, 6.5,
     [(4.4400, -75.4300), (4.5300, -75.6400), (4.3100, -75.9900), (3.9000, -76.3000)]),
    ("CEDI-CLO", "PORT-BUN", "terrestre", "Transversal Bogotá - Buenaventura", 120, 3.0,
     [(3.6600, -76.6900), (3.7600, -76.6700), (3.7800, -76.7500)]),
    ("CITY-IBG", "CITY-NVA", "terrestre", "Troncal del Magdalena", 210, 4.0,
     [(4.1500, -74.8800), (3.6200, -75.0900)]),
    ("CEDI-BOG", "CEDI-MDE", "terrestre", "Autopista Medellín - Bogotá", 430, 9.5,
     [(5.0120, -74.4730), (5.0690, -74.5980), (5.4650, -74.6530), (5.8710, -74.6410),
      (6.0400, -75.0000), (6.1740, -75.3380)]),
    ("CEDI-BOG", "CITY-TUN", "terrestre", "Troncal Central del Norte", 150, 3.0,
     [(4.8600, -74.0300), (5.0600, -73.8800)]),
    ("CITY-TUN", "CEDI-BGA", "terrestre", "Troncal Central del Norte", 260, 6.0,
     [(5.9300, -73.6200), (6.5500, -73.1300), (6.8200, -73.1700)]),
    ("CEDI-BGA", "RAIL-CHI", "terrestre", "Troncal del Magdalena", 270, 5.5,
     [(7.3200, -73.2600), (7.7600, -73.3900), (8.3100, -73.6200), (8.9600, -73.6200)]),
    ("CEDI-BGA", "RIV-EJA", "terrestre", "Transversal del Carare", 115, 2.5,
     [(7.0300, -73.4500)]),
    ("CEDI-BOG", "CITY-VVC", "terrestre", "Vía al Llano", 95, 2.5,
     [(4.5000, -73.9500), (4.3200, -73.7600)]),
    ("CITY-PSO", "CITY-MCO", "terrestre", "Vía Pasto - Mocoa", 145, 5.0,
     [(1.1700, -77.0000)]),
    ("CITY-MCO", "RIV-PAS", "terrestre", "Vía Mocoa - Puerto Asís", 100, 2.5,
     [(0.8300, -76.5900)]),
    ("CEDI-BAQ", "PORT-CTG", "terrestre", "Vía al Mar", 120, 2.5,
     [(10.8000, -75.0100), (10.6000, -75.4000)]),
    ("PORT-SMR", "PORT-BAQ", "terrestre", "Troncal del Caribe", 100, 2.2,
     [(11.0050, -74.2500), (11.0100, -74.6000)]),
    # Accesos de última milla a puertos y aeropuertos
    ("BOG-AIR", "CEDI-BOG", "terrestre", "Acceso El Dorado", 15, 0.6, []),
    ("CTG-AIR", "PORT-CTG", "terrestre", "Acceso Rafael Núñez", 14, 0.6, []),
    ("LET-AIR", "RIV-LET", "terrestre", "Acceso aeropuerto Leticia", 4, 0.2, []),
    ("MDE-AIR", "CEDI-MDE", "terrestre", "Acceso José María Córdova", 45, 1.0, []),
    ("CLO-AIR", "CEDI-CLO", "terrestre", "Acceso Alfonso Bonilla Aragón", 12, 0.4, []),
    ("PORT-BAQ", "CEDI-BAQ", "terrestre", "Acceso Puerto de Barranquilla", 10, 0.4, []),
    # ---- FLUVIAL: Río Magdalena y Canal del Dique --------------------------
    ("PORT-BAQ", "RIV-CAL", "fluvial", "Río Magdalena", 105, 14.0,
     [(10.7800, -74.7700), (10.5200, -74.8600)]),
    ("RIV-CAL", "RIV-EJA", "fluvial", "Río Magdalena", 525, 68.0,
     [(9.8700, -74.8200), (9.2400, -74.7500), (9.0000, -73.9700), (8.3200, -73.7400),
      (7.6000, -73.8900)]),
    ("RIV-EJA", "RIV-LDA", "fluvial", "Río Magdalena", 255, 36.0,
     [(6.4900, -74.4000), (5.9800, -74.5800)]),
    ("RIV-CAL", "PORT-CTG", "fluvial", "Canal del Dique", 115, 16.0,
     [(10.2700, -75.1000), (10.3200, -75.3000), (10.3500, -75.4600)]),
    # ---- FLUVIAL: Amazonas - Putumayo (vía río Içá) -------------------------
    ("RIV-LET", "RIV-PAS", "fluvial", "Ríos Amazonas y Putumayo", 1900, 240.0,
     [(-3.8500, -69.0000), (-3.4500, -68.3000), (-3.1000, -67.9400), (-2.9500, -68.4000),
      (-2.8700, -69.7400), (-2.4000, -70.6000), (-1.9000, -71.6000), (-1.4000, -72.6000),
      (-0.9000, -73.6000), (-0.1900, -74.7800), (0.1500, -75.4000)]),
    # ---- MARÍTIMO: cabotaje Caribe y Pacífico - Caribe (Canal de Panamá) ---
    ("PORT-BUN", "PORT-CTG", "maritimo", "Pacífico - Caribe (Canal de Panamá)", 1350, 78.0,
     [(4.5000, -77.6000), (6.0000, -77.8000), (7.2000, -78.6000), (8.3000, -79.3000),
      (8.9500, -79.5700), (9.3600, -79.9000), (9.8000, -78.5000), (10.2000, -76.5000)]),
    ("PORT-CTG", "PORT-BAQ", "maritimo", "Cabotaje Caribe", 125, 9.0,
     [(10.4500, -75.6200), (10.8000, -75.2500), (11.0500, -74.8500)]),
    ("PORT-BAQ", "PORT-SMR", "maritimo", "Cabotaje Caribe", 95, 7.0,
     [(11.1000, -74.7000), (11.1500, -74.4000)]),
    # ---- AÉREO: hubs de carga ---------------------------------------------
    ("LET-AIR", "BOG-AIR", "aereo", "Ruta aérea Leticia - Bogotá", None, 2.3, []),
    ("BOG-AIR", "CTG-AIR", "aereo", "Ruta aérea Bogotá - Cartagena", None, 1.5, []),
    ("BOG-AIR", "MDE-AIR", "aereo", "Ruta aérea Bogotá - Medellín", None, 0.9, []),
    ("BOG-AIR", "CLO-AIR", "aereo", "Ruta aérea Bogotá - Cali", None, 1.0, []),
    ("MDE-AIR", "CTG-AIR", "aereo", "Ruta aérea Medellín - Cartagena", None, 1.2, []),
    ("CLO-AIR", "CTG-AIR", "aereo", "Ruta aérea Cali - Cartagena", None, 1.7, []),
    # ---- FÉRREO: corredor Fenoco ------------------------------------------
    ("RAIL-CHI", "PORT-SMR", "ferreo", "Corredor férreo Fenoco", 245, 12.0,
     [(9.6100, -73.5800), (9.9762, -73.8899), (10.5200, -74.1900), (10.5900, -74.1900),
      (11.0050, -74.2500)]),
]

# Capacidad por despacho distinta a la del modo (pista corta, calado, etc.)
CAPACITY_OVERRIDES = {
    ("LET-AIR", "BOG-AIR"): 20.0,   # Leticia opera cargueros medianos
    ("RIV-LET", "RIV-PAS"): 400.0,  # calado del Putumayo en aguas bajas
}
