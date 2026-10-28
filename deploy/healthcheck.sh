#!/usr/bin/env bash
# Vigilancia de Westvane en el propio servidor (cada 5 minutos con el cron de deploy/install-cron.sh).
#
#  - Pide /api/health y la portada por HTTPS, como un visitante.
#  - Si fallan dos revisiones seguidas, reinicia los contenedores (una vez por caída) y lo registra.
#  - Si en .env hay NTFY_TOPIC, avisa al celular con ntfy (app gratuita, sin cuenta): al caer y al volver.
#
# Registro: /var/log/westvane-health.log. Estado entre corridas: /var/lib/westvane-health.
set -uo pipefail
APP_DIR=${APP_DIR:-/opt/logisuite}
STATE_DIR=/var/lib/westvane-health
LOG=/var/log/westvane-health.log
mkdir -p "${STATE_DIR}"

# DOMAIN y NTFY_TOPIC salen del .env de la app (el mismo que usa Caddy)
if [ -f "${APP_DIR}/.env" ]; then
  DOMAIN=$(grep -E '^DOMAIN=' "${APP_DIR}/.env" | tail -1 | cut -d= -f2- | tr -d '"' || true)
  NTFY_TOPIC=$(grep -E '^NTFY_TOPIC=' "${APP_DIR}/.env" | tail -1 | cut -d= -f2- | tr -d '"' || true)
fi
URL="https://${DOMAIN:-westvane.duckdns.org}"

log() { echo "[$(date -Is)] $*" >> "${LOG}"; }
notify() {
  [ -n "${NTFY_TOPIC:-}" ] || return 0
  curl -fsS -m 10 -H "Title: $1" -H "Tags: $2" -d "$3" "https://ntfy.sh/${NTFY_TOPIC}" >/dev/null 2>&1 || true
}

api=$(curl -s -o /dev/null -m 15 -w "%{http_code}" "${URL}/api/health" || true)
web=$(curl -s -o /dev/null -m 20 -w "%{http_code}" "${URL}/" || true)

if [ "${api}" = "200" ] && [ "${web}" = "200" ]; then
  if [ -f "${STATE_DIR}/down" ]; then
    since=$(cat "${STATE_DIR}/down")
    rm -f "${STATE_DIR}/down" "${STATE_DIR}/fails" "${STATE_DIR}/restarted"
    log "OK de nuevo (caída desde ${since})"
    notify "Westvane volvió" "white_check_mark" "El sitio responde otra vez. Estaba caído desde ${since}."
  else
    rm -f "${STATE_DIR}/fails"
  fi
  exit 0
fi

fails=$(( $(cat "${STATE_DIR}/fails" 2>/dev/null || echo 0) + 1 ))
echo "${fails}" > "${STATE_DIR}/fails"
log "FALLA ${fails}: api=${api} web=${web}"

# Una falla suelta (un reinicio, un despliegue) no es una caída: se actúa a partir de la segunda seguida
[ "${fails}" -ge 2 ] || exit 0
[ -f "${STATE_DIR}/down" ] || { date -Is > "${STATE_DIR}/down"; notify "Westvane no responde" "warning" "api=${api} web=${web} en ${URL}. Se intentará reiniciar."; }

if [ ! -f "${STATE_DIR}/restarted" ]; then
  touch "${STATE_DIR}/restarted"
  log "Reiniciando contenedores"
  (cd "${APP_DIR}" && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d >> "${LOG}" 2>&1 \
     && docker compose -f docker-compose.yml -f docker-compose.prod.yml restart >> "${LOG}" 2>&1) \
    || log "No se pudo reiniciar (revisar docker)"
fi
exit 0
