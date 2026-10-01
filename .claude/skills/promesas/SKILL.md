---
name: promesas
description: Escribe las promesas de una spec como pruebas ejecutables en el contrato del proyecto ANTES de que exista el código que las cumple, y comprueba que el contrato queda rojo por las razones escritas. Es la etapa 3 del método (fase roja). Úsala cuando exista una spec con fases y toque escribir el contrato, o cuando el usuario diga "escribe las promesas", "pon el contrato en rojo", "los tests primero".
---

# Etapa 3 — Poner el contrato en rojo

**El entregable de esta etapa es un rojo**, con nombre y con motivo:

```
⧗ PENDIENTE 1203 · <el enunciado>
CONTRATO ROTO: 3 promesa(s) incumplida(s). El cambio no puede entrar así.
```

## Dónde y cómo se escribe, por proyecto

El enunciado va **literal**, igual que en la spec. Dónde vive el contrato y cuál es su juez está en
«El ciclo» del `AGENTS.md` del proyecto; lo propio de cada uno:

| Proyecto | La promesa es | Lo que hay que saber |
|---|---|---|
| Windows | `Prueba("N. <enunciado>", Cuerpo)` en `tests/ContratoDelGrafo/Contrato.cs` | las reglas del arnés están en `apps/windows/.claude/rules/flujo-sdd.md` |
| Android | un método `promesaN` en `core/src/commonTest/…/contrato/ContratoNNN<Nombre>.kt` | una capacidad que aún no existe falla con `TODO()`, que el juez lee como pendiente |
| Mac | una función `test…` en `Tests/UCoreTests/`, su llamada en `ContractRunner.swift` y su fila en la spec | el recuento de la línea `PASS` del corredor tiene que cuadrar |
| Graph | `await promesa(N, '<enunciado>', async () => { … })` en un `scripts/verify-<slug>.js` | `scripts/lib/promesas.js`; una capacidad que aún no existe se pide con `pendiente('<nombre>')` |

Reglas que valen en todos:

- **Una capacidad ausente cuenta como incumplida**, nunca como «no aplicable»: eso sumaría al verde
  y el contrato certificaría el vacío.
- **Una afirmación por comprobación**, con el texto en la voz de la promesa. Dos condiciones en una
  dan un rojo que no dice cuál falló.
- **Ningún `try/catch` que se trague el motivo** dentro del cuerpo. El arnés ya enseña la causa
  entera.

## Comprobar que el rojo es el correcto

Corre el juez del proyecto y verifica **una por una**:

- [ ] Cada promesa nueva falla, y falla por **la razón escrita**: no por un error del arnés ni por
      un nombre mal escrito.
- [ ] Las promesas antiguas **siguen verdes**. Si alguna se puso roja al añadir las nuevas, el
      arnés se contaminó: arréglalo ahora.
- [ ] El recuento de pendientes **coincide con las fases** que faltan.
- [ ] Si alguna promesa nueva **ya está verde**, confírmalo intencional y anótalo. Una promesa que
      nace verde por accidente suele estar mal escrita: no se puede falsificar.

## Commitear el rojo

```
test(<ámbito>): las promesas de <lo que sea>, escritas antes que su código
```

El rojo se commitea. Es el registro de que la prueba no se escribió para pasar.

Después: `/implementa`, fase por fase.
