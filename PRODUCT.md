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

Datos simulados: clientes, transportistas y telemetría son ficticios y la flota se mueve por una simulación determinista. La red mezcla datos verificados y aproximados, y la interfaz marca los aproximados. Desplegado en un VPS de Contabo con Docker Compose (Caddy + Next.js + API FastAPI/SQLite en un volumen persistente, con respaldo antes de cada actualización). GitHub Actions corre las pruebas en cada push a main y, si pasan, despliega solo. Hoy la usan el autor y, de vez en cuando, su profesor: no hay cuentas ni contraseña, a propósito.

## Capabilities and Constraints

- Frontend: Next.js 16 (App Router), Tailwind v4, Framer Motion, deck.gl/MapLibre, TanStack Table.
- Páginas: resumen, envíos (lista, detalle, nuevo, editar; exportación a CSV y Excel), red y simulador, flota, bodegas, vías y nodos cerrados, historial de trayectos (por ciudad, departamento y corredor), configuración, combustible, huella de carbono.
- Debe funcionar bien en Windows y Android; PWA instalable; respeta "reducir movimiento" y "reducir transparencia".
- Costos calculados en USD; COP vía TRM editable.
- No inventar vías ni municipios sin trazado real. Los datos aproximados se marcan como tales.
- Huella de carbono: estimación por factores de modo, no inventario certificado.

## Brand Commitments

- Nombre: Westvane (elegido por el usuario; verificar registro de marca en la SIC).
- Debe parecer software profesional, no un tablero genérico hecho con IA: superficies opacas con líneas finas, cifras grandes donde importan, filas antes que tarjetas, sin íconos en círculos ni vidrio decorativo. Detalle en `DESIGN.md`.
- Navegación con un dock flotante (arriba en escritorio, abajo en celular), tema claro por defecto y oscuro con acento `#5266eb`.
- Solo Inter Variable; sin fuentes propietarias ni fotos de terceros.
- El mapa está quieto en reposo y solo anima al arrastrar, hacer zoom o en pantalla completa.
- Animaciones solo con `transform` y `opacity`, y siempre respetando "reducir movimiento".

## Evidence on Hand

Todo el contenido es sintético. No hay testimonios, clientes reales ni métricas reales; no inventarlos.

## Product Principles

- Cada elemento lleva a algo: KPI, fila, estado y modo conducen a una vista filtrada o al detalle.
- Un cambio de red muestra su efecto: qué envíos se redirigieron, cuáles quedaron sin ruta.
- Lo aproximado se dice como aproximado.
- Costos y huella se leen en la moneda y unidad que el planificador necesita, sin cálculos mentales.
- Densidad útil para jornadas largas antes que decoración.

## Accessibility & Inclusion

Contraste mínimo 4,5:1, objetivos táctiles de 44 px, el modo nunca se comunica solo con color (ícono y texto), reducción de movimiento y de transparencia respetadas, paleta de modos validada para daltonismo en claro y en oscuro (ver `DESIGN.md`).
