"""
colombia_bodegas.py
Red de bodegas de Westvane: varias por ciudad, cada una con un rol y una razón
estratégica. DATOS SIMULADOS: nombres, capacidades, responsables y ubicaciones
son ficticios y aproximados (las coordenadas parten del nodo de la red de esa
ciudad más un desplazamiento pequeño, no de una dirección real).

Cómo opera la red (modelo hub-and-spoke, como una empresa nacional de mensajería
y carga):

    recolección / cliente
        -> bodega de última milla (acopio urbano)
        -> centro regional o centro nacional (clasificación y consolidación)
        -> transporte troncal (carretera, río, mar, aire o tren)
        -> centro regional o nacional del destino
        -> bodega de última milla -> entrega

Las bodegas especializadas atienden lo que no cabe en el flujo general: frío,
puertos y contenedores, aduana y zona franca, fronteras, carga aérea,
mercancías peligrosas, acopio agroindustrial y devoluciones.
"""

# clave -> (nombre, descripción corta, qué almacena)
ROLES = {
    "hub": ("Centro nacional", "Clasifica y cruza el flujo de todo el país (cross-docking).",
            "Paquetería, carga seca consolidada y paletizada"),
    "regional": ("Centro regional", "Consolida y reparte dentro de una región.",
                 "Carga seca, paletizada y de paso entre troncales"),
    "ultima_milla": ("Última milla", "Acopio y reparto urbano con vehículos livianos.",
                     "Paquetes, sobres y cajas pequeñas"),
    "frio": ("Cadena de frío", "Temperatura controlada de 2 a 8 °C.",
             "Medicamentos, flores, lácteos y perecederos"),
    "puerto": ("Portuaria", "Contenedores y carga pesada junto al muelle.",
               "Contenedores, granel y maquinaria"),
    "aduanera": ("Aduanera / zona franca", "Depósito bajo control aduanero.",
                 "Mercancía importada pendiente de nacionalizar"),
    "frontera": ("Frontera", "Comercio exterior por carretera.",
                 "Mercancía de paso y en trámite de frontera"),
    "aerea": ("Carga aérea", "Junto al aeropuerto, con despacho prioritario.",
              "Envíos urgentes, farmacéuticos y de alto valor"),
    "peligrosos": ("Mercancías peligrosas", "Zona segregada con contención de derrames.",
                   "Químicos, combustibles e insumos regulados"),
    "agro": ("Acopio agroindustrial", "Recibe producto de la región para enviarlo al mercado.",
             "Café, arroz, cacao y productos del agro"),
    "devoluciones": ("Logística inversa", "Devoluciones, reproceso y reempaque.",
                     "Devoluciones de clientes y reproceso"),
}

