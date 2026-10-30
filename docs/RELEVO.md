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
- **Última herramienta:** Claude (PC) · **Fecha:** 2026-10-29
- **Hecho:** ver secciones 36 y 37 de `docs/BITACORA.md`.
  - Claude **revisó la autenticación OTP de Antigravity y encontró fallos graves** (cualquiera podía crear un administrador
    y leer el código de acceso en la respuesta de la API). Quedaron **corregidos y con pruebas** en esta rama.
  - Iniciar sesión queda **deshabilitado en producción hasta configurar SMTP** (y `ADMIN_EMAIL` para el primer admin): es a
    propósito. El ingreso es opcional y no restringe nada; la app sigue abierta.
  - Arreglo de interfaz: el menú «Más» ya no tapa el diálogo de ingreso.
- **En curso / a medias:** nada.
- **Importante para quien siga:**
  - Antigravity: **no usar `WESTVANE_DEV_OTP` fuera de pruebas** y no volver a devolver el código en la respuesta.
  - Hay un commit sin subir a `main`/Contabo: todo `desarrollo` espera la aprobación del dueño para desplegar.
  - Los correos de la semilla son `@westvane.invalid` (dominio reservado); la empresa por defecto no tiene NIT.
- **Siguiente paso sugerido:**
  - El dueño decide si activa el ingreso: configurar SMTP, `ADMIN_EMAIL`, y actualizar la política de privacidad
    (revisión legal) porque guarda correos.
  - Después, si se quiere, exigir sesión y rol por endpoint (hoy ningún dato lo exige).
  - Validar coordenadas de la red contra fuentes oficiales; PostgreSQL cuando haya concurrencia; datos del
    responsable (`LEGAL_*`); despliegue automático y dominio propio.
  - Mapa de Red en celular (`claude-local/mapa-celular`, `098e6f0`): arreglo hecho, falta traerlo a `desarrollo`.
- **Verificaciones al cerrar:** `tsc`, `eslint` y `build` limpios; 274 pruebas de la API; 23 de navegador.
- **Avisos:** puertos de prueba propios si hay otra herramienta (`E2E_PORT`, `E2E_API_PORT`, `E2E_DB_PATH`).
