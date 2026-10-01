#!/usr/bin/env bash
# Comprueba que la raíz del monorepo sigue en orden. La corren el despachador (.githooks/pre-push)
# cuando una rama toca algo fuera de los proyectos, y el CI de la raíz (monorepo.yml) en cada PR.
#
# Por qué existe (2026-09-28): la raíz llegó a 33 entradas porque nada impedía añadir una más. Una
# regla escrita que nada comprueba es una petición; esto la convierte en una comprobación. Mira lo
# VERSIONADO (git ls-files), no el disco: las carpetas fantasma con solo archivos ignorados no
# cuentan.
set -u

raiz="$(git rev-parse --show-toplevel)"
cd "$raiz" || exit 1

rojo() { printf '\033[31m%s\033[0m\n' "$*"; }

# Lo que puede vivir en la raíz, y los proyectos que puede haber. Un proyecto nuevo se añade aquí y
# en PROYECTOS de .githooks/pre-push; una carpeta nueva en la raíz se discute antes.
RAIZ=".claude .gitattributes .githooks .github .gitignore AGENTS.md README.md apps docs services tools"
APPS="android mac web windows"
SERVICES="graph"
DOCS="herramientas monorepo"

fallos=0
fuera_de() {  # fuera_de <nivel> <permitidos> <encontrados…>
  local nivel="$1" permitidos=" $2 "; shift 2
  local e
  for e in "$@"; do
    case "$permitidos" in
      *" $e "*) ;;
      *) rojo "  ✘  $nivel$e no pertenece aquí"; fallos=$((fallos+1)); sugerir "$nivel$e" ;;
    esac
  done
}

sugerir() {
  case "$1" in
    u|medidor|windows-*|nucleo|mapeador|voz|tests|sondas|scripts|backend|laboratorio|piloto)
      echo "     Es de Windows: git mv $1 apps/windows/$1" ;;
    docs/*)
      echo "     Si es de un proyecto, va en su carpeta (p. ej. apps/windows/$1). En la raíz, docs/"
      echo "     solo guarda lo del monorepo (docs/monorepo) y las herramientas comunes (docs/herramientas)." ;;
    apps/*|services/*)
      echo "     Un proyecto nuevo se da de alta en tools/monorepo/comprobar-raiz.sh y en .githooks/pre-push." ;;
    *)
      echo "     ¿De qué proyecto es? Va dentro de su carpeta: apps/<proyecto>/ o services/<servicio>/." ;;
  esac
}

# Sin comillas en las rutas: con core.quotepath (el valor por defecto) git cita las que llevan
# acentos, y «"apps» saldría como una entrada intrusa.
versionado() { git -c core.quotepath=false ls-files -- "$@"; }

# shellcheck disable=SC2046
fuera_de ""          "$RAIZ"     $(versionado | cut -d/ -f1 | sort -u)
fuera_de "apps/"     "$APPS"     $(versionado apps | cut -d/ -f2 | sort -u)
fuera_de "services/" "$SERVICES" $(versionado services | cut -d/ -f2 | sort -u)
fuera_de "docs/"     "$DOCS"     $(versionado docs | cut -d/ -f2 | sort -u)

# Las reglas comunes: AGENTS.md (lo leen Codex y las personas) y su copia para Claude tienen que
# decir lo mismo. Claude no carga un AGENTS.md importado desde una subcarpeta sin preguntar (se
# midió el 2026-09-28), así que la copia vive en .claude/rules/, que sí carga siempre.
if ! bash tools/monorepo/agentes.sh --comprobar; then
  fallos=$((fallos+1))
fi

# El guardia de los árboles (un agente, un árbol) llega a Claude Code por un gancho, y Claude no
# hereda ganchos entre carpetas (se midió el 2026-09-30): tiene que estar en el settings.json de la
# raíz y en el de cada proyecto. Uno que falte deja a las sesiones abiertas en esa carpeta sin
# guardia, y nadie lo nota.
for carpeta in . $(printf 'apps/%s ' $APPS) $(printf 'services/%s ' $SERVICES); do
  if ! grep -qs 'tools/monorepo/arbol.sh' "$carpeta/.claude/settings.json"; then
    rojo "  ✘  ${carpeta#./}/.claude/settings.json no trae el gancho del guardia de árboles"
    echo "     Cópialo del .claude/settings.json de la raíz (hooks → PreToolUse)."
    fallos=$((fallos+1))
  fi
done

[ "$fallos" -eq 0 ]
