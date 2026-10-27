# Westvane TMS — Plan completo de diseño y movimiento (traspaso)

> Documento único para continuar en otra sesión. Contiene: 1) plan de diseño visual, 2) plan de movimiento, 3) los cuatro documentos de estilo de referencia completos (Apple, Mercury, Analogue, Notion).

---

# Plan de diseño visual — Westvane TMS

> Documento de traspaso para continuar el trabajo visual en otra sesión.
> Lee primero `docs/BITACORA.md` (estado general) y este archivo (qué hacer en el diseño).
> Fecha: 27 de octubre de 2026.

---

## 1. Objetivo

Que Westvane se vea y se sienta como un producto de marca premium: precisión visual, animaciones con
intención, fluidez en cada interacción y cero "dashboard genérico". La app es operativa (envíos, red,
mapa, flota), así que la perfección se mide en detalles: jerarquía, ritmo, transiciones, estados vacíos,
foco de teclado, respuesta al toque y coherencia entre pantallas.

No es un rediseño de funciones. No cambia la lógica, ni la API, ni el flujo de datos.

---

## 2. Punto de partida (lo que ya existe)

| Área | Estado actual | Archivo |
|---|---|---|
| Tokens de color | Base estilo Apple: fondo `#f2f2f7`, tarjeta `#ffffff`, oscuro `#000000` / `#1c1c1e` | `frontend/src/app/globals.css` (líneas 16–110) |
| Fuente | Pila SF Pro + Inter Variable (instalada con `@fontsource-variable/inter`) | `globals.css` línea 177 |
| Radios | `--radius-lg: 0.875rem`, `md: 0.625rem`, `sm: 0.375rem` | `globals.css` 183–185 |
| Vidrio | Clases `.glass` y `.material` | `globals.css` 285–290 |
| Movimiento | Curva única `EASE = [0.16, 1, 0.3, 1]`, `T_FAST` 0.3 s, `T_VIEW` 0.5 s, `stagger`, `hoverLift` | `frontend/src/lib/motion.ts` |
| Menú | Barra lateral de vidrio, contraíble, indicador `layoutId`, resplandor al puntero, estado del sistema | `frontend/src/components/shell/sidebar.tsx` |
| Búsqueda | Paleta Ctrl K | `components/shell/command-palette.tsx` |
| Mapa | deck.gl + MapLibre, animación solo al interactuar o en pantalla completa (pendiente de implementar) | `components/Map3D.tsx`, `components/map/*` |
| Tablas | TanStack Table, tarjetas en móvil | `components/shipments/shipments-table.tsx` |
| Detalle | Tarjetas con historial en línea de tiempo y desglose de costos | `components/shipments/shipment-detail.tsx` |

**Problemas visuales conocidos** (revisar al iniciar):
- El menú lateral sigue siendo un panel de dashboard convencional. Es lo que el usuario pidió evitar.
- Las tarjetas dependen de sombras y bordes de forma poco uniforme.
- La jerarquía tipográfica de títulos y cifras grandes es plana; faltan cifras "hero".
- Las transiciones entre páginas no existen: la navegación es un salto.
- Los estados vacíos y de carga son texto plano o esqueletos genéricos.
- El mapa se pega al iniciar en equipos con poca GPU (ver `docs/BITACORA.md`). Todo cambio visual del
  mapa no debe añadir trabajo por cuadro.

---

## 3. Referencias y qué se toma de cada una

Se analizaron cuatro documentos de estilo (no se copia la marca: se toman principios). Las fuentes
propietarias de cada marca (SF Pro, arcadia, circularXx, NotionInter) **no se usan**; se usa Inter Variable,
que ya está instalada y soporta cualquier peso entre 100 y 900.

| Referencia | Qué aporta a Westvane | Qué NO tomar |
|---|---|---|
| **Apple** (fondo claro `#f5f5f7`, bandas alternas, tarjetas 28 px sin sombra, pill azul `#0071e3` para conversión, display 80 px con −1,2 px) | Base clara elegante, ritmo entre secciones, cifras grandes con tracking negativo, medios con radio 28 px | Fotografía de producto (no hay), enlaces azules en exceso |
| **Mercury** (oscuro `#171721`, tarjeta `#1e1e2a` a un paso de luz, un solo acento `#5266eb`, controles pill, peso 480) | Modo oscuro sobrio, un único acento de acción, peso intermedio 480 en títulos, separación por valor y no por sombra | Hero con foto, banca |
| **Analogue** (negro puro, monocromo estricto, tarjetas 17,6 px con borde hairline, tracking muy negativo en display, sin gradientes) | Disciplina monocroma en mapa y paneles, bordes hairline, tracking agresivo en cifras grandes | Hardware como protagonista, cartuchos flotantes |
| **Notion** (crema `#f6f5f4`, tarjetas blancas 12 px con borde 8 %, acentos por tarjeta, pill resaltado, marcas de personaje) | Colores de categoría en tarjetas (uno por modo de transporte), pill resaltado para el dato clave, transiciones de 200 ms | Mascotas e ilustraciones decorativas (no aportan información) |

### Decisión de sistema

**Base: Apple (claro) + Mercury (oscuro).** La app ya está en esa dirección. Se refina, no se reemplaza.

- Tema claro por defecto, tema oscuro como alternativa (ya existe el selector).
- Un solo acento de acción: `#0071e3` en claro, `#5266eb` en oscuro (el de Mercury).
- Colores de categoría (uno por modo) solo para indicar el modo, nunca para decorar:
  - Terrestre: verde azulado `#0f9d7a`
  - Fluvial: azul `#0a84ff`
  - Marítimo: índigo `#5e5ce6`
  - Aéreo: magenta `#d6399b`
  - Férreo: ámbar `#c98a00`
- Los colores de estado (éxito, advertencia, error) siguen siendo semánticos y no compiten con el acento.

---

## 4. Tokens propuestos

Reemplazan los valores actuales de `globals.css`. Los nombres de variables se mantienen para no romper
componentes.

```css
:root {
  /* Superficies (tema claro) */
  --background: #f5f5f7;        /* canvas, bandas alternas */
  --card: #ffffff;               /* tarjetas, sin sombra */
  --raised: #f0f0f3;             /* superficie elevada: inputs, pills de fondo */
  --separator: rgba(0, 0, 0, 0.08);   /* hairline */
  --separator-strong: rgba(0, 0, 0, 0.16);

  /* Texto */
  --foreground: #1d1d1f;
  --muted-foreground: #6e6e73;   /* contraste 5,1:1 sobre #f5f5f7 */

  /* Acción */
  --primary: #0071e3;
  --primary-foreground: #ffffff;

  /* Radios */
  --radius-card: 20px;           /* tarjetas */
  --radius-media: 28px;          /* mapas, medios, paneles grandes */
  --radius-control: 999px;       /* botones, pills, buscador */
  --radius-field: 12px;          /* inputs de formulario */
  --radius-chip: 8px;            /* etiquetas pequeñas */
}

.dark {   /* o :root[data-theme="dark"] según el selector existente */
  --background: #000000;
  --card: #1c1c1e;
  --raised: #2c2c2e;
  --separator: rgba(255, 255, 255, 0.10);
  --separator-strong: rgba(255, 255, 255, 0.20);
  --foreground: #f5f5f7;
  --muted-foreground: #a1a1a6;
  --primary: #5266eb;
  --primary-foreground: #ffffff;
}
```

**Escala tipográfica** (Inter Variable, `font-feature-settings: "cv11", "ss01"` para cifras limpias):

| Uso | Tamaño | Peso | Tracking | Interlineado |
|---|---|---|---|---|
| Cifra hero (KPI principal) | 64–80 px | 600 | −0,045 em | 1,0 |
| Título de página | 40–48 px | 600 | −0,03 em | 1,05 |
| Título de sección | 28 px | 600 | −0,02 em | 1,15 |
| Subtítulo | 21 px | 500 | −0,015 em | 1,25 |
| Cuerpo | 15–16 px | 400 | −0,01 em | 1,5 |
| Etiqueta, metadatos | 12–13 px | 500 | 0 | 1,3 |
| Cifras de tabla | 14 px | 500 | 0 | 1,2 + `font-variant-numeric: tabular-nums` |

**Ritmo**: separación entre secciones 72–90 px; padding de tarjeta 24 px (móvil 20 px, escritorio 28 px);
separación entre elementos relacionados 12–16 px.

---

## 5. Navegación: la parte que más cambia

El usuario pidió explícitamente no tener un dashboard con menú lateral genérico. Propuesta (pendiente de
confirmar, ver sección 10):

**Escritorio**: dock flotante superior, centrado, de vidrio (`backdrop-filter: blur(20px) saturate(180%)`)
con borde hairline y radio 999 px.
- Contiene: logotipo a la izquierda, cinco destinos principales al centro (Resumen, Envíos, Red, Flota,
  Más), búsqueda como pill con `⌘K` a la derecha, selector de moneda y tema.
- "Más" despliega un panel con las demás secciones, con entrada en cascada (40 ms entre elementos).
- Se contrae a solo íconos al hacer scroll hacia abajo y vuelve al expandirse con el puntero o el foco.
- El indicador activo es una píldora que se desliza con `layoutId` y resorte (`stiffness 420`,
  `damping 38`).

**Móvil**: dock inferior flotante con cuatro destinos e ícono de "Más" que abre una hoja desde abajo
(no desde la izquierda). La hoja se cierra arrastrándola hacia abajo.

**Conservar**: el estado del sistema (punto que respira) pasa al dock como un punto junto al logotipo.

---

## 6. Pantallas: qué cambiar en cada una

### 6.1 Resumen (dashboard)
- Eliminar la cuadrícula de tarjetas iguales. Usar bandas de ancho completo alternando canvas
  (`--background` y `--card`), como en Apple.
- Banda principal: saludo + cifra hero (envíos en ruta) con conteo animado (0 → valor en 900 ms, curva
  `EASE`), y tres métricas secundarias con separador hairline.
- Mapa en miniatura en tarjeta de radio 28 px, **estático** hasta que el usuario lo toque (regla acordada).
- Alertas como lista con íconos de color semántico, no como tarjetas de colores.
- Cada tarjeta entra con `opacity` y `y: 12 → 0` escalonado (`stagger`, máximo 0,4 s).

### 6.2 Envíos (tabla)
- Encabezado pegajoso con desenfoque al hacer scroll.
- Filas: hover con fondo `--raised` y transición de 200 ms; la fila seleccionada se marca con un hairline
  a la izquierda.
- Chips de estado en píldora de color suave (fondo al 12 %, texto sólido).
- Barra de avance: relleno con el color del modo, animado con `scaleX` al entrar.
- Esqueleto de carga con brillo que recorre (shimmer) en lugar de bloques grises.
- Estado vacío con ilustración tipográfica (cifra 0 + frase corta + botón primario), no solo texto.

### 6.3 Detalle del envío
- Encabezado hero: código en 40 px, ruta en 21 px con las ciudades separadas por una flecha, chips de
  estado y modo.
- Transición compartida desde la fila de la tabla hacia el encabezado (`view-transition-name` o
  `layoutId` del código).
- Línea de tiempo del historial: ya existe; añadir animación de trazo al entrar.
- Desglose de costos: barras horizontales por componente (fletes, peajes, manipulación, impuestos),
  proporcionales al total, con cifra a la derecha. Reemplaza las filas de texto.
- Mapa: tarjeta de radio 28 px. Al pulsar "Pantalla completa", el marco crece con `layoutId` hasta ocupar
  la pantalla (morph, no salto).

### 6.4 Red multimodal y simulador (`/red`)
- Panel flotante de vidrio sobre el mapa, radio 20 px, con sombra suave solo en este elemento flotante
  (única excepción a la regla sin sombras).
- Leyenda como pills de color por modo, con conmutador animado.
- La animación de vehículos sigue la regla acordada: solo al arrastrar, usar la rueda o en pantalla
  completa. En reposo, el mapa queda quieto.
