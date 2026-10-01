# EL BANCO DE ACTUALIZACION: el nivel 4 de la spec 072, sin manos.
#
# Instala una app de verdad con Velopack, le publica una version nueva en un feed local y recorre los
# caminos por los que una persona acaba (o no) en ella: la pastilla, cerrar, un apagon, abrir dos
# veces, un programa abierto por la app, un candado ajeno, dos versiones de retraso.
#
# POR QUE EXISTE (2026-09-30). El contrato juzga la logica y no puede decir que Update.exe renombra
# una carpeta. Y eso era justo lo que fallaba: en los equipos reales la version nueva se descargaba y
# no se aplicaba, porque un programa abierto por U heredaba su carpeta de trabajo (current) y Velopack
# no podia renombrarla. Volvia la version vieja sin una linea en el log. Se encontro aqui, no leyendo.
#
# QUE INSTALA, Y DONDE. La sonda de sondas\DeLaActualizacion, que arranca igual que App.Main y lleva
# ENLAZADO el modulo windows-client\src\Update. Con OTRO id de paquete (USonda) y fuera de AppData
# (-Banco, por defecto C:\U-banco): no toca la U instalada, ni su acceso directo, ni su registro.
#
#   .\scripts\banco-de-actualizacion.ps1                 los nueve escenarios
#   .\scripts\banco-de-actualizacion.ps1 -Viejo          EL SABOTAJE: la sonda se porta como la 1.3.6.
#                                                        Tienen que salir MAL cinco (S2 S5 S6 S7 S8).
#   .\scripts\banco-de-actualizacion.ps1 -Solo S2,S6 -Detalle
#   .\scripts\banco-de-actualizacion.ps1 -ConGitHub      ademas S10: un token embebido que GitHub rechaza
#                                                        (dos peticiones anonimas al repo real)
#
# Sale con el numero de escenarios MAL. 99 = no se pudo montar el banco: eso no es un rojo, es un no-se.
#
# ASCII a proposito: PowerShell 5.1 lee un .ps1 sin BOM como ANSI.
param(
    [string]$Banco = 'C:\U-banco',
    [switch]$Viejo,
    [string[]]$Solo = @(),
    [switch]$Detalle,
    [switch]$ConGitHub
)
$ErrorActionPreference = 'Stop'
$repo  = Split-Path -Parent $PSScriptRoot
$Id    = 'USonda'
$Inst  = Join-Path $Banco 'inst'
$Pub   = Join-Path $Banco 'pub'
$Feed1 = Join-Path $Banco 'feed1'
$Feed2 = Join-Path $Banco 'feed2'
$Feed3 = Join-Path $Banco 'feed3'
$Datos = Join-Path $Banco 'datos'
$Reg   = Join-Path $Banco 'registro.log'
$LogVelopack = Join-Path $env:LOCALAPPDATA "velopack\velopack_$Id.log"
$env:U_BANCO = $Banco
$extra = if ($Viejo) { ' viejo' } else { '' }

