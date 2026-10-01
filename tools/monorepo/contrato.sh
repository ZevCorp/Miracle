#!/usr/bin/env bash
# EL CONTRATO DE LA RAÍZ — lo que prometen las herramientas comunes del monorepo: el guardia de los
# árboles (arbol.sh), el motor de los porteros (portero.sh) y el mapa de graphify (tools/graphify/). Las juzga de verdad, en un repo de
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

# Con números detrás —«contrato.sh 36 41»— se juzgan solo esas promesas: sirve para iterar sobre una
# sin esperar a las demás (el contrato entero tarda ~1 min, y varios con algo roto). Es PARCIAL y
# lo dice: nunca imprime «CONTRATO INTACTO», así que ni el portero ni el CI lo toman por veredicto.
SOLO=" $* "
total=0; rotas=0
promesa() {  # promesa <n> <enunciado> <función>
  local salida
  if [ "$SOLO" != "  " ]; then case "$SOLO" in *" $1 "*) ;; *) return 0 ;; esac; fi
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

p15() {
  # Un clon que vive dentro de OneDrive: sus carpetas .git/worktrees/<árbol> quedan marcadas de solo
  # lectura, y git borra la carpeta de trabajo pero no puede borrar esa. El 2026-09-30 pasó con
  # cuatro árboles de un barrido: el árbol ya no estaba, y la herramienta decía que no lo pudo borrar.
  como anf-g ses-g $arbol nuevo jose/solo-lectura > /dev/null 2>&1 || falla "nuevo falló"
  adm="$(git -C "$tmp/clon-arboles/solo-lectura" rev-parse --absolute-git-dir)"
  mkdir -p "$adm/logs/extra"
  chmod -R a-w "$adm" 2> /dev/null
  if command -v attrib.exe > /dev/null 2>&1; then
    attrib.exe +R "$(cygpath -w "$adm")\\*" //S //D > /dev/null 2>&1
    attrib.exe +R "$(cygpath -w "$adm")" > /dev/null 2>&1
  fi
  como anf-g ses-g $arbol cerrar jose/solo-lectura > "$tmp/out" 2>&1 || { cat "$tmp/out"; falla "cerrar no dio por cerrado un árbol terminado con su carpeta de git de solo lectura"; }
  [ ! -d "$tmp/clon-arboles/solo-lectura" ] || falla "la carpeta de trabajo sigue en el disco"
  [ ! -d "$adm" ] || falla "quedó un resto en $adm"
  git rev-parse -q --verify refs/heads/jose/solo-lectura > /dev/null && falla "la rama sigue ahí"
  [ -z "$(git worktree list | grep solo-lectura)" ] || falla "git sigue listando el árbol"
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
promesa 15 "cerrar termina de borrar un árbol cuya carpeta de git está marcada de solo lectura" p15

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

# ── el mapa del código (graphify) ──────────────────────────────────────────────────────────────────
# Lo que prometen tools/graphify/ y los ganchos que lo llaman. Por qué existen (2026-10-01): medido
# con agentes, el mapa no ahorraba nada porque llegaba desfasado —graphify solo rehace el de la raíz,
# nunca tras un pull ni dentro de un árbol de agente— y porque nadie le preguntaba lo único que
# contesta mejor que grep: a quién afecta un cambio. Un graphify de mentira apunta cada llamada; el
# de verdad no hace falta para juzgar la fontanería.
mapa="$tmp/mapa"
llamadas="$tmp/mapa-llamadas"
mkdir -p "$tmp/bin-mapa" "$tmp/home-mapa"
cat > "$tmp/bin-mapa/graphify" <<EOF
#!/usr/bin/env bash
sleep "\${FALSO_TARDA:-0}"
echo "\$(pwd -P)|\$*" >> "$llamadas"
mkdir -p graphify-out && echo '{"nodes":[],"links":[]}' > graphify-out/graph.json
EOF
chmod +x "$tmp/bin-mapa/graphify"
git init -q "$mapa"
cd "$mapa" || exit 99
mkdir -p tools/graphify tools/monorepo .githooks apps/uno/src apps/dos/src apps/uno/graphify-out
cp "$raiz"/tools/graphify/* tools/graphify/ 2> /dev/null
cp "$raiz/tools/monorepo/arbol.sh" tools/monorepo/
for g in pre-commit post-checkout post-commit post-merge; do cp "$raiz/.githooks/$g" .githooks/ 2> /dev/null; done
echo uno > apps/uno/src/a.cs; echo dos > apps/dos/src/b.cs
printf 'graphify-out/\n' > .gitignore
echo '{"nodes":[],"links":[]}' > apps/uno/graphify-out/graph.json
git config core.hooksPath .githooks
git add -A && git commit -q -m "el mapa de juguete"
mapa_raiz="$(pwd -P)"

# conmapa <comando…>: con el graphify de mentira en el PATH y un HOME sin graphify de verdad.
conmapa() { env HOME="$tmp/home-mapa" PATH="$tmp/bin-mapa:$PATH" "$@"; }
sinmapa() { env HOME="$tmp/home-mapa" PATH="$(printf '%s' "$PATH" | tr ':' '\n' | grep -v -i -e graphify -e '\.local/bin' | paste -sd:)" "$@"; }
# espera <patrón> [segundos]: el refresco corre en segundo plano; se espera a que apunte la llamada.
espera() {
  local i=0
  while [ "$i" -lt "${2:-20}" ]; do grep -q -- "$1" "$llamadas" 2> /dev/null && return 0; sleep 1; i=$((i + 1)); done
  return 1
}

g1() {
  cd "$mapa" || falla "no existe el repo del mapa"
  rm -f "$llamadas"
  echo cambio >> apps/uno/src/a.cs
  sinmapa git commit -q -am "sin graphify" > "$tmp/out" 2>&1 || { cat "$tmp/out"; falla "sin graphify instalado, el commit no pasó"; }
  sleep 2
  [ ! -f "$llamadas" ] || falla "algo llamó a un graphify que no está instalado"
}
g2() {
  cd "$mapa" || falla "no existe el repo del mapa"
  [ -f tools/graphify/refrescar.sh ] || falla "PENDIENTE: tools/graphify/refrescar.sh todavía no existe"
  rm -f "$llamadas"
  echo cambio >> apps/uno/src/a.cs
  conmapa git commit -q -am "tras un commit" || falla "el commit no pasó"
  espera "$mapa_raiz/apps/uno|update ." || falla "tras un commit no se rehízo el mapa de apps/uno"
  sleep 1
  grep -q "apps/dos" "$llamadas" && falla "construyó el mapa de apps/dos, que nadie había pedido"
  grep -q "^$mapa_raiz|" "$llamadas" && falla "rehízo el mapa de la raíz"
  rm -f "$llamadas"
  conmapa git switch -q -c jose/otra || falla "no se pudo cambiar de rama"
  espera "$mapa_raiz/apps/uno|update ." || falla "tras un cambio de rama no se rehízo el mapa"
  echo cambio >> apps/uno/src/a.cs; conmapa git commit -q -am "en la otra" > /dev/null 2>&1
  conmapa git switch -q main
  sleep 3; rm -f "$llamadas"
  conmapa git merge -q --no-edit jose/otra > /dev/null 2>&1 || falla "el merge no pasó"
  espera "$mapa_raiz/apps/uno|update ." || falla "tras un merge (lo que hace git pull) no se rehízo el mapa"
}
g3() {
  cd "$mapa" || falla "no existe el repo del mapa"
  [ -f tools/graphify/refrescar.sh ] || falla "PENDIENTE: tools/graphify/refrescar.sh todavía no existe"
  sleep 3; rm -f "$llamadas"
  conmapa git worktree add -q -b jose/arbol-mapa "$tmp/arbol-mapa" main > /dev/null 2>&1 || falla "no se pudo crear el árbol enlazado"
  arbol_raiz="$(cd "$tmp/arbol-mapa" && pwd -P)"
  espera "$arbol_raiz/apps/uno|update ." || falla "el árbol nuevo no construyó el mapa de apps/uno, que el clon principal sí tiene"
  sleep 1
  grep -q "$arbol_raiz/apps/dos" "$llamadas" && falla "el árbol construyó el de apps/dos, que el clon principal no tiene"
  return 0
}
g4() {
  cd "$mapa" || falla "no existe el repo del mapa"
  [ -f tools/graphify/refrescar.sh ] || falla "PENDIENTE: tools/graphify/refrescar.sh todavía no existe"
  sleep 3; rm -f "$llamadas"
  echo cambio >> apps/uno/src/a.cs
  inicio=$(date +%s)
  conmapa env FALSO_TARDA=6 git commit -q -am "un mapa lento" || falla "el commit no pasó"
  [ $(( $(date +%s) - inicio )) -lt 4 ] || falla "el commit esperó al mapa: tardó $(( $(date +%s) - inicio )) s"
  espera "$mapa_raiz/apps/uno|update ." 15 || falla "el mapa lento no terminó de rehacerse en segundo plano"
}
g5() {
  cd "$mapa" || falla "no existe el repo del mapa"
  [ -f tools/graphify/refrescar.sh ] || falla "PENDIENTE: tools/graphify/refrescar.sh todavía no existe"
  sleep 3; rm -f "$llamadas"
  echo cambio >> apps/uno/src/a.cs
  conmapa env GRAPHIFY_SKIP_HOOK=1 git commit -q -am "sin refresco" || falla "el commit no pasó"
  sleep 3
  [ ! -f "$llamadas" ] || falla "GRAPHIFY_SKIP_HOOK=1 no apagó el refresco"
}

# ── impacto: a quién afecta lo que cambia la rama ──────────────────────────────────────────────────
# Un mapa de juguete escrito a mano: a.cs define A (L2), .Hacer() (L5) y .Otro() (L20); b.cs llama a
# .Hacer() en su línea 7; c.cs llama a .Otro() en su línea 9; una spec cita a A.
imp="$tmp/impacto"
git init -q "$imp"
cd "$imp" || exit 99
mkdir -p tools/graphify apps/uno/src apps/uno/docs apps/uno/graphify-out apps/sinmapa/src
cp "$raiz"/tools/graphify/* tools/graphify/ 2> /dev/null
for i in $(seq 1 30); do echo "linea $i"; done > apps/uno/src/a.cs
echo b > apps/uno/src/b.cs; echo c > apps/uno/src/c.cs; echo spec > apps/uno/docs/spec.md; echo x > apps/sinmapa/src/x.cs
printf 'graphify-out/\n' > .gitignore
git add -A && git commit -q -m "el proyecto de juguete"
cat > apps/uno/graphify-out/graph.json <<'EOF'
{"directed": false, "nodes": [
 {"id": "ns", "label": "N", "type": "namespace", "file_type": "code", "metadata": {"kind": "csharp_namespace", "namespace": "N"}, "source_file": "src/a.cs", "source_location": "L1"},
 {"id": "a", "label": "A", "file_type": "code", "metadata": {"namespace": "N"}, "source_file": "src/a.cs", "source_location": "L2"},
 {"id": "a_hacer", "label": ".Hacer()", "file_type": "code", "metadata": {"namespace": "N"}, "source_file": "src/a.cs", "source_location": "L5"},
 {"id": "a_otro", "label": ".Otro()", "file_type": "code", "metadata": {"namespace": "N"}, "source_file": "src/a.cs", "source_location": "L20"},
 {"id": "b", "label": "B", "file_type": "code", "source_file": "src/b.cs", "source_location": "L1"},
 {"id": "b_usa", "label": ".Usa()", "file_type": "code", "source_file": "src/b.cs", "source_location": "L3"},
 {"id": "c_usa", "label": ".UsaOtro()", "file_type": "code", "source_file": "src/c.cs", "source_location": "L2"},
 {"id": "copia_a", "label": "A", "file_type": "code", "metadata": {"namespace": "N"}, "source_file": "sondas/copia.cs", "source_location": "L1"},
 {"id": "copia_hacer", "label": ".Hacer()", "file_type": "code", "metadata": {"namespace": "N"}, "source_file": "sondas/copia.cs", "source_location": "L3"},
 {"id": "d_usa", "label": ".UsaLaCopia()", "file_type": "code", "source_file": "src/d.cs", "source_location": "L2"},
 {"id": "nuevo", "label": ".Nuevo()", "file_type": "code", "source_file": "src/nuevo.cs", "source_location": "L1"},
 {"id": "spec", "label": "La spec", "file_type": "document", "source_file": "docs/spec.md", "source_location": "L1"}
], "links": [
 {"source": "a", "target": "a_hacer", "relation": "method", "source_file": "src/a.cs", "source_location": "L5"},
 {"source": "copia_a", "target": "copia_hacer", "relation": "method", "source_file": "sondas/copia.cs", "source_location": "L3"},
 {"source": "b_usa", "target": "a_hacer", "relation": "calls", "confidence": "EXTRACTED", "source_file": "src/b.cs", "source_location": "L7"},
 {"source": "b", "target": "ns", "relation": "imports", "confidence": "EXTRACTED", "source_file": "src/b.cs", "source_location": "L1"},
 {"source": "c_usa", "target": "a_otro", "relation": "calls", "confidence": "EXTRACTED", "source_file": "src/c.cs", "source_location": "L9"},
 {"source": "d_usa", "target": "copia_hacer", "relation": "calls", "confidence": "EXTRACTED", "source_file": "src/d.cs", "source_location": "L4"},
 {"source": "c_usa", "target": "nuevo", "relation": "calls", "confidence": "INFERRED", "source_file": "src/c.cs", "source_location": "L11"},
 {"source": "spec", "target": "a", "relation": "references", "confidence": "INFERRED", "source_file": "docs/spec.md", "source_location": "L4"}
]}
EOF
# La rama: cambia .Hacer() (la línea 6 de a.cs) y la línea 1 (la del espacio de nombres), añade un archivo nuevo y toca unas notas sin código.
# El mapa de arriba es el de después del cambio, como lo deja el refresco: ya conoce nuevo.cs, y
# —como hace graphify con dos definiciones del mismo nombre completo— le atribuye a c.cs un uso de
# .Nuevo() que no puede existir, y a la copia de sondas/ la llamada de d.cs.
git switch -q -c jose/cambio
sed -i -e 's/^linea 1$/linea 1 cambiada/' -e 's/^linea 6$/linea 6 cambiada/' apps/uno/src/a.cs
echo nuevo > apps/uno/src/nuevo.cs; echo notas > apps/uno/notas.txt; echo cambio >> apps/sinmapa/src/x.cs
git add -A && git commit -q -m "cambia .Hacer(), añade nuevo.cs y unas notas"
for viejo in apps/uno/src/a.cs apps/uno/src/nuevo.cs apps/uno/notas.txt; do
  touch -d '2000-01-01' "$viejo" 2> /dev/null || touch -t 200001010000 "$viejo"
done

impacto() { bash tools/graphify/impacto.sh "$@"; }

i1() {
  cd "$imp" || falla "no existe el repo de impacto"
  [ -f tools/graphify/impacto.sh ] || falla "PENDIENTE: tools/graphify/impacto.sh todavía no existe"
  impacto --base main apps/uno > "$tmp/out" 2>&1 || { cat "$tmp/out"; falla "impacto salió con error sobre un mapa sano"; }
  grep -q "src/b.cs:7" "$tmp/out" || { cat "$tmp/out"; falla "no nombró a src/b.cs:7, que llama a .Hacer()"; }
  grep -q "\.Hacer()" "$tmp/out" || falla "no nombró el símbolo cambiado"
}
i2() {
  cd "$imp" || falla "no existe el repo de impacto"
  [ -f tools/graphify/impacto.sh ] || falla "PENDIENTE: tools/graphify/impacto.sh todavía no existe"
  impacto --base main apps/uno > "$tmp/out" 2>&1 || falla "impacto salió con error"
  grep -q "src/c.cs" "$tmp/out" && { cat "$tmp/out"; falla "nombró a c.cs, que depende de .Otro(), y .Otro() no cambió"; }
  return 0
}
i3() {
  cd "$imp" || falla "no existe el repo de impacto"
  [ -f tools/graphify/impacto.sh ] || falla "PENDIENTE: tools/graphify/impacto.sh todavía no existe"
  impacto --base main apps/sinmapa > "$tmp/out" 2>&1; codigo=$?
  [ "$codigo" -eq 2 ] || { cat "$tmp/out"; falla "sin mapa salió con $codigo, y «no pude mirar» es 2"; }
  grep -qi "no hay mapa" "$tmp/out" || falla "sin mapa no dijo que no había mapa"
}
i4() {
  cd "$imp" || falla "no existe el repo de impacto"
  [ -f tools/graphify/impacto.sh ] || falla "PENDIENTE: tools/graphify/impacto.sh todavía no existe"
  impacto --base main apps/uno > "$tmp/out" 2>&1 || falla "impacto salió con error"
  grep -q "más viejo" "$tmp/out" && falla "avisó de un mapa viejo cuando el mapa es más nuevo que el código"
  touch apps/uno/src/a.cs; touch -d '2000-01-01' apps/uno/graphify-out/graph.json 2> /dev/null || touch -t 200001010000 apps/uno/graphify-out/graph.json
  impacto --base main apps/uno > "$tmp/out" 2>&1
  grep -q "más viejo" "$tmp/out" || { cat "$tmp/out"; falla "no avisó de que el mapa es más viejo que el código que juzga"; }
  touch apps/uno/graphify-out/graph.json
}
i5() {
  cd "$imp" || falla "no existe el repo de impacto"
  [ -f tools/graphify/impacto.sh ] || falla "PENDIENTE: tools/graphify/impacto.sh todavía no existe"
  impacto --base main apps/uno > "$tmp/out" 2>&1 || falla "impacto salió con error"
  sed -n '/[Dd]ocumentos/,$p' "$tmp/out" | grep -q "docs/spec.md" || { cat "$tmp/out"; falla "la spec que cita a A no salió bajo «Documentos»"; }
  sed -n '1,/[Dd]ocumentos/p' "$tmp/out" | grep -q "docs/spec.md" && falla "la spec salió mezclada con el código"
  return 0
}

i6() {
  # Medido el 2026-10-01 sobre el commit ff880743: una sonda nueva declaraba su propio LogBus y el
  # mapa le atribuyó 278 llamadas. Un archivo que acaba de nacer no lo usa nadie de fuera todavía.
  cd "$imp" || falla "no existe el repo de impacto"
  [ -f tools/graphify/impacto.sh ] || falla "PENDIENTE: tools/graphify/impacto.sh todavía no existe"
  impacto --base main apps/uno > "$tmp/out" 2>&1 || falla "impacto salió con error"
  grep -q "src/c.cs:11" "$tmp/out" && { cat "$tmp/out"; falla "le contó a nuevo.cs, que acaba de nacer, un uso desde c.cs"; }
  grep -qi "nuevo" "$tmp/out" || { cat "$tmp/out"; falla "no dijo que había archivos nuevos que dejó fuera"; }
}
i7() {
  # El mismo caso, del otro lado: el LogBus de verdad quedó con CERO usos en el mapa, porque todos
  # se fueron a la copia. Tocar el de verdad y leer «no afecta a nadie» es el fallo peligroso.
  cd "$imp" || falla "no existe el repo de impacto"
  [ -f tools/graphify/impacto.sh ] || falla "PENDIENTE: tools/graphify/impacto.sh todavía no existe"
  impacto --base main apps/uno > "$tmp/out" 2>&1 || falla "impacto salió con error"
  grep -q "src/d.cs:4" "$tmp/out" || { cat "$tmp/out"; falla "no contó la llamada de d.cs, que el mapa atribuyó a la otra definición de N.A.Hacer()"; }
  grep -q "sondas/copia.cs" "$tmp/out" || { cat "$tmp/out"; falla "no dijo con qué otra definición comparte nombre"; }
}
i8() {
  cd "$imp" || falla "no existe el repo de impacto"
  [ -f tools/graphify/impacto.sh ] || falla "PENDIENTE: tools/graphify/impacto.sh todavía no existe"
  touch apps/uno/notas.txt
  impacto --base main apps/uno > "$tmp/out" 2>&1 || falla "impacto salió con error"
  grep -q "más viejo" "$tmp/out" && { cat "$tmp/out"; falla "unas notas sin código, tocadas después del mapa, dispararon el aviso de mapa viejo"; }
  grep -q "\`N\`" "$tmp/out" && { cat "$tmp/out"; falla "contó el espacio de nombres N como un símbolo cambiado"; }
  return 0
}

i9() {
  # El primer comentario de verdad (PR 153) gastó tres bloques en decir «0 símbolos» de tres
  # proyectos donde solo cambiaba un .md. Un comentario con ruido deja de leerse.
  cd "$imp" || falla "no existe el repo de impacto"
  [ -f tools/graphify/impacto.sh ] || falla "PENDIENTE: tools/graphify/impacto.sh todavía no existe"
  git switch -q -c jose/solo-notas main 2> /dev/null || falla "no se pudo crear la rama de solo notas"
  echo mas >> apps/uno/docs/spec.md; git commit -q -am "solo una nota"
  impacto --base main apps/uno > "$tmp/out" 2>&1; codigo=$?
  git switch -q jose/cambio
  [ "$codigo" -eq 0 ] || { cat "$tmp/out"; falla "una rama que solo cambia notas salió con $codigo"; }
  grep -qi "no cambia código" "$tmp/out" || { cat "$tmp/out"; falla "no dijo que la rama no cambia código en el proyecto"; }
  grep -q "símbolo(s)" "$tmp/out" && { cat "$tmp/out"; falla "contó símbolos en una rama que no toca código"; }
  return 0
}

promesa 31 "sin graphify instalado, los ganchos del mapa no hacen nada y no frenan a git" g1
promesa 32 "tras commit, cambio de rama y merge se rehace el mapa de cada proyecto que lo tiene, y de ninguno más" g2
promesa 33 "un árbol enlazado nuevo construye el mapa de los proyectos que el clon principal tiene mapeados" g3
promesa 34 "el refresco no hace esperar a git: corre en segundo plano" g4
promesa 35 "GRAPHIFY_SKIP_HOOK=1 apaga el refresco" g5
promesa 36 "impacto nombra a quién de fuera llama a cada símbolo cambiado, con archivo y línea" i1
promesa 37 "impacto solo cuenta los símbolos de las líneas cambiadas, no el archivo entero" i2
promesa 38 "impacto distingue «no pude mirar» de «no afecta a nadie»: sin mapa sale con 2 y lo dice" i3
promesa 39 "impacto avisa cuando el mapa es más viejo que el código que juzga" i4
promesa 40 "impacto separa los documentos que citan lo cambiado del código que depende de ello" i5
promesa 41 "impacto deja fuera los archivos nuevos, y lo dice: nadie de fuera usa todavía lo que acaba de nacer" i6
promesa 42 "cuando dos definiciones comparten nombre completo, impacto cuenta los usos de las dos y nombra a la otra" i7
promesa 43 "ni un archivo sin código ni un espacio de nombres cuentan: no disparan el aviso de mapa viejo ni salen como símbolo cambiado" i8
promesa 44 "si la rama no cambia código en un proyecto, impacto lo dice en una línea y no cuenta símbolos" i9

echo
if [ "$SOLO" != "  " ]; then
  echo "PARCIAL: $total promesa(s) juzgada(s), $rotas incumplida(s). No vale como veredicto: corre el contrato entero."
  exit "$rotas"
fi
if [ "$rotas" -eq 0 ]; then
  verde "CONTRATO INTACTO: $total promesas."
  exit 0
fi
rojo "CONTRATO ROTO: $rotas promesa(s) incumplida(s). El cambio no puede entrar así."
exit "$rotas"
