"""
colombia_flota.py
Catálogo de tipos de vehículo y la flota semilla de Westvane. DATOS SIMULADOS:
placas, matrículas, nombres de naves y conductores son ficticios. Las marcas y
modelos son comerciales y se usan solo como referencia de capacidad.

Cada tipo trae sus valores por defecto: capacidad, y cada cuánto necesita
mantenimiento (por días o por kilómetros, lo que ocurra primero).
"""

# modo -> tipo -> (capacidad t, capacidad m³, cada cuántos días, cada cuántos km, [(marca, modelo), ...])
CATALOG = {
    "terrestre": {
        "Tractomula 3S3": (35, 80, 90, 20000, [("Kenworth", "T800"), ("Freightliner", "Cascadia"),
                                               ("International", "LT625"), ("Volvo", "FH 540")]),
        "Dobletroque": (18, 45, 90, 18000, [("Chevrolet", "FVR"), ("Hino", "FM"), ("Kenworth", "T370")]),
        "Camión sencillo": (10, 30, 120, 15000, [("Chevrolet", "NPR Reward"), ("Hino", "500 FC"), ("JAC", "N75")]),
        "Turbo": (5, 18, 120, 12000, [("Chevrolet", "NKR"), ("Foton", "BJ1049"), ("JAC", "N56")]),
        "Furgón de reparto": (1.5, 9, 120, 10000, [("Renault", "Master"), ("Hyundai", "H100"), ("Foton", "View")]),
        "Camión refrigerado": (12, 35, 90, 15000, [("Hino", "FC con frío"), ("Chevrolet", "NQR con frío")]),
    },
    "aereo": {
        "Carguero B767-300BCF": (50, 400, 45, 90000, [("Boeing", "767-300BCF")]),
        "Carguero B737-800BCF": (23, 140, 45, 70000, [("Boeing", "737-800BCF")]),
        "Carguero ATR 72-600F": (8, 55, 45, 50000, [("ATR", "72-600F")]),
    },
    "fluvial": {
        "Convoy de barcazas": (1200, 1000, 120, 30000, [("Astilleros del Magdalena", "Convoy 4x300")]),
        "Barcaza autopropulsada": (400, 330, 120, 25000, [("Astilleros del Magdalena", "Autopropulsada 400")]),
    },
    "maritimo": {
        "Buque de cabotaje": (8000, 9000, 180, 60000, [("Damen", "Feeder 8000")]),
        "Portacontenedores": (20000, 26000, 180, 80000, [("Hyundai", "Feeder 1700 TEU")]),
        "Buque tanque": (12000, 13000, 180, 60000, [("Samsung", "Product tanker 12k")]),
    },
    "ferreo": {
        "Tren de carga": (2500, 2600, 60, 40000, [("General Electric", "C30-7 con 90 vagones")]),
    },
}

# Códigos de mantenimiento por categoría de falla
FAULT_CATEGORIES = [
    "Motor", "Frenos", "Llantas", "Transmisión", "Eléctrico", "Refrigeración", "Suspensión",
    "Carrocería", "Iluminación", "Navegación y comunicaciones", "Hidráulico", "Casco y estructura", "Otro",
]

SEVERITIES = ("Leve", "Moderada", "Crítica")

# Taller por modo (ficticios)
WORKSHOPS = {
    "terrestre": ["Taller Autopesados del Centro", "Servicentro Troncal Norte", "Taller Propio - Funza", "Mecánica Pesada Yumbo"],
    "aereo": ["Hangar de Mantenimiento El Dorado", "MRO Andino"],
    "fluvial": ["Astillero Magdalena Medio", "Varadero de Barrancabermeja"],
    "maritimo": ["Astillero de Mamonal", "Dique Flotante Cartagena"],
    "ferreo": ["Talleres Ferroviarios del Norte"],
}

