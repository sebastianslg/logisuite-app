# LogiSuite TMS — Transporte multimodal para Colombia

Transportation Management System multimodal: carretera, río, mar, aire y
ferrocarril sobre la red logística real de Colombia, con enrutamiento óptimo
con transbordos, flota en vivo y cartografía 3D.

- **Backend:** FastAPI + SQLite + NetworkX (`/backend`)
- **Frontend:** Next.js 16 (App Router) + Tailwind v4 + shadcn/ui + Framer
  Motion + TanStack Table + deck.gl / MapLibre (`/frontend`)

## Despliegue con Docker

```bash
cp .env.example .env        # opcional: puertos, zona horaria, estilo del mapa
docker compose up -d --build
```

| Servicio | URL | Imagen |
|---|---|---|
| Frontend | http://localhost:3000 | `frontend/Dockerfile` (multi-stage, Next standalone, usuario no root) |
| API | http://localhost:8000/docs | `backend/Dockerfile` (multi-stage, venv, usuario no root) |

- La base SQLite vive en `./backend/data` (volumen montado en `/data`):
  persiste entre reinicios y reconstrucciones. Para empezar de cero:
  `docker compose down`, borrar `backend/data/logistics.db` y volver a levantar.
- El frontend espera a que la API esté sana (`depends_on: service_healthy`) y
  le habla por la red interna (`API_INTERNAL_URL=http://backend:8000`). El
  navegador solo habla con el frontend: `/api/*` se reenvía a FastAPI.
- El build del frontend ejecuta `typecheck` (TypeScript estricto) antes de
  `next build`; el del backend, `pip check`.

## Desarrollo local

```bash
# API (desde backend/)
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000      # crea y siembra la base al arrancar
pytest -q                                      # 85 pruebas

# Frontend (desde frontend/)
npm install
npm run dev                                    # http://localhost:3000
npm run typecheck && npm run lint
```

## Arquitectura

```
backend/app/
├── main.py                  API FastAPI (endpoints abajo)
├── api/format.py            Formato numérico es-CO (miles con punto, sin decimales de más)
├── api/serializers.py       Respuestas JSON y GeoJSON
├── engine/multimodal.py     Motor de enrutamiento multimodal (NetworkX)
├── engine/dispatch.py       Envíos, activos por tramo y estado según el reloj
├── engine/telemetry.py      Posición interpolada, estados y reposición de despachos
├── engine/geo.py            Departamentos DANE y tráfico por trazado
├── data/colombia_multimodal.py      Nodos, corredores y trazados de la red
├── data/colombia_departamentos.geojson
├── database/                schema.py, schema_v2.py, schema_v3.py (red multimodal), db.py
├── models/, utils/          Dominio y analítica heredados (fletes, flota, aduanas, inventario)
└── init_db.py               Esquema + semilla (idempotente)

frontend/src/
├── app/                     / (dashboard), /envios (tabla TMS), /red (mapa 3D + simulador)
├── app/api/[...path]/       Proxy hacia FastAPI (URL resuelta en tiempo de ejecución)
├── components/Map3D.tsx     Componente maestro de cartografía 3D
├── components/map/          Simulador, capas, geometría de vuelos, carga de datos
├── components/dashboard/    Bento grid, KPI animados, gráficos, flota en vivo
├── components/shipments/    Tabla TanStack (filtros, orden, paginación)
└── lib/modes.ts             Paleta por modo (validada para daltonismo) y estados
```

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/network/multimodal` | Nodos (Point) y enlaces (LineString con trazado real) en GeoJSON |
| POST | `/api/routes/simulate` | `{origen, destino, prioridad, peso_t}` → ruta óptima con tramos, transbordos, tiempos, costos, recorrido animable y alternativas |
| GET | `/api/fleet/live` | Activos en tránsito con posición interpolada sobre su trazado |
| GET | `/api/shipments`, `/api/shipments/{code}` | Envíos con estado, avance y ETA |
| GET | `/api/dashboard/summary` | KPI, reparto modal, corredores, despachos |
| GET | `/api/geo/departments` | 33 departamentos con toneladas que los atraviesan |
| GET | `/api/locations` | Ciudades y nodos seleccionables |

## Motor multimodal

Grafo expandido por estados `(nodo, modo)`:

- Un **enlace** une estados del mismo modo; un **transbordo** une dos modos
  del mismo nodo con el tiempo y costo de manipulación de ese tipo de nodo
  (aeropuerto, puerto, terminal férrea…).
- En aeropuertos hay estados de **llegada y salida**: una escala LET → BOG →
  CTG es una conexión con su propio tiempo, no un paso gratuito.
- Origen y destino pueden ser **ciudades** (`Leticia` agrupa aeropuerto y
  puerto fluvial).
- **Prioridades:** `tiempo`, `costo` y `balanceado` (USD + valor del tiempo de
  la carga, 12 USD por tonelada-hora).
- La **capacidad por despacho** se respeta: el carguero de Leticia admite 20 t.

Leticia → Cartagena con 5 t:

| Prioridad | Ruta | Tiempo | Costo |
|---|---|---|---|
| tiempo | Vuelo LET-BOG + conexión + vuelo BOG-CTG | 5 h 36 min | US$ 11.028 |
| balanceado | Vuelo LET-BOG + transbordo a camión + carretera BOG-CTG | 29 h 54 min | US$ 8.072 |
| costo | Ríos Amazonas y Putumayo + transbordo + carretera | 11 d 19 h | US$ 2.518 |

### Red de Colombia incluida

- **Terrestre:** Ruta del Sol, Troncal del Magdalena, Troncal de Occidente,
  transversal Bogotá–Buenaventura, Autopista Medellín–Bogotá, Troncal
  Central del Norte, Vía al Llano y accesos.
- **Marítimo / fluvial:** SPRC Cartagena (Mamonal), Buenaventura,
  Barranquilla, Santa Marta; Río Magdalena, Canal del Dique y Amazonas–
  Putumayo hasta Leticia; Pacífico–Caribe por el Canal de Panamá.
- **Aéreo:** El Dorado (BOG), Rafael Núñez (CTG), Alfredo Vásquez Cobo (LET),
  José María Córdova (MDE) y Alfonso Bonilla Aragón (CLO).
- **Férreo:** corredor Fenoco Chiriguaná – Santa Marta.

Clientes y transportadores de la semilla son ficticios. La telemetría de la
flota es una simulación determinista sobre el trazado de cada ruta (no hay
GPS); cuando hay menos de 16 envíos en tránsito, la API despacha nuevos.

## Cartografía

- Mapa base: CARTO Dark Matter (sin token). Cambia el estilo con
  `NEXT_PUBLIC_MAP_STYLE` y reconstruye el frontend.
- Departamentos: **DANE, Marco Geoestadístico Nacional 2018** (nivel
  departamento), simplificados a código, nombre y 3 decimales.
- El worker de MapLibre se copia a `public/vendor/` en `predev`/`prebuild`:
  empaquetado por Turbopack, su URL relativa no existe y el mapa base fallaba.

## Notas

- Todos los valores monetarios están en USD.
- `npm audit` reporta avisos en dependencias transitivas de deck.gl (parsers
  de ZIP, glTF e imágenes de `@loaders.gl`). La aplicación no procesa ese tipo
  de archivos; la "corrección" automática propone degradar deck.gl, así que no
  se aplica.
- La interfaz Streamlit anterior se retiró en esta versión; sigue disponible
  en el historial de git.
