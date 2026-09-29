#!/usr/bin/env bash
# Pone una rama abierta al día con el monorepo ordenado del 2026-09-28, donde cada proyecto pasó a su
# carpeta: Windows a apps/windows/, la Mac a apps/mac/, Android a apps/android/, la web a apps/web/ y
# Graph a services/graph/.
#
# Uso, desde tu rama y con tu trabajo commiteado (funciona aunque tu rama aún no tenga este script):
#     git fetch origin
#     bash <(git show origin/main:tools/monorepo/ponerse-al-dia.sh)
#
# Qué hace:
#  1. Mezcla origin/main con merge.directoryRenames=true y un umbral de renombre del 40 %. Lo que tu
#     rama CAMBIÓ sigue al movimiento solo, y lo que AÑADIÓ en una carpeta que ya existía se va con
#     ella. Si tu rama BORRÓ un archivo que main solo movió, sin cambiarle un byte, gana tu borrado.
#     Lo demás que choque ya chocaba antes del movimiento: es tu rama contra main.
#  2. Lleva a su carpeta lo que tu rama añadió y git no supo reubicar: los archivos de subcarpetas
#     NUEVAS dentro de una carpeta movida (git solo mira la carpeta inmediata) y los proyectos nuevos
#     de Windows en la raíz (u/, medidor/). Su destino no es opinable, así que lo mueve y lo
#     commitea. Lo que no sabe ubicar, lo propone y no lo toca.
#  3. Lista las carpetas viejas que quedaron en tu disco solo con archivos que git no versiona
#     (bin/, obj/, node_modules, un .env…): git no mueve lo que no versiona.
#
# Ensayado el 2026-09-28 contra las 75 ramas abiertas. Con este script, ninguna rama viva quedó con
# un conflicto que no tuviera ya antes del movimiento.
set -u

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
gris()  { printf '\033[90m%s\033[0m\n' "$*"; }

raiz="$(git rev-parse --show-toplevel)" || exit 1
cd "$raiz" || exit 1
rama="$(git rev-parse --abbrev-ref HEAD)"

if [ "$rama" = "main" ]; then
  echo "Estás en main: basta con  git pull"
  exit 0
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  rojo "Tienes cambios sin commitear. Commitéalos (aunque sea «wip:») o guárdalos con git stash, y vuelve a correrlo."
  exit 1
fi
git rev-parse -q --verify origin/main > /dev/null || { rojo "No hay origin/main: corre  git fetch origin  primero."; exit 1; }

# Archivos sin versionar que main SÍ versiona: el merge se negaría a pisarlos. Pasa con un AGENTS.md
# local en la raíz, que el monorepo ahora trae.
pisados="$(comm -12 <(git ls-files --others --exclude-standard | sort) <(git ls-tree -r --name-only origin/main | sort))"
if [ -n "$pisados" ]; then
  rojo "Estos archivos tuyos, sin versionar, chocan con archivos que main ahora trae:"
  printf '%s\n' "$pisados" | sed 's/^/    /'
  echo "Apártalos (p. ej.  mv AGENTS.md AGENTS.mio.md ) y vuelve a correrlo."
  exit 1
fi

echo
echo "── 1. mezclando origin/main en $rama"
# -X find-renames=40%: un archivo que main cambió mucho desde que nació tu rama se parece menos de un
# 50 % (el umbral de git) a su versión vieja, y git deja de reconocerlo como movido; tu cambio se
# volvía un conflicto «modificado/borrado». En el ensayo, con 40 % volvieron a sus conflictos de
# antes las 4 ramas donde pasaba, y bajarlo más no ganó ninguna.
if ! git -c merge.directoryRenames=true merge --no-edit -X find-renames=40% origin/main; then
  # El único conflicto que añade el movimiento y que tiene una sola respuesta: tu rama BORRÓ un
  # archivo que main solo MOVIÓ, sin cambiarle un byte (la etapa 1, la base, y la 3, main, son el
  # mismo blob; la 2, tu rama, no existe). Gana tu borrado.
  while IFS= read -r f; do
    base="$(git rev-parse -q --verify ":1:$f" 2>/dev/null)"
    tuyo="$(git rev-parse -q --verify ":2:$f" 2>/dev/null)"
    de_main="$(git rev-parse -q --verify ":3:$f" 2>/dev/null)"
    if [ -z "$tuyo" ] && [ -n "$base" ] && [ "$base" = "$de_main" ]; then
      git rm -q -- "$f" && gris "   resuelto solo: tu rama borró $f, y main solo lo movió"
    fi
  done < <(git -c core.quotepath=false diff --name-only --diff-filter=U)
  if [ -n "$(git diff --name-only --diff-filter=U)" ]; then
    echo
    rojo "Quedan conflictos. Ya estaban antes del movimiento: son de tu rama contra main."
    git -c core.quotepath=false diff --name-only --diff-filter=U | sed 's/^/    /'
    echo "Resuélvelos, git add, git commit, y vuelve a correr este script para los pasos 2 y 3."
    exit 1
  fi
  git commit -q --no-edit
