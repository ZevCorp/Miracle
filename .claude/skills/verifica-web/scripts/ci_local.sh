#!/usr/bin/env bash
# CI LOCAL DEL PORTAL — lo mismo que corre web-ci.yml en el PR, en el mismo orden y con las mismas
# variables de mentira, y la tabla de evidencia al final.
#
#     bash .claude/skills/verifica-web/scripts/ci_local.sh [--sin-install] [--sin-build]
#
# Por qué existe: el portal no tiene portero local (el despachador lo dice: «lo juzga su CI en el
# PR»). Sin esto, el primer lint/typecheck/build de una rama del portal es el del CI, un PR después.
# Las variables son las del workflow a propósito: un build que solo pasa con tu .env.local de
# verdad no es el build que va a correr el CI.
#
# Sale con el número de pasos en rojo.

set -u
rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
gris()  { printf '\033[90m%s\033[0m\n' "$*"; }

install=si; build=si
for a in "$@"; do
  case "$a" in --sin-install) install=no ;; --sin-build) build=no ;; esac
done

raiz="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "NO SE PUDO: no estás en el repo"; exit 99; }
cd "$raiz/apps/web" || { echo "NO SE PUDO: no hay apps/web"; exit 99; }

# Las de web-ci.yml, literales. .env.local NO se carga en lint/typecheck/test; en build, Next lo lee
# si existe, así que se aparta mientras dura el build para que el resultado sea el del CI.
export NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_ci_dummy"
export NEXT_PUBLIC_SITE_URL="http://localhost:3000"

node_v="$(node -v 2>/dev/null || echo ninguno)"
case "$node_v" in v20*) ;; *) gris "  · node $node_v aquí; el CI usa node 20 (si algo solo falla allí, empieza por eso)";; esac

filas=""; rojos=0
paso() {  # paso <nombre> <comando…>
  local nombre="$1"; shift
  local ini fin salida codigo
  ini=$(date +%s)
  printf '  … %s\n' "$nombre"
  salida="$("$@" 2>&1)"; codigo=$?
  fin=$(date +%s)
  if [ $codigo -eq 0 ]; then
    verde "  ✔ $nombre ($((fin-ini)) s)"
    filas="$filas| $nombre | ✅ | $((fin-ini)) s |"$'\n'
  else
    rojo "  ✘ $nombre ($((fin-ini)) s, código $codigo)"
    printf '%s\n' "$salida" | grep -vE '^\s*$' | tail -25 | sed 's/^/      /'
    local resumen
    resumen="$(printf '%s\n' "$salida" | grep -E 'error|Error|✗|×|FAIL|failed' | head -1 | cut -c1-120 | sed 's/|/\\|/g')"
    filas="$filas| $nombre | ❌ | ${resumen:-código $codigo} |"$'\n'
    rojos=$((rojos+1))
  fi
}

echo
echo "  ── CI local del portal (web-ci.yml) ──"
if [ "$install" = si ]; then
  paso "npm install" npm install --no-audit --no-fund
else
  [ -d node_modules ] || { rojo "  ✘ no hay node_modules: quita --sin-install"; exit 99; }
  filas="$filas| npm install | ⚪ no corrido | --sin-install |"$'\n'
fi
paso "lint" npm run lint
paso "typecheck" npm run typecheck
paso "test" npm run test
if [ "$build" = si ]; then
  apartado=""
  if [ -f .env.local ]; then mv .env.local .env.local.ci-local-apartado && apartado=si; fi
  paso "build" npm run build
  [ -n "$apartado" ] && mv .env.local.ci-local-apartado .env.local
else
  filas="$filas| build | ⚪ no corrido | --sin-build |"$'\n'
fi

echo
echo "| Paso (web-ci.yml) | Resultado | Detalle |"
echo "|---|---|---|"
printf '%s' "$filas"
echo
if [ "$rojos" -eq 0 ]; then verde "  CI LOCAL EN VERDE"; else rojo "  CI LOCAL EN ROJO: $rojos paso(s)"; fi
exit "$rojos"
