#!/usr/bin/env bash
# Preparación de una VM Ubuntu 22.04/24.04 nueva. Ejecutar como root:
#   sudo bash setup-server.sh https://github.com/sebastianslg/logisuite-app.git main
set -euo pipefail

REPO_URL="${1:?Falta la URL del repositorio}"
BRANCH="${2:-main}"
APP_DIR=/opt/logisuite

echo "[1/5] Paquetes base"
apt-get update -y
apt-get install -y ca-certificates curl git ufw sqlite3

echo "[2/5] Docker"
if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "[3/5] Firewall: solo SSH, HTTP y HTTPS"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "[4/5] Código de la aplicación"
if [ ! -d "${APP_DIR}/.git" ]; then
    git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
else
    git -C "${APP_DIR}" fetch origin "${BRANCH}" && git -C "${APP_DIR}" checkout "${BRANCH}" && git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
fi
mkdir -p "${APP_DIR}/backend/data" "${APP_DIR}/backups"

echo "[5/5] Respaldo diario (base y adjuntos) y vigilancia del sitio cada 5 minutos"
APP_DIR="${APP_DIR}" bash "${APP_DIR}/deploy/install-cron.sh"

cat <<MSG

Listo. Siguientes pasos:
  1. Crea ${APP_DIR}/.env con DOMAIN=tu.dominio.com (ver DEPLOY.md).
  2. cd ${APP_DIR} && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
MSG