fi
verde "   hecho"

echo
echo "── 2. lo que tu rama añadió y git no supo llevar a su carpeta"
# Adónde fue cada cosa de la raíz vieja. Todo lo que no era de otro proyecto era de Windows, así que
# un docs/, un scripts/ o una regla nueva que traiga una rama vieja también lo es. u/ y medidor/ son
# proyectos de Windows que viven en ramas (#125 y claude/miracle-impact-measurement-h1n3k8).
COMPARTIDAS=" monorepo.md ramas-y-commits.md aviso-en-slack.md solo-mac.md "
destino() {
  local f="$1" arriba="${1%%/*}" resto="${1#*/}"
  case "$arriba" in
    u|medidor|windows-client|windows-graph|nucleo|mapeador|voz|tests|sondas|scripts|backend|laboratorio|piloto|agente-piloto|puente-omi)
      echo "apps/windows/$f" ;;
    mac-client) echo "apps/mac/$resto" ;;
    android)    echo "apps/android/$resto" ;;
    web)        echo "apps/web/$resto" ;;
    graph)      echo "services/graph/$resto" ;;
    docs)
      case "$f" in docs/monorepo/*|docs/herramientas/*) ;; *) echo "apps/windows/$f" ;; esac ;;
    .claude)
      case "$f" in
        .claude/rules/*) case "$COMPARTIDAS" in *" ${f##*/} "*) ;; *) echo "apps/windows/$f" ;; esac ;;
        .claude/skills/avisa/*|.claude/CLAUDE.md) ;;
        .claude/skills/*) echo "apps/windows/$f" ;;
      esac ;;
  esac
}
RAIZ=" .claude .githooks .github .gitignore AGENTS.md README.md apps docs services tools "
movidos=0
propuestas=""
while IFS= read -r f; do
  d="$(destino "$f")"
  if [ -n "$d" ]; then
    mkdir -p "$(dirname "$d")" && git mv -- "$f" "$d" && movidos=$((movidos+1))
  else
    arriba="${f%%/*}"
    case "$RAIZ" in *" $arriba "*) ;; *) propuestas="$propuestas
git mv $arriba apps/<proyecto>/$arriba   # ¿de qué proyecto es?" ;; esac
  fi
done < <(git -c core.quotepath=false diff --name-only --diff-filter=A origin/main HEAD)

if [ "$movidos" -gt 0 ]; then
  # Las carpetas viejas quedan vacías en el disco: git mueve archivos, no carpetas.
  for v in u medidor windows-client windows-graph nucleo mapeador voz tests sondas scripts backend \
           laboratorio piloto agente-piloto puente-omi mac-client android web graph; do
    [ -d "$v" ] && find "$v" -depth -type d -empty -delete 2>/dev/null
  done
  git commit -q -m "chore(monorepo): lo que la rama añadió va a su carpeta del monorepo

Lo movió tools/monorepo/ponerse-al-dia.sh: archivos en subcarpetas nuevas de carpetas movidas, que
git no reubica solo, y proyectos de Windows nacidos en la raíz."
  verde "   $movidos archivo(s) movido(s) a su carpeta y commiteado(s)"
else
  verde "   nada: todo lo que añadiste ya estaba en su carpeta"
fi
propuestas="$(printf '%s\n' "$propuestas" | grep . | sort -u)"
if [ -n "$propuestas" ]; then
  echo "   Y esto no sé de qué proyecto es. Revísalo tú:"
  printf '%s\n' "$propuestas" | sed 's/^/     /'
fi

echo
echo "── 3. carpetas viejas que quedaron en tu disco con archivos que git no versiona"
viejas=0
for v in windows-client windows-graph nucleo mapeador voz tests sondas scripts backend laboratorio \
         piloto agente-piloto agente-arquitecto puente-omi mac-client android web graph u medidor; do
  [ -d "$v" ] || continue
  [ -z "$(git ls-files -- "$v" | head -1)" ] || continue
  viejas=$((viejas+1))
  echo "   $v/  ($(du -sh "$v" 2>/dev/null | cut -f1))"
  find "$v" -maxdepth 3 \( -name '.env*' -o -name '*.local' -o -name 'settings.local.json' -o -name '.vercel' \) 2>/dev/null \
    | sed "s|^|       ojo, configuración local: muévela a su carpeta nueva → |"
done
if [ "$viejas" -eq 0 ]; then
  verde "   ninguna"
else
  gris "   Son restos (bin/, obj/, node_modules…): se pueden borrar. Mueve antes lo marcado con «ojo»."
fi

if [ -f "/c/U-versiones/versiones.json" ] && ! grep -q 'apps\\\\windows' /c/U-versiones/versiones.json; then
  echo
  gris "   C:\\U-versiones\\versiones.json apunta su \"Repo\" a la raíz: el visor del núcleo (:8792) espera"
  gris "   ahora ...\\apps\\windows. Cámbialo a mano."
fi
echo
verde "Listo. Compila desde la carpeta de tu proyecto (p. ej. apps/windows) antes de empujar."
