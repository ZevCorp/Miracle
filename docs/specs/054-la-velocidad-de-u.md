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

| 489 | U.exe no lee la pantalla por su cuenta: el mapa vivo arranca sin latido ni ubicación de fondo, y el rastro del cursor no arranca; lo único que lee la pantalla es el ciclo que se le pide |
| 490 | leer la pantalla y saber dónde estoy tienen plazo: si la app no contesta, se sigue sin esa respuesta y se dice, en vez de congelar U; lo que llega tarde no pisa lo que ya se contestó |

## Resultados

### Fase 1 — el ciclo rápido (2026-09-27, plan fijo, Configuración ×20, Explorador ×12, Calculadora ×16)

| mediana por ciclo | rama antes | rama con el ciclo rápido | u/ |
|---|---|---|---|
| Configuración | 2.257 ms | **703 ms** | 749 ms |
| Explorador | 3.545 ms | **1.297 ms** | 833 ms |
| Calculadora | 1.071 ms | **331 ms** | 172 ms |
| todas | 2.268 ms | **616 ms** | 502 ms |

El resto de la diferencia estaba en la espera (lecturas más lentas con el fondo leyendo la misma app): fase 2.

### Fase 2 — sin fondo, y con plazo

- Latido, ubicación de fondo y rastro del cursor desconectados (489).
- **El cuelgue de 60 s al abrir la Calculadora no era por quitar el fondo**: el Explorador tardó 252.579 ms en
  contestar UNA lectura del lector viejo, que no tiene plazo, y U entero esperó detrás. Con plazo (490): leer 3 s,
  ubicarse 1,5 s. Sitios con la clase de error en el camino del ciclo: 2, los 2 con plazo. SAP se ubica en su hilo,
  sin plazo (su scripting es COM).
- Sabotajes: 485 ×2, 486 ×1, 487 ×1, 488 ×2, 489 ×1, 490 ×2 — los 9 rojos. La primera tanda de la 488 no pilló
  «SAP pasa»: un selector de SAP no se pulsaba pero se leía la pantalla dos veces por él. La 488 exige ahora cero
  lecturas para lo que no es suyo.

### El navegador

Chrome, con ~100 procesos abiertos en este PC, no contesta a UIA: cada lectura del lector de u/ se agota (1,5-4,7 s)
y vuelve vacía — el 2026-09-26 ya pasaba con 133 procesos y 15 GB. La prueba de navegador se hace en Edge, limpio.
Edge activa su accesibilidad al primer cliente: la primera lectura trae solo la barra del navegador, la segunda la
página (151 accionables en Wikipedia, 2,9 s).

### Fase 2b — lo que salió al probar variado (Bloc de notas y Edge)

| # | Promesa |
|---|---|
| 491 | el ciclo rápido trabaja sobre la ventana de delante, la que la persona ve, como u/; solo si delante está la propia Ü usa su ventana de trabajo |
| 492 | la carita no se pone donde Ü va a hacer clic: ni sigue al cursor automatizado ni viaja al clic, y el ciclo rápido no la avisa |
| 493 | antes de pulsar el ciclo lee como mucho UNA vez, y ninguna si la última lectura de esa ventana tiene menos de 2 s; lo que no está se busca en UNA lectura nueva —si la primera leyó algo—, y si tampoco está, contesta al momento que no está y lo que se ve, sin pulsar y sin ir al camino de siempre |
| 494 | una lectura del lector de u/ tiene plazo total: si no vuelve en 4 s se contesta vacía y su hilo se abandona; las siguientes van a un hilo nuevo, sin hacer cola detrás de la atascada |

- **Sin el fondo, la ventana de trabajo dejó de seguir al foco** (491): el Bloc de notas y Edge, abiertos por la
  persona, se quedaban sin ciclo — 30 clics «no está en la lectura (23 accionables)», los de la Calculadora de antes.
- **La carita robaba clics y abría la voz de pago** (492): viajaba al clic y se posaba ~80 px encima; el clic
  siguiente de Ü —la tecla de arriba en la Calculadora— caía en ella. Cinco sesiones de voz en un día de pruebas.
  Las sondas cierran ahora la U si ven «voz-viva: socket conectado».
- **Lo que no está, al momento** (493): caer al camino de siempre costaba 60 s por clic en Edge.
- **Una lectura atascada no deja ciego al resto** (494): Wikipedia en Edge tardó 64-136 s en una sola lectura pese a
  los plazos de COM (cortan lo que no contesta, no lo que tarda), y el lector tenía UN hilo con cola.
- **Las pruebas ensuciaban el terreno**: cada corrida abría una pestaña de Wikipedia y no la cerraba; con 13 copias de
  «Colombia», leer Edge se encarecía ronda a ronda. Se cerraron las 13 (no las demás pestañas) y las sondas cierran
  ahora la suya.

### Rondas con el plan variado (Configuración, Explorador, Calculadora, Bloc de notas, Edge)

| mediana por ciclo | ronda 3 | ronda 4 | ronda 5 |
|---|---|---|---|
| rama / u/ — todas | 182 / 170 | 186 / 153 | **191 / 168** |
| Configuración | 214 / 221 | 278 / 232 | 299 / 260 |
| Explorador | 294 / 239 | 570 / 218 | 354 / 297 |
| Calculadora | 78 / 59 | 81 / 77 | 72 / 76 |
| Bloc de notas | 112 / 150 | 176 / 123 | 116 / 119 |
| Edge (Wikipedia) | 19.725 / 182 | 2.993 / 953 | 3.833 / 2.019 (4 de 14 clics en las dos) |

Edge, tras volver a la página de Colombia, no se deja leer en 4 s ni por u/ ni por la rama: es la página, no el
ciclo. La rama tardaba 14 s en decirlo porque volvía a leer una lectura vacía; ya no (493).

## Promesas retiradas

| # | Retirada el | Por qué | La sustituye |
|---|---|---|---|
| 240 | 2026-09-27 | la carita que viaja al clic se posaba sobre el clic siguiente de Ü y abría la voz de pago | 492 |
| 487 | 2026-09-27 | «si tampoco está, decide el camino de siempre»: ese camino se colgaba 60 s por clic en Edge | 493 |

## Hallazgos
