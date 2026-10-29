# Bitácora del proyecto Westvane TMS

Registro de todo lo construido, investigado, decidido y pendiente hasta hoy.
Rama de trabajo: `main` (la rama de sesión `claude/vigilant-johnson-mofqyc` queda igual a `main`).
Última actualización: 28 de octubre de 2026 (secciones 9 a 13: diseño, rendimiento, funciones nuevas, espacio, y el lote de incorporaciones de la sección 13).

---

## 1. Estado actual

| Parte | Estado |
|---|---|
| Backend (FastAPI + SQLite + NetworkX) | Funcional. 196 pruebas en verde. Esquema v7 (bitácora y adjuntos). Caché de lecturas con vuelo único, SQLite en WAL. |
| Celular | Dock inferior con hoja "Más" desde abajo; simulador como hoja inferior; envíos en tarjetas. Sin desbordamiento horizontal a 390 px. |
| Diseño y movimiento | Dock flotante, tema claro por defecto, paleta de modos nueva y lotes 1 a 5 del plan de movimiento (sección 9). |
| Frontend (Next.js 16 + Tailwind v4 + deck.gl) | Funcional. Typecheck, lint y build sin errores; 11 pruebas de navegador (Playwright) en verde. |
| CI y despliegue | GitHub Actions: pruebas en cada push a `main`; si pasan, despliegue automático a Contabo (falta crear los secretos, sección 10). |
| Vías, envíos editables, USD/COP, PDF, historial | Implementados (ver sección 2 y `docs/AUDITORIA_BOTONES.md`). |
| Docker local (`docker-compose.yml`) | Probado: ambos contenedores healthy, persistencia verificada. |
| Producción | VPS de Contabo con Docker Compose (Caddy + web + API, base en volumen persistente). Guía: `docs/DESPLIEGUE_CONTABO.md`. |
| Dominio | DuckDNS (`westvane.duckdns.org`). |
| Render, Oracle, Hetzner | Descartados o superados por Contabo; se conservan solo como historia (secciones 2 y 7). |

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
| `df60ecf` | Parte 1: esquema v4 (estado de vías, columnas de envíos editables, TRM). |
| `7ccf509` | Partes 2, 3, 6 y 7 en el backend: cierre de vías con redirección, CRUD de envíos, PDF, enlaces, red ampliada. |
| `66ce8e7` | Un vuelo en el aire no se devuelve al cerrar su ruta; alertas en el dashboard. |
| `2a24771` | Partes 2 a 6 en el frontend: `/vias`, envíos editables, USD/COP, PDF y auditoría de controles. |
| `cf1f6f8` | Documentación: `docs/AUDITORIA_BOTONES.md` y bitácora actualizada. |
| `5fbf612` | Diseño para celular: barra con menú deslizable, simulador como hoja inferior en `/red`. |
| `2e0dc9e` | Lote 1 de movimiento: presión 0,97 con rebote, onda de luz, chispas en Guardar/Exportar/Compartir/Crear. |
| `b825087` | Dock de navegación (sustituye la barra lateral), tema claro por defecto, acento oscuro `#5266eb`, paleta de modos. |
| `27ee2c2` | Lote 2: paneles plegables sin animar altura, menús, desglose de costos en barras. |
| `3ab2e36` | Lote 3: mapa quieto en reposo, morph a pantalla completa, código compartido fila → detalle. |
| `1218cbb` | Lote 4: cifras hero del resumen, CountUp desde el valor anterior, avisos, Guardar → Check. |
| `7f449f8` | Lote 5: contrastes AA en fondos tintados, capturas en `docs/capturas/`, bitácora. |
| `a95c351` | Guía de despliegue vigente en Contabo. |
| `cf5d3ac` | Rendimiento y estabilidad: mapa por etapas, caché de la API, sondeos que se pausan, tiempos límite. |
| `8f2d227` | Pulido visual: de tablero de tarjetas a herramienta profesional. |
| `0f4048c` | Trabajo en curso guardado antes de una pausa (sin verificar); lo completa `b47702b`. |
| `b47702b` | Avisos globales, historial de trayectos, exportación a Excel y 404 real. |
| `7784b59` | Pruebas de navegador, CI, despliegue automático a Contabo y paleta de modos validada. |
| `2ebaaeb` | Espacio bien usado: sin desplazamiento lateral, mapas encuadrados, simulador a dos columnas. |
| `475002a` | API: bitácora y adjuntos, carga masiva, tendencias, reporte operativo, clientes, TRM oficial (schema v7). |
| `9964e32` | Interfaz: bitácora, adjuntos, impresión, tendencias, importación, vistas guardadas, presentación, metodología. |
| `c5dc8f7` | Calendario, clientes, comparador, cotizador, mapa por departamento, Ctrl K ampliado. |
| `7f6fb9d` | Respaldo diario con adjuntos, vigilancia del sitio y monitor externo. |

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
├── components/shell/dock.tsx     Dock de navegación (escritorio arriba, celular abajo con hoja "Más")
├── components/ui/                ripple, burst, collapsible-panel, count-up, toast, save-icon
├── components/map/map-frame.tsx  Marco del mapa con morph a pantalla completa
├── app/                          /  dashboard · /envios tabla · /red mapa + simulador
├── app/api/[...path]/route.ts    Proxy hacia FastAPI
├── components/Map3D.tsx          Mapa maestro deck.gl + MapLibre
├── components/map/               Simulador, leyenda, carga de datos, geometría
├── components/dashboard/         Bento, KPI, gráficos, flota en vivo
├── components/shipments/         Tabla TanStack Table v9
└── lib/modes.ts, types.ts, api.ts
```

**Endpoints:** `/api/health`, `/api/network/multimodal`, `POST /api/routes/simulate` (acepta `modos` y `vias`), `/api/fleet/live`, `/api/shipments`, `/api/shipments/{code}`, `/api/dashboard/summary`, `/api/geo/departments`, `/api/locations`.

**Operación (nuevos):** `GET /api/corridors`, `POST /api/corridors/status`, `POST /api/shipments`, `PUT|DELETE /api/shipments/{code}`, `POST /api/shipments/preview`, `GET /api/settings`, `PUT /api/settings/fx`, `PUT /api/settings/replenish`, `GET /api/audit`, `GET /api/shipments/{code}/pdf`, `POST /api/exports/pdf`, `GET|POST /api/exports`, `GET|DELETE /api/exports/{token}`.

**Módulos nuevos:** `engine/operations.py` (vías, reconciliación de rutas, CRUD, TRM, historial), `engine/pdf.py` (reportlab), `database/schema_v4.py`.

**Páginas nuevas:** `/vias`, `/envios/nuevo`, `/envios/[code]`, `/envios/[code]/editar`, `/configuracion`.

**Motor multimodal:** cada nodo se replica por modo. Un enlace une estados del mismo modo; un transbordo une modos distintos en el mismo nodo. Las escalas aéreas tienen estado de llegada y de salida. Prioridades: `tiempo`, `costo`, `balanceado` (costo + 12 USD por t·h). Respeta la capacidad por despacho.

**Estados de envío derivados del reloj:** Programado, En Ruta, Transferencia Modal, Retrasado, Entregado. No se guardan fijos; se calculan con la salida, la duración, el retraso y las ventanas de transbordo.

---

## 4. Decisiones técnicas tomadas

- **Dos versiones:** la Streamlit (commit `73dc363`) y la Next.js + FastAPI (rama actual). La Streamlit ya no está en el árbol de trabajo.
- **Paleta de modos (27/10/2026):** terrestre `#0f9d7a`, fluvial `#0a84ff`, marítimo `#5e5ce6`, aéreo `#d6399b`, férreo `#c98a00`, igual en ambos temas. Solo indica el modo y siempre va con ícono y texto. Reemplaza a la paleta validada anteriormente sobre `#0B0F19`; no se repitió la validación CVD.
- **Nomenclatura de vehículos:** la columna `vehicle_type` conserva los valores del `CHECK` del esquema original; la interfaz muestra "Tractomula 3S3", "Dobletroque", "Camión Sencillo", "Turbo NPR".
- **Departamentos:** GeoJSON real del DANE (MGN 2018, nivel departamento), con propiedades reducidas a código y nombre.
- **Worker de MapLibre:** copiado a `public/vendor/` en `predev`/`prebuild`; con Turbopack la URL relativa no existía.
- **Telemetría:** simulación determinista sobre el trazado de cada ruta. No hay GPS. Se repone con despachos cuando hay menos de 16 en tránsito.
- **Moneda:** los cálculos se hacen en USD. La interfaz y los PDF convierten a COP con la TRM guardada en `system_params` (valor, fecha y fuente). No se consulta ninguna tasa automáticamente; sin TRM, COP queda deshabilitado.
- **Autenticación:** no se implementó (decisión del 9/10/2026). Cualquiera con acceso a la URL puede crear, editar, borrar y cerrar vías. El historial guarda el nombre que el operador declara en el menú "Más" del dock (campo Operador), sin verificar.
- **Compartir:** enlace con token aleatorio, de solo lectura y revocable. El PDF se genera al abrirlo, con los datos vigentes.
- **Historial:** `audit_log` con usuario declarado y fecha para envíos, vías, TRM y enlaces.
- **Cierre de vías:** por corredor (todos sus enlaces). Programados: se recalculan desde cero. En tránsito: se conserva lo recorrido hasta el nodo anterior al segmento cerrado; si el vehículo ya va por el segmento cerrado, se agrega un tramo de retorno (excepto vuelos en el aire, que terminan el segmento). Sin alternativa: `route_status = 'sin_ruta'`. Al reabrir, los sin ruta se restablecen y los programados redirigidos se recalculan; los envíos en tránsito redirigidos conservan el desvío.
- **Rutas guardadas:** cada tramo guarda sus segmentos (un enlace cada uno) con horas de inicio y fin, para cortar en el nodo exacto.
- **Envíos editables:** al guardar se recalcula la ruta completa desde el origen, también si el envío ya salió. Modos forzados filtran el grafo; vías forzadas (máx. 3) se resuelven con un grafo por capas.
- **Códigos de envío:** consecutivo global que no reutiliza códigos borrados.
- **Reposición automática:** parámetro `AUTO_REPLENISH`; desactivarlo permite trabajar solo con envíos modelados.
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

