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
  accent-light: "#0064c8"
  accent-dark: "#2997ff"
  accent-solid-light: "#0071e3"
  accent-solid-dark: "#0071e3"
  success-light: "#1f7835"
  success-dark: "#30d158"
  warning-light: "#b52f00"
  warning-dark: "#ff9f0a"
  danger-light: "#c20013"
  danger-dark: "#ff6961"
  mode-maritimo-light: "#5856d6"
  mode-maritimo-dark: "#6f71fc"
  mode-terrestre-light: "#248a3d"
  mode-terrestre-dark: "#017829"
  mode-aereo-light: "#ff2d55"
  mode-aereo-dark: "#e60e4c"
  mode-ferreo-light: "#ff9500"
  mode-ferreo-dark: "#ce7f00"
  mode-fluvial-light: "#32ade6"
  mode-fluvial-dark: "#29a1cc"
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
  display-public:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: "3.875rem"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  headline-public:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  lead:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.625
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
  gutter-lg: "56px"
  gutter-xl: "80px"
  section: "80px"
  section-lg: "112px"
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
  logo-mark:
    backgroundColor: "{colors.accent-solid-light}"
    textColor: "#ffffff"
    size: "32px"
  public-header:
    backgroundColor: "{colors.background-light}"
    height: "64px"
  mode-strip-cell:
    backgroundColor: "{colors.card-light}"
    height: "56px"
---

## Overview

Westvane es una herramienta de operación para despachadores y planificadores de carga: jornadas largas, escritorio Windows y celular Android, español de Colombia. La referencia es el software profesional (Apple, Mercury, Linear, Notion), no un tablero de métricas: una página se lee como un informe. Superficies opacas separadas por una línea fina, cifras grandes donde importan, filas en lugar de tarjetas y una sola navegación flotante. La identidad vive en los detalles del dominio (cinco modos de transporte con color propio, cadena de modos por envío, cierres que se propagan) y no en la decoración.

## Colors

- **Un color significa una cosa.** Azul de acento = interactivo. Verde, naranja y rojo = estado (en ruta, transbordo o aviso, retraso o cierre). Los cinco colores de modo identifican únicamente el modo.
- **Colores de Apple.** Los rellenos, gráficos y modos usan los colores de sistema de Apple (iOS/macOS); el texto de
  estado usa sus variantes de «contraste aumentado», ajustadas lo mínimo para llegar a 4,5:1 también sobre su tinte al
  14 % y sobre los resaltados (en claro: acento `#0064c8`, rojo `#c20013`, naranja `#b52f00`; los escaneos de `axe` lo comprueban). El acento es el azul de apple.com: `#0071e3` en botones (los dos temas) y `#0064c8` / `#2997ff` como texto.
  Se cambió el 29/10/2026: la paleta anterior (magenta, violeta, turquesa y un acento índigo en oscuro) «se notaba
  hecha por IA».
- **Tema claro por defecto** (fondo `#f5f5f7`, tarjeta `#ffffff`); oscuro elegido a mano o "Sistema". El oscuro no es
  una inversión: tiene su propia paleta de modos.
- **El modo nunca va solo en color:** siempre lleva ícono y texto.
- **Paleta de modos validada** con el validador de la skill de visualización (OKLab ×100, protanopía y deuteranopía,
  todas las parejas, porque en el mapa se ven juntos):
  - **Claro:** índigo `#5856d6` (marítimo), verde `#248a3d` (terrestre, el verde accesible de Apple), rosa `#ff2d55`
    (aéreo), naranja `#ff9500` (férreo), cian `#32ade6` (fluvial). Peor pareja con daltonismo 8,9 y con visión normal
    20,4.
  - **Oscuro:** los mismos tonos con la luminosidad dentro de la banda del oscuro (0,48–0,67): `#6f71fc`, `#017829`,
    `#e60e4c`, `#ce7f00`, `#29a1cc`. Peor pareja 8,9 con daltonismo y 16,2 con visión normal; todos ≥3:1 sobre
    `#1c1c1e`.
  - **Descartados:** el café de Apple (se lee gris y se confunde con el rosa), el morado (choca con el índigo) y el
    verde de sistema puro en terrestre (6,5 con el rosa).
  - Los valores viven en `lib/modes.ts` (RGB para el mapa) y en `globals.css` (`--mode-*`).
- **Contraste:** el texto usa las variantes oscuras (`--accent`, `--success`, `--warning`, `--danger`) para llegar a 4,5:1 también sobre sus tintes al 12 %. Los colores del sistema (`--sys-*`) son para rellenos y gráficos, no para texto pequeño.

## Typography

