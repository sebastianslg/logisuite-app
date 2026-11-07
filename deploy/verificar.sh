#!/usr/bin/env bash
# verificar.sh — comprobación del despliegue, siempre la misma, para no depender de acordarse.
#
#   bash /opt/logisuite/deploy/verificar.sh                 # en el servidor, contra su propio dominio
#   bash deploy/verificar.sh --url https://otro.sitio       # desde cualquier sitio, solo las pruebas de red
#
# No cambia nada: lee el .env (solo los nombres de las variables), consulta los contenedores y hace peticiones GET. La única
# escritura es pedir un código para un correo que no existe, que no envía correo ni crea nada, y sirve para comprobar que el
# código no viaja en la respuesta.
#
# Sale con 0 si todo está bien, 1 si algo falla y 2 si la invocación es incorrecta.
set -uo pipefail

APP_DIR=${APP_DIR:-/opt/logisuite}
URL=${URL:-}
SOLO_RED=0
while [ $# -gt 0 ]; do
  case "$1" in
    --url) URL=${2:-}; SOLO_RED=1; shift 2 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Opción desconocida: $1 (usa --help)"; exit 2 ;;
  esac
done

if [ -z "${URL}" ]; then
  DOMAIN=$(grep -E '^DOMAIN=' "${APP_DIR}/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"')
  URL="https://${DOMAIN:-westvane.duckdns.org}"
fi
URL=${URL%/}

FALLOS=0
AVISOS=0
ok()  { printf '  \033[32mok\033[0m   %s\n' "$*"; }
mal() { printf '  \033[31mFALLA\033[0m %s\n' "$*"; FALLOS=$((FALLOS + 1)); }
ojo() { printf '  \033[33maviso\033[0m %s\n' "$*"; AVISOS=$((AVISOS + 1)); }
titulo() { printf '\n== %s\n' "$*"; }

http() { curl -s -o /dev/null -m 20 -w '%{http_code}' "$1" 2>/dev/null || echo 000; }
cuerpo() { curl -s -m 20 "$@" 2>/dev/null || true; }

# espera <ruta> <código> <descripción>
espera() {
  local got
  got=$(http "${URL}$1")
  if [ "${got}" = "$2" ]; then ok "$3 (${got})"; else mal "$3: se esperaba $2 y llegó ${got} — ${URL}$1"; fi
}

# espera_sin_sesion <método> <ruta> <cuerpo> <código> <descripción>: la API no debe dejar hacerlo sin sesión.
# El cuerpo va completo a propósito: si faltara un campo, la API respondería 422 por validación antes de mirar la sesión, y
# la prueba no estaría comprobando lo que dice comprobar.
espera_sin_sesion() {
  local got
  if [ -n "$3" ]; then
    got=$(curl -s -o /dev/null -m 20 -w '%{http_code}' -X "$1" -H 'content-type: application/json' -d "$3" "${URL}$2" 2>/dev/null || echo 000)
  else
    got=$(curl -s -o /dev/null -m 20 -w '%{http_code}' -X "$1" "${URL}$2" 2>/dev/null || echo 000)
  fi
  if [ "${got}" = "$4" ]; then ok "$5 (${got})"; else mal "$5: se esperaba $4 y llegó ${got} — ${URL}$2"; fi
}

if [ "${SOLO_RED}" = "0" ]; then
  titulo "Configuración (.env: solo se miran los nombres, nunca los valores)"
  if [ ! -f "${APP_DIR}/.env" ]; then
    mal "No existe ${APP_DIR}/.env"
  else
    for clave in DOMAIN SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM ADMIN_EMAIL; do
      if grep -qE "^${clave}=." "${APP_DIR}/.env"; then ok "${clave} definida"; else mal "${clave} falta o está vacía"; fi
    done
    if grep -qE '^NOTIFY_EMAIL=.' "${APP_DIR}/.env"; then
      ok "NOTIFY_EMAIL definida (los avisos van a su propio buzón)"
    else
      ojo "NOTIFY_EMAIL no está: los avisos irán a ADMIN_EMAIL"
    fi
    duplicadas=$(grep -E '^[A-Z_]+=' "${APP_DIR}/.env" | cut -d= -f1 | sort | uniq -d | tr '\n' ' ')
    if [ -n "${duplicadas}" ]; then ojo "Variables repetidas en el .env: ${duplicadas}"; else ok "Sin variables repetidas"; fi
    permisos=$(stat -c '%a' "${APP_DIR}/.env" 2>/dev/null || echo "?")
    if [ "${permisos}" = "600" ] || [ "${permisos}" = "400" ]; then ok ".env con permisos ${permisos}"; else ojo ".env con permisos ${permisos}: deberían ser 600"; fi
  fi

  titulo "Contenedores"
  if command -v docker >/dev/null 2>&1; then
    for c in westvane-api westvane-web logisuite-caddy; do
      estado=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$c" 2>/dev/null || echo "no-existe")
      case "${estado}" in
        healthy|running) ok "${c}: ${estado}" ;;
        *) mal "${c}: ${estado}" ;;
      esac
    done
  else
    ojo "docker no está disponible aquí: se omiten los contenedores"
  fi
