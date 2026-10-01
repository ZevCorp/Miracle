#!/usr/bin/env bash
# UN AGENTE, UN ÁRBOL. Así como dos personas no comparten rama, dos agentes no comparten árbol de
# trabajo (git worktree): el `git switch` de uno le cambia la rama al otro debajo de los pies, y un
# `git add -A` se lleva los cambios ajenos a su commit.
#
# Por qué existe (2026-09-30): el dueño trabajaba con varios agentes a la vez y las ~40 sesiones de
# su app se abrían en la MISMA carpeta. Que no se pisaran dependía de que a cada agente se le
# ocurriera hacerse un worktree: la regla decía «git checkout -b», que en una carpeta compartida es
# justo el accidente. Esto lo convierte en una herramienta y en un guardia.
#
#   bash tools/monorepo/arbol.sh nuevo <persona>/<que-hace>   crea la rama desde main fresco EN SU
#                                                             PROPIO ÁRBOL, y lo deja a tu nombre
#   bash tools/monorepo/arbol.sh estado                       quién está en qué árbol
#   bash tools/monorepo/arbol.sh tomar                        este árbol pasa a ser de esta sesión
#                                                             (seguir el trabajo de una que ya terminó)
#   bash tools/monorepo/arbol.sh soltar                       esta sesión deja libre este árbol
#   bash tools/monorepo/arbol.sh cerrar [<rama>]              el trabajo terminó: borra el árbol y la
#                                                             rama (sin <rama>, los de donde estás)
#   bash tools/monorepo/arbol.sh limpiar                      cierra TODOS los árboles y ramas terminados
#   bash tools/monorepo/arbol.sh guardia [--commit|--cambio]  lo llaman los ganchos; no se usa a mano
#
# CERRAR. Un árbol y su rama se borran cuando su trabajo ya está en main, y solo entonces:
#   - «terminado» es que el PR de la rama está MERGEADO (lo dice GitHub, con gh) y la rama no tiene
#     commits posteriores, o que la rama no tiene ningún commit que main no tenga;
#   - un árbol con cambios sin commitear NO se borra: se nombra, y lo decide quien lo mira. Borrar
#     código sucio no es tirar trabajo sin leerlo.
# Con squash merge, `git branch -d` protesta SIEMPRE (los commits de la rama no son los de main), así
# que aquí se comprueba el PR y se borra con -D. Es la misma red, puesta donde sí distingue.
# `limpiar` además deja en paz lo que otra sesión está usando y lo que se tocó hace menos de 4 horas.
#
# Dónde se crean: en `git config u.arboles` si está puesto (una vez por clon, vale para todos sus
# árboles), y si no, junto al clon, en <clon>-arboles/. Fuera del clon a propósito: un árbol dentro
# de otro se lo lleva OneDrive, y un `git add` ancho lo ve.
#
# EL GUARDIA. Un árbol es de la primera sesión de agente que escribe en él, y queda anotado en su
# carpeta de git (no se versiona). Otra sesión que intente editarlo o commitear en él se detiene con
# la salida de arriba escrita. La marca caduca a las 4 horas sin actividad de su dueña
# (U_ARBOL_CADUCA, en segundos): una sesión nueva puede seguir el trabajo de ayer sin pedir permiso.
# Lo llaman tres ganchos:
#   - el de Claude Code, antes de cada Edit/Write (.claude/settings.json de la raíz y de cada
#     proyecto: Claude no hereda ganchos entre carpetas, se midió el 2026-09-30);
#   - .githooks/pre-commit, que frena el commit de cualquier agente, se abra donde se abra;
#   - .githooks/post-checkout, que no puede frenar un cambio de rama y por eso avisa cómo deshacerlo.
#
# Quién es «una sesión de agente»: quien trae CLAUDE_CODE_HOST_SESSION_ID o CLAUDE_CODE_SESSION_ID
# (Claude Code las pone en cada comando), o U_AGENTE (para cualquier otro agente). Una persona en
# su terminal no trae ninguna, y el guardia no la toca: no es de quien protege.

set -u

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
gris()  { printf '\033[90m%s\033[0m\n' "$*"; }

CADUCA="${U_ARBOL_CADUCA:-14400}"
MARCA="sesion-del-arbol"

anfitrion="${CLAUDE_CODE_HOST_SESSION_ID:-}"
sesion="${CLAUDE_CODE_SESSION_ID:-${U_AGENTE:-}}"

