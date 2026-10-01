#!/usr/bin/env bash
# GRAPHIFY EN ESTE EQUIPO, de una vez y igual para todos (Mac y Linux). En Windows:
# tools/graphify/instalar.ps1, que hace lo mismo y cuenta el porqué.
#
#     bash tools/graphify/instalar.sh                 todos los proyectos que esta máquina toca
#     bash tools/graphify/instalar.sh apps/web        solo ese
#     SIN_MAPAS=1 bash tools/graphify/instalar.sh     instala y activa los ganchos, sin construir mapas
#
# Deja: uv y graphify en la versión del equipo, el portero activado (con él llegan los ganchos que
# rehacen el mapa tras commit, cambio de rama y pull) y el mapa de cada proyecto. Se puede repetir.
set -u

VERSION="0.9.71"   # la misma que instalar.ps1 y .github/workflows/graphify-impacto.yml

paso()  { printf '\n\033[36m── %s\033[0m\n' "$*"; }
rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }

raiz="$(git rev-parse --show-toplevel 2> /dev/null)" || { rojo "Corre esto dentro del repo."; exit 1; }
cd "$raiz" || exit 1
export PATH="$HOME/.local/bin:$PATH"

paso "1/3 · uv y graphify $VERSION"
if ! command -v uv > /dev/null 2>&1; then
  echo "   uv no está: se instala con el instalador de astral.sh."
  curl -LsSf https://astral.sh/uv/install.sh | sh || { rojo "   ✘ no se pudo instalar uv."; exit 1; }
  export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
fi
actual="$(graphify --version 2> /dev/null | tr -cd '0-9.')"
if [ "$actual" = "$VERSION" ]; then
  echo "   ✔ graphify $VERSION ya está."
else
  uv tool install "graphifyy==$VERSION" --python 3.12 || { rojo "   ✘ graphify no se pudo instalar."; exit 1; }
  uv tool update-shell > /dev/null 2>&1
  echo "   ✔ graphify $VERSION instalado."
fi
command -v graphify > /dev/null 2>&1 || { rojo "   ✘ graphify no quedó en el PATH. Abre una terminal nueva y repite."; exit 1; }

paso "2/3 · el portero y los ganchos del mapa"
git config core.hooksPath .githooks
echo "   ✔ core.hooksPath = .githooks (el mapa se rehace solo tras commit, cambio de rama y pull)."

paso "3/3 · el mapa de cada proyecto"
if [ "${SIN_MAPAS:-0}" = "1" ]; then
  echo "   (saltado con SIN_MAPAS=1)"
else
  if [ "$#" -gt 0 ]; then
    proyectos="$*"
  else
    # Todos menos Windows: desde un Mac no se trabaja en apps/windows (.claude/rules/solo-mac.md).
    proyectos="$(for p in apps/* services/*; do [ -d "$p" ] && [ "$p" != "apps/windows" ] && printf '%s ' "$p"; done)"
  fi
  export PYTHONHASHSEED=0
  for p in $proyectos; do
    [ -d "$p" ] || { rojo "   ✘ $p no existe."; continue; }
    inicio=$(date +%s)
    fin="$(cd "$p" && graphify update . 2>&1 | grep 'Rebuilt' | tail -1 | sed 's/.*Rebuilt: //')"
    if [ -f "$p/graphify-out/graph.json" ]; then
      printf '   ✔ %-16s %4s s  %s\n' "$p" "$(( $(date +%s) - inicio ))" "$fin"
    else
      rojo "   ✘ $p: graphify no dejó mapa. Córrelo a mano dentro de la carpeta: graphify update ."
    fi
  done
fi

printf '\n\033[32mListo.\033[0m Lo que más rinde:\n'
echo "   bash tools/graphify/impacto.sh          a quién afecta tu rama (pégalo en el PR)"
echo "   graphify affected \"Clase\"               quién depende de una pieza   (dentro de apps/<proyecto>)"
echo "   La guía: docs/herramientas/README-GRAPHIFY.md"
