<#
.SYNOPSIS
  Compila la carita y arma el paquete en LOCAL. No publica: publicar es lanzar el workflow.

.DESCRIPTION
  Deja en out\releases el instalador y el paquete, para instalarlos o mirarlos a mano. Las versiones
  que reciben los clientes las saca `windows-release.yml`. Ver RELEASING-WINDOWS.md.

.EXAMPLE
  .\scripts\publish-release.ps1 -Version 1.0.1
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Version,

    # false = el usuario necesita el runtime .NET 8 instalado, pero el paquete pesa ~10x menos.
    [bool]$SelfContained = $true
)

$ErrorActionPreference = "Stop"

$clientDir = Split-Path -Parent $PSScriptRoot
$repoDir   = Split-Path -Parent $clientDir
$publishDir = Join-Path $repoDir "out\assistant"
$releaseDir = Join-Path $repoDir "out\releases"

if (-not (Get-Command vpk -ErrorAction SilentlyContinue)) {
    throw "Falta la herramienta vpk. Instálala una vez con: dotnet tool install -g vpk"
}

Write-Host "==> Publicando U.exe (self-contained=$SelfContained)..." -ForegroundColor Cyan
# Sin PublishSingleFile a propósito: ScreenRecorderLib es un ensamblado mixto C++/CLI y no lo soporta
# (ver PRODUCTION.md). Velopack empaqueta la carpeta entera, así que no hace falta.
dotnet publish (Join-Path $clientDir "WindowsClient.csproj") `
    -c Release -r win-x64 --self-contained $SelfContained -o $publishDir
if ($LASTEXITCODE -ne 0) { throw "dotnet publish falló" }

Write-Host "==> Empaquetando version $Version..." -ForegroundColor Cyan
# Sin --channel: el default en Windows es "win", que es el que el cliente pide (releases.win.json).
# --icon: la carita/logo (mismo de Android) para Setup.exe y los accesos directos.
$iconPath = Join-Path $clientDir "U.ico"
vpk pack -u U -v $Version -p $publishDir -e U.exe -o $releaseDir --icon $iconPath
if ($LASTEXITCODE -ne 0) { throw "vpk pack falló" }

Write-Host ""
# ESTO YA NO PUBLICA NADA (2026-09-30): el feed son las releases de GitHub y las saca el workflow
# `windows-release.yml`, que ademas baja la release anterior para el delta. Decia «subi estos
# archivos al bucket de Supabase», que estuvo siempre vacio. Sirve para tener un paquete en local.
Write-Host "Paquete local listo (NO esta publicado: publicar es lanzar el workflow, ver RELEASING-WINDOWS.md):" -ForegroundColor Green
Get-ChildItem $releaseDir -Include "releases.win.json", "*.nupkg" -Recurse |
    ForEach-Object { "  - $($_.Name)  ($([math]::Round($_.Length / 1MB, 1)) MB)" }
Write-Host ""
Write-Host "Para un cliente NUEVO (primera instalación), mandale:" -ForegroundColor Green
# El nombre lo decide vpk y lleva el canal dentro: con el canal "win" por defecto sale
# U-win-Setup.exe, no U-Setup.exe.
Write-Host "  $releaseDir\U-win-Setup.exe"
