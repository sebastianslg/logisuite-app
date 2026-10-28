# Copia los respaldos del VPS a tu computador (una copia fuera del servidor).
# Desde PowerShell, en la carpeta del repositorio:
#   powershell -ExecutionPolicy Bypass -File deploy\descargar-respaldos.ps1
# Solo descarga lo que aún no tienes; quedan en Documentos\Westvane\respaldos.
param(
  [string]$Servidor = "root@209.126.13.65",
  [string]$Clave = "$HOME\.ssh\logisuite_contabo",
  [string]$Destino = "$HOME\Documents\Westvane\respaldos"
)
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $Destino | Out-Null

$remotos = ssh -i $Clave $Servidor "ls -1 /opt/logisuite/backups" | Where-Object { $_ -match '\.(db\.gz|tar\.gz)$' }
$nuevos = $remotos | Where-Object { -not (Test-Path (Join-Path $Destino $_)) }
if (-not $nuevos) { Write-Host "Ya tienes todos los respaldos ($($remotos.Count)) en $Destino"; exit 0 }

foreach ($archivo in $nuevos) {
  Write-Host "Descargando $archivo"
  scp -i $Clave "${Servidor}:/opt/logisuite/backups/$archivo" (Join-Path $Destino $archivo)
}
Write-Host "Listo: $($nuevos.Count) archivo(s) nuevo(s) en $Destino"
