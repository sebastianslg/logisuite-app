# Despliegue en una VM (Oracle Cloud, plan gratuito)

Resultado: la aplicación en `https://TU-DOMINIO`, siempre encendida, con HTTPS,
respaldo diario de la base y actualización automática con cada `git push`.

Los pasos marcados **[TÚ]** los haces en el navegador. El resto son comandos
que ya están en el repositorio.

## 1. Cuenta y máquina virtual en Oracle — [TÚ]

1. Crea la cuenta en https://www.oracle.com/cloud/free (pide tarjeta solo para verificar identidad).
2. En el panel: **Compute > Instances > Create instance**.
3. Configura:
   - **Image:** Ubuntu 22.04 o 24.04.
   - **Shape:** *VM.Standard.A1.Flex* (Ampere, gratuito), con 2 OCPU y 12 GB de RAM. Si no hay capacidad en tu región, prueba más tarde o en otra región.
   - **Networking:** deja la subred pública y marca **Assign a public IPv4 address**.
   - **SSH keys:** sube tu clave pública (`cat ~/.ssh/id_ed25519.pub`). Guarda la clave privada.
4. Cuando la instancia esté *Running*, anota la **IP pública**.
5. Abre los puertos en la red: **Networking > Virtual Cloud Networks > tu VCN > Security Lists > Default Security List > Add Ingress Rules**, con origen `0.0.0.0/0` y puertos TCP **80** y **443**. El 22 ya viene abierto.

## 2. Dominio — [TÚ]

Opción gratuita: **DuckDNS** (https://www.duckdns.org). Crea un subdominio, por ejemplo
`logisuite.duckdns.org`, y pon la IP pública de la VM.

Opción de pago: compra un dominio y crea un registro **A** que apunte a la IP.

Espera a que el dominio resuelva a la IP antes del paso 5. Puedes verificarlo con
`nslookup TU-DOMINIO`.

## 3. Conectarte a la VM — [TÚ]

```bash
ssh ubuntu@TU_IP
```

## 4. Preparar el servidor

Dentro de la VM:

```bash
curl -fsSLO https://raw.githubusercontent.com/sebastianslg/logisuite-app/claude/laughing-albattani-875mtq/deploy/setup-server.sh
sudo bash setup-server.sh https://github.com/sebastianslg/logisuite-app.git claude/laughing-albattani-875mtq
```

Esto instala Docker, configura el firewall (solo 22, 80 y 443), clona el código en
`/opt/logisuite` y programa el respaldo diario.

> Si el repositorio es privado, el `git clone` pedirá credenciales. Usa un token
> de GitHub como contraseña, o haz el repositorio público.

## 5. Configurar el dominio y levantar la app

```bash
cd /opt/logisuite
echo "DOMAIN=TU-DOMINIO" | sudo tee .env
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

La primera construcción tarda varios minutos. Caddy pide el certificado HTTPS
automáticamente; si el dominio ya apunta a la IP, en un minuto estará listo.

Verifica:
```bash
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
curl -I https://TU-DOMINIO
```

Abre `https://TU-DOMINIO` en el navegador.

## 6. Actualización automática — [TÚ]

En GitHub: **Settings > Secrets and variables > Actions > New repository secret**:

| Nombre | Valor |
|---|---|
| `SSH_HOST` | IP pública de la VM |
| `SSH_USER` | `ubuntu` |
| `SSH_KEY` | contenido completo de tu clave **privada** |

Desde ese momento, cada `git push` a la rama despliega solo. Puedes verlo en la
pestaña **Actions** del repositorio, o lanzarlo a mano con *Run workflow*.

## Operación

| Qué | Comando (dentro de `/opt/logisuite`) |
|---|---|
| Ver estado | `sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml ps` |
| Ver logs de la API | `sudo docker compose ... logs -f backend` |
| Reiniciar todo | `sudo docker compose ... restart` |
| Respaldo manual | `sudo /opt/logisuite/deploy/backup.sh` |
| Respaldos guardados | `ls /opt/logisuite/backups` (se conservan 14) |
| Restaurar un respaldo | `docker compose ... stop backend` → `gunzip -c backups/XXX.db.gz > backend/data/logistics.db` → `docker compose ... start backend` |

## Puntos a vigilar

- **Plan gratuito de Oracle:** Oracle puede recuperar instancias con muy poca
  actividad durante un tiempo prolongado. Revisa periódicamente que siga
  encendida. Para una revisión importante, usa la migración a Hetzner (mismo
  `docker compose`, cambia solo la IP del dominio).
- **Respaldos:** están en la misma VM. Si la VM se pierde, se pierden también.
  Para copias fuera del servidor, descarga `backups/` periódicamente.
- **Contraseñas:** los usuarios de prueba (`admin` / `admin123`) son públicos
  en la pantalla de login. Si el enlace será público, cámbialas desde la
  pantalla de Administración antes de compartirlo.