Una sola familia: Inter Variable, empaquetada (sin fuentes propietarias). Título de página 2 rem en celular y 2,5 rem en escritorio, a peso 600 con interletraje negativo; las tres cifras principales del resumen escalan hasta 3,75 rem. Cuerpo 0,9375 rem, etiquetas 0,8125 rem. Las cifras usan numerales tabulares (`.tabular`) y van alineadas a la derecha en tablas. Código de envío e identificadores en monoespaciada. Un texto sin espacios se parte (`overflow-wrap: anywhere`) en lugar de ensanchar la página.

Las páginas públicas usan la misma familia y el mismo peso con una escala mayor, porque se leen una vez y no a diario: titular de portada `display-public` (2,5 rem en celular, 3,25 rem desde `sm`, 3,875 rem desde `xl`, con `text-balance`), títulos de sección `headline-public` (2 rem en celular, 2,75 rem desde `sm`; los capítulos de modo se quedan en 2,5 rem y 18 caracteres de ancho) y párrafo de entrada `lead` en gris secundario a 52–60 caracteres de ancho.

## Layout

- **Dock** como única navegación. Escritorio: píldora flotante centrada arriba (radio 999 px) con logo y estado del sistema, cinco destinos (Resumen, Envíos, Red, Flota, Más), avisos y búsqueda `Ctrl K`; moneda y apariencia viven dentro del menú «Más», no en la barra. Celular: barra inferior con los mismos destinos; "Más" abre una hoja inferior con el resto de páginas, los avisos y los ajustes (moneda y apariencia incluidas).
- **Páginas** con ancho máximo (`page`, y `page-narrow` en las fichas para que el mapa no crezca sin límite). El resumen abre con las tres cifras principales en una sola superficie, sigue con "Requiere atención" y después el detalle.
- Listas largas (vías, nodos) en secciones plegables con encabezado fijo y recuento; lo cerrado va primero.
- Objetivos táctiles de al menos 44 px en pantallas táctiles; sin desborde horizontal desde 360 px.
- **Páginas públicas sin dock.** La presentación en `/` y el seguimiento (`/seguimiento/…`) no llevan dock, avisos ni bienvenida de la app (`isPublicPath`, `ShellOnly`); la página marca `data-public-page` y el `<main>` deja de reservar el espacio del dock. La presentación lleva su propia barra: 64 px, fija arriba, opaca sobre el fondo con línea inferior, marca a la izquierda, anclas al centro y a la derecha «Entrar a la app» (enlace) y la acción principal.
- **Un solo borde izquierdo en la presentación.** Todas las secciones y la barra comparten el mismo margen (16 px, 32 px desde `sm`, 56 px desde `lg`, 80 px desde `xl`) y un ancho máximo de 1440 px alineado a la izquierda, sin centrar. En escritorio cada sección es una rejilla de 5/12 y 7/12: título y entrada a la izquierda, contenido a la derecha. Las secciones se separan por una línea fina, con 80 px de aire vertical (112 px en escritorio), y alternan fondo y tarjeta.

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
- **Calendario:** barras del color del estado; el retraso es un tramo rayado, no otro color. Ficha propia al pasar el puntero o con el foco (no el tooltip del navegador).
- **Mapa por departamento:** un solo tono del acento en cinco pasos por cuantiles, gris para «sin movimiento», leyenda con rangos.
- **Impresión:** papel blanco y tinta oscura aunque la app esté en oscuro; sin dock, controles ni mapa; las tarjetas no se cortan entre páginas.
- **Modo presentación:** cifras a 7 vw para proyectar, actualizadas cada 30 s mientras está abierto.
- **Control segmentado (`Segmented`):** fondo `fill`, píldora de tarjeta que se desliza; `md` en cabeceras, `sm` en paneles; grupo de radio con flechas del teclado. Es el único segmentado de la app.
- **Casilla de verificación:** 16 px, radio de 5 px, línea `separator-strong`; marcada, acento sólido con palomita; estado parcial con guion.
- **Mapa de calor de retrasos (`DelayHeatmap`):** tabla de vías por día, un tono del acento en cinco pasos por quintiles sin repetir cortes; el paso más oscuro es el acento pleno con texto blanco. Detalle al pasar el puntero y con el foco.
- **Bienvenida (`ConsentGate`):** diálogo con dos casillas separadas y sin marcar (términos y datos) y el aviso de privacidad corto; los documentos legales se leen sin aceptar y llevan aviso de borrador mientras falten datos del responsable.
- **Vista plana de la red (`NetworkPreview`):** SVG con departamentos, enlaces por modo, nodos y flota de tamaño fijo en pantalla; es lo que muestra el Resumen y lo que se ve mientras carga el mapa 3D.
- **Marca (`LogoMark`, `Wordmark`):** cuadro de esquinas suaves (radio de 112 sobre 512) en el azul de los botones con la W trazada en blanco como una ruta: trazo grueso de extremos y uniones redondos, origen y destino en círculos blancos y un transbordo calado en el vértice central. Es el mismo dibujo que `app/icon.svg` (favicon e íconos de instalación): si cambia uno, cambia el otro. En el dock va sola a 32 px; en la barra y el pie públicos va a 28 px junto al nombre en Inter 600 a 1,0625 rem. El nombre nunca va en otra fuente ni como imagen.
- **Red como página (`NetworkStory`):** la vista plana de la red queda fija mientras se baja (a la derecha a toda la altura bajo la barra en escritorio; arriba, a 42 % de la pantalla, en el celular) y los capítulos pasan a su lado, cada uno de al menos 80 % de la altura y separados por líneas finas. El capítulo que cruza la franja central de lectura enciende su modo; la introducción y el cierre no resaltan nada. Al pie del mapa, la **franja de modos**: cinco celdas separadas por líneas, ícono y nombre del modo con sus kilómetros; la activa toma el fondo elevado y una barra de 2 px del color del modo que crece con `scaleX`; un clic lleva al capítulo. Es un patrón de presentación, no de la app de trabajo.
- **Resalte de modo (`NetworkPreview`, prop `focus`):** con un modo resaltado, enlaces, nodos y flota de los demás bajan a 12 % de opacidad en 500 ms; la red se sigue leyendo y el ojo va al modo. Solo cambia la opacidad: no se redibuja ni corre reloj. Con `closureLabels`, cada corredor cerrado lleva un punto rojo y el rótulo «… · cerrado» en rojo con halo del fondo, solo en pantallas anchas.
- **Seguimiento público:** columna de 42 rem sin menú: código en mono, estado, avance, llegada estimada y recorrido por tramos con ícono de modo (hecho, en curso, pendiente); nada interno.
- **Atajos:** `Ctrl K` o `/` buscar (envíos, ciudades, vehículos, bodegas, vías y páginas), `n` nuevo envío, `g` y una letra para navegar, `?` ayuda.

