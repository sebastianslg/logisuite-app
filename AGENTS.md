# Westvane TMS: guía para quien trabaje en este repositorio (persona o agente)

App de gestión de transporte multimodal en Colombia. **Frontend** `frontend/` (Next.js 16, React 19, Tailwind 4,
deck.gl + MapLibre), **API** `backend/` (FastAPI + SQLite), **servidor** `deploy/` (Docker, Caddy, scripts).
Interfaz en español. Producción: https://westvane.duckdns.org (Contabo; guía en `docs/DESPLIEGUE_CONTABO.md`).

## Léelo primero
`README.md`, `DESIGN.md` (sistema de diseño y reglas de movimiento) y `docs/BITACORA.md` (historia y decisiones;
las secciones 12 a 20 son lo más reciente). Next.js aquí es una versión nueva: lee `frontend/AGENTS.md` y
`node_modules/next/dist/docs/` antes de tocar rutas o caché.

## Reglas que no se rompen
- Animaciones solo con `transform` y `opacity`; todo componente nuevo respeta «reducir movimiento». Nada de animar
  `width`, `height`, `top` ni `box-shadow` en listas, tablas o mapa.
- El mapa está quieto en reposo: no agregar trabajo por cuadro.
- No agregar contraseña de la aplicación (aplazado por decisión del dueño).
- Solo Inter Variable; sin fuentes propietarias ni fotos de terceros. Paleta de modos validada (ver DESIGN.md).
- Nunca `docker compose down -v`; nunca claves, `.env` ni contraseñas en commits o chats; no `git reset --hard` en
  `/opt/logisuite` sin revisar `git status`.
- Datos personales: el nombre del operador es declarado, sin autenticación. Documentos legales en borrador hasta que
  los revise un abogado; los datos del responsable van en `.env` (`LEGAL_*`).

## Antes de cada commit
```bash
cd frontend && npx tsc --noEmit && npx eslint src e2e && npm run build   # usa npm run build, no next build
cd backend  && python -m pytest -q
cd frontend && TZ=America/Bogota npx playwright test                       # necesita el build hecho
```
Un commit por lote, mensaje en español, y actualizar `docs/BITACORA.md`. Los cambios de la base son aditivos
(`backend/app/database/schema_v*.py`, migraciones que solo agregan).

## Mapa rápido
- `backend/app/main.py` rutas; `app/engine/` lógica (rutas, operaciones, bitácora, legal, seguimiento, PDF);
  `app/api/guard.py` límites de abuso; `app/database/` esquemas.
- `frontend/src/app/` páginas; `components/` por área; `lib/` tipos, API, preferencias, consentimiento.
- `frontend/e2e/` pruebas de navegador (el fixture ya acepta los términos); `backend/tests/` pruebas de la API.

## Pendiente (ver también la sección final de la bitácora)
Mapa: un solo lienzo 3D y conservar el mapa de Red entre visitas (medir con `?diagnostico` en el PC real);
validar coordenadas contra INVÍAS, ANI, Aerocivil y Cormagdalena; usuarios y
empresas con roles (código por correo); PostgreSQL cuando haya varios usuarios; términos y privacidad pendientes de
datos del responsable y revisión legal; despliegue automático (faltan los secretos en GitHub); dominio propio y
Cloudflare.
