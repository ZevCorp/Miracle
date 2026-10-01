---
name: ci-rojo
description: Diagnostica un PR con la compuerta en rojo — encuentra qué trabajo falló (raiz, cambios, windows, android, mac, web, graph), lee su log, lo reproduce en local con el mismo comando, y separa "mi cambio lo rompió" de "diferencia de máquina" y de "main ya estaba rojo", sin saltarse tests ni relanzar a ciegas. Úsala cuando el usuario diga "el CI está rojo", "falló la compuerta", "no me deja mergear", "el check falla", "en local pasa y en el CI no", pegue un enlace a un run de GitHub Actions, o cuando llegue un evento de CI fallido de un PR.
---

# La compuerta en rojo

`main` exige un solo check: **`compuerta`** (`.github/workflows/monorepo.yml`). Corre en todo PR,
mira qué proyectos toca y llama al CI de cada uno. Si `compuerta` está roja, **otro trabajo** lo
está: ese es el que hay que leer.

| Trabajo | Qué corre | Se reproduce con |
|---|---|---|
| `raiz` | `comprobar-raiz.sh`, `bash -n` de ganchos y scripts, el contrato de la raíz | `bash tools/monorepo/comprobar-raiz.sh && bash tools/monorepo/contrato.sh` |
| `cambios` | qué proyectos toca el PR (API de GitHub) | — si falla, no se juzgó nada: vuelve a correr una vez |
| `windows` → `windows-contrato.yml` | `contrato-del-grafo.ps1` y `contrato-de-la-voz.ps1` en Windows con .NET 8 | en Windows: los mismos scripts |
| `android` → `android-apk.yml` | JDK 17, `./scripts/contrato.sh`, `assembleRelease` | `cd apps/android && ./scripts/contrato.sh && ./gradlew :app:assembleRelease` |
| `mac` → `mac-build.yml` | macos-15: `./contrato.sh release`, `./build.sh release` | en un Mac; fuera, `./contrato.sh --cruce` |
| `web` → `web-ci.yml` | Node 20: `npm install`, lint, typecheck, test, build | `bash .claude/skills/verifica-web/scripts/ci_local.sh` |
| `graph` → `graph-ci.yml` | Node 24: `npm ci`, `npm test` | `cd services/graph && npm ci && npm test` |

Un proyecto que el PR no toca sale `skipped`, y eso es verde. Si cambia `monorepo.yml`, se llaman
todos.

## 1. Qué falló, literal

Con `gh` (en la máquina del usuario):

```bash
gh pr checks <número>
gh run view <run-id> --log-failed | tail -80
```

Sin `gh` (sesión en la nube): MCP de GitHub — `pull_request_read` para el estado de los checks del
PR, `actions_list` para los runs y `get_job_logs` con solo los trabajos fallidos.

Copia la línea de error **literal**, con el paso (step) en el que salió.

## 2. ¿Es mío?

En este orden:

1. **¿`main` está rojo en el mismo trabajo?** (el último run de `monorepo.yml` en `main`). Si sí,
   no es tu PR: busca el arreglo (un PR abierto, el commit que lo rompió) y dilo; si existe, se
   puede portar a tu rama.
2. **¿Tu diff toca lo que falla?** Si el error está en un archivo o una promesa de tu cambio: es tuyo,
   y es `/juez-rojo` o el código.
3. **¿Pasa en local con el mismo comando?** Si sí, es una **diferencia de máquina**, y encontrarla
   es el trabajo. Nunca «cosa del CI».

## 3. Las diferencias de máquina que ya salieron

| Síntoma | Causa | Arreglo |
|---|---|---|
| en Windows pasa, en Linux no encuentra el archivo | Linux distingue mayúsculas en las rutas | el nombre exacto del archivo |
| un test que lee fuentes falla en un lado | CRLF contra LF | normaliza la lectura (`replace("\r\n", "\n")`) |
| `setup-android` falla instalando `tools` | paquete que ya no existe | `packages: platform-tools` |
| Swift en el runner rechaza algo que compila en tu Mac | otra versión de Xcode/Swift (p. ej. `[weak self]` dentro de `Task { @MainActor … }` en 5.10) | escribirlo compatible con la versión del runner |
| el portal compila en local y no en CI | Node 22 local contra 20 en CI; o tu `.env.local` | `ci_local.sh` usa las variables del CI y aparta `.env.local` |
| `npm ci` falla en el portal | el lock se genera en Windows | el workflow usa `npm install` a propósito; no lo cambies |
| un paso de release da 403 «Resource not accessible by integration» | permisos del `GITHUB_TOKEN` | `permissions: contents: write` en el workflow |
| la 22 de Graph sale ⏭ | necesita Postgres | no es un rojo; ya está nombrada en el veredicto |
| un script `.sh` no corre en macOS | bash 3.2 (arrays vacíos con `set -u`, `${var,,}`), `sed -i` distinto | escribirlo para bash 3.2 |
| algo del portero solo falla al empujar desde un árbol | `GIT_DIR` puesto dentro del gancho | `unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE` |

## 4. Arreglar y empujar

- Reproduce el fallo en local **antes** de arreglarlo, y ve el mismo comando en verde después.
- Arreglo mínimo: lo que el fallo pide, sin ensanchar el PR.
- **Nunca** se salta, silencia o pone en cuarentena un test; nunca un commit vacío ni cerrar y
  reabrir para relanzar. Relanzar solo una vez, y solo si el trabajo murió antes de correr un test
  (checkout, instalación, runner perdido). Un segundo rojo igual es real.
- En `main`, después de mergear, Graph y el portal se despliegan solos con prueba de humo: si el
  humo falla, `vercel-desplegar.yml` hace rollback y el trabajo sale rojo. Eso es un rojo de
  producción: lee el log del humo (`/api/health` en Graph) antes de tocar nada.

## 5. Al usuario

Una línea por trabajo rojo: qué trabajo, qué paso, la línea literal, si es tuyo / de máquina / de
`main`, y qué empujaste o qué propones.