- Los paneles flotantes se muestran con `opacity` + `scale 0,98 → 1` (no con desplazamiento lateral, que
  obliga a recalcular el mapa).

### 6.5 Nuevo envío / editar (formulario)
- Una columna, campos con radio 12 px, altura 44 px, etiqueta arriba en 13 px.
- Validación en línea: el mensaje de error aparece con `opacity` y 4 px de desplazamiento.
- Botón de guardar pill; mientras guarda, el texto se sustituye por un punto que respira (no un spinner).
- Al guardar con éxito, el detalle entra con la transición compartida del código.

### 6.6 Vías, flota, bodegas, combustible, huella, configuración
- Mismo sistema de tarjetas y tablas que envíos.
- Configuración: la tabla de peajes pasa a ser tabla de filas con separadores hairline y guardado por fila
  con cambio de color del botón (ya existe la lógica).

---

## 7. Movimiento: reglas

- **Una sola curva**: `EASE = [0.16, 1, 0.3, 1]` (ya definida). Resortes solo para indicadores que se
  deslizan (`layoutId`) y para el morph de pantalla completa.
- **Duraciones**: 200 ms para hover y color; 300 ms para aparecer y ocultar; 500 ms para entrada de
  vista; 900 ms para conteo de cifras.
- **Solo `transform` y `opacity`**. Nada de animar `width`, `height`, `top` o `box-shadow` en listas o en
  el mapa.
- **Escalonado** máximo 0,4 s total. Nunca más de 12 elementos animados a la vez.
- **Reducir movimiento**: si `prefers-reduced-motion`, todas las animaciones se vuelven fundidos de 150 ms
  y no hay desplazamiento, conteo ni morph. `MotionProvider` ya respeta esto; verificarlo en cada componente
  nuevo.
- **Presión**: el botón se escala a 0,97 al presionar (`whileTap`), 120 ms.
- **Foco de teclado**: anillo de 3 px `--primary` al 60 %, sin animar el anillo.

Implementación sugerida:
- Transiciones entre páginas con la API de View Transitions donde el navegador la soporte, con
  `framer-motion` como respaldo.
- Hover de tarjetas: `hoverLift` existente (escala 1,02 y elevación de 2 px) solo en tarjetas
  clicables; las tarjetas de solo lectura no reaccionan.

---

## 8. Detalles de pulido (lista de verificación)

Usar esta lista como criterio de aceptación por pantalla.

- [ ] Ningún texto de cuerpo por debajo de 13 px.
- [ ] Contraste de texto de cuerpo ≥ 4,5:1 en ambos temas (WCAG AA).
- [ ] Cifras de tabla con `tabular-nums`, alineadas a la derecha.
- [ ] Ningún borde de 1 px sin usar `--separator` (nada de grises a mano).
- [ ] Sin sombras en tarjetas; solo en elementos flotantes.
- [ ] Radios: tarjeta 20, medio 28, control 999, campo 12, chip 8. Ningún otro valor.
- [ ] Estados vacío, cargando y error diseñados en cada lista.
- [ ] Foco visible en todos los controles interactivos (teclado).
- [ ] Objetivo táctil ≥ 44 px en móvil.
- [ ] Sin desplazamiento horizontal en 390 px de ancho.
- [ ] Iconos de un solo trazo, mismo grosor (1,5 px) y tamaño de 18 px en menú y 16 px en tablas.
- [ ] Números de la app en formato colombiano (separador de miles con punto) en todas las pantallas.
- [ ] Los textos en español con tildes y signos de apertura correctos.

---

## 9. Plan de trabajo por fases

Cada fase termina con: `npx tsc --noEmit`, `npx eslint src`, `npx next build` sin errores, y capturas
desktop + móvil guardadas en `docs/capturas/` (crear la carpeta).

### Fase 0 — Línea base (30 min)
1. Tomar capturas de todas las pantallas (escritorio 1400 px y móvil 390 px), en ambos temas.
2. Medir tiempo de carga y de cada fotograma en `/red` y en el detalle (ver `scratchpad/e2e`).
3. Guardar la línea base en `docs/capturas/antes/`.

### Fase 1 — Tokens y tipografía (1–2 h)
1. Reemplazar valores de `globals.css` según la sección 4.
2. Añadir la escala tipográfica como utilidades o clases (`.text-hero`, `.text-title`, etc.).
3. Aplicar radios por tipo de elemento (sección 8).
4. Revisar contrastes con la herramienta del navegador o `accessibility-scan`.

### Fase 2 — Navegación (2–3 h)
1. Reemplazar `sidebar.tsx` por el dock de la sección 5.
2. Conservar: búsqueda Ctrl K, selector de moneda, selector de tema, estado del sistema, operador.
3. Móvil: dock inferior y hoja desde abajo con arrastre para cerrar.
4. Verificar atajos de teclado existentes (`shortcuts.tsx`) siguen funcionando.

### Fase 3 — Resumen (2 h)
1. Banda hero con cifra animada y métricas secundarias.
2. Bandas alternadas de fondo.
3. Mapa en miniatura estático con radio 28 px.

### Fase 4 — Envíos y detalle (3 h)
1. Tabla: encabezado pegajoso, filas, chips, barras, esqueleto, estado vacío.
2. Transición compartida fila → detalle.
3. Detalle: encabezado hero, desglose de costos en barras, mapa con morph a pantalla completa.

### Fase 5 — Mapa y formularios (2–3 h)
1. Panel flotante de vidrio en `/red`, leyenda con pills.
2. Animación del mapa solo con interacción o pantalla completa (regla acordada; ver `docs/BITACORA.md`).
3. Formularios: columna única, validación en línea, guardado con punto que respira.

### Fase 6 — Pulido y verificación (2 h)
1. Recorrer la lista de la sección 8 en cada pantalla.
2. Probar `prefers-reduced-motion` (Chromium: emulación de CSS).
3. Medir fotogramas en `/red` antes y después; no puede empeorar.
4. Playwright en 390 px: sin desplazamiento horizontal.
5. Actualizar `docs/BITACORA.md` y `docs/AUDITORIA_BOTONES.md` si cambian controles.

---

## 10. Decisiones que necesitan confirmación del usuario

1. **Navegación**: dock flotante superior (propuesto) o barra lateral contraíble (la actual)?
2. **Tema por defecto**: claro (propuesto) u oscuro?
3. **Animación del mapa en reposo**: se queda quieta fuera de pantalla completa (regla propuesta) o sigue
   animada en `/red`?
4. **Colores de modo**: aprobar la paleta de la sección 3 o mantener la actual?
5. **Cifras hero**: qué tres números quiere ver primero en el resumen (propuesto: envíos en ruta, retrasos,
   ingresos o costo acumulado)?

---

## 11. Restricciones

- No cambiar la lógica de negocio, la API ni el esquema de base de datos.
- No añadir fuentes propietarias de otras marcas.
- No añadir fotografía de terceros; las imágenes son del mapa y del producto.
- No sumar trabajo por fotograma al mapa.
- Mantener español de México/Colombia en textos visibles (ya existe así en la app).
- No añadir contraseña de la aplicación sin que el usuario lo pida (ver `docs/BITACORA.md`).
- Todo cambio visual debe verificarse en el navegador con capturas antes de subirlo a `main`.

---

## 12. Referencias de los documentos originales

Los cuatro documentos de estilo fueron la base del análisis de la sección 3. Si la otra sesión no puede
leerlos, los valores clave ya están copiados en las secciones 3 y 4. Los originales estaban en
`/root/.claude/uploads/b96ef949-132d-503e-ae72-786b01cbb37f/` (archivos `*-DESIGN*.md`).

---

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

---

# Anexo: referencia apple

# Apple — Style Reference
> foldable device in a white gallery. Center product renders as the visual event, with typography and blue controls kept deliberately quiet around it.

**Theme:** light

Source measurements are normalized; roles and recommendations are interpreted. Font summary lists are independent, not paired by position. HTML examples are reconstructions, not source components.

Apple treats the product page as a white gallery: enormous product photography occupies the center while compact black typography gives each claim a controlled, almost editorial weight. The page alternates seamless white storytelling sections with #f5f5f7 feature bands containing oversized #ffffff cards, using one saturated blue only for links and compact conversion controls. Rounded 28px media frames soften the hardware-led composition without turning the page into a card dashboard; nearly every surface stays flat and shadowless.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Gallery White | `#ffffff` | `--color-gallery-white` | Primary page canvas, hero background, product story sections, and feature-card surfaces |
| Studio Mist | `#f5f5f7` | `--color-studio-mist` | Alternate full-width section background, feature-stage backdrop, footer surface, and muted content blocks |
| Paper Frost | `#fafafc` | `--color-paper-frost` | Opened global-navigation surface and secondary pale fill |
| Hairline Silver | `#d6d6d6` | `--color-hairline-silver` | 1px dividers, restrained control outlines, and subtle separators |
| Control Gray | `#e6e6e8` | `--color-control-gray` | Disabled control fills, subdued utility surfaces, and single-pixel navigation edge treatment |
| Ink | `#1d1d1f` | `--color-ink` | Headlines, primary body copy, navigation labels, and dark utility icons |
| Slate | `#707070` | `--color-slate` | Secondary copy, legal text, subdued navigation content, and low-emphasis glyphs |
| Steel | `#86868b` | `--color-steel` | Input outlines, inactive indicators, and fine outlined-control edges |
| Apple Blue | `#0066cc` | `--color-apple-blue` | Inline links, section links, and blue text controls — a precise blue punctuation against monochrome product storytelling |
| Pricing Blue | `#0071e3` | `--color-pricing-blue` | Filled pricing and learn-more controls — the brighter blue reserves visual urgency for compact conversion moments |
| Launch Orange | `#b64400` | `--color-launch-orange` | Small launch-status labels such as new-product markers |

## Tokens — Typography

### SF Pro Display — Product names, display headlines, large feature statements, and section-level product claims. The 80px/600 hero treatment tightens to -1.2px, making the largest type feel compact rather than promotional. · `--font-sf-pro-display`
- **Substitute:** Inter, Helvetica Neue, Arial
- **Weights:** 400, 500, 600
- **Sizes:** 19px, 21px, 24px, 28px, 40px, 48px, 80px
- **Line height:** 1.00, 1.05, 1.08, 1.14, 1.17, 1.21, 1.33, 1.38
- **Letter spacing:** -1.2px at 80px; normal at 40px; +0.23px at 19-21px; profile range -0.015em to 0.012em
- **OpenType features:** `"numr"`
- **Role:** Product names, display headlines, large feature statements, and section-level product claims. The 80px/600 hero treatment tightens to -1.2px, making the largest type feel compact rather than promotional.

### SF Pro Text — Navigation, body copy, links, compact buttons, pricing details, labels, and footnotes. The consistently negative tracking lets small interface text remain dense and Apple-specific instead of looking like generic system UI. · `--font-sf-pro-text`
- **Substitute:** Inter, Helvetica Neue, Arial
- **Weights:** 400, 500, 600
- **Sizes:** 10px, 12px, 14px, 17px, 20px, 26px, 44px
- **Line height:** 1.00, 1.18, 1.24, 1.29, 1.33, 1.43, 1.47
- **Letter spacing:** -0.37px at 10px, -0.12px at 12px, -0.22px at 14px, -0.37px at 17px; profile range -0.037em to -0.003em
- **OpenType features:** `"numr"`
- **Role:** Navigation, body copy, links, compact buttons, pricing details, labels, and footnotes. The consistently negative tracking lets small interface text remain dense and Apple-specific instead of looking like generic system UI.

### Arial — Fallback text inside the observed search/input control only. · `--font-arial`
- **Substitute:** Arial
- **Weights:** 400
- **Sizes:** 13px
- **Line height:** 1.20
- **Role:** Fallback text inside the observed search/input control only.

### Type Scale