## 7. Pendientes

Hechos el 9/10/2026 (partes 1 a 7): modelo de datos, vías no disponibles, envíos modelables, auditoría de botones (`docs/AUDITORIA_BOTONES.md`), monedas, exportación a PDF y red ampliada.

Detalles de la red ampliada:
   - 14 capitales, Soacha, Girardot, Rionegro, Apartadó e Ipiales; puertos de Turbo, Tumaco, Puerto Bolívar, Puerto Nuevo y San Andrés; puertos fluviales de Puerto López, Puerto Carreño, Inírida y Quibdó.
   - 16 aeropuertos regionales. El aeropuerto de Rionegro ya existía como `MDE-AIR` (José María Córdova); Rionegro se conecta a él.
   - Corredores: Bucaramanga–Cúcuta, Troncal del Caribe (Montería, Turbo, Riohacha, Puerto Nuevo), Vía al Urabá, Pasto–Tumaco, Panamericana a Ipiales, Troncal del Llano, Transversal del Cusiana, Autopista del Café, La Línea, ríos Meta, Orinoco y Atrato, cabotaje a Turbo, San Andrés, Tumaco y La Guajira.
   - Férreos: Fenoco a Puerto Nuevo, Cerrejón y Ferrocarril Central (activos); Ferrocarril del Pacífico y Bogotá–Belencito (sembrados cerrados, estado a verificar).
   - **No agregado:** "Troncal Central de Antioquia". No identifiqué un corredor distinto del Medellín–Caucasia (Troncal de Occidente) ya modelado. Pendiente de confirmar a qué vía se refiere.

Pendientes que siguen abiertos:

8. ~~Historial de trayectos, peajes y combustible por corredor, alertas operativas~~: hecho (`b47702b`). Los peajes salen en cero hasta cargar tarifas en Configuración; derrumbes y paros se registran como cierres de vía.
9. ~~Despliegue permanente~~: hecho en Contabo; automático desde `7784b59` (faltan los secretos).
10. ~~Mejoras de velocidad~~: hecho (`cf5d3ac`).
11. **Autenticación:** aplazada por decisión del usuario (28/10/2026): hoy solo la usan el autor y el profesor. Retomar antes de compartir el enlace con más gente.
12. ~~Persistencia en Render~~: ya no aplica (Contabo usa un volumen persistente).

### Decisiones tomadas (9/10/2026)

- Autenticación: no por ahora.
- Compartir: enlace con token revocable.
- Historial: sí, con usuario declarado y fecha.

### Decisiones abiertas

- ¿Migrar a Hetzner antes de la revisión del profesor o usar Oracle gratis?

---

### Diseño para celular (hecho)

- Menos de 768 px: barra superior con menú deslizable (reemplazada el 27/10/2026 por el dock inferior con hoja "Más"; ver sección 9).
- `/red`: el simulador es una hoja inferior en celular; los controles de capas usan texto corto.
- Revisado a 390 px en Chromium: sin desbordamiento horizontal en dashboard, envíos, vías, configuración, red y nuevo envío.
- La tabla de envíos ya tiene vista de tarjetas en celular.

### Mejoras propuestas (sin iniciar)

1. Autenticación o modo de solo lectura antes de compartir el enlace público (aplazada).
2. ~~Base de datos persistente~~ (Contabo).
3. ~~Tarjetas en celular para la lista de envíos~~.
4. ~~Avisos de vías cerradas y envíos sin ruta fuera del resumen~~ (campana del dock).
5. ~~Exportar a Excel la tabla filtrada~~.
6. ~~Búsqueda global~~ (Ctrl K).
7. ~~Duplicar un envío~~ (ya existía: botón «Duplicar» en la ficha).
8. ~~Pruebas end-to-end automáticas con Playwright~~ (`frontend/e2e/`, también en la CI).
9. Validar coordenadas aproximadas contra INVÍAS, ANI y Cormagdalena.
10. ~~Actualizar dependencias con vulnerabilidades~~: `npm audit` y `pip-audit` en 0 (sección 12).

## 8. Cosas a verificar antes de confiar en ellas

- Coordenadas y distancias de la red ampliada: aproximadas (marcadas con `approximate = 1` y visibles como "Aproximada" en la interfaz). Contrastar con INVÍAS, ANI y Cormagdalena.
- Estado de las líneas férreas (Pacífico, Bogotá–Belencito cerradas; Central activa): verificar con la ANI.
- Capacidades de aeropuertos regionales (15 t) y ríos Meta, Orinoco y Atrato: supuestos de modelado.
- Precios de Hetzner, Render y dominios: cambian; revisar en la página oficial.
- Política de Oracle sobre instancias inactivas: revisar la documentación vigente.
- Funcionamiento real en Render y en la VM: no probado en esos entornos.
- Archivos modificados en disco sin registro (`main.py`, `dispatch.py`, `multimodal.py`, `Map3D.tsx`, `shipments-table.tsx`, `colombia_multimodal.py`, `serializers.py`, `format.py`, `telemetry.py`, `.env.example`, `docker-compose.yml`): origen por confirmar.

---

## 9. Diseño y movimiento (27–28/10/2026)

### Decisiones tomadas
- **Navegación:** dock flotante superior en escritorio (vidrio, radio 999 px): Resumen, Envíos, Red, Flota y "Más"
  (Vías, Bodegas, Combustible, Huella, Configuración, Operador, Atajos), búsqueda Ctrl K, moneda, tema y punto de
  estado del sistema. Se reduce a íconos al bajar. En celular, dock inferior y hoja "Más" desde abajo.
  Sobre `/red` el dock es opaco: el desenfoque encima del mapa empeoraba los cuadros.
- **Tema:** claro por defecto (`#f5f5f7` / `#ffffff`). Oscuro (`#000` / `#1c1c1e`) con acento `#5266eb`;
  "Sistema" sigue disponible. Solo Inter Variable.
