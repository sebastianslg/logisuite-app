#!/usr/bin/env bash
# Arranque de la API:
#   1. Ajusta permisos del volumen de SQLite (un bind mount puede llegar con
#      dueño root) y cede los privilegios al usuario 'app' (uid 1000).
#   2. Crea y siembra la base si no existe (idempotente).
#   3. Lanza uvicorn. Un solo worker: SQLite y la sincronización de la
#      telemetría viven en el proceso.
set -euo pipefail

DB_PATH="${LOGISUITE_DB_PATH:-/data/logistics.db}"
DATA_DIR="$(dirname "${DB_PATH}")"
mkdir -p "${DATA_DIR}"

run_as_app=()
if [ "$(id -u)" = "0" ] && id app >/dev/null 2>&1; then
    chown -R app:app "${DATA_DIR}"
    # setpriv no cambia el entorno: HOME propio para el usuario 'app'
    run_as_app=(env HOME=/srv setpriv --reuid=app --regid=app --init-groups)
fi

if [ ! -f "${DB_PATH}" ]; then
    echo "[entrypoint] Inicializando base de datos en ${DB_PATH}"
fi
"${run_as_app[@]}" python -m app.init_db

echo "[entrypoint] API en 0.0.0.0:8000"
exec "${run_as_app[@]}" uvicorn app.main:app --host 0.0.0.0 --port 8000 \
    --proxy-headers --forwarded-allow-ips="*" --no-server-header
