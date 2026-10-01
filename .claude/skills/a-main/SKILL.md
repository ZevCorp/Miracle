---
name: a-main
description: Lleva una rama verificada a main de forma segura — comprobaciones previas, ponerse al día con main, PR con la tabla de evidencia, squash merge y cierre del árbol y la rama. Es la etapa 6 del método. Úsala cuando el usuario diga "sube esto a main", "abre el PR", "mergea", "listo para integrar". No la uses si /verifica no está en verde.
---

# Etapa 6 — El paso a `main`

`main` roto bloquea a todos. Esta skill prepara, comprueba y propone; el push, el PR y el merge los
confirma el usuario, salvo que ya haya dicho que los hagas.

Reglas: [`ramas-y-commits.md`](../../rules/ramas-y-commits.md).

## 1. Antes de tocar la red

- [ ] **No estamos en `main`**, y la rama sigue la convención `<persona>/<que-hace>`.
- [ ] **El árbol es tuyo y está limpio.** Nada sin commitear.
- [ ] **La spec está al día**: los hallazgos están escritos en ella, y su estado pasó a
      *implementado*, con fecha.
- [ ] **`/verifica` en verde**, con `CONTRATO INTACTO` y 0 pendientes.
- [ ] **No se coló nada que no se commitea**: `.env`, `out/`, `bin/`, `node_modules/`. Mira
      `git diff --stat origin/main...HEAD` entero.

## 2. Ponerse al día

```bash
git fetch origin
git pull --rebase origin main
```

**Después del rebase se vuelve a verificar.** Un rebase limpio no es un contrato verde: lo nuevo de
`main` puede romper una promesa tuya.

## 3. El PR

```bash
git push -u origin <persona>/<que-hace>
gh pr create --base main --title "<mismo estilo que el commit>" --body-file <cuerpo>
```

El cuerpo sale de [`.github/pull_request_template.md`](../../../.github/pull_request_template.md) y
no puede faltarle:

1. **Qué promete ahora el sistema que antes no**, con los números de promesa.
2. **La tabla de evidencia**, pegada literal.
3. **En cuántas pantallas, apps o dispositivos se probó, con nombre.**
4. **En cuántos sitios vivía la clase de error** y cuántos se corrigieron.
5. **Lo que se dejó fuera**, y por qué.

`main` exige el check `compuerta`, que corre el CI de cada proyecto que el PR toca. Si sale rojo allí
y verde en local, no es «cosa del CI»: es una diferencia de máquina, y encontrarla es el trabajo.

## 4. Mergear

- **Squash merge.** Los doce `wip` entran como uno, con mensaje limpio.
- Mergear tú mismo está bien **si nadie más tocó esos archivos**. Si el PR cruza territorio ajeno,
  se pide ojo antes.

## 5. Cerrar

```bash
bash tools/monorepo/arbol.sh cerrar <persona>/<que-hace>
```

Borra el árbol de trabajo y la rama, después de comprobar que el PR está mergeado y que no queda
nada sin commitear. Si algo queda, lo nombra y no lo borra: lo decides tú. La rama remota la borra
GitHub al mergear.

Y al usuario, en una línea: qué entró, con qué evidencia, y qué queda pendiente de la spec.

## Lo que nunca se hace sin que lo pidan

Commitear, pushear, mergear, `push --force`, `reset --hard`, tocar `main` directamente.
