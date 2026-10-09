#!/usr/bin/env bash
# Arranque del contenedor de LogiSuite:
#   1. Ajusta permisos del volumen de datos (si corre como root).
#   2. Crea y siembra la base SQLite si aún no existe en data/.
#   3. Lanza Streamlit en 0.0.0.0:8501 como usuario sin privilegios.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${APP_DIR}/data"
DB_FILE="${DATA_DIR}/logistics.db"
PORT="${STREAMLIT_SERVER_PORT:-8501}"

cd "${APP_DIR}"
mkdir -p "${DATA_DIR}"

# Con un bind mount, la carpeta del host puede llegar con dueño root. Se
# corrige y luego todo se ejecuta como 'app' (uid 1000) mediante setpriv.
run_as_app=()
if [ "$(id -u)" = "0" ] && id app >/dev/null 2>&1; then
    chown -R app:app "${DATA_DIR}"
    # setpriv no cambia el entorno: sin HOME propio, Streamlit buscaría su
    # configuración en /root (sin permisos para 'app').
    run_as_app=(env HOME="${APP_DIR}" setpriv --reuid=app --regid=app --init-groups)
fi

if [ ! -f "${DB_FILE}" ]; then
    echo "[entrypoint] No existe ${DB_FILE}: inicializando base de datos..."
    "${run_as_app[@]}" python init_db.py
else
    echo "[entrypoint] Base de datos encontrada en ${DB_FILE}"
fi

echo "[entrypoint] Iniciando LogiSuite en el puerto ${PORT}"
exec "${run_as_app[@]}" streamlit run app.py \
    --server.port="${PORT}" \
    --server.address=0.0.0.0 \
    --server.headless=true \
    --browser.gatherUsageStats=false
