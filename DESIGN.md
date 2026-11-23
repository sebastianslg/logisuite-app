---
name: Westvane TMS
description: Herramienta profesional de operación multimodal para Colombia. Se lee como un documento de trabajo (superficies opacas, líneas finas, cifras grandes), con un dock flotante como única navegación y el vidrio reservado para lo que flota sobre el mapa.
colors:
  background-light: "#f2f2f7"
  background-dark: "#111316"
  foreground-light: "#1d1d1f"
  foreground-dark: "#eeeff2"
  card-light: "#ffffff"
  card-dark: "#191b1f"
  raised-light: "#f0f1f4"
  raised-dark: "#222429"
  muted-foreground-light: "#5e626a"
  muted-foreground-dark: "#a6a9b1"
  accent-light: "#007aff"
  accent-dark: "#5ac8fa"
  accent-text-light: "#0062cc"
  accent-solid-light: "#0062cc"
  accent-solid-dark: "#0a84ff"
  success-light: "#227240"
  success-dark: "#6bc987"
  warning-light: "#944300"
  warning-dark: "#f6a65d"
  danger-light: "#b82e30"
  danger-dark: "#f47a79"
  info-light: "#0062cc"
  info-dark: "#86baeb"
  mode-maritimo-light: "#0040dd"
  mode-maritimo-dark: "#409cff"
  mode-terrestre-light: "#34c759"
  mode-terrestre-dark: "#30d158"
  mode-aereo-light: "#af52de"
  mode-aereo-dark: "#bf5af2"
  mode-ferreo-light: "#636366"
  mode-ferreo-dark: "#aeaeb2"
  mode-fluvial-light: "#5ac8fa"
  mode-fluvial-dark: "#64d2ff"
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
    backgroundColor: "rgba(22,25,32,0.05)"
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

Westvane es una herramienta de operación para despachadores y planificadores de carga: jornadas largas, escritorio Windows y celular Android, español de Colombia. La referencia es el software profesional (Linear, Mercury, Vercel, Notion), no un tablero de métricas: una página se lee como un informe. Superficies opacas separadas por una línea fina, cifras grandes donde importan, filas en lugar de tarjetas y una sola navegación flotante. La identidad vive en los detalles del dominio (cinco modos de transporte con color propio, cadena de modos por envío, cierres que se propagan) y no en la decoración.

## Colors

Paleta vigente del dueño (22/11/2026), la misma que está en producción. Sustituye a la «interfaz en tinta» de la
sección 76. Los valores viven en `globals.css` (tokens `--*`) y en `lib/modes.ts` (RGB para el mapa).

| Uso | Claro | Oscuro | Contraste medido |
|---|---|---|---|
| Fondo / tarjeta | `#F2F2F7` / `#FFFFFF` | `#111316` / `#191B1F` | — |
| Texto principal | `#1D1D1F` | `#EEEFF2` | 15,1:1 sobre el fondo claro; 14,9:1 sobre la tarjeta oscura |
| Texto secundario | `#5E626A` | `#A6A9B1` | 5,2:1 / 7,3:1 |
| Énfasis (texto y enlaces) | `#0062CC` | `#5AC8FA` | 5,2:1 sobre el fondo; 9,8:1 sobre la tarjeta oscura |
| Énfasis de marca (íconos, focos, detalles) | `#007AFF` | `#5AC8FA` | 4,0:1 con blanco: **no se usa para texto pequeño** |
| Botón principal | `#0062CC` + blanco | `#0A84FF` + `#111316` | 5,8:1 / 5,1:1 |

- **Decisión tomada (contraste):** el botón principal usa `#0062CC` con texto blanco (5,8:1). El blanco sobre `#007AFF`
  mide 4,0:1 y no cumple AA en texto de 14 px; el texto oscuro sobre `#007AFF` tampoco (4,2:1). `#007AFF` se conserva
  para íconos, focos, indicadores y marcas, donde no hay texto que leer.
- **El color es para datos:** los cinco modos de transporte y los estados. Un color significa una cosa. El acento azul
  no compite con ellos.
- **Estados** (texto y rellenos; todos ≥ 4,5:1 sobre la tarjeta y sobre su tinte al 12 %): éxito `#227240` / `#6BC987`
  (5,9:1 / 8,5:1), aviso `#944300` / `#F6A65D` (6,9:1 / 8,7:1), peligro `#B82E30` / `#F47A79` (6,1:1 / 6,5:1), en curso
  `#0062CC` / `#86BAEB` (5,8:1 / 8,4:1). El verde de la paleta (`#34C759`) es de datos y rellenos; como texto no pasa AA,
  por eso el texto de éxito usa el verde oscuro.