# código, nombre, ciudad, nodo de la red, rol, m³, pallets, muelles, Δlat, Δlon, turno, razón estratégica
# (frío, peligrosos y aduana se deducen del rol)
BODEGAS = [
    # ---- Bogotá: el centro del país ---------------------------------------------------
    ("BOG-HUB", "Centro Nacional Bogotá (Funza)", "Bogotá", "CEDI-BOG", "hub", 42000, 18000, 36, 0.00, 0.00, "24/7",
     "Centro geográfico y de mayor volumen: aquí se cruzan las troncales a Medellín, Cali, la Costa y los Llanos."),
    ("BOG-AER", "Carga Aérea El Dorado", "Bogotá", "BOG-AIR", "aerea", 9000, 3800, 14, 0.00, 0.00, "24/7",
     "Pegada al principal aeropuerto de carga del país: despacho prioritario a 7 destinos y a Leticia."),
    ("BOG-FRI", "Frío Sabana (Tocancipá)", "Bogotá", "CEDI-BOG", "frio", 7500, 3200, 10, 0.17, 0.12, "24/7",
     "Cerca de las flores de exportación y de las plantas farmacéuticas de la Sabana."),
    ("BOG-SUR", "Centro Regional Sur (Soacha)", "Soacha", "CITY-SOA", "regional", 16000, 7000, 18, 0.00, 0.00, "06:00-22:00",
     "Sale por la autopista al sur (Girardot, Ibagué, Neiva) sin entrar a la ciudad."),
    ("BOG-UM1", "Última Milla Bogotá Norte", "Bogotá", "CEDI-BOG", "ultima_milla", 3200, 1400, 12, 0.19, -0.02, "05:00-21:00",
     "Reparto del norte, de mayor poder de compra y más pedidos por hora."),
    ("BOG-UM2", "Última Milla Bogotá Occidente (Fontibón)", "Bogotá", "CEDI-BOG", "ultima_milla", 3600, 1500, 12, 0.02, -0.09, "05:00-21:00",
     "Junto al aeropuerto y la zona industrial: recibe lo que llega por aire y por la vía a Medellín."),
    ("BOG-DEV", "Logística Inversa Bogotá", "Bogotá", "CEDI-BOG", "devoluciones", 5200, 2200, 8, -0.05, 0.05, "06:00-20:00",
     "Concentra las devoluciones del comercio electrónico de la capital para reprocesarlas en un solo sitio."),
    # ---- Medellín ----------------------------------------------------------------------
    ("MDE-HUB", "Centro Nacional Medellín (Girardota)", "Medellín", "CEDI-MDE", "hub", 30000, 13000, 28, 0.00, 0.00, "24/7",
     "Puerta de entrada al Valle de Aburrá y salida a Urabá y al Caribe por la troncal de Occidente."),
    ("MDE-UM", "Última Milla Medellín Sur (Itagüí)", "Medellín", "CEDI-MDE", "ultima_milla", 3400, 1500, 12, -0.19, 0.02, "05:00-21:00",
     "Cubre el sur del Valle, que concentra industria y vivienda."),
    ("MDE-AER", "Carga Aérea Rionegro", "Rionegro", "CITY-RNG", "aerea", 6000, 2600, 10, 0.00, 0.00, "24/7",
     "A los pies del aeropuerto José María Córdova, segundo del país en carga."),
    ("MDE-FRI", "Frío Medellín (Barbosa)", "Medellín", "CEDI-MDE", "frio", 4800, 2000, 8, 0.08, 0.04, "24/7",
     "Perecederos del Oriente antioqueño y lácteos del norte del departamento."),
    # ---- Cali --------------------------------------------------------------------------
    ("CLO-HUB", "Centro Nacional Cali (Yumbo)", "Cali", "CEDI-CLO", "hub", 28000, 12000, 26, 0.00, 0.00, "24/7",
     "Eje del suroccidente: conecta con Buenaventura, Popayán, el Eje Cafetero y Bogotá."),
    ("CLO-UM", "Última Milla Cali Oriente", "Cali", "CEDI-CLO", "ultima_milla", 3000, 1300, 10, -0.03, 0.11, "05:00-21:00",
     "Oriente de la ciudad, de alta densidad y entregas a domicilio."),
    ("CLO-AER", "Carga Aérea Palmaseca", "Cali", "CLO-AIR", "aerea", 5200, 2200, 8, 0.00, 0.00, "24/7",
     "Despacha a la capital, a Cartagena y a San Andrés con prioridad."),
    ("CLO-AGR", "Acopio Agroindustrial Palmira", "Cali", "CEDI-CLO", "agro", 11000, 4800, 10, 0.18, 0.12, "06:00-18:00",
     "En el corazón del Valle del Cauca: azúcar, frutas y hortalizas que van al puerto y a la capital."),
    # ---- Barranquilla y la Costa -------------------------------------------------------
    ("BAQ-HUB", "Centro Nacional Barranquilla", "Barranquilla", "CEDI-BAQ", "hub", 26000, 11000, 24, 0.00, 0.00, "24/7",
     "Distribuye toda la Costa Caribe y recibe lo que llega por el río Magdalena y el mar."),
    ("BAQ-PTO", "Portuaria Barranquilla", "Barranquilla", "PORT-BAQ", "puerto", 14000, 6000, 12, 0.00, 0.00, "24/7",
     "A pasos del muelle sobre el Magdalena: contenedores y granel que bajan o suben por el río."),
    ("BAQ-UM", "Última Milla Barranquilla Norte", "Barranquilla", "CEDI-BAQ", "ultima_milla", 2800, 1200, 10, 0.01, -0.06, "05:00-21:00",
     "Reparto urbano de la ciudad y del área metropolitana."),
    ("CTG-PTO", "Portuaria Cartagena (Mamonal)", "Cartagena", "PORT-CTG", "puerto", 24000, 10500, 20, 0.00, 0.00, "24/7",
     "Junto al mayor puerto de contenedores del país: aquí empieza y termina buena parte del comercio exterior."),
    ("CTG-ZF", "Zona Franca Cartagena", "Cartagena", "PORT-CTG", "aduanera", 15000, 6500, 14, 0.02, 0.03, "24/7",
     "Permite guardar mercancía importada sin pagar aranceles hasta que se nacionalice."),
    ("CTG-PEL", "Peligrosos Cartagena (Mamonal)", "Cartagena", "PORT-CTG", "peligrosos", 6000, 2400, 6, -0.03, 0.02, "24/7",
     "En el polo petroquímico: químicos y resinas, lejos de zonas pobladas."),
    ("CTG-AER", "Carga Aérea Rafael Núñez", "Cartagena", "CTG-AIR", "aerea", 3200, 1400, 6, 0.00, 0.00, "06:00-23:00",
     "Despacho prioritario hacia Bogotá, Medellín, Cali y San Andrés."),
    ("SMR-PTO", "Portuaria Santa Marta", "Santa Marta", "PORT-SMR", "puerto", 12000, 5200, 10, 0.00, 0.00, "24/7",
     "Punta del corredor del carbón y del ferrocarril Fenoco; también banano y café de exportación."),
    ("MTR-AGR", "Acopio Agroindustrial Montería", "Montería", "CITY-MTR", "agro", 9000, 3800, 8, 0.00, 0.00, "06:00-18:00",
     "Zona ganadera y agrícola del Sinú: reúne la producción para enviarla al puerto de Cartagena."),
    ("MAI-FRO", "Frontera Maicao", "Maicao", "CITY-MAI", "frontera", 6500, 2800, 8, 0.00, 0.00, "06:00-20:00",
     "Paso de comercio con Venezuela por La Guajira."),
    # ---- Oriente -----------------------------------------------------------------------
    ("BGA-REG", "Centro Regional Bucaramanga (Girón)", "Bucaramanga", "CEDI-BGA", "regional", 17000, 7400, 18, 0.00, 0.00, "24/7",
     "Nudo de Santander: conecta la costa por la Ruta del Sol, Cúcuta y Barrancabermeja."),
    ("BGA-UM", "Última Milla Bucaramanga", "Bucaramanga", "CEDI-BGA", "ultima_milla", 2400, 1000, 8, 0.04, -0.02, "05:00-21:00",
     "Reparto del área metropolitana (Floridablanca, Piedecuesta, Girón)."),
    ("EJA-PEL", "Peligrosos Barrancabermeja", "Barrancabermeja", "RIV-EJA", "peligrosos", 7000, 2800, 8, 0.00, 0.00, "24/7",
     "Junto a la refinería y al puerto fluvial: combustibles e insumos para el transporte por río."),
    ("CUC-REG", "Centro Regional Cúcuta", "Cúcuta", "CITY-CUC", "regional", 12000, 5200, 12, 0.00, 0.00, "06:00-22:00",
     "Capital del oriente fronterizo: reúne lo que baja de Bucaramanga y sube a la frontera."),
    ("CUC-FRO", "Frontera Cúcuta", "Cúcuta", "CITY-CUC", "frontera", 8000, 3400, 10, 0.03, 0.04, "06:00-20:00",
     "Junto a los puentes internacionales: tránsito de mercancías con Venezuela."),
    ("VVC-REG", "Centro Regional Villavicencio", "Villavicencio", "CITY-VVC", "regional", 10000, 4300, 10, 0.00, 0.00, "06:00-20:00",
     "Puerta de los Llanos: un solo centro para Meta, Casanare y los ríos Meta y Orinoco."),
    ("EYP-REG", "Centro Regional Yopal", "Yopal", "CITY-EYP", "regional", 7000, 3000, 8, 0.00, 0.00, "06:00-20:00",
     "Casanare: petróleo y agro; está a medio camino del corredor al Llano y a Arauca."),
    # ---- Pacífico y suroccidente -------------------------------------------------------
    ("BUN-PTO", "Portuaria Buenaventura", "Buenaventura", "PORT-BUN", "puerto", 18000, 7800, 16, 0.00, 0.00, "24/7",
     "Principal puerto del Pacífico: comercio con Asia y la costa oeste de América."),
    ("BUN-ADU", "Depósito Aduanero Buenaventura", "Buenaventura", "PORT-BUN", "aduanera", 9000, 3900, 8, 0.01, 0.02, "24/7",
     "Mercancía importada que espera trámite antes de subir a Cali y a Bogotá."),
    ("PEI-REG", "Centro Regional Pereira", "Pereira", "CITY-PEI", "regional", 11000, 4700, 10, 0.00, 0.00, "06:00-22:00",
     "Eje Cafetero: equidistante de Bogotá, Medellín y Cali; reparte a Caldas, Quindío y Risaralda."),
    ("PEI-AGR", "Acopio Café Pereira", "Pereira", "CITY-PEI", "agro", 6000, 2600, 6, 0.03, -0.03, "06:00-18:00",
     "Reúne el café de la región para enviarlo al puerto."),
    ("IBG-REG", "Centro Regional Ibagué", "Ibagué", "CITY-IBG", "regional", 9000, 3900, 10, 0.00, 0.00, "06:00-20:00",
     "En la mitad de la transversal Bogotá - Buenaventura: cruce obligado de la carga al Pacífico."),
    ("NVA-AGR", "Acopio Agroindustrial Neiva", "Neiva", "CITY-NVA", "agro", 8000, 3400, 8, 0.00, 0.00, "06:00-18:00",
     "Arroz y cacao del Huila y del sur del Tolima; sale hacia Bogotá por la troncal."),
    ("PSO-REG", "Centro Regional Pasto", "Pasto", "CITY-PSO", "regional", 6500, 2800, 8, 0.00, 0.00, "06:00-20:00",
     "Nariño: lácteos y papa hacia Cali, y mercancía de Ecuador hacia el norte."),
    ("IPI-FRO", "Frontera Ipiales", "Ipiales", "CITY-IPI", "frontera", 5500, 2300, 6, 0.00, 0.00, "06:00-20:00",
     "Paso de Rumichaca: comercio con Ecuador por la Panamericana."),
    # ---- Amazonas ----------------------------------------------------------------------
    ("LET-AER", "Carga Aérea Leticia", "Leticia", "LET-AIR", "aerea", 1800, 700, 3, 0.00, 0.00, "07:00-17:00",
     "La única conexión rápida de la Amazonia: cada vuelo es insumo vital (medicinas, víveres)."),
]

