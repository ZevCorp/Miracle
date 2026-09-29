# Ü para Windows

El asistente de escritorio de Ü: aprende a operar aplicaciones mirando a un humano (el caso real es
SAP GUI en un hospital) y después las opera solo. Vive en `apps/windows/` del monorepo desde el
2026-09-28; todo lo de aquí se corre desde esta carpeta.

Cómo se trabaja en Windows (el ciclo, las promesas, el portero, los aprendizajes):
[`CLAUDE.md`](CLAUDE.md).

## Estructura

- `windows-client/` — frontend C#/WPF (.NET 8) → `U.exe`. Cliente "tonto": lee el árbol de UI
  (UIA), captura pantalla, ejecuta ratón/teclado y voz. Toda la inteligencia vive en el backend
  central **Graph** ([`services/graph/`](../../services/graph)).
- `windows-graph/` — módulo C# de workflows sobre SAP GUI Scripting / UIA (grabar y reproducir),
  compilado dentro de `U.exe`. Habla con Graph.
- `nucleo/`, `mapeador/`, `voz/` — el núcleo de navegación, el mapeador y la voz, cada uno con su
  contrato.
- `tests/` — el contrato del grafo (`tests/ContratoDelGrafo/Contrato.cs`).
- `scripts/` — compilar, verificar, los contratos, los entornos de desarrollo.
- `backend/` — **LEGACY**: el cerebro TypeScript original (`u-windows-backend` en Vercel). Sus
  funcionalidades fueron absorbidas por Graph (`/api/v1/agent/turn`, `/api/v1/teach/*`). Se conserva
  como vía de emergencia (`U_BACKEND_URL`) y por los recordatorios que aún sirve.
- `docs/` — specs, diseño y diagnósticos de Windows.
- `agente-piloto/`, `piloto/`, `laboratorio/`, `sondas/`, `puente-omi/` — herramientas y
  experimentos de Windows.

## Backend

El cliente consume Graph en `https://graph-eight-pied.vercel.app` con API key (`miracle_...`) en
`%APPDATA%\U\graph.json` o env `GRAPH_API_KEY`. Las keys se generan en el Provider Studio de Graph
(sección API keys).

## Build

```powershell
dotnet build windows-client/WindowsClient.csproj -c Debug
```

Release e instalador: [`RELEASING-WINDOWS.md`](RELEASING-WINDOWS.md). Las Ü instaladas se actualizan
desde las releases de GitHub de este repo; por eso ningún otro producto publica releases aquí
(ver [`AGENTS.md`](../../AGENTS.md)). Runbook de producción: `PRODUCTION.md`. Arquitectura y
decisiones: `WINDOWS.md` (ambos anteriores al monorepo: los revisa la fase 2).
