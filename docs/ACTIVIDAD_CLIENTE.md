# Actividad del cliente: sondeos, intervalos, temporizadores y rAF

Auditoría del **22/11/2026** sobre `frontend/`. Objetivo: que nada que no se vea siga trabajando y que dos componentes
nunca dupliquen una lectura del mismo dato. La regla de `DESIGN.md` es explícita: «lo que no se ve no trabaja:
sondeos en pausa con la pestaña oculta o fuera de pantalla».

Búsqueda usada (más `git grep` para los archivos ya versionados):

```bash
git grep -n -E "setInterval|setTimeout|requestAnimationFrame|requestIdleCallback" -- frontend/src
```

## Resumen

- **Un solo motor de sondeo** por URL: `src/lib/sondeo.ts` (nuevo). `src/lib/use-live.ts` queda como fachada para no
  tocar los imports existentes. Varios componentes comparten lectura, error y antigüedad; una petición en curso se
  reutiliza, nunca se repite.
- **Pausa real** con la pestaña oculta, sin red, sin suscriptores o (con `ref`) con el elemento fuera de pantalla. Al
  volver se consulta en el acto si el dato envejeció.
- **Cancelación y tiempo máximo** en cada lectura: 10 s en el sondeo, 15 s en la red/departamentos, 20 s en el estado
  del servidor. Abortar por pausa o desmontaje **no se cuenta como fallo**.
- **Nunca se pierde la última lectura buena**: se conserva en memoria y se sigue mostrando mientras se reintenta.
- **Un solo reloj de 30 s** para toda la app (`useLiveClock`): encabezado y modo presentación comparten temporizador.
- **Cero `setInterval` en páginas y paneles**; el único del producto es el reloj compartido y el sondeo de salud del
  dock (ver «Pendiente en archivos de otros»). Diagnóstico mide FPS con un solo `requestAnimationFrame` que se detiene
  con la pestaña oculta.
- **Mapa 3D**: se pausa fuera de pantalla o con la pestaña oculta (no se desmonta: recrear WebGL cuesta segundos), y
  si el trozo no carga, no hay WebGL o el mapa falla, queda la red plana con un **reintento explícito**.

## Antes y después, archivo por archivo

