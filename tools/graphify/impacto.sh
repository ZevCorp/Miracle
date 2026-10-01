#!/usr/bin/env bash
# A QUIÉN AFECTA ESTA RAMA, según el mapa de graphify. El qué y el porqué están en impacto.py; esto
# solo encuentra un Python que lo corra.
#
#   bash tools/graphify/impacto.sh                    contra origin/main, los proyectos que toca la rama
#   bash tools/graphify/impacto.sh --base main apps/windows
#
# En Windows no suele haber Python suelto (el «python» de la Microsoft Store es un aviso, no un
# Python), pero quien tiene graphify tiene el suyo: se usa ese.
aqui="$(cd "$(dirname "$0")" && pwd)"

funciona() { "$@" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' > /dev/null 2>&1; }

py=""
for c in python3 python; do
  command -v "$c" > /dev/null 2>&1 && funciona "$c" && py="$c" && break
done
if [ -z "$py" ]; then
  dirs="${UV_TOOL_DIR:-} $HOME/.local/share/uv/tools ${APPDATA:-}/uv/tools"
  command -v uv > /dev/null 2>&1 && dirs="$(uv tool dir 2> /dev/null) $dirs"
  for d in $dirs; do
    for c in "$d/graphifyy/Scripts/python.exe" "$d/graphifyy/bin/python"; do
      [ -x "$c" ] && funciona "$c" && py="$c" && break 2
    done
  done
fi
if [ -z "$py" ]; then
  echo "No pude mirar: no encuentro Python 3.8+ (ni el que trae graphify). Instálalo con tools/graphify/instalar."
  exit 2
fi
exec "$py" "$aqui/impacto.py" "$@"
