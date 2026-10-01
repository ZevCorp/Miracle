---
name: numera
description: Da el siguiente número libre de spec y el bloque de promesas de un proyecto (Windows, Android, Mac o Graph) mirando main Y todas las ramas vivas, y avisa de números repetidos. Úsala antes de crear una spec o de escribir promesas, y siempre que el usuario pregunte "qué número le pongo", "qué spec sigue", "reserva promesas", "por qué número va el contrato", o cuando /especifica o /promesas necesiten un número. No elijas un número mirando solo main.
---

# Numerar sin chocar

Los números se elegían mirando `main`, y `main` no ve las ramas vivas. Así nacieron dos specs 005 y
dos 027 en Windows, dos 007 en Android, y las promesas 335-345 registradas dos veces en
`Contrato.cs`. La spec 075 tuvo que escribir a mano qué bloques tenían otras ramas.

## 1. Pregúntale al script, no a tu memoria

Desde la raíz del monorepo:

```bash
python3 .claude/skills/numera/scripts/numera.py <windows|android|mac|graph>
# en Windows, si no hay python3:  py .claude\skills\numera\scripts\numera.py windows
```

Hace `git fetch --prune` y mira `HEAD`, `origin/main` y cada rama local y remota. `--sin-fetch` si
no hay red (lo dice en la salida). En un clon superficial avisa: las ramas no bajadas no cuentan.

Lo que devuelve:

| Proyecto | Spec | Promesas |
|---|---|---|
| Windows | el NNN más alto en cualquier rama, +1 | el siguiente bloque redondo de 10 por encima de lo usado **y** de lo reservado en comentarios `// NNN-MMM reservadas` del contrato; la voz (`voz/Contrato`) va aparte, desde 1 |
| Android, Mac, Graph | igual | la spec NNN numera desde NNN×100+1; comprueba que nadie tenga filas en ese bloque |

## 2. Reservar

- **Windows:** copia la línea `// NNN-MMM reservadas el <fecha> para la spec <NNN>: …` que imprime
  el script, encima del banner de tu grupo de `Prueba(...)` en
  `apps/windows/tests/ContratoDelGrafo/Contrato.cs`. Así la ve la siguiente sesión aunque tu rama no
  esté mergeada.
- **Android, Graph, Mac:** el nombre del archivo de la spec ya es la reserva. Créala y empújala
  pronto (aunque sea `wip`), para que otras ramas la vean.

## 3. Si el script marca un ✘

También avisa de lo que chocará **al mergear**: una spec con el mismo NNN y otro archivo en otra
rama, y (en Windows) una rama que usa un número de promesa que en `main` ya es de otra promesa. Y de
las repetidas del contrato de la voz, que numera aparte.

- **Spec repetida** (dos archivos con el mismo NNN): no la renombres tú si es de otra persona.
  Dilo al usuario. Si es tuya y no está mergeada, renómbrala al número libre.
- **Promesa registrada dos veces** (Windows): una promesa con dos cuerpos da un verde que no dice
  cuál se juzgó. Renumera la más nueva al bloque libre y cambia su fila en la spec.
- **Promesa en dos specs** (Android/Graph/Mac): el juez sale con 99. Renumera la que no está en
  `main`.

Una reserva que se descubre falsa después (otra rama la tomó antes de que empujaras) se arregla en
tu rama: tú renumeras, la otra no.

## Al terminar

Di al usuario en una línea: «spec NNN, promesas A-B, reservadas en <archivo>», y los ✘ que
encontraste, aunque no sean tuyos.