function Borrar([string]$Ruta) {
    if (Test-Path $Ruta -PathType Container) { [IO.Directory]::Delete($Ruta, $true) }
    elseif (Test-Path $Ruta) { [IO.File]::Delete($Ruta) }
}
function Procesos {
    Get-CimInstance Win32_Process | Where-Object {
        $_.ExecutablePath -like "$Inst\*" -or ($_.Name -eq 'PING.EXE' -and $_.CommandLine -like '*-n 900 127.0.0.1*')
    } | Select-Object ProcessId, Name
}
function Matar { Procesos | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }; Start-Sleep -Milliseconds 400 }
# Solo la app: los programas que ella abrio se quedan vivos, que es lo que pasa de verdad.
function MatarApp {
    Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like "$Inst\*" } |
        ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
    Start-Sleep -Milliseconds 500
}
function Empaquetar([string]$Version, [string]$Destino, [string]$Desde = $Pub) {
    New-Item -ItemType Directory -Force -Path $Destino | Out-Null
    $s = vpk pack -u $Id -v $Version -p $Desde -e Sonda.exe -o $Destino --packTitle 'U Sonda' --shortcuts None 2>&1
    if ($LASTEXITCODE -ne 0) { $s | Select-Object -Last 12 | Write-Host; throw "vpk pack $Version fallo" }
}
function Publicar([string]$Destino, [string[]]$Mas = @()) {
    dotnet publish (Join-Path $repo 'sondas\DeLaActualizacion\Sonda.csproj') -c Release -r win-x64 --self-contained false -o $Destino -v q --nologo @Mas | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'la sonda no compila' }
}
function Control([string]$Modo, [string]$FeedUrl) { Set-Content -Path (Join-Path $Banco 'control.txt') -Value @("feed=$FeedUrl", "modo=$Modo") -Encoding ascii }
function Instalar([string]$DesdeFeed) {
    $p = Start-Process (Join-Path $DesdeFeed "$Id-win-Setup.exe") -ArgumentList '--silent', '--installto', $Inst -PassThru -Wait
    if ($p.ExitCode -ne 0) { throw "el Setup salio con $($p.ExitCode)" }
    Start-Sleep -Milliseconds 800
    Matar   # el Setup lanza la app al terminar; el guion la lanza a su manera
}
# Como el acceso directo que crea el instalador: carpeta de trabajo = current.
function Lanzar([string]$Argumentos = '') {
    $exe = Join-Path $Inst 'current\Sonda.exe'; $cwd = Join-Path $Inst 'current'
    if ($Argumentos) { Start-Process $exe -WorkingDirectory $cwd -ArgumentList $Argumentos | Out-Null }
    else { Start-Process $exe -WorkingDirectory $cwd | Out-Null }
}
function Orden([string]$Que) { Set-Content -Path (Join-Path $Banco 'orden.txt') -Value $Que -Encoding ascii }
function EnDisco {
    $m = Join-Path $Inst 'current\sq.version'
    if (-not (Test-Path $m)) { return '(sin instalar)' }
    ([xml](Get-Content $m -Raw)).package.metadata.version
}
function Registro { if (Test-Path $Reg) { Get-Content $Reg -Encoding UTF8 } }
function Esperar([string]$Patron, [int]$Segundos = 30) {
    $fin = (Get-Date).AddSeconds($Segundos)
    while ((Get-Date) -lt $fin) {
        if ((Test-Path $Reg) -and (Registro | Where-Object { $_ -match $Patron })) { return $true }
        Start-Sleep -Milliseconds 300
    }
    return $false
}
function Linea([string]$Patron) {
    $l = Registro | Where-Object { $_ -match $Patron } | Select-Object -Last 1
    if ($l) { $l.Substring(0, [Math]::Min(230, $l.Length)) } else { '' }
}
function DeVelopack([string]$Patron) {
    if (-not (Test-Path $LogVelopack)) { return '' }
    $l = Select-String -Path $LogVelopack -Pattern $Patron | Select-Object -Last 1
    if ($l) { $l.Line.Substring(0, [Math]::Min(170, $l.Line.Length)) } else { '' }
}
function Preparar([string]$Modo, [string]$FeedUrl = $Feed2, [string]$InstalarDesde = $Feed1) {
    Matar
    foreach ($p in @($Inst, $Reg, (Join-Path $Banco 'orden.txt'), $Datos)) { Borrar $p }
    Control ($Modo + $extra) $FeedUrl
    Instalar $InstalarDesde
    Borrar $Reg
}
$resultados = New-Object System.Collections.ArrayList
function Anotar([string]$Escenario, [string]$Que, [bool]$Bien, [string]$Nota) {
    $null = $resultados.Add([pscustomobject]@{ Id = $Escenario; Escenario = $Que; Veredicto = $(if ($Bien) { 'BIEN' } else { 'MAL' }); Nota = $Nota })
    if ($Detalle -or -not $Bien) {
        Write-Host "    ===== $Escenario $Que -> en disco $(EnDisco)"
        Registro | ForEach-Object { Write-Host "    $_" }
    }
}
function Corre([string]$Escenario) { return ($Solo.Count -eq 0) -or ($Solo -contains $Escenario) }

