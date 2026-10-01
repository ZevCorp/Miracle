#!/usr/bin/env bash
# EL CONTRATO DE LA RAÍZ — lo que prometen las herramientas comunes del monorepo: el guardia de los
# árboles (arbol.sh) y el motor de los porteros (portero.sh). Las juzga de verdad, en un repo de
# juguete con su remoto, sin tocar este: crea ramas, árboles, sesiones de agente simuladas y
# empujes, y mira qué pasa.
#
#   bash tools/monorepo/contrato.sh
#
# Veredicto (última línea): «CONTRATO INTACTO: N promesas.» o «CONTRATO ROTO: M promesa(s)
# incumplida(s). El cambio no puede entrar así.» Sale con el número de incumplidas. Lo corre el CI
# de la raíz (monorepo.yml) y el despachador cuando una rama toca tools/ o .githooks/.
#
# Los enunciados viven aquí, junto a su juez: la raíz no tiene docs/specs.

set -u

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }

raiz="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/contrato-raiz.XXXXXX")" || exit 99
trap 'cd /; rm -rf "$tmp"' EXIT

# Nada del entorno de quien lo corre: ni su sesión de agente, ni sus ganchos, ni su gh.
unset CLAUDE_CODE_HOST_SESSION_ID CLAUDE_CODE_SESSION_ID U_AGENTE U_ARBOL_CADUCA GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
export GIT_CONFIG_GLOBAL="$tmp/gitconfig" GIT_CONFIG_NOSYSTEM=1
git config --global user.name "Contrato" && git config --global user.email "contrato@example.invalid"
git config --global init.defaultBranch main && git config --global core.autocrlf false
git config --global advice.detachedHead false

# Un gh de mentira: «gh pr list … merged» contesta lo que haya en $tmp/mergeados.
mkdir -p "$tmp/bin"
printf '#!/usr/bin/env bash\ncat "%s/mergeados" 2> /dev/null\n' "$tmp" > "$tmp/bin/gh"
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH"
: > "$tmp/mergeados"

# ── el repo de juguete: un remoto, un clon con las herramientas de ESTE árbol y un proyecto ────────
git init -q --bare "$tmp/origen.git"
git clone -q "$tmp/origen.git" "$tmp/clon" 2> /dev/null
clon="$tmp/clon"
cd "$clon" || exit 99
mkdir -p tools/monorepo .githooks apps/juguete/.githooks apps/juguete/src apps/juguete/pruebas
cp "$raiz/tools/monorepo/arbol.sh" "$raiz/tools/monorepo/portero.sh" tools/monorepo/
cp "$raiz/.githooks/pre-commit" "$raiz/.githooks/post-checkout" .githooks/
cat > apps/juguete/.githooks/pre-push <<'EOF'
#!/usr/bin/env bash
NOMBRE="Juguete"
CODIGO=('src')
PROMESAS=('pruebas')
DONDE_PROMESAS="en pruebas/"
juzgar() { cat veredicto.txt; }
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
. "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)/tools/monorepo/portero.sh"
EOF
echo "CONTRATO INTACTO: 1 promesas." > apps/juguete/veredicto.txt
echo "uno" > apps/juguete/src/codigo.txt
echo "uno" > apps/juguete/pruebas/promesa.txt
git config core.hooksPath .githooks
git add -A && git commit -q -m "el juguete" && git push -q origin main 2> /dev/null
arbol="bash tools/monorepo/arbol.sh"
portero="bash apps/juguete/.githooks/pre-push"
CERO=0000000000000000000000000000000000000000

# como <anfitrión|-> <sesión|-> <comando…>: corre el comando como esa sesión de agente («- -» es una persona).
como() {
  local a="$1" s="$2"; shift 2
  [ "$a" = - ] && a=""; [ "$s" = - ] && s=""
  env ${a:+CLAUDE_CODE_HOST_SESSION_ID=$a} ${s:+CLAUDE_CODE_SESSION_ID=$s} "$@"
}
# edita <anfitrión> <sesión> <archivo>: lo que le llega al guardia desde el gancho de Claude Code.
edita() { printf '{"session_id":"%s","tool_name":"Write","tool_input":{"file_path":"%s","content":"x"}}' "$2" "$3" | como "$1" "$2" $arbol guardia; }
# empuja <rama> [<sha>]: lo que git le pasa al portero por stdin.
empuja() { printf 'refs/heads/%s %s refs/heads/%s %s\n' "$1" "${2:-$(git rev-parse HEAD)}" "$1" "$CERO" | $portero; }
commit() { git add -A && git commit -q -m "$1"; }
# falla corta la promesa AHÍ. Con «return 1» la función seguía, y su veredicto era el de su última
# línea: el 2026-09-30 siete sabotajes pasaron en verde por eso, hasta que se comprobó cada uno.
falla() { echo "$*"; : > "$tmp/fallo"; exit 1; }

