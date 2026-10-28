---
name: Westvane TMS
description: Herramienta profesional de operación multimodal para Colombia. Se lee como un documento de trabajo (superficies opacas, líneas finas, cifras grandes), con un dock flotante como única navegación y el vidrio reservado para lo que flota sobre el mapa.
colors:
  background-light: "#f5f5f7"
  background-dark: "#000000"
  foreground-light: "#1d1d1f"
  foreground-dark: "#f5f5f7"
  card-light: "#ffffff"
  card-dark: "#1c1c1e"
  muted-foreground-light: "#5f5f64"
  muted-foreground-dark: "#a1a1a6"
  accent-light: "#005bb5"
  accent-dark: "#8f9cf7"
  accent-solid-light: "#0071e3"
  accent-solid-dark: "#5266eb"
  success-light: "#18703a"
  success-dark: "#32d74b"
  warning-light: "#984c00"
  warning-dark: "#ff9f0a"
  danger-light: "#ad111b"
  danger-dark: "#ff6961"
  mode-maritimo-light: "#5044db"
  mode-maritimo-dark: "#684af5"
  mode-terrestre-light: "#26a683"
  mode-terrestre-dark: "#26a683"
  mode-aereo-light: "#d623a7"
  mode-aereo-dark: "#c82a9c"
  mode-ferreo-light: "#bc812f"
  mode-ferreo-dark: "#bc812f"
  mode-fluvial-light: "#3c88e5"
  mode-fluvial-dark: "#5b91d7"
typography:
  display:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  hero-figure:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 3.6vw, 3.75rem)"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: "-0.045em"
  body:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "-0.011em"
  label:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
  mono:
    fontFamily: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "14px"
  2xl: "16px"
  3xl: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent-solid-light}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "rgba(120,120,128,0.1)"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.md}"
    height: "36px"
  surface:
    backgroundColor: "{colors.card-light}"
    border: "1px solid rgba(0,0,0,0.08)"
    rounded: "{rounded.3xl}"
  dock:
    rounded: "{rounded.pill}"
    height: "56px"
---

## Overview

Westvane es una herramienta de operación para despachadores y planificadores de carga: jornadas largas, escritorio Windows y celular Android, español de Colombia. La referencia es el software profesional (Apple, Mercury, Linear, Notion), no un tablero de métricas: una página se lee como un informe. Superficies opacas separadas por una línea fina, cifras grandes donde importan, filas en lugar de tarjetas y una sola navegación flotante. La identidad vive en los detalles del dominio (cinco modos de transporte con color propio, cadena de modos por envío, cierres que se propagan) y no en la decoración.

## Colors

- **Un color significa una cosa.** Azul de acento = interactivo. Verde, naranja y rojo = estado (en ruta, transbordo o aviso, retraso o cierre). Los cinco colores de modo identifican únicamente el modo.
- **Tema claro por defecto** (fondo `#f5f5f7`, tarjeta `#ffffff`); oscuro elegido a mano o "Sistema". El oscuro no es una inversión: tiene acento propio (`#5266eb` de relleno, `#8f9cf7` como texto) y su propia paleta de modos.
- **El modo nunca va solo en color:** siempre lleva ícono y texto.
- **Paleta de modos validada** con el validador de la skill de visualización (OKLab ×100, simulación de protanopía y deuteranopía, todas las parejas): mínimo 8,1 con daltonismo y 15,9 con visión normal en claro; 9,3 y 16,4 en oscuro. La paleta propuesta al inicio (terrestre `#0f9d7a`, fluvial `#0a84ff`, marítimo `#5e5ce6`, aéreo `#d6399b`, férreo `#c98a00`) fallaba: aéreo y terrestre se confundían en deuteranopía (4,4) y fluvial y marítimo quedaban demasiado cerca incluso con visión normal (10,5). Se movió cada tono dentro de su familia (±15°) hasta pasar. Los valores viven en `lib/modes.ts` (RGB para el mapa) y en `globals.css` (`--mode-*`).
- **Contraste:** el texto usa las variantes oscuras (`--accent`, `--success`, `--warning`, `--danger`) para llegar a 4,5:1 también sobre sus tintes al 12 %. Los colores del sistema (`--sys-*`) son para rellenos y gráficos, no para texto pequeño.

## Typography

Una sola familia: Inter Variable, empaquetada (sin fuentes propietarias). Título de página 2 rem en celular y 2,5 rem en escritorio, a peso 600 con interletraje negativo; las tres cifras principales del resumen escalan hasta 3,75 rem. Cuerpo 0,9375 rem, etiquetas 0,8125 rem. Las cifras usan numerales tabulares (`.tabular`) y van alineadas a la derecha en tablas. Código de envío e identificadores en monoespaciada. Un texto sin espacios se parte (`overflow-wrap: anywhere`) en lugar de ensanchar la página.

## Layout

- **Dock** como única navegación. Escritorio: píldora flotante centrada arriba (radio 999 px) con logo y estado del sistema, cinco destinos (Resumen, Envíos, Red, Flota, Más), avisos, búsqueda `Ctrl K`, moneda y tema. Celular: barra inferior con los mismos destinos; "Más" abre una hoja inferior con el resto de páginas, los avisos y los ajustes.
- **Páginas** con ancho máximo (`page`, y `page-narrow` en las fichas para que el mapa no crezca sin límite). El resumen abre con las tres cifras principales en una sola superficie, sigue con "Requiere atención" y después el detalle.
- Listas largas (vías, nodos) en secciones plegables con encabezado fijo y recuento; lo cerrado va primero.
- Objetivos táctiles de al menos 44 px en pantallas táctiles; sin desborde horizontal desde 360 px.

