# Relevo entre herramientas (Claude en la nube, Claude en el PC, Antigravity)

Varias herramientas trabajan en este repositorio **de a una por vez**: cuando a una se le acaban los créditos, sigue
otra. Este archivo es el pase de la posta. **Quien termina lo actualiza; quien empieza lo lee.**

## Reglas del relevo
1. **Rama de trabajo común: `desarrollo`.** Todas las herramientas trabajan ahí. `main` es lo estable: de ahí sale
   lo que se instala en Contabo, así que solo se le suma `desarrollo` cuando todo pasa (ver «Subir a main»).
2. **Al empezar:** `git checkout desarrollo && git pull`, lee la sección «Estado actual» de abajo y `AGENTS.md`.
   Confirma con `git branch --show-current` que NO estás en `main`.
3. **Mientras trabajas:** commits pequeños y frecuentes con mensaje en español. Nada de trabajo sin commit al
   cerrar: si se acaban los créditos a medio camino, lo que no está subido se pierde.
4. **Al terminar (o antes de quedarte sin créditos):** commit, `git push`, y reescribe «Estado actual» (abajo).
5. **Nunca dos herramientas a la vez** sobre la misma rama. Si dudas, `git pull` y mira `git log -5`.
6. **No se sube:** `.env`, `backend/data/`, `.venv`, `node_modules`, `.next`, claves ni contraseñas.
7. **Nada de `git push --force`, `git reset --hard` ni borrar ramas** sin permiso del dueño.
8. **Servidor (Contabo):** solo lo toca el dueño, o una herramienta con su permiso explícito y solo lectura.

## Subir a main (lo hace quien tenga créditos y haya verificado)
Con `desarrollo` al día y todas las verificaciones de `AGENTS.md` pasando:
```
git checkout main && git pull
git merge --no-ff desarrollo -m "Integra desarrollo: <resumen>"
git push origin main
git checkout desarrollo
```
Si hay conflictos, resolverlos conservando ambos cambios y volver a correr las verificaciones antes de subir.

## Estado actual  (reescríbelo al terminar cada sesión)
- **Última herramienta:** Claude (PC) · **Fecha:** 2026-11-21
- **Hecho:** ver secciones 40 a 48 de `docs/BITACORA.md`. Resumen:
  - **Usuarios:** activar/desactivar con protecciones (no a uno mismo, no al último administrador). Pantalla `/administracion`
    con alta de usuarios y empresas.
  - **Accesibilidad:** `frontend/e2e/accesibilidad.spec.ts` corre `axe-core` en todas las páginas, claro y oscuro. Encontró tres
    colores del tema claro por debajo de 4,5:1 y se oscurecieron lo mínimo (acento `#0064c8`, rojo `#c20013`, naranja `#b52f00`).
  - **Correos:** enlace de seguimiento al cliente (con sesión y tope diario), resumen diario de vencimientos, aviso de entrega con
    novedad y reporte semanal opcional. Todo apagable en Configuración › Avisos por correo. Los avisos van a `NOTIFY_EMAIL`
    (buzón de Westvane); el ingreso sigue en `ADMIN_EMAIL` (correo personal del dueño).
  - **Respaldo fuera del servidor:** `deploy/descargar-respaldos.ps1` verifica cada archivo (gzip completo, SQLite, SHA-256) y
    `deploy/programar-respaldo-local.ps1` deja una tarea diaria en el PC del dueño (ya instalada y funcionando). `backup.sh`
    guarda también una copia del `.env`.
  - **Operación:** `deploy/verificar.sh` (30 comprobaciones, enganchado al despliegue automático) y
    `deploy/probar-restauracion.sh` (ensayo de restauración en un contenedor aparte, sin tocar producción).
  - **Historial** firmado con la cuenta de la sesión; **estado del servidor** en Configuración; **orden de trabajo en PDF** para
    mantenimientos; **avisos al celular (ntfy)** recuperados (el tema vive solo en el `.env` del servidor).
  - **Lavado de cara 2 (sección 57):** flota y dock móvil sin textos de 11 px (eran ~60 elementos en Flota), título de
    Red a peso 600, «Descargar CSV» a 44 px en celular. Mobile: cero textos <12 px y cero táctiles deficientes.
  - **Lavado de cara 1 (sección 56):** pie con objetivos táctiles de 44 px en celular, títulos de tarjeta unificados a
    14 px/600, nota del mapa a 12 px, enlace de regreso de la ficha a 44 px, y la prueba de «sin conexión» con localizador
    único (6/6). Pendiente de desplegar.
  - **Cierre del pulido (sección 55) — ya desplegado:** pase visual de Flota/Conductores/Bodegas/Configuración en claro y
    oscuro, escritorio y celular; fechas de `/auditoria` en español; `verificar.sh` con las rutas nuevas (34 comprobaciones);
    y la lista de envíos **20 % más liviana** (los vehículos de todos los tramos pasaron al detalle; 763 KB → 613 KB en
    producción). Prueba de carga: páginas mediana 650 ms, API 408 ms, 0 errores.
  - **Detalle del cierre:** aviso sin conexión endurecido (relee al volver a la pestaña), `verificar.sh` con las
    rutas nuevas y la marca del respaldo, y la lista de pendientes de `AGENTS.md` reescrita.
  - **Lote del 19 de noviembre (sección 54):** respaldo vigilado (marca `.ultimo-respaldo` + aviso a las 36 h), flota/conductores/
    inventario en Excel (exportar y cargar), reporte mensual opcional, protección contra fórmulas en Excel/CSV, Next 16.4.6,
    modo sin conexión prudente (solo estáticos).
  - **Lote del 21 de noviembre (sección 58):** presentación comercial pública en `/` y la app en `/panel`; logo W en todo (app,
    íconos y PDF); solicitudes de demostración (Administración); arreglo de la caché de lecturas que podía servir a cualquiera
    lo que leía un administrador; moneda y apariencia al menú «Más» del dock.
  - **Sección 59:** exportaciones con datos personales solo para administradores (`/api/consents/export`,
    `/api/audit/export.csv`, `/api/client-errors`), `pip-audit` limpio en producción, portada resistente a fallos de la API y
    los arreglos de la revisión final de diseño. `DESIGN.md` documenta la marca, la escala pública y las reglas nuevas.
  - **Sección 60:** pulido de la app (mapa sin la paleta vieja y sin nombres encimados, ficha del envío en celular, placas de
    terceros, letra mínima de 12 px, textos sobre la firma de los cambios).
  - **Secciones 61 a 65:** pulido de seguimiento, auditoría, cotización y calendario; movimiento en listas y en la red
    (solo transform/opacidad); imagen para compartir, robots y sitemap, 404 con la marca; Red con la leyenda como control
    abajo; y la API más rápida (departamentos recordados, tablas de la flota recordadas por `db.data_version()`, lecturas
    sin pandas con `db.fetch_all`).
