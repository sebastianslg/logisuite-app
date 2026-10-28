#!/usr/bin/env bash
# Blindaje del VPS (Ubuntu 22.04/24.04). Se puede correr varias veces; cada paso revisa antes de cambiar.
#   sudo bash /opt/logisuite/deploy/harden-server.sh
#
#   1. Firewall: solo SSH (22), HTTP (80) y HTTPS (443).
#   2. SSH solo con llave: sin contraseñas, root solo con llave, 3 intentos por conexión.
#      Antes revisa que root tenga al menos una llave autorizada; si no, NO toca SSH (te dejaría afuera).
#   3. fail2ban: bloquea una hora a la IP que falle 5 veces seguidas al entrar por SSH.
#   4. Actualizaciones de seguridad automáticas (unattended-upgrades), sin reinicios automáticos.
#   5. Permisos: .env (claves y dominio) y respaldos solo legibles por root.
#   6. Memoria de intercambio (swap) de 2 GB si la máquina no tiene, para que un pico no tumbe la app.
#
# IMPORTANTE: deja abierta la sesión SSH actual y prueba entrar en otra ventana antes de cerrarla.
set -euo pipefail
APP_DIR=${APP_DIR:-/opt/logisuite}
[ "$(id -u)" -eq 0 ] || { echo "Corre este script como root (sudo)."; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
apt-get install -y -qq ufw fail2ban unattended-upgrades >/dev/null

echo "[1/6] Firewall"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
for p in 22/tcp 80/tcp 443/tcp; do ufw allow "$p" >/dev/null; done
ufw --force enable >/dev/null
ufw status | sed -n '1,8p'

echo "[2/6] SSH solo con llave"
KEYS=/root/.ssh/authorized_keys
if [ -s "$KEYS" ] && grep -qE '^(ssh-|ecdsa-|sk-)' "$KEYS"; then
  cat > /etc/ssh/sshd_config.d/10-westvane.conf <<'EOF'
# Instalado por deploy/harden-server.sh
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PermitEmptyPasswords no
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
EOF
  if sshd -t; then
    systemctl reload ssh 2>/dev/null || systemctl reload sshd
    echo "SSH: contraseñas desactivadas; se entra solo con llave."
  else
    rm -f /etc/ssh/sshd_config.d/10-westvane.conf
    echo "SSH: la configuración nueva no pasó la revisión; se dejó como estaba."
  fi
else
  echo "SSH: root no tiene llaves autorizadas en $KEYS. NO se desactivan las contraseñas (te dejaría afuera)."
fi

echo "[3/6] fail2ban"
cat > /etc/fail2ban/jail.d/westvane.local <<'EOF'
# Instalado por deploy/harden-server.sh
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban >/dev/null 2>&1
systemctl restart fail2ban
sleep 1
fail2ban-client status sshd 2>/dev/null | sed -n '1,4p' || true

echo "[4/6] Actualizaciones de seguridad automáticas"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
# Sin reinicio automático: si una actualización del núcleo lo pide, aparece al entrar por SSH
cat > /etc/apt/apt.conf.d/52westvane-unattended <<'EOF'
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
echo "Activadas (solo parches de seguridad)."

echo "[5/6] Permisos"
[ -f "$APP_DIR/.env" ] && chmod 600 "$APP_DIR/.env" && echo ".env: 600"
[ -d "$APP_DIR/backups" ] && chmod 700 "$APP_DIR/backups" && echo "backups/: 700"

echo "[6/6] Memoria de intercambio"
if [ "$(swapon --show --noheadings | wc -l)" -eq 0 ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -q vm.swappiness=10 && echo 'vm.swappiness=10' > /etc/sysctl.d/90-westvane-swap.conf
  echo "Swap de 2 GB creada."
else
  echo "Ya hay swap: $(swapon --show --noheadings | awk '{print $1, $3}' | tr '\n' ' ')"
fi

echo
echo "Listo. Memoria y disco:"
free -h | sed -n '1,3p'
df -h / | tail -1
echo
echo "Prueba ahora entrar por SSH en OTRA ventana antes de cerrar esta."
