# Bitácora del proyecto LogiSuite TMS

Registro de todo lo construido, investigado, decidido y pendiente hasta hoy.
Rama de trabajo: `claude/laughing-albattani-875mtq`.

---

## 1. Estado actual

| Parte | Estado |
|---|---|
| Backend (FastAPI + SQLite + NetworkX) | Funcional. 85 pruebas en verde. |
| Frontend (Next.js 16 + Tailwind v4 + deck.gl) | Funcional. Typecheck y lint sin errores. |
| Docker local (`docker-compose.yml`) | Probado: ambos contenedores healthy, persistencia verificada. |
| Render (plan gratuito) | Desplegado con blueprint. Frontend con error de servidor corregido en el último commit; pendiente de verificar. |
| VM de Oracle (gratis) | Preparada en el repositorio, **sin crear la cuenta todavía**. |
| VM de Hetzner (pago) | Solo planeada. Migración futura. |
| Dominio | No comprado. Opciones: DuckDNS (gratis) o dominio propio. |

**Lentitud reportada en Render:** causada por el plan gratuito (arranque en frío de hasta 50 s, CPU compartida, servidor en Oregón). No se resuelve con código solamente.

---

## 2. Historial de commits relevantes

| Commit | Contenido |
|---|---|
| `0ad4a5b` … `67d4c21` | Fases 1 a 6 de la versión Streamlit (tema, datos Colombia, mapas pydeck, Docker). |
| `73dc363` | Último estado de la versión Streamlit. Punto de partida si se quiere desplegarla de nuevo en Streamlit Community Cloud. |
| `67d4c21` | Fase 1 de la versión Next.js: monorepo `backend/` + `frontend/`, tema Obsidian Slate, componentes shadcn a mano. |
| `4bd8d86` | Fase 2: esquema v3 y red multimodal de Colombia, motor NetworkX con transbordos. |
| `e990cf3` | Fase 3: API FastAPI (red GeoJSON, simulación de rutas, flota en vivo, departamentos DANE, dashboard). |
| `59cb01b` | Fase 4: dashboard Bento, tabla TanStack de envíos, sidebar animada, proxy `/api`. |
| `7bc5266` | Fase 5: mapa 3D Map3D (deck.gl + MapLibre), simulador en `/red`, worker de MapLibre en `public/vendor`. |
| `2409c6a` | Fase 6: Dockerfiles multi-stage y `docker-compose.yml` maestro. README nuevo. |
| `5bee700` | `render.yaml` (blueprint de Render). |
| `c12c0ab` | Preparación de despliegue en VM: Caddy, respaldos, GitHub Actions, `DEPLOY.md`. |
| `5527d74` | Corrección de `API_INTERNAL_URL` en Render (URL completa en lugar de host). |

---

## 3. Arquitectura actual

```
backend/app/
├── main.py                       API FastAPI
├── api/format.py                 Formato numérico es-CO
├── api/serializers.py            JSON y GeoJSON
├── engine/multimodal.py          Enrutamiento multimodal (grafo por (nodo, modo))
├── engine/dispatch.py            Envíos, activos por tramo, estado según el reloj
├── engine/telemetry.py           Posición interpolada, estados, reposición
├── engine/geo.py                 Departamentos DANE y tráfico por trazado
├── data/colombia_multimodal.py   Nodos, corredores, trazados
├── data/colombia_departamentos.geojson
├── database/schema*.py           Esquemas base, v2 y v3 (mm_nodes, mm_links, mm_shipments)
└── init_db.py                    Esquema + semilla idempotente

frontend/src/
├── app/                          /  dashboard · /envios tabla · /red mapa + simulador
├── app/api/[...path]/route.ts    Proxy hacia FastAPI
├── components/Map3D.tsx          Mapa maestro deck.gl + MapLibre
├── components/map/               Simulador, leyenda, carga de datos, geometría
├── components/dashboard/         Bento, KPI, gráficos, flota en vivo
├── components/shipments/         Tabla TanStack Table v9
└── lib/modes.ts, types.ts, api.ts
```

**Endpoints:** `/api/health`, `/api/network/multimodal`, `POST /api/routes/simulate`, `/api/fleet/live`, `/api/shipments`, `/api/shipments/{code}`, `/api/dashboard/summary`, `/api/geo/departments`, `/api/locations`.

