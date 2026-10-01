---
name: implementa
description: Implementa UNA fase del plan hasta que su promesa del contrato pasa a verde sin romper las anteriores. Es la etapa 4 del método. Úsala cuando exista una spec con fases y el contrato en rojo, o cuando el usuario diga "implementa la fase N", "hazlo verde", "sigue con la siguiente fase".
---

# Etapa 4 — Implementar una fase

**Una fase por vez.** Terminada es su promesa verde y todas las anteriores intactas.

Antes de tocar nada, lee «Lo que hay que saber antes de tocar» en el `AGENTS.md` del proyecto, y
sus reglas si las tiene (en Windows, `apps/windows/.claude/rules/patrones-de-desarrollo.md`: son
las formas de fallo que ese proyecto ya pagó, con fecha).

## 1. Escribir el código mínimo que pone verde esa promesa

Nada más. Lo que «ya que estoy» no está en la spec no entra en esta fase: va a la lista de
hallazgos.

Lo que vale en cualquier proyecto mientras escribes:

- **Ningún `catch` mudo.** El motivo se reporta entero, con su causa.
- **Ningún mensaje que concluya.** Describe el paso que falló. Si el texto puede salir por dos
  motivos distintos, está mal escrito.
- **Ningún paso sin rastro.** Lo omitido lo dice, y el denominador es el plan, nunca lo ejecutado.
- **Vacío no es ausente.** Un dato que viene de la red, de disco o de otra capa puede llegar vacío.
- **Nada estimado disfrazado de leído.**
- Comentarios: el **porqué, con fecha y medida**, no el qué. En español.

Y las dos que cambian el tamaño del cambio:

- **Cuenta los sitios** que tienen la clase de error que arreglas, con una búsqueda. El número va
  al commit.
- Si la fase demuestra falsa una limitación documentada, **borra la maquinaria que la compensaba**
  y su documentación, en vez de parchearla.

## 2. Juzgar

Corre el juez del proyecto (está en su `AGENTS.md`).

- [ ] **La promesa de esta fase, verde.**
- [ ] Las anteriores, intactas. Una que se rompió es una regresión, y se arregla ahora.
- [ ] Los pendientes que quedan son exactamente los de las fases que faltan.
- [ ] **No se tocó el enunciado de ninguna promesa para que pasara.** Si una estorba, la
      conversación es sobre el contrato y con el dueño.

## 3. Romper a propósito

Deshaz el cambio, o sabotéalo, y corre el juez: la promesa tiene que ponerse **roja**. Una promesa
que solo se ha visto en verde no se distingue de una que siempre dice que sí.

Comprueba que el sabotaje se aplicó (`git diff` no vacío). El 2026-08-21 uno no llegó a aplicarse y
el verde que salió no probaba nada. Commitea antes de sabotear: revertir el sabotaje con
`git checkout` se lleva el código sin commitear.

## 4. Commitear la fase

```
feat(<ámbito>): <lo que el sistema ahora hace, en minúscula, en español>

Promesa <N> en verde (<enunciado corto>). Contrato: <X>/<Y>, <Z> pendientes.
<La clase de error vivía en N sitios; los N corregidos.>
```

## 5. Reportar

Al usuario, en tres líneas: qué promesa pasó a verde, qué encontraste que no estaba en la spec, y
qué fase sigue. **Los hallazgos van a la spec**, no solo al chat.

Cuando no queden fases: `/verifica`.
