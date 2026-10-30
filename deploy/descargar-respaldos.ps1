# Copia los respaldos del VPS a tu computador (una copia fuera del servidor) y VERIFICA cada archivo.
#
# A mano, desde PowerShell, en la carpeta del repositorio:
#   powershell -ExecutionPolicy Bypass -File deploy\descargar-respaldos.ps1
# Solo descarga lo que aún no tienes; quedan en Documentos\Westvane\respaldos.
# Para que corra solo cada día: deploy\programar-respaldo-local.ps1 (se ejecuta una vez).
#
#   -IncluirEnv   también baja las copias del .env (llevan claves: quedan solo para tu usuario de Windows)
#   -Conservar N  cuántos respaldos de cada tipo guardar en el PC (30 por defecto)
#   -Silencioso   sin mensajes en pantalla (lo usa la tarea programada; todo queda en descarga.log)
#
# Salida: 0 todo bien · 1 falló una descarga o un archivo llegó dañado · 2 el último respaldo del servidor es viejo
param(
  [string]$Servidor = "root@209.126.13.65",
  [string]$Clave = "$HOME\.ssh\logisuite_contabo",
  [string]$Destino = "$HOME\Documents\Westvane\respaldos",
  [int]$Conservar = 30,
  [int]$MaxHorasSinRespaldo = 36,
  [switch]$IncluirEnv,
  [switch]$Silencioso
)
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $Destino | Out-Null
$registro = Join-Path $Destino "descarga.log"
$errores = 0

function Escribir([string]$texto, [string]$nivel = "INFO") {
  $linea = "{0} [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $nivel, $texto
  Add-Content -Path $registro -Value $linea -Encoding UTF8
  if (-not $Silencioso) { Write-Host $linea }
}

# Tamaño que el propio gzip declara al final del archivo (ISIZE: últimos 4 bytes, little-endian). .NET no se queja de un
# gzip cortado, así que hay que comprobar a mano que lo descomprimido coincida con ese tamaño.
function Leer-Isize([string]$ruta) {
  $fs = [IO.File]::OpenRead($ruta)
  try {
    if ($fs.Length -lt 18) { return -1 }
    [void]$fs.Seek(-4, [IO.SeekOrigin]::End)
    $b = New-Object byte[] 4
    [void]$fs.Read($b, 0, 4)
    return [uint32][BitConverter]::ToUInt32($b, 0)
  } finally { $fs.Dispose() }
}

# Lee todo el gzip: devuelve cuántos bytes salen, sus 16 primeros bytes y cuántos pudo leer (o $null si está dañado)
function Descomprimir([string]$ruta) {
  $fs = [IO.File]::OpenRead($ruta)
  try {
    $gz = New-Object IO.Compression.GZipStream($fs, [IO.Compression.CompressionMode]::Decompress)
    $cabecera = New-Object byte[] 16
    $leidos = $gz.Read($cabecera, 0, 16)
    $total = [long]$leidos
    $buffer = New-Object byte[] 1048576
    while (($n = $gz.Read($buffer, 0, $buffer.Length)) -gt 0) { $total += $n }
    return @{ Total = $total; Cabecera = $cabecera; Primeros = $leidos }
  } catch {
    return $null
  } finally {
    $fs.Dispose()
  }
}

# Un gzip sano: se lee completo y su tamaño coincide con el que declara al final
function Probar-Gz([string]$ruta) {
  $r = Descomprimir $ruta
  if ($null -eq $r) { return $false }
  return (([uint32]($r.Total % 4294967296)) -eq (Leer-Isize $ruta))
}

# Un .db.gz sano: gzip completo y lo que sale es una base SQLite
function Probar-DbGz([string]$ruta) {
  if (-not (Probar-Gz $ruta)) { return $false }
  $r = Descomprimir $ruta
  return ($r.Primeros -ge 16 -and [Text.Encoding]::ASCII.GetString($r.Cabecera, 0, 15) -eq "SQLite format 3")
}

