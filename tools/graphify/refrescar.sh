#!/usr/bin/env bash
# EL MAPA AL DÍA: rehace, en segundo plano, el mapa de graphify de cada proyecto que lo tiene. Lo
# llaman los ganchos de git (.githooks/post-commit, post-merge y post-checkout), así que basta con
# tener el portero activado (`git config core.hooksPath .githooks`) para que funcione.
#
# Por qué existe (2026-10-01): medido con agentes, el mapa no ahorraba nada porque llegaba
# desfasado. Los ganchos que instala `graphify hook install` solo rehacen el mapa de la RAÍZ, nunca
# tras un pull, y se saltan los árboles enlazados —justo donde trabaja cada agente—. El mapa de
# apps/windows llevaba dos commits de atraso y dio una línea vieja (FaceWindow L4394 por L4475): el
# agente tuvo que comprobarlo todo a mano y el mapa no le ahorró nada.
#
# Qué mapas: los de cada proyecto (apps/*, services/*) que ya tienen el suyo en este árbol, o —en un
# árbol enlazado— los que tiene el clon principal: quien mapeó un proyecto lo quiere en todos sus
# árboles. El de la raíz no: cubre todo el monorepo, tarda minutos y da respuestas peores que el
# del proyecto. Se mide cada proyecto por separado: apps/windows, ~40 s en frío y ~16 s sin cambios.
#
# Nunca frena a git: sin graphify instalado no hace nada, y con él lanza el trabajo y vuelve.
# GRAPHIFY_SKIP_HOOK=1 lo apaga (el mismo interruptor que usan los ganchos de graphify).

[ "${GRAPHIFY_SKIP_HOOK:-0}" = "1" ] && exit 0

gfy="$(command -v graphify 2> /dev/null)"
[ -n "$gfy" ] || for c in "$HOME/.local/bin/graphify" "$HOME/.local/bin/graphify.exe"; do
  [ -x "$c" ] && gfy="$c" && break
done
[ -n "$gfy" ] || exit 0

raiz="$(git rev-parse --show-toplevel 2> /dev/null)" || exit 0
gitdir="$(git rev-parse --absolute-git-dir 2> /dev/null)" || exit 0
comun="$(cd "$(git rev-parse --git-common-dir 2> /dev/null)" 2> /dev/null && pwd)" || exit 0
principal=""
[ "$gitdir" != "$comun" ] && [ "$(basename "$comun")" = ".git" ] && principal="$(dirname "$comun")"

proyectos=""
for p in "$raiz"/apps/* "$raiz"/services/*; do
  [ -d "$p" ] || continue
  rel="${p#"$raiz"/}"
  if [ -f "$p/graphify-out/graph.json" ] || { [ -n "$principal" ] && [ -f "$principal/$rel/graphify-out/graph.json" ]; }; then
    proyectos="$proyectos $rel"
  fi
done
[ -n "$proyectos" ] || exit 0

registro="$HOME/.cache/graphify-rebuild.log"
mkdir -p "$(dirname "$registro")" 2> /dev/null

# Un solo refresco por árbol a la vez. Si llega otro mientras corre, se anota y el que corre da una
# vuelta más al terminar: commit + checkout seguidos no apilan procesos, y ninguno se pierde.
cerrojo="$gitdir/graphify-refresco"
pendiente="$gitdir/graphify-pendiente"
if ! mkdir "$cerrojo" 2> /dev/null; then
  # Un cerrojo de más de 20 minutos es de un refresco que murió: se rompe.
  if [ -n "$(find "$cerrojo" -maxdepth 0 -mmin +20 2> /dev/null)" ]; then
    rm -rf "$cerrojo"; mkdir "$cerrojo" 2> /dev/null || exit 0
  else
    : > "$pendiente"; exit 0
  fi
fi

(
  export PYTHONHASHSEED=0
  # Cuatro procesos: con todos los núcleos, un commit dejaba el PC lento medio minuto; con uno solo
  # (lo que hacen los ganchos de graphify en Windows) apps/windows tarda minutos en estar al día.
  export GRAPHIFY_MAX_WORKERS="${GRAPHIFY_MAX_WORKERS:-4}"
  while :; do
    rm -f "$pendiente"
    for rel in $proyectos; do
      echo "[graphify-refrescar] $(date '+%F %T') $raiz/$rel"
      (cd "$raiz/$rel" && "$gfy" update .) 2>&1 | tail -3
    done
    [ -f "$pendiente" ] || break
  done
  rm -rf "$cerrojo"
) < /dev/null >> "$registro" 2>&1 &

exit 0