**Motor multimodal:** cada nodo se replica por modo. Un enlace une estados del mismo modo; un transbordo une modos distintos en el mismo nodo. Las escalas aéreas tienen estado de llegada y de salida. Prioridades: `tiempo`, `costo`, `balanceado` (costo + 12 USD por t·h). Respeta la capacidad por despacho.

**Estados de envío derivados del reloj:** Programado, En Ruta, Transferencia Modal, Retrasado, Entregado. No se guardan fijos; se calculan con la salida, la duración, el retraso y las ventanas de transbordo.

---

## 4. Decisiones técnicas tomadas

- **Dos versiones:** la Streamlit (commit `73dc363`) y la Next.js + FastAPI (rama actual). La Streamlit ya no está en el árbol de trabajo.
- **Paleta de modos:** validada con `validate_palette.js` del skill de visualización sobre la superficie `#0B0F19`. Orden fijo marítimo, terrestre, aéreo, férreo, fluvial (la validación depende del orden).
- **Nomenclatura de vehículos:** la columna `vehicle_type` conserva los valores del `CHECK` del esquema original; la interfaz muestra "Tractomula 3S3", "Dobletroque", "Camión Sencillo", "Turbo NPR".
- **Departamentos:** GeoJSON real del DANE (MGN 2018, nivel departamento), con propiedades reducidas a código y nombre.
- **Worker de MapLibre:** copiado a `public/vendor/` en `predev`/`prebuild`; con Turbopack la URL relativa no existía.
- **Telemetría:** simulación determinista sobre el trazado de cada ruta. No hay GPS. Se repone con despachos cuando hay menos de 16 en tránsito.
- **Moneda:** USD en todo el sistema. La conversión a COP está pendiente (ver sección 7).
- **Proxy `/api`:** el navegador solo habla con Next.js; `API_INTERNAL_URL` se resuelve en tiempo de ejecución.
- **Usuarios de prueba:** `admin/admin123`, `operador/oper123`, `lector/lect123`. Visibles en la pantalla de login. Hay que cambiarlos si el enlace será público.

---

## 5. Investigación realizada

- **Geografía:** GeoJSON de departamentos obtenido del DANE (`co_2018_MGN_DPTO_POLITICO`). Otras fuentes públicas no respondieron (raw de GitHub de varios repos devolvieron 404).
- **Shadcn/ui:** el registro `ui.shadcn.com` está bloqueado en este entorno. Los componentes se escribieron a mano siguiendo su estructura.
- **TanStack Table v9:** API `useTable` y `tableFeatures`; leída en la documentación incluida en `node_modules`.
- **Next.js 16:** `RouteContext`, `connection()`, `output: standalone`. Documentación leída en `node_modules/next/dist/docs`.
- **Error #441 de React en producción:** causado por pasar funciones (iconos) desde un Server Component a uno cliente. Corregido pasando elementos ya renderizados.
- **MapLibre 6 + Turbopack:** el worker no se resolvía. Solución: copiarlo a `public/vendor` y llamar `setWorkerUrl`.
- **Deck.gl 9.4:** `TripsLayer`, `PathStyleExtension`, `CollisionFilterExtension` confirmados. `@deck.gl/mapbox` y `@deck.gl/maplibre` disponibles.
- **Render:** el plan gratuito duerme tras 15 min sin uso; el disco no persiste; `fromService.host` no incluye esquema.
- **Oracle Always Free:** las instancias inactivas pueden ser recuperadas. Pendiente verificar la política vigente antes de depender de ella.
- **Hetzner:** CX22 (2 vCPU, 4 GB) en torno a 4–5 €/mes. Precio por confirmar en la página oficial.
- **Docker Hub:** límite de descargas alcanzado en este entorno; se usó `mirror.gcr.io` para la base de las imágenes.
- **Vulnerabilidades npm:** 15 avisos en dependencias transitivas de deck.gl (`@loaders.gl`, `fflate`, `image-size`). La corrección automática degrada deck.gl; no se aplicó.

---

## 6. Problemas resueltos