- **En curso / a medias:** nada. Producción al día con `main` (sección 65, verificado con `deploy/verificar.sh`).
- **Pendiente de decisión del dueño:** exigir sesión para todo lo que escribe (roles reales; hoy `/api/audit` y las pantallas
  siguen abiertas como demostración); rotar la contraseña de aplicación de Gmail y el tema de ntfy tras el aviso de Contabo;
  dominio propio; una instalación por empresa o separar datos por empresa; revisión legal.
- **Importante para quien siga:**
  - **Nunca** devolver el código OTP en la respuesta fuera de pruebas (`WESTVANE_DEV_OTP=1`).
  - **No pegar sobre el contenido del `.env` en `nano`**: agregar líneas al final (o con `printf ... >> .env`). Ya pasó una vez y
    dejó el servidor sin `DOMAIN`. Hay copias en `backups/env-*.bak`.
  - El nombre del tema de ntfy **no va en el repositorio**; está en el `.env` del servidor.
  - Revisa `git log origin/main..desarrollo` antes de asumir qué está en producción.
  - Puertos de prueba propios si hay otra herramienta: `E2E_PORT`, `E2E_API_PORT`, `E2E_DB_PATH`.
- **Siguiente paso sugerido:**
  - Avisar al cliente: hecho (sección 51). Falta que el abogado incluya los correos de clientes en la política de privacidad.
  - Si las páginas se sienten lentas: guardar en columnas el modo y el vehículo actuales del envío para no parsear el
    recorrido en la lista, o paginar del lado del servidor (medido en la sección 53).
  - Peajes: faltan tarifas oficiales por tramo (no inventar cifras); coordenadas oficiales (hacen falta los PDF de Aerocivil) y las tres distancias con cifra de
    INVÍAS.
  - Roles que limiten acciones: espera decisión del dueño (obligaría a iniciar sesión a todos).
  - Política de privacidad con abogado; secretos de GitHub para el despliegue automático; dominio propio y Cloudflare;
    PostgreSQL cuando haya varios usuarios a la vez.
- **Verificaciones al cerrar:** `tsc`, `eslint` y `build` limpios; **315 pruebas de la API**; **37 de navegador** (incluye
  accesibilidad). En el servidor, `bash deploy/verificar.sh` (34 comprobaciones, en verde).
- **Producción:** `main` y Contabo en el mismo commit; `desarrollo` sin nada pendiente de desplegar.
