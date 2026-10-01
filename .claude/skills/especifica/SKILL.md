---
name: especifica
description: Convierte una petición en prosa en una especificación con promesas numeradas y verificables por máquina, guardada en docs/specs/ del proyecto. Es la etapa 1 del método y va ANTES de escribir cualquier código o test. Úsala cuando el usuario pida una feature, un arreglo de fondo, o diga "especifica", "escribe la spec", "qué debería prometer esto". Vale para Windows, Android, Mac y Graph.
---

# Etapa 1 — Especificar

Producir `<proyecto>/docs/specs/NNN-<slug>.md`, donde **cada promesa se pueda juzgar por máquina**.
Nada de código todavía, ni de tests.

Antes de empezar:

- Lee el método común: [`docs/monorepo/metodo.md`](../../../docs/monorepo/metodo.md).
- Lee «El ciclo» en el `AGENTS.md` del proyecto: dice dónde van sus specs, cómo se numeran y cuál
  es su juez. Si el proyecto tiene `.claude/rules/`, léelas también (Windows las tiene).
- Trabaja en tu propio árbol: `bash tools/monorepo/arbol.sh nuevo <persona>/<que-hace>`.

## 1. Medir el presente

Una spec que describe un futuro sin haber medido el presente inventa el problema. Antes de escribir:

1. **El log o la salida real**, no las capturas ni el código.
2. **El contrato actual** del proyecto: ¿alguna promesa ya cubre esto? ¿Alguna lo contradice?
3. **La API o el servicio**, si hay uno de por medio: una llamada de solo lectura contesta en
   minutos lo que la deducción no cierra en días.

Lo medido va con fecha en la sección *Diagnóstico*. Es lo que impide que la spec sea una opinión.

## 2. Escribir las promesas

Cada una en **una frase declarativa, en presente, en español, falsa hoy y verdadera después**. Ese
enunciado irá literal en el contrato.

Una promesa está bien escrita si:

- [ ] Se puede **falsificar**: existe una entrada concreta que la rompe.
- [ ] **No nombra la implementación.** «El servicio devuelve un diccionario» es una firma. «La misma
      entrada da la misma salida» es una promesa.
- [ ] **No se cumple declarando.** Si el sistema puede satisfacerla escribiendo un dato en vez de
      derivarlo, mide el vicio que vienes a arreglar.
- [ ] Es **una sola** cosa. Dos afirmaciones en una promesa dan un rojo que no dice cuál falta.

Las que ya se cumplen entran igual, para congelarlas. Los números no se reciclan: una promesa
retirada se tacha y deja su hueco.

## 3. Decir con qué se juzga cada una

Por promesa: qué entrada la ejercita, y con qué (un fixture congelado, un doble sin red, un caso
construido a mano). Si una promesa no se puede juzgar con el arnés que hay, dilo en la spec: esa es
la fase 0.

Si la feature cruza proyectos (Graph y un cliente), cada mitad va en la spec del proyecto donde
está su juez, y las dos van en la misma rama.

## 4. Guardar y presentar

A partir de la plantilla del proyecto (`docs/specs/PLANTILLA.md`), si la tiene. Al usuario:

- la tabla de promesas;
- **lo que la spec encontró y no estaba en la petición**;
- lo que no entra, y por qué.

Después: `/fases`.

## Lo que esta etapa no hace

No escribe código ni pruebas. Si la petición no paga el método (textos, colores, renombrados,
documentación), dilo en una frase y ofrece hacerlo directo en una rama `chore/` o `docs/`.
