---
name: clase-de-error
description: Arregla un bug como una CLASE de error y no como un caso — lo nombra en una frase, cuenta con búsquedas todos los sitios donde vive, pone un guardián que lo vea rojo antes de arreglar (una promesa o un test que escanea el código), corrige todos los sitios, y deja el número en el commit; si el arreglo demuestra falsa una limitación documentada, borra la maquinaria que la compensaba. Úsala siempre que el usuario reporte un bug o diga "arregla esto", "otra vez falla X", "pasó de nuevo", "¿dónde más pasa esto?", "que no vuelva a pasar", y después de encontrar la causa de un fallo con /lee-el-log.
---

# Arreglar la clase, no el caso

Patrón nº5 del repo: un error que se arregla en el sitio donde se vio vuelve por el sitio de al lado.
La spec 075 encontró que «el final de una sesión vieja toca la nueva» vivía en **8** sitios (5 en
`ConversacionEnVivo`, 3 en `LiveAudio`); la 072, que **8** `Process.Start` sin carpeta de trabajo
bloqueaban la actualización. El número va al commit porque es lo que demuestra que se buscó.

## 1. La causa, con evidencia

Antes de nombrar nada, la causa sale del log o de una prueba, no de leer el código
(`/lee-el-log`). Si hay dos causas posibles, todavía no hay causa.

## 2. Nombrar la clase en una frase

La forma general del error, sin el caso concreto: «un `catch` que se traga el motivo», «un id de SAP
comparado sin normalizar», «el store dice "no encontrado" sin preguntar a la base», «una sesión vieja
que, al cerrarse, toca la nueva», «un proceso lanzado sin carpeta de trabajo». Si la frase solo
describe tu archivo, es el caso, no la clase.

## 3. Contar los sitios

Busca la **forma**, no el nombre de tu variable. Varias búsquedas, porque una sola se pierde
variantes:

```bash
rg -n --type cs 'Process\.Start\(|new ProcessStartInfo' apps/windows | rg -v WorkingDirectory
rg -n 'no encontrad' apps/web/app apps/web/components
python3 .claude/skills/revisa/scripts/higiene.py --todo <carpeta> --clase <clase> --sitios   # si ya es una clase conocida
```

Clasifica cada acierto: **tiene el error / no lo tiene y por qué / no sé**. El número es «N sitios con
el error, de M aciertos». Los «no sé» se leen hasta que dejan de serlo.

## 4. El guardián, en rojo, antes del arreglo

Algo que falle mientras quede **un** sitio con el error, y que diga cuál:

| Proyecto | Guardián |
|---|---|
| Windows | una promesa en `Contrato.cs`. Si es sobre la forma del código, lee las fuentes con `U_REPO` (y si falta, `_fallos++`: un juez que no puede juzgar no da verde) |
| Android | un test en `core/src/jvmTest/…/contrato/` que lee las fuentes con `sinComentarios()` (patrón de `Contrato007SostenerParaApagar.kt`), normalizando CRLF |
| Graph | una promesa en un `scripts/verify-*.js`; para la forma del código, escanear como `verify-egress-gateway.js` |
| Portal | un `tests/*.test.ts` que escanea con `readFileSync`/`readdirSync` y **nombra el archivo culpable**, como `tests/route-guards.test.ts` y `tests/store-foto-vieja.test.ts`, con el incidente (fecha, síntoma) en su comentario |

Y si la clase se puede ver con un grep, añádela también a las reglas de
`.claude/skills/revisa/scripts/higiene.py` (`REGLAS`: clase, ✘/⚠, extensiones, regex, de dónde sale,
qué hacer), para que `/revisa` la vea en cada rama futura.

Córrelo **antes** de arreglar: tiene que salir rojo y nombrar los N sitios. Un guardián que nace
verde no vigila nada (`/sabotea` lo comprueba).

## 5. Arreglar todos

Los N, en esta rama. Normaliza en un solo sitio cuando la clase es «dos formas de lo mismo»
(aprendizaje nº16). El guardián pasa a verde; vuelve a buscar con las mismas búsquedas: 0.

**Si el arreglo demuestra falsa una limitación documentada** (un comentario, una regla, un rodeo que
existía porque «X no se puede»), borra la maquinaria que la compensaba y su documentación, en vez de
dejarla al lado (patrón nº6). Código muerto que compensa un problema que ya no existe es el próximo
error.

## 6. Commit

```
fix(<ámbito>): <lo que ya no pasa, en la voz del repo>

La clase de error vivía en N sitios (A en X, B en Y); los N corregidos. <El guardián: promesa NNN
o tests/…test.ts, visto rojo con los N sitios antes del arreglo.>
```

Y si encontraste sitios que no son de esta rama (otro proyecto, otra persona), anótalos en la spec
bajo «Hallazgos» y díselo al usuario, en vez de ensanchar el cambio.
