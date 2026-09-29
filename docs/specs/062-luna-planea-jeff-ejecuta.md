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
| 520 | quien planea es GPT-6 Sol a la máxima velocidad que la API acepta: delegado `gpt-6-sol` con `reasoning.effort = low` y `service_tier = priority`, al abrir y al cambiar de modo | 5 |

| 521 | abrir una app nunca lanza a la propia Ü: el acceso directo «U» no casa con nada, y un acceso cuyo nombre está DENTRO de lo pedido solo cuenta si tiene al menos 4 letras; lo exacto gana y lo que no casa no lanza nada | 5 |

| 522 | todo lo que Ü guarda de la persona vive donde dice `U_DATA_DIR`: la conversación se escribe bajo esa carpeta, y ningún archivo del cliente pide la carpeta de Windows por su cuenta | 5 |

| 523 | abrir una app en el plan espera a que pinte algo más que su marco: una lectura con solo los botones de la ventana (menú del sistema, minimizar, maximizar, restaurar, cerrar) no es una app lista, y no se da por quieta | 5 |

| 524 | «pulsa: <nombre>» que no encuentra el nombre espera UNA vez a que la pantalla se quede quieta y lo busca otra vez por el ciclo rápido antes de pasarlo a Jev; si aparece, Jev ni se entera | 5 |

> **Por qué la 522 está en esta spec.** La encontró la tanda de GPT-6 Sol (2026-09-29, 02:41): la conversación se guardaba
> en `%APPDATA%\U\conversacion-personal.json` aunque la Ü de pruebas tuviera su `U_DATA_DIR`, así que cada orden heredaba
> las anteriores —Sol hizo la de Configuración dentro de la de la calculadora— y 26 turnos de prueba quedaron en el archivo
> del dueño (marcados con el usuario de prueba, así que su Ü no los cargaba; se quitaron con copia). Sitios con la clase de
> error: 6 (conversación, memoria personal, fotos de recuerdos, álbum de miradas, skills, collar).

> **Por qué la 521 está en esta spec.** La encontró su primera tanda (2026-09-28, 22:54): `map_open_app «calculator»` lanzó
> la Ü instalada —«calculator» contiene «u», y el acceso se llama «U»—, y esa Ü desplazó a la del dueño con el entorno de
> la prueba. No es de planificación, pero no se puede seguir midiendo con una prueba que puede tumbar la Ü del dueño.

> **Decisión del dueño (2026-09-29):** «prefiero GPT 6 Sol por su calidad de planning, eso sí a la máxima velocidad
> posible». Cambia lo que comprueba la promesa 40 del contrato de la voz (el delegado por defecto era `gpt-5.6-luna`); su
> enunciado no nombra el modelo y no cambia. Medido con `velocidad.py` (instrucciones y catálogo de la voz, primer plan,
> mediana): `gpt-5.6-luna` low 3.766 ms · `gpt-6-sol` low 3.546 ms · **`gpt-6-sol` low + `priority` 1.874 ms** (el servidor
> contesta `fast`) · `gpt-6-sol` none + `priority` 2.339 ms. `ultrafast` se acepta al abrir la sesión pero la Responses API
> lo rechaza; `minimal` no existe para `gpt-6-sol`. `priority` cuesta más por ficha.

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
