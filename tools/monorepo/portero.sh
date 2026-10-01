#!/usr/bin/env bash
# EL MOTOR DE LOS PORTEROS. Las cuatro comprobaciones que separan una rama del remoto, iguales en
# cada proyecto; lo que cambia de uno a otro —qué es código, qué es una promesa, cómo se compila y
# cómo se juzga— lo declara su <proyecto>/.githooks/pre-push, que termina cargando este archivo:
#
#     NOMBRE="Graph"
#     CODIGO=('src' 'web/api' 'web/server.js')          # el código de producción
#     PROMESAS=('scripts/verify-*.js' 'tests')          # lo que cuenta como promesa propia de la rama
#     DONDE_PROMESAS="un scripts/verify-<slug>.js, con su fila en docs/specs/"
#     JUICIO=('src' 'scripts' 'docs/specs')             # lo que cambia el veredicto (por defecto, la carpeta entera)
#     preparar() { npm ci --no-audit --no-fund; }       # opcional: lo que pide un árbol recién sacado
#     compilar() { :; }                                 # opcional: nivel 1
#     juzgar()   { node scripts/contrato.js; }          # nivel 2: imprime el veredicto
#     . "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)/tools/monorepo/portero.sh"
#
# Las rutas son pathspecs de git relativos a la carpeta del proyecto, y las funciones corren con
# esa carpeta (la del árbol que se juzga) como directorio actual.
#
#   0. a main no se empuja directo;
#   1. compila;
#   2. el contrato está intacto: juzgar sale con 0 y su salida contiene «CONTRATO INTACTO» (o lo que
#      diga VEREDICTO_OK);
#   3. la rama trae su propia promesa: si cambia CODIGO y no toca PROMESAS, no pasa. Se exime a
#      chore/, docs/, refactor/ y hotfix/, que por definición no añaden comportamiento.
#
# Juzga LO QUE SE EMPUJA, no el árbol de trabajo (el motor nació del portero de Android, que ya lo
# hacía). Git le pasa por stdin una línea por ref: <local_ref> <local_sha> <remote_ref> <remote_sha>.
#   - Si lo que se empuja es HEAD y el árbol no tiene nada sin commitear que cambie el veredicto, se
#     juzga aquí mismo: es el camino de todos los días, y no recompila desde cero.
#   - Si no (cambios sin commitear en JUICIO, o se empuja otra rama), el commit se saca a un árbol
#     temporal y se juzga allí. Tarda más, y lo dice. Un cambio sin commitear no puede darle verde
#     a un commit que no lo trae, ni un archivo sin `git add` dejar pasar un commit que no compila.
# Se prueba sin empujar:
#     printf 'refs/heads/<rama> %s refs/heads/<rama> 0\n' "$(git rev-parse HEAD)" | bash <proyecto>/.githooks/pre-push
# Sin stdin (corrido a mano) juzga HEAD con el árbol tal como está, y lo avisa.
#
# Un proyecto que esta máquina no puede juzgar (la Mac fuera de macOS) define se_puede_juzgar, que
# imprime el motivo y devuelve ≠0: los niveles 1 y 2 quedan para su CI, y el 3 se comprueba igual.

set -u

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
gris()  { printf '\033[90m%s\033[0m\n' "$*"; }

: "${VEREDICTO_OK:=CONTRATO INTACTO}"
# ${JUICIO+x} y no ${#JUICIO[@]}: el bash 3.2 de macOS da «unbound variable» al medir un array sin definir.
# Sin JUICIO, cuenta la carpeta entera del proyecto: es el valor que no se equivoca. Acotarlo es una
# optimización que cada proyecto declara sabiendo qué deja fuera (el contrato de la raíz lo cazó el
# 2026-09-30: con CODIGO y PROMESAS por defecto, un arreglo sin commitear en otro archivo daba verde).
[ -n "${JUICIO+x}" ] || JUICIO=('.')
: "${DONDE_PROMESAS:=en el contrato del proyecto}"
declare -F preparar > /dev/null || preparar() { :; }
# Un proyecto sin paso de compilación (Graph) no define compilar, y el portero no dice «compila».
compila=si; declare -F compilar > /dev/null || compila=no