try {
  $patron = if ($IncluirEnv) { '\.(db\.gz|tar\.gz)$|^env-.*\.bak$' } else { '\.(db\.gz|tar\.gz)$' }
  $remotos = @(ssh -i $Clave -o BatchMode=yes -o ConnectTimeout=20 $Servidor "ls -1 /opt/logisuite/backups" | Where-Object { $_ -match $patron })
  if ($LASTEXITCODE -ne 0) { throw "No se pudo conectar al servidor ($Servidor)" }
  $nuevos = @($remotos | Where-Object { -not (Test-Path (Join-Path $Destino $_)) })

  foreach ($archivo in $nuevos) {
    $final = Join-Path $Destino $archivo
    $parcial = "$final.part"
    Escribir "Descargando $archivo"
    scp -i $Clave -o BatchMode=yes "${Servidor}:/opt/logisuite/backups/$archivo" $parcial 2>$null
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $parcial)) { Escribir "No se pudo descargar $archivo" "ERROR"; $errores++; continue }

    # 1) El archivo por dentro: gzip completo y, si es la base, que sea SQLite
    $sano = if ($archivo -like "*.db.gz") { Probar-DbGz $parcial } elseif ($archivo -like "*.tar.gz") { Probar-Gz $parcial } else { (Get-Item $parcial).Length -gt 0 }
    # 2) La huella del archivo en el servidor debe ser idéntica a la de lo que llegó
    if ($sano) {
      $remota = ((ssh -i $Clave -o BatchMode=yes -o ConnectTimeout=20 $Servidor "sha256sum /opt/logisuite/backups/$archivo") -split " ")[0]
      $local = (Get-FileHash -Algorithm SHA256 -Path $parcial).Hash.ToLower()
      if ($remota -ne $local) { $sano = $false }
    }
    if (-not $sano) { Remove-Item $parcial -Force; Escribir "$archivo llegó dañado o incompleto: se descartó" "ERROR"; $errores++; continue }

    Move-Item $parcial $final -Force
    if ($archivo -like "env-*") {
      # Lleva claves: que solo lo lea tu usuario de Windows
      icacls $final /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
    }
    Escribir "OK $archivo ($([math]::Round((Get-Item $final).Length / 1MB, 1)) MB, verificado)"
  }
  if (-not $nuevos) { Escribir "Ya tenías todos los respaldos del servidor ($($remotos.Count))" }

  # Retención local: se conservan los últimos $Conservar de cada tipo
  foreach ($tipo in @("logistics-*.db.gz", "adjuntos-*.tar.gz", "env-*.bak")) {
    Get-ChildItem -Path $Destino -Filter $tipo -ErrorAction SilentlyContinue | Sort-Object Name -Descending |
      Select-Object -Skip $Conservar | ForEach-Object { Remove-Item $_.FullName -Force; Escribir "Se borró el respaldo antiguo $($_.Name)" }
  }

  # ¿El respaldo más reciente es de hace poco? Si el servidor dejó de respaldar, esto lo avisa.
  $ultimo = $remotos | Where-Object { $_ -like "logistics-*.db.gz" } | Sort-Object -Descending | Select-Object -First 1
  if (-not $ultimo) { Escribir "El servidor no tiene ningún respaldo de la base" "ERROR"; exit 2 }
  if ($ultimo -match 'logistics-(\d{8})-(\d{6})') {
    $cuando = [datetime]::ParseExact("$($Matches[1])$($Matches[2])", "yyyyMMddHHmmss", $null)
    $horas = [math]::Round(((Get-Date) - $cuando).TotalHours, 1)
    # El servidor está en UTC+1 y tu PC en UTC-5: un desfase de horas es normal; se avisa solo si es claramente viejo
    if ($horas -gt $MaxHorasSinRespaldo + 6) {
      Escribir "El último respaldo del servidor es de hace $horas h ($ultimo): el respaldo diario no está corriendo" "ERROR"
      exit 2
    }
  }
} catch {
  Escribir $_.Exception.Message "ERROR"
  exit 1
}
if ($errores -gt 0) { exit 1 }
Escribir "Listo: $($nuevos.Count) archivo(s) nuevo(s), todos verificados, en $Destino"
exit 0
