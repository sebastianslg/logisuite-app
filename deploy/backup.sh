#!/usr/bin/env bash
# Copia consistente de la base SQLite (.backup es seguro con la app encendida).
set -euo pipefail
APP_DIR=/opt/logisuite
DB="${APP_DIR}/backend/data/logistics.db"
DEST="${APP_DIR}/backups"
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "${DEST}"
[ -f "${DB}" ] || { echo "No existe ${DB}"; exit 0; }
sqlite3 "${DB}" ".backup '${DEST}/logistics-${STAMP}.db'"
gzip -f "${DEST}/logistics-${STAMP}.db"
# Conserva solo los últimos 14 respaldos
ls -1t "${DEST}"/logistics-*.db.gz | tail -n +15 | xargs -r rm -f
echo "[$(date -Is)] respaldo ${STAMP} listo"
