# Plan de movimiento y respuesta al toque — Westvane TMS

> Documento de traspaso. Continúa el trabajo de `docs/PLAN_DISENO_VISUAL.md` (tokens, pantallas, navegación).
> Leer antes: `docs/BITACORA.md` (estado general y reglas del mapa) y `docs/PLAN_DISENO_VISUAL.md`.
> Fecha: 27 de octubre de 2026. Rama de trabajo: `main`.

---

## 0. Estado actual

Ya está en `main`:
- `frontend/src/components/ui/burst.tsx`: hook `useBurst(Icon, count)` que devuelve `{ burst, layer }`.
  `burst(event)` crea chispas en el punto tocado; `layer` se renderiza dentro del contenedor (debe tener
  `relative overflow-visible`). Respeta `useReducedMotion`.
- `frontend/src/components/ui/burst-link.tsx`: `BurstLink`, botón primario (Link) con chispas al tocar.
- Uso actual: botón "Nuevo envío" en `frontend/src/app/envios/page.tsx`.
- Verificado: en el DOM aparecen 7 chispas 120 ms después del toque. **No hay captura visual limpia**
  porque la navegación cambia de página en ~150 ms. Para verlo bien, probar en un botón que no navegue
  (por ejemplo, "Guardar" dentro de un formulario con `preventDefault` temporal) o capturar con
  `page.clock` / cámara lenta.

Ya existe (no reinventar):
- `components/ui/count-up.tsx`: `CountUp` (conteo animado).
- `components/ui/sheet.tsx`, `components/ui/dial.tsx`, `components/ui/detail-table.tsx`.
- `components/motion-provider.tsx`: `MotionConfig reducedMotion="user"` (respeta "reducir movimiento").
- `lib/motion.ts`: `EASE = [0.16, 1, 0.3, 1]`, `T_FAST` (0,3 s), `T_VIEW` (0,5 s), `stagger(i, step, max)`,
  `hoverLift` (escala 1,02, y −2 px, sombra elevada), `SHADOW_REST`, `SHADOW_LIFT`.
- `components/shell/sidebar.tsx`: indicador `layoutId="nav-active"`, resplandor al puntero, estado
  "Sistema en línea" con punto que respira, entrada en cascada del menú de celular.
- `components/ui/button.tsx`: `buttonVariants` con clase `press` (definida en `globals.css`).

Regla vigente (no romper): **el mapa no anima en reposo**. Solo se mueve al arrastrarlo, con la rueda o en
pantalla completa (propuesta pendiente de confirmar en `docs/PLAN_DISENO_VISUAL.md` §10). Ningún efecto
nuevo puede añadir trabajo por cuadro al mapa.

---

## 1. Principios técnicos (obligatorios en todo el trabajo)

1. **Solo `transform` y `opacity`** en animaciones. Nunca `width`, `height`, `top`, `left`, `box-shadow`
   o `filter` animados en listas, tablas ni en el mapa.
2. **Una sola curva base**: `EASE` de `lib/motion.ts`. Resortes (`type: "spring"`) solo para indicadores que
   se deslizan (`layoutId`) y para el morph de pantalla completa. Parámetros de resorte estándar:
   `{ type: "spring", stiffness: 420, damping: 38, mass: 0.8 }`.
3. **Duraciones**: 120 ms (presión), 200 ms (hover, color), 300 ms (aparecer/ocultar), 500 ms (entrada de
   vista), 900 ms (conteo de cifras), 1000 ms (vida de chispas).
4. **Reducir movimiento**: todo componente nuevo debe leer `useReducedMotion()` (o depender de
   `MotionConfig`). Con preferencia activa: fundidos de 150 ms, sin desplazamiento, sin escala, sin
   conteo, sin chispas.
5. **Escalonado**: máximo 0,4 s total; nunca más de 12 elementos animados a la vez; usar `stagger`.
6. **Limpieza**: toda animación con `setTimeout` o `requestAnimationFrame` debe cancelarse al desmontar.
7. **Accesibilidad**: los efectos decorativos llevan `aria-hidden`. Ningún efecto cambia el foco ni
   oculta contenido necesario.
8. **Móvil**: sin `hover` como única pista; el toque (`onPointerDown`) dispara el efecto.

---

## 2. Lote 1 — Respuesta al toque

**Objetivo**: cada acción importante responde en el instante del toque.

