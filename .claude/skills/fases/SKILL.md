---
name: fases
description: Parte una especificación en fases ordenadas, cada una con la promesa que pone verde, lo que toca y su criterio de terminado. Es la etapa 2 del método, va después de /especifica y antes de /promesas. Úsala cuando exista una spec en docs/specs/ de un proyecto y haya que decidir el orden de implementación, o cuando el usuario diga "haz el plan", "en qué fases", "por dónde empiezo".
---

# Etapa 2 — Partir en fases

Entrada: una spec en `<proyecto>/docs/specs/`. Salida: la tabla de fases **dentro de esa misma
spec**. Un plan que vive lejos de sus promesas se desincroniza.

## Qué es una fase

**Un commit que pone verde una promesa concreta sin romper ninguna anterior.** Si no puedes nombrar
qué promesa pasa a verde, no es una fase: es «trabajo».

| Campo | Regla |
|---|---|
| **Promesa que pone verde** | exactamente una, por número. Dos promesas son dos fases |
| **Qué toca** | los archivos, nombrados |
| **Terminado** | «promesa N verde, las anteriores intactas». Nada de «funciona bien» |
| **Tamaño** | medio día. Si no cabe, son dos fases |

## El orden

1. **El arnés primero.** Si alguna promesa no se puede escribir con lo que hay (falta un fixture,
   un doble, una sonda), esa es la fase 0.
2. **Después lo que desbloquea:** la capacidad de la que dependen otras promesas.
3. **Al final lo que cierra el asunto:** la promesa que, mientras no exista, deja que todo lo demás
   sea cosmético. Identifícala y no la dejes fuera del alcance.

Las que ya nacen verdes no llevan fase: se marcan «ninguna: ya se cumple; se congela».

## Toda la spec en una rama

Una rama es una feature, y una feature es una spec entera. Las fases son commits dentro de ella. No
se mergea fase a fase: una rama que llega a `main` con promesas pendientes deja `main` rojo para
todos. Si la spec no cabe en tres días, se parte en dos specs con promesas propias.

## Riesgos, y qué los desactiva

Por fase, si aplica: **en cuántos sitios más vive la clase de error** que vas a tocar. Cuéntalos
ahora con una búsqueda, no después: el número decide si la fase es una o son tres.

Si el cambio elimina una limitación que estaba documentada, la fase **borra la maquinaria que la
compensaba**, no la parchea. Escríbelo así, con los archivos a borrar.

## Presentar

La tabla de fases, cuál necesita autorización del dueño, y en qué orden se verán los rojos volverse
verdes. Después: `/promesas`.
