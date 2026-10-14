# Traspaso de chat: Westvane TMS

Documento para continuar el trabajo en otro chat sin perder contexto. Estado al **14 de octubre de 2026**.
Repositorio: `sebastianslg/logisuite-app` (el nombre del repo y de los servicios en Render sigue siendo `logisuite-*`).

## Mensaje para pegar al empezar el chat nuevo

> Continúo el trabajo en `sebastianslg/logisuite-app` (app **Westvane TMS**, antes LogiSuite). Lee `docs/TRASPASO_CHAT.md`
> y retoma por la sección "Pendiente". Trabaja en la rama `claude/focused-hypatia-epjpst` (reiníciala desde `main`
> si su PR ya está fusionado). Responde en español. No abras ni fusiones PR sin que te lo pida; sí puedes hacer commit y push.

---

## 1. Qué es la app

TMS multimodal para Colombia (carretera, río, mar, aire y ferrocarril).

- **Backend:** FastAPI + SQLite + NetworkX (`/backend`).
- **Frontend:** Next.js 16 (App Router, ojo: *no es el Next que conoces*, lee `frontend/node_modules/next/dist/docs/`) + Tailwind v4 + Framer Motion + deck.gl/MapLibre + TanStack Table (`/frontend`).
- **Despliegue:** Render (dos servicios Docker, `render.yaml`) y también guía para VM de Oracle (`DEPLOY.md`).
- Datos simulados: clientes, transportistas y telemetría son ficticios; la flota se mueve por una simulación determinista.

## 2. Historia de ramas y PRs (importante)

Hubo **dos líneas de trabajo paralelas** que ya están unidas:

| Línea | Qué tenía |
|---|---|
| `claude/laughing-albattani-875mtq` (la que Render desplegaba al principio) | Vías cerradas con redirección de envíos, envíos editables, PDF y enlaces para compartir, TRM con historial, red ampliada, menú de celular, `render.yaml`. |
| `main` + rama del rediseño | Rediseño tipo Apple (vidrio, movimiento, claro/oscuro), combustible y huella de carbono, clics que llevan a algo, categorías de ciudades, renombre a Westvane. |

PRs fusionados a `main`: #2 (antiguo), #4 (rediseño HIG), #5 (movimiento, vidrio, módulos verdes), #6 (renombre a Westvane), #7 (app completa), **#8 (trae los commits de `laughing-albattani` a `main` y los une con lo nuevo)**.
`main` hoy contiene todo. La rama `laughing-albattani` ya está fusionada y se puede borrar (yo no puedo: mis herramientas de GitHub no borran ramas).

Error mío ya corregido: en un momento recomendé poner Render en `main` cuando `main` aún no tenía las funciones de esa rama; el PR #8 lo resolvió.

## 3. Estado de despliegue (Render)

- Los servicios se llaman `logisuite-api` y `logisuite-web`. **Pon ambos en la rama `main`**; despliega primero la API y después el frontend.
- El frontend necesita `API_INTERNAL_URL` con la URL completa de la API (con `https://`).
- `LOGISUITE_DB_PATH` sigue siendo válida y **tiene prioridad** sobre `WESTVANE_DB_PATH` (para no perder la base de despliegues existentes).
- **La base SQLite se pierde en cada redeploy** si no hay disco persistente (`render.yaml` la deja en `/tmp`). Opciones: Persistent Disk montado en `/data` (de pago; precios no verificados) o aceptar datos de demostración.
- No se confirmó aún que el redeploy de `main` haya quedado en "Live".

## 4. Lo que está hecho

