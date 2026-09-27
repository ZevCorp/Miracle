# La velocidad de u/ en U.exe

Estado: **en curso** (2026-09-27) · Rama `jose/u-pulsar-en-main` (sigue a la 053) · Decisiones del agente, sin
preguntas, por orden del dueño.

## Qué se quiere

> «Lo que más me importa es la velocidad, no me importa absolutamente nada más. […] Si cuesta cierta cantidad de
> milisegundos, se va. […] Si puedes conservar sobre todo sus funcionalidades, como la ejecución por batches, la
> memoria, cool. Pero si hay que eliminar algo o desconectarlo por completo, lo que rediseñemos hoy es lo que
> importa.» — el dueño, 2026-09-27

Un ciclo —ver → clic → volver a ver— de U.exe a la misma velocidad que `u/`, para computer use en general, SAP
incluido. Lo que se desconecta queda localizado en [`docs/patrimonio-del-grafo.md`](../patrimonio-del-grafo.md):
vive entero en `334f144`.

## La línea base (2026-09-27, este PC, plan fijo sin decidir)

Sondas: `medir-ciclo-rama.ps1` (map_take por el MCP, como la voz) y `ciclo-u-fijo` (el núcleo de `u/`). Los mismos
clics: Configuración ×20, Explorador ×12, Calculadora ×8-16.

| mediana por ciclo | rama | u/ |
|---|---|---|
| el clic | 76 ms | 61 ms |
| esperar el cambio | 953 ms | 489 ms |
| lo demás del acto (compuerta de vivo, ubicaciones, lectores viejos) | 597 ms | 0 |
| volver a mirar (`LoQueVeo`, otra lectura entera, de la ventana de la persona) | 413 ms | 0 — reusa la de la espera |
| **ciclo** | **2.268 ms** | **502 ms** |

Sin el latido, la ubicación de fondo y el rastro del cursor: 1.999 ms (−12 %). Lo gordo está en el camino del clic.

## El diseño: el ciclo de u/, tal cual, dentro de map_take

Un clic por nombre en UIA pasa por `CicloRapido`, que es el ciclo de `u/` y nada más:

1. **Ver**: la última lectura de esa ventana si tiene < 2 s (la que dejó el ciclo anterior); si no, una lectura
   (`U.Ciclo.LectorUia`, una petición a UIA).
2. **Clic**: el elemento por su nombre (entre homónimos, por `which`), ratón real en su centro.
3. **Volver a ver**: `Asentado.Esperar` de `u/` — sale al primer cambio de la huella (accionables, textos, foco);
   techo 150 ms, 1,5 s tras un enlace. La lectura con la que sale ES la respuesta: se contesta con ella, accionables
   y textos, y no se vuelve a leer.

Fuera del ciclo, desconectado: la compuerta de vivo (`EsperarloVivo`), las ubicaciones (`SurfaceLocator`) por clic,
el asentado de la 475, el ensayo del doble clic y la repetición, el `LoQueVeo` pegado, `Grafo.Cruzar` por clic.
Lo que no es un clic por nombre en UIA —SAP, selectores por AutomationId, destinos del grafo que no están en
pantalla— sigue por el camino de siempre, que no se toca en esta fase.

## Fases

| Fase | Pieza | Promesas | Termina cuando |
|---|---|---|---|
| 1 | el ciclo rápido de `map_take` | 485-488 | ciclo de la rama ≈ u/ en el plan fijo |
| 2 | fuera el fondo: latido, ubicación y rastro del cursor | 489 | sin lecturas de fondo compitiendo, abrir no se cuelga |
| 3 | mirar y escribir con la misma lectura | 490+ | `map_what_i_see` y `map_type` sin lectores viejos |
| 4 | SAP | — | medido en una sesión real (hoy no hay en este PC) |
| 5 | borrar lo muerto y lo duplicado | — | cada borrado con su medida |

| # | Promesa |
|---|---|
| 485 | un clic por nombre va por el ciclo rápido: si lo pedido es UN elemento visible de la lectura, pulsa en su centro, espera como u/ (sale al primer cambio de la huella; techo 150 ms, 1,5 s tras un enlace) y contesta lo que pulsó, si cambió, y lo que se ve DESPUÉS —accionables y textos— con la lectura de esa misma espera, marcado EN PANTALLA AHORA para que nadie vuelva a leer |
| 486 | homónimos sin `which`: la lista 1..N en orden de lectura con su tipo, sin pulsar; con `which`=N pulsa ese y solo ese |
| 487 | antes de pulsar el ciclo lee como mucho UNA vez, y ninguna si la última lectura de esa ventana tiene menos de 2 s; lo que no está se busca en UNA lectura nueva, y si tampoco está, el ciclo no se encarga y decide el camino de siempre |
| 488 | con el freno echado no pulsa y lo dice; SAP y los selectores que no van por nombre no pasan por el ciclo rápido |

## Promesas retiradas

(se anotan aquí con su número y el porqué, a medida que se retiren)

## Hallazgos