## Motion

- Curva base `cubic-bezier(0.16, 1, 0.3, 1)`: 0,3 s en interacciones, 0,5 s en entradas de vista. Resorte estándar (`SPRING`) para lo que se desliza con `layoutId` (píldora del segmentado, indicador del dock).
- **Presión (`press`):** baja a 0,97 en 120 ms; al soltar vuelve con un rebote de 300 ms. Sin escala al pasar el puntero (`lift` solo cambia borde y fondo).
- **Solo `transform` y `opacity`.** Barras y líneas de tiempo crecen con `scaleX`/`scaleY`; nada anima `width`, `height`, `top` ni `box-shadow` en listas, tablas o mapa.
- **El mapa está quieto en reposo.** Su reloj solo corre mientras se arrastra, se hace zoom o está en pantalla completa con animación activa; se monta cuando entra en pantalla y en tiempo ocioso, por capas.
- **Medidores (`meter-fill`):** relleno a todo el ancho escalado con `--v`; crece al aparecer y se desliza al cambiar. **Sparklines** se dibujan con una máscara que crece; **calendario** crece por filas (20 ms); **mapa por departamento** se llena por intensidad; lo **recién creado** entra con `.enter`.
- **Presentación:** el mapa entra una sola vez con un fundido de 0,4 s al llegar los datos; después solo cambia la opacidad al cambiar de capítulo. El salto desde la franja de modos se desplaza suave salvo con «reducir movimiento».
- **Apariencia:** cambiar de tema funde la página en 250 ms (View Transitions); lo usado a diario (Ctrl K, atajos) no anima.
- Todo componente respeta "reducir movimiento" (`MotionConfig reducedMotion="user"` y `motion-reduce:` en CSS).

## Do's and Don'ts

- Sí: jerarquía por tamaño y valor, filas y líneas finas, una cifra grande donde importa.
- Sí: marcar lo aproximado como aproximado; no inventar vías ni municipios sin trazado real.
- Sí: que lo que no se ve no trabaje: sondeos en pausa con la pestaña oculta o fuera de pantalla.
- Sí: resaltar un modo bajando lo demás a 12 % de opacidad, y acompañar el color del modo con su ícono y su nombre.
- Sí: en las páginas públicas, un solo borde izquierdo para todas las secciones y ningún elemento del armazón de la app (dock, avisos, bienvenida).
- No: tarjetas idénticas como estructura de página, íconos en círculos sobre cada cifra, tarjetas dentro de tarjetas, vidrio decorativo.
- No: color como único portador de significado, `transition: all`, nuevas curvas de movimiento, fuentes propietarias o fotos de terceros.