| Archivo | Uso y ritmo | Antes | Después | Por qué |
| --- | --- | --- | --- | --- |
| `src/lib/use-live.ts` (y nuevo `src/lib/sondeo.ts`) | Sondeo compartido por URL: flota 20 s, resumen 30 s, avisos 60 s, combustible 20 s | Ya usaba un `Map` por URL, pero el intervalo mínimo quedaba pegado para siempre aunque se fuera el suscriptor que lo pedía; un suscriptor nuevo después de un fallo lanzaba otra petición en el acto; no había cancelación al desmontar ni al ocultar; el error no se podía consultar; el error de una petición no avisaba a los suscriptores | Un registro por URL con `watchers` e intervalo efectivo (el mínimo de los que están mirando). Una petición en curso es candado y se comparte; `AbortController` con corte a 10 s; `pause` por pestaña oculta, sin red, último watcher o desmontaje, sin contar como fallo; espera creciente exponencial hasta 2 min; al volver, si el dato envejeció se pide ya; último dato bueno intacto; `useLiveState` expone `error` y `at`; reloj compartido de 30 s (`useLiveClock`) | Menos peticiones, menos trabajo oculto y un error visible sin inventar otro sondeo |
| `src/components/map/use-map-data.ts` | Red + departamentos (caché 5 min) y flota 20 s | Promesa compartida y `AbortSignal.timeout(15 s)`, pero sin cancelar al desmontar/ocultar ni reintento: un fallo dejaba el mapa en error hasta recargar; una visita nueva después del fallo no tenía red que mostrar | Una sola petición compartida con `AbortController`; pausa y corte con la pestaña oculta o al quedarse sin mapas montados; reintento automático 4 → 60 s solo con un mapa visible; la última red buena se pinta tras la hidratación y sobrevive al fallo; `retry()` explícito en el valor devuelto; `invalidateMapData()` cancela y revalida; la flota sigue el sondeo compartido y se pausa con el `ref` del mapa | El mapa tolera un fallo de red sin quedar en blanco y no pide de más al cambiar de página |
| `src/components/map/map-3d-lazy.tsx` | Carga diferida, import de deck.gl/MapLibre y montaje del mapa | Si el `import()` fallaba, quedaba el aviso de carga para siempre; no se comprobaba WebGL ni había límite de error; una vez montado no se pausaba desde el contenedor | Comprobación de WebGL antes de bajar el trozo (se reintenta si falla); `MapBoundary` para errores de dibujo; escucha `webglcontextlost`; si falla, red plana con mensaje y botón «Reintentar el mapa 3D»; `paused` con la pestaña oculta o fuera de pantalla; sin reintento silencioso ni bucle | Una GPU ausente o un trozo roto no dejan una pantalla vacía; el contexto no se recrea al hacer scroll |
| `src/components/shell/alerts-menu.tsx` | Avisos cada 60 s | Sin `ref`: el sondeo seguía aunque la campana estuviera oculta por CSS (dock de escritorio en celular); si la primera lectura fallaba, el esqueleto quedaba para siempre sin texto accesible | `useAlerts(ref)` observa la campana y usa `useLiveState` para conocer el fallo; el sondeo se pausa cuando el dock no se ve; se conserva el dato anterior; mientras carga se anuncia «Cargando avisos…»; si no hay dato y falla, se dice «No se pudieron cargar los avisos. Se reintenta solo.»; el panel es una región «Avisos operativos» | El dato se pide solo si alguien puede verlo y el panel se entiende con lector de pantalla |
| `src/components/shell/live-stamp.tsx` | Hora de la operación cada 30 s | `setInterval` propio de cada instancia; se detenía con la pestaña oculta, pero el componente no compartía reloj | `useLiveClock()`: un solo intervalo de 30 s para todas las instancias, pausado con la pestaña oculta y actualizado al volver (`null` hasta que el navegador puede leer la hora) | Menos temporizadores y misma hora en toda la pantalla |
| `src/components/dashboard/presentation.tsx` | Resumen del modo presentación cada 30 s | `setInterval` propio que seguía latiendo con la pestaña oculta; el resumen usaba el sondeo compartido | El reloj es el compartido (`useLiveClock`), detenido con la pestaña oculta; el resumen sigue el sondeo compartido y conserva la última lectura | Presentar no gasta batería en segundo plano |
| `src/components/diagnostics.tsx` | FPS y tareas largas con el panel abierto | `requestAnimationFrame` continuo + `setInterval(1000)`; el intervalo seguía con la pestaña oculta y el rAF no se reiniciaba con criterio al volver | Un solo `requestAnimationFrame` que calcula los FPS al cumplir 1 s; `start/stop` con `visibilitychange`; se reinicia la muestra al volver; `PerformanceObserver` intacto y desconectado al desmontar | Medir no debe costar dos temporizadores ni seguir oculto |
| `src/components/tracking/auto-refresh.tsx` | Refresco de `/hoy` y del seguimiento público cada 60 s | `setInterval` que solo miraba `document.hidden` al disparar: el temporizador seguía vivo oculto y no refrescaba al volver aunque el dato estuviera viejo | `setTimeout` encadenado: se detiene al ocultar o desmontar, al volver refresca solo si pasó el intervalo, sin ráfagas si coinciden visibilidad/red/temporizador; respeta `navigator.onLine` y escucha `online/offline` | Una hoja operativa al día y un seguimiento público no se quedan viejos ni martillan la API |
| `src/components/settings/server-status.tsx` | Estado del servidor, a pedido del administrador | `api()` con su corte de 60 s, sin cancelar y sin proteger la respuesta tardía: un «Actualizar» podía pisar una lectura más nueva y una respuesta llegaba después de desmontar | `AbortController` por lectura, 20 s propios, la nueva cancela la anterior, corte al desmontar o al perder el rol; `api(..., { signal })` (el helper acepta `signal`); un fallo conserva el último estado bueno | Sin carreras ni trabajo después de salir de Configuración |
| `src/lib/sondeo.ts` (nuevo) | Motor de sondeo + reloj compartido | No existía | Registro por URL, `AbortController`, pausa/cancelación, espera creciente, `useLive`, `useLiveState`, `useLiveClock` | Un único lugar donde se decide cuándo se pide y cuándo no |
| `e2e/actividad-cliente.spec.ts` (nuevo) | Prueba de navegador | No existía | Una petición por URL (aunque haya dos suscriptores), pausa con la pestaña oculta (reloj falso), respeto de la espera tras fallo y recuperación; mapa 3D sin WebGL → red plana → reintento con WebGL devuelto | Fija las reglas que no se ven en una captura |

