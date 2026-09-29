#!/usr/bin/env bash
# Las reglas comunes del monorepo viven en AGENTS.md, y Claude las recibe por una copia en
# .claude/rules/monorepo.md. Este script genera esa copia; con --comprobar solo dice si están iguales.
#
# Por qué una copia y no un @import (medido el 2026-09-28 con Claude Code 2.1.276): con Claude abierto
# en una subcarpeta (apps/windows), un «@../AGENTS.md» sale de la carpeta de trabajo y Claude pide
# permiso antes de cargarlo; sin nadie que conteste, no lo carga. Las reglas de .claude/rules/ de la
# raíz, en cambio, se cargan desde cualquier subcarpeta. Codex solo lee AGENTS.md. Dos lectores, un
# texto: se escribe en AGENTS.md y se copia.
#
# Uso:  bash tools/monorepo/agentes.sh             regenera la copia
#       bash tools/monorepo/agentes.sh --comprobar  sale con 1 si difieren (lo corre el CI de la raíz)
set -eu

raiz="$(git rev-parse --show-toplevel)"
origen="$raiz/AGENTS.md"
copia="$raiz/.claude/rules/monorepo.md"
cabecera='<!-- GENERADO desde AGENTS.md por tools/monorepo/agentes.sh: no lo edites aquí. Edita AGENTS.md y corre el script. -->'

# Sin retornos de carro: con core.autocrlf=true la copia de trabajo los lleva y el índice no, y la
# comparación tiene que dar lo mismo en Windows que en Mac.
esperado="$(printf '%s\n\n' "$cabecera"; tr -d '\r' < "$origen")"

if [ "${1:-}" = "--comprobar" ]; then
  if [ ! -f "$copia" ] || [ "$(tr -d '\r' < "$copia")" != "$esperado" ]; then
    printf '\033[31m%s\033[0m\n' "  ✘  .claude/rules/monorepo.md no coincide con AGENTS.md"
    echo "     Corre:  bash tools/monorepo/agentes.sh   y commitea la copia."
    exit 1
  fi
  exit 0
fi

printf '%s\n' "$esperado" > "$copia"
echo "copia regenerada: .claude/rules/monorepo.md"
