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

## 32. Paleta estilo Apple (29/10/2026)

- **Por qué:** el dueño dijo que los colores «se notaban de IA». La paleta tenía un magenta en aéreo, un violeta en
  marítimo, un turquesa en terrestre y un acento índigo en el modo oscuro.
- **Ahora:**
  - **Modos, rellenos y gráficos:** colores de sistema de Apple.
  - **Texto de estado:** sus variantes de «contraste aumentado», con lo mínimo para 4,5:1 sobre el tinte del 14 %.
  - **Acento:** el azul de apple.com en los dos temas (`#0071e3` en botones; `#0066cc` / `#2997ff` como texto).
  - Valores y razones en `DESIGN.md` (Colors).
- **Validación de los modos** con el validador de la skill de visualización, en todas las parejas:
  - Claro: peor 8,9 con daltonismo y 20,4 con visión normal. La paleta anterior tenía 8,1.
  - Oscuro: 8,9 y 16,2.
  - Se descartaron el café de Apple, el morado y el verde puro en terrestre.
  - La versión oscura se buscó en forma sistemática: mismos tonos, la luminosidad dentro de la banda del oscuro y la
    más luminosa entre las que pasan.
- Cambian solo `globals.css` y `lib/modes.ts` (RGB del mapa). Pruebas: 21 de navegador.

## 33. Pulido visual, cuarta ronda: formularios e historial (29/10/2026)

- **Desplegables de formulario** (`select.field`): sin la flecha del sistema operativo, que en Windows no se parece
  a la app. Llevan un chevrón fino en el gris secundario, con su versión para el oscuro. Aplica a envío, vehículo,
  bodega, conductor, bitácora y configuración.
- **Historial:** «Sin período anterior para comparar» salía repetido bajo cada cifra. Ahora va una sola vez debajo de
  la franja. Peajes sin tarifa muestra «—» como cifra y la explicación en la línea pequeña.
- **Prueba de firma estable:** fallaba 1 de cada 4 veces porque dibujaba mientras el formulario entraba. Ahora espera a
  que el lienzo esté quieto y repite el trazo si no se registró.
- Pruebas: 21 de navegador.

## 34. Conductor en la remesa, hoja del día imprimible y la causa real de los campos duplicados (29/10/2026)

- **Remesa:** la columna «Conductor o capitán» lleva el conductor activo asignado a cada vehículo propio, con su
  categoría de licencia. Con varios vehículos va uno por cada uno; los terceros quedan en blanco. Una prueba genera
  el PDF sin compresión y busca el nombre.
- **Hoy:**
  - botón «Imprimir la hoja del día»;
  - en papel lleva la fecha y hora de generación (la pantalla se actualiza sola, el papel no);
  - «en 0 min» ahora dice «ahora».
- **Campos duplicados en formularios (React volvía a pintar el bloque en el cliente):** la sección 30 había corregido
  `useConsent`, pero quedaban dos fuentes de la misma clase de fallo:
  - `AppProvider` cambiaba el valor de su contexto al llegar la TRM (`/api/settings`) y al leer del navegador el
    operador y la moneda;
  - `PrefsProvider` hacía lo mismo con el tema guardado (afectaba a quien usa el oscuro).

  Todo componente con `useApp()` o `usePrefs()` dentro de un `<Suspense>` que aún esperaba su HTML recibía esa
  actualización antes de hidratarse. React lo pintaba de nuevo en el cliente y el segmento del servidor (`S:1`) se
  quedaba oculto en el documento: había 6 campos de fecha en vez de 3 en `/flota/<id>/editar`. Se reprodujo en
  `next dev` con la base de pruebas donde falló.

  **Arreglo:** los contextos ya no llevan valores que cambian; cada componente lee la TRM, la moneda, el operador y el
  tema con `useSyncExternalStore` (al hidratar, el valor del servidor).

  **Verificado:** con la misma base, la prueba de SOAT y la de hidratación pasan 5 de 5 cada una, y la suite pasa
  21 de 21.
- Pruebas: 263 de la API y 21 de navegador.

## 35. Vehículo asignado en la lista general de envíos y pulido de adaptabilidad (29/10/2026)

- **Vehículo asignado en envíos:**
  - `backend/app/api/serializers.py`: la serialización de envíos (`shipment`) ahora incluye un resumen del vehículo activo/asignado (`vehicle`: `id`, `type`, `carrier`, `own`, `outsourced`, `vehicle_ids`, `plates`, `pinned`) y la lista de todos los vehículos de los tramos (`vehicles`). Se incluye tanto en el listado general (`GET /api/shipments`) como en el detalle individual.
  - `frontend/src/components/shipments/shipments-table.tsx`:
    - En escritorio: columna «Vehículo» (`hidden xl:table-cell`). Si es flota propia, enlaza directamente a su ficha `/flota/:id`; si es tercero, muestra el nombre o transportista en texto atenuado con tooltip.
    - En celular: badge con código/placa en tipografía mono junto al código del envío en la tarjeta móvil.
  - Pruebas: prueba unitaria en `backend/tests/test_fleet_warehouses.py` (`test_vehiculo_en_lista_y_detalle_de_envios`) y prueba E2E en `frontend/e2e/envios.spec.ts`.
- **Pulido visual y de pruebas:**
  - `frontend/src/components/settings/tolls-panel.tsx`: en pantallas móviles (< 1024 px), cada peaje se presenta en tarjetas responsivas en lugar de una tabla HTML que provocaba ensanchamiento horizontal en `/configuracion`.
  - `frontend/src/components/shell/dock.tsx`: `z-index` del dock de escritorio ajustado a `z-50` para evitar que el canvas interactivo WebGL de deck.gl en `/red` intercepte clics de navegación.
  - `frontend/next.config.ts`: agregado `turbopackPluginRuntimeStrategy: "workerThreads"` para compatibilidad de build de Turbopack en Node 26.
  - `frontend/playwright.config.ts`: soporte para ejecutar uvicorn usando el intérprete del `.venv` en Windows.
- **Verificado:**
  - `cd frontend && npx tsc --noEmit && npx eslint src e2e && npm run build` (0 errores).
  - `cd backend && python -m pytest -q` (264 pruebas pasadas).
  - `cd frontend && TZ=America/Bogota npx playwright test` (22 pruebas de navegador pasadas, cubriendo escritorio y celular a 412 px y 375 px).
- Pruebas: 264 de la API y 22 de navegador.


## 36. Autenticación sin contraseña por correo (OTP), empresas y roles (29/10/2026)

- **Regla del sistema:** Sin contraseña de aplicación (cumpliendo estrictamente `AGENTS.md`). El acceso se realiza mediante código numérico de 6 dígitos enviado al correo institucional (`auth_codes`), con expiración a los 10 minutos y hash criptográfico con salt (SHA-256).
- **Esquema aditivo `schema_v13.py`:**
  - Nueva tabla `companies` (`company_id`, `name`, `nit`, `active`, `created_at`).
  - Columnas añadidas a `users`: `email` (TEXT) y `company_id` (INTEGER, FK a `companies`).
  - Tabla `auth_codes` (`code_id`, `email`, `code_hash`, `salt`, `attempts`, `expires_at`, `used_at`, `created_at`).
  - Tabla `user_sessions` (`session_id`, `user_id`, `expires_at`, `created_at`).
  - Migración aditiva e idempotente integrada en `init_db.py` y `_seed_users()`.
- **Motor y endpoints (`backend/app/engine/auth_otp.py` y `backend/app/main.py`):**
  - `POST /api/auth/otp/request`: valida formato y existencia de correo; genera OTP de 6 dígitos; en modo desarrollo retorna `dev_code`.
  - `POST /api/auth/otp/verify`: valida código y expiración; invalida reintentos abusivos; crea sesión de 30 días y retorna token portador.
  - `GET /api/auth/me`: retorna identidad completa (`user_id`, `username`, `full_name`, `email`, `role`, `company`).
  - `POST /api/auth/logout`: revoca sesión activa.
  - `GET/POST /api/companies`: listado y creación de empresas asociadas.
  - `GET/POST /api/admin/users` y `PUT /api/admin/users/{id}/role`: administración de usuarios, empresas y roles.
- **Frontend y experiencia de usuario:**
  - `frontend/src/lib/auth.ts`: almacén reactivo con `useSyncExternalStore` sin llamadas síncronas a `setState` en efectos (cero advertencias de React Compiler).
  - `frontend/src/lib/client.ts`: inyección automática del token de sesión (`Authorization: Bearer <token>`) en todas las peticiones `api()`.
  - `frontend/src/components/auth/login-dialog.tsx`: modal accesible de ingreso con código por correo, selector rápido de cuentas semilla de prueba, y ficha de usuario y empresa con botón de cierre de sesión.
  - `frontend/src/components/shell/dock.tsx`: `OperatorField` muestra usuario activo, rol y empresa si está autenticado; o campo de operador declarado con botón para ingresar por correo si no lo está.
  - `frontend/src/app/layout.tsx`: `LoginDialog` montado a nivel raíz.
- **Pruebas y verificación:**
  - `backend/tests/test_auth_otp.py`: 4 pruebas unitarias cubriendo solicitudes de OTP inválidas, código erróneo, flujo exitoso, cierre de sesión y gestión de empresas/roles.
  - `frontend/e2e/auth.spec.ts`: prueba Playwright E2E del flujo completo de ingreso con OTP y verificación de sesión en la interfaz.
- **Verificado:**
  - `cd frontend && npx tsc --noEmit && npx eslint src e2e && npm run build` (0 errores).
  - `cd backend && python -m pytest -q` (268 pruebas pasadas).
  - `cd frontend && TZ=America/Bogota npx playwright test` (23 pruebas de navegador pasadas).
- Pruebas: 268 de la API y 23 de navegador.

## 37. Revisión de seguridad de la autenticación y correcciones (29/10/2026)

Claude revisó la sección 36 antes de subirla a Contabo y encontró fallos que lo impedían. Se comprobaron ejecutándolos
contra una base temporal. **Nada de esto llegó a producción.**