## Elevation & Depth

- **`glass`** (el nombre se conservó) ya no es vidrio: es la superficie de contenido, tarjeta opaca con borde de 1 px, sin sombra ni desenfoque. Separa por valor, no por elevación.
- **`rows` / `rule-list` / `row-link`**: filas dentro de una sola superficie, separadas por líneas finas; la fila clicable se marca con un paso de fondo.
- **`floating`**: menús, popovers y el dock cuando está sobre la página: tarjeta opaca con la sombra flotante (`--float-shadow`). Es lo único con sombra.
- **`glass-float`**: vidrio de verdad (desenfoque 24 px), solo para paneles que flotan sobre el mapa, donde hay algo detrás que desenfocar.
- Con "reducir transparencia" todo lo translúcido se vuelve opaco.

## Shapes

Radios: 20 px en superficies de página, 16 px en bloques interiores, 12 a 14 px en controles y campos, 10 px en botones y 8 px en elementos pequeños. Dock, chips de filtro, controles segmentados e insignias son píldoras.

## Components

- **Cifras principales (`HeroFigures`):** envíos en ruta, con retraso y costo comprometido en tránsito, en grande dentro de una superficie; debajo, tras una línea, las secundarias en fila compacta. Cada cifra abre la vista filtrada y cuenta desde el valor anterior cuando cambia.
- **Franja de cifras (`StatStrip`):** celdas separadas por líneas, en lugar de tarjetas KPI con ícono en círculo.
- **Atención (`Attention`, `AlertsMenu`):** filas con ícono y destino para sin ruta, vías y nodos cerrados, redirigidos y retrasados; la campana del dock las muestra desde cualquier página. Sin nada pendiente, una línea de "todo en orden".
- **Cadena de modos (`RouteChain`):** un tramo por barra del color de su modo, largo proporcional al tiempo, relleno de lo recorrido y marca de transbordo. Es el elemento propio del producto.
- **Tabla de detalle (`DetailTable`):** columnas numéricas a la derecha, barra de proporción fina (escala, no ancho) y exportación a CSV; la lista de envíos exporta además a Excel.
- **Estado vacío (`EmptyState`), aviso (`toast`), guardado (`SaveIcon`):** vacío con una cifra grande y una acción; avisos de 4 s, máximo tres; el botón de guardar respira mientras guarda y confirma con un check.
- **Hoja (`Sheet`):** inspector a la derecha en escritorio; hoja inferior que se cierra deslizando en celular.
- **Campo (`field`):** línea fina, foco con anillo de acento de 3 px; error en rojo con mensaje en español, `aria-invalid` y foco al primer error.
- **Tendencia (`Sparkline`, `Delta`):** línea de 1,5 px de una sola serie, escala desde cero, valor del día al pasar el puntero; el cambio contra el período anterior va con flecha dibujada y texto («Sube 12 %»), en verde o rojo solo si esa dirección es buena o mala (los retrasos).
- **Línea de tiempo (`ShipmentJournal`):** hora a la izquierda, punto con ícono y texto a la derecha; lo previsto atenuado y una marca de «Ahora» en el color de acento.
- **Calendario:** barras del color del estado; el retraso es un tramo rayado, no otro color.
- **Mapa por departamento:** un solo tono del acento en cinco pasos por cuantiles, gris para «sin movimiento», leyenda con rangos.
- **Impresión:** papel blanco y tinta oscura aunque la app esté en oscuro; sin dock, controles ni mapa; las tarjetas no se cortan entre páginas.
- **Modo presentación:** cifras a 7 vw para proyectar, actualizadas cada 30 s mientras está abierto.
- **Atajos:** `Ctrl K` o `/` buscar (envíos, ciudades, vehículos, bodegas, vías y páginas), `n` nuevo envío, `g` y una letra para navegar, `?` ayuda.

## Motion

- Curva base `cubic-bezier(0.16, 1, 0.3, 1)`: 0,3 s en interacciones, 0,5 s en entradas de vista. Resorte estándar (`SPRING`) para lo que se desliza con `layoutId` (píldora del segmentado, indicador del dock).
- **Presión (`press`):** baja a 0,97 en 120 ms; al soltar vuelve con un rebote de 300 ms. Sin escala al pasar el puntero (`lift` solo cambia borde y fondo).
- **Solo `transform` y `opacity`.** Barras y líneas de tiempo crecen con `scaleX`/`scaleY`; nada anima `width`, `height`, `top` ni `box-shadow` en listas, tablas o mapa.
- **El mapa está quieto en reposo.** Su reloj solo corre mientras se arrastra, se hace zoom o está en pantalla completa con animación activa; se monta cuando entra en pantalla y en tiempo ocioso, por capas.
- Todo componente respeta "reducir movimiento" (`MotionConfig reducedMotion="user"` y `motion-reduce:` en CSS).

## Do's and Don'ts

- Sí: jerarquía por tamaño y valor, filas y líneas finas, una cifra grande donde importa.
- Sí: marcar lo aproximado como aproximado; no inventar vías ni municipios sin trazado real.
- Sí: que lo que no se ve no trabaje: sondeos en pausa con la pestaña oculta o fuera de pantalla.
- No: tarjetas idénticas como estructura de página, íconos en círculos sobre cada cifra, tarjetas dentro de tarjetas, vidrio decorativo.
- No: color como único portador de significado, `transition: all`, nuevas curvas de movimiento, fuentes propietarias o fotos de terceros.
