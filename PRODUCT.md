# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Despachadores y planificadores de carga en Colombia. Operan envíos multimodales durante toda la jornada: crean y editan envíos, comparan rutas por costo, tiempo y huella de carbono, cierran vías, aeropuertos y puertos, y revisan qué envíos quedaron sin ruta. Sesiones largas, en escritorio (Windows) y también en celular (Android). Español de Colombia.

## Product Purpose

Westvane TMS (antes LogiSuite) es un sistema de gestión de transporte multimodal para Colombia: carretera, río, mar, aire y ferrocarril. Calcula la ruta óptima entre ciudades, sigue la flota en un mapa, estima costo (USD, visible en COP con TRM editable) y huella de carbono, y redirige los envíos cuando se cierra una vía o un nodo. Éxito: el planificador decide más rápido y con menos errores, y ve de inmediato qué cambió y qué envíos se afectan.

## Positioning

Planificación multimodal real sobre la red colombiana (vías nacionales, ríos Magdalena, Meta y Orinoco, cabotaje, aviación de carga) con cierres que se propagan a los envíos en curso y huella de carbono por tramo, en una sola herramienta.

## Operating Context

Datos simulados: clientes, transportistas y telemetría son ficticios y la flota se mueve por una simulación determinista. La red mezcla datos verificados y aproximados, y la interfaz marca los aproximados. Despliegue en Render (frontend Next.js + API FastAPI/SQLite); la base se pierde en cada redeploy sin disco persistente.

## Capabilities and Constraints

- Frontend: Next.js 16 (App Router), Tailwind v4, Framer Motion, deck.gl/MapLibre, TanStack Table.
- Páginas: panel, envíos (lista, detalle, nuevo, editar), red y simulador, vías y nodos cerrados, configuración, combustible, huella de carbono.
- Debe funcionar bien en Windows y Android; PWA instalable; respeta "reducir movimiento" y "reducir transparencia".
- Costos calculados en USD; COP vía TRM editable.
- No inventar vías ni municipios sin trazado real. Los datos aproximados se marcan como tales.
- Huella de carbono: estimación por factores de modo, no inventario certificado.

## Brand Commitments

- Nombre: Westvane (elegido por el usuario; verificar registro de marca en la SIC).
- Estética obligatoria: calcada de Apple/macOS (HIG): vidrio con blur de 30 px, bisel, radios 16/24 px, una sola curva de movimiento `cubic-bezier(0.16, 1, 0.3, 1)`, hover `scale(1.02) translateY(-2px)`, `:active` `scale(0.96)`, colores del sistema (azul, verde, rojo) como acento, tipografía del sistema con Inter empaquetada.
- El texto sobre fondo claro usa variantes más oscuras para llegar a 4,5:1.

## Evidence on Hand

Todo el contenido es sintético. No hay testimonios, clientes reales ni métricas reales; no inventarlos.

## Product Principles

- Cada elemento lleva a algo: KPI, fila, estado y modo conducen a una vista filtrada o al detalle.
- Un cambio de red muestra su efecto: qué envíos se redirigieron, cuáles quedaron sin ruta.
- Lo aproximado se dice como aproximado.
- Costos y huella se leen en la moneda y unidad que el planificador necesita, sin cálculos mentales.
- Densidad útil para jornadas largas antes que decoración.

## Accessibility & Inclusion

Contraste mínimo 4,5:1, objetivos táctiles de 44 px, el modo nunca se comunica solo con color (ícono y texto), reducción de movimiento y de transparencia respetadas, paleta de modos validada para daltonismo en oscuro y pendiente en claro.