# El proyecto es la carpeta que contiene el .githooks/ de quien carga este archivo. Se ubica por su
# ruta, no por un nombre escrito aquí: mover el proyecto no deja al portero mirando al vacío.
proyecto="$(cd "$(dirname "${BASH_SOURCE[1]}")/.." && pwd)"
raiz="$(git -C "$proyecto" rev-parse --show-toplevel)"
pro="$(git -C "$proyecto" rev-parse --show-prefix)"; pro="${pro%/}"

# Git exporta GIT_DIR y compañía a los hooks; dentro del árbol temporal apuntarían al repo de afuera.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

fallos=0

# ¿Puede esta máquina compilar y juzgar este proyecto? Si no, se dice y los niveles 1 y 2 van al CI.
aqui_no=""
if declare -F se_puede_juzgar > /dev/null && ! aqui_no="$(se_puede_juzgar)"; then
  [ -n "$aqui_no" ] || aqui_no="esta máquina no puede juzgarlo"
else
  aqui_no=""
fi

# Todo lo temporal vive en un solo directorio y se borra al salir pase lo que pase: verde, rojo o
# Ctrl-C. Un árbol olvidado deja el sha «ocupado» para el siguiente push.
tmp="$(mktemp -d "${TMPDIR:-/tmp}/portero.XXXXXX")" || { rojo "  ✘  no se pudo crear el directorio temporal"; exit 1; }
limpiar() {
  local arbol
  for arbol in "$tmp"/arbol-*; do
    [ -d "$arbol" ] && git -C "$raiz" worktree remove --force "$arbol" > /dev/null 2>&1
  done
  rm -rf "$tmp"
  git -C "$raiz" worktree prune > /dev/null 2>&1
}
trap limpiar EXIT
trap 'exit 130' INT TERM HUP

a_main() {
  rojo "  ✘  a main no se empuja directo"
  echo "     Haz tu rama, empújala, y abre el PR:"
  echo "         git switch -c <persona>/<que-hace>"
  echo
  exit 1
}

# Lo del árbol de trabajo que cambiaría el veredicto y no está en el commit.
sin_commitear() {
  git -C "$proyecto" status --porcelain --untracked-files=all -- "${JUICIO[@]}"
}

# ── 1 y 2. compila y el contrato, en <dir> ───────────────────────────────────────────────────
construir() {
  local dir="$1" log="$2" salida codigo linea

  if [ "$compila" = si ]; then
    gris "  … compilando"
    if (cd "$dir" && compilar) > "$log" 2>&1; then
      verde "  ✔  compila"
    else
      rojo  "  ✘  NO compila"
      if grep -qE "error |^e: |error:" "$log"; then
        grep -E "error |^e: |error:" "$log" | head -5 | sed 's/^/     /'
      else
        tail -5 "$log" | sed 's/^/     /'
      fi
      fallos=$((fallos+1))
      return   # sin compilar no hay nada que juzgar: un contrato rojo por eso no dice nada
    fi
  fi

  # No son «tests» genéricos: son las promesas que el sistema dice cumplir. Rojo aquí significa que
  # algo que prometíamos dejó de ser cierto, y eso no entra en main aunque compile.
  gris "  … el contrato"
  salida="$(cd "$dir" && juzgar 2>&1)"
  codigo=$?
  if [ "$codigo" -eq 0 ] && printf '%s' "$salida" | grep -qE "$VEREDICTO_OK"; then
    # $'…' y no '\x1b': el sed de macOS no entiende el escape hexadecimal.
    printf '%s\n' "$salida" | grep -E "$VEREDICTO_OK" | sed $'s/\033\\[[0-9;]*m//g' | while IFS= read -r linea; do
      verde "  ✔  $(printf '%s' "$linea" | sed 's/^ *//' | cut -c1-110)"
    done
  else
    rojo  "  ✘  CONTRATO ROTO"
    if printf '%s' "$salida" | grep -qE "✘|⧗|ROTO|incumplid|NO SE PUDO"; then
      printf '%s\n' "$salida" | grep -E "✘|⧗|ROTO|incumplid|NO SE PUDO" | head -8 | cut -c1-160 | sed 's/^/     /'
    else
      # El juez no dijo ni «roto»: no llegó a juzgar. Se enseña lo que dijo, no una conclusión.
      gris "     el juez salió con código $codigo y sin veredicto. Lo último que dijo:"
      printf '%s\n' "$salida" | tail -6 | cut -c1-160 | sed 's/^/     /'
    fi
    fallos=$((fallos+1))
  fi
}