### 2.1 Presión de botones (`press`)
- Archivo: `frontend/src/app/globals.css` (clase `.press`, ya existe; revisar valores).
- Valor objetivo: `transform: scale(0.97)` en `:active` con `transition: transform 120ms var(--ease-out)`.
- Al soltar, rebote suave: `transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)` solo en la
  vuelta (con `:not(:active)`).
- Aplicar a: todos los `Button`, tarjetas clicables y filas de tabla que navegan.

### 2.2 Onda de luz al tocar
- Nuevo componente: `frontend/src/components/ui/ripple.tsx`.
- Un `span` absoluto, radio `--radius-control` (999px) del contenedor, `background: currentColor` al 12 %,
  nace en el punto del toque, escala de 0 a `max(width, height) * 2.2` con `opacity` 1 → 0 en 500 ms.
- Se monta dentro de `overflow: hidden` del contenedor (el `Button` debe tenerlo; añadir si falta).
- Hook sugerido: `useRipple()` → `{ onPointerDown, layer }`, igual que `useBurst`.

### 2.3 Chispas en acciones clave (ya empezado)
- Aplicar `useBurst` (o `BurstLink`) a: **Guardar** (formularios de envío, vía, flota), **Exportar PDF**,
  **Compartir enlace**, **Crear envío**.
- Ícono por acción: Guardar → `Check`; Exportar → `FileDown`; Compartir → `Share2`; Crear → `Sparkles`.
- Pasar el ícono a `useBurst(Icon, count)`; `count` recomendado 6 (escritorio) y 4 (celular).

### 2.4 Criterios de aceptación del lote 1
- [ ] Todo botón primario tiene escala 0,97 al presionar.
- [ ] Onda de luz visible en botones secundarios y tarjetas clicables.
- [ ] Chispas en las 4 acciones clave, con captura visual validada (ver §0).
- [ ] Con "reducir movimiento", no hay escala, onda ni chispas.
- [ ] `npx tsc --noEmit`, `npx eslint src`, `npx next build` sin errores.

---

## 3. Lote 2 — Despliegues y paneles

**Objetivo**: nada aparece ni desaparece de golpe; todo crece desde su origen.

### 3.1 Acordeón con altura animada
- Nuevo componente: `frontend/src/components/ui/collapsible-panel.tsx` (cliente).
- Usar `AnimatePresence` + `motion.div` con `initial={{ height: 0, opacity: 0 }}`,
  `animate={{ height: "auto", opacity: 1 }}`, `exit` igual, duración 300 ms, `EASE`.
- Contenido interno en `motion.div` con `initial={{ y: -6 }}` → `y: 0` (entrada leve).
- Atributos: `aria-expanded`, `aria-controls`, `id` estable (`useId`).
- Aplicar a: detalle del envío (secciones "Tramos y transbordos", "Historial", "Costos"),
  configuración (secciones), filtros de envíos.

### 3.2 Menús desplegables
- Menú "Más" del dock (ver PLAN_DISENO_VISUAL §5) y menú de moneda/tema.
- Entrada: `initial={{ opacity: 0, scale: 0.96, y: -6, transformOrigin: "top right" }}` →
  `animate={{ opacity: 1, scale: 1, y: 0 }}`, 200 ms. Salida: igual, 150 ms.
- Elementos internos en cascada: `stagger(i, 0.03, 0.2)`.
- Cerrar con `Escape`, clic fuera y al navegar.

### 3.3 Desglose de costos que crece
- En `frontend/src/components/shipments/shipment-detail.tsx` (tarjeta "Costos").
- Cada barra: `motion.div` con `initial={{ scaleX: 0 }}` → `animate={{ scaleX: porcentaje }}`,
  `style={{ transformOrigin: "left" }}`, 600 ms, retraso `i * 0.08`.
- Cifra a la derecha con `CountUp` (ya existe).

### 3.4 Filtros de la tabla
- Chips de estado y modo en `shipments-table.tsx`: al activar, la chip cambia de color con
  `transition-colors 200ms`; la lista de envíos filtrada hace fundido (`opacity`) de 200 ms al cambiar
  (`key` basado en el filtro para forzar el ciclo).

### 3.5 Criterios de aceptación del lote 2
- [ ] Ningún panel cambia de altura sin animación.
- [ ] Menús se cierran con `Escape` y clic fuera; probado con teclado.
- [ ] Barras de costos crecen al entrar en pantalla (no al cargar fuera de vista).
- [ ] Con "reducir movimiento", los paneles aparecen sin transición.