### Diseño y experiencia
- Sistema visual Apple (HIG): tokens semánticos claro/oscuro, vidrio (`.glass`, `.material`), radios 16/24 px, colores del sistema, tipografía del sistema con **Inter empaquetada** (`@fontsource-variable/inter`; San Francisco no se puede usar fuera de Apple).
- Movimiento: una curva `cubic-bezier(0.16, 1, 0.3, 1)` (`frontend/src/lib/motion.ts`), 0,3 s en interacciones y 0,5 s en vistas; presión en `:active` (`.press`), elevación al pasar el cursor, entradas en cascada (`Reveal`), listas con altura/opacidad. Respeta "reducir movimiento" y "reducir transparencia".
- Barra superior: paleta de comandos `Ctrl/⌘ K` (o `/`), moneda COP/USD con **TRM editable** (se guarda en el servidor), apariencia Sistema/Claro/Oscuro.
- Barra lateral unificada con grupos (Operación, Logística verde, Sistema) y menú deslizable en celular.
- PWA instalable (manifest + iconos 192/512), `viewport-fit=cover`, objetivos táctiles de 44 px, tabla de envíos en tarjetas en móvil, panel del simulador plegable en móvil.

### Funcionalidad
- **Todo lleva a algo:** KPI → `/envios` filtrado; filas de flota → detalle del envío; estados y modos → filtros por URL (`?estado=`, `?modo=`, `?q=`); gráficas se amplían en una hoja (`Sheet`) con tabla y CSV.
- Detalle de envío (`/envios/[code]`) con mapa, recorrido, costo, huella, historial, documentos y exportación.
- Envíos editables: `/envios/nuevo` (con vista previa de ruta y huella), `/envios/[code]/editar`, borrar, selección múltiple, PDF y enlaces para compartir.
- **Vías cerradas** (`/vias`): cerrar/reabrir corredores con motivo; las rutas los evitan; los envíos en tránsito se redirigen o quedan "sin ruta". Alerta en el dashboard.
- **Configuración** (`/configuracion`): TRM con fecha y fuente, reposición automática, historial, enlaces compartidos.
- **Combustible** (`/combustible`) y **Huella de carbono** (`/huella`): dials y barras animados desde 0, hojas de detalle con CSV.
- Simulador (`/red`): filtros por categoría de ciudad (Todos / Ciudades principales / Municipios / Difícil acceso), selector con búsqueda, directorio, inspector de ciudad, huella por ruta, vistas Mapa/Datos y pantalla completa.
- Mapa: estilo claro u oscuro según la apariencia; animación limitada a ~30 fps (10 en el mapa compacto).

### Backend (añadido en esta tanda)
- `app/engine/sustainability.py`: factores por modo (g CO₂e/t-km: camión 80, tren 22, barcaza 31, buque 16, avión 602) → CO₂e y combustible. **Estimación, no inventario certificado.**
- Endpoints: `GET /api/sustainability/summary`, `GET /api/sustainability/fuel-live`; `footprint` en `POST /api/routes/simulate`, `POST /api/shipments/preview` y `GET /api/shipments/{code}`; `category`, `lat`, `lon` en `/api/locations`; `all_corridors` en `/api/dashboard/summary`.
- `app/data/colombia_ciudades.py`: `category_of()`. "Difícil acceso" = la ciudad no tiene vía terrestre ni férrea hacia **otra** ciudad de la red.
- Pruebas: **139 en verde** (`backend/tests/`, incluye `test_sustainability.py`).

### Skills instaladas en el entorno (se pierden al cerrar el contenedor)
`apple-design` (también copiada en `.claude/skills/apple-design/` del repo), paquete de Emil Kowalski (`emil-design-eng`, `animate`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `animation-performance`, `break-ui`, `mobile-native`…), `impeccable` (desde GitHub, porque `impeccable.style` está bloqueado) y `graphify` (CLI `graphifyy` + skill). Hay que reinstalarlas en el chat nuevo si se quieren (`npx skills add ...`).

## 5. Pendiente (en este orden)

