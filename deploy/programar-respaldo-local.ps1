# Programa en Windows la descarga diaria de respaldos (deploy\descargar-respaldos.ps1), para no depender de acordarse.
# Se ejecuta UNA vez, desde PowerShell, en la carpeta del repositorio:
#   powershell -ExecutionPolicy Bypass -File deploy\programar-respaldo-local.ps1
# Para quitarla:
#   powershell -ExecutionPolicy Bypass -File deploy\programar-respaldo-local.ps1 -Quitar
#
# Cada día a la hora indicada. Si el PC estaba apagado a esa hora, corre en cuanto se encienda y haya red.
# No pide permisos de administrador: corre con tu usuario. Todo queda en Documentos\Westvane\respaldos\descarga.log.
param(
  [string]$Hora = "13:00",
  [switch]$IncluirEnv,
  [switch]$Quitar
)
$ErrorActionPreference = "Stop"
$nombre = "Westvane - respaldo diario"

if ($Quitar) {
  Unregister-ScheduledTask -TaskName $nombre -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Tarea quitada."
  exit 0
}

$script = Join-Path $PSScriptRoot "descargar-respaldos.ps1"
if (-not (Test-Path $script)) { throw "No encuentro $script" }
$argumentos = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -Silencioso"
if ($IncluirEnv) { $argumentos += " -IncluirEnv" }

$accion = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argumentos
$disparador = New-ScheduledTaskTrigger -Daily -At $Hora
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger $disparador -Settings $ajustes `
  -Description "Copia los respaldos del VPS de Westvane a este PC y verifica cada archivo." -Force | Out-Null

Write-Host "Listo: '$nombre' corre todos los días a las $Hora."
Write-Host "Registro: $HOME\Documents\Westvane\respaldos\descarga.log"
Write-Host "Probarla ahora:  Start-ScheduledTask -TaskName '$nombre'"
