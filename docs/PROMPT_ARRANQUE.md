# Prompt de arranque — nueva sesión

Copia todo lo que está debajo de la línea y pégalo como primer mensaje en el chat nuevo.

---

Continúa el trabajo de Westvane TMS (repositorio `sebastianslg/logisuite-app`, rama `main`). No me preguntes nada: las decisiones pendientes ya están tomadas abajo. Arranca directamente.

**Lee primero, en este orden:**
1. `docs/PLAN_COMPLETO_TRASPASO.md` (plan de diseño, plan de movimiento y referencias de estilo completas).
2. `docs/BITACORA.md` (estado general, reglas del mapa).
3. `docs/PLAN_MOVIMIENTO.md` (detalle de los lotes; es la fuente para implementar).

**Decisiones ya tomadas (no preguntar):**
- Navegación: dock flotante superior en escritorio (vidrio, radio 999 px, cinco destinos más "Más") y dock inferior en celular con hoja desde abajo. Sustituye a la barra lateral en `components/shell/sidebar.tsx`, conservando búsqueda Ctrl K, moneda, tema, estado del sistema y operador.
- Tema por defecto: claro (`#f5f5f7` / tarjetas `#ffffff`). Oscuro como alternativa, con acento `#5266eb`.
- Mapa: en reposo queda quieto. Solo se anima al arrastrarlo, con la rueda o en pantalla completa. Nunca añadir trabajo por cuadro al mapa.
- Paleta de modos: terrestre `#0f9d7a`, fluvial `#0a84ff`, marítimo `#5e5ce6`, aéreo `#d6399b`, férreo `#c98a00`. Solo para indicar el modo.
- Cifras hero del resumen: envíos en ruta, retrasos y costo acumulado.
- Fuentes: solo Inter Variable (ya instalada). No añadir fuentes propietarias ni fotografías de terceros.

**Reglas que no se rompen:**
- No cambiar lógica de negocio, API ni esquema de base de datos.
- Solo `transform` y `opacity` en animaciones. Nada de animar `width`, `height`, `top`, `box-shadow` en listas, tablas ni mapa.
- Todo componente nuevo respeta "reducir movimiento" (`useReducedMotion` o `MotionConfig`).
- No añadir contraseña de la aplicación.

**Orden de trabajo:**
1. Lote 1 completo (respuesta al toque: presión de botones, onda de luz, chispas en Guardar, Exportar, Compartir y Crear). La ráfaga de "Nuevo envío" ya existe: úsala como base y verifica su captura visual en un botón que no navegue.
2. Lote 2 (despliegues y paneles).
3. Lote 3 (objetos que se mueven, morph del mapa, transición compartida fila → detalle).
4. Lote 4 (íconos, cifras que cuentan al cambiar, toasts, Guardar → Check).
5. Lote 5 (recorrido escritorio y celular en ambos temas, medición de cuadros en `/red` y detalle, reducir movimiento, accesibilidad).
6. Dock de navegación: hacerlo después del lote 1 o en paralelo, según convenga, pero antes del lote 5.

**Verificación en cada lote (obligatoria):**
- `cd frontend && npx tsc --noEmit && npx eslint src && npx next build` sin errores.
- Servidores locales y capturas con Playwright (ver §7 de `docs/PLAN_MOVIMIENTO.md`).
- Medir fotogramas en `/red` antes y después. Si empeora, reducir el efecto antes que quitar la regla del mapa.

**Entrega:**
- Un commit por lote con mensaje claro, subido a `main` solo tras verificar en navegador.
- Al final de cada lote, resumen corto: qué cambió, qué verificaste, qué queda.
- Actualiza `docs/BITACORA.md` al cerrar el lote 5.