# ── 3. la funcionalidad trae su propia promesa ───────────────────────────────────────────────
# Es lo que hace crecer el contrato SOLO, en vez de por disciplina.
trae_promesa() {
  local rev="$1" rama="$2" base codigo promesas
  case "$rama" in
    chore/*|docs/*|refactor/*|hotfix/*)
      gris "  ·  promesa propia: no se exige en «${rama%%/*}/»"
      return ;;
  esac
  if git -C "$raiz" rev-parse -q --verify origin/main > /dev/null; then base="origin/main"
  elif git -C "$raiz" rev-parse -q --verify main > /dev/null; then base="main"
  else
    rojo "  ✘  no hay origin/main ni main: no hay contra qué saber si la rama trae su promesa"
    echo "     Trae la base y vuelve a empujar:  git fetch origin main"
    fallos=$((fallos+1))
    return
  fi
  if ! codigo="$(git -C "$proyecto" diff --name-only "$base...$rev" -- "${CODIGO[@]}" 2>&1)" \
     || ! promesas="$(git -C "$proyecto" diff --name-only "$base...$rev" -- "${PROMESAS[@]}" 2>&1)"; then
    rojo "  ✘  no se pudo comparar $base...${rev:0:9}: no se sabe si trae su promesa"
    printf '%s\n' "$codigo" | head -2 | sed 's/^/     /'
    fallos=$((fallos+1))
    return
  fi
  codigo="$(printf '%s' "$codigo" | grep -c .)"
  promesas="$(printf '%s' "$promesas" | grep -c .)"
  if [ "$codigo" -gt 0 ] && [ "$promesas" -eq 0 ]; then
    rojo "  ✘  esta rama cambia código y no añade ninguna promesa"
    echo "     $codigo archivo(s) de código, 0 de contrato (contra $base)."
    echo "     Añade lo que esta funcionalidad promete: $DONDE_PROMESAS"
    echo "     —o renómbrala a chore/ o refactor/ si de verdad no cambia comportamiento."
    fallos=$((fallos+1))
  else
    verde "  ✔  trae su propia promesa"
  fi
}

refs=""
[ -t 0 ] || refs="$(cat)"

echo
echo "  ── el portero de $NOMBRE ──────────────────────"
echo
inicio=$SECONDS

if [ -z "$refs" ]; then
  # ── corrido a mano: no hay refs, se juzga HEAD con el árbol de trabajo tal como está ─────────
  gris "  ·  sin refs por stdin (corrido a mano): se juzga HEAD y el árbol de trabajo, no lo que se empujaría"
  rama="$(git -C "$raiz" rev-parse --abbrev-ref HEAD)"
  [ "$rama" = "main" ] && a_main
  if [ -n "$aqui_no" ]; then
    gris "  ·  compila y contrato: $aqui_no. Los juzga el CI en el PR."
  else
    construir "$proyecto" "$tmp/build.log"
  fi
  trae_promesa HEAD "$rama"
else
  # ── 0. a main no se empuja directo: antes de compilar nada ───────────────────────────────────
  while read -r _ _ remote_ref _; do
    [ "$remote_ref" = "refs/heads/main" ] && a_main
  done <<< "$refs"

  cabeza="$(git -C "$raiz" rev-parse HEAD)"
  juzgados=" "
  while read -r _ local_sha remote_ref _; do
    [ -n "${local_sha:-}" ] || continue
    rama="${remote_ref#refs/heads/}"
    echo "  $rama ← ${local_sha:0:9}"
    if [[ "$local_sha" =~ ^0+$ ]]; then
      gris "  ·  borrado de la rama remota: no hay nada que compilar"
      echo
      continue
    fi
    # Lo que se empuja no cambia nada de lo que decide el veredicto: solo documentación, o nada de
    # este proyecto (otra rama del mismo push). Compilar y juzgar daría lo mismo que en main, que ya
    # pasó su compuerta, y un .md no tiene por qué costar dos minutos de compilación. Si git no
    # puede comparar, no se salta nada: se juzga.
    if git -C "$raiz" rev-parse -q --verify origin/main > /dev/null \
       && git -C "$proyecto" diff --quiet "origin/main...$local_sha" -- "${JUICIO[@]}" 2> /dev/null; then
      gris "  ·  no toca nada que cambie el veredicto de $NOMBRE: no se compila ni se juzga"
      echo
      continue
    fi
    # Un mismo sha empujado a dos refs se juzga una vez; la promesa propia depende de la rama.
    case "$juzgados" in
      *" $local_sha "*) gris "  ·  compila y contrato: ya juzgado arriba" ;;
      *)
        if [ -n "$aqui_no" ]; then
          gris "  ·  compila y contrato: $aqui_no. Los juzga el CI en el PR."
          juzgados="$juzgados$local_sha "
          trae_promesa "$local_sha" "$rama"
          echo
          continue
        fi
        pendiente="$(sin_commitear)"
        if [ "$local_sha" = "$cabeza" ] && [ -z "$pendiente" ]; then
          construir "$proyecto" "$tmp/build-${local_sha:0:12}.log"
        else
          if [ "$local_sha" != "$cabeza" ]; then
            gris "  ·  lo que se empuja no es HEAD: se juzga en un árbol temporal (tarda más)"
          else
            gris "  ·  hay $(printf '%s\n' "$pendiente" | grep -c .) cambio(s) sin commitear que tocan el veredicto: el commit se juzga"
            gris "     en un árbol temporal (tarda más). Para el camino rápido, commitéalos o  git stash -u"
            printf '%s\n' "$pendiente" | head -3 | sed 's/^/       /'
          fi
          arbol="$tmp/arbol-${local_sha:0:12}"
          if git -C "$raiz" worktree add --detach --quiet "$arbol" "$local_sha" > "$tmp/worktree.log" 2>&1; then
            if (cd "$arbol/$pro" && preparar) > "$tmp/preparar.log" 2>&1; then
              construir "$arbol/$pro" "$tmp/build-${local_sha:0:12}.log"
            else
              rojo "  ✘  no se pudo preparar el árbol temporal: no hay veredicto"
              tail -4 "$tmp/preparar.log" | sed 's/^/     /'
              fallos=$((fallos+1))
            fi
          else
            rojo "  ✘  no se pudo abrir ${local_sha:0:9} en un árbol temporal: no hay veredicto"
            head -3 "$tmp/worktree.log" | sed 's/^/     /'
            fallos=$((fallos+1))
          fi
        fi
        juzgados="$juzgados$local_sha "
        ;;
    esac
    trae_promesa "$local_sha" "$rama"
    echo
  done <<< "$refs"
fi

echo
if [ "$fallos" -gt 0 ]; then
  rojo "  $NOMBRE no entra: $fallos comprobación(es) en rojo  ($((SECONDS-inicio)) s)"
  echo
  gris "  Si crees que el portero se equivoca, la conversación es sobre la promesa,"
  gris "  no sobre saltarse el hook."
  echo
  exit 1
fi

verde "  $NOMBRE en verde  ($((SECONDS-inicio)) s)"
echo
exit 0
