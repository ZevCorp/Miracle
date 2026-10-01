# GRAPHIFY EN ESTE PC, de una vez y igual para todos (Windows). En Mac o Linux: tools/graphify/instalar.sh
#
#     powershell -ExecutionPolicy Bypass -File tools\graphify\instalar.ps1
#     powershell -ExecutionPolicy Bypass -File tools\graphify\instalar.ps1 -Proyectos apps/windows
#
# Qué deja hecho, y se puede correr las veces que haga falta:
#   1. uv (el instalador de herramientas de Python) y graphify, en la MISMA versión para todos: un
#      mapa hecho con otra versión da otros nodos, y dos personas dejan de ver el mismo mapa.
#   2. El portero activado (core.hooksPath .githooks). Con él llegan los ganchos que rehacen el mapa
#      tras cada commit, cambio de rama y pull (tools/graphify/refrescar.sh).
#   3. El mapa de cada proyecto, construido aquí. No usa IA ni cuesta nada: lee el código.
#
# Por qué un script y no cinco comandos en un README (2026-10-01): la primera instalación en este
# equipo falló dos veces. No había Python; y dentro de la app de Claude, que corre empaquetada,
# Windows desvía lo que se escribe en AppData y uv rompía su propio Python («Missing expected target
# directory for Python minor version link»). El arreglo —sacar a uv de AppData— está aquí para que
# nadie lo redescubra.
param(
    [string[]]$Proyectos = @(),
    [switch]$SinMapas
)

$ErrorActionPreference = 'Stop'
$Version = '0.9.71'   # la misma que .github/workflows/graphify-impacto.yml y instalar.sh

function Paso($t) { Write-Host "`n── $t" -ForegroundColor Cyan }
function RefrescarPath {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + [Environment]::GetEnvironmentVariable('Path', 'Machine')
}

$raiz = (& git rev-parse --show-toplevel 2>$null)
if (-not $raiz) { Write-Host "Corre esto dentro del repo." -ForegroundColor Red; exit 1 }
Set-Location $raiz

Paso "1/3 · uv y graphify $Version"
RefrescarPath
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Host "   uv no está: se instala con winget."
    & winget install --id astral-sh.uv -e --accept-source-agreements --accept-package-agreements --silent | Out-Host
    RefrescarPath
    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
        Write-Host "   ✘ uv no quedó en el PATH. Abre una terminal nueva y vuelve a correr este script." -ForegroundColor Red
        exit 1
    }
}

function InstalarGraphify {
    # Sin 2>&1: en PowerShell 5.1 redirigir el stderr de un .exe convierte cada línea en un error.
    $salida = & cmd /c "uv tool install graphifyy==$Version --python 3.12 2>&1"
    $script:UltimaSalida = ($salida | Out-String)
    return $LASTEXITCODE -eq 0
}

$actual = ''
if (Get-Command graphify -ErrorAction SilentlyContinue) { $actual = ((& graphify --version) -replace '[^0-9.]', '') }
if ($actual -eq $Version) {
    Write-Host "   ✔ graphify $Version ya está."
} else {
    if (-not (InstalarGraphify)) {
        if ($UltimaSalida -match 'Missing expected target directory') {
            # La app de Claude (empaquetada) desvía AppData. uv fuera de AppData, para este usuario.
            Write-Host "   uv no puede usar AppData desde aquí: se mueve a %USERPROFILE%\.local\share\uv."
            $base = "$env:USERPROFILE\.local\share\uv"
            foreach ($par in @(@('UV_PYTHON_INSTALL_DIR', "$base\python"), @('UV_TOOL_DIR', "$base\tools"), @('UV_CACHE_DIR', "$base\cache"))) {
                [Environment]::SetEnvironmentVariable($par[0], $par[1], 'User')
                Set-Item -Path "env:$($par[0])" -Value $par[1]
            }
            if (-not (InstalarGraphify)) { Write-Host $UltimaSalida; Write-Host "   ✘ graphify no se pudo instalar." -ForegroundColor Red; exit 1 }
        } else {
            Write-Host $UltimaSalida; Write-Host "   ✘ graphify no se pudo instalar." -ForegroundColor Red; exit 1
        }
    }
    & uv tool update-shell | Out-Null
    RefrescarPath
    Write-Host "   ✔ graphify $Version instalado."
}
if (-not (Get-Command graphify -ErrorAction SilentlyContinue)) {
    Write-Host "   ✘ graphify está instalado pero no en el PATH. Abre una terminal nueva y vuelve a correr este script." -ForegroundColor Red
    exit 1
}

Paso "2/3 · el portero y los ganchos del mapa"
& git config core.hooksPath .githooks
Write-Host "   ✔ core.hooksPath = .githooks (el mapa se rehace solo tras commit, cambio de rama y pull)."

Paso "3/3 · el mapa de cada proyecto"
if ($SinMapas) {
    Write-Host "   (saltado con -SinMapas)"
} else {
    if ($Proyectos.Count -eq 0) {
        # Todos menos Mac: desde Windows no se trabaja en apps/mac (.claude/rules/solo-mac.md).
        $Proyectos = @(Get-ChildItem apps, services -Directory | Where-Object { $_.Name -ne 'mac' } |
            ForEach-Object { ($_.FullName.Substring($raiz.Length + 1)) -replace '\\', '/' })
    }
    $env:PYTHONHASHSEED = '0'
    foreach ($p in $Proyectos) {
        if (-not (Test-Path $p)) { Write-Host "   ✘ $p no existe." -ForegroundColor Red; continue }
        $t = Measure-Command { Push-Location $p; $fin = (& cmd /c "graphify update . 2>&1" | Select-String 'Rebuilt' | Select-Object -Last 1); Pop-Location }
        if (Test-Path "$p\graphify-out\graph.json") {
            Write-Host ("   ✔ {0,-16} {1,5:N0} s  {2}" -f $p, $t.TotalSeconds, ("$fin" -replace '.*Rebuilt: ', ''))
        } else {
            Write-Host "   ✘ ${p}: graphify no dejó mapa. Córrelo a mano dentro de la carpeta: graphify update ." -ForegroundColor Red
        }
    }
}

Write-Host "`nListo. Lo que más rinde:" -ForegroundColor Green
Write-Host "   bash tools/graphify/impacto.sh          a quién afecta tu rama (pégalo en el PR)"
Write-Host "   graphify affected `"Clase`"               quién depende de una pieza   (dentro de apps/<proyecto>)"
Write-Host "   La guía: docs/herramientas/README-GRAPHIFY.md"
