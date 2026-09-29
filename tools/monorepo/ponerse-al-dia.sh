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
#  1. Mezcla origin/main con merge.directoryRenames=true. Lo que tu rama CAMBIÓ sigue al movimiento
#     solo, y lo que AÑADIÓ dentro de una carpeta que se movió se va con ella; con el valor por
#     defecto de git eso último sale como «CONFLICT (file location)». Antes de mover nada se ensayó
#     contra las 76 ramas abiertas: el movimiento no le sumó un conflicto a ninguna.
#  2. Lista lo que tu rama AÑADIÓ en la raíz y no es de la raíz (u/, medidor/, un .ps1 en scripts/,
#     un .md suelto en docs/…), con el git mv que lo pone en su sitio. No lo mueve solo: de qué
#     proyecto es algo lo sabe quien lo escribió. git no puede adivinarlo porque esas carpetas no
#     existían en main.
#  3. Lista las carpetas viejas que quedaron en tu disco solo con archivos ignorados (bin/, obj/,
#     node_modules, un .env…): git no mueve lo que no versiona.
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
if ! git -c merge.directoryRenames=true merge --no-edit origin/main; then
  echo
  rojo "Quedan conflictos. Casi siempre ya estaban antes del movimiento: son de tu rama contra main."
  git diff --name-only --diff-filter=U | sed 's/^/    /'
  echo "Resuélvelos, git add, git commit, y vuelve a correr este script para los pasos 2 y 3."
  exit 1
fi
verde "   hecho"

echo
echo "── 2. lo que tu rama añadió en la raíz y no es de la raíz"
RAIZ=" .claude .githooks .github .gitignore AGENTS.md README.md apps docs services tools "
COMPARTIDAS=" monorepo.md ramas-y-commits.md aviso-en-slack.md solo-mac.md "
# Adónde fue cada carpeta de la raíz vieja. u/ y medidor/ son proyectos de Windows que aún viven en
# ramas (#125 y claude/miracle-impact-measurement-h1n3k8).
destino_de() {
  case "$1" in
    u|medidor|windows-client|windows-graph|nucleo|mapeador|voz|tests|sondas|scripts|backend|laboratorio|piloto|agente-piloto|puente-omi)
      echo "apps/windows/$1" ;;
    mac-client) echo "apps/mac" ;;
    android)    echo "apps/android" ;;
    web)        echo "apps/web" ;;
    graph)      echo "services/graph" ;;
  esac
}
propuestas=""
proponer() { propuestas="$propuestas
$1"; }
while IFS= read -r f; do
  arriba="${f%%/*}"
  resto="${f#*/}"
  case "$arriba" in
    docs)
      case "$f" in
        docs/monorepo/*|docs/herramientas/*) ;;
        */*) proponer "mkdir -p apps/windows/${f%/*} && git mv $f apps/windows/$f" ;;
      esac
      continue ;;
    .claude)
      case "$f" in
        .claude/rules/*)
          case "$COMPARTIDAS" in *" ${f##*/} "*) ;; *) proponer "git mv $f apps/windows/.claude/rules/" ;; esac ;;
      esac
      continue ;;
  esac
  case "$RAIZ" in *" $arriba "*) continue ;; esac
  d="$(destino_de "$arriba")"
  if [ -z "$d" ]; then
    proponer "git mv $arriba apps/<proyecto>/$arriba   # ¿de qué proyecto es?"
  elif [ ! -e "$d" ]; then
    proponer "git mv $arriba $d"                       # carpeta nueva entera: u/, medidor/
  else
    proponer "mkdir -p $(dirname "$d/$resto") && git mv $f $d/$resto"
  fi
done < <(git -c core.quotepath=false diff --name-only --diff-filter=A origin/main HEAD)

propuestas="$(printf '%s
' "$propuestas" | grep . | sort -u)"
if [ -z "$propuestas" ]; then
  verde "   nada: todo lo que añadiste ya está en su carpeta"
else
  echo "   Propuesta (revísala: de qué proyecto es algo lo sabes tú):"
  printf '%s
' "$propuestas" | sed 's/^/     /'
  echo "   Después:  git commit -m \"chore: lo nuevo de la rama, a su carpeta del monorepo\""
fi

echo
echo "── 3. carpetas viejas que quedaron en tu disco con archivos que git no versiona"
viejas=0
for d in windows-client windows-graph nucleo mapeador voz tests sondas scripts backend laboratorio \
         piloto agente-piloto agente-arquitecto puente-omi mac-client android web graph u medidor; do
  [ -d "$d" ] || continue
  [ -z "$(git ls-files -- "$d" | head -1)" ] || continue
  viejas=$((viejas+1))
  echo "   $d/  ($(du -sh "$d" 2>/dev/null | cut -f1))"
  find "$d" -maxdepth 3 \( -name '.env*' -o -name '*.local' -o -name 'settings.local.json' -o -name '.vercel' \) 2>/dev/null \
    | sed "s|^|       ojo, configuración local: muévela a $(destino_de "$d")/…  → |"
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