- **Modos de transporte** (los cinco se ven juntos en el mapa; siempre con ícono y nombre, nunca solo color):

  | Modo | Claro | Oscuro | Claro sobre el fondo | Oscuro sobre la tarjeta |
  |---|---|---|---:|---:|
  | Marítimo | `#0040DD` | `#409CFF` | 6,8:1 | 6,1:1 |
  | Terrestre | `#34C759` | `#30D158` | 2,0:1 | 8,5:1 |
  | Aéreo | `#AF52DE` | `#BF5AF2` | 3,7:1 | 4,9:1 |
  | Férreo | `#636366` | `#AEAEB2` | 5,4:1 | 7,8:1 |
  | Fluvial | `#5AC8FA` | `#64D2FF` | 1,7:1 | 10,0:1 |

  Los tonos claros de terrestre y fluvial no llegan a 3:1 sobre el fondo: son rellenos y trazos de datos, nunca el único
  indicador; el ícono, el nombre y el grosor del trazo los acompañan. Es la paleta del dueño y **no se cambia**.
- **El oscuro se diseña aparte.** Tres capas con el mismo tono frío: fondo `#111316`, tarjeta `#191B1F`, elevado
  `#222429`; texto `#EEEFF2` (nunca blanco puro) y secundario `#A6A9B1`. Las tarjetas no llevan sombra (no se ve en
  oscuro) sino un borde de luz arriba (`--card-edge`); lo que flota suma un anillo de 1 px de luz.
- **El modo nunca va solo en color:** siempre lleva ícono y texto.
- **Marca:** la W en un cuadro del acento sólido (azul) con la W blanca; en oscuro, `#0A84FF` con la W en `#111316`.
  `app/icon.svg`, los íconos, el `.ico`, la imagen para compartir y el PDF usan el mismo acento.

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
- **Campo (`field`):** línea fina, foco con anillo del acento de 3 px; error en rojo con mensaje en español, `aria-invalid` y foco al primer error.
- **Tendencia (`Sparkline`, `Delta`):** línea de 1,5 px de una sola serie, escala desde cero, valor del día al pasar el puntero; el cambio contra el período anterior va con flecha dibujada y texto («Sube 12 %»), en verde o rojo solo si esa dirección es buena o mala (los retrasos).
- **Línea de tiempo (`ShipmentJournal`):** hora a la izquierda, punto con ícono y texto a la derecha; lo previsto atenuado y una marca de «Ahora» en el acento.
- **Calendario:** barras del color del estado; el retraso es un tramo rayado, no otro color. Ficha propia al pasar el puntero o con el foco (no el tooltip del navegador).
- **Mapa por departamento:** un solo tono de acento en cinco pasos por cuantiles, gris para «sin movimiento», leyenda con rangos.
- **Impresión:** papel blanco y tinta oscura aunque la app esté en oscuro; sin dock, controles ni mapa; las tarjetas no se cortan entre páginas.
- **Modo presentación:** cifras a 7 vw para proyectar, actualizadas cada 30 s mientras está abierto.
- **Control segmentado (`Segmented`):** fondo `fill`, píldora de tarjeta que se desliza; `md` en cabeceras, `sm` en paneles; grupo de radio con flechas del teclado. Es el único segmentado de la app.
- **Casilla de verificación:** 16 px, radio de 5 px, línea `separator-strong`; marcada, acento sólido con palomita; estado parcial con guion.
- **Mapa de calor de retrasos (`DelayHeatmap`):** tabla de vías por día, un tono de acento en cinco pasos por quintiles sin repetir cortes; el paso más oscuro es el acento pleno con el texto del botón principal. Detalle al pasar el puntero y con el foco.
- **Bienvenida (`ConsentGate`):** diálogo con dos casillas separadas y sin marcar (términos y datos) y el aviso de privacidad corto; los documentos legales se leen sin aceptar y llevan aviso de borrador mientras falten datos del responsable.
- **Vista plana de la red (`NetworkPreview`):** SVG con departamentos, enlaces por modo, nodos y flota de tamaño fijo en pantalla; es lo que muestra el Resumen y lo que se ve mientras carga el mapa 3D.
- **Marca (`LogoMark`, `Wordmark`):** cuadro de esquinas suaves (radio de 112 sobre 512) en el azul de los botones con la W trazada en blanco como una ruta: trazo grueso de extremos y uniones redondos, origen y destino en círculos blancos y un transbordo calado en el vértice central. Es el mismo dibujo que `app/icon.svg` (favicon e íconos de instalación): si cambia uno, cambia el otro. En el dock va sola a 32 px; en la barra y el pie públicos va a 28 px junto al nombre en Inter 600 a 1,0625 rem. El nombre nunca va en otra fuente ni como imagen.
- **Red como página (`NetworkStory`):** la vista plana de la red queda fija mientras se baja (a la derecha a toda la altura bajo la barra en escritorio; arriba, a 42 % de la pantalla, en el celular) y los capítulos pasan a su lado, cada uno de al menos 80 % de la altura y separados por líneas finas. El capítulo que cruza la franja central de lectura enciende su modo; la introducción y el cierre no resaltan nada. Al pie del mapa, la **franja de modos**: cinco celdas separadas por líneas, ícono y nombre del modo con sus kilómetros; la activa toma el fondo elevado y una barra de 2 px del color del modo que crece con `scaleX`; un clic lleva al capítulo. Es un patrón de presentación, no de la app de trabajo.
- **Resalte de modo (`NetworkPreview`, prop `focus`):** con un modo resaltado, enlaces, nodos y flota de los demás bajan a 12 % de opacidad en 500 ms; la red se sigue leyendo y el ojo va al modo. Solo cambia la opacidad: no se redibuja ni corre reloj. Con `closureLabels`, cada corredor cerrado lleva un punto rojo y el rótulo «… · cerrado» en rojo con halo del fondo, solo en pantallas anchas.
- **Seguimiento público:** columna de 42 rem sin menú: código en mono, estado, avance, llegada estimada y recorrido por tramos con ícono de modo (hecho, en curso, pendiente); nada interno.
- **Atajos:** `Ctrl K` o `/` buscar (envíos, ciudades, vehículos, bodegas, vías y páginas), `n` nuevo envío, `g` y una letra para navegar, `?` ayuda.