# Perfil de inventario por rol. (sku, nombre, categoría, unidad, volumen m³/u, peso kg/u, costo USD/u, cantidad típica)
STOCK_PROFILES = {
    "hub": [
        ("PAQ-S", "Paquete pequeño (hasta 2 kg)", "Paquetería", "un", 0.006, 1.2, 4, 21000),
        ("PAQ-M", "Paquete mediano (hasta 10 kg)", "Paquetería", "un", 0.03, 6, 9, 9500),
        ("PAL-GEN", "Pallet de carga seca consolidada", "Carga seca", "pallet", 1.6, 650, 180, 1400),
        ("SOB-DOC", "Sobres y documentos", "Paquetería", "un", 0.001, 0.2, 2, 52000),
        ("EMB-CAJ", "Cajas y embalajes de reemplazo", "Insumos", "un", 0.05, 0.8, 1.5, 3800),
        ("ELE-LIN", "Línea blanca y electrodomésticos", "Electrodomésticos", "un", 0.35, 28, 240, 520),
    ],
    "regional": [
        ("PAL-GEN", "Pallet de carga seca consolidada", "Carga seca", "pallet", 1.6, 650, 180, 620),
        ("PAQ-M", "Paquete mediano (hasta 10 kg)", "Paquetería", "un", 0.03, 6, 9, 5200),
        ("TEX-ROP", "Textiles y confecciones", "Textiles", "caja", 0.12, 14, 130, 760),
        ("ALI-SEC", "Alimentos secos empacados", "Alimentos", "caja", 0.09, 12, 38, 1900),
        ("MAT-CON", "Materiales de construcción livianos", "Construcción", "pallet", 1.4, 800, 150, 160),
    ],
    "ultima_milla": [
        ("PAQ-S", "Paquete pequeño (hasta 2 kg)", "Paquetería", "un", 0.006, 1.2, 4, 7800),
        ("PAQ-M", "Paquete mediano (hasta 10 kg)", "Paquetería", "un", 0.03, 6, 9, 2600),
        ("SOB-DOC", "Sobres y documentos", "Paquetería", "un", 0.001, 0.2, 2, 14000),
        ("COD-PAG", "Envíos contra entrega", "Paquetería", "un", 0.012, 2, 6, 1400),
    ],
    "frio": [
        ("MED-FRI", "Medicamentos de cadena de frío", "Medicamentos", "caja", 0.04, 5, 420, 1800),
        ("VAC-FRI", "Vacunas y biológicos", "Medicamentos", "caja", 0.02, 3, 900, 640),
        ("FLO-EXP", "Flores de exportación", "Flores", "caja", 0.22, 14, 60, 2400),
        ("LAC-FRI", "Lácteos refrigerados", "Perecederos", "caja", 0.06, 11, 26, 3100),
        ("CAR-FRI", "Carnes y pescado refrigerado", "Perecederos", "caja", 0.05, 15, 70, 1500),
    ],
    "puerto": [
        ("CON-40", "Contenedor de 40' (TEU x2)", "Contenedores", "contenedor", 67, 24000, 3200, 120),
        ("CON-20", "Contenedor de 20'", "Contenedores", "contenedor", 33, 12000, 1800, 210),
        ("GRA-CAF", "Café excelso de exportación", "Café", "saco", 0.1, 70, 210, 5200),
        ("MAQ-PES", "Maquinaria agrícola e industrial", "Maquinaria", "un", 14, 5200, 28000, 36),
        ("GRA-FER", "Fertilizante a granel", "Granel", "tonelada", 1.1, 1000, 340, 2600),
    ],
    "aduanera": [
        ("IMP-ELE", "Electrónica importada en depósito", "Importaciones", "caja", 0.08, 9, 480, 3400),
        ("IMP-REP", "Repuestos importados en depósito", "Importaciones", "caja", 0.06, 14, 260, 2800),
        ("IMP-TEX", "Textiles importados en depósito", "Importaciones", "caja", 0.12, 13, 150, 1800),
        ("IMP-MAQ", "Maquinaria importada en depósito", "Importaciones", "un", 11, 4200, 24000, 28),
    ],
    "frontera": [
        ("TRA-GEN", "Mercancía en tránsito de frontera", "Comercio exterior", "pallet", 1.5, 600, 210, 340),
        ("EXP-ALI", "Alimentos de exportación en espera", "Alimentos", "caja", 0.09, 12, 40, 2100),
        ("IMP-GEN", "Importaciones pendientes de nacionalizar", "Importaciones", "caja", 0.1, 11, 190, 1500),
    ],
    "aerea": [
        ("URG-PAQ", "Envío urgente aéreo", "Urgentes", "un", 0.02, 4, 30, 2600),
        ("MED-AER", "Medicamentos y vacunas aéreos", "Medicamentos", "caja", 0.04, 5, 420, 900),
        ("FLO-EXP", "Flores de exportación", "Flores", "caja", 0.22, 14, 60, 1500),
        ("VAL-ALT", "Carga de alto valor", "Valores", "un", 0.01, 2, 900, 180),
    ],
    "peligrosos": [
        ("QUI-IND", "Químicos industriales (tambores de 200 L)", "Químicos", "tambor", 0.3, 220, 160, 1900),
        ("RES-PLA", "Resinas plásticas", "Químicos", "saco", 0.04, 25, 38, 6200),
        ("COM-LIQ", "Combustibles en canecas", "Combustibles", "caneca", 0.06, 45, 70, 3100),
        ("GAS-CIL", "Gases en cilindros", "Químicos", "cilindro", 0.05, 60, 110, 1100),
    ],
    "agro": [
        ("GRA-CAF", "Café excelso", "Café", "saco", 0.1, 70, 210, 8200),
        ("ARR-PAD", "Arroz paddy", "Granos", "bulto", 0.07, 50, 28, 12000),
        ("CAC-GRA", "Cacao en grano", "Granos", "saco", 0.09, 60, 120, 2400),
        ("FRU-FRE", "Frutas frescas", "Perecederos", "caja", 0.05, 18, 16, 4200),
        ("AZU-REF", "Azúcar refinada", "Alimentos", "bulto", 0.06, 50, 36, 5200),
    ],
    "devoluciones": [
        ("DEV-GEN", "Devoluciones por clasificar", "Devoluciones", "un", 0.03, 5, 12, 6200),
        ("DEV-REP", "Productos en reproceso", "Devoluciones", "un", 0.04, 6, 18, 2300),
        ("EMB-REE", "Reempaque listo para reenviar", "Devoluciones", "un", 0.03, 5, 14, 1500),
        ("DEV-DES", "Producto para destrucción o remate", "Devoluciones", "un", 0.05, 7, 5, 700),
    ],
}

MANAGERS = [
    "Camila Restrepo", "Andrés Quintero", "Laura Ospina", "Julián Beltrán", "Paola Herrera", "Sebastián Arias",
    "Natalia Giraldo", "Mauricio Cárdenas", "Valentina Ríos", "Felipe Montoya", "Daniela Pardo", "Esteban Cortés",
    "Juliana Peña", "Santiago Mejía", "Marcela Duarte", "Camilo Vargas", "Isabel Castaño", "Ricardo Lozano",
]