# La carpeta de git DE ESTE ÁRBOL (.git en el clon, .git/worktrees/<nombre> en los demás).
git_del_arbol() { git -C "$1" rev-parse --absolute-git-dir 2> /dev/null; }

campo() { sed -n "s/^$2=//p" "$1" 2> /dev/null | head -1; }

anotar() {  # anotar <gitdir>: el árbol es de esta sesión desde ahora (o lo sigue siendo)
  local desde
  desde="$(campo "$1/$MARCA" desde)"
  es_mia "$1" || desde=""
  printf 'anfitrion=%s\nsesion=%s\ndesde=%s\nvisto=%s\n' "$anfitrion" "$sesion" "${desde:-$(date +%s)}" "$(date +%s)" > "$1/$MARCA"
}

es_mia() {  # ¿la marca de <gitdir> es de esta sesión?
  local a s
  a="$(campo "$1/$MARCA" anfitrion)"; s="$(campo "$1/$MARCA" sesion)"
  { [ -n "$anfitrion" ] && [ "$a" = "$anfitrion" ]; } || { [ -n "$sesion" ] && [ "$s" = "$sesion" ]; }
}

hace() {  # hace <epoch>: «12 min», «3 h»
  local s=$(( $(date +%s) - ${1:-0} ))
  if [ "$s" -lt 3600 ]; then echo "$((s / 60)) min"; else echo "$((s / 3600)) h"; fi
}

# 0 = se puede escribir en el árbol de <dir> (y queda anotado); 1 = es de otra sesión viva.
vigilar() {
  local dir="$1" gitdir visto
  [ -n "$anfitrion$sesion" ] || return 0            # una persona en su terminal
  gitdir="$(git_del_arbol "$dir")" || return 0
  [ -n "$gitdir" ] || return 0                       # no es un repo de git
  if [ -f "$gitdir/$MARCA" ] && ! es_mia "$gitdir"; then
    visto="$(campo "$gitdir/$MARCA" visto)"
    if [ $(( $(date +%s) - ${visto:-0} )) -lt "$CADUCA" ]; then
      DE_QUIEN="$gitdir"
      return 1
    fi
  fi
  # Mía, libre o caducada. Se anota como mucho una vez por minuto: este camino corre en cada edición.
  visto="$(campo "$gitdir/$MARCA" visto)"
  if ! es_mia "$gitdir" || [ $(( $(date +%s) - ${visto:-0} )) -ge 60 ]; then anotar "$gitdir"; fi
  return 0
}

explicar() {  # explicar <dir> <qué se iba a hacer>
  local raiz rama
  raiz="$(git -C "$1" rev-parse --show-toplevel 2> /dev/null)"
  rama="$(git -C "$1" rev-parse --abbrev-ref HEAD 2> /dev/null)"
  {
    echo "ESTE ÁRBOL ES DE OTRA SESIÓN: no se puede $2 aquí."
    echo "  árbol: $raiz  (rama $rama)"
    echo "  lo usa otra sesión de agente desde hace $(hace "$(campo "$DE_QUIEN/$MARCA" desde)"); su última actividad fue hace $(hace "$(campo "$DE_QUIEN/$MARCA" visto)")."
    echo "Dos agentes en un árbol se pisan: el cambio de rama de uno mueve al otro, y sus cambios se mezclan."
    echo "Crea el tuyo y trabaja allí, con rutas de ese árbol:"
    echo "    bash tools/monorepo/arbol.sh nuevo <persona>/<que-hace>"
    echo "Solo si esa sesión ya terminó y vienes a seguir SU trabajo:"
    echo "    bash tools/monorepo/arbol.sh tomar   (desde $raiz)"
  } >&2
}

# Dónde se crean los árboles de este clon.
base_de_arboles() {
  local base
  base="$(git config --get u.arboles 2> /dev/null)"
  [ -n "$base" ] || base="$(clon_principal)-arboles"
  printf '%s' "$base"
}

# El clon principal: el dueño de la carpeta de git común, se llame desde el árbol que se llame.
clon_principal() { (cd "$(git rev-parse --git-common-dir)/.." && pwd); }

