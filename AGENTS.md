# Westvane TMS: guía para quien trabaje en este repositorio (persona o agente)

App de gestión de transporte multimodal en Colombia. **Frontend** `frontend/` (Next.js 16, React 19, Tailwind 4,
deck.gl + MapLibre), **API** `backend/` (FastAPI + SQLite), **servidor** `deploy/` (Docker, Caddy, scripts).
Interfaz en español. Producción: https://westvane.duckdns.org (Contabo; guía en `docs/DESPLIEGUE_CONTABO.md`).

## Léelo primero
`README.md`, `DESIGN.md` (sistema de diseño y reglas de movimiento) y `docs/BITACORA.md` (historia y decisiones;
las secciones 12 a 20 son lo más reciente). Next.js aquí es una versión nueva: lee `frontend/AGENTS.md` y
`node_modules/next/dist/docs/` antes de tocar rutas o caché.

## Relevo entre herramientas
Aquí trabajan por turnos Claude (nube y PC) y Antigravity. **Lee `docs/RELEVO.md` antes de empezar y actualízalo al
terminar.** Se trabaja en la rama `desarrollo` (nunca directo en `main`), con commits pequeños y push al cerrar.
`main` es lo estable que va a producción y solo recibe `desarrollo` cuando todas las verificaciones pasan.

## Reglas que no se rompen
- Animaciones solo con `transform` y `opacity`; todo componente nuevo respeta «reducir movimiento». Nada de animar
  `width`, `height`, `top` ni `box-shadow` en listas, tablas o mapa.
- El mapa está quieto en reposo: no agregar trabajo por cuadro.
- La app pide sesión (decisión del dueño, 21/11/2026): `/ingresar` con usuario o correo y contraseña, o código al correo.
  Las contraseñas solo se ponen desde la consola del servidor (`python -m app.crear_acceso`, la clave por la entrada
  estándar); la web no tiene ruta para crearlas. Lo público (/, /seguimiento, lo legal) sigue abierto.
- Solo Inter Variable; sin fuentes propietarias ni fotos de terceros. Paleta vigente del dueño (22/11/2026): fondo
  `#F2F2F7`, texto `#1D1D1F`, énfasis `#007AFF` (texto `#0062CC`), verde `#34C759`; modos marítimo `#0040DD`, terrestre
  `#34C759`, aéreo `#AF52DE`, férreo `#636366`, fluvial `#5AC8FA` (oscuro `#409CFF`, `#30D158`, `#BF5AF2`, `#AEAEB2`,
  `#64D2FF`). El detalle y el contraste están en DESIGN.md, Colors; **no se cambia**.
- No subir `.env`, `backend/data/`, `.venv`, `node_modules` ni claves; sin `git push --force` ni `git reset --hard`.
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
Un commit por lote, mensaje en español, y actualizar `docs/BITACORA.md`. **Después de desplegar en Contabo, `bash deploy/verificar.sh`** (configuración, contenedores, rutas, seguridad y
respaldos; sale con 1 si algo falla). El despliegue automático ya lo corre. Los cambios de la base son aditivos
(`backend/app/database/schema_v*.py`, migraciones que solo agregan).

## Mapa rápido
- `backend/app/main.py` rutas; `app/engine/` lógica (rutas, operaciones, bitácora, legal, seguimiento, PDF);
  `app/api/guard.py` límites de abuso; `app/database/` esquemas.
- `frontend/src/app/` páginas; `components/` por área; `lib/` tipos, API, preferencias, consentimiento.
- `frontend/e2e/` pruebas de navegador (el fixture ya acepta los términos); `backend/tests/` pruebas de la API.

## Pendiente (ver también la sección final de la bitácora)
- **Hecho y en producción:** cuenta por código al correo con empresas y roles, mapa de Red en celular, avisos al cliente por
  cambio de estado, auditoría con filtros y CSV, respaldo fuera del servidor (verificado y programado), verificación del
  despliegue, ensayo de restauración, tablas de flota/conductores/inventario en Excel, reporte mensual y modo sin conexión.
  El mapa está medido (60 cuadros/s, sin bloqueos de 250 ms; sección 23): no hace falta un lienzo único.
- **Espera datos o decisiones del dueño:**
  - **Peajes:** faltan las tarifas oficiales por tramo. Sin ellas quedan en 0 (solo la estimación rotulada de la Vía al Llano);
    no se inventan porque entran en las cotizaciones.
  - **Coordenadas:** validar contra INVÍAS, ANI, Aerocivil y Cormagdalena (hacen falta los PDF de Aerocivil). Tres distancias
    siguen con cifra no oficial (sección 22).
  - **Roles que limiten acciones:** las páginas ya piden sesión, pero el rol todavía no restringe nada y la API sigue
    respondiendo sin sesión (solo administración y exportaciones con datos personales la exigen).
  - **Términos y privacidad:** esperan los datos del responsable (`LEGAL_*`) y la revisión de un abogado; ahora se guardan
    correos de usuarios y de clientes.
  - **Despliegue automático** (faltan los secretos en GitHub), **dominio propio y Cloudflare**, **PostgreSQL** con varios usuarios.
- **Vigilar:** el historial ya tiene plazo (`AUDIT_RETENTION_DAYS=730`); la lista de envíos pide hasta 1000 y avisa si hay más
  (reabrir la paginación del servidor al pasar de ~500); las páginas tardan 1,2–1,7 s con 8 personas (sección 53).
