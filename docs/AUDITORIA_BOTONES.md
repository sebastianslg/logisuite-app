# Auditoría de controles de la interfaz

Revisión de todos los botones, enlaces y elementos con apariencia clicable
del frontend Next.js (`frontend/src`), hecha sobre el código y verificada
en el navegador con Playwright.

## Resultado

En el código Next.js no había botones con `onClick` vacío ni enlaces rotos:
todos los `<button>` y `<Link>` tenían una acción. Los "botones que no hacían
nada" eran elementos que **parecían** interactivos sin serlo (escala o cursor
de mano al pasar el ratón), y las funciones que la interfaz no ofrecía
(editar, borrar, exportar, cerrar vías). Si los botones vistos estaban en la
versión Streamlit (commit `73dc363`), esa versión ya no está en el árbol de
trabajo.

## Controles existentes (verificados)

| Lugar | Control | Acción |
|---|---|---|
| Barra lateral | Enlaces de navegación | Navegan |
| Barra lateral | Contraer / Expandir | Cambia el ancho |
| Dashboard | "Simulador de rutas" (mapa) | Va a `/red` |
| Envíos | Buscar, filtros de estado y modo, Limpiar | Filtran la tabla |
| Envíos | Encabezados ordenables, paginación, filas por página | Funcionan |
| Red | Origen, destino, invertir, prioridad, peso, Simular ruta | Simulan |
| Red | Alternativas, quitar ruta | Recalculan / limpian |
| Red | Capas por modo, Departamentos, Flota | Muestran / ocultan capas |

## Elementos que parecían interactivos y no lo eran (corregidos)

| Lugar | Antes | Ahora |
|---|---|---|
| Dashboard, tarjetas KPI | Escalaban al pasar el ratón, sin acción | Enlazan a Envíos con el filtro de estado correspondiente |
| Dashboard, Flota en vivo | Filas sin acción | Enlazan al detalle del envío |
| Envíos, código de envío | Texto | Enlace al detalle |
| Mapa, corredores | Cursor de mano, solo tooltip | Tooltip con estado de cierre y marca de dato aproximado; el cierre se gestiona en `/vias` |

## Controles nuevos

| Lugar | Control |
|---|---|
| Barra lateral | Selector USD / COP (deshabilitado sin TRM), nombre del operador |
| Envíos | Nuevo envío, selección múltiple, Ver PDF, Descargar, Compartir enlace, Borrar, Editar por fila |
| Detalle de envío | Editar, Borrar, Ver PDF, Descargar, Compartir enlace |
| Nuevo / editar envío | Forzar modos, forzar vías (máx. 3), Calcular ruta, Guardar, Cancelar |
| Red | Crear envío con la ruta simulada |
| Vías | Buscar, filtrar por estado y modo, Cerrar vía (con motivo), Reabrir |
| Configuración | Guardar TRM, reposición automática, abrir / copiar / revocar enlaces, filtrar historial, Actualizar |

## Verificación

Prueba de extremo a extremo con Chromium (Playwright) sobre el build de
producción: dashboard, enlace de KPI, TRM y moneda, crear, ver PDF,
compartir, editar, cerrar y reabrir vía, selección múltiple con PDF
consolidado, borrado e historial. Sin errores de consola (salvo el mapa base
de cartocdn, bloqueado por la red del entorno de pruebas).