| Role | Family | Weight | Size | Line Height | Letter Spacing | Token |
|------|--------|--------|------|-------------|----------------|-------|
| global-nav | SF Pro Text | 400 | 12px | 1 | -0.12px | `--text-global-nav` |
| compact-control | SF Pro Text | 400 | 12px | 1.33 | -0.12px | `--text-compact-control` |
| body-small | SF Pro Text | 400 | 14px | 1.29 | -0.224px | `--text-body-small` |
| body | SF Pro Text | 400 | 17px | 1.47 | -0.374px | `--text-body` |
| feature-copy | SF Pro Text | 400 | 17px | 1.24 | -0.374px | `--text-feature-copy` |
| product-nav-title | SF Pro Display | 600 | 19px | 1.21 | 0.228px | `--text-product-nav-title` |
| product-kicker | SF Pro Display | 600 | 21px | 1 | 0.231px | `--text-product-kicker` |
| feature-heading | SF Pro Display | 600 | 40px | 1 | 0px | `--text-feature-heading` |
| hero-display | SF Pro Display | 600 | 80px | 1.05 | -1.2px | `--text-hero-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 28 | 28px | `--spacing-28` |
| 32 | 32px | `--spacing-32` |
| 40 | 40px | `--spacing-40` |
| 48 | 48px | `--spacing-48` |
| 52 | 52px | `--spacing-52` |
| 64 | 64px | `--spacing-64` |
| 76 | 76px | `--spacing-76` |
| 80 | 80px | `--spacing-80` |
| 128 | 128px | `--spacing-128` |
| 144 | 144px | `--spacing-144` |

### Border Radius

| Element | Value |
|---------|-------|
| cards | 28px |
| links | 10px |
| pills | 36px |
| badges | 0px |
| images | 28px |
| inputs | 980px |
| buttons | 9999px |
| navigation | 20px |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| subtle | `rgb(230, 230, 232) 0px 0px 0px 1px` | `--shadow-subtle` |
| subtle-2 | `rgb(134, 134, 139) 0px 0px 0px 1px` | `--shadow-subtle-2` |

### Layout

- **Section gap:** 90px
- **Card padding:** 28px
- **Element gap:** 20px

## Components

### Global Store Navigation
**Role:** Persistent utility navigation

A 44px-tall white navigation bar with Apple glyph, compact SF Pro Text 12px/400 links, and rgba(0,0,0,0.8) labels. Keep controls unboxed; opened navigation uses #fafafc with a 1px #e6e6e8 edge and blur(20px).

### Product Local Navigation
**Role:** Product-page header and conversion controls

A white local bar carries the product name in SF Pro Display 19px/600 and compact right-aligned pill controls. Use a 20px container radius where the local bar is floated over the page, with #d6d6d6 as the hairline boundary.

### Outlined Explore Pill
**Role:** Secondary product-navigation control

Use transparent fill, #1d1d1f text, a 1px #86868b outline, and a 9999px radius. Set compact SF Pro Text 12px/400 type with 16px line height; do not give this secondary control a colored fill.

### Pricing Blue Pill
**Role:** Filled conversion control

Use #0071e3 fill with #ffffff SF Pro Text 12px/400 at 16px line height and -0.12px tracking. Set a 9999px radius; this blue treatment stays compact inside the product bar and floating pricing callout.

### Hero Product Stage
**Role:** Launch introduction

Set a #ffffff full-bleed visual stage with centered product name in SF Pro Display 21px/600, then an 80px/600 display statement at 84px line height and -1.2px tracking. Place the foldable-device render directly beneath the text without a containing card.

### Floating Pricing Callout
**Role:** Purchase context over product imagery

Float a #ffffff rounded 28px capsule near the lower product render with 14px/600 #1d1d1f pricing text and compact secondary copy. Keep the blue Pricing Blue pill inside the callout; do not use drop shadows.

### Section Anchor Navigation
**Role:** In-page feature navigation

Render a horizontal list of SF Pro Text 17px/500 labels at 25px line height and -0.374px tracking in #1d1d1f. Use transparent backgrounds, 28px vertical padding, and no card or underline treatment.

### Highlights Stage
**Role:** Feature-carousel section

Use #f5f5f7 as the full section background, with a large #1d1d1f section heading and an Apple Blue text link aligned opposite it. Feature slides are #ffffff 28px-radius cards with no shadow.

### Feature Media Card
**Role:** Product-detail showcase

Use a #ffffff surface, 28px radius, no border, and no shadow. Center the device render with an SF Pro Display 24px/600 or 40px/600 feature statement above it; media may crop beyond the card edge.

### Carousel Playback Control
**Role:** Highlights media control

Use a translucent control track based on rgba(210,210,215,0.64), 36px radius, and subdued rgba(0,0,0,0.56) glyphs. Keep slide dots and pause control grouped in a small pill rather than adding visible card chrome.

### Editorial Feature Block
**Role:** Long-form product story

Place a small #1d1d1f SF Pro Display kicker above a large left-aligned display statement, followed by SF Pro Text 17px/400 body copy at approximately 21px line height and -0.374px tracking. The accompanying hardware image is oversized and allowed to enter from the opposite side.

### Rounded Search Input
**Role:** Global navigation search

Use #ffffff fill, #1d1d1f 13px Arial text, 24px left padding, 45px right padding, a 1px #86868b outline, and a 980px radius. Keep the default field visually absent until expanded from navigation.

### Launch Status Label
**Role:** New-product annotation

Use #b64400 SF Pro Text 12px/600 with 16px line height and -0.12px tracking. Leave it as plain text with no pill background or border.

## Do's and Don'ts

### Do
- Use #ffffff as the default product-story canvas and reserve #f5f5f7 for full-width feature bands and footer regions.
- Set display hero statements in SF Pro Display 80px/600, 84px line height, and -1.2px tracking.
- Use SF Pro Text 17px/400 with -0.374px tracking for feature paragraphs and in-page navigation at 17px/500.
- Use 28px radius for feature cards and contained media; keep those cards shadowless.
- Use #0071e3 only for compact filled conversion pills with #ffffff 12px SF Pro Text.
- Use #0066cc for inline links and textual section links rather than turning every navigation item blue.
- Space major storytelling sections by 90px and use 20px gaps between related interface elements.

### Don't
- Do not add gradients; product imagery supplies the page’s color and visual depth.
- Do not use shadows on feature cards, editorial blocks, or floating pricing capsules.
- Do not replace the 28px feature-card radius with 8px, 12px, or square corners.
- Do not use #0071e3 as a large hero background or a universal filled button color.
- Do not set hero headlines in bold 700 or wider tracking than -1.2px at 80px.
- Do not introduce colored status pills for launch labels; use bare #b64400 12px text.
- Do not place dense boxed UI panels over the product renders; keep #ffffff space around hardware imagery.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Gallery White | `#ffffff` | Primary hero, editorial canvas, local navigation, and feature-card surface. |
| 1 | Studio Mist | `#f5f5f7` | Alternate section band, carousel backdrop, muted content area, and footer. |
| 2 | Paper Frost | `#fafafc` | Opened global-navigation layer. |
| 3 | Control Gray | `#e6e6e8` | Disabled or subdued utility-control fill and thin navigation edge. |

## Elevation

Surfaces gain separation through #ffffff against #f5f5f7, 28px media corners, and sparse 1px #d6d6d6 edges rather than cast shadows. The only elevation-like marks are 0 0 0 1px outlines on navigation and selected controls.

## Imagery

The page is dominated by high-resolution product photography and device renders rather than illustration. Hardware is isolated against pure white or warm neutral image backdrops, often cropped at an oversized scale so the fold and thin profile become the composition; hands appear in the hero to demonstrate physical scale. Images are either edge-free on the white hero canvas or contained in large 28px-radius white cards against #f5f5f7. Product UI appears inside device screens as explanatory evidence, while icons remain small, monochrome global-navigation glyphs.

## Layout

The page begins with a compact global store navigation above a product-local navigation bar, then opens into a centered white hero with stacked product label, oversized headline, preorder copy, a dominant foldable-phone render, and a floating pricing capsule. Storytelling proceeds through a light-gray #f5f5f7 highlights band with a horizontally advancing set of large white 28px-radius media cards, followed by wide white editorial sections that pair left-aligned text blocks with oversized product imagery entering from the right or below. Section headers introduce each chapter, while an in-page horizontal anchor navigation supports long-form scrolling; the page is spacious, image-led, and does not rely on visible grid lines or conventional card stacks.

## Agent Prompt Guide

Quick Color Reference:
- Gallery White: #ffffff — Primary page canvas, hero background, product story sections, and feature-card surfaces
- Studio Mist: #f5f5f7 — Alternate full-width section background, feature-stage backdrop, footer surface, and muted content blocks
- Paper Frost: #fafafc — Opened global-navigation surface and secondary pale fill
- Hairline Silver: #d6d6d6 — 1px dividers, restrained control outlines, and subtle separators
- Control Gray: #e6e6e8 — Disabled control fills, subdued utility surfaces, and single-pixel navigation edge treatment
- Ink: #1d1d1f — Headlines, primary body copy, navigation labels, and dark utility icons
- Slate: #707070 — Secondary copy, legal text, subdued navigation content, and low-emphasis glyphs
- Steel: #86868b — Input outlines, inactive indicators, and fine outlined-control edges
- Apple Blue: #0066cc — Inline links, section links, and blue text controls — a precise blue punctuation against monochrome product storytelling
- Pricing Blue: #0071e3 — Filled pricing and learn-more controls — the brighter blue reserves visual urgency for compact conversion moments
- Launch Orange: #b64400 — Small launch-status labels such as new-product markers

