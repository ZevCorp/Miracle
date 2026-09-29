# Plan de implementación: Luna planea por objetivos, Jeff ejecuta

Estado: **en curso (2026-09-28, noche)** · Nace de la sesión de voz del dueño del 2026-09-28 (p33388) y de su hipótesis
del 20/80 · Rama: `jose/plan-por-objetivos`, apilada sobre `jose/u-pulsar-en-main`

> **Apilada a propósito.** Esta rama sale de `jose/u-pulsar-en-main` y no de `main`: el plan por objetivos corre sobre el
> ciclo rápido (spec 054) y la carita (spec 061), que todavía no están en `main`. Es la misma excepción que la 061.

## Qué se quiere

El dueño, el 2026-09-28: que el tiempo de una tarea sea **80 % Jeff ejecutando y 20 % Luna pensando**. Luna hace un
plan estructurado pero amplio, por objetivos; Jeff (el ciclo rápido y Jev) lo cumple con libertad para navegar dentro de
cada objetivo. Y probarlo **como él**, con órdenes que entren por el mismo camino que su voz, sin baterías de más.

## Diagnóstico: qué se midió

| Qué | Medida | Fuente |
|---|---|---|
| Parte de la tarea en que Luna pensaba | ~59 de 77 s (≈ 77 %) | sesión p33388, huecos entre herramientas |
| Respuestas de Luna, y acciones por respuesta | 25 respuestas, 1 acción cada una (0 de 46 con más de una) | ídem |
| Lo que cuesta un clic del ciclo rápido | mediana 340 ms con la carita | ídem |
| ¿El servidor de la voz acepta `reasoning.effort` en la delegación? | sí: `session.started` con `low` y con `parallel_tool_calls` | sonda del 2026-09-28, 22:40 |
| Un plan por objetivos ya probado | u/ (spec 052): 77 de 78 pedidos cumplidos una noche entera, con Luna → «hacer» → Jev | spec 052 |
| Lo publicado | agrupar varias acciones por llamada, comprobando la pantalla antes de cada una: −51 % de pasos con el mismo acierto (UFO2); un planificador aparte con sub-objetivos que se quedan viejos empeora (Agent S3) | `arquitectura.json` del scratchpad |

Lo que decide el diseño: el ejecutor ya existe (u/), y lo que faltaba en U.exe es **que Luna pueda mandarlo**. Y la
lección de Agent S3: cada objetivo se comprueba en la pantalla de ahora, y si falla se vuelve a Luna — no se sigue con un
plan viejo.

## La métrica

| Meta | Cómo se lee | Antes |
|---|---|---|
| ⭐ **Luna ≤ 20 % del tiempo del pedido** | `luna=` en la línea `voz-turno` de cada pedido | ≈ 77 % |
| **≥ 4 de 5 objetivos cumplidos por plan** (80 %), según la comprobación y no según Luna | `⏱ plan:` de cada `map_hacer` | no existe |
| Acciones por plan | la misma línea, sin meta: se mira qué pasa | 1 por respuesta |

«Pensar» es todo lo que no es ejecutar: la voz decidiendo delegar, Luna planeando y Luna contando el resultado.
«Ejecutar» es lo que tardan las herramientas, desde que se piden hasta que su resultado sale hacia Luna.

## La especificación

| # | Promesa | Fase |
|---|---|---|
| 512 | la medida del turno separa pensar de ejecutar: ejecutar es lo que tardaron las tandas de herramientas; pensar es el resto, desde la petición hasta lo primero que dice Ü tras la última herramienta; la línea voz-turno lleva `pensar=`, `ejecutar=` y `luna=` en porcentaje | 1 |
| 513 | una orden de prueba entra por el mismo camino que lo escrito en el chat —`u_orden` por el MCP—, `u_colgar` cierra la voz, y las dos solo existen con `U_ORDENES_DE_PRUEBA=1`; Luna no las ve | 1 |
| 514 | Luna tiene `map_hacer` con `pasos`: el plan entero en una llamada; sin ejecutor conectado lo dice, y con él le pasa los pasos tal cual | 2 |
| 515 | un plan se lee de una lista JSON (o una línea por paso); vacío o ilegible no ejecuta nada y lo dice; y cada plan deja su cuenta sobre el plan entero: `⏱ plan: N objetivo(s) · K cumplido(s) · F fallido(s) · O omitido(s) · A acción(es) · X ms` | 2 |
| 516 | «pulsa: <nombre>» va por el ciclo rápido, sin Jev; si no está a la vista, el paso pasa a Jev como objetivo; un paso sin prefijo es un objetivo para Jev | 2 |
| 517 | la mano del plan no pulsa sobre una ventana de Ü: mira bajo el punto con la misma regla (510), y tras el clic avisa a la carita | 2 |
| 518 | Luna piensa en modo rápido: la delegación le pide `reasoning.effort = low` | 3 |
| 519 | el plan trabaja sobre la misma ventana que el ciclo rápido: la de delante, y si delante está Ü o nada, la de trabajo; sin ninguna de las dos, dice que no hay ventana | 4 |

## Fases

| Fase | Qué | Promesas | Termina cuando |
|---|---|---|---|
| 1 | medir y poder mandar órdenes de prueba | 512, 513 | la línea voz-turno dice `luna=` en una orden de prueba real |
| — | **el antes**: 3-4 órdenes largas con el camino de hoy | — | tabla de `luna=` por orden |
| 2 | `map_hacer` con el ejecutor de u/ y las manos de U.exe | 514-517 | un plan real cumple sus objetivos |
| 3 | modo rápido, e instrucciones de Luna | 518 | — |
| 4 | órdenes de prueba hasta la métrica | — | ≤ 20 % y ≥ 4 de 5 en órdenes largas |

## Lo que queda fuera

- Quitar `map_take` y las demás herramientas de un paso: se quedan para los pedidos de un solo gesto.
- Guardar los planes que salieron bien para repetirlos sin Luna (MobileGPT, SkillDroid): es el paso siguiente.
- SAP: `map_hacer` va por UIA; dentro de SAP, Luna sigue con las herramientas de siempre.
