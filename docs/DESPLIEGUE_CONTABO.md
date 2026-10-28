# Despliegue en Contabo — guía operativa (vigente)

> Este documento describe el servidor que está en uso hoy. El `DEPLOY.md` de la raíz es de la
> configuración anterior en Oracle y no aplica.

## 1. Datos del servidor

| Dato | Valor |
|---|---|
| Proveedor | Contabo, Cloud VPS 4 |
| Nombre de instancia | `vmi3680995` |
| IP | `209.126.13.65` |
| Usuario | `root` |
| Sistema | Ubuntu 24.04 |
| Carpeta de la app | `/opt/logisuite` |
| Dominio | `https://westvane.duckdns.org` (DuckDNS, apunta a la IP) |
| Enlace para el profesor | `https://westvane.duckdns.org/envios` y `/red` |

Contenedores (Docker Compose):
- `westvane-api` — FastAPI + SQLite (base en `backend/data/`).
- `westvane-web` — Next.js.
- `logisuite-caddy` — Caddy: HTTPS automático y reverse proxy. Solo expone los puertos 80 y 443.

**No guardes ni compartas la contraseña de root en ningún documento ni chat.** El acceso es por clave SSH.

## 2. Acceso por SSH (desde Windows PowerShell)

La clave está en `$HOME\.ssh\logisuite_contabo` (la privada; la pública se agregó a
`/root/.ssh/authorized_keys` en el servidor).

```powershell
ssh -i "$HOME\.ssh\logisuite_contabo" root@209.126.13.65
```

Al entrar, la línea del prompt debe mostrar `root@vmi3680995`. Si ves otra cosa, estás en tu PC.

### Errores frecuentes

- **`El token '&&' no es un separador de instrucciones válido`**: el comando con `&&` se ejecutó en
  PowerShell de Windows. Primero entra por SSH y ejecuta el comando dentro del servidor (bash).
- **`Connection timed out` en el puerto 22**: el VPS estaba detenido, o el firewall o `fail2ban`
  bloquearon tu IP. Pasos:
  1. Entra al panel de Contabo y revisa que el VPS esté en estado "Activo" (no "Detenido").
     Si está detenido, inícialo y espera 2–3 minutos.
  2. Si sigue sin responder, usa la **consola web (VNC)** del panel. Ahí ejecuta:
     ```bash
     systemctl status ssh
     sudo ufw status
     sudo fail2ban-client status sshd
     ```
     Si `ssh` está parado: `systemctl start ssh`. Si `ufw` no permite el 22: `sudo ufw allow 22/tcp`.
     Si tu IP aparece bloqueada en `fail2ban`: `sudo fail2ban-client set sshd unbanip TU_IP`.
- **`Identity file ... not accessible`**: la ruta de la clave está mal. Verifica que el archivo exista:
  `dir $HOME\.ssh`.
- **Pregunta `Are you sure you want to continue connecting (yes/no)?`**: estás dentro del servidor e
  intentas entrar a sí mismo. Responde `no` o `Ctrl+C`.

## 3. Actualizar la app en el servidor (el procedimiento normal)

Desde la sesión SSH (bash, dentro del servidor):

```bash
cd /opt/logisuite
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

- `git pull` trae los cambios de `main`.
- `up -d --build` reconstruye las imágenes y reinicia los contenedores. Tarda **3 a 6 minutos**
  (el build de Next.js es el más pesado). No interrumpas el comando.
- Al terminar, el resumen debe mostrar `westvane-api ... Healthy` y `westvane-web ... Started`.

Verificación después de desplegar:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
curl -s http://127.0.0.1:8000/api/health        # debe responder {"status":"ok"} (solo si el puerto 8000 está publicado; si no, usa docker exec)
```

Luego, en el navegador, abre `https://westvane.duckdns.org/envios` en ventana privada y revisa el cambio
que desplegaste.

### Si el build falla

- Revisa las últimas 60 líneas: `docker compose ... build 2>&1 | tail -60`.
- Error de Next.js por "known security vulnerability": la versión debe ser **16.4.3** o superior
  (`frontend/package.json`). Ya está corregido en `main`.
- Error de memoria: `free -h`. Si está casi llena, reinicia el VPS desde el panel y vuelve a desplegar.

## 4. Ver el estado y los logs

```bash
cd /opt/logisuite
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps        # estado
docker logs westvane-api --tail 60                                        # log de la API
docker logs westvane-web --tail 60                                        # log del frontend
docker logs logisuite-caddy --tail 60                                     # log de HTTPS
free -h                                                                   # memoria
df -h /                                                                   # disco
```

Las peticiones a la API aparecen como `INFO: ... "GET /api/... 200 OK"`. Un `500` o un `Traceback` es
un error real.

## 5. Reiniciar

```bash
cd /opt/logisuite
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart    # todo
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend
```

Los contenedores tienen `restart: unless-stopped`: si el VPS se reinicia, la app vuelve sola.

## 6. Respaldos de la base

```bash
sudo /opt/logisuite/deploy/backup.sh                 # respaldo manual
ls /opt/logisuite/backups                            # se conservan los últimos 14
```

Restaurar un respaldo (con cuidado: sobrescribe la base):

```bash
cd /opt/logisuite
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop backend
rm -f backend/data/logistics.db-wal backend/data/logistics.db-shm   # la base usa modo WAL: estos archivos son de la base anterior
gunzip -c backups/NOMBRE.db.gz > backend/data/logistics.db
docker compose -f docker-compose.yml -f docker-compose.prod.yml start backend
```

Para tener copias fuera del servidor, descarga `backups/` periódicamente (por ejemplo con `scp`).

## 7. Variables de entorno

- El archivo `.env` en `/opt/logisuite` debe tener `DOMAIN=westvane.duckdns.org`. Caddy lo usa
  para pedir el certificado HTTPS. Si falta, `docker compose` se detiene con un error que lo indica.
- Plantilla: `.env.example` en la raíz del repositorio.

## 8. Seguridad del servidor (estado y pendientes)

- Entrada por clave SSH: activa para root.
- **Pendiente:** cerrar la entrada por contraseña en SSH (`PasswordAuthentication no`). En Ubuntu 24.04 los
  ajustes de SSH pueden estar en `/etc/ssh/sshd_config.d/`, y un archivo ahí puede sobrescribir el cambio.
  Antes de cerrar la contraseña, prueba que la clave entra desde una **segunda** ventana.
- **Pendiente:** `fail2ban` y actualizaciones automáticas (`unattended-upgrades`). No está confirmado que
  estén instalados; revisar con `systemctl status fail2ban`.
- Ningún puerto además de 80, 443 y 22 debe estar abierto.

## 9. Lo que NO hacer

- No ejecutes `docker compose down -v`: borra los volúmenes con la base de datos.
- No edites archivos dentro de los contenedores; cambia el repositorio y despliega.
- No dejes la contraseña de root en chats, commits ni archivos.
- No ejecutes `git reset --hard` en `/opt/logisuite` sin revisar antes `git status`.

## 10. Flujo completo resumido

1. Cambios en tu computadora → `git push` a `main`.
2. PowerShell: `ssh -i "$HOME\.ssh\logisuite_contabo" root@209.126.13.65`.
3. En el servidor: `cd /opt/logisuite && git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`.
4. Esperar 3–6 minutos, revisar `ps`, abrir `https://westvane.duckdns.org/envios` en ventana privada.
5. Si algo falla, `docker logs` de la API y del frontend, y pasar el error al chat.
