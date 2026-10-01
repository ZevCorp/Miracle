---
name: publica-windows
description: Publica una versión nueva de Ü para Windows para que les llegue sola a los equipos ya instalados — calcula la versión siguiente, redacta el mensaje que Ü les contará, lanza el workflow de release, comprueba la release y que una instalación de verdad la recibe. Úsala cuando el usuario diga "publica la actualización", "saca una versión de Windows", "que les llegue a los usuarios", "haz el release". No la uses para Android ni para la Mac, ni si lo que se quiere publicar todavía no está en main.
---

# Publicar una versión de Ü para Windows

Publicar es lanzar un workflow. Lo demás de esta skill es no publicar a ciegas: una versión rota le
llega a todos los equipos en media hora. La guía larga, con el porqué de cada cosa, es
[`apps/windows/RELEASING-WINDOWS.md`](../../../apps/windows/RELEASING-WINDOWS.md).

## 1. Antes de lanzar nada

- [ ] **Lo que se publica está en `main`.** El workflow compila `main`, no tu rama. Si el cambio no
      se ha mergeado, primero `/a-main`.
- [ ] **`main` está verde**: `gh run list --branch main --limit 5`.
- [ ] **La versión siguiente.** Mira la última publicada y súmale uno al último número:

      ```bash
      gh release view --json tagName --jq .tagName      # p. ej. v1.3.7 → la siguiente es 1.3.8
      ```

      **Las versiones solo suben.** Una Ü instalada no baja a un número menor: si se publicara
      `0.1.0` después de la `1.3.7`, ningún equipo ya instalado volvería a actualizarse, y no daría
      ningún error. Un salto hacia arriba (`1.4.0`, `2.0.0`) vale; hacia abajo, nunca.
- [ ] **El mensaje para la persona.** Es lo que Ü dice en voz alta al actualizarse: una o dos frases
      que cuenten qué cambia para ella, no una lista de commits. Si el usuario no lo dio, redáctalo
      a partir de lo que entró en `main` desde la release anterior y díselo antes de lanzar:

      ```bash
      git log --oneline v1.3.7..origin/main -- apps/windows
      ```

## 2. Si el cambio toca el actualizador o el workflow: ensaya primero

Cuando lo que se publica cambia `windows-client/src/Update/`, `App.xaml.cs` o `windows-release.yml`,
el error no se ve hasta que un equipo intenta actualizarse. Dos pruebas, las dos sin tocar a nadie:

```powershell
cd apps\windows
.\scripts\banco-de-actualizacion.ps1 -ConGitHub     # once caminos sobre una instalación de verdad
```

```bash
# el trabajo entero del workflow, publicado como pre-release que las Ü instaladas no ven
gh workflow run windows-release.yml --ref main -f version=1.3.8-ensayo.1 \
  -f request_id=ensayo-$(date +%Y%m%d) -f user_message="Ensayo interno." -f ensayo=true
```

El ensayo se borra al terminar: `gh release delete v1.3.8-ensayo.1 --cleanup-tag --yes`.

Para cualquier otro cambio, el ensayo sobra: el workflow ya comprueba lo que publica.

## 3. Lanzar

```bash
gh workflow run windows-release.yml --ref main \
  -f version=1.3.8 \
  -f request_id=<persona>-$(date +%Y%m%d)-<de-que-va> \
  -f user_message="<el mensaje para la persona>"

gh run watch $(gh run list --workflow windows-release.yml --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
```

Tarda unos cuatro minutos. Si el run sale rojo, **no hay release o está a medias**: lee el paso que
falló antes de relanzar. Se relanza con el MISMO número: el paso de subida va con `--merge`, que
completa una release que ya existe.

## 4. Comprobar la release

```bash
gh release view v1.3.8 --json isPrerelease,assets --jq '{isPrerelease, assets: [.assets[] | "\(.name) \(.size)"]}'
gh release view --json tagName --jq .tagName        # tiene que decir v1.3.8: es «la última»
```

Tiene que traer el paquete completo (`U-1.3.8-full.nupkg`), el delta (`U-1.3.8-delta.nupkg`), el
instalador (`U-win-Setup.exe`), el portable (`U-win-Portable.zip`), el índice (`releases.win.json`) y
el mensaje (`release-message.json`). Sin el delta la versión llega igual, pero cada equipo baja 80 MB
en vez de unos 6: el log del run dice por qué no lo hubo.

## 5. Comprobar que llega

Que la release exista no es que llegue. Mira que un equipo la recibe:

- **Con la telemetría** (proyecto `miracle-app` de Supabase), a partir de media hora después:

  ```sql
  select email, created_at, label from graph_windows_events
  where phase = 'update' and created_at > now() - interval '2 hours'
  order by created_at desc;
  ```

  Lo que se busca: `versión nueva disponible: 1.3.8`, y después `actualización aplicada: … → 1.3.8`.
  Una línea `la actualización NO se aplicó` trae la causa: léela, no la supongas.
- **Con una instalación de prueba**, si no hay equipos encendidos: el portable de la release anterior
  (`U-win-Portable.zip`), descomprimido fuera de `%LOCALAPPDATA%`, arrancado con `U_DATA_DIR` propio y
  un `config.json` sembrado. Al arrancar descarga la nueva; se cierra, se reabre, y aplica.
  **Nunca el `Setup.exe` desde una sesión de agente**: pisa el acceso directo y el registro del dueño.

## 6. Decírselo al usuario

En una línea: qué versión salió, con qué mensaje, y qué equipos ya la tienen. Y el enlace del
instalador para quien instala por primera vez:

```
https://github.com/ZevCorp/Miracle/releases/latest/download/U-win-Setup.exe
```

## Lo que nunca se hace

- Publicar un número menor o igual que el último.
- Borrar una release que ya recibió algún equipo: es la base del delta de la siguiente.
- Crear en `ZevCorp` otro repositorio llamado `U-Windows-App`: las Ü anteriores a la 1.3.7 preguntan
  por ese nombre, y solo llegan aquí porque GitHub lo redirige.
- Revocar el secreto `UPDATE_GITHUB_TOKEN` mientras queden equipos por debajo de la 1.3.7: ellos no
  saben seguir sin él.
- Publicar releases de otro producto en este repo: las Ü miran las diez más recientes.
