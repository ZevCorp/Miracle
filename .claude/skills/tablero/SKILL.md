---
name: tablero
description: Muestra en qué va cada spec de cada proyecto del monorepo (Windows, Android, Mac, Graph) — estado, promesas, casillas del Cierre, antigüedad — y señala lo raro, leído de los archivos. Úsala cuando el usuario pregunte "en qué vamos", "qué specs están abiertas", "qué quedó a medias", "qué falta cerrar", "dame el estado del proyecto", "qué sigue", al empezar el día o una sesión de planificación, o antes de elegir en qué trabajar.
---

# El tablero

El estado vive en la cabecera de cada spec (`Estado: **…**`) y en su Cierre. Nadie lo ve junto, y
por eso hay specs «propuestas» desde hace siete semanas, «implementadas» con casillas sin marcar, y
números repetidos.

## 1. Sacarlo

```bash
python3 .claude/skills/tablero/scripts/tablero.py              # los cuatro proyectos
python3 .claude/skills/tablero/scripts/tablero.py windows      # uno
#   --todas     también las cerradas sin nada raro
#   --dias N    umbral de «abierta desde hace» (14 por defecto)
#   --json      para procesarlo
```

Lee `docs/specs/NNN-*.md` de cada proyecto. El portal (`apps/web`) no numera specs: no sale.

## 2. Leerlo con el usuario

No pegues la tabla entera si es larga. Resume en este orden, que es el de lo que cuesta dejarlo:

1. **Números repetidos**: cada uno es un choque latente para el juez. Propón cuál renumerar (la
   no mergeada) con `/numera`.
2. **Abiertas desde hace más de dos semanas**: ¿siguen vivas? Pregunta, no decidas. Si se
   abandonan, su estado pasa a «descartada (fecha): motivo». Una spec abandonada sin decirlo sigue
   reservando números y prometiendo cosas.
3. **Cerradas con casillas del Cierre sin marcar**: casi siempre es la prueba a mano (nivel 4) o
   aplicar una migración. Nombra la casilla, que es trabajo real pendiente.
4. **Abiertas cuyas promesas ya están en el contrato con su texto** (columna «En el contrato»,
   p. ej. `21/21`): casi seguro están terminadas y nadie actualizó la cabecera. Propón pasarlas a
   «implementado (fecha)», pero quien lo confirma es el juez del proyecto, no el tablero.
5. **Abiertas con números «de otra»**: sus números ya los usa el contrato para otras promesas. Si
   alguien las empieza tal cual, habrá dos promesas con el mismo número: renumerar con `/numera`
   antes de empezar.
6. **Sin estado o sin tabla de promesas**: specs viejas de antes del formato. Solo importa si
   están abiertas.

El cruce con el contrato lee el árbol de trabajo: Windows (`Contrato.cs` y `u/Contrato`), Graph
(`scripts/verify-*.js`) y Android (`core/src/*Test/…/contrato/`). Mac no. Si tu rama va detrás de
`origin/main`, dilo: lo de hoy en `main` no sale.

Si el usuario pregunta «qué sigue», cruza las abiertas con lo que dijo que le importa y propón
**una**, con el motivo.

## 3. Si lo quiere ver bonito

Para compartirlo con el equipo, publícalo como página: carga primero la skill `artifact-design`, y
usa `--json` como fuente de datos.

## Lo que el tablero no sabe

- Si una rama viva ya trabaja en una spec abierta: eso lo dice `git branch -r` o `/numera`.
- Si «implementado» es verdad: eso lo dice el juez del proyecto, no la cabecera.
- La fecha de git de casi todas las specs es la del traslado al monorepo (2026-09-28). Por eso la
  antigüedad se mide con la fecha que declara la cabecera cuando la hay.
