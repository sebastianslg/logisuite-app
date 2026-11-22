# API: medición y cambios de rendimiento (22/11/2026)

Máquina local (Ryzen 3 5300U, 8 hilos, 16 GB), SQLite de ejemplo, servidores en loopback. No es una medición de
producción: sirve para comparar antes/después con el mismo equipo.

## Prueba de carga con 8 personas

`deploy/prueba-carga.py` con la cuenta local de pruebas, 20 s, 8 hilos: **226 peticiones, 0 errores**.

| Tipo | Peticiones | Mediana | p95 | Peor |
|---|---:|---:|---:|---:|
| Página | 130 | 270 ms | 1.273 ms | 1.547 ms |
| API | 96 | 34 ms | 100 ms | 102 ms |

Las tres páginas más lentas: `/` (presentación pública, 699 ms de mediana; fuera del alcance de esta ronda),
`/flota` (367 ms) y `/hoy` (354 ms). Antes de esta ronda la bitácora anotaba 1,2–1,7 s por página con 8 personas.

## Lecturas pesadas

`deploy/medir-lecturas.py` con `WESTVANE_CACHE_TTL=0` sobre una copia de la base:

| Ruta | Antes (sección 75) | Ahora |
|---|---:|---:|
| `/api/today` | 50 ms | ~65 ms (incluye `fleet.summary` con reloj) |
| `/api/alerts` | 44 ms | ~52 ms |
| `/api/shipments?limit=1000` | 61–66 ms | 39–43 ms (memoria por `data_version`) |
| `/api/fleet/vehicles` | 18 ms | 18 ms (ya usaba `fleet._ctx`) |

## Cambios

- **ETag público** en `/api/locations`, `/api/fleet/catalog` y `/api/warehouses/roles`; el cliente revalida y
  recibe 304. Las respuestas con nombres de operador o códigos de envíos (`/api/nodes/status`, `/api/corridors`)
  pasan a `Cache-Control: no-store` y no llevan validador.
- **Tablero**: los conteos por estado y los totales en tránsito salen de la misma consulta de filas (se quitó el
  `GROUP BY status`); los modos de la red no serializan el GeoJSON completo.
- **Flota**: `summary()` calcula fallas, mantenimientos y costo de 90 días desde las tablas ya recordadas en
  `_ctx` (antes: dos SELECT con JOIN y un DataFrame por llamada).
- **Historial**: el mapa ciudad→departamento se recuerda por `data_version` (no depende del reloj).
- **Telemetría**: `live_fleet` pide solo las columnas que usan el mapa y el combustible (incluido `status`, que
  una prueba exige).
- **`/api/shipments`**: filas y recuentos recordados por `data_version` + filtros + orden, con cerrojo en la
  purga; la escritura se ve de inmediato (sección 75).

## Pruebas

`pytest -q`: **582 aprobadas**. Nuevas: `test_etag_catalogos.py` (16), `test_avance_tramos.py` (1) y
`test_rutas_frecuentes.py`. La suite completa de navegador queda en **101 aprobadas**.