---

## 4. Lote 3 — Objetos que se mueven

**Objetivo**: cuando un dato cambia, el objeto se desplaza en lugar de saltar.

### 4.1 Reordenamiento de tarjetas y filas
- Usar `layout` de framer-motion en las filas de la tabla y en las tarjetas del resumen
  (`motion.tr` / `motion.div` con `layout` y `layoutId` por código de envío).
- Limitar: `layout="position"` para evitar escalar contenido.
- Tope: si hay más de 40 filas visibles, desactivar `layout` (rendimiento).

### 4.2 Morph del mapa a pantalla completa
- En `frontend/src/components/map/network-explorer.tsx` y `shipment-detail.tsx`: el contenedor del mapa
  tiene `layoutId="map-frame"`; al activar pantalla completa, se anima con resorte a `position: fixed`
  con `inset: 0` y radio 0.
- El mapa en sí no se redibuja en la transición: solo cambia el contenedor. Tras la transición, llamar a
  `deck.setProps({ width, height })` si el tamaño cambió.
- Medir fotogramas durante la transición (ver §7). No puede bajar de 45 fps en el equipo de prueba.

### 4.3 Entrada de vistas
- Al entrar a una página, las bandas y tarjetas entran con `opacity: 0, y: 12` → 0, escalonado. Usar un
  componente `Reveal` (ya existe en `components/reveal.tsx`): revisar que use `whileInView` con
  `viewport={{ once: true, margin: "-60px" }}`.

### 4.4 Transición compartida fila → detalle
- Código del envío con `layoutId={"code-" + code}` en la fila y en el encabezado del detalle.
- Solo el código; el resto de la página hace fundido.

### 4.5 Criterios de aceptación del lote 3
- [ ] Al filtrar, las filas se reacomodan con desplazamiento suave (no saltan).
- [ ] Morph del mapa sin salto de contenido.
- [ ] Transición compartida del código visible en la captura (fotogramas intermedios).
- [ ] Mapa: fps medido antes y después; sin caída.

---

## 5. Lote 4 — Íconos y detalles

**Objetivo**: los íconos tienen vida y las cifras se sienten vivas.

### 5.1 Íconos del menú
- En `sidebar.tsx`: el ícono activo hace un pequeño resorte de escala (1 → 1,12 → 1) al activarse (ya hay
  `scale-105`; cambiar a `motion` con `animate={{ scale: [1, 1.12, 1] }}`, 400 ms).
- Al pasar el cursor: `rotate` de −6° a 0° y escala 1,08 (200 ms). No rotar íconos de estado.

### 5.2 Cifras que cuentan al cambiar
- `CountUp` hoy anima solo al montar. Añadir prop `value` reactivo: al cambiar, anima desde el valor
  anterior (no desde cero). Archivo: `components/ui/count-up.tsx`.
- Aplicar a: métricas del resumen, contadores de la barra de filtros de envíos ("En ruta 14").

### 5.3 Notificaciones
- Componente de aviso (toast) que entra desde abajo con resorte, sale con fundido.
- Si existe un sistema de avisos, reemplazar la animación; si no, crear `components/ui/toast.tsx` con
  cola de máximo 3 avisos y cierre automático a los 4 s.

### 5.4 Iconos de confirmación
- Al guardar con éxito, el ícono del botón hace transición de `Save` a `Check` (escala + fundido, 250 ms),
  y la chispa usa `Check` como ícono.

### 5.5 Criterios de aceptación del lote 4
- [ ] Íconos del menú responden al cursor y al activarse.
- [ ] Cifras cuentan desde el valor anterior al cambiar.
- [ ] Toasts con cola y cierre automático, legibles en móvil.
- [ ] Botón Guardar cambia su ícono al éxito.

---

## 6. Lote 5 — Pulido y verificación

### 6.1 Recorrido completo
- Escritorio 1400 px y móvil 390 px, tema claro y oscuro.
- Pantallas: Resumen, Envíos, Detalle, Nuevo envío, Red (`/red`), Vías, Flota, Bodegas, Combustible,
  Huella, Configuración.
- Por cada pantalla: capturas en `docs/capturas/` (crear carpeta) y checklist de `PLAN_DISENO_VISUAL.md` §8.