total=0; rotas=0
promesa() {  # promesa <n> <enunciado> <función>
  local salida
  total=$((total + 1))
  cd "$clon" || exit 99
  rm -f "$tmp/fallo"
  salida="$("$3" 2>&1)"
  if [ ! -f "$tmp/fallo" ]; then
    verde "  ✔ $1 · $2"
  else
    rotas=$((rotas + 1))
    rojo "  ✘ $1 · $2"
    printf '%s\n' "$salida" | tail -8 | sed 's/^/      /'
  fi
}

# ── un agente, un árbol ────────────────────────────────────────────────────────────────────────────
p1() {
  echo dos >> apps/juguete/notas.txt
  commit "una persona" || falla "el commit de una persona no pasó"
  [ ! -f .git/sesion-del-arbol ] || falla "una persona dejó marca en el árbol"
}
p2() {
  edita anf-a ses-a "$clon/apps/juguete/src/codigo.txt" || falla "la primera sesión no pudo escribir"
  grep -q "^anfitrion=anf-a$" .git/sesion-del-arbol || falla "el árbol no quedó a nombre de la primera sesión"
}
p3() {
  edita anf-b ses-b "$clon/apps/juguete/src/codigo.txt" 2> "$tmp/err"; codigo=$?
  [ "$codigo" -eq 2 ] || falla "el gancho salió con $codigo, y Claude Code solo frena con 2"
  grep -q "arbol.sh nuevo" "$tmp/err" || falla "el aviso no dice cómo crear un árbol propio"
  edita anf-b ses-b "$clon/apps/juguete/carpeta/nueva/archivo.txt" 2> /dev/null && falla "dejó escribir un archivo nuevo en una carpeta que aún no existe"
}
p4() {
  echo tres >> apps/juguete/notas.txt; git add -A
  como anf-b ses-b git commit -q -m "ajeno" 2> /dev/null && falla "la otra sesión commiteó en un árbol ajeno"
  como anf-a ses-a git commit -q -m "propio" || falla "la dueña no pudo commitear en su árbol"
}
p5() {
  edita anf-a ses-reiniciada "$clon/apps/juguete/src/codigo.txt" || falla "la sesión reiniciada (mismo anfitrión, otro id) quedó fuera de su árbol"
}
p6() {
  U_ARBOL_CADUCA=0 edita anf-b ses-b "$clon/apps/juguete/src/codigo.txt" || falla "una marca caducada siguió frenando"
  grep -q "^anfitrion=anf-b$" .git/sesion-del-arbol || falla "el árbol caducado no pasó a la sesión que siguió"
}
p7() {
  edita anf-a ses-a "$clon/apps/juguete/src/codigo.txt" 2> /dev/null && falla "anf-b tenía el árbol y anf-a pudo escribir"
  como anf-a ses-a $arbol tomar > /dev/null || falla "tomar falló"
  edita anf-a ses-a "$clon/apps/juguete/src/codigo.txt" || falla "tras tomar, la sesión sigue sin poder escribir"
  como - - $arbol tomar > /dev/null 2>&1 && falla "una persona, sin sesión, pudo tomar un árbol"
}
p8() {
  como anf-c ses-c $arbol nuevo jose/prueba-uno > "$tmp/out" 2>&1 || { cat "$tmp/out"; falla "nuevo falló"; }
  [ -d "$tmp/clon-arboles/prueba-uno/apps/juguete" ] || falla "el árbol no está junto al clon, en clon-arboles/prueba-uno"
  [ "$(git -C "$tmp/clon-arboles/prueba-uno" rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || falla "la rama no nació de origin/main"
  [ "$(git -C "$tmp/clon-arboles/prueba-uno" rev-parse --abbrev-ref HEAD)" = "jose/prueba-uno" ] || falla "el árbol no está en su rama"
  git -C "$tmp/clon-arboles/prueba-uno" rev-parse -q --verify '@{upstream}' > /dev/null 2>&1 && falla "la rama nueva sigue a origin/main"
  edita anf-b ses-b "$tmp/clon-arboles/prueba-uno/apps/juguete/src/codigo.txt" 2> /dev/null && falla "el árbol nuevo no quedó a nombre de quien lo creó"
  como anf-c ses-c $arbol nuevo sin-barra > /dev/null 2>&1 && falla "aceptó una rama sin <persona>/"
}
p9() {
  cd "$tmp/clon-arboles/prueba-uno" || falla "no existe el árbol prueba-uno"
  echo cambio >> apps/juguete/src/codigo.txt
  como anf-c ses-c git commit -q -am "trabajo sin mergear" || falla "no se pudo commitear en el árbol propio"
  cd "$clon" && como anf-c ses-c $arbol cerrar jose/prueba-uno > "$tmp/out" 2>&1 && falla "cerró una rama con commits que main no tiene"
  [ -d "$tmp/clon-arboles/prueba-uno" ] || falla "borró el árbol de una rama sin terminar"
  git rev-parse -q --verify refs/heads/jose/prueba-uno > /dev/null || falla "borró una rama sin terminar"
}
p10() {
  git push -q origin jose/prueba-uno:main 2> /dev/null || falla "no se pudo llevar la rama a main en el juguete"
  echo "a medias" > "$tmp/clon-arboles/prueba-uno/sin-commitear.txt"
  como anf-c ses-c $arbol cerrar jose/prueba-uno > "$tmp/out" 2>&1 && falla "cerró un árbol con cambios sin commitear"
  [ -f "$tmp/clon-arboles/prueba-uno/sin-commitear.txt" ] || falla "se llevó un archivo sin commitear"
  grep -q "sin-commitear.txt" "$tmp/out" || falla "no nombró lo que quedaba sin commitear"
}
p11() {
  rm "$tmp/clon-arboles/prueba-uno/sin-commitear.txt"
  git push -q origin jose/prueba-uno 2> /dev/null
  como anf-c ses-c $arbol cerrar jose/prueba-uno > "$tmp/out" 2>&1 || { cat "$tmp/out"; falla "no cerró una rama cuyo trabajo ya está en main"; }
  [ ! -d "$tmp/clon-arboles/prueba-uno" ] || falla "el árbol sigue en el disco"
  git rev-parse -q --verify refs/heads/jose/prueba-uno > /dev/null && falla "la rama local sigue ahí"
  git ls-remote --exit-code --heads origin jose/prueba-uno > /dev/null 2>&1 && falla "la rama remota sigue ahí"
}
p12() {
  git fetch -q origin && git merge -q --ff-only origin/main
  como anf-d ses-d $arbol nuevo jose/prueba-dos > /dev/null 2>&1 || falla "nuevo falló"
  cd "$tmp/clon-arboles/prueba-dos" || falla "no existe el árbol prueba-dos"
  echo squash >> apps/juguete/src/codigo.txt
  como anf-d ses-d git commit -q -am "lo que se mergeará con squash" || falla "commit"
  cd "$clon" || falla "no existe el clon"
  como anf-d ses-d $arbol cerrar jose/prueba-dos > /dev/null 2>&1 && falla "cerró sin PR mergeado"
  echo "jose/prueba-dos $(git rev-parse jose/prueba-dos) 41" > "$tmp/mergeados"
  ( cd "$tmp/clon-arboles/prueba-dos" && echo posterior >> apps/juguete/src/codigo.txt && como anf-d ses-d git commit -q -am "después del PR" )
  como anf-d ses-d $arbol cerrar jose/prueba-dos > "$tmp/out" 2>&1 && falla "cerró una rama con commits posteriores a su PR mergeado"
  grep -q "posteriores al PR #41" "$tmp/out" || falla "no dijo que hay commits posteriores al PR"
  echo "jose/prueba-dos $(git rev-parse jose/prueba-dos) 41" > "$tmp/mergeados"
  como anf-d ses-d $arbol cerrar jose/prueba-dos > "$tmp/out" 2>&1 || { cat "$tmp/out"; falla "no cerró una rama con su PR mergeado por squash"; }
  [ ! -d "$tmp/clon-arboles/prueba-dos" ] || falla "el árbol sigue en el disco"
  : > "$tmp/mergeados"
}
p13() {
  como anf-e ses-e $arbol nuevo jose/de-otra > /dev/null 2>&1 || falla "nuevo falló"
  como - - $arbol nuevo jose/sin-dueno > /dev/null 2>&1 || falla "nuevo de una persona falló"
  como anf-f ses-f $arbol limpiar > "$tmp/out" 2>&1
  [ -d "$tmp/clon-arboles/de-otra" ] || falla "limpiar borró el árbol que usa otra sesión"
  [ -d "$tmp/clon-arboles/sin-dueno" ] || falla "limpiar borró un árbol sin marca que se acababa de tocar"
  U_ARBOL_CADUCA=0 como anf-f ses-f $arbol limpiar > "$tmp/out" 2>&1
  [ ! -d "$tmp/clon-arboles/de-otra" ] && [ ! -d "$tmp/clon-arboles/sin-dueno" ] || { cat "$tmp/out"; falla "limpiar no cerró árboles terminados, caducados y sin cambios"; }
  [ -d "$clon/.git" ] || falla "limpiar tocó el clon principal"
}
p14() {
  como anf-a ses-a $arbol tomar > /dev/null
  git branch -q otra-rama
  como anf-b ses-b git switch -q otra-rama 2> "$tmp/err"
  git switch -q main 2> /dev/null
  grep -q "git switch -" "$tmp/err" || { cat "$tmp/err"; falla "cambiar de rama en un árbol ajeno no avisó cómo deshacerlo"; }
}

promesa 1  "una persona en su terminal commitea sin que el guardia la toque ni la anote" p1
promesa 2  "el árbol es de la primera sesión de agente que escribe en él" p2
promesa 3  "otra sesión no puede escribir en un árbol ajeno, y el aviso le dice cómo crear el suyo" p3
promesa 4  "otra sesión no puede commitear en un árbol ajeno, y su dueña sí" p4
promesa 5  "una sesión que se reinicia bajo el mismo anfitrión sigue siendo la dueña" p5
promesa 6  "una marca sin actividad caduca, y el árbol pasa a la sesión que sigue el trabajo" p6
promesa 7  "tomar pasa el árbol a la sesión que lo pide, y solo a una sesión" p7
promesa 8  "nuevo crea la rama desde origin/main en su propio árbol, fuera del clon, a nombre de quien la crea" p8
promesa 9  "cerrar no borra una rama con commits que main no tiene" p9
promesa 10 "cerrar no borra un árbol con cambios sin commitear, y los nombra" p10
promesa 11 "cerrar borra el árbol, la rama local y la remota cuando su trabajo ya está en main" p11
promesa 12 "con squash merge, cerrar se fía del PR mergeado, y no cierra si hay commits posteriores" p12
promesa 13 "limpiar deja en paz lo que usa otra sesión y lo recién tocado, y cierra lo terminado y caducado" p13
promesa 14 "cambiar de rama en un árbol ajeno avisa cómo deshacerlo" p14

# ── el motor de los porteros ───────────────────────────────────────────────────────────────────────
rm -f .git/sesion-del-arbol
git switch -q -c jose/motor 2> /dev/null

m1() {
  empuja main > "$tmp/out" 2>&1 && falla "dejó empujar a main"
  grep -q "a main no se empuja directo" "$tmp/out" || falla "no dijo por qué"
}
m2() {
  empuja jose/motor > "$tmp/out" 2>&1 || { cat "$tmp/out"; falla "una rama sin cambios de código y con el contrato intacto no pasó"; }
  echo "CONTRATO ROTO: 1 promesa(s) incumplida(s)." > apps/juguete/veredicto.txt; commit "contrato roto"
  empuja jose/motor > "$tmp/out" 2>&1 && falla "pasó con el contrato roto"
  git reset -q --hard HEAD~1
}
m3() {
  echo "sin veredicto" > apps/juguete/veredicto.txt; commit "juez mudo"
  empuja jose/motor > "$tmp/out" 2>&1 && falla "pasó con un juez que sale con 0 y no dice INTACTO"
  git reset -q --hard HEAD~1
}
m4() {
  echo cambio >> apps/juguete/src/codigo.txt; commit "código sin promesa"
  empuja jose/motor > "$tmp/out" 2>&1 && falla "pasó una rama que cambia código y no trae promesa"
  grep -q "no añade ninguna promesa" "$tmp/out" || falla "no dijo por qué"
  empuja refactor/motor > "$tmp/out" 2>&1 || { cat "$tmp/out"; falla "una rama refactor/ no quedó exenta"; }
  echo cambio >> apps/juguete/pruebas/promesa.txt; commit "y su promesa"
  empuja jose/motor > "$tmp/out" 2>&1 || { cat "$tmp/out"; falla "no pasó con su promesa"; }
}
m5() {
  echo "CONTRATO ROTO: 1 promesa(s) incumplida(s)." > apps/juguete/veredicto.txt; commit "commit roto"
  echo "CONTRATO INTACTO: 1 promesas." > apps/juguete/veredicto.txt       # el arreglo, sin commitear
  empuja jose/motor > "$tmp/out" 2>&1 && falla "un arreglo sin commitear le dio verde a un commit roto"
  grep -q "árbol temporal" "$tmp/out" || falla "no dijo que juzgaba el commit en un árbol temporal"
  [ -z "$(git worktree list | grep portero)" ] || falla "dejó un árbol temporal sin borrar"
  git checkout -q -- apps/juguete/veredicto.txt && git reset -q --hard HEAD~1
}
m6() {
  git branch -q jose/otra origin/main
  printf 'refs/heads/jose/otra %s refs/heads/jose/otra %s\n' "$(git rev-parse jose/otra)" "$CERO" | $portero > "$tmp/out" 2>&1 || { cat "$tmp/out"; falla "una rama que no toca el proyecto no pasó"; }
  grep -q "no toca nada que cambie el veredicto" "$tmp/out" || falla "juzgó una rama que no toca el proyecto"
  echo nota >> README.md; commit "solo la raíz"
  echo "CONTRATO ROTO" > "$tmp/no-importa"
  empuja jose/motor > "$tmp/out" 2>&1 || { cat "$tmp/out"; falla "una rama cuyo único cambio nuevo está fuera del proyecto dejó de pasar"; }
}

m7() {
  # Hasta aquí el portero se llamó a mano. Git lo llama con su entorno, y desde un árbol de trabajo
  # enlazado —que es donde trabaja cada agente— ese entorno trae GIT_DIR puesto. Ahí falló el primer
  # empuje real (2026-09-30): los simulados no lo vieron.
  printf '#!/usr/bin/env bash
exec bash apps/juguete/.githooks/pre-push
' > .githooks/pre-push
  chmod +x .githooks/pre-push
  commit "el gancho de verdad"
  git worktree add -q -b jose/gancho "$tmp/arbol-gancho" jose/motor || falla "no se pudo crear el árbol enlazado"
  cd "$tmp/arbol-gancho" || falla "no existe el árbol enlazado"
  echo cambio >> apps/juguete/src/codigo.txt; echo cambio >> apps/juguete/pruebas/promesa.txt
  commit "código con su promesa"
  git push -q origin jose/gancho > "$tmp/out" 2>&1 || { cat "$tmp/out"; falla "un push de verdad con el contrato intacto no pasó"; }
  git ls-remote --exit-code --heads origin jose/gancho > /dev/null 2>&1 || falla "el push no llegó al remoto"
  antes="$(git ls-remote origin refs/heads/jose/gancho)"
  echo "CONTRATO ROTO: 1 promesa(s) incumplida(s)." > apps/juguete/veredicto.txt; commit "contrato roto"
  git push -q origin jose/gancho > "$tmp/out" 2>&1 && falla "un push de verdad con el contrato roto pasó"
  grep -q "CONTRATO ROTO" "$tmp/out" || { cat "$tmp/out"; falla "el push se detuvo, pero no por el contrato"; }
  [ "$(git ls-remote origin refs/heads/jose/gancho)" = "$antes" ] || falla "el commit roto llegó al remoto"
}

promesa 21 "a main no se empuja directo" m1
promesa 22 "un contrato roto no pasa, y uno intacto sí" m2
promesa 23 "un juez que no dice su veredicto no pasa, aunque salga con 0" m3
promesa 24 "una rama que cambia código sin traer promesa no pasa; refactor/ queda exenta" m4
promesa 25 "se juzga el commit que se empuja: un arreglo sin commitear no le da verde a un commit roto" m5
promesa 26 "una rama que no toca nada del veredicto del proyecto no se compila ni se juzga" m6
promesa 27 "llamado por git en un push de verdad desde un árbol enlazado, el portero deja pasar el contrato intacto y frena el roto" m7

echo
if [ "$rotas" -eq 0 ]; then
  verde "CONTRATO INTACTO: $total promesas."
  exit 0
fi
rojo "CONTRATO ROTO: $rotas promesa(s) incumplida(s). El cambio no puede entrar así."
exit "$rotas"