## Inventario completo (grep)

### Intervalos

| Archivo | Uso | Decisión |
| --- | --- | --- |
| `src/lib/sondeo.ts:299` | Reloj único de 30 s (`useLiveClock`) | **Nuevo y justificado**: todos los relojes de interfaz comparten uno; se detiene sin suscriptores y con la pestaña oculta |
| `src/components/shell/dock.tsx:833` | Salud de la API cada 30 s (`useSystemStatus`) | **Pendiente en archivo de otro**. Dos instancias (`SystemDot` y `SystemStatusText`) montan el hook por separado: en el celular con la hoja abierta hay dos `setInterval` y dos `/api/health`. Se puede sustituir por `useLiveState("/api/health", 30_000, null, ref)` (comparte petición y expone `error`); no se editó aquí |
| Resto de `src/` | — | Ya no quedan `setInterval` de producto (antes: presentación, diagnóstico, live-stamp, auto-refresh) |

### `requestAnimationFrame`

| Archivo | Uso | Decisión |
| --- | --- | --- |
| `src/components/Map3D.tsx:299` | Un cuadro por etapa de compilación de capas | Correcto: un `onIdle` por etapa, cancelado al desmontar |
| `src/components/Map3D.tsx:368` | Reloj de la animación del mapa (30/10 fps) | Correcto: solo corre con el mapa en movimiento o en pantalla completa, mira `document.hidden`, y este lote le pasa `paused` al estar fuera de pantalla. No se editó (archivo de otro) |
| `src/components/diagnostics.tsx:96,103` | Medición de FPS | **Cambiado**: un solo rAF, se detiene oculto y al desmontar |
| `src/components/shell/dock.tsx:147` | Compactar el dock al bajar | Correcto: nace de `scroll`, se cancela al desmontar; no corre en reposo |
| `src/components/auth/login-screen.tsx:85`, `src/components/landing/demo-form.tsx:53`, `src/components/shipments/shipment-form.tsx:330,337,573` | Foco de un error tras enviar | Correctos: un cuadro para esperar al DOM, no recurrentes |

### `setTimeout` que se repiten o se encadenan

| Archivo | Uso | Decisión |
| --- | --- | --- |
| `src/lib/sondeo.ts` | Espera entre lecturas, corte de 10 s, espera creciente | **Nuevo**: uno por URL como máximo, cancelado y reprogramado con la pestaña, la red y los suscriptores |
| `src/components/map/use-map-data.ts:71,81` | Espera de reintento 4–60 s y corte de 15 s | **Cambiado**: solo con un mapa visible; cancelado al desmontar u ocultar |
| `src/components/map/use-map-data.ts` | Lectura de red/departamentos | Antes no se cancelaba; ahora `AbortController` y una sola promesa compartida |
| `src/components/tracking/auto-refresh.tsx:37` | Refresco de página | **Cambiado**: encadenado, pausado, sin ráfagas |
| `src/components/settings/server-status.tsx:88` | Corte de 20 s de la lectura del servidor | **Nuevo**: se limpia al terminar y al desmontar |
| `src/lib/idle.ts` | Reintentos de `onQuiet` y `onIdle` (mapa 3D) | Correcto: devuelve la cancelación y `Map3DLazy`/`Map3D` la usan |
| `src/components/map/map-frame.tsx:94` | Respaldo de 900 ms del morph a pantalla completa | Correcto: se limpia al terminar o desmontar |
| `src/components/map/network-explorer.tsx:79` | 1,5 s para volver a animar tras interactuar | Correcto: se limpia al desmontar. Su `fetch("/api/locations")` no tiene abort (riesgo menor fuera de este alcance) |
| `src/components/Map3D.tsx:340,469` | 800 ms para desenganchar la animación y 0 ms para volar a una ciudad | Correctos: se limpian (el segundo, en el retorno del efecto) |