Create a #ffffff launch hero with centered SF Pro Display 21px/600 product label and a centered 80px/600, 84px-line-height headline in Ink (#1d1d1f); place an oversized foldable-device render directly below with no enclosing card.
Create a Product Local Navigation bar with an SF Pro Display 19px/600 Ink product title, an outlined Explore Pill, and a Pricing Blue (#0071e3) 9999px-radius pricing pill using #ffffff SF Pro Text 12px/400.
Create a Studio Mist (#f5f5f7) highlights section with an Ink heading and Apple Blue (#0066cc) text link; use a #ffffff 28px-radius feature media card with no shadow and an SF Pro Display 40px/600 feature statement.
Create a white editorial product section with a left-aligned Ink feature statement and SF Pro Text 17px/400 body copy at 21px line height and -0.374px tracking; crop a large product photograph into the right side.
Create a floating #ffffff 28px-radius pricing callout over a product render using Ink 14px/600 pricing copy and a compact Pricing Blue 9999px-radius pill.

## Similar Brands

- **Google Pixel** — Product-led landing pages pair isolated hardware renders with generous white space and compact blue conversion controls.
- **Sony** — Large hardware photography and restrained editorial feature chapters make the product, rather than decorative interface chrome, carry the page.
- **Nothing** — Uses oversized device imagery and sparse product storytelling, though Apple’s palette is more monochrome and its controls are smaller.
- **Tesla** — Full-width product visual stages and minimal surrounding UI create a similarly showroom-like conversion flow.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-gallery-white: #ffffff;
  --color-studio-mist: #f5f5f7;
  --color-paper-frost: #fafafc;
  --color-hairline-silver: #d6d6d6;
  --color-control-gray: #e6e6e8;
  --color-ink: #1d1d1f;
  --color-slate: #707070;
  --color-steel: #86868b;
  --color-apple-blue: #0066cc;
  --color-pricing-blue: #0071e3;
  --color-launch-orange: #b64400;

  /* Typography — Font Families */
  --font-sf-pro-display: 'SF Pro Display', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-sf-pro-text: 'SF Pro Text', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-arial: 'Arial', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-global-nav: 12px;
  --leading-global-nav: 1;
  --tracking-global-nav: -0.12px;
  --text-compact-control: 12px;
  --leading-compact-control: 1.33;
  --tracking-compact-control: -0.12px;
  --text-body-small: 14px;
  --leading-body-small: 1.29;
  --tracking-body-small: -0.224px;
  --text-body: 17px;
  --leading-body: 1.47;
  --tracking-body: -0.374px;
  --text-feature-copy: 17px;
  --leading-feature-copy: 1.24;
  --tracking-feature-copy: -0.374px;
  --text-product-nav-title: 19px;
  --leading-product-nav-title: 1.21;
  --tracking-product-nav-title: 0.228px;
  --text-product-kicker: 21px;
  --leading-product-kicker: 1;
  --tracking-product-kicker: 0.231px;
  --text-feature-heading: 40px;
  --leading-feature-heading: 1;
  --tracking-feature-heading: 0px;
  --text-hero-display: 80px;
  --leading-hero-display: 1.05;
  --tracking-hero-display: -1.2px;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-52: 52px;
  --spacing-64: 64px;
  --spacing-76: 76px;
  --spacing-80: 80px;
  --spacing-128: 128px;
  --spacing-144: 144px;

  /* Layout */
  --section-gap: 90px;
  --card-padding: 28px;
  --element-gap: 20px;

  /* Border Radius */
  --radius-md: 4px;
  --radius-lg: 10px;
  --radius-2xl: 20px;
  --radius-3xl: 28px;
  --radius-3xl-2: 32px;
  --radius-3xl-3: 36px;
  --radius-full: 120px;
  --radius-full-2: 170px;
  --radius-full-3: 980px;
  --radius-full-4: 999px;
  --radius-full-5: 9999px;

  /* Named Radii */
  --radius-cards: 28px;
  --radius-links: 10px;
  --radius-pills: 36px;
  --radius-badges: 0px;
  --radius-images: 28px;
  --radius-inputs: 980px;
  --radius-buttons: 9999px;
  --radius-navigation: 20px;

  /* Shadows */
  --shadow-subtle: rgb(230, 230, 232) 0px 0px 0px 1px;
  --shadow-subtle-2: rgb(134, 134, 139) 0px 0px 0px 1px;

  /* Surfaces */
  --surface-gallery-white: #ffffff;
  --surface-studio-mist: #f5f5f7;
  --surface-paper-frost: #fafafc;
  --surface-control-gray: #e6e6e8;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-gallery-white: #ffffff;
  --color-studio-mist: #f5f5f7;
  --color-paper-frost: #fafafc;
  --color-hairline-silver: #d6d6d6;
  --color-control-gray: #e6e6e8;
  --color-ink: #1d1d1f;
  --color-slate: #707070;
  --color-steel: #86868b;
  --color-apple-blue: #0066cc;
  --color-pricing-blue: #0071e3;
  --color-launch-orange: #b64400;

  /* Typography */
  --font-sf-pro-display: 'SF Pro Display', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-sf-pro-text: 'SF Pro Text', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-arial: 'Arial', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-global-nav: 12px;
  --leading-global-nav: 1;
  --tracking-global-nav: -0.12px;
  --text-compact-control: 12px;
  --leading-compact-control: 1.33;
  --tracking-compact-control: -0.12px;
  --text-body-small: 14px;
  --leading-body-small: 1.29;
  --tracking-body-small: -0.224px;
  --text-body: 17px;
  --leading-body: 1.47;
  --tracking-body: -0.374px;
  --text-feature-copy: 17px;
  --leading-feature-copy: 1.24;
  --tracking-feature-copy: -0.374px;
  --text-product-nav-title: 19px;
  --leading-product-nav-title: 1.21;
  --tracking-product-nav-title: 0.228px;
  --text-product-kicker: 21px;
  --leading-product-kicker: 1;
  --tracking-product-kicker: 0.231px;
  --text-feature-heading: 40px;
  --leading-feature-heading: 1;
  --tracking-feature-heading: 0px;
  --text-hero-display: 80px;
  --leading-hero-display: 1.05;
  --tracking-hero-display: -1.2px;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-52: 52px;
  --spacing-64: 64px;
  --spacing-76: 76px;
  --spacing-80: 80px;
  --spacing-128: 128px;
  --spacing-144: 144px;

  /* Border Radius */
  --radius-md: 4px;
  --radius-lg: 10px;
  --radius-2xl: 20px;
  --radius-3xl: 28px;
  --radius-3xl-2: 32px;
  --radius-3xl-3: 36px;
  --radius-full: 120px;
  --radius-full-2: 170px;
  --radius-full-3: 980px;
  --radius-full-4: 999px;
  --radius-full-5: 9999px;

  /* Shadows */
  --shadow-subtle: rgb(230, 230, 232) 0px 0px 0px 1px;
  --shadow-subtle-2: rgb(134, 134, 139) 0px 0px 0px 1px;
}
```

---

# Anexo: referencia mercury

# Mercury — Style Reference
> Alpine banking at blue hour

**Theme:** dark

Source measurements are normalized; roles and recommendations are interpreted. Font summary lists are independent, not paired by position. HTML examples are reconstructions, not source components.

Mercury operates in an alpine banking aesthetic: a near-black canvas (#171721) sets a cinematic, observatory-like atmosphere where content surfaces float as subtly lighter graphite cards. The interface is overwhelmingly monochromatic — ivory text on onyx, with a single vivid cobalt (#5266eb) acting as the only chromatic punctuation, reserved exclusively for the primary 'Open account' action. Typography carries the weight of expression: a custom display face at intermediate weight 480 (neither bold nor light) paired with a refined body face at weight 400, creating a voice that is confident but never loud. Components are flat and borderless, relying on the 12px-radius graphite card lift and pill-shaped controls to define structure rather than shadows. The full-bleed photographic hero — misty mountains with a solitary desk — establishes aspiration before the product UI takes over, and every subsequent surface maintains that hushed, premium darkness.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Onyx Canvas | `#171721` | `--color-onyx-canvas` | Dominant page background, hero overlay base, footer and section canvases |
| Graphite Card | `#1e1e2a` | `--color-graphite-card` | Elevated card and section surfaces — one step lighter than the canvas to create quiet separation |
| Obsidian Button | `#272735` | `--color-obsidian-button` | Secondary button fills, inline form backgrounds, subtle interactive surfaces |
| Slate Border | `#70707d` | `--color-slate-border` | Medium-weight dividers and structural borders between content blocks |
| Mist Border | `#e2e3ed` | `--color-mist-border` | Light hairline borders, ghost-button outlines, input edges — light-on-dark border |
| Ash Text | `#c3c3cc` | `--color-ash-text` | Muted body copy, helper text, secondary labels — reduced hierarchy without losing legibility |
| Ivory Text | `#ededf3` | `--color-ivory-text` | Primary text, icons, nav items, ghost-button strokes and text — the dominant foreground color across the system |
| Cobalt | `#5266eb` | `--color-cobalt` | Violet action color for filled buttons, selected navigation states, and focused conversion moments. |
| Pure White | `#ffffff` | `--color-pure-white` | Text and icon fills on cobalt primary buttons for maximum contrast |

## Tokens — Typography

### arcadia — Body and UI typeface — handles navigation, body copy, buttons, inputs, labels, and supporting text at weight 400 for body and 480 for emphasis. The intermediate weight scale (360, 420, 480) instead of standard (300/400/600) gives Mercury's text a distinctly calibrated feel — never bold, never thin, always measured · `--font-arcadia`
- **Substitute:** Inter
- **Weights:** 360, 400, 420, 480
- **Sizes:** 12px, 14px, 16px, 18px, 21px
- **Line height:** 1.00–1.50
- **Letter spacing:** 0.005em at 14px, 0.01em at 12px
- **Role:** Body and UI typeface — handles navigation, body copy, buttons, inputs, labels, and supporting text at weight 400 for body and 480 for emphasis. The intermediate weight scale (360, 420, 480) instead of standard (300/400/600) gives Mercury's text a distinctly calibrated feel — never bold, never thin, always measured

### arcadiaDisplay — Headline and display typeface — used at weight 480 for all heading sizes from 28px through 65px, with 530 reserved for the largest display moments. Tight line-heights (1.1–1.2) and positive letter-spacing (0.01–0.02em) give display copy a wide-set, architectural quality rather than compressed editorial tightness · `--font-arcadiadisplay`
- **Substitute:** Söhne Breit
- **Weights:** 360, 480, 530
- **Sizes:** 21px, 24px, 28px, 32px, 42px, 49px, 65px
- **Line height:** 1.10–1.20
- **Letter spacing:** 0.01em at 42px, 0.015em at 32px, 0.02em at 24px
- **Role:** Headline and display typeface — used at weight 480 for all heading sizes from 28px through 65px, with 530 reserved for the largest display moments. Tight line-heights (1.1–1.2) and positive letter-spacing (0.01–0.02em) give display copy a wide-set, architectural quality rather than compressed editorial tightness

### Type Scale

| Role | Family | Weight | Size | Line Height | Letter Spacing | Token |
|------|--------|--------|------|-------------|----------------|-------|
| caption | — | — | 12px | 1 | 0.12px | `--text-caption` |
| body-sm | — | — | 14px | 1 | 0.07px | `--text-body-sm` |
| body | — | — | 16px | 1.5 | — | `--text-body` |
| body-lg | — | — | 18px | 1.35 | — | `--text-body-lg` |
| subheading | — | — | 21px | 1.35 | — | `--text-subheading` |
| heading-sm | — | — | 28px | 1.2 | 0.42px | `--text-heading-sm` |
| heading | — | — | 32px | 1.15 | 0.48px | `--text-heading` |
| heading-lg | — | — | 42px | 1.15 | 0.42px | `--text-heading-lg` |
| display | — | — | 65px | 1.1 | — | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** spacious

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 32 | 32px | `--spacing-32` |
| 40 | 40px | `--spacing-40` |
| 56 | 56px | `--spacing-56` |
| 72 | 72px | `--spacing-72` |
| 112 | 112px | `--spacing-112` |
| 128 | 128px | `--spacing-128` |

### Border Radius

| Element | Value |
|---------|-------|
| nav | 40px |
| tags | 40px |
| cards | 12px |
| inputs | 32px |
| buttons | 32px |
| default | 4px |

### Layout

- **Page max-width:** 1200px
- **Section gap:** 72px
- **Card padding:** 32px
- **Element gap:** 12px

## Components

### Primary CTA Button (Cobalt)
**Role:** The sole chromatic action in the system — reserved for the most important conversion

Filled with #5266eb Cobalt, white text at 16px arcadia weight 400, 32px border-radius (pill), 0px vertical padding with 20px horizontal padding for inline contexts, 40px vertical padding when standalone. No border, no shadow. The vivid blue against the dark canvas makes this button the gravitational center of any page.

### Ghost Outline Button
**Role:** Secondary or tertiary action on dark backgrounds

Transparent background, 1px solid #ededf3 Ivory border, Ivory text at 16px arcadia weight 400, 40px border-radius (pill). Zero padding top/bottom with 20px horizontal padding. Used for navigation links and secondary CTAs where a filled button would overpower the layout.

### Navigation Pill Link
**Role:** Top-bar navigation items with optional dropdown caret

Transparent background, no border, Ivory text at 16px arcadia weight 400, 40px border-radius, 0px vertical / 20px horizontal padding. Floats over the hero image and transitions to a solid dark fill on scroll via backdrop-blur.

### Graphite Card
**Role:** Content grouping surface — product features, feature blocks, and section containers

Background #1e1e2a, 12px border-radius, 32px padding on all sides, no shadow, no border. The one-step lift from the #171721 canvas creates separation through subtle value contrast rather than elevation. Cards sit flat on the dark plane.

### Email Capture Input (Pill, Left-Half)
**Role:** Hero email input with attached submit button

Transparent background, 1px solid #ededf3 Ivory border on left side only, Ivory text at 16px arcadia weight 400, border-radius 32px 0px 0px 32px (left-side pill, flat right edge where it meets the button), 20px left padding. Placeholder text in #c3c3cc Ash.

### Full-Bleed Hero Section
**Role:** Above-the-fold brand statement with photographic atmosphere

100vw × ~100vh, no padding constraints, centered content stack. Headline in arcadiaDisplay at 65px weight 480, subtext in arcadia at 18px weight 480. A full-bleed photographic background (atmospheric landscape) sits behind a subtle dark overlay. Content max-width ~640px centered vertically and horizontally.

### Transparent Top Navigation Bar
**Role:** Primary site navigation overlaid on hero

Full-width, fixed or sticky, transparent background over the hero image. Brand mark (Mercury logo with concentric-circle icon) on the left, nav links centered (Products, Solutions, Resources, About, Pricing), Log in text link and Cobalt 'Open account' pill button on the right. Uses backdrop-blur(8px or 20px) on scroll to create frosted-glass separation.

### Disclaimer Banner
**Role:** Legal/regulatory footnote strip at page bottom

Dark background (matches canvas or slightly lighter), small text at 12px arcadia weight 480 with 0.01em letter-spacing, centered or left-aligned, subtle Ivory or Ash text color. Minimal visual weight — present but never distracting.

### Section Container
**Role:** Horizontal content wrapper between hero and footer

Full-width dark canvas (#171721) with inner content constrained to 1200px max-width, 72px vertical padding. Contains 2- or 3-column grids of Graphite Cards or text+image splits.

## Do's and Don'ts

### Do
- Use Cobalt #5266eb exclusively for the single primary action per page — never as a decorative accent, icon fill, or secondary button
- Set all cards to #1e1e2a with 12px radius and 32px padding — rely on the one-step value lift from the canvas, not shadows, for separation
- Apply arcadiaDisplay weight 480 (not 600/700) for all headings — the intermediate weight is Mercury's signature restraint
- Use 32px or 40px pill radius for all interactive controls (buttons, inputs, nav items) — sharp 4px corners are reserved for structural elements only
- Set body text at 16px arcadia weight 400 with 1.5 line-height — this is the density baseline for all content
- Maintain 72px vertical rhythm between major sections — spacious density is part of the premium feel
- Use ivory #ededf3 on ghost/outline buttons for both border and text — never use a chromatic color for secondary actions

### Don't
- Do not use multiple bright accent colors — Cobalt is the only chromatic note; introducing greens, reds, or oranges breaks the monochrome discipline
- Do not add drop shadows to cards or components — separation comes from the graphite-on-onyx value difference alone
- Do not use bold weights (700+) for headings — arcadiaDisplay at 480 is the ceiling
- Do not use sharp corners (0–4px) on buttons, inputs, or nav items — the pill shape is non-negotiable
- Do not use #ffffff for body text — always #ededf3 Ivory; pure white on dark creates harsh, cold contrast
- Do not place Cobalt-filled elements next to each other without at least 32px gap — the vivid color creates visual competition when clustered
- Do not use bright or saturated backgrounds for sections — every surface is either #171721 (canvas) or #1e1e2a (card); no mid-gray or colored bands

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Onyx Canvas | `#171721` | Base page background — hero overlay, section canvases, footer |
| 1 | Graphite Card | `#1e1e2a` | Elevated content surface — product cards, feature blocks, form containers |
| 2 | Obsidian Button | `#272735` | Interactive surface — secondary button fills, inline form attachments |

## Elevation

Mercury deliberately avoids shadows. All elevation is communicated through value contrast alone — the graphite card (#1e1e2a) sits one step lighter than the onyx canvas (#171721), creating perceptible separation without any drop shadow. This flat aesthetic keeps the interface feeling modern, digital, and weightless, letting the photographic hero imagery and cobalt accent do the emotional work.

## Imagery

Cinematic full-bleed photography dominates the hero — atmospheric, aspirational landscapes (misty mountains, isolated desks in nature) that position banking as a contemplative, elevated experience. Photography is high-quality, slightly desaturated with cool tones, and treated with a subtle dark overlay to maintain text legibility. Below the hero, imagery shifts to product UI screenshots and abstract atmospheric backgrounds. No illustrations, no icons-as-art — visuals are photographic or purely functional. Icon style throughout the UI is minimal line/glyph style in Ivory, appearing in nav, buttons, and form elements.

## Layout

Full-bleed dark canvas throughout. Hero is 100vw full-bleed photographic with centered headline + subtext + email-capture form stack (max-width ~640px). Below hero, content flows in 1200px max-width sections with 72px vertical padding, alternating between text-left/image-right 2-column splits and 3-column card grids for product features. Navigation is a transparent top bar overlaid on the hero, transitioning to a frosted-glass (backdrop-blur) solid dark fill on scroll. Footer is dark with disclaimer text. Vertical rhythm is generous — spacious density with large breathing room between sections. No sidebar navigation; all navigation lives in the top bar.

## Agent Prompt Guide

**Quick Color Reference**
- Background (canvas): #171721 Onyx
- Card surface: #1e1e2a Graphite
- Primary text: #ededf3 Ivory
- Muted text: #c3c3cc Ash
- Border: #e2e3ed Mist
- primary action: #5266eb (filled action)

**Example Component Prompts**

1. Create a product feature card: background #1e1e2a Graphite, 12px border-radius, 32px padding all sides, no shadow. Heading at 28px arcadiaDisplay weight 480, letter-spacing 0.015em, color #ededf3 Ivory. Body text at 16px arcadia weight 400, line-height 1.5, color #ededf3 Ivory.

2. Create a primary CTA button: background #5266eb Cobalt, white text at 16px arcadia weight 400, 32px border-radius (pill), no border, no shadow, 12px vertical / 24px horizontal padding. Text is 'Open account' or equivalent action label.

3. Create a ghost/outline button: transparent background, 1px solid #ededf3 Ivory border, #ededf3 text at 16px arcadia weight 400, 40px border-radius, 10px vertical / 20px horizontal padding.

4. Create a hero section: full-bleed (100vw), full-viewport height, photographic landscape background with dark overlay. Headline at 65px arcadiaDisplay weight 480, line-height 1.1, color #ffffff, centered. Subtext at 18px arcadia weight 480, color #ededf3 Ivory, centered, max-width 520px.

5. Create an inline email capture form: flex row, no gap. Input — transparent background, 1px solid #ededf3 Ivory border (left + top + bottom only), #ededf3 text at 16px arcadia weight 400, placeholder in #c3c3cc Ash, border-radius 32px 0 0 32px, 14px vertical / 20px horizontal padding. Button — #5266eb Cobalt fill, white text at 16px arcadia weight 400, border-radius 0 32px 32px 0, 14px vertical / 24px horizontal padding, no border.

## Typography Philosophy

Mercury's type system uses two custom faces — arcadia for UI/body and arcadiaDisplay for headlines — both built on an intermediate weight axis (360, 420, 480, 530) that avoids the conventional bold/light binary. Heading weight 480 is the signature: it is heavier than regular but distinctly lighter than semibold, creating a voice that asserts without shouting. Display sizes use tight line-heights (1.1–1.15) with positive letter-spacing (0.01–0.02em), giving large text an architectural, wide-set quality. Body text stays at 16px weight 400 with generous 1.5 line-height. The overall effect is a voice that is measured, premium, and digitally native — never editorial, never corporate.

## Similar Brands

- **Wise** — Same dark-canvas + single-accent-color approach to fintech, with pill-shaped controls and flat card surfaces
- **Ramp** — Similar graphite-on-dark card system with minimalist borderless components and a restrained primary accent
- **Brex** — Dark-mode fintech aesthetic with comparable flat card elevation and confident intermediate-weight typography
- **Linear** — Same whisper-weight typography philosophy and dark monochrome canvas with a single chromatic action color
- **Stripe** — Shared approach to generous spacing, intermediate-weight display type, and letting one accent color carry the brand

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-onyx-canvas: #171721;
  --color-graphite-card: #1e1e2a;
  --color-obsidian-button: #272735;
  --color-slate-border: #70707d;
  --color-mist-border: #e2e3ed;
  --color-ash-text: #c3c3cc;
  --color-ivory-text: #ededf3;
  --color-cobalt: #5266eb;
  --color-pure-white: #ffffff;

  /* Typography — Font Families */
  --font-arcadia: 'arcadia', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-arcadiadisplay: 'arcadiaDisplay', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1;
  --tracking-caption: 0.12px;
  --text-body-sm: 14px;
  --leading-body-sm: 1;
  --tracking-body-sm: 0.07px;
  --text-body: 16px;
  --leading-body: 1.5;
  --text-body-lg: 18px;
  --leading-body-lg: 1.35;
  --text-subheading: 21px;
  --leading-subheading: 1.35;
  --text-heading-sm: 28px;
  --leading-heading-sm: 1.2;
  --tracking-heading-sm: 0.42px;
  --text-heading: 32px;
  --leading-heading: 1.15;
  --tracking-heading: 0.48px;
  --text-heading-lg: 42px;
  --leading-heading-lg: 1.15;
  --tracking-heading-lg: 0.42px;
  --text-display: 65px;
  --leading-display: 1.1;

  /* Typography — Weights */
  --font-weight-w360: 360;
  --font-weight-regular: 400;
  --font-weight-w420: 420;
  --font-weight-w480: 480;
  --font-weight-w530: 530;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-56: 56px;
  --spacing-72: 72px;
  --spacing-112: 112px;
  --spacing-128: 128px;

  /* Layout */
  --page-max-width: 1200px;
  --section-gap: 72px;
  --card-padding: 32px;
  --element-gap: 12px;

  /* Border Radius */
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-3xl: 32px;
  --radius-3xl-2: 40px;

  /* Named Radii */
  --radius-nav: 40px;
  --radius-tags: 40px;
  --radius-cards: 12px;
  --radius-inputs: 32px;
  --radius-buttons: 32px;
  --radius-default: 4px;

  /* Surfaces */
  --surface-onyx-canvas: #171721;
  --surface-graphite-card: #1e1e2a;
  --surface-obsidian-button: #272735;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-onyx-canvas: #171721;
  --color-graphite-card: #1e1e2a;
  --color-obsidian-button: #272735;
  --color-slate-border: #70707d;
  --color-mist-border: #e2e3ed;
  --color-ash-text: #c3c3cc;
  --color-ivory-text: #ededf3;
  --color-cobalt: #5266eb;
  --color-pure-white: #ffffff;

  /* Typography */
  --font-arcadia: 'arcadia', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-arcadiadisplay: 'arcadiaDisplay', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1;
  --tracking-caption: 0.12px;
  --text-body-sm: 14px;
  --leading-body-sm: 1;
  --tracking-body-sm: 0.07px;
  --text-body: 16px;
  --leading-body: 1.5;
  --text-body-lg: 18px;
  --leading-body-lg: 1.35;
  --text-subheading: 21px;
  --leading-subheading: 1.35;
  --text-heading-sm: 28px;
  --leading-heading-sm: 1.2;
  --tracking-heading-sm: 0.42px;
  --text-heading: 32px;
  --leading-heading: 1.15;
  --tracking-heading: 0.48px;
  --text-heading-lg: 42px;
  --leading-heading-lg: 1.15;
  --tracking-heading-lg: 0.42px;
  --text-display: 65px;
  --leading-display: 1.1;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-56: 56px;
  --spacing-72: 72px;
  --spacing-112: 112px;
  --spacing-128: 128px;

  /* Border Radius */
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-3xl: 32px;
  --radius-3xl-2: 40px;
}
```

---

# Anexo: referencia analogue

# Analogue — Style Reference
> Black gallery vitrine — products float in void

**Theme:** dark

Source measurements are normalized; roles and recommendations are interpreted. Font summary lists are independent, not paired by position. HTML examples are reconstructions, not source components.

Analogue presents as a black-box gallery: products float untethered against pure dark voids, lit like museum objects rather than marketed like commodities. The visual language is rigorously monochrome — black, white, and a single soft gray do all the work, with no chromatic accents competing for attention. Typography is a single custom family used at whisper-to-medium weights, carrying dramatic negative tracking that tightens aggressively as size increases. Components feel weighted and architectural: rounded card corners, generous breathing room, and the only 'action' surface is a clean white pill that reads as a beacon against the dark. Every screen should read as quiet and confident, letting the hardware itself be the spectacle.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Carbon Canvas | `#000000` | `--color-carbon-canvas` | Page backgrounds, section canvases, card surfaces in dark sections |
| Bone White | `#ffffff` | `--color-bone-white` | Light supporting surface for subtle backgrounds and section separation. Do not promote it to the primary CTA color |
| Ash Veil | `#e5e7eb` | `--color-ash-veil` | Subtle borders, hairline dividers, light-mode card surfaces, light section backgrounds |
| Smoke | `#bfbfbf` | `--color-smoke` | Secondary text, muted captions, supporting metadata on dark surfaces |
| Iron Gray | `#999999` | `--color-iron-gray` | Tertiary text, placeholders, disabled state text, publication/attribution labels |

## Tokens — Typography

### circularXx — Single-family system used everywhere. Display sizes (47-53px) carry dramatic -3.18px to -2.35px tracking that compresses letterforms into near-monoline blocks; body sizes hold -0.32px to -0.26px tracking. The 450 weight is the signature — lighter than typical medium, thicker than regular — giving headlines a precise, engineered feel. Font feature 'ss08' is globally active. · `--font-circularxx`
- **Substitute:** Inter, General Sans, Satoshi
- **Weights:** 400, 450, 500
- **Sizes:** 13, 15, 16, 18, 19, 21, 26, 35, 47, 53
- **Line height:** 0.80, 1.00, 1.11, 1.14, 1.15, 1.20, 1.23, 1.50
- **Letter spacing:** -0.06em at 53px, -0.05em at 47px, -0.033em at 35px, -0.03em at 26px, -0.029em at 21px, -0.031em at 19px, -0.02em at 16px and below
- **OpenType features:** `"ss08" on`
- **Role:** Single-family system used everywhere. Display sizes (47-53px) carry dramatic -3.18px to -2.35px tracking that compresses letterforms into near-monoline blocks; body sizes hold -0.32px to -0.26px tracking. The 450 weight is the signature — lighter than typical medium, thicker than regular — giving headlines a precise, engineered feel. Font feature 'ss08' is globally active.

### Type Scale

| Role | Family | Weight | Size | Line Height | Letter Spacing | Token |
|------|--------|--------|------|-------------|----------------|-------|
| caption | — | — | 13px | 1.5 | -0.26px | `--text-caption` |
| body-sm | — | — | 15px | 1.5 | -0.3px | `--text-body-sm` |
| subheading-lg | — | — | 19px | 1.2 | -0.59px | `--text-subheading-lg` |
| heading-sm | — | — | 21px | 1.15 | -0.61px | `--text-heading-sm` |
| heading | — | — | 26px | 1.14 | -0.78px | `--text-heading` |
| heading-lg | — | — | 35px | 1.11 | -1.16px | `--text-heading-lg` |
| display | — | — | 47px | 1 | -2.35px | `--text-display` |
| display-lg | — | — | 53px | 0.8 | -3.18px | `--text-display-lg` |

## Tokens — Spacing & Shapes

**Density:** spacious

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 6 | 6px | `--spacing-6` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 18 | 18px | `--spacing-18` |
| 26 | 26px | `--spacing-26` |
| 29 | 29px | `--spacing-29` |
| 35 | 35px | `--spacing-35` |
| 41 | 41px | `--spacing-41` |
| 47 | 47px | `--spacing-47` |
| 103 | 103px | `--spacing-103` |

### Border Radius

| Element | Value |
|---------|-------|
| tags | 9999px |
| cards | 17.6px |
| buttons | 9999px |

### Layout

- **Page max-width:** 1200px
- **Section gap:** 80px
- **Card padding:** 26px
- **Element gap:** 18px

## Components

### Primary Action Pill
**Role:** Single conversion surface — 'Available Now', 'Shop Now'

White filled pill, 9999px radius, 16px 32px padding, circularXx weight 500 at 15px in #000000. Sits as a beacon against the dark canvas. No border, no shadow — pure contrast is the affordance.

### Ghost Nav Link
**Role:** Primary navigation items in header

No background, no border. circularXx weight 400-450 at 15px in #ffffff, tracking -0.30px. Stack label (Store, Editions, Support) above link (Products, Developer, Announcements) with 2-3px row gap, creating a compact two-line nav cell.

### Brand Mark
**Role:** Logo placement in top-left

Abstract 'A' glyph in #ffffff on dark canvas, approximately 30px square. No wordmark adjacent — symbol carries identity alone.

### Section Title Block
**Role:** Section header pairing product family with status word

Two stacked centered lines: top line circularXx weight 400 at 21px in #e5e7eb (e.g., 'Analogue Pocket'), bottom line circularXx weight 450 at 47-53px in #ffffff (e.g., 'Restock', 'Shipping Now'). Tracking on the large line is -2.35px to -3.18px. No other decoration.

### Product Hero Composition
**Role:** First-screen product showcase

Central product device (Analogue Pocket) at 60-70% viewport height, surrounded by 6-8 floating game cartridges in random rotation, each with subtle drop shadow. Pure #000000 background. No grid, no alignment — objects appear scattered in 3D space.

### Review Card
**Role:** Press quotes on dark sections

17.6px radius, 1px border in rgba(255,255,255,0.1) or #e5e7eb at low opacity, 26px internal padding. Layout: rating (35px weight 450 #ffffff) top-left, publication logo top-right, pull-quote (16px weight 400 #e5e7eb) middle, attribution (15px weight 400 #999999) bottom. Arranged in 4-column grid with 12-18px gaps.

### Product Showcase Card
**Role:** Light-section product display tiles

#ffffff surface on #e5e7eb background, 17.6px radius, 26px padding. Product photo centered, label below at 16px weight 400 in #000000. No shadow — flat against the gray field.

### Shipping Note
**Role:** Temporal metadata under action button

circularXx weight 400 at 15px in #999999, centered, single line. No icon, no decoration — typographic only.

### Social Icon Button
**Role:** Header social link (Instagram)

24px square white stroke icon, no background, no label. Sits far-right of nav.

## Do's and Don'ts

### Do
- Use only the five neutrals: #000000, #ffffff, #e5e7eb, #bfbfbf, #999999. No chromatic colors in the system.
- Apply circularXx at weight 450 for all display and heading sizes — this mid-weight is the signature, not 500 or 700.
- Tighten letter-spacing aggressively as size grows: -0.02em at 16px, scaling to -0.06em at 53px. Never use positive tracking.
- Use the single 17.6px radius for all cards and containers. Buttons and tags get 9999px for pill shape.
- Set section backgrounds to pure #000000; let product photography carry color and light, not the interface.
- Pair every section title with a two-line stack: small light-gray label above large white status word.
- Keep the single white pill button as the only filled action surface on dark sections — no secondary buttons compete.

### Don't
- Don't introduce any color outside the five neutrals — no blues, reds, greens, or accent hues.
- Don't use weights above 500 — headlines should feel precise and engineered, not bold or shouty.
- Don't apply box-shadows to cards on dark backgrounds — use 1px hairline borders in low-opacity white instead.
- Don't use positive letter-spacing or letter-spacing: normal anywhere in the system.
- Don't use corner radii other than 17.6px (cards) or 9999px (pills). No sharp 0px corners, no 8px defaults.
- Don't add gradients, glows, or color washes — the aesthetic depends on flat darkness and pure contrast.
- Don't use icons in colored fills — all icons are white strokes on dark, or black strokes on light.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 1 | Void | `#000000` | Primary page canvas and section background |
| 2 | Light Section | `#e5e7eb` | Alternating light bands for product showcases on light backgrounds |
| 3 | Pure White | `#ffffff` | Card surfaces within light sections, pill button fills |

## Imagery

Product photography is the entire visual language. Devices and game cartridges are shot on pure black, floating in space with no surface or context — each object is isolated like a museum artifact. Cartridges appear in slight rotation and varied scale, scattered around a central hero device in a loose orbital composition. Lighting is studio-precise: hard key light reveals product texture, no environmental spill. No lifestyle photography, no human subjects, no backgrounds beyond pure void. The product IS the image; the page provides only darkness and typography.

## Layout

Full-bleed page model with no persistent sidebar. Navigation is a minimal top bar: brand mark far-left, three two-line nav groups center, social icon far-right — all on a single transparent row over the dark canvas. Hero is a full-viewport dark composition with centered product cluster and centered title block below. Sections alternate between full-bleed dark (#000000) and full-bleed light (#e5e7eb) bands with sharp edges, no gradients between. Light sections house product showcase grids (centered, max-width ~1200px). Dark sections house review card grids (4 columns, equal-width). Vertical rhythm is generous: ~80px between major sections, 26-29px internal padding. Content is always horizontally centered with auto margins — no asymmetric or left-aligned compositions.

## Agent Prompt Guide

## Quick Color Reference
- text: #ffffff (primary), #e5e7eb (secondary), #999999 (tertiary)
- background: #000000 (dark sections), #e5e7eb (light sections), #ffffff (cards on light)
- border: #e5e7eb at 10-20% opacity (dark mode), #bfbfbf (light mode)
- accent: none — monochrome only
- primary action: no distinct CTA color

## Example Component Prompts
1. **Section Title Block**: Two stacked centered lines on #000000. Line 1: circularXx weight 400, 21px, #e5e7eb, letter-spacing -0.61px. Line 2: circularXx weight 450, 53px, #ffffff, letter-spacing -3.18px, line-height 0.80. 12px vertical gap between lines.

2. **Available Now Pill Button**: White filled pill on #000000. 9999px border-radius. circularXx weight 500, 15px, #000000, letter-spacing -0.30px. Padding 16px vertical, 32px horizontal. No border, no shadow.

3. **Review Card**: 17.6px border-radius, 1px solid border in rgba(229,231,235,0.15), 26px padding on all sides, #000000 background. Rating at 35px circularXx weight 450 in #ffffff, letter-spacing -1.16px. Quote at 16px weight 400 in #e5e7eb. Attribution at 15px weight 400 in #999999.

4. **Ghost Nav Link Group**: No background. Two stacked lines with 3px row gap: category label (Store) in circularXx weight 400 at 15px #e5e7eb, sub-link (Products) in circularXx weight 450 at 15px #ffffff. Letter-spacing -0.30px both lines. 29px horizontal padding.

5. **Product Hero Background**: Full-viewport #000000 canvas. Single centered product image at 60% viewport height, surrounded by 6-8 smaller product images in random rotation (-20° to +20°), each with subtle drop-shadow (0 10px 30px rgba(0,0,0,0.5)). No grid alignment.

## Elevation Philosophy

Analogue deliberately avoids shadow-based elevation. Dark sections use 1px hairline borders in low-opacity white (rgba(229,231,235,0.1-0.2)) to delineate cards — borders carry separation, not depth. Light sections rely on the #e5e7eb-to-#ffffff surface step. The only shadows present are on product photography itself, where studio lighting creates natural depth on the objects, not on the UI containers. This creates a flat, architectural feel where the page is a stage and the products are sculptures lit within it.

## Similar Brands

- **Apple** — Same product-as-sculpt presentation on pure black canvases with centered white typography and dramatic negative tracking on display sizes
- **Teenage Engineering** — Same dark, design-forward hardware aesthetic with monochrome palettes and product photography floating without context
- **Leica** — Same premium dark product presentation — objects on void, gallery-style isolation, minimal UI chrome
- **Nothing** — Same restrained monochrome interface and dramatic floating product compositions on pure black
- **Bang & Olufsen** — Same luxury hardware treatment with dark product photography and tightly tracked sans-serif display type

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-carbon-canvas: #000000;
  --color-bone-white: #ffffff;
  --color-ash-veil: #e5e7eb;
  --color-smoke: #bfbfbf;
  --color-iron-gray: #999999;

  /* Typography — Font Families */
  --font-circularxx: 'circularXx', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 13px;
  --leading-caption: 1.5;
  --tracking-caption: -0.26px;
  --text-body-sm: 15px;
  --leading-body-sm: 1.5;
  --tracking-body-sm: -0.3px;
  --text-subheading-lg: 19px;
  --leading-subheading-lg: 1.2;
  --tracking-subheading-lg: -0.59px;
  --text-heading-sm: 21px;
  --leading-heading-sm: 1.15;
  --tracking-heading-sm: -0.61px;
  --text-heading: 26px;
  --leading-heading: 1.14;
  --tracking-heading: -0.78px;
  --text-heading-lg: 35px;
  --leading-heading-lg: 1.11;
  --tracking-heading-lg: -1.16px;
  --text-display: 47px;
  --leading-display: 1;
  --tracking-display: -2.35px;
  --text-display-lg: 53px;
  --leading-display-lg: 0.8;
  --tracking-display-lg: -3.18px;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-w450: 450;
  --font-weight-medium: 500;

  /* Spacing */
  --spacing-6: 6px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-18: 18px;
  --spacing-26: 26px;
  --spacing-29: 29px;
  --spacing-35: 35px;
  --spacing-41: 41px;
  --spacing-47: 47px;
  --spacing-103: 103px;

  /* Layout */
  --page-max-width: 1200px;
  --section-gap: 80px;
  --card-padding: 26px;
  --element-gap: 18px;

  /* Border Radius */
  --radius-2xl: 17.6256px;

  /* Named Radii */
  --radius-tags: 9999px;
  --radius-cards: 17.6px;
  --radius-buttons: 9999px;

  /* Surfaces */
  --surface-void: #000000;
  --surface-light-section: #e5e7eb;
  --surface-pure-white: #ffffff;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-carbon-canvas: #000000;
  --color-bone-white: #ffffff;
  --color-ash-veil: #e5e7eb;
  --color-smoke: #bfbfbf;
  --color-iron-gray: #999999;

  /* Typography */
  --font-circularxx: 'circularXx', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 13px;
  --leading-caption: 1.5;
  --tracking-caption: -0.26px;
  --text-body-sm: 15px;
  --leading-body-sm: 1.5;
  --tracking-body-sm: -0.3px;
  --text-subheading-lg: 19px;
  --leading-subheading-lg: 1.2;
  --tracking-subheading-lg: -0.59px;
  --text-heading-sm: 21px;
  --leading-heading-sm: 1.15;
  --tracking-heading-sm: -0.61px;
  --text-heading: 26px;
  --leading-heading: 1.14;
  --tracking-heading: -0.78px;
  --text-heading-lg: 35px;
  --leading-heading-lg: 1.11;
  --tracking-heading-lg: -1.16px;
  --text-display: 47px;
  --leading-display: 1;
  --tracking-display: -2.35px;
  --text-display-lg: 53px;
  --leading-display-lg: 0.8;
  --tracking-display-lg: -3.18px;

  /* Spacing */
  --spacing-6: 6px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-18: 18px;
  --spacing-26: 26px;
  --spacing-29: 29px;
  --spacing-35: 35px;
  --spacing-41: 41px;
  --spacing-47: 47px;
  --spacing-103: 103px;

  /* Border Radius */
  --radius-2xl: 17.6256px;
}
```

---

# Anexo: referencia notion

# Notion — Style Reference
> warm paper notebook under afternoon sun

**Theme:** light

Source measurements are normalized; roles and recommendations are interpreted. Font summary lists are independent, not paired by position. HTML examples are reconstructions, not source components.

Notion reads like a well-loved paper notebook under afternoon light: a warm off-white canvas (#f6f5f4) that feels tactile rather than clinical, generous sans typography that gives editorial weight to product copy, and color used as sparse punctuation — peachy pills highlight verbs, a single blue anchors the primary action, and a rotating cast of accent hues (coral, amber, sky, midnight) paints the feature card backgrounds like sticky notes. Cards sit on the canvas with 1px hairline borders and 12px corners — no shadows, no chrome — like ruled sections in a Moleskine. Motion is playful and springy, with 200ms ease transitions and bouncy character-mark animations that make the interface feel alive without ever being decorative.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Notion Blue | `#0075de` | `--color-notion-blue` | Primary CTA fill, active nav accent, filled action buttons — the single chromatic commitment in a near-monochrome system, saturated enough to read as a switch |
| Paper Warmth | `#f6f5f4` | `--color-paper-warmth` | Page canvas, hero background, section backgrounds — warm off-white gives the system its tactile analog feel |
| Pure White | `#ffffff` | `--color-pure-white` | Card surfaces, elevated panels, logo-wall background, contrast text on dark cards |
| Ink Black | `#000000` | `--color-ink-black` | Primary text, nav links, headings — deployed at varying alpha (100%, 95%, 90%, 60%, 40%, 20%) to build hierarchy without adding new colors |
| Charcoal | `#111111` | `--color-charcoal` | Dark text variant for specific UI moments where pure black would feel too harsh |
| Stone | `#757575` | `--color-stone` | Secondary nav text, muted helper text, deactivated button labels — the 60% alpha of ink |
| Graphite | `#615d59` | `--color-graphite` | Body text with warm cast — the brown-tinted gray that harmonizes with the warm canvas |
| Slate | `#696969` | `--color-slate` | Card body text, secondary content within cards — slightly lighter than Stone |
| Sky Tint | `#e6f3fe` | `--color-sky-tint` | Ghost CTA background, soft blue wash for secondary actions, tinted hover states |
| Marigold | `#ffb110` | `--color-marigold` | Hero pill highlights, Agent feature card background, warm accent for callouts — the first color the eye finds |
| Coral | `#f64932` | `--color-coral` | Decorative card backgrounds, hero pill alternates, warm-to-hot accent in the rotating cast |
| Saffron | `#e89d01` | `--color-saffron` | Body-section accent panels, secondary warm yellow for background washes |
| Vermillion | `#e32d14` | `--color-vermillion` | Deep coral for saturated body-section backgrounds, signal-warm accent |
| Mocha | `#b18164` | `--color-mocha` | Warm brown accent for body-section panels — the earthy member of the accent cast |
| Signal Blue | `#097fe8` | `--color-signal-blue` | Decorative card backgrounds, hero decorative highlights, secondary blue for visual variety |
| Sky Wash | `#62aef0` | `--color-sky-wash` | Lightest blue in the cast — decorative backgrounds, heading accent highlights, airy washes |
| Midnight Ink | `#02093a` | `--color-midnight-ink` | Violet wash for highlight backgrounds, decorative bands, and soft emphasis behind content. |

## Tokens — Typography

### NotionInter — Primary sans-serif — geometric humanist with slight quirks, deployed at 400 for body, 500 for nav/UI, 600-700 for display headings. The type-scale uses aggressive negative letter-spacing at large sizes (-4.6px at 96px, -2px at 72px) that tightens the headline to feel confident and compact rather than airy. · `--font-notioninter`
- **Substitute:** Inter
- **Weights:** 400, 500, 600, 700
- **Sizes:** 12px, 14px, 16px, 20px, 22px, 24px, 40px, 42px, 48px, 54px, 72px, 96px
- **Line height:** 0.83, 1.00, 1.04, 1.14, 1.21, 1.27, 1.33, 1.40, 1.43, 1.50
- **Letter spacing:** -0.048em at 96px, -0.036em at 42px, -0.035em at 54px, -0.028em at 72px, -0.011em at 22px, +0.01em at 12px, normal at body sizes
- **OpenType features:** `"lnum", "locl" 0`
- **Role:** Primary sans-serif — geometric humanist with slight quirks, deployed at 400 for body, 500 for nav/UI, 600-700 for display headings. The type-scale uses aggressive negative letter-spacing at large sizes (-4.6px at 96px, -2px at 72px) that tightens the headline to feel confident and compact rather than airy.

### Lyon Text — Editorial serif reserved for specific body-text moments and section intros — used sparingly (4 instances) to give voice a literary weight, like a pull-quote in a magazine layout. Functions as a system accent, not a parallel hierarchy. · `--font-lyon-text`
- **Substitute:** Source Serif Pro
- **Weights:** 400
- **Sizes:** 18px, 32px
- **Line height:** 1.25, 1.56
- **Role:** Editorial serif reserved for specific body-text moments and section intros — used sparingly (4 instances) to give voice a literary weight, like a pull-quote in a magazine layout. Functions as a system accent, not a parallel hierarchy.

### Type Scale

| Role | Family | Weight | Size | Line Height | Letter Spacing | Token |
|------|--------|--------|------|-------------|----------------|-------|
| caption | — | — | 12px | 1.33 | 0.12px | `--text-caption` |
| body-sm | — | — | 14px | 1.43 | — | `--text-body-sm` |
| body | — | — | 16px | 1.5 | — | `--text-body` |
| subheading | — | — | 20px | 1 | — | `--text-subheading` |
| heading-sm | — | — | 22px | 1.27 | -0.242px | `--text-heading-sm` |
| heading | — | — | 40px | 1.5 | — | `--text-heading` |
| heading-lg | — | — | 48px | 1.5 | — | `--text-heading-lg` |
| display-sm | — | — | 54px | 1.04 | -1.89px | `--text-display-sm` |
| display | — | — | 72px | 1.21 | -2.016px | `--text-display` |
| display-lg | — | — | 96px | 1.04 | -4.608px | `--text-display-lg` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 28 | 28px | `--spacing-28` |
| 32 | 32px | `--spacing-32` |
| 36 | 36px | `--spacing-36` |
| 64 | 64px | `--spacing-64` |
| 80 | 80px | `--spacing-80` |

### Border Radius

| Element | Value |
|---------|-------|
| cards | 12px |
| pills | 9999px |
| small | 4px |
| buttons | 8px |

### Layout

- **Page max-width:** 1440px
- **Section gap:** 80px
- **Card padding:** 24px
- **Element gap:** 8px

## Components

### Primary CTA Button
**Role:** Filled blue action button for the main conversion goal

Background #0075de, text #ffffff at 14px NotionInter weight 500, border-radius 8px, padding 6px 15px. The only chromatic filled button in the system — every other action defers to ghost or text styles.

### Ghost CTA Button
**Role:** Secondary action with a subtle blue tint

Background #e6f3fe (sky tint), text #0075de at 14px weight 500, border-radius 8px, padding 6px 15px. Pairs beside the primary CTA as the lower-commitment alternative.

### Ghost Text Button
**Role:** Minimal action button with no fill or border

Background transparent, text #000000 at 95% alpha, border-radius 8px, padding 6px 15px. The default for tertiary actions in the hero and feature cards.

### Outlined Text Button
**Role:** Bordered button with no fill for mid-priority actions

Background transparent, text #000000 at 90% alpha, 1px border at same color, border-radius 4px, padding 5px 10px. Used for compact inline actions like view-all links.

### Muted Nav Link
**Role:** Low-emphasis navigation item

Background transparent, text #000000 at 54% alpha, border-radius 8px, padding 12px 16px. The default nav-item state — text darkens to full alpha on hover, never gets an underline.

### Pill Tag
**Role:** Category label or status indicator

Background colored fill (varies), text #000000 or #ffffff, border-radius 9999px, padding 4px 12px. Used for status labels like 'In progress', 'To do', 'Complete' in product mockups.

### White Feature Card
**Role:** Standard content card on warm canvas

Background #ffffff, border-radius 12px, padding 24px, 1px solid border at rgba(0,0,0,0.08), no shadow. The default card — sits on the warm canvas like a sticky note.

### Accent Feature Card
**Role:** Full-bleed colored card for feature blocks

Background one of the accent hues (#ffb110, #f64932, #62aef0, #e6f3fe, etc.), border-radius 12px, padding 24px, no border. Functions as a colored panel that paints the canvas — text inside uses #000000 or #ffffff depending on contrast.

### Dark Feature Card
**Role:** Inverted card for dark-on-light contrast moments

Background #02093a (midnight), text #ffffff, border-radius 12px, padding 24px. The system uses this sparingly as a 'dark mode island' on the light page — not as a full dark theme.

### Hero Highlight Pill
**Role:** Colored pill placed behind a verb in hero copy

Background accent color (peach #f6d5b8, yellow #ffb110, or coral #f64932), text #000000, border-radius 9999px, padding 8px 24px. The signature typographic device — wraps a single word in a sentence to draw the eye and give it weight.

### Avatar Character Mark
**Role:** Decorative illustrated character in a circle

40-48px circle with 2px colored border (blue, red, yellow), flat illustration inside, white background. Used in hero arrangements and scattered as decorative marks with squiggle/sparkle companions.

### Kanban Task Card
**Role:** Product UI task item in the embedded product mockup

Background #ffffff, border-radius 8px, padding 8px 12px, 1px border at rgba(0,0,0,0.08), small status text and emoji. Replicates the real Notion task card aesthetic inside the marketing screenshot.

### Section Header
**Role:** Large heading that opens a new content section

NotionInter weight 500-700, 48-54px, line-height 1.04-1.5, letter-spacing -1.89 to -2.016px. Color #000000. Followed by an optional Lyon Text subhead at 18px for editorial voice.

### Logo Wall Item
**Role:** Greyscale partner/client logo

SVG logo at native proportions, color desaturated to near-black (#000000 at 60% alpha), no individual borders or backgrounds. Centered grid layout with generous spacing — logos are treated as typography, not imagery.

## Do's and Don'ts

### Do
- Use #f6f5f4 as the page canvas and #ffffff for card surfaces — never invert this hierarchy by putting a warm card on a white page
- Reserve #0075de for the single primary action per screen; all secondary actions should use ghost (#e6f3fe bg) or text styles
- Apply negative letter-spacing to all display sizes: -4.6px at 96px, -2px at 72px, -1.9px at 54px — body text stays at normal tracking
- Use 1px solid borders at rgba(0,0,0,0.08) instead of shadows to separate cards from the canvas
- Use 12px border-radius for cards and 8px for buttons; reserve 9999px for pills and hero highlight pills only
- Paint feature-block backgrounds with accent hues (#ffb110, #f64932, #62aef0, #02093a) rather than adding borders or shadows to create visual variety
- Keep motion at 200ms with ease timing for hovers and transitions; reserve spring/bounce animations for character marks and hero elements

### Don't
- Do not use pure #ffffff as the page background — the warm #f6f5f4 canvas is the system's signature warmth
- Do not add shadows to content cards — the system uses hairline borders only, shadows appear only on the product UI mockup and nav bar
- Do not use multiple chromatic button colors in the same view — #0075de is the only filled button; color variety belongs in card backgrounds
- Do not use #000000 at 100% for all text — build hierarchy through alpha (100%, 95%, 60%, 40%) on the same color
- Do not use Lyon Text for UI labels or navigation — it is reserved for editorial body copy moments at 18px
- Do not apply border-radius larger than 12px to rectangular content — pills (9999px) and cards (12px) are the two shapes
- Do not use gradients — the system is strictly flat fills; visual depth comes from the warm-to-white surface contrast and accent card backgrounds

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Page Canvas | `#f6f5f4` | Warm off-white base for the entire page — the analog-paper feel starts here |
| 1 | Card Surface | `#ffffff` | White cards on warm canvas — pure white is reserved for surfaces that need to read as 'on top of the page' |
| 2 | Accent Card Surface | `#ffb110` | Colored card backgrounds (yellow, coral, blue, midnight) — feature blocks paint the canvas with single-hue fills |
| 3 | Dark Card Surface | `#02093a` | Deep navy panels for dark-mode-style feature blocks — inverting the surface stack with white text on midnight |

## Elevation

- **Nav (sticky):** `0px 0.7px 1.462px 0px rgb(0% 0% 0%/0.015), 0px 3px 9px 0px rgb(0% 0% 0%/0.03)`
- **Product UI Mockup:** `0px 4px 12px rgba(0, 0, 0, 0.1)`

## Imagery

Illustration-first, photography-free. The visual language is built from flat illustrated character marks (round faces in 2px colored circles), abstract decorative elements (hand-drawn squiggles, sparkles, arrows, flower shapes), and product UI mockups. Character marks appear in the hero as a horizontal row of 7 avatars and scatter across the page as playful punctuation. Product screenshots are the only 'real' visuals — they show the actual Notion interface (kanban boards, document views, AI agent panels) with full chrome and real data. The product mockup in the hero is large, centered, and casts a single drop-shadow to separate it from the canvas. There are no lifestyle photos, no stock imagery, no abstract 3D renders.

## Layout

Centered, max-width contained at ~1440px. The hero is a centered stack: character-mark row → large two-line headline with an embedded colored pill → subhead → two-button CTA row → large product UI mockup. Below the hero, sections alternate between white-card grids and full-bleed colored accent panels. The logo wall is a centered single-row grid of greyscale partner logos. Feature blocks use a 2-column layout (text left, colored panel right) that alternates left-right between sections. The 'Ask your on-demand assistants' section uses a 2×2 card grid where the top card is full-width and the bottom row splits into two equal columns. Section gaps are generous (~80px) creating a calm vertical rhythm. Navigation is a fixed top bar at 64px height with centered nav items and right-aligned action buttons.

## Agent Prompt Guide

## Quick Color Reference
- text: #000000 (build hierarchy through alpha: 100% / 95% / 60% / 40%)
- background: #f6f5f4 (warm off-white canvas)
- card surface: #ffffff
- border: rgba(0, 0, 0, 0.08)
- primary action: #0075de (filled action)
- accent: #ffb110, #f64932, #62aef0, #02093a (rotate through these for card backgrounds)

## Example Component Prompts

1. **Hero headline with highlight pill**: Render a centered hero on #f6f5f4. Headline: 'Where teams and agents Create together.' at 72px NotionInter weight 500, #000000, line-height 1.21, letter-spacing -2.016px. Wrap the word 'Create' in a pill: background #f6d5b8, text #000000, border-radius 9999px, padding 8px 24px, inline within the sentence. Subhead below at 18px Lyon Text weight 400, #615d59, line-height 1.56.

2. **White feature card**: Create a card on the warm canvas. Background #ffffff, border-radius 12px, padding 24px, 1px solid border rgba(0,0,0,0.08). No shadow. Title at 22px NotionInter weight 700, #000000, letter-spacing -0.242px. Body at 16px weight 400, #615d59, line-height 1.5.

3. **Accent feature block**: Create a full-bleed colored panel. Background #ffb110, border-radius 12px, padding 24px. Title at 40px NotionInter weight 400, #000000, line-height 1.5. A product UI screenshot sits inside with a drop-shadow at 0px 4px 12px rgba(0,0,0,0.1) to create depth against the colored background.

4. Create a Primary Action Button: #0075de background, #ffffff text, 9999px radius, compact pill padding. Use this filled treatment for the main CTA.

5. **Kanban task card (product mockup)**: Create a task card inside a product screenshot. Background #ffffff, border-radius 8px, padding 8px 12px, 1px solid border rgba(0,0,0,0.08). Task text at 14px NotionInter weight 500, #000000. Optional status pill above: background colored fill, text #ffffff, border-radius 9999px, padding 2px 8px, font 12px.

## Decorative Marks System

Character marks (round illustrated faces in 2px colored circles) and abstract decorative elements (squiggles, sparkles, arrows, flower shapes) are deployed as visual punctuation, not as illustrations with content. They cluster around hero copy, scatter near feature cards, and animate on scroll. Colors for the circle borders rotate through the accent palette: #097fe8 (blue), #f64932 (coral), #ffb110 (yellow), #62aef0 (sky). The marks are 40-48px circles with flat color illustrations inside, always on white fills. They never carry information or link to content — they exist purely to make the interface feel alive and handcrafted.

## Similar Brands

- **Linear** — Same monochrome-light approach with a single accent color, hairline-border cards, generous display typography with negative tracking, and zero shadows on content surfaces
- **Stripe** — Same editorial use of serif+sans pairing, large display headlines with tight letter-spacing, and color reserved for functional emphasis rather than decoration
- **Figma** — Same playful illustrated character marks as decorative punctuation, warm light canvas, and rotating accent hues for section variety
- **Craft Docs** — Same paper-warm aesthetic with off-white canvas, restrained color palette, and a focus on the document-as-surface metaphor

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-notion-blue: #0075de;
  --color-paper-warmth: #f6f5f4;
  --color-pure-white: #ffffff;
  --color-ink-black: #000000;
  --color-charcoal: #111111;
  --color-stone: #757575;
  --color-graphite: #615d59;
  --color-slate: #696969;
  --color-sky-tint: #e6f3fe;
  --color-marigold: #ffb110;
  --color-coral: #f64932;
  --color-saffron: #e89d01;
  --color-vermillion: #e32d14;
  --color-mocha: #b18164;
  --color-signal-blue: #097fe8;
  --color-sky-wash: #62aef0;
  --color-midnight-ink: #02093a;

  /* Typography — Font Families */
  --font-notioninter: 'NotionInter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-lyon-text: 'Lyon Text', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1.33;
  --tracking-caption: 0.12px;
  --text-body-sm: 14px;
  --leading-body-sm: 1.43;
  --text-body: 16px;
  --leading-body: 1.5;
  --text-subheading: 20px;
  --leading-subheading: 1;
  --text-heading-sm: 22px;
  --leading-heading-sm: 1.27;
  --tracking-heading-sm: -0.242px;
  --text-heading: 40px;
  --leading-heading: 1.5;
  --text-heading-lg: 48px;
  --leading-heading-lg: 1.5;
  --text-display-sm: 54px;
  --leading-display-sm: 1.04;
  --tracking-display-sm: -1.89px;
  --text-display: 72px;
  --leading-display: 1.21;
  --tracking-display: -2.016px;
  --text-display-lg: 96px;
  --leading-display-lg: 1.04;
  --tracking-display-lg: -4.608px;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-64: 64px;
  --spacing-80: 80px;

  /* Layout */
  --page-max-width: 1440px;
  --section-gap: 80px;
  --card-padding: 24px;
  --element-gap: 8px;

  /* Border Radius */
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;

  /* Named Radii */
  --radius-cards: 12px;
  --radius-pills: 9999px;
  --radius-small: 4px;
  --radius-buttons: 8px;

  /* Surfaces */
  --surface-page-canvas: #f6f5f4;
  --surface-card-surface: #ffffff;
  --surface-accent-card-surface: #ffb110;
  --surface-dark-card-surface: #02093a;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-notion-blue: #0075de;
  --color-paper-warmth: #f6f5f4;
  --color-pure-white: #ffffff;
  --color-ink-black: #000000;
  --color-charcoal: #111111;
  --color-stone: #757575;
  --color-graphite: #615d59;
  --color-slate: #696969;
  --color-sky-tint: #e6f3fe;
  --color-marigold: #ffb110;
  --color-coral: #f64932;
  --color-saffron: #e89d01;
  --color-vermillion: #e32d14;
  --color-mocha: #b18164;
  --color-signal-blue: #097fe8;
  --color-sky-wash: #62aef0;
  --color-midnight-ink: #02093a;

  /* Typography */
  --font-notioninter: 'NotionInter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-lyon-text: 'Lyon Text', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1.33;
  --tracking-caption: 0.12px;
  --text-body-sm: 14px;
  --leading-body-sm: 1.43;
  --text-body: 16px;
  --leading-body: 1.5;
  --text-subheading: 20px;
  --leading-subheading: 1;
  --text-heading-sm: 22px;
  --leading-heading-sm: 1.27;
  --tracking-heading-sm: -0.242px;
  --text-heading: 40px;
  --leading-heading: 1.5;
  --text-heading-lg: 48px;
  --leading-heading-lg: 1.5;
  --text-display-sm: 54px;
  --leading-display-sm: 1.04;
  --tracking-display-sm: -1.89px;
  --text-display: 72px;
  --leading-display: 1.21;
  --tracking-display: -2.016px;
  --text-display-lg: 96px;
  --leading-display-lg: 1.04;
  --tracking-display-lg: -4.608px;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-64: 64px;
  --spacing-80: 80px;

  /* Border Radius */
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;
}
```
