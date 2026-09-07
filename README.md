# LogiSuite — Plataforma de Logística, Distribución y Transporte

Aplicación web nativa para la nube que integra la gestión operativa y la
analítica de decisión de una red de distribución: almacenes, fletes, transporte,
flota y aduanas, con mapas geográficos reales, optimización de redes y
herramientas de simulación.

Construida en **Streamlit + SQLite + NetworkX**, se despliega en Streamlit
Community Cloud sin configuración adicional.

---

## Instalación y ejecución local

```bash
pip install -r requirements.txt
streamlit run app.py
```

La base de datos (`data/logistics.db`) se crea y se puebla con datos de prueba
automáticamente la primera vez que se ejecuta `app.py`. Para reiniciarla:

```bash
python init_db.py --reset
```

Para ejecutar la suite de pruebas:

```bash
pytest -v
```

## Despliegue en Streamlit Community Cloud

1. Sube el proyecto a un repositorio de GitHub.
2. En [share.streamlit.io](https://share.streamlit.io) conecta el repositorio y
   selecciona `app.py` como archivo principal.
3. Streamlit instala `requirements.txt` y, al primer arranque, `app.py` detecta
   que no existe la base de datos y ejecuta la inicialización automáticamente.

> **Nota sobre persistencia:** en Streamlit Community Cloud el sistema de
> archivos es efímero. Si la aplicación se reinicia, `logistics.db` se regenera
> con los datos de prueba. Para persistencia real entre reinicios, sustituye la
> conexión en `database/db.py` por una base externa (por ejemplo Postgres vía
> `st.connection`); el resto del código no requiere cambios porque todo el
> acceso a datos pasa por esa capa.

## Acceso y roles

La autenticación viene **desactivada por defecto** (modo demo), de modo que la
aplicación es navegable sin credenciales. Para activarla, cambia el parámetro
`AUTH_ENABLED` a `true` en *Administración → Parámetros del sistema*.

Con la autenticación activa, los usuarios de prueba son:

| Usuario    | Contraseña | Rol       | Permisos                                  |
|------------|------------|-----------|-------------------------------------------|
| `admin`    | `admin123` | admin     | Lectura, escritura y administración        |
| `operador` | `oper123`  | operador  | Lectura y escritura                        |
| `lector`   | `lect123`  | lector    | Solo lectura                               |

Las contraseñas se almacenan con **PBKDF2 y un salt distinto por usuario**;
nunca se guarda texto plano.

---

## Estructura del proyecto

```
logistics_app/
├── app.py                       # Portada, búsqueda global, idioma y tema
├── init_db.py                   # Esquema + datos de prueba (migración aditiva)
├── test_logisuite.py            # Suite de pruebas (pytest)
├── requirements.txt
├── .streamlit/config.toml       # Tema base de la aplicación
├── database/
│   ├── schema.py                 # Esquema base con claves foráneas estrictas
│   ├── schema_v2.py              # Extensiones: usuarios, auditoría, consolidación…
│   └── db.py                     # Capa de acceso a datos (DAL)
├── models/                       # Clases POO por dominio
│   ├── network.py                # Node, Corridor (núcleo de la red)
│   ├── warehouse.py              # Almacenes, inventario y movimientos
│   ├── freight.py                # Envíos y motor de costos
│   ├── transportation.py         # Rutas y control de tiempos
│   ├── fleet.py                  # Vehículos, conductores y mantenimiento
│   ├── customs.py                # Documentos y liquidación aduanera
│   └── consolidation.py          # Consolidación, emisiones y escenarios arancelarios
├── utils/
│   ├── network_algorithms.py     # Dijkstra, estadísticas de red, trade-off
│   ├── advanced_optimization.py  # TSP, facility location, criticidad, Monte Carlo
│   ├── inventory_analytics.py    # Pronósticos, EOQ, ROP, ABC, trazabilidad
│   ├── fleet_analytics.py        # TCO, emisiones, predicción de mantenimiento
│   ├── alerts.py                 # Motor de alertas transversal
│   ├── auth.py                   # Autenticación y control de acceso por rol
│   ├── audit.py                  # Bitácora de auditoría
│   ├── data_tools.py             # Importación validada, exportación y búsqueda global
│   ├── i18n.py                   # Internacionalización español / inglés
│   ├── map_utils.py              # Capas de mapa (pydeck)
│   ├── report_exporter.py        # Exportación a Excel y PDF
│   └── seed_data.py              # Datos de prueba (red logística colombiana)
├── pages/                        # Páginas de la interfaz multipágina
│   ├── 1_Dashboard_Ejecutivo.py
│   ├── 2_Warehouse_Management.py
│   ├── 3_Freight_Management.py
│   ├── 4_Transportation_Network.py
│   ├── 5_Fleet_Management.py
│   ├── 6_Customs_Management.py
│   ├── 7_Simulacion_Red.py
│   ├── 8_Centro_de_Alertas.py
│   ├── 9_Importar_Exportar.py
│   └── 10_Administracion.py
└── data/                         # logistics.db (generada automáticamente)
```

---

## Módulos y funcionalidades

### 1. Warehouse Management
Inventario en tiempo real por zona de rotación, ciclo *Inbound* (recepción e
inspección) y *Outbound* (picking, empaque y despacho), alertas de stock crítico
y sobre-stock, y reportes de rotación y valoración. Incorpora además:

- **Pronóstico de demanda** por SKU con media móvil simple y suavizado
  exponencial, seleccionando automáticamente el método de menor error (MAE).
- **EOQ** (modelo de Wilson) con la curva de costo total que muestra el óptimo.
- **Punto de reorden** con stock de seguridad calculado a partir del nivel de
  servicio deseado (factor Z de una cola).
- **Clasificación ABC** por valor de consumo con diagrama de Pareto. Los SKU sin
  despachos se clasifican por valor de stock y quedan marcados como tales, para
  no mezclar bases de cálculo sin advertirlo.
- **Ocupación por zona** en mapa de calor y **trazabilidad** completa de cada SKU.

### 2. Freight Management
Registro y seguimiento de envíos, con un **motor de costos de tres componentes
explícitos**: costo de transacción (seguros y trámites), fricción de la distancia
(energía y tiempo del corredor) y costo del envío (empaque y masificación). Además:

- **Consolidación de carga**: detecta envíos que comparten corredor y ventana de
  fechas, cuantifica el ahorro y ejecuta la agrupación.
- **Simulador de modos** que compara costo, tiempo y emisiones entre transporte
  terrestre, marítimo, fluvial y aéreo, y expresa el trade-off en dólares por
  hora ganada.
- **Huella de carbono** por envío, calculada con factores por tonelada-kilómetro.
- **Historial de costos por corredor** como serie temporal frente al índice de
  combustible.

### 3. Transportation Management
Mapa geográfico interactivo de la red, ruteo con Dijkstra y:

- **Comparación de criterios** (distancia, costo, tiempo) que evidencia cuándo
  existe un trade-off real entre ellos.
- **Ruteo multi-parada (TSP)** con vecino más cercano y mejora 2-opt sobre el
  circuito cerrado depósito → paradas → depósito.
- **Validación de capacidad**: impide asignar un vehículo cuya capacidad en peso
  o volumen sea insuficiente, e identifica el factor limitante.
- **Programación en diagrama de Gantt** y **control de ETA vs. tiempo real**.

### 4. Fleet Management
Vehículos, conductores con vigencia de licencias y mantenimiento preventivo y
correctivo, más:

- **Costo Total de Propiedad (TCO)** por vehículo, descompuesto en combustible,
  mantenimiento y depreciación, con el costo por kilómetro como indicador de
  eficiencia comparable entre unidades.
- **Predicción del próximo mantenimiento** por kilometraje proyectado.
- **Panel de disponibilidad** de la flota y **alertas combinadas**.

### 5. Customs Management
Documentación aduanera, liquidación de tributos y:

- **Escenarios arancelarios comparados**, que cuantifican el valor económico de
  una preferencia comercial. El IVA se liquida sobre el valor en aduana más el
  arancel, como corresponde al régimen colombiano.
- **Checklist de completitud documental** según el tipo de operación.
- **Línea de tiempo** de vigencia y estado de cada trámite.

### 6. Simulación y Optimización de Red
- **Cierre de nodos** con medición del impacto en distancia, costo y servicio.
- **Ubicación óptima de instalaciones**: búsqueda exhaustiva cuando el espacio de
  combinaciones es manejable (óptimo global garantizado) y muestreo cuando crece.
- **Análisis de criticidad** que cruza centralidad de intermediación con el daño
  real medido al eliminar cada nodo.
- **Simulación de Monte Carlo** de demanda variable, con distribución del costo,
  percentiles de planificación y probabilidad de desabastecimiento.
- **Análisis de sensibilidad** con la elasticidad de cada factor de costo.

### 7. Capacidades transversales
- **Centro de Alertas** que consolida stock crítico, licencias y documentos por
  vencer, envíos retrasados y mantenimientos pendientes, priorizados por severidad.
- **Importación masiva** desde CSV o Excel con validación fila por fila, y
  **exportación consolidada** a un único libro con una hoja por módulo.
- **Búsqueda global** por SKU, placa, documento o envío desde la barra lateral.
- **Autenticación por roles** y **bitácora de auditoría** de cada cambio.
- **Idioma español/inglés** y **modo claro/oscuro** conmutables por el usuario.

---

## Modelo de datos

El esquema relacional aplica `PRAGMA foreign_keys = ON` y se divide en dos
archivos: `schema.py` (núcleo) y `schema_v2.py` (extensiones). Ambos usan
`CREATE TABLE IF NOT EXISTS`, de modo que **la migración es aditiva**: una base
de datos creada con la versión anterior se actualiza sin perder información al
ejecutar `init_db.py`.

Las tablas `nodes` y `corridors` son el núcleo del que dependen, por clave
foránea, todas las demás:

```
nodes ──┬── warehouses ── inventory_items ── warehouse_movements
        ├── corridors ── corridor_cost_history
        ├── shipments ──┬── routes ──── vehicles, drivers
        │                ├── customs_documents, customs_duties
        │                ├── shipment_emissions
        │                └── consolidation_items ── consolidations
        └── multi_stop_routes
vehicles ── maintenance_records
users, audit_log, tariff_scenarios, system_params
```

---

## Notas metodológicas

Algunas decisiones de cálculo que conviene tener presentes al interpretar los
resultados:

- **Todos los valores monetarios están en USD.** Mezclar monedas haría que
  indicadores agregados como el TCO no signifiquen nada.
- **El factor Z del stock de seguridad es de una cola** (Z al 95% = 1,645), que
  es el correcto cuando solo penaliza el faltante y no el exceso.
- **El TSP resuelve un circuito cerrado** con retorno al depósito, que es el
  caso real de un vehículo de reparto.
- **Los vehículos sin historial de mantenimiento preventivo** no se reportan
  como vencidos por todo su odómetro: se les programa el siguiente múltiplo del
  intervalo por encima de su kilometraje actual.
- **La clasificación ABC declara su base de cálculo** por ítem, porque un SKU sin
  despachos se clasifica por valor de stock y esa posición aún no está
  respaldada por demanda real.
- **La optimización de instalaciones indica su método**: es un óptimo global solo
  cuando evaluó todas las combinaciones, y así lo reporta en la interfaz.

## Pruebas

`test_logisuite.py` contiene 61 pruebas que verifican las fórmulas contra su
resultado teórico (EOQ de Wilson, ROP, liquidación aduanera, emisiones) y las
invariantes que deben cumplirse siempre (el TSP heurístico nunca reporta menos
que el óptimo exacto calculado por fuerza bruta, el 2-opt nunca empeora la
solución inicial, los componentes del TCO suman el total, el Pareto acumulado
cierra en 100%). Varias pruebas son de regresión sobre errores ya corregidos y
están marcadas como tales en su descripción.

```bash
pytest -v          # detalle de cada prueba
pytest -q          # resumen
```