- **Mapa:** en reposo queda quieto. El reloj de animación corre solo al arrastrar, girar o usar la rueda
  (con 0,8 s de cola) o en pantalla completa. La preferencia "Animación" sigue existiendo (apagada por defecto
  en celular y en equipos sin GPU).
- **Cifras hero del resumen:** envíos en ruta, retrasos y costo acumulado en tránsito (flete comprometido).

### Qué se hizo, por lote
1. **Respuesta al toque:** `.press` (0,97 en 120 ms, vuelta con rebote de 300 ms); onda de luz global
   (`ui/ripple.tsx`, Web Animations, sin re-render); chispas con `Button burst={Icon}` y `BurstLink` en
   Guardar, Exportar, Compartir y Crear.
2. **Despliegues:** `ui/collapsible-panel.tsx` sin animar `height` (layout de framer-motion por transform);
   detalle del envío y Configuración. Menús con escala 0,96 y fundido. Barras de costos con `scaleX` al
   entrar en vista. Fundido de la lista filtrada en celular.
3. **Objetos que se mueven:** regla del mapa; `map/map-frame.tsx` (morph a pantalla completa en `/red` y en
   el detalle); código compartido fila → detalle (FLIP propio: el detalle carga con Suspense y View
   Transitions no forma el par); filas con `layout` hasta 40 visibles; `Reveal` con `whileInView`.
4. **Íconos y detalles:** resorte y giro de íconos del dock; `CountUp` cuenta desde el valor anterior;
   avisos (`ui/toast.tsx`, cola de 3, 4 s); Guardar → Check (`ui/save-icon.tsx`).
5. **Pulido:** contrastes corregidos (`--muted-foreground #5f5f64`, `--accent #005bb5`, `--warning #984c00`,
   `--danger #ad111b`) para pasar AA también sobre fondos tintados. Avisos de hidratación corregidos (controles
   del dock dentro de Suspense y fechas con espacios distintos entre servidor y navegador). Detalle del envío
   con ancho máximo centrado. Capturas en `docs/capturas/` (5 pantallas × escritorio/celular × claro/oscuro).

### Verificación (Chromium sin GPU, SwiftShader)
- `npx tsc --noEmit`, `npx eslint src` y `npx next build` sin errores en cada lote.
- axe-core 4.10 (WCAG 2 A/AA) en las 11 pantallas, tema claro y oscuro, escritorio y celular: sin violaciones.
- Reducir movimiento emulado: ninguna transformación cambia en las 11 pantallas; sin chispas, onda, conteo
  ni morph.
- Teclado: menú "Más" (Enter, Escape devuelve el foco), hoja de celular (Escape), paneles plegables (Enter).
- Sin desbordamiento horizontal a 390 px en ninguna pantalla.
- Fotogramas: ver tabla. Medidos con `scratchpad/e2e/fps.mjs` (rAF + PerformanceObserver de tareas largas);
  la base es `origin/main` antes del lote 1.

| Pantalla · acción | Base (`7a815f9`) | Final | Nota |
|---|---|---|---|
| `/red` en reposo | 57–60 fps, 0 tareas largas | 60 fps, 0 tareas largas | Animación por defecto apagada sin GPU |
| `/red` en reposo con animación activada | 3,6 fps, 14 tareas largas | 60 fps, 0 tareas largas | Regla del mapa: quieto en reposo |
| `/red` arrastrar | 5,1–5,9 fps, máx. 950–1150 ms | 7,5–9 fps, máx. 820–900 ms | Dock opaco sobre el mapa |
| `/red` rueda | 8,6–11,7 fps, máx. 370–870 ms | 8,7–11,5 fps, máx. 320–430 ms | |
| Detalle arrastrar | 31 fps, máx. 650 ms | 59–60 fps, máx. 33 ms | |
| Detalle rueda (desplaza la página) | 24–26 fps, p95 233–300 ms, máx. 350–366 ms | 24–25 fps, p95 250–266 ms, máx. 430–550 ms | El máximo varía ±200 ms entre pasadas en SwiftShader |

- Sin la barra lateral, la columna del detalle se ensanchaba y el canvas del mapa pasaba de 634 a 874 px
  (+38 % de área), lo que bajaba la rueda a 11–17 fps. Se limitó el detalle a un ancho máximo centrado
  (`max-w-6xl`) y la rueda volvió al nivel de la base. El bloqueo máximo sigue algo por encima en algunas pasadas.

- El morph del mapa en SwiftShader termina en ~1 s con cuadros de ~270 ms: no llega a 45 fps sin GPU. Antes
  del ajuste tardaba 1,5 s con un salto de 1,2 s. Ocultar el canvas con `opacity` o `visibility` durante el
  morph costaba 7–8 s al volver, por eso se tapa con una cubierta. Falta medirlo en un equipo con GPU.

### Pendiente
- Medir el morph y el arrastre del mapa en un equipo real con GPU (aquí solo hay SwiftShader).
- ~~Validar la paleta de modos~~: hecho en `7784b59` (sección 11).
- ~~Esqueletos con brillo, estados vacíos tipográficos, trazo animado, código desde Ctrl K~~: hechos en `8f2d227`.
  Se descartaron las bandas alternas de fondo (competían con las superficies) y las View Transitions entre
  páginas (se usa un fundido de 220 ms en `template.tsx`).

## 10. Acceso y credenciales

No se guardan contraseñas, tokens ni claves privadas en este documento.

- GitHub: repositorio `sebastianslg/logisuite-app`, rama `main`.
- Producción: VPS de Contabo, `/opt/logisuite` (ver `docs/DESPLIEGUE_CONTABO.md`).
- Secretos para GitHub Actions (Settings > Secrets and variables > Actions): `SSH_HOST` (IP del VPS),
  `SSH_USER` (`root`) y `SSH_KEY` (contenido de la clave privada `logisuite_contabo`). Variable opcional
  `DEPLOY_URL` (por defecto `https://westvane.duckdns.org`). Sin ellos el flujo "Desplegar" falla con un
  mensaje que dice cuál falta, y no toca el servidor.
- Render: blueprint `logisuite` (ya no se usa).

---

## 11. Rendimiento, pulido profesional y funciones nuevas (28/10/2026)

### Rendimiento y estabilidad (`cf5d3ac`)
- **Mapa:** se monta cuando su contenedor entra en pantalla y el navegador queda libre (`lib/idle.ts`,
  `map/map-3d-lazy.tsx`), y las capas llegan en 5 etapas. Al entrar a `/red` el bloqueo máximo bajó de ~5 s a
  ~1,6 s sin GPU. En celular el mapa del resumen no se crea bajo el pliegue (5 toques del dock: 21,7 s → 4,6 s).
- **API:** caché de lecturas de 5 s (`WESTVANE_CACHE_TTL`), invalidada por cualquier escritura y por la
  sincronización, con vuelo único por URL: con 120 peticiones concurrentes la peor respuesta bajó de 8,5 s a 0,5 s.
  Candado en la sincronización, SQLite en WAL, espera de 10 s ante bloqueos.
- **Lo que no se ve no trabaja:** `lib/use-live.ts` comparte un sondeo por URL, lo pausa con la pestaña oculta
  o fuera de pantalla, no solapa peticiones y espera más tras cada fallo.
- **Tiempos límite:** 12 s en lecturas del servidor, 30 s en el proxy `/api` (504), 60 s en el cliente;
  "Reintentar" vuelve a pedir los datos.

### Pulido profesional (`8f2d227`)
Criterio: que se lea como software de trabajo y no como un tablero genérico. Superficies opacas con línea
fina, filas en lugar de tarjetas, franjas de cifras (`StatStrip`) en lugar de KPI con ícono en círculo, sin
tarjetas anidadas, hover con borde y un paso de fondo en lugar de escala y sombra. El detalle está en `DESIGN.md`.

