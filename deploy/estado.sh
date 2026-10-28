#!/usr/bin/env bash
# Estado del servidor de un vistazo: memoria, disco, carga, contenedores y respuesta del sitio.
#   bash /opt/logisuite/deploy/estado.sh
APP_DIR=${APP_DIR:-/opt/logisuite}
DOMAIN=$(grep -E '^DOMAIN=' "${APP_DIR}/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"')
URL="https://${DOMAIN:-westvane.duckdns.org}"
echo "== Memoria y swap";  free -h | sed -n '1,3p'
echo "== Disco";           df -h / "${APP_DIR}" 2>/dev/null | awk 'NR==1 || !seen[$1]++'
echo "== Carga (1, 5, 15 min) con $(nproc) núcleo(s)"; cut -d' ' -f1-3 /proc/loadavg
echo "== Contenedores";    docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' 2>/dev/null
echo "== Tamaño de datos"; du -sh "${APP_DIR}/backend/data" "${APP_DIR}/backups" 2>/dev/null
echo "== Respuesta de ${URL}"
for p in /api/health / /envios; do
  curl -s -o /dev/null -m 20 -w "  $p  %{http_code}  %{time_total}s\n" "${URL}${p}" || true
done
echo "== Últimas caídas"; tail -3 /var/log/westvane-health.log 2>/dev/null || echo "  (sin registro)"
echo "== Último respaldo"; ls -1t "${APP_DIR}"/backups/logistics-*.db.gz 2>/dev/null | head -1
