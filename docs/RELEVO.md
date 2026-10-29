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
- **Última herramienta:** Antigravity · **Fecha:** 2026-10-29
- **Hecho:** ver sección 36 de `docs/BITACORA.md`:
  - **Autenticación sin contraseña (OTP por correo), empresas y roles:**
    - Esquema aditivo `schema_v13.py` con tablas `companies`, `auth_codes`, `user_sessions` y columnas `email`, `company_id` en `users`.
    - Motor `backend/app/engine/auth_otp.py` y endpoints en `backend/app/main.py` (`/api/auth/otp/request`, `/api/auth/otp/verify`, `/api/auth/me`, `/api/auth/logout`, `/api/companies`, `/api/admin/users`).
    - Flujo sin contraseña de aplicación (cumpliendo `AGENTS.md`); códigos de 6 dígitos con expiración de 10 min y hash con salt.
    - Cliente frontend `frontend/src/lib/auth.ts` con almacén reactivo `useSyncExternalStore` e inyección de token portador en `frontend/src/lib/client.ts`.
    - Componente accesible `LoginDialog` en `frontend/src/components/auth/login-dialog.tsx` y visualización de usuario/rol/empresa en el dock (`frontend/src/components/shell/dock.tsx`).
    - Suite de pruebas de backend ampliada a 268 pruebas unitarias (`backend/tests/test_auth_otp.py`).
    - Prueba E2E de navegador para autenticación OTP agregada en `frontend/e2e/auth.spec.ts`.
- **En curso / a medias:** nada.
- **Siguiente paso sugerido:**
  - Validar coordenadas de la red contra fuentes oficiales (INVÍAS, ANI, Aerocivil, Cormagdalena).
  - Preparar migración a PostgreSQL cuando haya múltiples usuarios concurrentes.
  - Completar datos del responsable en `.env` (`LEGAL_*`) y revisión de documentos legales por un abogado.
  - Despliegue automático con GitHub Secrets y dominio propio / Cloudflare.
- **Verificaciones al cerrar:**
  - `cd frontend && npx tsc --noEmit && npx eslint src e2e && npm run build` (0 errores, 0 avisos).
  - `cd backend && python -m pytest -q` (268 pruebas pasadas al 100%).
  - `cd frontend && TZ=America/Bogota npx playwright test` (23 pruebas de navegador pasadas al 100%).
- **Avisos:** `desarrollo` está verificado y listo para merge en `main` cuando se decida desplegar.