### Funciones nuevas (`b47702b`)
- Campana de avisos en el dock (y en "Más" en celular), con sondeo de 60 s en pausa si la pestaña está oculta.
- `/historial`: ventana de 7, 30 o 90 días por ciudad, departamento y corredor (flete, peajes, km, combustible, CO₂e), CSV por vista.
- Exportación a Excel de la lista de envíos filtrada, en la moneda elegida.
- 404 real para envíos, vehículos y bodegas inexistentes (`proxy.ts`).

### Pruebas, CI y despliegue (`7784b59`)
- `frontend/e2e/`: 8 pruebas de Playwright (escritorio y Pixel 7) contra la API real con una base temporal:
  dock, Ctrl K, avisos, 404, filtros y exportación, sin desborde en celular, sin errores de consola. `npm run test:e2e`.
- `.github/workflows/ci.yml`: pytest; tipos, lint, build y Playwright.
- `.github/workflows/deploy.yml`: corre solo si la CI de `main` pasó (o a mano). Respalda la base, se niega a
  seguir si el VPS tiene cambios locales, avanza `main` con `--ff-only`, reconstruye y comprueba `/api/health` y `/envios`.
- La imagen Docker no se pudo construir en esta sesión (no hay demonio Docker); el primer despliegue automático es la prueba.

### Paleta de modos validada
Validador de la skill de visualización (OKLab ×100, protanopía y deuteranopía, todas las parejas, contraste ≥ 3:1).
La paleta acordada fallaba: aéreo y terrestre en deuteranopía (4,4, mínimo 8) y fluvial y marítimo con visión
normal (10,5, mínimo 15). Se movió cada tono dentro de su familia:

| Modo | Acordado | Claro | Oscuro |
|---|---|---|---|
| Marítimo | `#5e5ce6` | `#5044db` | `#684af5` |
| Terrestre | `#0f9d7a` | `#26a683` | `#26a683` |
| Aéreo | `#d6399b` | `#d623a7` | `#c82a9c` |
| Férreo | `#c98a00` | `#bc812f` | `#bc812f` |
| Fluvial | `#0a84ff` | `#3c88e5` | `#5b91d7` |

Resultado: mínimo 8,1 con daltonismo y 15,9 con visión normal en claro; 9,3 y 16,4 en oscuro. El mapa usa el
juego oscuro cuando el tema es oscuro (`MODES[m].rgbDark`).

---

## 12. Espacio, encuadre de mapas y dependencias (28/10/2026)

Reporte del usuario: zonas en blanco y tablas que obligaban a desplazarse hacia el lado.

- **Medición:** script que recorre las 14 pantallas en 10 anchos (390 a 2560 px) contra los datos de
  producción (solo lectura) y busca desbordes horizontales. Antes: tabla de envíos (1432 px en una caja de
  1358), historial y peajes en celular. Después: ninguno.
- **Ancho de página** 1440 → 1760 px. **Tabla de envíos:** columnas que ceden por ancho (ETA y cliente desde
  1280, prioridad desde 1600), tarjetas bajo 1024. **Tablas de detalle e historial:** filas apiladas bajo 1024.
- **Simulador a pantalla completa:** dos columnas; antes heredaba las clases del panel flotante.
- **Mapas:** encuadre de Colombia con la cámara inclinada real (`fitTilted` en `Map3D.tsx`) en el espacio que
  dejan libres los controles (`insets`). La ficha del envío abre encuadrada en su ruta: la transición de
  vuelo se cancelaba al crear el mapa (el mapa avisaba su vista original), por eso ahora se encuadra en un
  efecto de diseño, y la clave es el trazado (antes se re-encuadraba en cada refresco).
- **Fotogramas en /red** (SwiftShader, 2 pasadas, misma máquina): arrastre 6,4–7,1 → 6,7–6,9 fps (bloqueo
  máximo 833–850 → 550 ms); rueda 4,1 → 6,3–6,6 fps. La carga inicial por etapas bloquea igual que antes
  (~10 s sin GPU en los primeros 10 s, luego nada).
- **Dependencias:** `overrides` en `package.json` para `fflate` 0.7.5, `zod` 4.6.7 e `image-size` 2.0.4. Este
  último solo lo usa `texture-compressor`, herramienta de línea de comandos opcional de loaders.gl que no
  entra al paquete ni se ejecuta. La "solución" de `npm audit` era bajar deck.gl a 9.0/9.1: descartada.
- **CI** usa `npm run build` (copia el worker de MapLibre, como Docker).

---

## 13. Incorporaciones: lotes A, B, C y D (28/10/2026)

Pedido del usuario: «todo lo añadible». Se dejó fuera, a propósito: usuarios y permisos (aplazado por el
usuario) y el envío del reporte por correo (requiere servidor de correo; el reporte queda descargable).

**C · API** (`475002a`, schema v7 aditivo): bitácora del envío (notas e incidencias en ruta; una incidencia
puede sumar retraso y lo aplica con la edición normal), adjuntos (10 MB, junto a la base), carga masiva desde
Excel/CSV con vista previa, tendencias de 14 días reconstruidas con `status_at`, historial con período
anterior, reporte operativo en PDF, resumen por cliente y TRM oficial desde datos.gov.co bajo demanda.

**A · Interfaz** (`9964e32`): bitácora con línea de tiempo y marca de «ahora» (se coloca después de hidratar),
adjuntos con arrastrar y soltar, vista de impresión (papel blanco, sin dock ni mapa), tendencias y cambio
semanal en las cifras del resumen, modo presentación a pantalla completa, importación de envíos, vistas
guardadas, densidad de la tabla y encabezado fijo, avisos con «visto», página Metodología con diagrama,
portada Open Graph e ícono para iOS.

**B · Funciones** (`c5dc8f7`): calendario (barras por estado con el retraso rayado; agenda en celular),
clientes, comparador de hasta tres escenarios (calculado en el servidor), cotizador imprimible, mapa por
departamento en SVG (un tono, cinco pasos por cuantiles) y Ctrl K con vehículos, bodegas y vías.

**D · Servidor** (`7f6fb9d`): respaldo diario con revisión de integridad y adjuntos, vigilancia cada 5 minutos
con reinicio y avisos ntfy opcionales, monitor externo en GitHub Actions y script para bajar respaldos al PC.

