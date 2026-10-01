#!/bin/bash
# EL CONTRATO DE LA MAC — cruza las promesas de docs/specs/*.md con los test… de Tests/UCoreTests/,
# corre el corredor (NativeContract) y emite un solo veredicto.
#
#   ./contrato.sh [release|debug]     el contrato entero (solo en macOS)
#   ./contrato.sh --cruce             solo el cruce: corre en cualquier máquina, sin Swift
#
# Veredicto (última línea, siempre una de estas):
#   CONTRATO INTACTO: N promesas.
#   CONTRATO ROTO: M promesa(s) incumplida(s). El cambio no puede entrar así.
#   NO SE PUDO JUZGAR: …
#   EL CRUCE CUADRA: N promesas con juez. …           (solo con --cruce)
#
# El cruce, antes de compilar nada. Cada fila de una tabla «| # | Promesa | Juez |» nombra una
# función test…; esa función tiene que existir y ContractRunner.swift tiene que llamarla:
#   «⧗ SIN JUEZ»  la fila nombra una función que no existe o que el corredor no llama. Cuenta como
#                  incumplida: borrar el test no retira la promesa. Se retira tachándola (~~así~~).
# Y no se llega a juzgar (código 99) si un test… no es juez de ninguna fila, si el corredor no lo
# llama, si un número está en dos filas, o si el recuento que el corredor escribe en su PASS no es
# el de sus llamadas: ese número está escrito a mano, y un recuento escrito a mano puede mentir.
#
# El corredor se detiene en la primera aserción que falla. El veredicto dice cuál fue (por el
# archivo y la línea del fallo) y cuántas quedaron sin juzgar detrás: no se dan por buenas.
#
# Código de salida: 0 intacto; 99 no se pudo juzgar; si no, las promesas incumplidas.

set -u
cd "$(dirname "$0")" || exit 99

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
ambar() { printf '\033[33m%s\033[0m\n' "$*"; }
gris()  { printf '\033[90m%s\033[0m\n' "$*"; }

modo="${1:-release}"
case "$modo" in release|debug|--cruce) ;; *) echo 'Uso: ./contrato.sh [release|debug|--cruce]' >&2; exit 99 ;; esac

tests="Tests/UCoreTests"
corredor="$tests/ContractRunner.swift"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/contrato-mac.XXXXXX")" || exit 99
trap 'rm -rf "$tmp"' EXIT

