#!/usr/bin/env bash
# ENSAYO DEL PUSH — lo que va a decir el portero, antes de empujar, y lo que el portero no mira.
#
#     bash .claude/skills/antes-del-push/scripts/ensayo.sh [--sin-fetch] [--sin-portero]
#
# Juzga LO QUE SE EMPUJARÍA (HEAD), igual que el push de verdad: le pasa al despachador de la raíz
# (.githooks/pre-push) la misma línea que git le daría por stdin. Antes mira lo que el portero no:
# la rama, el gancho activado, cuánto vas detrás de main, si la rama nació antes del monorepo, qué
# porteros no pueden correr en esta máquina, y secretos en lo añadido (el repo es público).
#
# Sale con 0 si el push pasaría, 1 si no, 99 si no se pudo ensayar.
# Escrito para bash 3.2 (macOS) y Git Bash (Windows): sin arrays asociativos ni ${var,,}.

set -u
rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
ambar() { printf '\033[33m%s\033[0m\n' "$*"; }
gris()  { printf '\033[90m%s\033[0m\n' "$*"; }

fetch=si; portero=si
for a in "$@"; do
  case "$a" in
    --sin-fetch) fetch=no ;;
    --sin-portero) portero=no ;;
  esac
done

raiz="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "NO SE PUDO ENSAYAR: no estás en un repo git"; exit 99; }
cd "$raiz" || exit 99
rama="$(git rev-parse --abbrev-ref HEAD)"
sha="$(git rev-parse HEAD)"
avisos=0; bloqueos=0

echo
echo "  ── ensayo del push · $rama · ${sha:0:9} ──────────────"

# ── la rama ──────────────────────────────────────────────────────────────────────────────────────
if [ "$rama" = "main" ] || [ "$rama" = "HEAD" ]; then
  rojo "  ✘  estás en $rama: a main no se empuja directo. Crea tu árbol:"
  echo "       git stash -u && bash tools/monorepo/arbol.sh nuevo <persona>/<que-hace>"
  exit 1
fi
case "$rama" in
  chore/*|docs/*|refactor/*|hotfix/*)
    gris "  ·  rama ${rama%%/*}/: exenta de traer promesa (en Android, solo si no toca código)";;
  */*)
    printf '%s' "$rama" | grep -qE '^[a-z0-9]+/[a-z0-9][a-z0-9-]*$' \
      || { ambar "  ⚠  «$rama» no sigue <persona>/<que-hace> en minúscula y kebab-case"; avisos=$((avisos+1)); } ;;
  *) ambar "  ⚠  «$rama» no tiene <persona>/: el portero no la reconoce como de nadie"; avisos=$((avisos+1));;
esac

# ── el gancho ────────────────────────────────────────────────────────────────────────────────────
if [ "$(git config core.hooksPath)" != ".githooks" ]; then
  ambar "  ⚠  el portero NO está activado en este clon: el push de verdad no lo correrá"
  echo "       git config core.hooksPath .githooks"
  avisos=$((avisos+1))
fi

# ── main ─────────────────────────────────────────────────────────────────────────────────────────
if [ "$fetch" = si ]; then
  git fetch -q origin main 2>/dev/null || { ambar "  ⚠  git fetch falló: se compara con el origin/main que hay en local"; avisos=$((avisos+1)); }
fi
if git rev-parse -q --verify origin/main >/dev/null; then
  detras="$(git rev-list --count HEAD..origin/main)"
  delante="$(git rev-list --count origin/main..HEAD)"
  base="$(git merge-base HEAD origin/main)"
  if ! git cat-file -e "$base:apps" 2>/dev/null; then
    rojo "  ✘  la rama nació antes del monorepo (2026-09-28): ponla al día primero"
    echo "       git fetch origin && bash <(git show origin/main:tools/monorepo/ponerse-al-dia.sh)"
    bloqueos=$((bloqueos+1))
  fi
  if [ "$detras" -gt 0 ]; then
    ambar "  ⚠  vas $detras commit(s) detrás de main ($delante delante). Antes del PR: git pull --rebase origin main, y vuelve a verificar"
    avisos=$((avisos+1))
  else
    gris "  ·  al día con main ($delante commit(s) delante)"
  fi
else
  ambar "  ⚠  no hay origin/main: no se sabe qué toca la rama, y el despachador llamará a todos los porteros"
  base=""
  avisos=$((avisos+1))
fi

# ── lo que no está commiteado ────────────────────────────────────────────────────────────────────
sucio="$(git status --porcelain)"
if [ -n "$sucio" ]; then
  n="$(printf '%s\n' "$sucio" | grep -c .)"
  ambar "  ⚠  $n archivo(s) sin commitear: el push NO los lleva, y el portero juzga el commit (en un árbol temporal, más lento)"
  printf '%s\n' "$sucio" | head -8 | sed 's/^/       /'
  avisos=$((avisos+1))
fi

# ── qué toca, y qué porteros puede correr esta máquina ───────────────────────────────────────────
if [ -n "$base" ]; then
  tocado="$(git -c core.quotepath=false diff --name-only "$base" HEAD)"
else
  tocado=""
fi
if [ -z "$tocado" ] && [ -n "$base" ]; then
  ambar "  ⚠  la rama no tiene commits propios respecto a main: no hay nada que empujar"
  avisos=$((avisos+1))