1. **Ciudades principales de los 32 departamentos + Bogotá** (obligatorio, "ojalá más": Cartago, Tuluá, Girardot, Sogamoso, Ocaña, Maicao, Ipiales, Tumaco, Magangué, Apartadó…). Hoy la red tiene unas 51 ciudades (la rama de operaciones trajo 14 capitales). Conectarlas con **carreteras nacionales reales** (Ruta del Sol, Troncal de Occidente, Ruta 45A…), con distancias aproximadas **marcadas como aproximadas** (el modelo ya tiene `approximate`). Capitales sin carretera (Mitú, Inírida, Puerto Carreño, San Andrés…) por aire/río → "Difícil acceso". Regla del usuario: **no inventar vías** para municipios remotos; mejor no incluirlos.
2. **Cierre de aeropuertos, puertos y otros nodos** (hoy solo se cierran corredores/vías). Las rutas deben evitarlos y los envíos afectados redirigirse, igual que con las vías. Ver `backend/app/engine/operations.py` (`set_corridor_status`, `reroute`) y `MultimodalNetwork.build_graph(excluded=...)`, que ya admite excluir nodos.
3. **Todos los municipios de Colombia** (~1.120): bloqueado por la red del entorno. Hay que permitir los dominios `www.datos.gov.co`, `router.project-osrm.org` y `overpass-api.de` (Network access del entorno) para obtener el listado DIVIPOLA con coordenadas y vías reales. Solo se agregan los que tengan vía real conocida; no inventar trazados.
4. **Pasada de diseño** con las skills (`apple-design`, `impeccable`, Emil Kowalski): auditoría, movimiento (algunas indicaciones de Emil pueden chocar con lo pedido: misma curva en todo, tarjetas que crecen al pasar el cursor), celular, casos extremos (`break-ui`), rendimiento del mapa.
5. Cosas que la skill `apple-design` marcó como no hechas: atajos/menús contextuales de escritorio, ventana de ajustes, hojas con agarradera de varios tamaños, validación mientras se escribe, probar con texto grande del sistema y "aumentar contraste", validar daltonismo de la paleta de modos en claro, paleta oscura de deck.gl también en mapa claro, informe de auditoría formal.
6. Ideas propuestas y no hechas: comparador de escenarios lado a lado, estimar compensación de carbono, exportar a PDF desde las gráficas, alertas que recalculen rutas al cerrar una vía.
7. Limpieza: borrar `claude/laughing-albattani-875mtq` y `claude/focused-hypatia-epjpst` en GitHub cuando ya no se usen; decidir disco persistente en Render.
8. Hallazgo de graphify: `backend/app/utils/` (alertas, autenticación, optimización de red, analíticas de flota/inventario) y `backend/app/models/` (flota, aduanas, bodegas) vienen de la interfaz Streamlit antigua y **no los importa `main.py`**. Son candidatos a eliminar o a reconectar; revisarlo antes de borrar.

## 6. Decisiones y preferencias del usuario

- Idioma: español. Quiere que haga los cambios yo (commit, push, PR y fusión cuando lo pide explícitamente).
- Estética: "calcada" de Apple/macOS; pidió blur 30 px, bisel, radios 16/24, curva única de movimiento, hover `scale(1.02) translateY(-2px)`, `:active` `scale(0.96)`.
- Costos: poder verlos en **COP** con **TRM editable**; el sistema calcula en USD.
- Debe funcionar bien en **Windows y Android**.
- Nombre: **Westvane** (elegido por el usuario; "oeste" porque Colombia está al oeste). Búsqueda web sin coincidencias en logística, pero **no equivale a un registro de marca**: debe verificarlo en la SIC.
- Colores: azul/verde/rojo del sistema como acento; el texto sobre claro usa variantes más oscuras para llegar a 4,5:1 (`--accent`, `--accent-solid`).

## 7. Mapa del código

```
backend/app/
  main.py                    API (operaciones + sustainability + categorías)
  engine/multimodal.py       grafo y ruteo (excluye corredores cerrados)
  engine/operations.py       cierres de vías, envíos editables, PDF, TRM, auditoría
  engine/sustainability.py   factores y huella
  engine/dispatch.py         plantillas y envíos de semilla
  data/colombia_multimodal.py  red (nodos y enlaces con trazado)
  data/colombia_ciudades.py  categorías de ciudad
frontend/src/
  app/                       páginas (/, /envios[/nuevo|/[code][/editar]], /red, /vias, /configuracion, /combustible, /huella)
  components/providers.tsx   AppProvider: moneda, TRM (servidor), operador
  lib/prefs.tsx              solo apariencia (Sistema/Claro/Oscuro)
  lib/motion.ts              curva y sombras de elevación
  components/shell/          sidebar, toolbar, command-palette
  components/ui/             sheet, dial/EcoBar, count-up, detail-table, button, badge…
  components/map/            network-explorer, city-*, Map3D (components/Map3D.tsx)
  components/green/          fuel-view, carbon-view
```

