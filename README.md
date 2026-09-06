# LogiSuite — Plataforma de Logística, Distribución y Transporte

Aplicación web 100% nativa para la nube (Streamlit) para la gestión integral de
una red de distribución: almacenes, fletes, transporte, flota y aduanas, con
mapas geográficos reales, motor de costos parametrizado, ruteo con NetworkX y
un núcleo de simulación de red (trade-off costo vs. nivel de servicio).

## Estructura del proyecto

```
logistics_app/
├── app.py                  # Portada y arranque (inicializa la BD automáticamente)
├── init_db.py               # Crea el esquema y carga datos de prueba
├── requirements.txt
├── database/
│   ├── schema.py             # DDL SQL con claves foráneas estrictas
│   └── db.py                 # Conexión SQLite y helpers de acceso a datos
├── models/                   # Clases POO por módulo (CRUD + lógica de negocio)
│   ├── network.py            # Node, Corridor (núcleo de la red)
│   ├── warehouse.py          # Módulo 1 - Warehouse Management
│   ├── freight.py            # Módulo 2 - Freight Management + motor de costos
│   ├── transportation.py     # Módulo 3 - Transportation Management (rutas)
│   ├── fleet.py               # Módulo 4 - Fleet Management
│   └── customs.py            # Módulo 5 - Customs Management
├── utils/
│   ├── network_algorithms.py # NetworkX: Dijkstra, simulación, trade-off
│   ├── map_utils.py          # Capas pydeck (puntos + arcos)
│   ├── report_exporter.py    # Exportación a Excel y PDF con estilo
│   └── seed_data.py          # Datos de prueba (red logística colombiana)
├── pages/                     # Páginas Streamlit (multipágina nativa)
│   ├── 1_🏭_Dashboard_Ejecutivo.py
│   ├── 2_📦_Warehouse_Management.py
│   ├── 3_🚚_Freight_Management.py
│   ├── 4_🗺️_Transportation_Network.py
│   ├── 5_🚛_Fleet_Management.py
│   ├── 6_🛃_Customs_Management.py
│   └── 7_🔬_Simulacion_Red.py
└── data/                      # Aquí se crea logistics.db (SQLite) en el primer arranque
```

## Ejecución local

```bash
pip install -r requirements.txt
streamlit run app.py
```

La base de datos SQLite (`data/logistics.db`) se crea y se llena con datos de
prueba automáticamente la primera vez que se ejecuta `app.py`. Si quieres
reiniciarla manualmente desde cero:

```bash
python init_db.py --reset
```

## Despliegue en Streamlit Community Cloud

1. Sube esta carpeta a un repositorio de GitHub (incluye `app.py`,
   `requirements.txt` y todas las carpetas `database/`, `models/`, `utils/`,
   `pages/`; no necesitas subir `data/logistics.db`, se genera solo).
2. Entra a [share.streamlit.io](https://share.streamlit.io), conecta tu
   repositorio y selecciona `app.py` como archivo principal.
3. Streamlit Cloud instalará `requirements.txt` y, al primer arranque,
   `app.py` detecta que no existe la base de datos y ejecuta `init_db.py`
   automáticamente — no se requiere ningún paso manual adicional.
4. Comparte la URL pública que te entrega Streamlit Cloud; funciona desde
   cualquier PC con solo abrir el navegador.

> Nota: en Streamlit Community Cloud el sistema de archivos es efímero — si la
> app se reinicia (redeploy, "sleep" por inactividad), `logistics.db` se
> regenera con los datos de prueba de `seed_data.py`. Para persistencia real
> entre reinicios, reemplaza la conexión en `database/db.py` por una base de
> datos externa (por ejemplo Postgres vía `st.connection`).

## Módulos funcionales

1. **Warehouse Management** — inventario en tiempo real por zona de rotación
   (Alta/Media/Baja), ciclo Inbound (recepción/inspección) y Outbound
   (picking/empaque/despacho), alertas de stock crítico/sobre-stock, y
   reportes de rotación y valoración de existencias.
2. **Freight Management** — registro y tracking de envíos, y un motor de
   costos parametrizado con 3 componentes explícitos: costo de transacción
   (seguros, aduanas, trámites), fricción de la distancia (energía + tiempo
   del corredor) y costo del envío (empaque + masificación de unidades).
3. **Transportation Management** — mapa geográfico interactivo de la red
   (nodos + corredores), ruteo con NetworkX (Dijkstra por distancia o por
   costo), asignación de vehículo/conductor y control de ETA vs. tiempo real.
4. **Fleet Management** — vehículos (placa, tipología, capacidad),
   mantenimientos preventivos/correctivos con historial de odómetro, y
   conductores con licencias, categorías y alertas de vigencia.
5. **Customs Management** — documentación aduanera por envío (Bill of Lading,
   manifiestos, declaraciones), cálculo de aranceles e impuestos, estado del
   trámite en tiempo real y alertas de vencimiento de documentos.
6. **Núcleo de Simulación de Red** — impacto de cerrar/abrir un nodo sobre
   distancia promedio, costo total y nivel de servicio; curva de trade-off
   Costo vs. Nivel de Servicio variando el número de CDs activos; análisis de
   sensibilidad ante variaciones de demanda, costo laboral y energético.

## Modelo de datos

El esquema relacional completo (con `PRAGMA foreign_keys = ON`) está en
`database/schema.py`. El núcleo son las tablas `nodes` y `corridors`, de las
que dependen (por clave foránea) todas las tablas de los 5 módulos:
`warehouses → inventory_items → warehouse_movements`,
`shipments → routes → (vehicles, drivers)`,
`vehicles`, `drivers`, `maintenance_records`,
`customs_documents`, `customs_duties`.

## Reportes exportables

Cada página de módulo incluye botones de descarga en **Excel** (con
encabezados de color, bordes y autoajuste de columnas vía `openpyxl`) y
**PDF** (tabla estilizada en horizontal vía `reportlab`), generados a partir
de los mismos datos que se muestran en pantalla.