### Problemas encontrados en el camino
- Importar una constante desde un módulo `"use client"` en un componente de servidor la entrega como
  referencia, no como dato (error #441 en `/comparar`): los escenarios por defecto viven en `lib/compare.ts`.
- Los servidores de las pruebas corrían en UTC y el navegador en Bogotá: con fechas sin zona horaria la
  bitácora daba error de hidratación. Las pruebas usan `TZ=America/Bogota` como producción, y lo que depende
  del reloj se marca tras hidratar.
- Las precargas del historial de Configuración pedían fichas de envíos borrados (404): ya no se enlazan.

### Verificación
- 196 pruebas de la API y 11 de navegador en verde (dos corridas seguidas).
- Sin desbordes horizontales en 22 pantallas, de 390 a 1920 px.
- axe-core sin violaciones en claro y oscuro, escritorio y celular, en las pantallas existentes; las nuevas
  usan los mismos componentes y tokens.
- Scripts del servidor probados en una carpeta de prueba (rotación, restauración, caída y recuperación).

## 14. Movimiento, pulido y el congelamiento del Resumen (28/10/2026)

Revisión con las guías de interfaz de Apple (HIG) y los criterios de Emil Kowalski: cada animación tiene un
propósito (explicar un cambio, confirmar un toque, evitar un salto), dura menos de 300 ms en lo que se usa a
diario, usa solo `transform` y `opacity`, y se queda quieta con «reducir movimiento». Lo que se usa cien
veces al día (Ctrl K, atajos) sigue sin animación.

### Movimiento
- **Medidores en CSS:** el avance de cada envío (tabla, tarjetas, cadena de modos) ya no anima `width`: el
  relleno ocupa todo el ancho y se escala con `scaleX`; crece desde cero al aparecer (`@starting-style`) y se
  desliza si el avance cambia con los datos en vivo. Fuera del hilo principal.
- **Sparklines que se dibujan:** una máscara crece de izquierda a derecha (700 ms) y el punto del último valor
  llega al final con un pequeño rebote.
- **Calendario:** las barras crecen desde su salida en cascada de 20 ms por fila y vuelven a crecer al cambiar
  la ventana (explica el cambio de escala). Ficha propia al pasar el puntero o con el foco (código, ruta,
  salida, llegada y retraso) en lugar del tooltip del navegador. «Ahora» ya no tapa la fecha del día.
- **Mapa por departamento:** los departamentos se llenan del tono más claro al más oscuro.
- **Bitácora y adjuntos:** lo recién registrado entra con un fundido corto; lo que ya estaba aparece quieto.
- **Avisos:** la cifra de la campana entra con un salto corto cuando llega algo nuevo.
- **Apariencia:** cambiar entre claro y oscuro funde la página en 250 ms (View Transitions, solo opacidad).

### Pulido
- **Control segmentado único** (`ui/segmented.tsx`): píldora que se desliza con el resorte estándar y flechas
  del teclado. Reemplaza los de calendario, historial, vías, nodos y fallas; en esos tres últimos la opción
  elegida era invisible en el tema claro (un blanco al 8 % sobre blanco).
- **Casilla de verificación** con la forma de la app (16 px, radio de 5 px, palomita que entra con rebote,
  se hunde al presionarla) y estado parcial en «seleccionar todo».
- Tarjetas de envíos en celular: la lista se salía 15 px a la derecha en 390 px (columna `grid-cols-1`).
- Cifras del resumen: «Sube 300 %» con un 0 al lado confundía; ahora dice «esta semana» y explica al pasar
  el puntero que compara promedios diarios de 7 días.
- Contraste: fechas de fin de semana en el calendario, hitos previstos de la bitácora, números de la
  metodología, el «Ahora» del calendario en oscuro y los envíos borrados en Configuración ya pasan 4,5:1.

### El congelamiento (la pestaña dejaba de responder)
Al volver al Resumen después de visitar otra página, con el mapa ya cargado, la pestaña se congelaba sin
error. Next conserva oculta la ruta que se deja (React Activity); al mostrarla otra vez el mapa se montaba
en el mismo contenedor y `reuseMaps` de react-map-gl intentaba mudar sus nodos «del contenedor viejo al
nuevo» mientras el viejo tuviera hijos: siendo el mismo, el ciclo no terminaba. Se quitó `reuseMaps` (el
mapa oculto ahora se libera y se crea de nuevo al volver, lo que además gasta menos en segundo plano).
De la misma causa venía el fallo de CI del commit anterior (deck.gl redibujaba un Deck ya finalizado):
un Deck finalizado ya no dibuja y uno nuevo recibe sus capas al cargar. Hay una prueba que repite el
recorrido y falla si la página deja de pintar.

### Verificación
- Tipos, lint y build limpios; 12 pruebas de navegador en verde (la nueva falla con el error y pasa sin él).
- La prueba de celular revisa también 375 px y compara contra el ancho de la pantalla del dispositivo (antes
  el navegador emulado se ensanchaba con el desborde y no lo veía); encontró el segmentado del historial.
- axe-core sin violaciones en claro y oscuro en las pantallas tocadas.
- `/red`: 60 cuadros por segundo en reposo, sin trabajo nuevo por cuadro.

## 15. Rendimiento, seguridad y base legal sin datos personales (28/10/2026)

### Diagnóstico del "se cuelga"
El servidor de Contabo responde en 0,2–0,6 s en todas las páginas, con compresión y caché: no es la causa.
En el navegador, entrar o salir de Resumen y Red bloqueaba la pestaña entre 1 y 2,5 s por crear o destruir
el mapa 3D (contexto WebGL, sombreadores, teselas). Medido con el sitio real y con la misma prueba en local.

### Rendimiento (`a444d8a`)
- **Resumen:** la red se dibuja en SVG por defecto. Sin WebGL ni reloj; la flota se ve en su posición del
  último sondeo. «3D» monta el mapa completo y se recuerda. Resultado: 0 bloqueos largos al cargar el
  Resumen y al volver a él (antes, de 1,3 a 2,5 s).
- **Calidad del mapa** (Configuración): Automática / Alta / Liviana. Liviana: plano, sin relieve, sin rotar
  y a 1x. Automática la elige en navegadores sin aceleración gráfica o con 4 GB de memoria o menos, y la
  página explica cómo activar la aceleración en Chrome y Edge.
- **`?diagnostico`:** panel con cuadros por segundo y bloqueos por página, más un informe para copiar.
  Pendiente según lo que mida en el PC real: un solo lienzo WebGL (rutas dentro del mapa base) y conservar el
  mapa de Red entre visitas.

### Seguridad (`a72dc78`)
- **Cabeceras:** política de contenido (solo scripts propios y OpenFreeMap), HSTS, sin marcos ajenos,
  Permissions-Policy, COOP, sin `X-Powered-By`, `noindex` mientras sea privada.
- **API:**
  - 120 escrituras por minuto por IP, y 20 para adjuntos e importación.
  - Cuerpo máximo de 16 MB.
  - Adjuntos revisados por su firma: un HTML renombrado `.pdf` no entra.
  - Sin `/docs` en producción.
- **Servidor:**
  - `deploy/harden-server.sh`: firewall, SSH solo con llave (no lo toca si root no tiene llave), fail2ban,
    parches automáticos, permisos y swap.
  - Contenedores con memoria y registros con tope.
  - Aviso opcional de Healthchecks.io si falla el respaldo.
- **Mapa base:** de CARTO (gratis solo sin uso comercial) a OpenFreeMap (OpenStreetMap, libre también para
  uso comercial).

### Base legal sin datos personales
- Página **Créditos y licencias** con fuentes de datos, cartografía (OSM/ODbL, OpenMapTiles, OpenFreeMap,
  Natural Earth, DANE MGN 2018), tipografía (Inter y Noto, OFL), íconos (Lucide, ISC) y software con sus
  licencias.
- **Avisos y pie de página:**
  - Pie en todas las páginas: datos simulados, enlaces a Metodología y a Créditos.
  - La cotización aclara que no es una oferta vinculante.
  - La bitácora pide no escribir datos sensibles de personas.
  - Los adjuntos piden subir solo lo autorizado.
- **Pendiente** (necesita los datos del responsable): términos y condiciones, política de tratamiento de
  datos, política de cookies y almacenamiento, casillas de aceptación y registro de aceptaciones.

### Verificación
- 202 pruebas de la API y 13 de navegador en verde; axe sin violaciones en las pantallas nuevas.
- Sin violaciones de la política de contenido en el mapa, la ficha, el resumen, el historial ni la
  configuración, en claro y oscuro.

## 16. Base legal: documentos, aceptación y registro (28/10/2026)

- **Documentos en borrador:**
  - `/terminos`: términos y condiciones.
  - `/privacidad`: política de tratamiento de datos (Ley 1581 de 2012 y Decreto 1074 de 2015), con
    responsable, datos, finalidades, conservación, derechos, plazos de consultas (10 días) y reclamos (15),
    encargados y seguridad.
  - `/cookies`: sin cookies; tabla de lo que se guarda en el navegador y por qué no hace falta aviso.
  - Los datos del responsable salen de `LEGAL_*` en `.env`; si faltan, se ven marcados y con aviso de
    borrador.
- **Bienvenida:**
  - La primera vez, o cuando cambia la versión de un documento, pide en dos casillas separadas y sin marcar
    aceptar los términos y autorizar el tratamiento de datos, con el aviso de privacidad corto.
  - Los documentos se pueden leer sin aceptar.
- **Registro (`mm_consents`):**
  - Guarda documento, versión, texto exacto de la casilla, formulario, nombre declarado, identificador al azar
    del navegador, navegador, fecha y un resumen SHA-256 de la IP con sal secreta (la IP no se guarda).
  - Las revocaciones son filas nuevas; nada se edita ni se borra.
  - Exportable en CSV desde Configuración, donde también se ve lo aceptado y se revoca.
- **Adjuntos e importación:**
  - Exigen declarar la autorización sobre los datos de terceros; la API lo exige también (422 sin
    `autorizado`), y la declaración queda en el registro.
- **Pruebas:** 6 de la API (208 en total) y una de navegador del flujo completo (14 en total). Las demás
  pruebas de navegador usan un navegador que ya aceptó.

## 17. Operación: avisos, remesa, API versionada y errores del navegador (28/10/2026)

- **Avisos al celular (ntfy)** cuando se registra una incidencia en ruta (prioridad alta, abre la ficha) o se
  cierra o reabre una vía o un nodo (con cuántos envíos se redirigieron o quedaron sin ruta). Usa el mismo
  `NTFY_TOPIC` del monitor; sin él no hace nada. Se envía en segundo plano y en JSON (tildes en el título).
- **Remesa de carga en PDF** desde la ficha: remitente, destinatario, mercancía, tramos con vehículo,
  observaciones y firmas. Es un formato de referencia; no reemplaza la remesa electrónica del RNDC.
- **`/api/v1/...`:** la misma API con versión explícita para integraciones (`X-API-Version: 1`).
- **Errores del navegador:** los fallos de JavaScript se envían solos al servidor (máximo 5 por carga, sin
  parámetros de la URL) y se ven en Configuración › Errores recientes. Se guardan los últimos 500.
- **Carga del mapa:** mientras llega el mapa 3D se ve la red en plano (silueta del país con sus rutas).
- **Pruebas:** 214 de la API y 14 de navegador.

## 18. Costo real contra estimado y mapa de calor de retrasos (28/10/2026)

- **Costo real** (schema v9: `actual_cost`, nota, fecha y quién) en la ficha de cada envío: se registra en la
  moneda en pantalla (COP se convierte con la TRM), muestra estimado, real y desviación (rojo si supera +5 %,
  verde si baja de −5 %) y queda en el historial. En Clientes, el total real contra el estimado de los envíos
  con costo registrado.
- **Historial › Retrasos:** tabla-mapa de calor de las 12 vías con más horas de retraso por día de salida.
  Un tono en cinco pasos por quintiles sin repetir cortes; el paso más oscuro es el acento pleno (texto
  blanco a 4,6:1). Detalle al pasar el puntero o con el foco, y nota de cómo se cuenta: un envío retrasado
  suma en cada vía de su ruta, así que muestra concentración, no causa.
- **Pruebas:** 217 de la API y 14 de navegador; axe sin violaciones en claro y oscuro.

## 19. Retención de adjuntos, estado del servidor y prueba de carga (28/10/2026)

- `ATTACHMENT_RETENTION_DAYS`: borra a diario los adjuntos de envíos entregados hace más del plazo, con una
  línea de auditoría por envío; sin la variable no borra nada. Así la política de datos se cumple en la práctica.
- `deploy/estado.sh` (memoria, disco, carga, contenedores, respuesta y último respaldo) y
  `deploy/prueba-carga.py` (N personas navegando, solo lecturas; en local, 8 usuarios: páginas p95 641 ms, API
  p95 89 ms, sin errores).
- Accesos directos en la app instalable (nuevo envío, envíos, red). El manifiesto ya existía.
- axe sin violaciones en 21 páginas, claro y oscuro. No se unificó el sondeo en vivo: ya se comparte por URL y se
  pausa con la pestaña oculta, así que no aportaba.

## 20. Seguimiento público para el cliente (28/10/2026)

- **Enlace de seguimiento** por envío (tabla `mm_tracking_links`, token de 24 caracteres al azar, hasta 5 activos
  por envío, revocable): `/seguimiento/<token>` muestra estado, avance, llegada estimada, retraso y recorrido por
  tramos. **No** muestra costos, cliente, peso, quién lo registró, notas, incidencias ni documentos (una prueba lo
  verifica). Se actualiza solo cada 60 s con la pestaña a la vista y lleva `noindex`.
- Esa página no muestra menú, avisos ni la bienvenida de aceptación (`ShellOnly`): el cliente no es un usuario de
  la app. Se crean, copian y revocan desde la ficha (Seguimiento para el cliente); queda en el historial.
- Si se activa Cloudflare Access, `/seguimiento/*` y `/api/tracking/*` deben quedar como rutas públicas.
- Pruebas: 221 de la API y 15 de navegador.

## 21. Vehículo elegido a mano por tramo (28/10/2026)

- **Lo que ya había:** el motor asigna solo un vehículo de la flota propia a cada tramo (sin cruces de horario,
  operable, con capacidad, el más cercano) y lo sustituye si falla o entra a mantenimiento. Lo que faltaba era poder
  elegirlo a mano.
- **Ahora:** en la ficha, cada tramo tiene «Cambiar vehículo». La hoja lista los vehículos del modo del tramo; los que
  no pueden cubrirlo en su horario salen apagados con la razón (falla, mantenimiento, licencia vencida, otro tramo a
  esa hora). Por carretera se pueden elegir hasta 4 vehículos que sumen la carga; en los demás modos, uno.
  «Volver a automático» deshace la elección.
- **Fijado:** `asset.pinned`. Sobrevive a editar el envío y a la redirección por un cierre de vía (`fleet.carry_pins`)
  mientras el tramo siga igual (mismo modo, origen y destino) y el vehículo siga pudiendo cubrirlo y llevando la
  carga. Si deja de poder (falla, mantenimiento), se sustituye como siempre y la marca se pierde. Antes ni la
  asignación automática sobrevivía a editar el envío: el tramo se reasignaba desde cero.
- **Solo tramos que aún no salen**; un tramo en curso o terminado responde 422. Queda en el historial del envío.
- **API:** `GET /api/shipments/{code}/legs/{i}/vehicles` y `PUT /api/shipments/{code}/legs/{i}/vehicle`
  (`{"vehicle_ids": [...], "usuario": "..."}`; lista vacía = automático). Sin cambios de esquema.
- **Pruebas:** 229 de la API y 16 de navegador.
- **Entorno:** en este PC a Playwright le falta su Chromium (`npx playwright install` lo descarga). Se corrieron las
  pruebas con Edge (`channel: "msedge"`) y con el `.venv` del backend en el `PATH`, porque Playwright arranca la API
  con el Python del sistema.

## 22. Coherencia geográfica de la red (28/10/2026)

Pendiente «validar coordenadas». Las fuentes oficiales (INVÍAS, ANI, Aerocivil, Cormagdalena) no están en el repo y
no se consultaron; esto es una comprobación de coherencia contra lo que sí hay: los polígonos del DANE
(`colombia_departamentos.geojson`) y la física de las distancias. Queda como `backend/tests/test_coordenadas.py`.

- **Nodos (87):** todos dentro de Colombia; 79 dentro del polígono de su departamento. Los otros 8 están a 2–14 km
  del borde y son explicables: puertos sobre la costa (Cartagena, Tumaco, Puerto Bolívar, Puerto Nuevo, San Andrés),
  ciudades sobre un río fronterizo (La Dorada, Arauca) y el aeropuerto de Cartagena, cuyo polígono está muy
  simplificado. La prueba tolera 15 km al borde.
- **Enlaces (148):** 99 ya estaban marcados `approximate`. Ninguno sale de Colombia. Tres vías terrestres declaraban
  menos kilómetros que la línea recta entre sus extremos, algo imposible por carretera. **Corregidas** (migración
  `schema_v10.py`, que solo toca filas con el valor anterior, así que respeta lo editado a mano, y las marca
  `approximate`). Ninguna cifra es oficial de INVÍAS:
  - Honda → Ibagué: 95 → **102 km** (Bookaway). Es exactamente la línea recta, así que es un piso y se queda corta.
  - Bosconia → Valledupar: 90 → **94 km** (estimación de ruta de Rome2rio). Su trazado dibujado mide 105 km: la línea
    del mapa da un rodeo, la distancia declarada no.
  - Cali (CEDI Yumbo) → Santander de Quilichao: 45 → **80 km**. Los 45 km publicados son desde el centro de Cali; desde
    Yumbo no hay cifra y se usó la recta (64 km) × 1,25, factor de sinuosidad típico. Es una estimación, no un dato.
  - Los tiempos conservan la velocidad media de cada tramo. Los envíos ya creados conservan el costo y el tiempo con que
    se calcularon; los nuevos y los recalculados usan las distancias nuevas.
  - Cuando haya la cifra oficial, se cambia en `DISTANCE_FIXES` y en `colombia_multimodal.py`.
- **Cosmético:** Pasto–Mocoa (71 km de trazado para 145 km declarados) y Ocaña–Cúcuta (101 para 190) tienen pocos
  puntos de paso: la línea del mapa es casi recta, la distancia es razonable.
- **No cubre:** que cada coordenada esté sobre la vía, el puerto o la pista reales. Eso sigue exigiendo las fuentes
  oficiales.
- Pruebas: 236 de la API.

## 23. Rendimiento del mapa: no hace falta el lienzo 3D único (29/10/2026)

Pendiente «medir el mapa con `?diagnostico`» cerrado con una medición en el equipo real del dueño.

- **Equipo:** Edge 156, AMD Radeon integrada (ANGLE/Direct3D11), 8 núcleos, 16 GB, pantalla 1912×948, calidad del mapa
  «auto (alta)», `equipo_modesto: false`.
- **Resultado en `/red`:** 60 cuadros/s; 13 bloqueos del hilo principal en total, **ninguno de 250 ms o más**, el peor de
  98 ms. Aparecen en dos ráfagas, ambas al entrar a la Red: 9 tareas de 50 a 98 ms al cargar y 4 de 54 a 87 ms al volver
  después de pasar por el Resumen. Entre las dos no hay nada: el mapa en reposo no consume.
- **Decisión:** no se construye un solo lienzo 3D ni se conserva el mapa de Red entre visitas. Conservarlo ahorraría
  solo la segunda ráfaga (unos 0,3 s de tirones sumados) y exigiría mantener vivo un contexto WebGL, lo que choca con
  la regla de que el mapa en reposo no hace trabajo por cuadro.
- **Límites de la medición:** una sola corrida, en un PC de gama media-alta y sin el informe local para comparar (el
  informe no indica si vino del sitio real o de `localhost`). En equipos modestos la app ya baja sola a calidad
  «liviana». Si alguien reporta tirones, se reabre con `?diagnostico` en su equipo.
- **Cómo se mide:** se abre cualquier URL con `?diagnostico` (queda activo por origen: `localhost:3000` y
  `127.0.0.1:3000` son distintos), se espera en reposo y se navega Resumen → Red → Resumen → Red; «Copiar informe».
  El navegador integrado de Claude no sirve para esto: con el panel oculto pausa `requestAnimationFrame` y marca 0.

## 24. Prueba de entrega con firma en pantalla (29/10/2026)

- **Qué es:** cuando un envío llega (estado «Entregado»), la ficha permite registrar quién recibió, la hora, si la carga
  llegó **conforme** o **con novedad** (con la novedad obligatoria) y la **firma** de quien recibe, dibujada con el
  dedo, el lápiz o el mouse. El lienzo es «papel» blanco con tinta oscura en los dos temas, para que la firma se vea
  igual en pantalla y en el PDF.
- **Una por envío.** Para corregirla se anula (queda en el historial) y se registra de nuevo. Al borrar el envío se va
  con él.
- **Remesa en PDF:** la casilla «Recibí a satisfacción» lleva la firma, el nombre, la fecha y el estado.
- **Seguimiento público:** solo «Entrega confirmada · fecha · conforme/con novedad». No muestra el nombre ni la firma
  (una prueba lo verifica).
- **Datos personales:** con `ATTACHMENT_RETENTION_DAYS`, el nombre y la firma se borran al cumplirse el plazo; se
  conservan el estado y las fechas, con una línea de auditoría.
- **Seguridad:** la firma debe ser un PNG real (se revisa la firma del archivo) de máximo 200 KB.
- **Movimiento:** al guardar, el formulario se convierte en el comprobante (fundido y desplazamiento corto) y el sello
  entra con un resorte (`scale`). Con «reducir movimiento», solo fundidos.
- **API:** `GET/PUT/DELETE /api/shipments/{code}/delivery`. Esquema v11: tabla `mm_deliveries` (aditiva).
- **Pruebas:** 245 de la API y 17 de navegador.
- **Intermitente previo (sin resolver):** la prueba de celular falló una vez de tres con un error de hidratación de
  React (#418) en `/configuracion`. No se reprodujo; no viene de este cambio. Si vuelve, revisar qué texto de
  Configuración difiere entre el servidor y el navegador.

## 25. SOAT y revisión técnico-mecánica de los vehículos de carretera (29/10/2026)

- **Qué controla:** los dos documentos obligatorios para circular en Colombia: SOAT (Ley 769 de 2002) y revisión
  técnico-mecánica y de emisiones (RTM). Solo aplican al modo terrestre. Son vigentes hasta el día del vencimiento,
  inclusive.
- **Estado derivado, como el resto de la flota:**
  - Vencido: el vehículo queda **Inhabilitado**, con el motivo.
  - Treinta días antes: aviso «vence en N d».
  - Sin fecha: «Sin registrar», que no bloquea (no se inventa un dato).
- **Asignación:** un vehículo no recibe un tramo que **termine** después del vencimiento. El selector de vehículo del
  tramo lo explica («vencen antes de terminar el tramo»).
- **Al vencerse o al corregir la fecha:** sus tramos pendientes que terminan después del vencimiento pasan a otro
  vehículo o a un tercero, con nota en el envío. Los que terminan antes se quedan. Lo hace al editar el vehículo y una
  vez al día (`fleet.enforce_documents`).
- **Pantallas:**
  - En el formulario del vehículo, «Documentos obligatorios» (solo en carretera).
  - En la ficha, una tarjeta por documento con estado y días.
  - En el tablero de flota, la cifra «SOAT y técnico-mecánica» (roja si hay vencidos).
- **Datos:** esquema v12 (`soat_expiry`, `rtm_expiry`, aditivo). Los vehículos **de la semilla** (simulados) reciben
  fechas deterministas a partir de la placa: casi todas vigentes y una de cada nueve por vencer. Los creados por usuarios
  quedan sin registrar. En Contabo la migración llena solo la semilla de carretera que esté vacía.
- **Pruebas:** 254 de la API (9 nuevas, sin saltos) y 18 de navegador.

## 26. Tablero «Hoy» del despachador (29/10/2026)

- **`/hoy`** (primero en «Más» y en `Ctrl K`). Muestra en una vista lo que pasa en las próximas 24 horas:
  - **Salen:** con el vehículo del primer tramo.
  - **Llegan:** con su retraso.
  - **Por firmar:** envíos que llegaron en los últimos 7 días sin prueba de entrega.
  - **Requiere atención:** incidencias del día y SOAT o técnico-mecánica que vencen en 7 días.
  - **Arriba:** cuatro cifras que llevan a cada bloque.
  - **Actualización:** sola cada minuto, con la pestaña a la vista.
- **Sin el reloj del navegador:** la API manda «en cuántas horas» (`in_h`) y la página es un componente de servidor;
  el texto de la hora no puede diferir entre el servidor y el navegador.
- **Movimiento:** los bloques entran escalonados (`Reveal`: fundido y 12 px con `transform`).
- **API:** `GET /api/today`. Pruebas: 3 de la API y 1 de navegador (más `/hoy` en la revisión de páginas y de celular).
- **Corregido antes de publicar:** en celular la página desbordaba a lo ancho (textos largos sin `min-w-0` dentro de
  filas flexibles).

### Error de hidratación intermitente (cerrado en la sección 30)

- **Qué se ve:** React #418 en `/configuracion`, y una vez campos duplicados en `/flota/<id>/editar`: el mismo
  `<input>` con id de servidor (`_R_…`) y con id de cliente (`_r_…`). React vuelve a pintar en el navegador y queda el
  segmento del servidor.
- **Cuándo pasa:** salió en 1 de 4 corridas y luego en las 2 últimas. Parece depender de los datos de la base de
  pruebas, que se conserva entre corridas. No se reprodujo en `next dev` ni cargando las páginas a mano.
- **Descartado:**
  - Una transición con `AnimatePresence` en la ruta: no la hay, `template.tsx` solo hace un fundido.
  - Texto dependiente de la hora en el armazón.
  - Diferencias de formato de fecha entre Node (ICU 78.3) y Chromium: son idénticas.
- **Siguiente paso:** usar una copia de `/tmp/westvane-e2e.db` con `next dev` para ver el diff exacto de la
  hidratación.
- **Este lote no toca Configuración.**

## 27. Aviso diario de documentos de flota por vencer (29/10/2026)

- Una vez al día, por el mismo canal ntfy de las incidencias, se envía un aviso con los SOAT, técnico-mecánicas y
  licencias de conducción vencidos o que vencen en 7 días o menos. Lleva hasta 8 líneas y «y N más».
- Si hay alguno vencido, el aviso va con prioridad alta. Al tocarlo se abre `/hoy`. Sin `NTFY_TOPIC` no envía nada.
- `fleet.notify_due`, llamado en la revisión diaria junto con `enforce_documents`.
- Pruebas: 259 de la API.
- En Contabo, la caída registrada a las 02:15 (29/10) no tiene causa clara. Caddy muestra respuestas cortadas a una
  IP de AWS un instante antes y no hay reinicios ni falta de memoria. No se repitió. Los 5 s de `/api/health` justo
  después de reconstruir son el arranque en frío; en reposo responde en 0,04 a 0,24 s.

## 28. La entrega en la lista de envíos y en el PDF (29/10/2026)

- **Lista de envíos:** los entregados llevan «Firmada» (verde) o «Sin firmar». Hay un chip **«Por firmar»** con su
  cifra que deja solo los que llegaron sin prueba de entrega. También se abre con `/envios?firmar=1`. «Limpiar
  filtros» lo quita.
- **API:** `delivery_signed` en la lista y en la ficha (true / false en los entregados, null en los demás). Una sola
  consulta para toda la lista.
- **PDF del envío:** sección «Entrega» con la fecha, el estado y la novedad si la hubo, o el aviso de que falta
  registrarla. **Sin nombre ni firma**, porque ese PDF también se comparte por enlace. Nombre y firma siguen solo en la
  remesa, de uso interno. Una prueba verifica que no lleva imagen.
- El chip «Por firmar» de `/hoy` sigue apuntando a su bloque: allí cuenta solo la última semana y la lista cuenta todo.
- Pruebas: 260 de la API y 20 de navegador (falla la de celular solo por el #418 abierto de la sección 26).

## 29. Avisos de flota y entregas en el resumen, y pulido visual (29/10/2026)

- **Requiere atención** (Resumen y campana del dock) suma:
  - **documentos de flota vencidos** (rojo, cuenta como urgente) y **por vencer** (naranja), que llevan a `/hoy`;
  - **entregas por firmar** de la última semana.
  `/api/alerts` y el resumen traen `documents` y `to_sign`.
- **Pulido visual** (revisado con capturas de antes y después en escritorio y celular):
  - **Cadena de modos de la ficha:** ahora ocupa todo el ancho. Cada tramo crecía con `flex-grow` igual a sus horas,
    y un viaje de 30 min sumaba 0,5: el navegador repartía solo la mitad del espacio y «Destino» quedaba flotando en
    el centro. Los pesos van en % del recorrido. Barra de 8 px y un **marcador de dónde va la carga**, un punto quieto
    del color del modo, sin animación.
  - **Requiere atención:** el ícono va solo, en el color del estado, sin el círculo tintado que `DESIGN.md` prohíbe.
    Se probó una franja de color al borde y se descartó por ser un patrón genérico.
  - **Flota:** «Disponibilidad» absorbe «Disponibles», que decía lo mismo («40 listos de 60», y sigue filtrando).
    Las seis cifras caben en una fila; antes la de SOAT quedaba sola abajo.
  - **Hoy:**
    - la hora va en una línea y el día («mañana») abajo; antes se partía en «jue 29 ·» / «05:33»;
    - «Llegan» ya no sale en naranja cuando solo una parte viene con retraso.
  - **Prueba de entrega:** sin el ícono repetido y con fecha corta («28 de oct, 10:02 p. m.»).
- Pruebas: 261 de la API y 20 de navegador en puertos y base propios.

## 30. Error de hidratación de Configuración: causa y corrección (29/10/2026)

- **Causa:** `useConsent()` (`lib/consent.ts`) daba a `useSyncExternalStore` el estado del módulo también como
  instantánea de servidor (`() => state`). El panel de Configuración llega en un límite de Suspense que se hidrata
  después del armazón. Si la API tardaba en dar el panel (historial de 300 cambios, base de pruebas que crece en cada
  corrida), la ventana de aceptación del armazón ya había traído el estado de privacidad. El primer render del panel
  mostraba la lista «Aceptado · versión…» y el HTML del servidor decía «Cargando…»: React #418 (`args[]=HTML`) y la
  sección se volvía a pintar en el navegador. Por eso dependía de los datos y del tiempo, no de la página.
- **Corrección:** la instantánea de servidor es siempre el estado vacío (`SERVER_STATE`). Al hidratar, el panel
  pinta lo mismo que el servidor y enseguida pasa al estado real. Los demás `useSyncExternalStore` ya daban un valor
  fijo al servidor.
- **Prueba:** `e2e/hidratacion.spec.ts`. Un proxy local entrega el armazón y retiene el segmento del panel
  (`<div hidden id="S:…">`) hasta que el navegador recibió el estado de privacidad. La TRM llega después, porque un
  cambio de contexto antes de hidratar hace que React pinte el bloque de cero sin comparar y eso ocultaría la falla.
  Comprueba que no hay errores y que los ids del panel son los del servidor (`_R_…`). Sin la corrección falla con el
  mismo #418; con ella pasa siempre.
- **Campos duplicados en `/flota/<id>/editar` (visto una vez):** no se reprodujo. El formulario no lee estado del
  navegador al hidratar; lo único que cambia antes de que se hidrate es el contexto de `AppProvider` (llega la TRM).
  Eso hace que React pinte el bloque de cero sin error, como se vio en la prueba. Si vuelve a salir, revisar ese
  camino.
- **Verificación:** `tsc`, `eslint`, `npm run build`, 259 pruebas de la API y Playwright completo (20 de 20) en dos
  corridas seguidas sin #418, en puertos propios (3200/8200) y con una copia propia de la base de pruebas acumulada.
  Dos sesiones que usen a la vez 3100/8100 comparten servidores por `reuseExistingServer`: dar a cada una
  `E2E_PORT`, `E2E_API_PORT` y `E2E_DB_PATH` propios. Con ese choque, en una corrida la prueba de celular superó sus
  60 s (suele tardar 37 a 42 s en este PC), sin errores de hidratación.


## 31. Pulido visual, segunda ronda (29/10/2026)

- **Chips en celular:** `chip-scroll` debía poner los chips de filtro en una sola fila deslizable, pero el mismo
  elemento lleva `flex-wrap` para escritorio y esa utilidad ganaba en el orden de Tailwind 4. En Envíos los estados
  se partían en tres filas desparejas. Ahora lleva `!important` en `flex-wrap: nowrap`. Arregla las 10 filas de chips
  de la app.
- **Documentos del vehículo:** filas con línea divisoria (dos columnas en pantallas medianas) en lugar de cajas grises
  dentro de la tarjeta.
- Pruebas: 21 de navegador (incluida la de desborde en celular).
- **Aviso «por firmar» del resumen: solo 48 h** (decisión del dueño). En producción contaba 145, porque en la operación
  simulada los envíos se entregan solos y nadie firma; un aviso permanente de cientos es ruido. «Requiere atención» y la
  campana cuentan las entregas sin firma de las últimas 48 h. «Hoy» sigue mostrando la semana y la lista de Envíos,
  todas (chip «Por firmar»). Pruebas: 262 de la API.
