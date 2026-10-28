#!/usr/bin/env bash
# Instala (o actualiza) las tareas programadas de Westvane en el VPS. Se puede correr varias veces.
#   sudo bash /opt/logisuite/deploy/install-cron.sh
#
#   03:17 todos los días   respaldo de la base y de los adjuntos (deploy/backup.sh)
#   cada 5 minutos          revisión del sitio y reinicio si cae (deploy/healthcheck.sh)
set -euo pipefail
APP_DIR=${APP_DIR:-/opt/logisuite}
chmod +x "${APP_DIR}/deploy/backup.sh" "${APP_DIR}/deploy/healthcheck.sh"

# El respaldo que dejó setup-server.sh queda reemplazado por este (evita dos respaldos al día)
rm -f /etc/cron.d/logisuite-backup

cat > /etc/cron.d/westvane <<EOF
# Tareas de Westvane (instaladas por deploy/install-cron.sh; no editar a mano)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 3 * * * root ${APP_DIR}/deploy/backup.sh >> /var/log/westvane-backup.log 2>&1
*/5 * * * * root ${APP_DIR}/deploy/healthcheck.sh
EOF
chmod 644 /etc/cron.d/westvane

# Rotación de los registros para que no crezcan sin límite
cat > /etc/logrotate.d/westvane <<'EOF'
/var/log/westvane-backup.log /var/log/westvane-health.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
}
EOF

command -v sqlite3 >/dev/null 2>&1 || echo "Aviso: sqlite3 no está instalado en el host; el respaldo usará el contenedor de la API (apt install sqlite3 para revisar la integridad)."
echo "Listo. Tareas en /etc/cron.d/westvane:"
grep -v '^#' /etc/cron.d/westvane
