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
- **Última herramienta:** Claude (PC) · **Fecha:** 2026-11-07
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
- **En curso / a medias:** nada.
- **Importante para quien siga:**
  - **Nunca** devolver el código OTP en la respuesta fuera de pruebas (`WESTVANE_DEV_OTP=1`).
  - **No pegar sobre el contenido del `.env` en `nano`**: agregar líneas al final (o con `printf ... >> .env`). Ya pasó una vez y
    dejó el servidor sin `DOMAIN`. Hay copias en `backups/env-*.bak`.
  - El nombre del tema de ntfy **no va en el repositorio**; está en el `.env` del servidor.
  - `main` y Contabo están en `e1835c4`. `desarrollo` tiene **3 commits más** (verificación, documentación de ntfy y ensayo de
    restauración) que esperan la orden del dueño para desplegar.
  - Puertos de prueba propios si hay otra herramienta: `E2E_PORT`, `E2E_API_PORT`, `E2E_DB_PATH`.
- **Siguiente paso sugerido:**
  - Avisar al cliente por correo cuando su envío cambia de estado (sale, llega, se retrasa). Hace falta decidir de dónde
    sale el correo del cliente: hoy el envío guarda su nombre, no su dirección.
  - Decidir el plazo del historial (`AUDIT_RETENTION_DAYS`, p. ej. 730) y, si algún día hay miles de envíos, paginación
    del lado del servidor en la lista (hoy pide hasta 1000 y lo dice).
  - Tarifas de peajes iniciales; coordenadas oficiales (hacen falta los PDF de Aerocivil) y las tres distancias con cifra de
    INVÍAS.
  - Roles que limiten acciones: espera decisión del dueño (obligaría a iniciar sesión a todos).
  - Política de privacidad con abogado; secretos de GitHub para el despliegue automático; dominio propio y Cloudflare;
    PostgreSQL cuando haya varios usuarios a la vez.
- **Verificaciones al cerrar:** `tsc`, `eslint` y `build` limpios; **297 pruebas de la API**; **33 de navegador** (incluye
  accesibilidad). En el servidor, `bash deploy/verificar.sh`.