### 6.2 Rendimiento
- Medir fotogramas con el script de `scratchpad/e2e/stall.mjs` (ruta del repositorio, no del scratchpad,
  en documentación) en `/red` y en el detalle, antes y después de cada lote.
- Umbral: ningún bloqueo > 100 ms adicional frente a la línea base.

### 6.3 Reducir movimiento
- Activar la preferencia en Chromium (emulación `prefers-reduced-motion: reduce`) y recorrer la app:
  no debe haber escala, chispas, conteo, morph ni cascada.

### 6.4 Accesibilidad
- Teclado: todo menú y panel se abre y se cierra sin ratón.
- Ejecutar `accessibility-scan` (skill instalada) sobre `/envios`, `/red` y el detalle.

---

## 7. Cómo verificar cada cambio (comandos)

```bash
cd frontend && npx tsc --noEmit && npx eslint src && npx next build
```

Servidores locales (copia de la base en el scratchpad de la sesión anterior; si no existe, usar
`backend/data/logistics.db`, sin modificarla):

```bash
cd backend && WESTVANE_DB_PATH=/ruta/copia.db python -m uvicorn app.main:app --port 8000
cd frontend && API_INTERNAL_URL=http://127.0.0.1:8000 npx next start -p 3000
```

Playwright (chromium del sistema):

```js
import { chromium } from "playwright-core";
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
```

Notas:
- Matar procesos con `fuser -k 3000/tcp 8000/tcp`; `pkill -f` puede matar la propia shell.
- Si el puerto 3000 sigue ocupado, el `next start` nuevo falla y se prueba una compilación vieja.
- `next build` puede fallar por aviso de seguridad de la versión de Next: la versión actual es 16.4.3.

---

## 8. Archivos que probablemente cambian

| Archivo | Lote |
|---|---|
| `frontend/src/app/globals.css` (`.press`, curvas) | 1 |
| `frontend/src/components/ui/burst.tsx`, `burst-link.tsx` | 1 (hecho) |
| `frontend/src/components/ui/ripple.tsx` (nuevo) | 1 |
| `frontend/src/components/ui/button.tsx` | 1 |
| `frontend/src/components/ui/collapsible-panel.tsx` (nuevo) | 2 |
| `frontend/src/components/shell/sidebar.tsx` | 2, 4 |
| `frontend/src/components/shipments/shipment-detail.tsx` | 2, 3, 4 |
| `frontend/src/components/shipments/shipments-table.tsx` | 2, 3 |
| `frontend/src/components/dashboard/*` (resumen) | 3, 4 |
| `frontend/src/components/map/network-explorer.tsx`, `Map3D.tsx` | 3 (con cuidado) |
| `frontend/src/components/ui/count-up.tsx` | 4 |
| `frontend/src/components/ui/toast.tsx` (nuevo) | 4 |
| `frontend/src/lib/motion.ts` (constantes nuevas) | 1–4 |

---

## 9. Riesgos y decisiones

- **Mapa**: es el riesgo principal. Cualquier animación que obligue a redibujar el mapa en cada cuadro
  está prohibida. El morph de pantalla completa anima el contenedor, no el contenido del mapa.
- **Rendimiento en equipos lentos**: si una medición empeora, se reduce el efecto (menos chispas, sin
  layout) antes que quitar la regla.
- **Exceso de movimiento**: el objetivo es fluidez, no espectáculo permanente. Ningún elemento debe moverse
  sin una acción del usuario, salvo el punto de estado del sistema y el conteo de cifras al cargar.
- **Pendiente de confirmación del usuario** (ver `docs/PLAN_DISENO_VISUAL.md` §10): navegación (dock o
  lateral), tema por defecto, regla del mapa en reposo, paleta de modos y cifras hero del resumen.

---

## 10. Orden de trabajo sugerido para la siguiente sesión

1. Confirmar con el usuario las decisiones de §9 y de `PLAN_DISENO_VISUAL.md` §10.
2. Lote 1 completo (presión, onda, chispas en acciones clave). Verificar captura visual.
3. Lote 2 (acordeón, menús, desglose de costos, filtros).
4. Lote 3 (reordenamiento, morph de mapa, transición compartida). Medir mapa.
5. Lote 4 (íconos, cifras, toasts, Guardar → Check).
6. Lote 5 (recorrido, rendimiento, reducir movimiento, accesibilidad). Actualizar `docs/BITACORA.md`.

Cada lote: una rama o commit por lote, mensaje claro, subido a `main` solo tras verificación en navegador.