## 8. Cómo trabajar y verificar

```bash
# Backend (desde backend/)
pip install -r requirements.txt -r requirements-dev.txt
LOGISUITE_DB_PATH=/tmp/x.db python -m pytest -q            # 139 pruebas
LOGISUITE_DB_PATH=/tmp/x.db uvicorn app.main:app --port 8000

# Frontend (desde frontend/)
npm ci
npm run typecheck     # next typegen && tsc (necesario para los tipos PageProps)
npx eslint src
npm run build         # el prebuild copia el worker de MapLibre a public/vendor (NO usar `next build` directo)
npx next start -p 3111
```

Trampas conocidas:
- `usePathname()` en `Sidebar` exige `<Suspense>` en el layout (rutas dinámicas).
- Las páginas leen `searchParams`/`params` como **Promesas**.
- El mapa deck.gl con WebGL por software (entornos sin GPU) satura el hilo principal: la navegación desde páginas con mapa puede tardar mucho en las pruebas automáticas; no es un error de la app.
- `npx next start` en el mismo puerto: liberar con `fuser -k 3111/tcp`.
- Las reglas de lint de React 19 (`set-state-in-effect`, componentes dentro de render) están activas.
- Verificación E2E usada: Playwright con Chromium (`/opt/pw-browsers/chromium`), escritorio 1360×900 y Pixel 7; 24 comprobaciones pasaron en la última corrida.

## 9. Límites del entorno de la sesión

Salida a internet restringida: `github.com` y PyPI/npm funcionan; `www.datos.gov.co`, `router.project-osrm.org`, `overpass-api.de` e `impeccable.style` están **bloqueados**. Sin Render ni GitHub CLI: PRs vía herramientas MCP de GitHub (no pueden borrar ramas).

---

## 10. Actualización posterior (rediseño con impeccable y las skills de Emil Kowalski)

Rama de trabajo: `claude/exciting-carson-7zscna`. Sin PR abierto.

**Hecho desde el traspaso**
- Pendiente 1: 14 ciudades intermedias sobre carreteras nacionales (aproximadas, marcadas) y las 32 capitales como "principal".
- Pendiente 2: cierre de aeropuertos, puertos y otros nodos (`mm_node_status`, `/api/nodes/status`, pestaña "Aeropuertos y puertos" en `/vias`); los envíos se redirigen igual que con las vías.
- Rediseño: `PRODUCT.md` y `DESIGN.md` en la raíz. Crítica formal (diseño 25/40, detector 0 hallazgos) y sus arreglos: listas de vías y nodos agrupadas y plegables, validación del formulario en español, foco visible, objetivos táctiles de 44 px, bloque "Requiere atención" en el panel, cadena de modos por envío (`RouteChain`), barra superior única en celular, hoja de "Capas" del mapa en celular, atajos de teclado (`?` los muestra), paleta de modos apta para daltonismo (Aéreo magenta, Fluvial azul-cian), `prefers-contrast: more`, desbordes corregidos (360 px y zoom 200 %).
- Backend: 144 pruebas en verde.

**Sigue pendiente**
- Los ~1.120 municipios (bloqueado: permitir `www.datos.gov.co`, `router.project-osrm.org` y `overpass-api.de` en el acceso de red del entorno).
- Magangué y Puerto Berrío: faltan trazados de carretera confirmados.
- Comparador de escenarios, compensación de carbono, exportar gráficas a PDF, alertas que recalculen al cerrar una vía.
- Decidir disco persistente en Render y borrar ramas viejas.
- Revisar `backend/app/utils/` y `backend/app/models/` (herencia de Streamlit, no los importa `main.py`).
- Error 530 visto en Render: casi seguro `API_INTERNAL_URL` mal puesta o API caída; comprobar `https://TU-API/api/health`.