# Los PR mergeados, una vez por corrida: «<rama> <sha de su punta> <número>». Sin gh, vacío: entonces
# solo cuenta como terminada la rama que no tiene commits fuera de main.
MERGEADOS=""
cargar_mergeados() {
  command -v gh > /dev/null 2>&1 || return 0
  MERGEADOS="$(gh pr list --state merged --limit 500 --json number,headRefName,headRefOid \
    --jq '.[] | "\(.headRefName) \(.headRefOid) \(.number)"' 2> /dev/null)"
}

# 0 si el trabajo de <rama> ya está en main. Deja el porqué en MOTIVO, en los dos sentidos.
terminada() {
  local rama="$1" punta linea sha numero
  punta="$(git rev-parse -q --verify "refs/heads/$rama")" || { MOTIVO="la rama no existe en este clon"; return 1; }
  if [ -z "$(git rev-list -1 "origin/main..$punta" 2> /dev/null)" ]; then
    MOTIVO="no tiene commits que main no tenga"
    return 0
  fi
  linea="$(printf '%s\n' "$MERGEADOS" | awk -v r="$rama" '$1 == r { print; exit }')"
  if [ -z "$linea" ]; then
    MOTIVO="tiene commits que main no tiene, y ningún PR mergeado"
    return 1
  fi
  sha="$(printf '%s' "$linea" | cut -d' ' -f2)"; numero="$(printf '%s' "$linea" | cut -d' ' -f3)"
  if [ "$punta" = "$sha" ] || git merge-base --is-ancestor "$punta" "$sha" 2> /dev/null; then
    MOTIVO="PR #$numero mergeado"
    return 0
  fi
  MOTIVO="tiene commits posteriores al PR #$numero, que ya se mergeó"
  return 1
}

# Borra el árbol <dir> (si lo hay) y la rama <rama>, que ya se sabe terminada. 0 si quedó hecho.
cerrar() {
  local rama="$1" dir="$2" sucios
  if [ -n "$dir" ]; then
    sucios="$(git -C "$dir" status --porcelain 2> /dev/null)"
    if [ -n "$sucios" ]; then
      rojo "  ✘  $dir  [$rama]: $(printf '%s\n' "$sucios" | grep -c .) cambio(s) sin commitear. No se borra."
      printf '%s\n' "$sucios" | head -4 | sed 's/^/       /'
      return 1
    fi
    if ! git worktree remove "$dir" 2> "$TMP_ERR"; then
      rojo "  ✘  $dir  [$rama]: git no pudo borrar la carpeta. Suele ser un programa abierto desde ahí, o una terminal dentro."
      head -2 "$TMP_ERR" | sed 's/^/       /'
      return 1
    fi
  fi
  git branch -q -D "$rama" 2> /dev/null
  # La rama remota: GitHub la borra al mergear si el repo lo tiene activado; si sigue ahí, se borra.
  if git ls-remote --exit-code --heads origin "$rama" > /dev/null 2>&1; then
    git push --quiet origin --delete "$rama" > /dev/null 2>&1 || gris "       la rama remota origin/$rama sigue ahí: bórrala en GitHub"
  fi
  verde "  ✔  cerrado  [$rama]${dir:+  $dir}  ($MOTIVO)"
}

TMP_ERR="${TMPDIR:-/tmp}/arbol-$$.err"
trap 'rm -f "$TMP_ERR"' EXIT

