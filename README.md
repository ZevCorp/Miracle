# Ü — el monorepo

Todo Ü en un solo repo: los clientes de Windows, Mac y Android, el cerebro (Graph) y el portal
clínico (Miracle Notes). Una feature que cruza el portal y Windows es **una rama y un PR**, no dos
PRs en dos repos que hay que mergear a la vez.

| Carpeta | Qué es | Venía de |
|---|---|---|
| raíz: `windows-client/`, `windows-graph/`, `nucleo/`, `mapeador/`, `voz/`… | Ü para Windows | este mismo repo |
| `mac-client/` | Ü para Mac (Swift) | este mismo repo |
| `graph/` | el cerebro: API, LLM, memoria, Provider Studio (`graph-eight-pied.vercel.app`) | [`joseph1356k/Graph`](https://github.com/joseph1356k/Graph) |
| `android/` | Ü para Android (Kotlin) | [`ZevCorp/Android`](https://github.com/ZevCorp/Android) |
| `web/` | el portal clínico, Miracle Notes (Next.js) | [`joseph1356k/Pagina-web-clientes-final`](https://github.com/joseph1356k/Pagina-web-clientes-final) |

Cada carpeta importada entró el 2026-09-28 **con su historia entera**: `git log` y `git blame`
funcionan dentro de ella como en su repo de origen. Conserva su `README.md`, su `CLAUDE.md` y sus
reglas; lo único que se movió fue su CI, a `.github/workflows/` (GitHub no lee workflows en
subcarpetas).

Windows se quedó en la raíz, y no en una carpeta propia, a propósito: las Ü instaladas buscan sus
actualizaciones en las releases de este repo, y el contrato, los scripts y el CI dan por hechas esas
rutas. Moverlo habría roto el feed a cambio de simetría.

## Trabajar aquí

```powershell
git config core.hooksPath .githooks     # una vez por clon: activa el portero
```

El portero (`.githooks/pre-push`) sabe qué toca tu rama: compila .NET y juzga el contrato si tocas
Windows, llama al portero de Android si tocas `android/`, y no te pide nada de eso si solo tocas
`graph/` o `web/`. El CI de cada parte corre solo cuando su carpeta cambia.

Cómo se trabaja en la parte de Windows: [`CLAUDE.md`](CLAUDE.md). En las demás, el `CLAUDE.md` de
su carpeta.

## Windows (la raíz)

- `windows-client/` — frontend C#/WPF (.NET 8) → `U.exe`. Cliente "tonto": lee el
  árbol de UI (UIA), captura pantalla, ejecuta ratón/teclado y voz. Toda la
  inteligencia vive en el backend central **Graph** (`graph/`).
- `windows-graph/` — módulo C# de workflows sobre SAP GUI Scripting / UIA
  (grabar y reproducir), compilado dentro de `U.exe`. Habla con Graph.
- `backend/` — **LEGACY**: el cerebro TypeScript original (`u-windows-backend` en
  Vercel). Sus funcionalidades fueron absorbidas por el backend central Graph
  (`/api/v1/agent/turn`, `/api/v1/teach/*`). Se conserva solo como vía de
  emergencia (`U_BACKEND_URL`) mientras se verifica el corte; después se elimina.

El cliente consume Graph en `https://graph-eight-pied.vercel.app` con API key (`miracle_...`) en
`%APPDATA%\U\graph.json` o env `GRAPH_API_KEY`. Las keys se generan en el Provider Studio de Graph
(sección API keys).

```powershell
dotnet build windows-client/WindowsClient.csproj -c Debug
```

Release e instalador: ver `RELEASING-WINDOWS.md`. Runbook de producción: `PRODUCTION.md`.
Arquitectura y decisiones: `WINDOWS.md`.

## Flujo con Codex y Claude Code

El repo incluye pstack portable para ambos agentes. Usa `$pstack ...` en Codex o
`/pstack ...` en Claude Code. La instalación, actualización y la relación con las
skills SDD existentes están documentadas en [`docs/pstack.md`](docs/pstack.md).

## Historial

Este repo nació en 2026-07 de la separación del monorepo `ZevCorp/Android`, y el 2026-09-28 volvió
a ser monorepo, esta vez con Graph y el portal dentro. La historia previa a la separación está en
`android/` (el repo Android la conservaba). Los repos de origen se archivan, en solo lectura,
cuando los tres trabajemos aquí; lo que se les empuje mientras tanto se trae con
[`scripts/monorepo/importar.sh`](scripts/monorepo/importar.sh).