# -- Montar el banco. Si esto falla no hay veredicto: 99, que no es un numero de escenarios.
try {
    if (-not (Get-Command vpk -ErrorAction SilentlyContinue)) { throw 'falta vpk: dotnet tool install -g vpk' }
    New-Item -ItemType Directory -Force -Path $Banco | Out-Null
    Matar
    Write-Host '1/2 compilando la sonda con el modulo de actualizacion de la rama...' -ForegroundColor Cyan
    Publicar $Pub
    Write-Host '2/2 empaquetando 9.0.1, 9.0.2 y 9.0.3...' -ForegroundColor Cyan
    foreach ($f in @($Feed1, $Feed2, $Feed3)) { Borrar $f }
    Empaquetar '9.0.1' $Feed1
    Copy-Item $Feed1 $Feed2 -Recurse; Empaquetar '9.0.2' $Feed2
    Copy-Item $Feed2 $Feed3 -Recurse; Empaquetar '9.0.3' $Feed3
    # El feed 3 ANUNCIA deltas que no estan: es el caso de una release a medio subir.
    Get-ChildItem $Feed3 -Filter '*-delta.nupkg' | ForEach-Object { $_.Delete() }
} catch {
    Write-Host ''
    Write-Host "NO SE PUDO MONTAR EL BANCO: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Esto NO es un verde ni un rojo: es un no-se.' -ForegroundColor Red
    exit 99
}

