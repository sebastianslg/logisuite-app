---
name: Westvane TMS
description: Sistema de gestión de transporte multimodal para Colombia, con el lenguaje visual de las Human Interface Guidelines de Apple (vidrio, curva única de movimiento, colores del sistema).
colors:
  background-light: "#f2f2f7"
  background-dark: "#000000"
  foreground-light: "#1c1c1e"
  foreground-dark: "#f5f5f7"
  card-light: "#ffffff"
  card-dark: "#1c1c1e"
  muted-foreground-light: "#66666b"
  muted-foreground-dark: "#9a9aa1"
  accent-light: "#0066cc"
  accent-dark: "#4da3ff"
  accent-solid-light: "#0066cc"
  accent-solid-dark: "#0b63ce"
  success-light: "#18703a"
  success-dark: "#32d74b"
  warning-light: "#a35200"
  warning-dark: "#ff9f0a"
  danger-light: "#c4141f"
  danger-dark: "#ff6961"
  mode-maritimo-light: "#2f62d6"
  mode-maritimo-dark: "#4a7cf0"
  mode-terrestre-light: "#12805c"
  mode-terrestre-dark: "#199e70"
  mode-aereo-light: "#a63083"
  mode-aereo-dark: "#c6399c"
  mode-ferreo-light: "#a86b00"
  mode-ferreo-dark: "#c98500"
  mode-fluvial-light: "#129dd9"
  mode-fluvial-dark: "#2cc8e0"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter Variable', Inter, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.011em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter Variable', Inter, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "-0.011em"
  metric:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
  mono:
    fontFamily: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  card: "16px"
  panel: "24px"
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
  kpi-card:
    rounded: "{rounded.card}"
    padding: "20px"
  panel:
    rounded: "{rounded.panel}"
---

## Overview

Westvane es una herramienta de operación para despachadores y planificadores de carga: jornadas largas, escritorio Windows y celular Android, español de Colombia. La interfaz imita el lenguaje de macOS: superficies de vidrio sobre un fondo con color suave, tipografía del sistema, colores semánticos que se adaptan a claro y oscuro, y una sola curva de movimiento. La identidad vive en los detalles del dominio (cinco modos de transporte con color propio, cadena de modos por envío, cierres que se propagan) y no en la decoración.

## Colors

- **Un color significa una cosa.** Azul de acento = interactivo. Verde, naranja y rojo = estado (en ruta, transbordo o aviso, retraso o cierre). Los cinco colores de modo identifican únicamente el modo.
- **El modo nunca va solo en color:** siempre lleva ícono y texto.
- **Paleta de modos validada para daltonismo** con simulación de protanopía, deuteranopía y tritanopía: diferencia mínima ΔE 18,8 en claro y 19,5 en oscuro. El orden fijo (marítimo, terrestre, aéreo, férreo, fluvial) es parte de la validación.
- **Contraste:** texto sobre claro usa las variantes oscuras (`--accent`, `--success`, `--warning`, `--danger`) para llegar a 4,5:1. `prefers-contrast: more` endurece bordes, aclara el texto atenuado y quita la transparencia.

## Typography

Una sola familia: la del sistema (SF Pro en Apple) con Inter empaquetada como respaldo en Windows y Android. Escala fija en rem, sin tamaños fluidos: título de página 2,125 rem, métricas 1,5 a 1,875 rem, cuerpo 0,9375 rem, apoyo 0,75 a 0,875 rem. Las cifras usan numerales tabulares (`.tabular`). El código de envío y los identificadores van en monoespaciada. Un texto sin espacios se parte (`overflow-wrap: anywhere`) en lugar de ensanchar la página.

## Layout

- Barra lateral de material translúcido (240 px, contraíble a 68 px) y barra de herramientas con búsqueda, moneda y apariencia. En celular, una sola barra superior de 56 px con logo, búsqueda, moneda y menú; el menú desliza desde la izquierda.
- El panel de inicio abre con "Requiere atención" y sigue con una cuadrícula de 12 columnas: en celular los indicadores van en dos columnas y los paneles ocupan todo el ancho.
- Listas largas (vías, nodos) se agrupan en secciones plegables con encabezado fijo y recuento; lo cerrado va primero y abierto.
- Objetivos táctiles de al menos 44 px en pantallas táctiles; sin desborde horizontal desde 360 px, y a zoom del 200 %.

## Elevation & Depth

El vidrio (`.glass`) es la superficie de contenido: fondo translúcido, borde de 1 px, desenfoque de 30 px con saturación de 150 % (20 px en celular por rendimiento). `.material` es la capa funcional flotante (barra lateral, paneles del mapa). Dos sombras interpolables: reposo y elevada (`--glass-shadow`, `--glass-shadow-lift`). Con "reducir transparencia" ambas se vuelven superficies opacas.

## Shapes

Radios de 16 px en tarjetas interiores y 24 px en paneles; 10 a 14 px en controles; botones y campos con 6 a 10 px. Las pastillas (chips de filtro, pestañas) son totalmente redondeadas.

## Components

- **Botón:** primario sólido azul, secundario en relleno gris translúcido, fantasma y destructivo. Hover sube a 1,02 solo con ratón (`(hover: hover) and (pointer: fine)`); `:active` baja a 0,96.
- **KPI y paneles (`BentoCell`, `KpiCard`):** se pueden pulsar y llevan a la vista filtrada o a una hoja con tabla y CSV.
- **Hoja (`Sheet`):** inspector a la derecha en escritorio; hoja inferior con agarradera que se cierra deslizando en celular.
- **Campo:** foco con anillo del color de acento de 3 px; error con borde rojo, mensaje en español bajo el campo, `aria-invalid` y foco al primer error.
- **Cadena de modos (`RouteChain`):** un tramo por barra del color de su modo, largo proporcional al tiempo, relleno de lo recorrido y marca de transbordo entre modos. Es el elemento propio del producto.
- **Atención (`Attention`):** filas con ícono y destino para sin ruta, vías y nodos cerrados, redirigidos y retrasados; si no hay nada, una línea de "todo en orden".
- **Atajos de teclado:** `Ctrl K` o `/` para buscar, `n` crea envío, `g` y una letra navegan, `?` abre la ayuda.

## Do's and Don'ts

- Sí: una sola curva de movimiento `cubic-bezier(0.16, 1, 0.3, 1)`, 0,3 s en interacciones y 0,5 s en entradas de vista; sin animar acciones de teclado.
- Sí: marcar lo aproximado como aproximado; no inventar vías ni municipios sin trazado real.
- Sí: respetar `prefers-reduced-motion` y `prefers-reduced-transparency`.
- No: color como único portador de significado, íconos Unicode en lugar de íconos dibujados, `transition: all`, ni nuevas curvas de movimiento.
- No: tarjetas idénticas como estructura de página; agrupar y dar jerarquía.
