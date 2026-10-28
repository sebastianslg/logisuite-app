# Bitácora del proyecto Westvane TMS

Registro de todo lo construido, investigado, decidido y pendiente hasta hoy.
Rama de trabajo: `main` (la rama de sesión `claude/vigilant-johnson-mofqyc` queda igual a `main`).
Última actualización: 28 de octubre de 2026 (dock de navegación y lotes 1 a 5 del plan de movimiento).

---

## 1. Estado actual

| Parte | Estado |
|---|---|
| Backend (FastAPI + SQLite + NetworkX) | Funcional. 131 pruebas en verde. |
| Celular | Dock inferior con hoja "Más" desde abajo; simulador como hoja inferior; envíos en tarjetas. Sin desbordamiento horizontal a 390 px. |
| Diseño y movimiento | Dock flotante, tema claro por defecto, paleta de modos nueva y lotes 1 a 5 del plan de movimiento (sección 9). |
| Frontend (Next.js 16 + Tailwind v4 + deck.gl) | Funcional. Typecheck, lint y build sin errores; flujo completo probado con Playwright. |
| Vías, envíos editables, USD/COP, PDF, historial | Implementados (ver sección 2 y `docs/AUDITORIA_BOTONES.md`). |
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
| (lote 5) | Contrastes AA en fondos tintados, capturas en `docs/capturas/`, esta bitácora. |

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

8. **Historial de trayectos** por ciudad y departamento; costos de peaje y combustible por corredor; alertas operativas (vía cerrada, derrumbe, paro).
9. **Despliegue permanente:** cuenta de Oracle, VM, HTTPS con Caddy, dominio, GitHub Actions, respaldos. Ver `DEPLOY.md`.
10. **Mejoras de velocidad:** caché de respuestas de la API, menos peticiones al abrir el dashboard, carga diferida del mapa.

11. **Autenticación:** necesaria antes de publicar el enlace. Hoy cualquiera con la URL puede modificar la operación y el historial no identifica a nadie de forma verificable.
12. **Persistencia en Render:** la base vive en `/tmp`; envíos creados, cierres, TRM y enlaces se pierden cuando el servicio duerme o se reinicia. Requiere disco persistente o la VM.

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

1. Autenticación o modo de solo lectura antes de compartir el enlace público.
2. Base de datos persistente (en Render la base vive en `/tmp` y se pierde al reiniciar).
3. Tarjetas en celular para la lista de envíos.
4. Notificaciones de vías cerradas y envíos sin ruta fuera del dashboard.
5. Exportar a Excel la tabla filtrada.
6. Búsqueda global de envíos, vías y ciudades.
7. Duplicar un envío.
8. Pruebas end-to-end automáticas con Playwright.
9. Validar coordenadas aproximadas contra INVÍAS, ANI y Cormagdalena.
10. Actualizar dependencias con vulnerabilidades reportadas (sección 5).

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
- La paleta de modos nueva no se validó para daltonismo (la anterior sí); el férreo `#c98a00` tiene 2,6:1
  sobre blanco (por debajo de 3:1 para gráficos), aunque siempre va con ícono y texto.
- Del plan visual quedan sin hacer: bandas alternas de fondo en el resumen, esqueletos con brillo, estados
  vacíos tipográficos, línea de tiempo con trazo animado y transiciones entre páginas con View Transitions.
- La transición compartida del código solo cubre la tabla y las tarjetas de envíos (no la paleta Ctrl K).

## 10. Acceso y credenciales

No se guardan contraseñas, tokens ni claves privadas en este documento.

- GitHub: repositorio `sebastianslg/logisuite-app`, rama `claude/laughing-albattani-875mtq`.
- Render: blueprint `logisuite`, servicios `logisuite-api` y `logisuite-web`.
- Secretos para GitHub Actions (`SSH_HOST`, `SSH_USER`, `SSH_KEY`): pendientes de crear cuando exista la VM.
