# Plan de implementación: Luna planea por objetivos, Jeff ejecuta

Estado: **implementado; medido en 5 tandas por el camino de la voz (2026-09-29)** · abierto: la meta del 20 % (ver *Resultados*) · Nace de la sesión de voz del dueño del 2026-09-28 (p33388) y de su hipótesis
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

| 525 | un «pulsa: X» que no está a la vista ni tras esperar pasa a Jev como «llegar a X»: con permiso para navegar hasta donde esté —la sección que lo contiene, o Atrás—, no para adivinar en esta pantalla | 5 |
| 526 | «carpeta: <ruta o nombre>» abre esa carpeta por el disco dentro del plan, sin Jev; si no se pudo, el paso falla diciendo cuál, y sin quien abra carpetas lo dice | 5 |

| 527 | el notch se aparta como la carita: si bajo el punto de un clic de Ü está el notch, se vuelve transparente al ratón un momento, se mira otra vez y se pulsa lo de debajo; cualquier otra ventana de Ü sigue sin pulsarse y se dice cuál | 5 |

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

## Resultados (órdenes de prueba por `u_orden`, Ü de pruebas aparte, voz cerrada tras cada orden)

Las mismas órdenes antes y después. «Antes» = el catálogo de siempre con Luna 5.6 (tanda `antes-2`); «después» = `map_hacer`
con GPT-6 Sol `low` + `priority` y las promesas 519-527 (tandas `sol-4` y `sol-5`, idénticas en las órdenes base).

| orden | antes: total · Luna · llamadas | después: total · Luna · llamadas · objetivos |
|---|---|---|
| calculadora (1234×5678−1000+250) | 87 s · 46 s · 30 | 4,3-6,3 s · 3,5-5,2 s · 1 · 2/2-4/4 |
| Configuración (4 secciones) | 62 s · 23 s · 15 | 7,3-17 s · 3,8 s · 1 · 7/7 |
| Explorador (3 carpetas + vista) | 16 s · 11 s · 6 | 4,3-5,5 s · 2,7-3,5 s · 1 · 5/5-6/6 |
| Paint (4 herramientas) | 30 s · 21 s · 11 (a medias) | 5,5-6,8 s · 2,4-3,6 s · 1 · 5/5 |
| Configuración larga (10 secciones) | — | 9,1-9,6 s · 2,4-3,5 s · 1 · 11/11-13/13 |
| Paint largo (8 herramientas + 5 colores) | — | 14,6-54 s · 6,3-7,9 s · 3-5 · 14/20 y 10/19 |
| Configuración muy larga (~22 pasos) | — | 32,5 s · 16,9 s · 8 · 27/64 |

**Las 4 órdenes base, sumadas:** 195 s → 35,6 s (−82 %); Luna 102 s → 15 s (−85 %); 66 respuestas de Luna → 4.
**10 de 13 órdenes** (las cinco base, dos veces cada una) se resolvieron con el PRIMER plan entero: una llamada y el 100 %.

**Frente a la métrica:**
- **≥ 4 de 5 objetivos por plan: se cumple donde el plan es de la app que Jeff sabe leer** (88 % en `sol-4`; 100 % en 10 de
  13 órdenes). No se cumple en el total de `sol-5` (60 %): Paint abre un cuadro modal («Editar colores») que el lector no
  consigue leer, y «abre la primera opción de X» deja a Jev justo bajo su umbral (0,42-0,43 con 0,45).
- **Luna ≤ 20 %: no se cumple de media (36-40 %).** Lo que queda de Luna es fijo: un plan y un resumen, 2,4-5 s por orden
  (antes 11-46 s). Y Jeff es rápido: 11 secciones de Configuración le llevan 6,7 s. El porcentaje solo baja del 20 % cuando
  la orden da a Jeff ≥ ~12 s de trabajo y sale a la primera (Paint largo en `sol-5`: 15 %, pero con fallos). **Medido así,
  la métrica castiga que Jeff sea rápido**; lo que el dueño quiere —que planear no domine— se ve mejor en segundos: Luna
  ≤ 5 s por orden que sale a la primera, y una sola llamada.

## Hallazgos (lo que las tandas encontraron, y dónde quedó)

1. **La meta del 20 % choca con un mínimo fijo.** Planear (Sol, 1,9 s) + resumir (~1 s) + la voz decidiendo delegar. Sin
   más trabajo para Jeff, el porcentaje no baja: es una decisión del dueño cómo medirlo (ver *Resultados*).
2. **`map_open_app «calculator»` lanzaba la Ü instalada** (521): el acceso «U» casaba con todo lo que tuviera una «u».
3. **La conversación de las pruebas vivía en el archivo del dueño** (522): 6 sitios se saltaban `U_DATA_DIR`.
4. **Una Ü de pruebas con `UpdateFeedUrl` vacío salta «Ü tropezó»** en la pantalla del dueño: es del arnés, que ahora le da
   una carpeta vacía (la fuente que el `Updater` reserva a las pruebas). La app no se tocó.
5. **Traer una app al frente falla cuando la orden no nace de un toque a Ü** (map_open_app 13,9 s): con la voz sola pasa
   igual. Sin arreglar: el arnés trae la Ü al frente como lo haría la persona al tocarla.
6. **Lo que el lector no ve:** los menús flotantes de Windows 11 («Ver» del Explorador, «Pinceles» de Paint) y el cuadro
   modal «Editar colores» de Paint. Y `map_unblock` se colgó 187 s leyendo ese cuadro: `DialogoDelante` lee sin plazo, el
   mismo agujero que la 490 cerró en otros sitios. Siguiente promesa.
7. **El PC se durmió a mitad de una tanda**: la sesión pide ahora mantenerlo despierto (sin tocar su configuración).

## Lo que queda fuera

- Quitar `map_take` y las demás herramientas de un paso: se quedan para los pedidos de un solo gesto.
- Guardar los planes que salieron bien para repetirlos sin Luna (MobileGPT, SkillDroid): es el paso siguiente.
- SAP: `map_hacer` va por UIA; dentro de SAP, Luna sigue con las herramientas de siempre.