# Flota semilla: (tipo, modo, cantidad, bodegas donde se aloja -> se reparten en orden, prefijo para los nombres no terrestres)
SEED_FLEET = [
    ("Tractomula 3S3", "terrestre", 12, ["BOG-HUB", "BOG-HUB", "BOG-HUB", "MDE-HUB", "MDE-HUB", "CLO-HUB", "CLO-HUB",
                                          "BAQ-HUB", "BAQ-HUB", "BGA-REG", "PEI-REG", "VVC-REG"], None),
    ("Dobletroque", "terrestre", 6, ["BOG-SUR", "IBG-REG", "CUC-REG", "BUN-PTO", "SMR-PTO", "CTG-PTO"], None),
    ("Camión sencillo", "terrestre", 7, ["MDE-UM", "CLO-UM", "BAQ-UM", "BGA-UM", "NVA-AGR", "PSO-REG", "EYP-REG"], None),
    ("Turbo", "terrestre", 6, ["BOG-UM1", "BOG-UM2", "MDE-UM", "CLO-UM", "BAQ-UM", "BGA-UM"], None),
    ("Furgón de reparto", "terrestre", 6, ["BOG-UM1", "BOG-UM2", "BOG-UM1", "MDE-UM", "CLO-UM", "BAQ-UM"], None),
    ("Camión refrigerado", "terrestre", 5, ["BOG-FRI", "BOG-FRI", "MDE-FRI", "CLO-HUB", "BAQ-HUB"], None),
    ("Carguero B767-300BCF", "aereo", 2, ["BOG-AER", "BOG-AER"], "HK-"),
    ("Carguero B737-800BCF", "aereo", 2, ["MDE-AER", "CLO-AER"], "HK-"),
    ("Carguero ATR 72-600F", "aereo", 2, ["LET-AER", "BOG-AER"], "HK-"),
    ("Convoy de barcazas", "fluvial", 3, ["BAQ-PTO", "BAQ-PTO", "EJA-PEL"], "Convoy Magdalena "),
    ("Barcaza autopropulsada", "fluvial", 2, ["LET-AER", "LET-AER"], "Barcaza Putumayo "),
    ("Buque de cabotaje", "maritimo", 2, ["CTG-PTO", "SMR-PTO"], "MV "),
    ("Portacontenedores", "maritimo", 1, ["BUN-PTO"], "MV "),
    ("Buque tanque", "maritimo", 1, ["CTG-PEL"], "MT "),
    ("Tren de carga", "ferreo", 3, ["SMR-PTO", "SMR-PTO", "SMR-PTO"], "Tren Carbonero "),
]

NAVES = ["Caribe Star", "Bahía de Cartagena", "Pacífico Andino", "Sierra Nevada", "Río Grande"]

DRIVER_NAMES = [
    "Alberto Mosquera", "Jhon Fredy Salazar", "Édgar Ramírez", "Wilmer Torres", "Néstor Ávila", "Óscar Peláez",
    "Hernán Castillo", "Duván Moreno", "Fabio Cuéllar", "Gilberto Rincón", "Iván Barrera", "Jairo Zapata",
    "Leonel Mora", "Mario Zuluaga", "Nelson Patiño", "Orlando Bernal", "Pedro Vélez", "Rubén Acosta",
    "Segundo Palacios", "Tulio Henao", "Ubaldo Cifuentes", "Víctor Camacho", "William Polo", "Yesid Ortiz",
    "Armando Gómez", "Bladimir Ruiz", "Cristian Lara", "Darío Muñoz", "Efraín Arango", "Freddy Valencia",
    "Gustavo Ibáñez", "Henry Londoño", "Ismael Cano", "José Luis Navarro", "Kevin Bedoya", "Luis Eduardo Tobón",
    "Marcos Villamil", "Nicolás Sepúlveda", "Orlando Quiroga", "Pablo Echeverri", "Quintín Mejía", "Rafael Soto",
    "Samuel Rivas", "Tomás Giraldo", "Uriel Franco", "Vicente Posada",
]
