---
name: publica-windows
description: Publica una versión de Ü para Windows sin sorpresas — qué entra desde la última release, el banco de actualización con Velopack (y su sabotaje), un ensayo como pre-release, la publicación real con un mensaje humano, la comprobación de los archivos de la release, y a quién le llegó de verdad según Graph. Úsala cuando el usuario diga "saca una versión", "publica Windows", "release", "distribuir la app", "manda la actualización", "¿le llegó la actualización a X?", o cuando haya que confirmar qué versión corre cada equipo.
---

# Publicar Ü para Windows

Las Ü instaladas se actualizan solas desde las **releases de este repo** (Velopack, las 10 más
recientes). Publicar le llega a médicos en un hospital: es una acción hacia fuera, y **la publicación
real la confirma el usuario**, con la versión y el mensaje delante.

Lo que ya falló: el índice publicado sin el `.nupkg` (los clientes fallaban cada 30 min), todos los
equipos diciendo `1.0.0.0`, deltas prometidos que no existían, un `422` por falta de `user_message`,
un 403 por permisos del token, y una versión que se bajaba y no se aplicaba porque un programa abierto
por Ü tenía la carpeta `current` como carpeta de trabajo. Releases de GitHub: **solo Windows**; otra
cosa publicada aquí empujaría fuera de la ventana de 10 a las versiones de Windows.

## 1. Qué entra

```bash
git fetch origin --tags
ultima=$(git describe --tags --abbrev=0 origin/main --match 'v*')        # o la última release (gh release list -L 1)
git log --oneline "$ultima"..origin/main -- apps/windows
```

Si no hay commits de `apps/windows`, no hay versión que sacar: dilo. Si los hay, propón la versión
(SemVer: parche para arreglos, menor para funciones) y un **`user_message` para la persona**: qué
puede hacer ahora o qué deja de pasarle, en una o dos frases, sin nombres de commits. Ü lo lee en
voz alta al actualizarse.

## 2. El banco, en Windows

```powershell
cd apps\windows
.\scripts\banco-de-actualizacion.ps1            # todos los escenarios BIEN
.\scripts\banco-de-actualizacion.ps1 -Viejo     # el sabotaje: cinco MAL (S2 S5 S6 S7 S8)
.\scripts\banco-de-actualizacion.ps1 -ConGitHub # si cambió algo del token o del feed
```

Instala una sonda con otro id de paquete en `C:\U-banco`: no toca la Ü instalada. 99 = el banco no
se pudo montar (no es un rojo). Si el cambio no toca `windows-client/src/Update` ni nada que lance
procesos, el banco se puede saltar: dilo en la evidencia como ⚪ y por qué.

## 3. El ensayo

```bash
gh workflow run windows-release.yml -f version=<X.Y.Z> -f request_id=ensayo-<fecha> \
   -f user_message="<el mensaje>" -f ensayo=true
gh run watch "$(gh run list -w windows-release.yml -L 1 --json databaseId -q '.[0].databaseId')"
```

Sin `gh`: herramienta `actions_run_trigger` del MCP de GitHub (workflow `windows-release.yml`,
mismos inputs) y `actions_list` para seguirlo. El ensayo hace el trabajo **entero** (compila con los
secretos, baja la anterior, empaqueta con delta, sube y comprueba) y publica una **pre-release**, que
las Ü instaladas no ven. `dry_run` no prueba nada de lo que puede fallar: no lo uses para esto.
Cuando el ensayo esté verde, **borra la pre-release** (`gh release delete v<X.Y.Z> --yes --cleanup-tag`).

## 4. La de verdad — con el sí del usuario

Enséñale versión, mensaje y resultado del ensayo, y espera su confirmación. Después, el mismo
comando sin `ensayo`. También se puede lanzar desde **Provider Studio → Distribuir App**, que pide el
mensaje (ojo: la producción de Graph todavía sale del repo viejo).

## 5. Comprobar la release

```bash
gh release view v<X.Y.Z> --json isPrerelease,assets --jq '.isPrerelease, (.assets[].name)'
```

Tiene que traer `releases.win.json`, el `.nupkg` **completo**, el **delta** (`-delta.nupkg`),
`release-message.json` y `U-win-Setup.exe`, y no ser pre-release. Las releases viejas **se quedan**:
son la base de los deltas.

## 6. A quién le llegó — un rato después

Con el MCP de Supabase (`execute_sql`, solo lectura) en `miracle-app`:

```sql
select email, machine_name, app_version, last_seen_at
from public.graph_windows_users order by last_seen_at desc;

select email, created_at, label from public.graph_windows_events
where phase = 'update'
  and (label like 'actualización aplicada%' or label like 'la actualización NO se aplicó%')
order by created_at desc limit 50;
```

El informe al usuario: «vX.Y.Z publicada a las HH:MM. Ya la corren N de M equipos vistos en las
últimas 24 h; a K no se les aplicó: <motivo literal del log>». Un equipo que no aparece no es «sin
actualizar»: es «no visto», y se dice así. Para un equipo concreto, su log (`/lee-el-log`, tag
`update`) y el de Velopack (`%LOCALAPPDATA%\velopack\velopack_U.log`).