## Motion

- Curva base `cubic-bezier(0.16, 1, 0.3, 1)`: 0,3 s en interacciones, 0,5 s en entradas de vista. Resorte estándar (`SPRING`) para lo que se desliza con `layoutId` (píldora del segmentado, indicador del dock).
- **Presión (`press`):** baja a 0,97 en 120 ms; al soltar vuelve con un rebote de 300 ms. **Superficie clicable (`lift`):** sube 2 px en 200 ms (`cubic-bezier(0.23, 1, 0.32, 1)`) y al presionar se hunde a 0,98 en 120 ms; sin sombra y quieta con «reducir movimiento».
- **Solo `transform` y `opacity`.** Barras y líneas de tiempo crecen con `scaleX`/`scaleY`; nada anima `width`, `height`, `top` ni `box-shadow` en listas, tablas o mapa.
- **El mapa está quieto en reposo.** Su reloj solo corre mientras se arrastra, se hace zoom o está en pantalla completa con animación activa; se monta cuando entra en pantalla y en tiempo ocioso, por capas.
- **Medidores (`meter-fill`):** relleno a todo el ancho escalado con `--v`; crece al aparecer y se desliza al cambiar. **Sparklines** se dibujan con una máscara que crece; **calendario** crece por filas (20 ms); **mapa por departamento** se llena por intensidad; lo **recién creado** entra con `.enter`.
- **Presentación:** el mapa entra una sola vez con un fundido de 0,4 s al llegar los datos; después solo cambia la opacidad al cambiar de capítulo. El salto desde la franja de modos se desplaza suave salvo con «reducir movimiento».
- **Listas que llegan (`list-in`):** cada fila sube 6 px y aparece, en cascada de 30 ms con tope de 360 ms; solo al montarse (resumen, hoy, envíos, flota, fallas, mantenimientos, vías, clientes, auditoría, solicitudes y franjas de cifras).
- **Presentación:** la red se enciende modo por modo al cargar (`mode-in`, 150 ms entre modos) y los nodos llegan al final (`nodes-in`); cada sección entra una vez al aparecer (`Reveal`); los tramos de la ruta en vivo crecen en orden con cada resultado (`leg-in`).
- **Apariencia:** cambiar de tema funde la página en 250 ms (View Transitions); lo usado a diario (Ctrl K, atajos) no anima.
- **De lista a ficha y de vuelta:** la página se desliza 24 px en la dirección del viaje (View Transitions de React, tipos `nav-forward` y `nav-back`; `PageTransition` en cada página). Sale en 140 ms, entra en 320 ms después; el dock queda quieto. Entre secciones, solo el fundido de la plantilla.
- **Avisos:** patrón de Sonner: pausa al pasar el puntero o con la pestaña oculta, barra del tiempo que queda, deslizar para cerrar.
- Todo componente respeta "reducir movimiento" (`MotionConfig reducedMotion="user"` y `motion-reduce:` en CSS).

## Do's and Don'ts

- Sí: jerarquía por tamaño y valor, filas y líneas finas, una cifra grande donde importa.
- Sí: marcar lo aproximado como aproximado; no inventar vías ni municipios sin trazado real.
- Sí: que lo que no se ve no trabaje: sondeos en pausa con la pestaña oculta o fuera de pantalla.
- Sí: resaltar un modo bajando lo demás a 12 % de opacidad, y acompañar el color del modo con su ícono y su nombre.
- Sí: en las páginas públicas, un solo borde izquierdo para todas las secciones y ningún elemento del armazón de la app (dock, avisos, bienvenida).
- No: tarjetas idénticas como estructura de página, íconos en círculos sobre cada cifra, tarjetas dentro de tarjetas, vidrio decorativo.
- No: color como único portador de significado, usar el acento azul para texto pequeño sin comprobar contraste, `transition: all`, nuevas curvas de movimiento, fuentes propietarias o fotos de terceros.