### Temporizadores de un solo disparo (no recurrentes)

No se modifican: no trabajan en reposo ni vuelven a dispararse solos. Revisados y, salvo donde se indica, se limpian
en el retorno del efecto o del evento:

- Foco/copiado/aviso: `login-dialog.tsx:49`, `city-combobox.tsx:70`, `sheet.tsx:89`, `command-palette.tsx:196,231,268`,
  `settings-panel.tsx:457`, `export-actions.tsx:53,104`, `tracking-links.tsx:58`, `my-sessions.tsx:105`,
  `shipments-table.tsx:412`, `fleet-board.tsx:87`, `warehouse-board.tsx:117`, `shipment-form.tsx:261`,
  `shortcuts.tsx:89`, `save-icon.tsx:51`, `burst.tsx:43`.
- Revocación de URL de descarga: `lib/client.ts:68,75` (un disparo, sin estado de React).
- `toast.tsx:64`: cada aviso se autodestruye a los 4 s. Es un disparo, pero **no se pausa con la pestaña oculta**
  (principio de Sonner). Queda anotado; el archivo no es de este lote.

## Prueba de navegador

`frontend/e2e/actividad-cliente.spec.ts` (se corre con el fixture de `e2e/helpers.ts`, que ya entra con la cuenta
«pruebas»; desde `frontend/`: `npx playwright test e2e/actividad-cliente.spec.ts`):

1. **Sondeos**: instala el reloj falso de Playwright, oculta la pestaña con un `visibilitychange` sintético y hace
   fallar la primera lectura de `/api/alerts`. Comprueba que la campana y la hoja del dock comparten **una** petición,
   que con la pestaña oculta no hay ninguna aunque pasen 5 minutos, que al volver se respeta la espera de 120 s del
   primer reintento y que la lectura se recupera y el panel deja el esqueleto.
2. **Mapa 3D**: bloquea `getContext("webgl")` antes de cargar, comprueba que aparece la red plana con el aviso y que
   «Reintentar el mapa 3D» vuelve a montar el mapa cuando se devuelve WebGL.

## Pendiente en archivos de otros (no editados aquí)

- **`src/components/shell/dock.tsx`**: unificar `useSystemStatus` (dos instancias → dos sondeos de salud y dos
  `setInterval` cuando la hoja del celular está abierta). Sugerencia:
  `const { data, error } = useLiveState<{ status: string }>("/api/health", 30_000, null, ref)` y
  `const online = error ? false : data ? true : null;`. Con un `ref` en el punto del dock se pausa además cuando el
  dock de escritorio está oculto en celular.
- **`src/components/shell/dock.tsx` (`MobileDock`)**: llama a `useAlerts()` sin `ref`; en escritorio esa copia sigue
  como suscriptora aunque el dock móvil esté `md:hidden`. No duplica la petición (el motor comparte la URL), pero
  mantiene un watcher activo. Un `ref` al contenedor o montar `MobileDock` solo cuando corresponda lo evita.
- **`src/components/map/network-explorer.tsx`**: el `fetch("/api/locations")` de montaje no tiene `AbortController`
  ni limpieza; si se cambia de ruta antes de responder, la respuesta se descarta sin cancelar la red. Es una lectura
  única, no un sondeo; queda anotado.
- **`src/components/Map3D.tsx`**: no se tocó. Su reloj ya respeta `document.hidden`, la intersección y «reducir
  movimiento»; ahora además recibe `paused` cuando el contenedor está fuera de pantalla o la pestaña oculta.