- **Lo encontrado:**
  1. **Cualquiera podía crear un administrador:** `POST /api/companies`, `POST /api/admin/users` y
     `PUT /api/admin/users/{id}/role` respondían 201 sin ninguna sesión (el nombre de quien actúa era un parámetro
     de la URL).
  2. **El código viajaba en la respuesta** (`dev_code`) siempre que no hubiera SMTP, y en Contabo no lo hay: pedir
     un código y leerlo de la respuesta daba una sesión de administrador sin recibir ningún correo.
  3. **Un almacén en memoria** (`_LAST_GENERATED_CODES`) guardaba cada código en claro mientras el servidor vivía.
  4. **Los correos de la semilla** (`admin@westvane.com`...) eran de un dominio real que podría ser de un tercero: si
     algún día se configurara el correo, ese código le llegaría a esa persona.
  5. **El NIT** de la empresa por defecto (`901.845.120-3`) era inventado y podría ser de una empresa real.
  6. **Botones de «cuentas demo»** en el diálogo de ingreso, visibles para cualquiera.
  7. La respuesta de «código enviado» distinguía correos registrados de los que no.
- **Correcciones:**
  - **Administrar exige sesión de administrador** (401 sin sesión, 403 con otro rol). El historial queda firmado por la
    cuenta de la sesión, no por un nombre escrito en la URL. No se puede quitar el rol al último administrador.
  - **`dev_code` y el registro del código en el log solo con `WESTVANE_DEV_OTP=1`**, que no se define nunca en
    producción (sí en las pruebas). Sin SMTP y sin ese modo, pedir un código responde que el correo no está
    configurado: **iniciar sesión queda deshabilitado, a propósito**.
  - **Primer administrador desde el `.env`:** `ADMIN_EMAIL` (y `ADMIN_NAME`). Se crea al arrancar y, si alguien lo
    degradó o desactivó, se restablece.
  - La respuesta no revela si el correo existe; un código nuevo por correo cada 60 s (`WESTVANE_OTP_COOLDOWN_S`).
  - Correos de la semilla en `@westvane.invalid` (dominio reservado por la RFC 2606, que no puede existir); empresa por
    defecto sin NIT; sin botones de demostración; se eliminó el almacén en memoria.