# Las filas de las tablas de promesas, en su orden: N<TAB>enunciado<TAB>juez.
for spec in docs/specs/*.md; do
  [ -e "$spec" ] || continue
  tr -d '\r' < "$spec" | awk '
    /^\| *# *\| *Promesa *\| *Juez *\|/ { dentro = 1; next }
    dentro && /^\|[-:| ]+$/             { next }
    dentro && !/^\|/                    { dentro = 0; next }
    dentro {
      nf = split($0, c, "|"); n = c[2]; juez = c[nf - 1]; texto = c[3]
      for (i = 4; i < nf - 1; i++) texto = texto "|" c[i]
      gsub(/^ +| +$/, "", n); gsub(/^ +| +$/, "", texto); gsub(/[` ]/, "", juez)
      if (n ~ /^[0-9]+$/) printf "%s\t%s\t%s\n", n, texto, juez
    }'
done > "$tmp/filas"

grep -ohE 'func test[A-Za-z0-9_]+' "$tests"/*.swift | sed 's/^func //' | sort > "$tmp/definidas"
grep -oE 'tests\.test[A-Za-z0-9_]+' "$corredor" | sed 's/^tests\.//' > "$tmp/llamadas"
sort "$tmp/llamadas" > "$tmp/llamadas.orden"
awk -F'\t' '$2 !~ /^~~/ { print $3 }' "$tmp/filas" | sort > "$tmp/jueces"

errores=0
problema() { rojo "  ✘ $*"; errores=$((errores + 1)); }

if [ ! -s "$tmp/filas" ]; then
  rojo "NO SE PUDO JUZGAR: ninguna spec de docs/specs/ tiene tabla de promesas «| # | Promesa | Juez |»"
  exit 99
fi
for n in $(cut -f1 "$tmp/filas" | sort | uniq -d); do problema "la promesa $n está en dos filas de docs/specs/*.md"; done
for t in $(comm -23 "$tmp/definidas" "$tmp/llamadas.orden"); do problema "$t está definida y $corredor no la llama: nunca se juzga"; done
for t in $(comm -23 "$tmp/definidas" "$tmp/jueces"); do problema "$t no es juez de ninguna fila de docs/specs/*.md"; done
for t in $(uniq -d "$tmp/llamadas.orden"); do problema "$corredor llama dos veces a $t"; done
llamadas="$(grep -c . "$tmp/llamadas")"
dice="$(grep -oE 'PASS: [0-9]+ contracts' "$corredor" | grep -oE '[0-9]+' | head -1)"
[ "${dice:-0}" = "$llamadas" ] || problema "$corredor escribe «PASS: ${dice:-?} contracts» y llama a $llamadas"

if [ "$errores" -gt 0 ]; then
  echo
  rojo "NO SE PUDO JUZGAR: los tests y docs/specs/*.md no cuadran: $errores problema(s), arriba."
  exit 99
fi

# Una fila viva cuyo juez no existe o no corre: incumplida.
sin_juez=0
while IFS=$'\t' read -r n texto juez; do
  case "$texto" in "~~"*) continue ;; esac
  if ! grep -qx "$juez" "$tmp/llamadas.orden"; then
    ambar "  ⧗ SIN JUEZ $n · $texto"
    gris  "      la spec nombra $juez, que $corredor no llama"
    sin_juez=$((sin_juez + 1))
  fi
done < "$tmp/filas"
total="$(awk -F'\t' '$2 !~ /^~~/' "$tmp/filas" | grep -c .)"

if [ "$modo" = "--cruce" ]; then
  echo
  if [ "$sin_juez" -gt 0 ]; then
    rojo "CONTRATO ROTO: $sin_juez promesa(s) incumplida(s). El cambio no puede entrar así."
    exit "$sin_juez"
  fi
  verde "EL CRUCE CUADRA: $total promesas con juez. Compilarlas y correrlas solo se puede en macOS."
  exit 0
fi

if [ "$(uname -s)" != "Darwin" ]; then
  rojo "NO SE PUDO JUZGAR: el contrato de la Mac solo corre en macOS, y esto es $(uname -s). El cruce sí corre aquí: ./contrato.sh --cruce"
  exit 99
fi

gris "compilando el corredor ($modo)…"
if ! swift build -c "$modo" --product NativeContract > "$tmp/build.log" 2>&1; then
  grep -E 'error:' "$tmp/build.log" | head -8 | sed 's/^/     /'
  grep -qE 'error:' "$tmp/build.log" || tail -8 "$tmp/build.log" | sed 's/^/     /'
  rojo "NO SE PUDO JUZGAR: el corredor no compila."
  exit 99
fi

swift run -c "$modo" --skip-build NativeContract > "$tmp/salida" 2>&1
codigo=$?

# Dónde se detuvo: XCTFail escribe «<archivo>.swift:<línea>: <mensaje>», y esa línea cae dentro de
# una función test…. Sin esa pista (un error lanzado, un crash), no se sabe cuál fue y se dice así.

# Pasó solo si salió con 0 Y escribió su PASS con el recuento de sus llamadas: un corredor que sale
# con 0 sin decir nada no juzgó (se probó con un swift simulado el 2026-09-30).
paso=no
[ "$codigo" -eq 0 ] && grep -qE "^PASS: $llamadas contracts" "$tmp/salida" && paso=si
fallo=""; rota=""
if [ "$paso" = no ]; then
  fallo="$(grep -E 'Fatal error|error:' "$tmp/salida" | head -1)"
  [ -n "$fallo" ] || fallo="$(tail -1 "$tmp/salida")"
  [ -n "$fallo" ] || fallo="el corredor no escribió nada, ni su línea «PASS: $llamadas contracts»"
  archivo="$(printf '%s' "$fallo" | grep -oE '[A-Za-z]+Tests\.swift:[0-9]+' | head -1)"
  if [ -n "$archivo" ]; then
    rota="$(awk -v hasta="${archivo##*:}" 'NR <= hasta && match($0, /func test[A-Za-z0-9_]+/) { f = substr($0, RSTART + 5, RLENGTH - 5) } END { print f }' "$tests/${archivo%%:*}")"
  fi
fi

rotas="$sin_juez"; sin_juzgar=0; estado=ok
[ "$paso" = si ] || [ -n "$rota" ] || estado=perdido
# En el orden en que el corredor las llama: las de antes del fallo pasaron, las de después no corrieron.
while IFS= read -r juez; do
  fila="$(awk -F'\t' -v j="$juez" '$3 == j && $2 !~ /^~~/ { print $1 " · " $2; exit }' "$tmp/filas")"
  [ -n "$fila" ] || continue
  if [ "$estado" = perdido ]; then
    gris "  ? $fila"; sin_juzgar=$((sin_juzgar + 1))
  elif [ "$estado" = despues ]; then
    gris "  ⧗ SIN JUZGAR $fila"; sin_juzgar=$((sin_juzgar + 1))
  elif [ "$juez" = "$rota" ]; then
    rojo "  ✘ $fila"; gris "      $(printf '%s' "$fallo" | cut -c1-200)"
    rotas=$((rotas + 1)); estado=despues
  else
    verde "  ✔ $fila"
  fi
done < "$tmp/llamadas"

echo
if [ "$estado" = perdido ]; then
  gris "      $(printf '%s' "$fallo" | cut -c1-200)"
  rojo "CONTRATO ROTO: el corredor salió con código $codigo y no dice en qué promesa. Ninguna de las $total cuenta como cumplida. El cambio no puede entrar así."
  exit 1
fi
if [ "$rotas" -eq 0 ]; then
  verde "CONTRATO INTACTO: $total promesas."
  exit 0
fi
detras=""
[ "$sin_juzgar" -eq 0 ] || detras=" $sin_juzgar sin juzgar detrás: el corredor se detiene en la primera que falla."
rojo "CONTRATO ROTO: $rotas promesa(s) incumplida(s). El cambio no puede entrar así.$detras"
exit "$(( rotas > 98 ? 98 : rotas ))"