Write-Host "escenarios$(if ($Viejo) { ' (sonda en modo VIEJO, como la 1.3.6)' })..." -ForegroundColor Cyan
if (Corre 'S1') {
    Preparar 'pastilla'
    Lanzar; $ok = Esperar 'arranque: version=9\.0\.2' 40
    Anotar 'S1' 'pastilla, sin nada mas abierto' ($ok -and (EnDisco) -eq '9.0.2') "en disco $(EnDisco); dijo: $(Linea 'update: actualizaci.n aplicada')"
}
if (Corre 'S2') {
    Preparar 'hijo pastilla'
    Lanzar; $ok = Esperar 'arranque: version=9\.0\.2' 45
    $intentos = @(Registro | Where-Object { $_ -match 'aplicando actualizaci.n y reiniciando' }).Count
    Control 'quieto' $Feed2; Matar; Start-Sleep 1; Matar
    Anotar 'S2' 'pastilla, con un programa abierto por la app' ($ok -and (EnDisco) -eq '9.0.2' -and $intentos -eq 1) "en disco $(EnDisco); intentos $intentos"
}
if (Corre 'S3') {
    Preparar 'quieto'
    Lanzar; $null = Esperar 'lista: UpdateReady' 30; MatarApp
    Lanzar; $ok = Esperar 'arranque: version=9\.0\.2' 40
    Anotar 'S3' 'el proceso muere (apagon) y se reabre' ($ok -and (EnDisco) -eq '9.0.2') "en disco $(EnDisco); dijo: $(Linea 'update: actualizaci.n aplicada')"
}
if (Corre 'S4') {
    Preparar 'quieto'
    Lanzar; $null = Esperar 'lista: UpdateReady' 30; Orden 'salir'; $null = Esperar 'salida: cierre ordenado' 15
    Start-Sleep 12; $antes = EnDisco
    Lanzar; $ok = Esperar 'arranque: version=9\.0\.2' 30
    Anotar 'S4' 'cierre ordenado: se aplica al salir' ($antes -eq '9.0.2' -and $ok) "en disco antes de reabrir $antes; dijo: $(Linea 'update: actualizaci.n aplicada')"
}
if (Corre 'S5') {
    Preparar 'hijo quieto'
    Lanzar; $null = Esperar 'lista: UpdateReady' 30; MatarApp
    Control ('quieto' + $extra) $Feed2
    $crono = [Diagnostics.Stopwatch]::StartNew()
    Lanzar; $ok = Esperar 'arranque: version=9\.0\.2' 40; $crono.Stop()
    Anotar 'S5' 'se reabre con un programa de la sesion anterior vivo' ($ok -and (EnDisco) -eq '9.0.2') "en disco $(EnDisco); $([int]$crono.Elapsed.TotalSeconds) s hasta la nueva"
}
if (Corre 'S6') {
    Preparar 'quieto'
    Lanzar; $null = Esperar 'lista: UpdateReady' 30
    $primera = (Procesos | Where-Object Name -eq 'Sonda.exe' | Select-Object -First 1).ProcessId
    Lanzar '--consulta'; Start-Sleep 9
    $viva = [bool](Get-Process -Id $primera -ErrorAction SilentlyContinue)
    Anotar 'S6' 'segunda apertura con la actualizacion descargada' $viva "la primera sigue viva: $viva; en disco $(EnDisco); dijo: $(Linea 'no se aplica en este arranque')"
}
if (Corre 'S7') {
    # Un candado que la app NO puede evitar: otro programa con un archivo de current abierto en exclusiva.
    # Un archivo que la app no necesite: con sq.version cerrado ni siquiera sabe que esta instalada.
    Preparar 'pastilla'
    $ajeno = Join-Path $Inst 'current\abierto-por-otro.txt'
    Set-Content -Path $ajeno -Value 'x' -Encoding ascii
    $fs = [IO.File]::Open($ajeno, 'Open', 'Read', 'None')
    try { Lanzar; $null = Esperar 'la actualizaci.n NO se aplic' 50; $dijo = Linea 'la actualizaci.n NO se aplic' }
    finally { $fs.Dispose() }
    Control 'quieto' $Feed2; Matar
    Anotar 'S7' 'candado ajeno: el fallo se dice, con su causa' ([bool]$dijo -and $dijo -match 'Update\.exe') "dijo: $dijo"
}
if (Corre 'S8') {
    Preparar 'hijo quieto'
    Lanzar; $null = Esperar 'lista: UpdateReady' 30; Orden 'salir'; $null = Esperar 'salida: cierre ordenado' 15
    Start-Sleep 16
    Anotar 'S8' 'cierre ordenado con un programa abierto por la app' ((EnDisco) -eq '9.0.2') "en disco $(EnDisco)"
}
if (Corre 'S9') {
    Preparar 'pastilla' $Feed3
    Lanzar; $ok = Esperar 'arranque: version=9\.0\.3' 60
    Anotar 'S9' 'dos versiones atras y deltas anunciados que no estan' ($ok -and (EnDisco) -eq '9.0.3') "en disco $(EnDisco); velopack: $(DeVelopack 'falling back to full|Downloading full release')"
}
if ($ConGitHub -and (Corre 'S10')) {
    # Como quedaria toda la flota el dia que se revoque el token embebido: va identico en cada copia.
    $pubToken = Join-Path $Banco 'pub-token'; $feedToken = Join-Path $Banco 'feed-token'
    Publicar $pubToken @('-p:UpdateGithubToken=ghp_0000000000000000000000000000000000000000')
    Borrar $feedToken; Empaquetar '9.0.1' $feedToken $pubToken
    Preparar 'quieto' 'https://github.com/ZevCorp/U-Windows-App' $feedToken
    Lanzar; $null = Esperar 'update: (al d.a|no se pudo comprobar)' 45
    $rechazo = Linea 'GitHub rechaz'; $alDia = Linea 'update: al d.a'
    Anotar 'S10' 'token embebido que GitHub rechaza' ([bool]$rechazo -and [bool]$alDia) "dijo: $rechazo // $alDia $(Linea 'no se pudo comprobar')"
}
if ($ConGitHub -and (Corre 'S11')) {
    # El repositorio cambio de nombre el 2026-10-01. La app pregunta por el nombre de hoy y, si GitHub dice
    # que no existe (404), por el anterior: asi da igual en que orden salgan el cambio y la version.
    # Mientras los dos nombres resuelvan, este escenario solo comprueba que el feed de verdad contesta.
    Preparar 'quieto' 'https://github.com/ZevCorp/Miracle'
    Lanzar; $null = Esperar 'update: (al d.a|no se pudo comprobar)' 45
    $alDia = Linea 'update: al d.a'
    Anotar 'S11' 'el feed de GitHub contesta por el nombre de hoy o por el anterior' ([bool]$alDia) "dijo: $(Linea 'GitHub dice que') // $alDia $(Linea 'no se pudo comprobar')"
}
Matar

$resultados | Format-Table -AutoSize -Wrap | Out-String -Width 220 | Write-Host
$mal = @($resultados | Where-Object Veredicto -eq 'MAL').Count
$color = if ($mal -eq 0) { 'Green' } else { 'Red' }
Write-Host "BANCO: $($resultados.Count - $mal) de $($resultados.Count) escenarios bien$(if ($Viejo) { ' (modo VIEJO: se esperan 5 MAL - S2 S5 S6 S7 S8)' })" -ForegroundColor $color
exit $mal