case "${1:-estado}" in

  nuevo)
    rama="${2:-}"
    case "$rama" in
      */*) ;;
      *) rojo "Uso: bash tools/monorepo/arbol.sh nuevo <persona>/<que-hace>"; exit 1 ;;
    esac
    git rev-parse --git-dir > /dev/null 2>&1 || { rojo "No estás en un repo de git."; exit 1; }
    dir="$(base_de_arboles)/${rama#*/}"
    if [ -e "$dir" ]; then
      rojo "Ya existe $dir. Si es tuyo, trabaja ahí; si no, elige otro nombre para la rama."
      exit 1
    fi
    git fetch origin main --quiet || gris "  ·  no se pudo traer origin/main: la rama nace del main que hay en este disco"
    mkdir -p "$(dirname "$dir")"
    if git rev-parse -q --verify "refs/heads/$rama" > /dev/null; then
      git worktree add "$dir" "$rama" || exit 1                      # la rama ya existía: su árbol
    elif git rev-parse -q --verify "refs/remotes/origin/$rama" > /dev/null; then
      git worktree add --track -b "$rama" "$dir" "origin/$rama" || exit 1
    else
      # --no-track: una rama nueva que siguiera a origin/main invitaría a empujarle encima.
      git worktree add --no-track -b "$rama" "$dir" origin/main || exit 1
    fi
    [ -z "$anfitrion$sesion" ] || anotar "$(git_del_arbol "$dir")"
    echo
    verde "Tu árbol: $dir"
    echo "  rama $rama, desde $(git -C "$dir" log -1 --format='%h %s' | cut -c1-80)"
    echo "  Trabaja SOLO ahí, desde la carpeta de tu proyecto:  cd \"$dir/apps/<proyecto>\""
    echo "  Claude Code: entra con la herramienta EnterWorktree (path: $dir)."
    echo "  Al mergear el PR:  git worktree remove \"$dir\"  y  git branch -d $rama"
    ;;

  estado)
    printf '%-9s %-11s %-9s %s\n' "DE QUIÉN" "VISTO" "SIN COMMIT" "ÁRBOL  [rama]"
    git worktree list --porcelain | sed -n 's/^worktree //p' | while IFS= read -r arbol; do
      gitdir="$(git_del_arbol "$arbol")" || continue
      quien="libre"; visto="-"
      if [ -f "$gitdir/$MARCA" ]; then
        v="$(campo "$gitdir/$MARCA" visto)"
        visto="hace $(hace "$v")"
        if es_mia "$gitdir"; then quien="tú"
        elif [ $(( $(date +%s) - ${v:-0} )) -lt "$CADUCA" ]; then quien="otra"
        else quien="caducado"; fi
      fi
      cambios="$(git -C "$arbol" status --porcelain 2> /dev/null | grep -c .)"
      printf '%-9s %-11s %-9s %s  [%s]\n' "$quien" "$visto" "$cambios" "$arbol" "$(git -C "$arbol" rev-parse --abbrev-ref HEAD 2> /dev/null)"
    done
    ;;

  tomar)
    [ -n "$anfitrion$sesion" ] || { rojo "Solo una sesión de agente toma un árbol: a una persona el guardia no la frena."; exit 1; }
    gitdir="$(git_del_arbol "${2:-.}")" || { rojo "No es un árbol de git: ${2:-.}"; exit 1; }
    rm -f "$gitdir/$MARCA"
    anotar "$gitdir"
    verde "Este árbol es de esta sesión desde ahora: $(git -C "${2:-.}" rev-parse --show-toplevel)"
    ;;

  soltar)
    gitdir="$(git_del_arbol "${2:-.}")" || { rojo "No es un árbol de git: ${2:-.}"; exit 1; }
    if [ -f "$gitdir/$MARCA" ] && ! es_mia "$gitdir"; then
      rojo "Este árbol no es de esta sesión: no lo suelta quien no lo tiene."
      exit 1
    fi
    rm -f "$gitdir/$MARCA"
    verde "Árbol libre: $(git -C "${2:-.}" rev-parse --show-toplevel)"
    ;;

  cerrar)
    git fetch origin main --quiet --prune 2> /dev/null
    cargar_mergeados
    rama="${2:-$(git rev-parse --abbrev-ref HEAD)}"
    case "$rama" in main|HEAD) rojo "Aquí no hay rama que cerrar (estás en $rama)."; exit 1 ;; esac
    dir="$(git worktree list --porcelain | awk -v r="refs/heads/$rama" '/^worktree /{w = substr($0, 10)} $0 == "branch " r {print w}')"
    principal="$(clon_principal)"
    if ! terminada "$rama"; then
      rojo "  ✘  [$rama] no está terminada: $MOTIVO. No se borra."
      exit 1
    fi
    # El clon principal no se borra: se le devuelve a main y se borra solo la rama.
    if [ -n "$dir" ] && [ "$(cd "$dir" && pwd)" = "$principal" ]; then
      [ -z "$(git -C "$dir" status --porcelain)" ] || { rojo "  ✘  el clon principal tiene cambios sin commitear: no se le cambia la rama."; exit 1; }
      git -C "$dir" switch --quiet main && git -C "$dir" merge --quiet --ff-only origin/main
      dir=""
    fi
    # Desde el clon principal: git no borra la carpeta en la que está parado.
    cd "$principal" || exit 1
    cerrar "$rama" "$dir"
    ;;

  limpiar)
    git fetch origin main --quiet --prune 2> /dev/null
    cargar_mergeados
    [ -n "$MERGEADOS" ] || gris "  ·  sin gh (o sin red): solo se cierran las ramas que no tienen commits fuera de main"
    principal="$(clon_principal)"
    cd "$principal" || exit 1
    ahora="$(date +%s)"
    quedan=0
    # 1. los árboles, menos el clon principal
    git worktree list --porcelain | awk '/^worktree /{w = substr($0, 10)} /^branch /{print substr($0, 19) "\t" w} /^detached/{print "-\t" w}' > "$TMP_ERR.arboles"
    while IFS="$(printf '\t')" read -r rama dir; do
      [ "$(cd "$dir" 2> /dev/null && pwd)" = "$principal" ] && continue
      if [ "$rama" = "-" ]; then gris "  ·  $dir: sin rama (HEAD suelto). Se deja."; quedan=$((quedan + 1)); continue; fi
      if ! terminada "$rama"; then gris "  ·  [$rama] $MOTIVO. Se deja."; quedan=$((quedan + 1)); continue; fi
      gitdir="$(git_del_arbol "$dir")"
      if [ -f "$gitdir/$MARCA" ] && ! es_mia "$gitdir" && [ $(( ahora - $(campo "$gitdir/$MARCA" visto) )) -lt "$CADUCA" ]; then
        gris "  ·  [$rama] terminada, pero la usa otra sesión. Se deja."; quedan=$((quedan + 1)); continue
      fi
      # Sin marca no se sabe de quién es: si se tocó hace poco, puede haber un agente dentro.
      tocado="$(stat -c %Y "$gitdir/index" 2> /dev/null || stat -f %m "$gitdir/index" 2> /dev/null || echo 0)"
      if ! es_mia "$gitdir" && [ $(( ahora - tocado )) -lt "$CADUCA" ]; then
        gris "  ·  [$rama] terminada, pero se tocó hace $(hace "$tocado"). Se deja por si hay alguien dentro."; quedan=$((quedan + 1)); continue
      fi
      cerrar "$rama" "$dir" || quedan=$((quedan + 1))
    done < "$TMP_ERR.arboles"
    rm -f "$TMP_ERR.arboles"
    # 2. las ramas locales sin árbol
    en_arbol="$(git worktree list --porcelain | sed -n 's|^branch refs/heads/||p')"
    for rama in $(git for-each-ref --format='%(refname:short)' refs/heads); do
      [ "$rama" = "main" ] && continue
      printf '%s\n' "$en_arbol" | grep -qx "$rama" && continue
      if terminada "$rama"; then cerrar "$rama" ""; fi
    done
    git worktree prune
    echo
    echo "  Quedan $quedan árbol(es) sin cerrar. Para ver de quién es cada uno:  bash tools/monorepo/arbol.sh estado"
    ;;

  guardia)
    case "${2:-}" in
      --commit)   # desde .githooks/pre-commit: frena
        vigilar "$PWD" && exit 0
        explicar "$PWD" "commitear"
        exit 1 ;;
      --cambio)   # desde .githooks/post-checkout: ya cambió de rama, solo puede avisar
        vigilar "$PWD" && exit 0
        explicar "$PWD" "cambiar de rama"
        echo "ACABAS DE CAMBIARLE LA RAMA A ESA SESIÓN. Devuélvela ahora:  git switch -" >&2
        exit 0 ;;
      *)          # desde el gancho PreToolUse de Claude Code: el JSON de la herramienta llega por stdin
        entrada="$(cat)"
        [ -n "$sesion" ] || sesion="$(printf '%s' "$entrada" | sed -nE 's/.*"session_id"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/p' | head -1)"
        ruta="$(printf '%s' "$entrada" | sed -nE 's/.*"(file_path|notebook_path)"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*/\2/p' | head -1)"
        [ -n "$ruta" ] || exit 0
        # JSON escribe «\\» por cada «\» de una ruta de Windows; git las entiende con «/».
        dir="$(dirname "$(printf '%s' "$ruta" | sed 's/\\\\/\//g')")"
        # El archivo puede ser nuevo, y su carpeta también: se sube hasta una que exista.
        while [ ! -d "$dir" ] && [ "$dir" != "$(dirname "$dir")" ]; do dir="$(dirname "$dir")"; done
        vigilar "$dir" && exit 0
        explicar "$dir" "escribir"
        exit 2 ;;   # 2 = Claude Code no ejecuta la herramienta y le enseña al agente lo de arriba
    esac
    ;;

  *)
    sed -n '9,15p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