fi
so="$(uname -s 2>/dev/null)"
for p in apps/windows apps/android apps/mac apps/web services/graph; do
  printf '%s\n' "$tocado" | grep -q "^$p/" || continue
  n="$(printf '%s\n' "$tocado" | grep -c "^$p/")"
  falta=""
  case "$p" in
    apps/windows) command -v dotnet >/dev/null && command -v powershell >/dev/null || falta="dotnet y powershell (su portero compila WPF: solo en Windows)";;
    apps/android) { [ -n "${ANDROID_HOME:-}" ] || [ -f apps/android/local.properties ] || [ -d "$HOME/Android/Sdk" ]; } && command -v java >/dev/null || falta="el SDK de Android y un JDK 17";;
    apps/mac) [ "$so" = Darwin ] || falta="macOS (fuera de él solo se comprueba el cruce: ./contrato.sh --cruce)";;
    services/graph) command -v node >/dev/null || falta="node";;
    apps/web) falta="(sin portero local: lo juzga web-ci.yml en el PR; córrelo antes con /verifica-web)";;
  esac
  if [ -n "$falta" ]; then
    ambar "  ·  $p · $n archivo(s) · aquí falta: $falta"
  else
    gris "  ·  $p · $n archivo(s)"
  fi
done
fuera="$(printf '%s\n' "$tocado" | grep -vE '^(apps|services)/' | grep -c . || true)"
[ "$fuera" -gt 0 ] && gris "  ·  la raíz · $fuera archivo(s) (comprobar-raiz.sh; el contrato de la raíz si toca tools/ o .githooks/)"

# ── secretos: el repo es PÚBLICO ─────────────────────────────────────────────────────────────────
if [ -n "$base" ]; then
  archivos_malos="$(git -c core.quotepath=false diff --name-only --diff-filter=A "$base" HEAD | grep -E '(^|/)\.env($|\.)|\.jks$|\.keystore$|\.p12$|\.pfx$|apikey\.properties$|local\.properties$|(^|/)id_rsa' | grep -v '\.env\.example$' || true)"
  # Patrones de credenciales en lo AÑADIDO. Se imprime el archivo y el tipo, nunca el valor.
  lineas="$(git diff -U0 "$base" HEAD | grep -E '^\+[^+]' || true)"
  tipos=""
  printf '%s' "$lineas" | grep -qE 'sk-(proj-)?[A-Za-z0-9_-]{20,}' && tipos="$tipos clave-openai"
  printf '%s' "$lineas" | grep -qE 'sk-ant-[A-Za-z0-9_-]{20,}' && tipos="$tipos clave-anthropic"
  printf '%s' "$lineas" | grep -qE 'AIza[0-9A-Za-z_-]{35}' && tipos="$tipos clave-google"
  printf '%s' "$lineas" | grep -qE 'gh[pousr]_[A-Za-z0-9]{36,}' && tipos="$tipos token-github"
  printf '%s' "$lineas" | grep -qE 'eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.' && tipos="$tipos jwt"
  printf '%s' "$lineas" | grep -qiE '(service_role|SUPABASE_SERVICE_ROLE_KEY|storePassword|keyPassword|password)\s*[:=]\s*["'"'"'][^"'"'"'$<{ ]{8,}' && tipos="$tipos contraseña-o-service-role"
  if [ -n "$archivos_malos" ] || [ -n "$tipos" ]; then
    rojo "  ✘  posible secreto en lo que se empuja (el repo es público: un push no se des-publica)"
    [ -n "$archivos_malos" ] && printf '%s\n' "$archivos_malos" | sed 's/^/       archivo: /'
    [ -n "$tipos" ] && echo "       en líneas añadidas:$tipos   (busca con: git diff $(printf '%.9s' "$base") HEAD | grep -nE '<patrón>')"
    echo "       Va a los secretos de GitHub Actions, a Vercel o a un .env ignorado. Si ya se empujó: rotarlo."
    bloqueos=$((bloqueos+1))
  fi
fi

# ── el portero, con la misma línea que le pasaría git ───────────────────────────────────────────
codigo=0
if [ "$portero" = si ]; then
  echo
  gris "  … el portero (juzga ${sha:0:9}, lo que se empujaría)"
  printf 'refs/heads/%s %s refs/heads/%s 0000000000000000000000000000000000000000\n' "$rama" "$sha" "$rama" | bash .githooks/pre-push
  codigo=$?
fi

echo
echo "  ── resultado del ensayo ──"
if [ "$bloqueos" -gt 0 ] || [ "$codigo" -ne 0 ]; then
  rojo "  NO PASARÍA: $([ "$codigo" -ne 0 ] && echo "el portero está en rojo")$([ "$codigo" -ne 0 ] && [ "$bloqueos" -gt 0 ] && echo " · ")$([ "$bloqueos" -gt 0 ] && echo "$bloqueos bloqueo(s) que el portero no mira")"
  exit 1
fi
if [ "$avisos" -gt 0 ]; then
  ambar "  PASARÍA, con $avisos aviso(s) arriba."
else
  verde "  PASARÍA."
fi
[ "$portero" = no ] && gris "  (sin portero: --sin-portero)"
exit 0
