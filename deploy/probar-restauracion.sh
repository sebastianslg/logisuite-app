#!/usr/bin/env bash
# probar-restauracion.sh — ensayo de restauración: toma el último respaldo, lo restaura en una carpeta temporal, levanta
# una API APARTE con esa base y comprueba que responde y que tiene datos. No toca producción: otro contenedor, otro puerto
# (solo en 127.0.0.1) y todo se borra al terminar, salga bien o mal.
#
#   bash /opt/logisuite/deploy/probar-restauracion.sh
#   bash /opt/logisuite/deploy/probar-restauracion.sh backups/logistics-20261107-031704.db.gz   # un respaldo concreto
#
# Sale con 0 si la restauración sirve y 1 si no. Un respaldo que nunca se prueba restaurar no es un respaldo.
set -uo pipefail

APP_DIR=${APP_DIR:-/opt/logisuite}
PUERTO=${PUERTO:-8099}
IMG=${IMG:-westvane-api:latest}
RESPALDO=${1:-}

FALLOS=0
ok()  { printf '  \033[32mok\033[0m   %s\n' "$*"; }
mal() { printf '  \033[31mFALLA\033[0m %s\n' "$*"; FALLOS=$((FALLOS + 1)); }

if [ -z "${RESPALDO}" ]; then
  RESPALDO=$(ls -1t "${APP_DIR}"/backups/logistics-*.db.gz 2>/dev/null | head -1)
fi
if [ -z "${RESPALDO}" ] || [ ! -f "${RESPALDO}" ]; then
  echo "No encuentro el respaldo (${RESPALDO:-ninguno}). Mira en ${APP_DIR}/backups."
  exit 1
fi

TMP=$(mktemp -d /tmp/restauracion.XXXXXX) || { echo "No pude crear la carpeta temporal"; exit 1; }
CONTENEDOR="westvane-prueba-restauracion-$$"

limpiar() {
  docker rm -f "${CONTENEDOR}" >/dev/null 2>&1 || true
  rm -rf "${TMP}"
}
trap limpiar EXIT

echo "== Ensayo con $(basename "${RESPALDO}")"
echo "   carpeta temporal: ${TMP} · contenedor: ${CONTENEDOR} · puerto: 127.0.0.1:${PUERTO}"

# 1) Descomprimir y comprobar que es una base SQLite sana
gunzip -c "${RESPALDO}" > "${TMP}/logistics.db" 2>/dev/null
if [ -s "${TMP}/logistics.db" ]; then
  ok "El respaldo se descomprimió ($(du -h "${TMP}/logistics.db" | cut -f1))"
else
  mal "El respaldo no se pudo descomprimir"
  exit 1
fi

integridad=$(docker run --rm -v "${TMP}:/data" --entrypoint python "${IMG}" -c \
  "import sqlite3; print(sqlite3.connect('/data/logistics.db').execute('PRAGMA integrity_check').fetchone()[0])" 2>/dev/null)
if [ "${integridad}" = "ok" ]; then ok "Integridad de la base: ok"; else mal "Integridad de la base: ${integridad:-sin respuesta}"; fi

# 2) Levantar una API aparte con esa base (las migraciones corren sobre la copia, no sobre producción)
docker run -d --name "${CONTENEDOR}" -p "127.0.0.1:${PUERTO}:8000" \
  -v "${TMP}:/data" -e WESTVANE_DB_PATH=/data/logistics.db -e TZ=America/Bogota "${IMG}" >/dev/null 2>&1
if [ $? -ne 0 ]; then
  mal "No se pudo levantar el contenedor de prueba"
  exit 1
fi

salud=""
for _ in $(seq 1 30); do
  salud=$(curl -s -m 3 "http://127.0.0.1:${PUERTO}/api/health" 2>/dev/null || true)
  [ -n "${salud}" ] && break
  sleep 2
done
if printf '%s' "${salud}" | grep -q '"status"'; then
  ok "La API arrancó con la base restaurada"
else
  mal "La API no respondió con la base restaurada: ${salud:0:100}"
  docker logs "${CONTENEDOR}" --tail 30 2>&1 | sed 's/^/       /'
  exit 1
fi

# 3) ¿Tiene los datos? Se cuenta en la base restaurada y se compara con lo que hay en producción ahora mismo
contar() { # contar <tabla>
  docker run --rm -v "${TMP}:/data" --entrypoint python "${IMG}" -c \
    "import sqlite3; print(sqlite3.connect('/data/logistics.db').execute('SELECT COUNT(*) FROM $1').fetchone()[0])" 2>/dev/null
}
DOMINIO=$(grep -E '^DOMAIN=' "${APP_DIR}/.env" | tail -1 | cut -d= -f2- | tr -d '"')
envios=$(contar mm_shipments)
vivos=$(curl -s -m 10 "https://${DOMINIO}/api/shipments?limit=1000" 2>/dev/null | grep -o '"count":[0-9]*' | cut -d: -f2)
if [ -n "${envios:-}" ] && [ "${envios}" -gt 0 ] 2>/dev/null; then
  ok "El respaldo tiene ${envios} envíos (producción tiene ahora ${vivos:-?})"
else
  mal "El respaldo no tiene envíos"
fi

tablero=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "http://127.0.0.1:${PUERTO}/api/today" 2>/dev/null)
if [ "${tablero}" = "200" ]; then ok "El tablero «Hoy» responde con la base restaurada"; else mal "El tablero «Hoy» respondió ${tablero}"; fi

flota=$(contar fl_vehicles)
if [ -n "${flota:-}" ] && [ "${flota}" -gt 0 ] 2>/dev/null; then ok "La flota está: ${flota} vehículos"; else mal "El respaldo no tiene vehículos"; fi

usuarios=$(contar "users WHERE active = 1")
if [ -n "${usuarios:-}" ] && [ "${usuarios}" -gt 0 ] 2>/dev/null; then ok "Usuarios activos en el respaldo: ${usuarios}"; else mal "El respaldo no tiene usuarios activos"; fi

printf '\n'
if [ "${FALLOS}" -eq 0 ]; then
  printf '\033[32mLa restauración funciona: el respaldo sirve.\033[0m\n'
else
  printf '\033[31m%d fallo(s) en el ensayo de restauración.\033[0m\n' "${FALLOS}"
fi
[ "${FALLOS}" -eq 0 ] || exit 1
exit 0
