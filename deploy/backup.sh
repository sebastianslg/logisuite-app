#!/usr/bin/env bash
# Respaldo de Westvane: base SQLite (copia consistente con la app encendida) y documentos adjuntos.
#   sudo /opt/logisuite/deploy/backup.sh
# Lo corre a diario el cron que instala deploy/install-cron.sh (03:17). Conserva los últimos 14 de cada tipo.
set -euo pipefail
APP_DIR=${APP_DIR:-/opt/logisuite}
DATA="${APP_DIR}/backend/data"
DB="${DATA}/logistics.db"
DEST="${APP_DIR}/backups"
STAMP=$(date +%Y%m%d-%H%M%S)
KEEP=14

mkdir -p "${DEST}"
[ -f "${DB}" ] || { echo "No existe ${DB}"; exit 0; }

# 1) Base: copia en caliente con la API de respaldo de SQLite (segura con la app escribiendo).
#    Orden: sqlite3 del host, python3 del host (viene con Ubuntu) y, si no hay ninguno, el contenedor de la API.
OUT="${DEST}/logistics-${STAMP}.db"
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "${DB}" ".backup '${OUT}'"
elif command -v python3 >/dev/null 2>&1; then
  python3 - "${DB}" "${OUT}" <<'PY'
import sqlite3, sys
src, dst = sqlite3.connect(sys.argv[1]), sqlite3.connect(sys.argv[2])
src.backup(dst)
dst.close(); src.close()
PY
else
  docker exec westvane-api python -c "import sqlite3; s=sqlite3.connect('/data/logistics.db'); d=sqlite3.connect('/data/.respaldo.db'); s.backup(d); d.close(); s.close()"
  mv "${DATA}/.respaldo.db" "${OUT}"
fi

# La copia debe abrirse y pasar la revisión de integridad; si no, se descarta y el script falla (queda en el registro)
if command -v sqlite3 >/dev/null 2>&1; then
  ok=$(sqlite3 "${OUT}" "PRAGMA integrity_check;" 2>/dev/null || true)
elif command -v python3 >/dev/null 2>&1; then
  ok=$(python3 -c "import sqlite3,sys; print(sqlite3.connect(sys.argv[1]).execute('PRAGMA integrity_check').fetchone()[0])" "${OUT}" 2>/dev/null || true)
else
  ok=ok
fi
if [ "${ok}" != "ok" ]; then
  rm -f "${OUT}"
  echo "[$(date -Is)] ERROR: el respaldo ${STAMP} no pasó la revisión de integridad (${ok:-sin respuesta})" >&2
  exit 1
fi
gzip -f "${OUT}"

# 2) Adjuntos (remesas, manifiestos, fotos): viven junto a la base
if [ -d "${DATA}/adjuntos" ]; then
  tar -czf "${DEST}/adjuntos-${STAMP}.tar.gz" -C "${DATA}" adjuntos
fi

# 3) Se conservan los últimos ${KEEP} de cada tipo
ls -1t "${DEST}"/logistics-*.db.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "${DEST}"/adjuntos-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "[$(date -Is)] respaldo ${STAMP} listo ($(du -sh "${DEST}" | cut -f1) en ${DEST})"