- **Para activar el ingreso en producción** hace falta el dueño: configurar un SMTP real (`SMTP_HOST`, `SMTP_PORT`,
  `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) y `ADMIN_EMAIL` en el `.env` del servidor. Sin eso la app funciona como hoy.
- **Lo que NO hace el ingreso (importante):** es opcional y **no restringe nada**. Ningún endpoint de datos (envíos,
  flota, bodegas...) exige sesión: la app sigue abierta, como decidió el dueño. El rol y la empresa se muestran pero
  aún no limitan acciones. Cuando se quiera, exigir sesión y rol por endpoint es un paso aparte y de mayor impacto.
- **Pendiente de revisión legal:** la política de privacidad dice que no hay cuentas; el ingreso por correo guarda
  correos electrónicos y códigos de acceso. Hay que actualizarla antes de activar el ingreso en producción.
- **Pruebas:** `test_auth_otp.py` pasó de 4 a 10 pruebas, que cubren el ataque original (401, 403, sin `dev_code`
  fuera del modo de desarrollo, correo no registrado, último administrador, administrador inicial, enfriamiento).
- **Menú «Más» tapaba el diálogo de ingreso:** al pulsar «Ingresar con código al correo», el menú seguía abierto encima
  y cubría «Enviar código». La prueba de navegador antiguo no lo vio porque usaba los botones demo, que quedaban fuera
  del menú. Ahora `OperatorField` cierra el menú que lo contiene (escritorio y celular).
- **Aviso, sin cambiar:** varios archivos del proyecto (`dock.tsx`, `layout.tsx`, `seed_data.py`, `tolls-panel.tsx`...)
  tienen finales de línea `\r\r\n` desde el commit original. No afecta a la app, pero hace que `git diff` muestre miles de
  líneas cambiadas; usar `git diff -w --ignore-cr-at-eol`. Normalizarlos es un commit aparte.
- **Verificado al cerrar:** 274 pruebas de la API y 23 de navegador, con la API iniciada sin `SMTP_HOST` ni modo de
  desarrollo (salvo en las pruebas).

## 38. Mapa de Red en celular (29/10/2026)

- **Antes:** el mapa abría tan alejado que se veían Perú, el Caribe y Centroamérica, con Colombia pequeña y los nombres
  encimados. Había tres causas:
  - la cámara inclinada 45° encogía el norte, donde están casi todos los nodos;
  - el encuadre incluía San Andrés, 3° al oeste, en una pantalla que manda por el ancho;
  - reservaba el 30 % de la altura para el simulador plegado, que ocupa cerca del 22 %.
- **Ahora, en pantallas angostas:**
  - la cámara arranca plana y sin giro (se puede inclinar con dos dedos);
  - el encuadre es la Colombia continental (San Andrés queda a un arrastre);
  - la reserva inferior es del 22 %;
  - solo se rotulan los CEDI y los puertos marítimos (las demás ciudades conservan su punto y su ficha).
- El escritorio no cambia. El mapa sigue quieto en reposo: es solo la vista inicial.
- Pruebas: 21 de navegador.

## 39. Pantalla de administración de usuarios y empresas (29/10/2026)

- **`/administracion`:** lista de usuarios con su rol (se cambia ahí mismo), alta de usuarios (nombre, correo, rol y
  empresa) y de empresas (nombre y NIT opcional). Usa la API que ya existía (`/api/admin/users`, `/api/companies`).
- **Quién la ve:**
  - Sin sesión: aviso «Inicia sesión para administrar» con el botón para ingresar.
  - Con sesión de otro rol: aviso de que es solo para administradores.
  - Administrador: el panel completo. El servidor lo exige igualmente (401 y 403); la pantalla solo lo explica.
- **Cómo se llega:** desde «Más», en la ficha de la cuenta, aparece «Administrar usuarios y empresas» solo para
  administradores.
- El historial queda firmado por la cuenta de quien administra; el último administrador no se puede degradar.
- Sigue valiendo lo de la sección 37: el rol aún no limita acciones en el resto de la app.
- Pruebas: 24 de navegador (una nueva: crea una empresa y un usuario y le cambia el rol; y `/administracion` entra en la
  revisión de páginas y de desborde en celular).

## 40. Activar y desactivar usuarios, y escaneo de accesibilidad permanente (30/10/2026)

- **Activar y desactivar usuarios** (`PUT /api/admin/users/{id}/active`, botón en `/administracion`):
  - Desactivar cierra sus sesiones y le impide pedir códigos.
  - No se puede desactivar a uno mismo ni al último administrador activo.
  - Queda en el historial. Bajarle el rol a un administrador ya inactivo ya no se bloquea por error.
- **`e2e/accesibilidad.spec.ts`:** `axe-core` (WCAG 2 A y AA) sobre todas las páginas, en claro y oscuro. Corre con la suite
  de navegador y se verificó también en celular. **Es la red de seguridad de la paleta.**
- **Lo que encontró en cuanto se corrió:** la paleta estilo Apple dejó tres colores del tema claro por debajo de 4,5:1 sobre
  sus tintes: el acento (4,44 en el ítem activo del menú), el rojo (4,25 en las insignias) y el naranja (4,12 en los
  resaltados de los documentos legales). Se oscurecieron lo mínimo y sin cambiar el tono:
  acento `#0066cc`→`#0064c8`, rojo `#cc0014`→`#c20013`, naranja `#c13200`→`#b52f00`. El tema oscuro pasó sin cambios.
- **Resultado:** 0 violaciones en 27 páginas × claro/oscuro × escritorio/celular. `DESIGN.md` actualizado.
- Pruebas: 14 de autenticación en la API; 2 nuevas de administración y 2 de accesibilidad en navegador.

## 41. Correos de la app: enlace de seguimiento al cliente y avisos al administrador (30/10/2026)

- **Enlace de seguimiento por correo:** en la ficha del envío, cada enlace tiene un botón «Enviar por correo». Manda al
  cliente el enlace (código, origen, destino y carga; **sin costos, sin cliente, sin datos internos**).
  - **Exige sesión de operador o administrador** (401 sin sesión, 403 para lectores): sin eso la API sería un
    reenviador de correo usando la cuenta del sistema.
  - **Tope de 5 correos por envío al día.**
  - **No guarda la dirección del cliente:** el historial lleva solo una versión enmascarada (`c***@empresa.com`).
  - Sin SMTP en el servidor responde que el correo no está configurado, y no envía nada.
  - `POST /api/shipments/{code}/tracking/{token}/email`.
- **Avisos al administrador (`ADMIN_EMAIL`)**, en segundo plano:
  - Resumen diario de SOAT, técnico-mecánicas y licencias por vencer (los mismos del aviso de ntfy).
  - Aviso inmediato cuando una entrega llega **con novedad**, con la novedad y el enlace al envío; sin el nombre ni la firma
    de quien recibió.
- **Módulo `engine/mail.py`:** SMTP con 10 s de tiempo máximo; los errores van al registro del servidor, no al navegador, y
  nunca se registra el cuerpo del correo ni la clave.
- **Pruebas:** 7 de la API (`test_correos.py`, con el envío simulado) y 1 de navegador. No se mandó ningún correo real
  desde las pruebas: la primera prueba real es del dueño.

## 42. Respaldo fuera del servidor, verificado y programado (30/10/2026)

- **El hueco:** los respaldos viven en el mismo VPS (14 copias), y la copia al PC dependía de que el dueño ejecutara un
  script a mano. Además, el respaldo no incluía el `.env`: un `.env` sobrescrito al pegar en `nano` dejó el servidor sin
  `DOMAIN` y sin copia a la cual volver.
- **`deploy/descargar-respaldos.ps1` reescrito:** descarga a un `.part`, y solo lo acepta si pasa tres pruebas: el gzip se lee
  completo con su tamaño final correcto, la base es SQLite, y la huella SHA-256 coincide con la del servidor. Lo dañado se
  descarta. Retención local de 30, registro en `descarga.log`, y código de salida 2 si el último respaldo del servidor es
  viejo.
- **Un fallo propio, encontrado probando:** la primera versión daba por sana una descarga **cortada**, porque el descompresor
  de .NET no se queja de un gzip truncado. Se comprobó con cuatro archivos dañados a propósito (cortado cerca del final,
  cortado al principio, bytes alterados, gzip que no es SQLite): los cuatro se detectan.
- **`deploy/programar-respaldo-local.ps1`:** registra la tarea diaria de Windows (13:00; si el PC estaba apagado, al
  encenderse). Sin permisos de administrador; `-Quitar` la elimina.
- **`backup.sh`:** guarda `env-FECHA.bak` con permisos 600 y conserva 14. El script del PC lo baja solo con `-IncluirEnv`.
- **`.gitattributes`:** `deploy/*.sh text eol=lf`, para que ningún script de bash vuelva a llegar al servidor con finales de
  línea de Windows.
- **Prueba de restauración:** el respaldo más reciente se descomprimió y abrió: integridad `ok`, 259 envíos, 60 vehículos,
  87 nodos y 148 enlaces. **Un respaldo que no se prueba restaurar no es un respaldo.**
- **Pendiente del dueño:** ejecutar `programar-respaldo-local.ps1` una vez. Y, como el cambio de `backup.sh` está en el
  repositorio pero no en el servidor hasta el próximo despliegue, la primera copia del `.env` aparecerá entonces.

## 43. Los avisos por correo al administrador se pueden apagar (30/10/2026)

- **Configuración → «Avisos por correo»:** un interruptor por tipo de aviso (resumen diario de vencimientos y entrega con
  novedad). Encendidos por defecto. Muestra la dirección del administrador enmascarada.
- **Solo un administrador con sesión puede cambiarlos** (`PUT /api/settings/mail-alerts`: 401 sin sesión, 403 con otro rol);
  sin sesión se ven pero no se tocan. Cada cambio queda en el historial, firmado.
- **Cada correo termina con** «Para dejar de recibir estos avisos: …/configuracion (sección Avisos por correo)».
- Los avisos de `ntfy` al celular son otro canal y no cambian. El código de ingreso no es un aviso: sigue llegando a quien
  lo pide.
- Pruebas: 8 de la API en `test_correos.py` (una nueva que cubre el apagado por tipo, el permiso y el pie del correo);
  la sección entra en el escaneo de accesibilidad. Los interruptores en sí no tienen prueba de navegador, porque ese entorno no
  tiene SMTP: se ve el estado «correo no configurado».

## 44. Historial con usuario real, reporte semanal, estado del servidor, orden de trabajo y finales de línea (30/10/2026)

- **Historial con usuario real:** con una sesión válida, todo lo que se escribe en el historial se firma con la **cuenta de la
  sesión**, aunque el navegador mande otro nombre (`common.SESSION_USER` + el middleware `session_identity`). Sin sesión, o con un
  token falso, el nombre sigue siendo declarado como siempre. La identidad no se arrastra de una petición a otra (probado).
- **Reporte operativo semanal por correo (opcional):** los lunes, el PDF de la última semana llega a `ADMIN_EMAIL`. **Apagado por
  defecto**; se enciende en Configuración › Avisos por correo. `mail.send_text` admite adjuntos.
- **Los avisos diarios ya no se repiten al reiniciar:** el resumen de vencimientos salía cada vez que el servidor arrancaba un día
  nuevo, y cada despliegue lo reinicia. `mail.once_today` recuerda en la base el último día de envío.
- **Estado del servidor dentro de la app** (Configuración, solo administradores; `GET /api/system/status`): disco, memoria y carga
  (las del equipo, en Linux), tamaño de la base y de los adjuntos, tiempo encendida y avisos cuando el disco pasa del 85 %, queda
  poca memoria o la carga es alta. Lo que vive fuera del contenedor (respaldos, otros contenedores) sigue en `deploy/estado.sh`.
- **Orden de trabajo en PDF** (`GET /api/fleet/maintenance/{id}/pdf`): vehículo, servicio, taller, la falla que lo origina y
  espacios para anotar lo hecho, los repuestos, el kilometraje y las firmas. Enlace en cada mantenimiento de la ficha del vehículo.
- **Foto de la entrega: no se construyó nada nuevo.** El cuadro de «Documentos adjuntos» ya acepta fotos (en el celular abre la
  cámara) y ya exige la declaración de autorización de las personas que aparezcan en ellas.
- **Finales de línea:** `dock.tsx`, `seed_data.py`, `layout.tsx` y el proxy de la API tenían todas sus líneas con `\r\r\n` desde el
  commit original. Se normalizaron a LF; el contenido no cambió (`git diff -w --ignore-cr-at-eol` queda vacío).

## 45. Los avisos van al buzón de Westvane (`NOTIFY_EMAIL`)
- Los avisos por correo (vencimientos, entregas con novedad, reporte semanal) ya no dependen de `ADMIN_EMAIL`: van a
  `NOTIFY_EMAIL` y, si no existe, a `ADMIN_EMAIL`. El ingreso con código sigue usando `ADMIN_EMAIL`, así que se puede entrar con
  el correo personal sin recibir avisos ahí. En el servidor basta agregar `NOTIFY_EMAIL=...` al `.env` y reiniciar `backend`.

## 46. Verificación automática del despliegue (`deploy/verificar.sh`)

- **Por qué:** después de cada despliegue yo comprobaba a mano, en distinto orden y a veces con menos pruebas. Un despliegue
  puede quedar «arriba» y aun así roto (el `.env` sin una variable, un contenedor sin la configuración nueva, una ruta
  devolviendo 500). Ahora hay un solo comando que hace siempre lo mismo y **falla en voz alta**.
- **Qué comprueba:** el `.env` (nombres de variables, repetidas y permisos 600, nunca los valores); los tres contenedores;
  ocho rutas públicas; que sin sesión no se administre ni se envíe correo; que el código de ingreso no viaje en la respuesta
  ni delate si un correo existe; los 404 de los enlaces públicos; el disco y la antigüedad del último respaldo.
- **Una comprobación que habría evitado un incidente:** si el `.env` tiene `SMTP_HOST` y la API responde que el correo no
  está configurado, falla. Es exactamente lo que pasó cuando el `.env` se sobrescribió: el sitio seguía en pie y el ingreso
  estaba muerto sin que nadie lo notara.
- **Dos modos:** `bash deploy/verificar.sh` en el servidor (todo) y `bash deploy/verificar.sh --url https://…` desde
  cualquier sitio (solo red). Sale con 0 o 1, así que sirve dentro de otros scripts.
- **Enganchado al despliegue automático:** `deploy.yml` corre el script completo en el servidor después de levantar la
  versión nueva (con `script_stop`, un fallo tumba el despliegue) y, al final, el modo `--url` desde el runner. Se agregó el
  `checkout`, que faltaba, porque el runner necesita el repositorio para tener el script.
- **Probado contra producción:** 30 comprobaciones en verde, en el servidor y desde el PC. Detectó la línea `NOTIFY_EMAIL`
  duplicada del `.env`, que se limpió (quedó una sola, permisos 600, las ocho claves presentes).
- Documentado en `docs/DESPLIEGUE_CONTABO.md` (sección 3) y en `AGENTS.md`.

## 47. Avisos al celular (ntfy) recuperados

- El tema de ntfy se perdió cuando el `.env` se sobrescribió, así que desde entonces una caída del sitio solo se avisaba por
  correo desde GitHub. Se generó uno nuevo (`westvane-avisos-` más 14 caracteres al azar), se agregó al `.env` del servidor con
  permisos 600 y se reinició `backend`.
- **Probado de punta a punta:** el aviso salió del contenedor y llegó a los servidores de ntfy (se comprobó leyendo el tema).
- **Detalle que hay que saber:** `notify.send` envía en un hilo aparte y devuelve `true` antes de que el envío termine. En la
  API (proceso vivo) funciona; en un proceso corto, como una prueba de una línea, el aviso se pierde al salir. Las pruebas lo
  simulan, así que no se notó antes.
- El nombre del tema **no se escribe en el repositorio**: solo vive en el `.env`. `deploy/healthcheck.sh` lo lee de allí en cada
  pasada, así que la vigilancia del sitio ya lo usa.

## 48. Ensayo de restauración de un respaldo (`deploy/probar-restauracion.sh`)

- **Por qué:** teníamos respaldos diarios, verificados al descargarlos, pero nunca se había probado **restaurar** uno con la app
  funcionando. Es la única prueba que dice si un respaldo sirve.
- **Qué hace:** toma el último respaldo (o el que se le indique), lo descomprime en una carpeta temporal, comprueba la
  integridad con SQLite, levanta una **API aparte** con esa base en `127.0.0.1:8099` —con las migraciones corriendo sobre la
  copia, no sobre producción— y verifica que responde, que el tablero «Hoy» funciona y cuántos envíos, vehículos y usuarios
  activos tiene. Al terminar borra el contenedor y la carpeta, salga bien o mal.
- **Resultado del primer ensayo:** integridad `ok`, la API arrancó, 395 envíos en el respaldo frente a 410 en producción en ese
  momento (el respaldo era de las 03:17 y la simulación había repuesto envíos), 60 vehículos y 1 usuario activo.
- **Un error mío corregido en el camino:** la primera versión contaba los envíos con `/api/shipments?limit=1`, que devuelve el
  número de elementos de la página (1), no el total. Ahora cuenta en la base restaurada y compara con producción.
- Documentado en `docs/DESPLIEGUE_CONTABO.md`, antes del procedimiento manual de restauración.

## 49. Robustez: avisos que no se pierden, plazo del historial y la lista que cortaba en silencio

- **Avisos al celular (ntfy):** `send()` responde antes de publicar, porque el envío va en un hilo aparte. En la API funciona
  (el proceso sigue vivo), pero en un proceso corto —una prueba, un comando suelto— el aviso se perdía aunque la función dijera
  que sí. Ahora los hilos pendientes se guardan y `drenar()` los espera al cerrar el proceso (`atexit`). Probado: el aviso sale
  después de `send` y antes de que el programa termine.
- **Plazo del historial:** `audit_log` crecía sin límite (una línea por cambio, para siempre). Con `AUDIT_RETENTION_DAYS` se
  conservan los últimos N días y se borra lo anterior en la tarea diaria; **por defecto 0 = para siempre**, que es lo seguro
  hasta que el dueño decida. Lo borrado se anota en el registro del servidor, no en el propio historial.
- **La lista de envíos cortaba en silencio:** la página pedía `/api/shipments` sin límite, y el valor por defecto es 300. Con 410
  envíos en producción, **se mostraban 300 y nada lo decía**. Ahora la API devuelve `total`, `limit`, `offset` y `truncated`, la
  página pide el máximo (1000) y, si hay más, la tabla avisa: «Se muestran los N más recientes de M».
- Pruebas: `tests/test_robustez.py` (4 nuevas), 295 de la API y 31 de navegador.

## 50. Pantalla de auditoría con filtros y foto en la prueba de entrega

- **`/auditoria`** (en «Más» y en `Ctrl K`): todo lo que cambió en la app, con quién, cuándo y qué. Filtros por **texto**
  (detalle o código), **usuario**, **acción**, **desde** y **hasta**; 50 por página con el total a la vista. Cada línea lleva
  la acción con su color (crear en verde, borrar o cerrar en rojo) y, si es de un envío, el código enlaza a su ficha.
  - La API (`/api/audit`) acepta `usuario`, `accion`, `desde`, `hasta`, `q`, `offset` y devuelve `total`; `/api/audit/facets`
    da los valores para los desplegables con cuántas líneas tiene cada uno.
  - El filtro por registro (`?record=CODE`) que usa la ficha del envío sigue igual.
  - Los filtros son un formulario normal (GET): la página se puede compartir por enlace y funciona sin JavaScript.
- **Foto de la entrega:** en la prueba de entrega hay un botón **«Tomar foto»** que, en el celular, abre la cámara
  (`capture="environment"`); en el escritorio deja elegir un archivo. Se sube como adjunto del envío, con la **misma
  declaración de autorización** de las personas que aparezcan (no deja subir sin marcarla) y el mismo límite de 10 MB.
- Pruebas: 297 de la API (2 nuevas de filtros y paginación del historial) y 33 de navegador (2 nuevas: auditoría y foto).

## 51. Avisar al cliente por correo cuando su envío cambia de estado

- **La dirección:** el envío guarda el nombre del cliente, no su correo. Se agregó **`client_email`** (esquema v14, aditivo),
  **opcional y por envío**: se pone en la ficha, en «Seguimiento para el cliente», y sin ella no se envía nada. Es un dato
  personal: se borra con `ATTACHMENT_RETENTION_DAYS` y al borrar el envío, y el historial guarda la dirección enmascarada
  (`c***@ejemplo.com`).
- **Qué se avisa:** tres cambios, ni uno más: **salió** (En Ruta), **se retrasó** y **llegó** (Entregado). Los estados
  intermedios (Transferencia Modal) no generan correo, para no llenar la bandeja. El correo lleva código, origen, destino y el
  enlace de seguimiento si hay uno activo; **nunca** costos, nombre del cliente, peso ni datos internos.
- **Cómo se dispara:** el estado de un envío se deriva del reloj, así que no hay un «evento» que escuchar. Cada pasada compara
  el estado de ahora con el último avisado (`last_notified_status`) y solo escribe cuando cambia. La pasada va dentro de la
  sincronización, con su propio límite de 5 minutos, y un fallo al avisar no tumba la sincronización.
- **API:** `PUT /api/shipments/{code}/client-email` con `{"email": "..."}` o `{"email": null}`; exige sesión de operador o
  administrador.
- **Privacidad:** el seguimiento público no muestra la dirección (una prueba lo verifica). **Pendiente para el abogado:** la
  política de privacidad debe mencionar que se guardan correos de clientes y su plazo.
- Pruebas: 303 de la API (6 nuevas) y 34 de navegador (1 nueva).

## 52. Índices, auditoría en CSV y prueba de carga contra producción

- **Índices (esquema v15, aditivos):** el historial se ordena y se filtra por fecha, persona y registro; la lista de envíos
  ordena por salida y filtra por estado; los avisos al cliente solo miran los envíos con correo. Sin índices, cada filtro
  recorría la tabla entera. Con 400 envíos no se nota; con miles, sí.
- **Auditoría en CSV:** botón «Descargar CSV» en `/auditoria`, con **los filtros puestos** (hasta 1000 líneas). Separador `;` y
  BOM de UTF-8 para que Excel abra bien las tildes; el detalle con `;` va entre comillas.
- **`deploy/verificar.sh`** comprueba también `/auditoria` y `/api/audit`.
- **Prueba de carga contra producción** (`deploy/prueba-carga.py`, 8 personas, 30 s, solo lecturas):
  - páginas: 96 peticiones, 0 errores, mediana 1.036 ms, p95 2.141 ms, peor 2.209 ms;
  - API: 96 peticiones, 0 errores, mediana 430 ms, p95 640 ms, peor 666 ms;
  - 6,4 peticiones por segundo.
  - En local, la misma prueba daba páginas p95 641 ms y API p95 89 ms: la diferencia es la red y la CPU del VPS, no un error.
    **Lo lento son las páginas** (renderizado en el servidor), no la API. Si algún día molesta, lo primero es medir cuál tarda.
- Pruebas: 305 de la API (2 nuevas) y 34 de navegador.

## 53. Dónde está el peso: desglose de la prueba de carga, filtro por tabla y retención a la vista

- **`deploy/prueba-carga.py` dice ahora qué ruta es la lenta** (las tres peores, por mediana). Contra producción, 8 personas y
  30 s, solo lecturas:
  - `/` 1.665 ms · `/envios` 1.348 ms · `/flota` 1.185 ms (medianas); 0 errores.
  - La API, al mismo tiempo: mediana 710 ms, p95 937 ms.
  - **Conclusión:** el peso está en las **páginas** (renderizado en el servidor), no en la red ni en la base.
- **Por qué la lista tarda:** la API arma cada envío leyendo y **parseando el recorrido completo** (`route_json`) de los 1000
  que pide la página. No manda el trazado al navegador (eso solo va en la ficha), pero el trabajo de leerlo y parsearlo se paga
  igual. **Siguiente paso, si algún día molesta:** guardar en columnas el modo y el vehículo actuales (lo que la lista usa) para
  no tener que abrir el recorrido en cada petición, o paginar del lado del servidor. No se hizo ahora porque es un cambio de
  esquema con riesgo y hoy la app la usan una o dos personas.
- **Auditoría:** filtro por **tabla** además de usuario, acción y fechas.
- **Estado del servidor:** muestra cuántas líneas tiene el historial y si tiene plazo (`AUDIT_RETENTION_DAYS`) o no.
- Pruebas: 305 de la API y 34 de navegador.

## 54. Respaldo vigilado, tablas en Excel, avisos mensuales, sin conexión y revisión de seguridad

- **Respaldo vigilado.** `deploy/backup.sh` deja al final `backend/data/.ultimo-respaldo` (hora, tamaños, copias). La app lo lee:
  *Configuración › Estado del servidor* muestra «Último respaldo: hace N h» y avisa si pasan **36 h**. Una vez al día, mientras siga
  atrasado, sale un correo (tipo de aviso `respaldo`, apagable) y un aviso al celular (ntfy). Si el script falla, también avisa por
  ntfy. En producción, no tener marca cuenta como problema. Prueba: `test_respaldo_atrasado_avisa_una_vez_al_dia`.
- **Plazo del historial:** `AUDIT_RETENTION_DAYS=730` puesto en el `.env` del servidor (el mecanismo ya existía; por defecto era 0 =
  para siempre).
- **Flota, conductores e inventario en Excel** (`engine/tables_io.py`, `/api/tables/{vehiculos|conductores|inventario}/…`):
  exportar a `.xlsx` con los mismos encabezados que acepta la carga, plantilla y **carga masiva en dos pasos** (vista previa sin
  guardar y luego crear solo las válidas, con la misma función del formulario). Los conductores exigen la declaración de
  autorización (datos personales). Botones «Excel» y «Cargar» en Flota, Conductores y Bodegas (`components/ui/table-io.tsx`).
  Pruebas: `backend/tests/test_tablas.py`, `frontend/e2e/tablas.spec.ts`.
- **Placa duplicada que se colaba:** la base trae placas con mayúsculas y minúsculas mezcladas y `UPPER`/`LOWER` de SQLite solo
  entienden ASCII, así que `create_vehicle` dejaba crear «CONVOY MAGDALENA 02» junto a «Convoy Magdalena 02». Ahora `fleet.code_taken`
  compara en Python. Lo mismo para los nombres de conductor al cargar.
- **Reporte mensual** (tipo de aviso `mensual`, apagado por defecto): el día 1, PDF de los últimos 30 días al buzón de avisos.
- **Seguridad (revisión):**
  - **Fórmulas en Excel/CSV:** un texto que empieza con `= + - @` se ejecuta al abrir el archivo (nombre, nota o navegador
    declarado con `=HYPERLINK(...)`). `common.safe_cell` antepone un apóstrofo; se aplica al Excel de envíos, a los de flota/bodegas,
    al CSV de auditoría, de peajes y de aceptaciones.
  - **Enumeración de cuentas:** pedir un segundo código antes del minuto respondía error solo para correos con cuenta. Ahora
    responde igual que para uno sin cuenta (y no crea otro código).
  - **Next.js 16.4.3 → 16.4.6** (`npm audit` marcaba siete avisos moderados, entre ellos fugas de caché entre usuarios); queda en 0.
- **Sin conexión (prudente):** `public/sw.js` solo guarda estáticos con huella (`/_next/static/`, íconos) y la página
  `/offline.html`; **nunca** la API ni páginas con datos (equipos compartidos). Un aviso «Sin conexión» (transform y opacity)
  aparece al perder la red. **No** hay cola de firmas sin conexión: se descartó a propósito (una entrega firmada que no llegó al
  servidor sin que nadie lo note es peor que no poder firmar).
- **No se hizo, con motivo:**
  - *Peajes iniciales:* sin tarifa oficial por tramo, cualquier cifra sería inventada y entraría en cotizaciones. Siguen en 0 salvo
    la estimación ya rotulada de la Vía al Llano.
  - *Rendimiento de listas:* medido 0,7 ms por envío (40 envíos = 27 ms); con la base real (decenas de envíos) no pesa. Reabrir al
    pasar de unos 500.
  - *Búsqueda global:* ya existía (Ctrl K, con envíos, ciudades, vehículos, bodegas y vías). *Límite de intentos del código:* ya
    existía (5 por código, 1 código por minuto).

## 55. Cierre del pulido: prueba del aviso sin conexión, verificación más estricta y lista de pendientes al día

- **Verificación de todo el lote del 19 de noviembre:** 315 pruebas de la API y 37 de navegador, en verde. `tsc`, `eslint` y
  build limpios.
- **Aviso «sin conexión» intermitente en las pruebas:** fallaba 1 de cada varias corridas porque el corte de red llegaba antes de
  que la página terminara de hidratar, y el evento se perdía. Se corrigió en los dos lados:
  - el componente también relee el estado al volver a la pestaña (`focus` y `visibilitychange`), que además cubre el caso real de
    un portátil que se durmió;
  - la prueba espera a que la app esté hidratada antes de cortar la red.
- **`deploy/verificar.sh` más estricto:** comprueba también el Excel de vehículos, la plantilla de conductores, `/api/tolls`,
  `/offline.html` y **la marca del último respaldo** (`.ultimo-respaldo`), que es lo que vigila la app. 34 comprobaciones, todas
  en verde contra producción.
- **`AGENTS.md`:** la lista de pendientes decía que faltaban cosas ya hechas (roles, avisos, auditoría). Reescrita: lo hecho, lo
  que espera datos del dueño y lo que hay que vigilar.
- Pruebas: 315 de la API y 37 de navegador.

### Despliegue del cierre y aligerado de la lista

- **Desplegado** (`0872674`) con respaldo previo y las **34 comprobaciones** de `verificar.sh` en verde.
- **Pase visual** de Flota, Conductores, Bodegas y Configuración en claro y oscuro, escritorio y celular: coherente, sin
  desbordes. Se corrigió una inconsistencia que había introducido yo: las fechas de `/auditoria` salían en ISO y ahora van en
  formato español, como el resto.
- **La lista de envíos pesaba de más:** al mostrar los 427 envíos (antes cortaba en 300) la respuesta llegó a **763 KB**. Se
  encontró que cada envío llevaba `vehicles` (el resumen de los vehículos de **todos** los tramos), que **ninguna pantalla de
  lista usa**: solo la ficha. Ahora va solo en el detalle: la respuesta baja un **20 %** (medido: 45,8 KB → 36,7 KB en la base
  de prueba).
- **Prueba de carga después del despliegue** (8 personas, 30 s): páginas mediana 822 ms y p95 3.012 ms; API mediana 406 ms y p95
  515 ms; 0 errores. `/envios` sigue siendo la más lenta (1,7 s de mediana) por el tamaño de la tabla; el aligerado baja el
  peso, y si el domingo hace falta más, el siguiente paso es paginar del lado del servidor.

## 56. Lavado de cara (primera ronda): pie, títulos, nota del mapa y prueba de «sin conexión» sin falsos

Inspección medida del bloque Resumen + Envíos + ficha (escala tipográfica analizada en el DOM renderizado, spacing,
objetivos táctiles, desbordes, jerarquía de encabezados — en escritorio y celular), bajo las reglas de la skill impeccable
(modo «operar», refinamiento). Correcciones:

- **Objetivos táctiles del pie (celular):** los enlaces legales (Metodología, Créditos, Términos, Privacidad, Cookies) medían
  **16 px de alto**; el mínimo es 44. Ahora hacen 44 px solo en pantallas táctiles (`pointer-coarse:min-h-11`), sin tocar el
  escritorio. Verificado midiendo el DOM: de 5 deficientes a **cero**.
- **Títulos de tarjeta a tres estilos:** Resumen usaba 15 px/600, la ficha 14 px/500 y «Hoy» 14 px/600 — la misma función, tres
  estilos. Unificados a **14 px/600** (`text-sm font-semibold`): `CollapsiblePanel`, `Bento` y «Requiere atención». Confirmado
  midiendo: los H2 de las tres superficies salen a 14 px/600 en claro y oscuro.
- **Nota del mapa:** «Trazado aproximado» estaba a 11 px, fuera de la escala; pasa a 12 px.
- **Enlace «Envíos» de regreso (ficha):** 16 px de alto en el celular; ahora 44 con `pointer-coarse:min-h-11`.
- **Prueba de «sin conexión»: los falsos positivos tenían dueño.** Localizaba por rol (
  `getByRole("status").filter(/Sin conexión/)`) y hay **dos** regiones `role=status` que dicen «Sin conexión»: el aviso y el
  punto del dock (que anuncia lo mismo cuando la API falla, para lectores de pantalla). Con dos coincidencias el localizador se
  volvía ambiguo según el momento en que el punto cambiara de texto. Ahora la prueba usa el texto completo del aviso, único, y
  despacha un `focus` tras cortar la red (como despertar la pestaña, que además es la red de seguridad real del componente).
  **6 de 6 en verde.** Los fallos intermedios eran de mi entorno de depuración (un web sin conexión a la API respondía 502), no
  del producto.
- Con el encabezado de Envíos ya pegajoso y las capturas de antes/después tomadas (claro/oscuro × escritorio/celular), la
  superficie superior está bajo un solo estándar tipográfico.

## 57. Lavado de cara (segunda ronda): flota, dock móvil, título de Red y auditoría

Mismo método que la sección 56 (inspección medida del DOM), sobre Hoy, Flota, Auditoría y Red:

- **Flota:** las etiquetas del medidor de mantenimiento compacto y el rótulo «Próximo mantenimiento» estaban a **11 px** —
  unos 60 elementos por pantalla. Pasan a 12 px (`text-xs`), el mínimo de la escala.
- **Dock móvil:** las etiquetas de la navegación primaria (Resumen, Envíos, Red, Flota, Más) también estaban a **11 px**;
  pasan a 12.
- **Título de `/red`:** era el único texto a peso **700** de toda la app (la escala es 600). El tamaño de 20 px se conserva a
  propósito: es una etiqueta flotante sobre el mapa, no un título de página normal.
- **Auditoría:** «Descargar CSV» medía 16 px de alto en el celular; pasa a 44 px en pantallas táctiles.
- **Confirmado midiendo:** en el celular, cero textos por debajo de 12 px y cero objetivos táctiles deficientes; en escritorio
  queda solo el chip «Ctrl K» del dock, que es una pista de teclado deliberada.
- **Se dejan como están:** los enlaces de crédito de OpenFreeMap/OpenStreetMap sobre el mapa (los pone la librería, son
  diminutos por convención y son su atribución requerida) y el kbd de «Ctrl K».
- Pruebas: 37 de navegador en entorno limpio (repertorio completo).

## 58. Presentación comercial en `/`, logo W, solicitudes de demostración y un arreglo de seguridad en la caché

- **Objetivo nuevo (PRODUCT.md):** venderlo a operadores logísticos (3PL) para que una empresa lo adopte. `/` es ahora una
  **presentación pública** y la app pasó a **`/panel`** (dock, búsqueda, atajos `g d`, avisos, 404 y el ícono instalado apuntan
  ahí). Las páginas públicas (`/` y `/seguimiento`) no tienen dock, bienvenida ni atajos de teclado.
- **Estructura elegida por el dueño: «Colombia como página»** (contrato en `.impeccable/surfaces/frontend-src-app-page-tsx.md`).
  El mapa real de la red (`NetworkPreview`, el mismo del resumen) queda fijo mientras se baja por cinco capítulos, uno por modo;
  cada capítulo resalta su modo en el mapa (solo opacidad, sin reloj de animación) y la franja de modos con sus kilómetros
  reales hace lo mismo a mano. Siguen: **ruta en vivo** con el motor real (Bogotá → Leticia por costo: camión + barcaza), módulos
  en filas, seguridad, preguntas, formulario de demostración y pie. Todo lo que afirma es verdad hoy: no hay clientes, precios ni
  métricas inventadas, y se dice que los envíos de la app son de ejemplo.
- **Logo:** la **W trazada como ruta** (origen, transbordo, destino) en el azul de los botones. `components/brand/logo.tsx`,
  `app/icon.svg`, favicon, íconos de instalación (con versión adaptable para Android, `icon-maskable-512.png`), apple-icon y el
  encabezado de todos los PDF (dibujado en vectores con reportlab). Los PNG salen de `frontend/scripts/brand-assets.mjs`
  (`BRAND_CHANNEL=msedge node scripts/brand-assets.mjs`) y el `.ico` con Pillow.
- **Solicitudes de demostración** (`schema_v16`, `engine/demo.py`, `/api/demo-requests`): validación, campo trampa para robots,
  tope de 5 por conexión al día, texto exacto de la autorización y resumen de IP (no la IP). Avisan al buzón (`NOTIFY_EMAIL`,
  tipo de aviso «demos», apagable). A quien la envía no se le escribe (sería un relevo de spam). Solo un administrador las ve,
  las marca atendidas o las borra, en **Administración › Solicitudes de demostración**.
- **Seguridad, caché de lecturas (ya existía el problema):** la caché guardaba por ruta sin mirar quién pedía. Durante 5 s, lo
  que un administrador leía (`/api/admin/users` con correos, `/api/auth/me`) se le podía servir a cualquiera que pidiera la misma
  ruta. Ahora lo pedido con sesión no se guarda ni se sirve de la caché, y cuentas, administración, estado, consentimientos y
  solicitudes no entran nunca. Prueba: `test_la_cache_nunca_comparte_respuestas_con_sesion`.
- **Dock más limpio:** moneda y apariencia pasan al menú «Más» de escritorio (como ya estaban en la hoja «Más» del celular).
- **Arreglos de paso:** clave duplicada en el mapa cuando un mismo buque lleva dos envíos; nombre accesible de los campos
  opcionales del formulario.
- Pruebas nuevas: `backend/tests/test_demos.py` (13) y `frontend/e2e/presentacion.spec.ts` (3); las pruebas de navegador que
  entraban a `/` esperando la app ahora entran a `/panel`.

## 59. Datos personales solo para administradores, portada que no se cae y revisión final de la presentación

- **Rutas que entregaban datos personales a cualquiera** (comprobado en producción): `/api/consents/export` (registro de
  aceptaciones con nombres y navegadores), `/api/audit/export.csv` (historial) y `/api/client-errors` (errores con página y
  navegador). Ahora exigen sesión de administrador (401/403 con el motivo). La descarga CSV de Auditoría pasó de enlace a
  botón (un enlace no lleva la sesión) y Configuración no pide la lista de errores sin sesión de administrador.
  `deploy/verificar.sh` comprueba las tres y `/api/demo-requests`. Prueba:
  `test_exportaciones_con_datos_personales_solo_para_administradores`; utilidad `admin_headers()` en `tests/conftest.py`.
- **Dependencias de Python:** `pip-audit` sobre las 31 versiones exactas del contenedor de producción: sin vulnerabilidades
  conocidas.
- **La portada no cae entera si falla una lectura:** cada lectura de la API es opcional; sin la red, sale el titular con las
  acciones y un aviso en lugar del mapa; sin ciudades, se omite la ruta en vivo; sin el formulario, un aviso.
- **Revisión final de diseño (revisor independiente, dos pasadas):** módulos rehechos como filas por tarea (planear, mover,
  entregar, controlar) en lugar de tarjetas; un solo borde izquierdo en toda la página; rótulos anclados en los corredores
  cerrados (13 px reales, medidos con la escala del mapa); textos honestos («corredores cerrados», «vehículos de ejemplo»,
  sin «hoy»); arcos aéreos ya no se recortan arriba (mínimo exacto de la curva); tramos de la ruta en una lista legible;
  alternativas iguales unidas («Más rápido y balanceado»); campos con relleno y 16 px; franja de modos apilada en celular.
  Las adaptaciones al contrato quedaron escritas en `.impeccable/surfaces/frontend-src-app-page-tsx.md`.
- Pruebas: 329 de la API y 40 de navegador.

## 60. Pulido de la app: mapa sin restos de la paleta vieja, ficha del envío en celular y textos al día

Recorrido con capturas de escritorio (1440) y celular (390) de resumen, envíos, ficha del envío, flota, ficha de vehículo,
red, hoy, bodegas, vías, configuración, historial y huella, sobre el build de producción. Lo que se corrigió:

- **Mapa 3D (`Map3D.tsx`):** quedaban colores de la paleta anterior al cambio a Apple (cian en departamentos, nodos CEDI y
  vuelos; violeta, ámbar y rosa sueltos). Departamentos en un solo tono del acento por intensidad (como el mapa por
  departamento), relieve más bajo y, con una ruta (ficha del envío), planos y tenues; tren con su color de modo, vuelos en el
  color aéreo, cierres en el rojo de peligro y transbordos en el naranja, cada uno con variante clara y oscura.
- **Nombres de ciudades en el mapa:** ya no se montan unos sobre otros (`CollisionFilterExtension` de deck.gl, con prioridad
  por tipo de nodo: CEDI, puerto, aeropuerto…). Tinta del tema con halo del fondo (antes, texto claro con borde negro pensado
  para un mapa oscuro). Solo se recalcula al mover el mapa.
- **Ficha del envío en celular:** las cifras no se parten («US$» / «53.193»: la celda es contenedor y la cifra escala con su
  ancho, `clamp` en `cqw`); la cadena de tramos cabe con dos o tres tramos (mínimo de 112 px por tramo en pantallas
  pequeñas); Imprimir, Remesa, Duplicar y Borrar quedan en ícono en el celular (el nombre sigue para lectores de pantalla) y
  las acciones caben en una fila.
- **Lista de envíos:** las placas propias usaban `text-accent`, clase que no existe en el tema: ahora son el enlace azul a su
  ficha; las de terceros, misma letra y «· tercero» escrito (antes solo se distinguían por el color).
- **Texto de 10–11 px → 12 px** en calendario, comparar rutas, atención del resumen, adjuntos, bitácora, ficha y menú de
  cuenta. Se dejan compactos a propósito: pistas de teclado, número de la campana y etiqueta flotante de las gráficas.
- **Textos al día:** Vías, Metodología y Configuración decían «no hay autenticación»; ahora explican que cada cambio se firma
  con la cuenta de la sesión o, sin ella, con el nombre declarado. El texto de la bienvenida no se tocó: es legal y versionado.
- Pruebas: 40 de navegador (incluida accesibilidad en claro y oscuro); el backend no cambió.

## 61. Pulido de las demás pantallas: seguimiento, auditoría, cotización y calendario

Recorrido de calendario, clientes, comparar, combustible, huella, auditoría, administración, cotización, nuevo envío, ficha de
bodega, seguimiento público y configuración, en escritorio y celular. Lo que se corrigió:

- **Seguimiento público (lo ve el cliente final):** decía «en curso» en el primer tramo de un envío aún «Programado» con avance
  0 % (comparaba con `>=` y el primer tramo empieza en 0). Ahora queda «pendiente» hasta que sale. Lleva la marca arriba en vez
  de una etiqueta en mayúsculas sobre el código.
- **Auditoría:** acciones y tablas en español («Creación», «Enlace creado», «Envíos»…) en las insignias y en los filtros, en vez
  de los códigos de la base (INSERT, mm_shipments). Los nombres viven en `lib/audit-labels.ts` y Configuración usa los mismos.
- **Cotización:** el documento para el cliente lleva el logo en lugar del texto «Westvane TMS».
- **Calendario en celular:** el retraso ya no se parte en dos líneas.
- Sin cambios necesarios: clientes, comparar, combustible, huella, nuevo envío, ficha de bodega y administración.
- Pruebas: 40 de navegador; el backend no cambió.

## 62. Más movimiento en toda la app (solo transform y opacidad)

- **Listas (`list-in`, CSS puro):** las filas entran en cascada corta (30 ms por fila, tope 360 ms) en resumen («Requiere
  atención»), hoy, lista de envíos, flota, fallas, mantenimientos, vías, clientes, auditoría, solicitudes de demostración y en
  todas las franjas de cifras.
- **Presentación:** al cargar, la red se enciende modo por modo (carretera, río, mar, aire, tren; 150 ms entre modos) y los
  nodos llegan al final; solo opacidad y una vez, así que el mapa queda quieto en reposo. Módulos, seguridad, preguntas y el
  formulario entran al aparecer en pantalla. En la ruta en vivo, los tramos crecen de izquierda a derecha con cada resultado.
- Todo se apaga con «reducir movimiento». Pruebas: 40 de navegador (incluida accesibilidad).

## 63. Enlace que se ve bien al compartirlo, buscadores listos y página de «no encontrado»

- **Imagen al compartir (WhatsApp, LinkedIn, correo):** `app/opengraph-image.png` nueva, con la marca W, el titular y los
  kilómetros reales por modo; se genera con `frontend/scripts/og-image.mjs` (`BRAND_CHANNEL=msedge node scripts/og-image.mjs`).
  La presentación declara su título y descripción para Open Graph y tarjeta grande para X/Twitter.
- **Buscadores:** siguen sin indexar nada (decisión pendiente del dueño). Con `ALLOW_INDEXING=1`, `robots.ts` deja indexar solo
  la presentación y lo legal (la app y el seguimiento quedan fuera) y hay `sitemap.xml`.
- **404:** con la marca y tres salidas (resumen, envíos, presentación).
- **Tema oscuro de la presentación:** revisado (mapa, rótulos de cierre, ruta en vivo); sin cambios necesarios.
- Pruebas: 40 de navegador.

## 64. Red con los controles en su lugar y cifras que cuentan en toda la app

- **Red:** había piezas flotando en cuatro lugares (título y simulador a la izquierda, dos barras arriba a la derecha y la
  leyenda abajo); parecía un error de ubicación. Ahora el título va junto al selector Mapa/Datos arriba a la izquierda, y la
  leyenda es también el control: cada modo se enciende o apaga tocando su línea (muestra, ícono y nombre; en pantallas
  medianas solo línea e ícono, con el nombre en la ayuda), y al lado van Departamentos, Flota, Animación y pantalla completa,
  en una sola barra abajo a la derecha. Arriba a la derecha el mapa queda libre. En celular sigue el botón «Capas».
- **Cifras que cuentan en todas las franjas:** si la cifra tiene un solo número («US$ 53.193», «90 %», «12.628 km») cuenta
  desde 0 al aparecer, como el resumen; con varios números o fechas se muestra tal cual.
- Pruebas: 40 de navegador.

## 65. Lecturas más rápidas en la API (mapa, resumen, alertas y «Hoy»)

- **Departamentos del mapa (`/api/geo/departments`):** recalculaba qué departamentos cruza cada ruta en cada consulta
  (~250–320 ms en Contabo). Ahora se recuerda por el texto de la ruta (`geo._departments_of`, una ruta nueva o cambiada
  se calcula de nuevo sola): 703 → 19 ms en local.
- **Tablas de la flota recordadas (`fleet._ctx`):** vehículos, conductores, fallas, mantenimientos y asignaciones se leían
  completas en el resumen, las alertas (que pide el dock en todas las páginas) y «Hoy». Ahora se guardan mientras la base no
  cambie: la clave es `db.data_version()`, que cambia con cada escritura confirmada en este proceso (contador en
  `db_cursor`) o en otro (fecha y tamaño de la base y de su diario WAL). Nunca sirve datos viejos; quien las use no las
  modifica (se derivan diccionarios nuevos).
- **Lecturas sin pandas (`db.fetch_all`):** las 46 lecturas que pasaban por pandas solo para volver a diccionarios ahora
  leen directo de SQLite. Los enteros llegan como enteros (antes un campo con vacíos llegaba como 3.0).
- **Resultado en local (consulta repetida, sin la memoria de 5 s):** resumen ~150 → 70 ms, alertas ~150 → 62 ms, «Hoy» →
  40 ms. Pruebas nuevas en `tests/test_memoria_lecturas.py` (una escritura invalida lo recordado; los departamentos
  recordados son los mismos que los calculados).

## 66. Ingreso a la app con usuario o correo y contraseña

- **Pedido del dueño:** al pasar de la presentación a la app, pedir ingreso; algo simple (usuario o correo + contraseña)
  para darle a un profesor una cuenta de administrador con la que pueda probar todo. Reemplaza la regla anterior de «no
  agregar contraseña».
- **Pantalla `/ingresar`:** usuario o correo y contraseña (con «mostrar contraseña»); quien tiene cuenta solo con correo
  pide el código como antes. Al entrar vuelve a la página que quería abrir (`next`, solo rutas de la app). Cerrar sesión
  lleva de vuelta a `/ingresar`.
- **La app pide sesión (`src/proxy.ts`):** las páginas de la app exigen la cookie `westvane_session` (el mismo token de la
  sesión, la escribe `lib/auth.ts`) y la validan contra `/api/auth/me`, recordando cada token válido un minuto. Siguen
  abiertas la presentación, el seguimiento para clientes, lo legal, `/metodologia` y `/creditos`. Las sesiones abiertas
  antes con código pasan solas a la cookie. La API no cambió: sigue respondiendo sin sesión (pendiente: roles reales).
- **Contraseñas (`auth_otp.login_password`):** PBKDF2-SHA256 con 310.000 vueltas y el prefijo `pbkdf2$` en las columnas
  que ya existían; el relleno de las cuentas por correo nunca coincide. Mismo mensaje si la cuenta no existe o la clave no
  coincide. Cinco fallos seguidos bloquean la contraseña de esa cuenta 15 minutos (`schema_v17`: `failed_logins`,
  `locked_until`). Las cuentas sin correo ni empresa ya no rompen el JSON (lecturas con `fetch_all`).
- **Crear o cambiar una cuenta:** solo en el servidor, con la contraseña por la entrada estándar:
  `docker exec -i westvane-api python -m app.crear_acceso --usuario profesor --nombre "Profesor" --rol admin < clave.txt`
  (o `--generar`). Cambiar la contraseña cierra las sesiones abiertas de esa cuenta.
- **Pruebas:** con `WESTVANE_DEV_OTP=1` existe la cuenta `pruebas` (lector, contraseña conocida de pruebas); el fixture
  del navegador entra con ella. Nuevas: `tests/test_acceso_contrasena.py` y `e2e/ingreso.spec.ts`.
- **Cuenta del profesor:** `profesor`, administrador, creada en Contabo. La contraseña no va en git ni en el chat: el
  dueño la tiene en `backend/data/acceso-profesor.txt` (ignorado por git) en su PC.

## 67. Ronda 1 de mejoras en paralelo: índices, limpieza de sesiones, peticiones lentas y esqueletos de carga

Primera ronda trabajada con subagentes en paralelo (modelo DeepSeek V4.1 Flash 1017) y un revisor; el coordinador corrió toda la verificación y hizo los commits.

- **Cambiar mi contraseña** (cerrado antes de la ronda): `POST /api/auth/password/change`, formulario en Configuración. Se arregló
  que el proxy de Next no reenviaba la cookie de sesión y que la e2e terminaba antes de restaurar la clave de pruebas.
- **B1 índices (schema_v18, aditivo):** `mm_shipments(status, departure_at DESC)`, `audit_log(table_name, audit_id, action, record_id)`,
  `user_sessions(user_id)` y `auth_codes(email, code_id)`. En una base de 5.000 envíos y 60.000 líneas de historial: lista filtrada
  por estado 1,0 -> 0,3 ms; consecutivo al crear un envío 12,8 -> 4,5 ms; escrituras ~14 % más lentas (1,7 µs por fila).
  Ya existía un índice duplicado de estado (`idx_mm_shipments_status` de v3 e `idx_ship_status` de v15): no se borró por ser migración
  solo aditiva; queda a decidir. El orden por defecto de la lista (CASE de estados) no lo sirve ningún índice.
- **B2 limpieza:** `auth_otp.purge_expired_auth` borra sesiones vencidas y códigos usados o vencidos hace más de 7 días, en la pasada diaria
  (con prueba de que el enganche existe).
- **B3 peticiones lentas:** WARNING `westvane.lento` en toda petición `/api` de más de 1 s (`WESTVANE_SLOW_MS`, 0 la apaga); la ruta va
  sin query string y con marcadores en lugar de códigos, ids, correos y tokens.
- **F1 esqueletos:** `loading.tsx` en envíos, ficha, flota, bodegas, red, auditoría y hoy, y en las subrutas de formulario y ficha
  (si no, el del padre se pintaba también en `nuevo` y `editar`). Piezas en `components/skeletons.tsx`.
- **Revisión:** la prueba de B1 prometía más de lo que el índice da (se corrigió el texto), la de B2 dependía del orden (corregida) y
  se añadió la comprobación del enganche. Pendiente: las páginas tienen su propio `Suspense`, así que puede verse el esqueleto nuevo y
  luego el genérico; unificarlos exige tocar cada `page.tsx`. Sin e2e para los esqueletos.
- **Verificación:** tsc, eslint y build limpios; 373 pruebas de la API; 45 de navegador.

## 68. Ronda 2: menos pandas, límites en las entradas, cuenta en el dock y peso de las páginas

- **B4 menos pandas:** 20 lecturas de `operations`, `telemetry`, `history` y `report` pasaron a `fetch_all`; la salida es idéntica byte a byte
  (foto de 575 KB). Medido (mediana de 15): historial de trayectos 8,0 -> 3,7 ms, flota en vivo 6,5 -> 2,5 ms, auditoría 6,0 -> 2,2 ms,
  vías 15,0 -> 4,3 ms, reporte PDF 37,9 -> 28,1 ms. `trends.py` no tiene SQL propio. Queda `common.purge_old_audit` con `run_query` (un COUNT).
- **B5 límites de entrada:** 22 modelos y 39 parámetros de consulta con tope (texto 200, notas 2000, códigos 60, correos 254, listas
  y rangos de `limit`/`offset`/`days`). Antes un `cargo` de 10.000 caracteres se truncaba en silencio y `limit=1e12` se recortaba; ahora
  dan 422. Ajustes tras la revisión: exportar admite 1000 códigos (la lista pide hasta 1000), `delay_h` lo valida el motor con su mensaje en
  español, los buscadores limitan a 200 caracteres y la ficha tolera que la auditoría falle. Ojo: los 422 de `days` en historial e
  informe ya no traen el texto en español propio (solo se alcanzan con URLs a mano). Las rutas (`{code}`, `{token}`) siguen sin tope.
- **F3 cuenta en el dock:** con sesión, avatar y (desde 1280 px) nombre y rol; menú con «Cerrar sesión»; en celular, en la hoja «Más».
  Sin sesión no cambia. Sin e2e del cierre de sesión en celular.
- **F4 peso de las páginas (sin cambios de código):** deck.gl y MapLibre ya se cargan por `dynamic` y solo en `/red`, `/panel` (vista 3D) y
  `/envios/[code]`; ningún HTML de las otras 33 rutas los menciona. El mapa pesa ~550 KB gzip, solo bajo demanda. JS inicial (gzip):
  `/envios/[code]` 298 KB, `/envios` 296, `/red` 286, `/panel` 285, `/flota` 281, `/bodegas` 280; el resto 264-279; base compartida de
  todas las rutas 171 KB (React 70, dock/framer 39). Oportunidad pendiente: `import-shipments` (22 KB gzip) se carga siempre en `/envios`
  aunque solo se ve al abrir «Importar»; hacerlo dinámico lo recortaría. Aquí `/` no usa deck.gl (usa un SVG).
- **Verificación:** tsc, eslint y build limpios; 446 pruebas de la API; 46 de navegador.

## 69. Ronda 3: saltar al contenido, pruebas estables, mantenimiento y cobertura

- **F2 «Saltar al contenido»:** enlace oculto que aparece con el primer Tab y lleva al <main> (ahora el único id="contenido";
  se quitaron los ids repetidos de la portada y de /ingresar). En /ingresar el campo de usuario tiene autofoco, así que allí el
  enlace se alcanza con Shift+Tab (limitación conocida, aceptada). e2e nueva con teclado.
- **F5 pruebas estables:** la foto de entrega lleva un nombre único por corrida y su aseo no puede enmascarar fallos de aserción
  ni borrar adjuntos de otra corrida; el enlace de seguimiento comprueba su creación y siempre limpia. La suite se corrió DOS veces
  seguidas sin borrar la base de pruebas y pasó las dos (47 y 47).
- **B6 mantenimiento:** init_db imprime la versión real («esquema v18», decía v4) derivada de una sola lista MIGRACIONES (el
  reordenamiento de la v4 tras el bloque v5 es inocuo: tocan tablas distintas; verificado); 1 import sin uso menos (pyflakes
  limpio en engine y api); httpx2 en requirements-dev elimina la advertencia de starlette.testclient (0 warnings en la suite).
  Prueba que avisa si aparece un schema_vNN.py sin enganchar en init_db.
- **B7 cobertura (total 84 %):** pruebas nuevas para fx.py (la TRM oficial: 55 -> 100 %), tolls.py (58 -> 98 %) y
  shipments_io.py (carga masiva: 89 -> 100 %): 46 casos de comportamiento y borde, con la TRM duplicada el peaje vale la mitad
  en la cotización, CSV/Excel con filas malas, vista previa sin escribir, etc.
- **Arreglo hallado por la cobertura:** importar peajes con un archivo ilegible (base64 roto, CSV dañado) respondía 500; ahora 422
  con mensaje en español, y los errores de fila ya no muestran el texto de pandas en inglés.
- **Verificación:** tsc, eslint y build limpios; 495 pruebas de la API; 47 de navegador × 2 corridas.

## 70. Cierre de la ronda 3 (F6, F7, F8) y subida a producción

- OpenChamber dejó sin commit las tareas F6, F7 y F8 de la ronda 3. Claude las verificó, corrigió dos pruebas y las subió.
- **F6, filtros en la dirección:** en Flota (vehículos y fallas) y Bodegas, los filtros y el orden quedan en la URL; al
  recargar o compartir el enlace se ve lo mismo (`components/fleet/filters.ts`).
- **F7, borrador del envío nuevo:** se guarda en el navegador mientras se escribe, se ofrece al volver y se borra al
  guardar, al descartar o al cerrar sesión (puede traer datos del cliente). Editar un envío existente no lo toca.
- **F8, errores por sección:** en la ficha del envío, si fallan el mapa, la bitácora, la entrega, los adjuntos o el
  historial, solo esa parte avisa (con «Reintentar» en el mapa) y el resto de la ficha sigue en pie.
- **Pruebas corregidas:** la de errores buscaba el SVG de la vista previa, pero la ficha usa el mapa 3D; ahora comprueba
  que «Reintentar» vuelve a pedir la red y el aviso se va. La del borrador comparaba también la hora del guardado, que
  puede moverse una vez más en el envío nuevo; ahora compara solo los valores.
- Pruebas: 495 de la API y 53 de navegador.

## 71. Tanda 2, ronda 1: caché de la red, ayuda de atajos y contraste del tema oscuro

- **B1 caché del navegador (ETag/304):** `/api/network/multimodal` y `/api/geo/departments` llevan ETag (hash del contenido) y
  `Cache-Control: no-cache`; con `If-None-Match` vigente devuelven 304 sin cuerpo. Medido con TestClient: 156.456 B sin comprimir
  (24.920 B con gzip) la primera vez y ~214 B de cabeceras en las siguientes. El proxy de Next tuvo que reenviar `If-None-Match`
  y devolver `etag/cache-control/vary`: sin eso el navegador nunca veía el validador. Solo esas lecturas usan `cache: no-cache`;
  el resto de la app sigue en `no-store`. Costo: ya no comparten la caché de lecturas de 5 s (10 a 22 ms por petición) y el JSON se
  serializa dos veces (pendiente opcional: cachear `network_geojson` o hashear los bytes ya serializados).
- **F2 ayuda de atajos:** la hoja de `?` ya existía; se añadió el acceso visible en Configuración > Ayuda, la lista se lee completa
  con lector de pantalla y `Sheet` ganó trampa de foco, título/descripción asociados, cierre por ref (un redibujo ya no roba el foco)
  y solo cuenta lo tabulable. Capas ordenadas: hoja 70 < acceso 72 < paleta 75 < avisos y consentimiento 80.
- **F1 revisión visual (claro/oscuro, escritorio/celular):** de lo nuevo (ingresar, esqueletos, errores por sección, borrador,
  cambiar contraseña, dock con la cuenta) solo había un fallo real: blanco sobre el rojo suave del tema oscuro daba 2,8:1 (botón
  «Cerrar sesión») y sobre el naranja 2,1:1 (contador de avisos). Tokens `--on-danger` y `--on-warning`. En celular, las hojas
  modales quedaban debajo del dock; ahora van encima. Sin desborde horizontal a 412 px.
- **Revisión:** además del contraste del contador de avisos, la paleta (Ctrl K) quedaba tapada por la hoja abierta; las dos
  cosas se corrigieron. Falta probar con varios controles la trampa de foco (la e2e usa una hoja de un solo botón).
- **Pendiente de la tanda:** B2 (último ingreso por usuario) pasa a la ronda 2 porque toca las rutas de administración de `main.py`.
- **Verificación:** tsc, eslint y build limpios; 503 pruebas de la API; 60 de navegador.

## 72. Tanda 2, ronda 2: mis sesiones, último ingreso, búsqueda global, inicio vacío e impresión

- **B2 último ingreso por usuario:** la lista de Administración muestra «Último ingreso» (o «Nunca ha entrado»), los intentos
  fallidos y «Bloqueada». Migración **v19** (aditiva): `users.last_login_at`. Se escribe solo al abrir sesión con éxito.
- **B3 mis sesiones:** Configuración > Mis sesiones lista las de la propia cuenta (navegador resumido, «Esta sesión») y
  «Cerrar las demás». Migración v19: `user_sessions.user_agent` (recortado a 200; **no se guarda IP**). Los ids son opacos
  (sha256 de los 16 primeros caracteres del token, nunca el token), sin sesión devuelven 401, y el cierre queda en el historial sin
  tokens. El proxy de Next ahora reenvía el `user-agent`. De paso: cerrar sesión con solo la cookie no borraba la sesión de la base
  (ahora sí), y se probó que `/api/auth/` nunca sale de la caché de lecturas de 5 s aunque dos cuentas pidan la misma URL.
- **B4 búsqueda global:** `GET /api/search?q=&limit=` (envíos, vehículos, bodegas y clientes; tope por tipo; menos de 2 caracteres
  no toca la base; los `%` y `_` del texto se escapan; las tildes se pliegan). ~7 ms con la base sembrada y ~16 ms con la de
  ejemplo (casi todo es apertura de conexiones). La paleta Ctrl K la usa con retardo de 250 ms y cancelando la anterior. Es un
  `LIKE '%…%'`: con muchos miles de envíos haría falta FTS5. **Decisión del dueño pendiente:** la ruta no exige sesión (igual que
  las demás lecturas hoy) y permite buscar clientes y códigos sin entrar.
- **F3 inicio vacío:** sin envíos, vehículos o bodegas (y sin filtros) cada lista dice qué hacer primero. En bodegas no ofrece
  «Importar desde Excel» porque ahí el Excel carga inventario y exige la bodega creada. No se pudo simular el vacío real con e2e
  (esas listas se leen en el servidor y `page.route` no las alcanza): se prueba que un filtro sin resultados NO es inicio vacío.
- **F4 impresión:** encabezado con marca, título y fecha; sin dock, botones, filtros ni paginador; la tabla se reparte entre
  páginas (el contenedor con `overflow` la dejaba como una caja que recortaba filas y columnas, lo encontró la revisión).
- **Revisión:** además de lo anterior, la paleta abría otra fila que la resaltada cuando llegaba el servidor y repetía resultados.
- **Verificación:** tsc, eslint y build limpios; 543 pruebas de la API; 68 de navegador.

## 73. Tanda 2, ronda 3: cumplimiento, accesibilidad, rendimiento medido y dependencias

- **B5 cumplimiento (entregas a tiempo):** `engine/otif.py` con la misma regla del tablero (entregado sin retraso), por modo (el del
  tramo más largo del envío, no el reparto por t-km) y por cliente (top 10 y «Otros»); sin entregas es «N/D», nunca 0 %. Va en el
  reporte mensual (sección «Cumplimiento», por fecha de entrega) y en una tarjeta de «Hoy» (últimos 30 días, sin consultas nuevas).
  El «completo» de OTIF **no se puede medir**: no hay cantidad entregada frente a la pedida; por eso se rotula «entregas a tiempo».
  La revisión encontró que un `&` o `<` en el nombre de un cliente rompía el PDF (422 y correo mensual perdido): se escapan las celdas.
- **«OTIF 30 días» del tablero:** rotulaba 30 días pero contaba toda la base de entregados. Ahora cuenta los últimos 30 días por
  fecha de entrega, igual que Hoy y el reporte (en la base de ejemplo sigue en 83,3 %: las 12 entregas son recientes). Decisión del
  dueño el día de la entrega («cambia lo que necesites»).
- **`/api/search` ahora pide sesión** (ruta nueva; no toca ninguna lectura existente ni los roles) y sale de la caché de lecturas de
  5 s: por cookie la caché no distingue personas y habría servido la respuesta de quien entró a quien no.
- **F5 accesibilidad con lector de pantalla y teclado** en ingresar, crear envío y registrar entrega: errores (role=alert) y
  cargas/éxitos (role=status) anunciados una sola vez, `aria-invalid`/`aria-describedby`, grupos de botones con nombre, foco que no se
  pierde al fallar y diálogo de entrega que cierra con Esc. **Hallazgo de seguridad:** el ingreso aceptaba redirecciones a otro sitio
  con `?next=/\evil.com` (el parser trata la barra invertida como `/`); ahora solo vuelve al mismo origen, con e2e. Limitación
  conocida: el lienzo de la firma solo se opera con puntero.
- **F6 rendimiento medido** (Edge, CPU x4 y 4G lenta, mediana de 5, build de producción):

  | Página | LCP antes | LCP después | INP antes | INP después |
  |---|---|---|---|---|
  | portada | 2.820 ms | 1.976 ms | — | — |
  | panel | 2.836 ms | 1.556 ms | 184 ms | 200 ms |
  | lista de envíos | 3.056 ms | 1.128 ms | 160 ms | 192 ms |
  | ficha de envío | 2.244 ms | 1.008 ms | **1.080 ms** | **192 ms** |

  CLS ≤ 0,025 en todas (límite «bueno»: 0,1). Causas: el **LCP** era el párrafo del encabezado, que `Reveal` y `template.tsx`
  (framer-motion) renderizaban con `opacity: 0` hasta hidratar; ahora son animaciones CSS (`.reveal-up` y `.view-in`, solo
  transform/opacity, quietas con «reducir movimiento», con `fill-mode: backwards` para no dejar un transform residual que rompa lo
  `position: fixed`). El **INP de la ficha** era la creación del mapa 3D: una tarea de 1,4 s (6 s de tareas largas en total) que
  competía con Ctrl K; ahora se crea tras 1,5 s sin actividad (tope de 15 s), no con la pestaña oculta ni con un modal abierto, y
  mientras tanto se ve la red plana. La ficha baja además de 574 a 434 KB transferidos en la ventana medida.
- **B6 dependencias:** `npm audit` y `pip-audit` sin vulnerabilidades conocidas. Solo parches: `deck.gl` 9.4.1, Tailwind 4.3.5 y
  `tailwind-merge` 3.7.1. Quedan sin tocar los menores con riesgo visual (`framer-motion` 14.14, `lucide-react` 1.77, `maplibre-gl`
  6.19, `@tanstack/react-table` 9.3) porque sin motivo de seguridad no compensan; Playwright 1.65 y React 19.3.1 también están
  disponibles.
- **Pendientes que quedan:** `import-shipments` (22 KB gzip) se carga siempre en `/envios`; el JSON de la red y los departamentos se
  serializa dos veces por el ETag; la firma no se opera con teclado; `Date.now()` en el estado inicial del formulario de envío puede
  desajustar la hidratación si el navegador está en otra zona horaria que el servidor.
- **Verificación:** tsc, eslint y build limpios; **553 pruebas de la API**; **74 de navegador** (73 en la corrida completa y la que
  falló, `ingreso.spec.ts`, por un corte de red del equipo —`net::ERR_NETWORK_CHANGED`—, pasó al repetirla).

## 74. Firma visual propia: la línea de red, la ficha con la ruta en grande y el ingreso con la red

- **Pedido del dueño:** que no se vea genérica; con las guías de Emil Kowalski (`.agents/skills/emil-design-eng`) e
  impeccable. Diagnóstico con capturas: todas las pantallas repetían el mismo molde (título, párrafo gris, botones, tarjetas)
  sin nada propio de un sistema de transporte.
- **Línea de red (en `PageHeader`, todas las pantallas de la app):** bajo el título, un trazo con los cinco modos; cada
  tramo mide lo que su red real en kilómetros (aéreo 13.437, terrestre 12.628, fluvial 4.480, marítimo 3.340, férreo
  1.464), con un nodo en cada unión. Se dibuja de izquierda a derecha al entrar (escala en X, 60 ms entre tramos, curva
  de salida fuerte `cubic-bezier(0.23, 1, 0.32, 1)`), luego queda quieta. Nada con «reducir movimiento».
- **«Operación en vivo»** sobre cada título: hora de Bogotá (`shell/live-stamp.tsx`), solo en el navegador (el HTML
  prerenderizado no puede llevar la hora), cada 30 s y solo con la pestaña visible; el punto no pulsa.
- **Ficha del envío:** la ruta (origen → destino) pasa a ser lo grande; el código sigue siendo el título (lector de
  pantalla, pruebas y la transición desde la lista) pero en pequeño y monoespaciado. Debajo, la misma línea de la firma
  con los tramos de ese envío (`RouteRule`: color de su modo, largo según su distancia).
- **Ingreso (`/ingresar`) en escritorio:** a la derecha, la red que se va a operar: 35.349 km y un trazo por modo
  proporcional a sus kilómetros, con ícono y nombre, que se dibuja al entrar.
- Pruebas: 553 de la API y 74 de navegador (accesibilidad en claro y oscuro incluida).