| Problema | Causa | Solución |
|---|---|---|
| Página Aduanas fallaba | `add_vline` con anotación sobre eje de fechas | Anotación separada |
| Hero mostraba SVG como código | Markdown interpretó líneas indentadas | SVG en una sola línea |
| Etiquetas del mapa no aparecían | pydeck evalúa strings como expresiones | Literales entre comillas |
| Error #441 en `/` | Función pasada a componente cliente | Elementos ya renderizados |
| Mapa base no cargaba | Worker de MapLibre sin URL válida | `public/vendor` + `setWorkerUrl` |
| Streamlit no arrancaba en Docker | Buscaba `secrets.toml` en `/root` | `HOME=/app` al bajar privilegios |
| Render: frontend con error de servidor | `API_INTERNAL_URL` sin esquema | URL completa en `render.yaml` |

---

## 7. Pendientes (aprobados en principio, sin iniciar)

Orden propuesto:

1. **Modelo de datos:** tablas de vías (con estado activo/cerrado y motivo), envíos creados por el usuario y configuración de TRM.
2. **Vías no disponibles:** interruptor por corredor; recálculo de rutas y redirección de envíos en curso; historial del cambio.
3. **Envíos modelables:** crear, editar y borrar desde la interfaz; ruta calculada al guardar; opción de forzar modos o vías.
4. **Auditoría de botones:** identificar los controles sin acción real y conectarlos o quitarlos.
5. **Monedas:** selector USD/COP en toda la app; TRM editable con fecha y fuente. No se usa una tasa automática porque no hay acceso confiable a la del día.
6. **Exportación:** PDF individual por envío, PDF consolidado, visualización en navegador y enlace para compartir.
7. **Red ampliada:**
   - Capitales departamentales: Cúcuta, Manizales, Armenia, Montería, Valledupar, Riohacha, Yopal, Florencia, San José del Guaviare, Quibdó, Arauca, Mitú, Inírida, San Andrés.
   - Áreas metropolitanas: Soacha, Girardot, Rionegro, Apartadó, Ipiales.
   - Puertos: Turbo, Tumaco, Puerto Bolívar, Puerto Nuevo, Puerto Carreño.
   - Aeropuertos: Cúcuta, Pereira, Montería, Valledupar, Rionegro, San Andrés, Villavicencio, Bucaramanga.
   - Corredores: Troncal Central de Antioquia, Cúcuta–Bucaramanga, Troncal de la Costa, vías al Urabá y a Tumaco, ríos Meta, Atrato y Orinoco, y trazados férreos (algunos inactivos).
8. **Historial de trayectos** por ciudad y departamento; costos de peaje y combustible por corredor; alertas operativas (vía cerrada, derrumbe, paro).
9. **Despliegue permanente:** cuenta de Oracle, VM, HTTPS con Caddy, dominio, GitHub Actions, respaldos. Ver `DEPLOY.md`.
10. **Mejoras de velocidad:** caché de respuestas de la API, menos peticiones al abrir el dashboard, carga diferida del mapa.

### Decisiones abiertas

- ¿Autenticación para editar envíos y cerrar vías? (El login actual es de demostración.)
- ¿Compartir por enlace público o solo por PDF descargado?
- ¿Historial de cambios con usuario y fecha?
- ¿Migrar a Hetzner antes de la revisión del profesor o usar Oracle gratis?

---

## 8. Cosas a verificar antes de confiar en ellas

- Coordenadas y distancias de corredores nuevos: son aproximadas salvo que se contrasten con fuentes oficiales.
- Precios de Hetzner, Render y dominios: cambian; revisar en la página oficial.
- Política de Oracle sobre instancias inactivas: revisar la documentación vigente.
- Funcionamiento real en Render y en la VM: no probado en esos entornos.
- Archivos modificados en disco sin registro (`main.py`, `dispatch.py`, `multimodal.py`, `Map3D.tsx`, `shipments-table.tsx`, `colombia_multimodal.py`, `serializers.py`, `format.py`, `telemetry.py`, `.env.example`, `docker-compose.yml`): origen por confirmar.

---

## 9. Acceso y credenciales

No se guardan contraseñas, tokens ni claves privadas en este documento.

- GitHub: repositorio `sebastianslg/logisuite-app`, rama `claude/laughing-albattani-875mtq`.
- Render: blueprint `logisuite`, servicios `logisuite-api` y `logisuite-web`.
- Secretos para GitHub Actions (`SSH_HOST`, `SSH_USER`, `SSH_KEY`): pendientes de crear cuando exista la VM.