fi

titulo "Respuesta del sitio (${URL})"
espera /api/health 200 "Salud de la API"
espera / 200 "Portada"
espera /envios 200 "Envíos"
espera /hoy 200 "Tablero Hoy"
espera /flota 200 "Flota"
espera /administracion 200 "Administración"
espera /configuracion 200 "Configuración"
espera /auditoria 200 "Auditoría"
espera /api/today 200 "API del tablero Hoy"
espera /api/audit?limit=1 200 "API del historial"

salud=$(cuerpo "${URL}/api/health")
if printf '%s' "${salud}" | grep -q '"status"'; then ok "La salud devuelve JSON"; else mal "La salud no devuelve JSON: ${salud:0:80}"; fi

titulo "Seguridad: sin sesión no se administra ni se envía correo"
espera_sin_sesion GET /api/admin/users "" 401 "Listar usuarios sin sesión"
espera_sin_sesion POST /api/companies '{"name":"Empresa de verificacion"}' 401 "Crear empresa sin sesión"
espera_sin_sesion PUT /api/settings/mail-alerts '{"kind":"novedades","enabled":false}' 401 "Cambiar avisos sin sesión"
espera_sin_sesion POST /api/shipments/LS-0000-0000/tracking/token-falso/email '{"email":"a@b.co"}' 401 "Enviar correo sin sesión"

titulo "Ingreso por código"
pedido=$(curl -s -m 20 -X POST -H 'content-type: application/json' \
  -d '{"email":"verificacion@ejemplo.invalid"}' "${URL}/api/auth/otp/request" 2>/dev/null || true)
if printf '%s' "${pedido}" | grep -q '"ok":true'; then
  ok "La API acepta la petición de código"
elif printf '%s' "${pedido}" | grep -qi 'no está configurado'; then
  # El ingreso sin correo configurado está deshabilitado a propósito; pero si el .env tiene SMTP, la API debería verlo
  if [ "${SOLO_RED}" = "0" ] && grep -qE '^SMTP_HOST=.' "${APP_DIR}/.env"; then
    mal "El .env tiene SMTP_HOST pero la API dice que el correo no está configurado: el contenedor no tomó el .env (reinícialo con --force-recreate)"
  else
    ojo "El correo no está configurado: el ingreso con código está deshabilitado"
  fi
else
  mal "La petición de código no respondió como se espera: ${pedido:0:120}"
fi
if printf '%s' "${pedido}" | grep -qE '"dev_code"[[:space:]]*:[[:space:]]*"[0-9]{6}"'; then
  mal "¡El código viaja en la respuesta! Debe salir solo con WESTVANE_DEV_OTP en pruebas"
else
  ok "El código no viaja en la respuesta"
fi
if printf '%s' "${pedido}" | grep -qi 'no está registrado'; then
  mal "La respuesta delata si un correo existe"
else
  ok "La respuesta no delata si el correo existe"
fi

titulo "Enlaces públicos"
espera /api/tracking/token-que-no-existe 404 "Seguimiento con token inválido"
espera /api/shipments/NO-EXISTE 404 "Envío inexistente"

if [ "${SOLO_RED}" = "0" ]; then
  titulo "Recursos"
  uso=$(df -P / 2>/dev/null | awk 'NR==2{gsub("%","",$5); print $5}')
  if [ -n "${uso:-}" ]; then
    if [ "${uso}" -ge 90 ]; then mal "Disco al ${uso} %: hay que liberar espacio"; elif [ "${uso}" -ge 85 ]; then ojo "Disco al ${uso} %"; else ok "Disco al ${uso} %"; fi
  fi
  ultimo=$(ls -1t "${APP_DIR}"/backups/logistics-*.db.gz 2>/dev/null | head -1)
  if [ -z "${ultimo}" ]; then
    mal "No hay ningún respaldo de la base en ${APP_DIR}/backups"
  else
    horas=$(( ( $(date +%s) - $(stat -c %Y "${ultimo}") ) / 3600 ))
    if [ "${horas}" -gt 36 ]; then mal "El último respaldo es de hace ${horas} h ($(basename "${ultimo}"))"; else ok "Último respaldo de hace ${horas} h"; fi
    if ls -1t "${APP_DIR}"/backups/env-*.bak >/dev/null 2>&1; then ok "Hay copia del .env en los respaldos"; else ojo "No hay copia del .env en los respaldos"; fi
  fi
fi

printf '\n'
if [ "${FALLOS}" -eq 0 ] && [ "${AVISOS}" -eq 0 ]; then
  printf '\033[32mTodo bien.\033[0m\n'
elif [ "${FALLOS}" -eq 0 ]; then
  printf '\033[33mSin fallos, con %d aviso(s).\033[0m\n' "${AVISOS}"
else
  printf '\033[31m%d fallo(s) y %d aviso(s).\033[0m\n' "${FALLOS}" "${AVISOS}"
fi
[ "${FALLOS}" -eq 0 ] || exit 1
exit 0
