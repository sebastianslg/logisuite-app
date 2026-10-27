# Westvane TMS — Plan completo de diseño y movimiento (traspaso)

> Documento único para continuar en otra sesión. Contiene: 1) plan de diseño visual, 2) plan de movimiento. Estado del repositorio: rama main.

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
