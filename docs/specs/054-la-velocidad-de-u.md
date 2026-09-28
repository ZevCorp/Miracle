# La velocidad de u/ en U.exe

Estado: **implementada** (2026-09-27; SAP sin medir) · Rama `jose/u-pulsar-en-main` (sigue a la 053) · Decisiones del agente, sin
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

### Fase 3 — mirar y escribir con la misma lectura

| # | Promesa |
|---|---|
| 495 | mirar —map_what_i_see y lo que se pega a cada acto— lee con el lector de u/ la ventana de delante y cuenta accionables y textos; SAP, que UIA no ve, sigue por el lector de siempre |
| 496 | tras escribir, la espera es la de u/ —dos lecturas iguales con el lector rápido, techo 300 ms— y lo que se cuenta después es esa misma lectura, sin volver a leer |

| | antes | ahora |
|---|---|---|
| mirar (`map_what_i_see`) | 95-205 ms | **38-117 ms** |
| escribir 4-300 letras (`map_type`) | 500-900 ms (main: 2,2-2,4 s) | **172-287 ms** |
| abrir una app | 242 ms | **201 ms** |

Sabotajes: 495 ×1, 496 ×1 — rojos.

### Fase 5 — fuera lo muerto (118 líneas)

`PulsarPorElNucleo` (se asignaba y nadie lo leía), `MapaVivo.Cruzado` y `UiaSurface.EjecutarSobre` (cero llamadas),
`OnManoPulso` y `OnAutomationCursorMoved` (sin suscripción desde la 492), y la prueba de la 240. Todo vive en 334f144.

### El cierre (2026-09-27, último build, plan variado, 59 y 62 clics)

| mediana por ciclo | main real (334f144) | rama | u/ |
|---|---|---|---|
| todas | 2.399 ms | **182 ms** | 171 ms |
| Configuración | — | 229 ms | 236 ms |
| Explorador | — | 315 ms | 253 ms |
| Calculadora | — | 75 ms | 82 ms |
| Bloc de notas | — | 129 ms | 140 ms |
| Edge (Wikipedia) | — | 1.771 ms | 1.483 ms (4 de 14 clics en las dos: la página, no el ciclo) |

Compuerta: contrato del grafo 333/333, voz 46/46, contrato de u/ intacto. Nivel 4: 5 apps. Ninguna sesión de voz
abierta en las rondas 3-final. **Lo que no se midió: SAP** — no hay sesión de SAP en este PC; SAP sigue por su camino
de siempre (la mano de SAP y su espera por `session.Busy`), sin el fondo compitiendo, y su medida queda pendiente para
una sesión real.

### Fase 6 — hacer es rápido traiga lo que traiga (2026-09-28)

**Lo que dijo la sesión de voz real.** Dos pruebas del dueño por voz se sintieron lentas. El log las cuenta así: el
modelo se lleva ~80 % del tiempo y las herramientas ~20 %. Pero **ninguno de los 9 `map_take` llegó al ciclo rápido**:
2.349 ms de mediana contra los 182 de la sonda. La razón no estaba en el ciclo, estaba en la puerta. El modelo manda
`decir` y `recuerdo` en casi cada clic, porque el esquema se los ofrecía. Y `Take` desviaba todo clic con uno de los
dos a la coreografía de lección: señalar, colgar un recuerdo, sacar una foto, y pulsar por el núcleo.

La sonda no lo vio porque llamaba a `map_take` solo con `exit`. Medía el componente y no la entrada real con los
argumentos reales. Es la raíz del diagnóstico de fiabilidad, y la 497 la cierra con los argumentos literales de esa
sesión.

| # | Promesa |
|---|---|
| 497 | hacer es rápido: un clic por nombre con map_take va por el ciclo rápido traiga los argumentos que traiga —decir, recuerdo o cualquiera desconocido—; ni coreografía, ni recuerdo, ni foto. La coreografía solo cuando la app la pide al señalar al actuar (comprobación, encargo), y map_type en SAP tampoco se desvía por decir o recuerdo |
| 498 | con SAP delante, un clic por nombre no entra al ciclo rápido: no lee, no pulsa, dice que es SAP y lo da la mano de SAP; y saber si una ventana es SAP es UNA regla —su proceso—, la misma para pulsar, mirar y esperar tras escribir |
| 499 | el tope de intentos ve los clics del ciclo rápido: la mano de un clic rápido lleva lo pulsado con la misma clave con la que se le pregunta al tope antes de pulsar, y el tercer intento sobre el mismo botón no se da |
| 500 | la voz no ofrece decir ni recuerdo: en el catálogo de la voz, map_take, map_type, map_decidir y map_tramo no los declaran; el catálogo del piloto sí los declara en map_take y map_type, que es para lo que la mano del piloto los lleva (191) |
| 509 | cada llamada dice por qué camino fue y por qué —ciclo rápido, núcleo, coreografía— en el log y en la mano; y un clic por nombre en UIA que no va por el ciclo rápido fuera de una comprobación deja «⚠ camino inesperado» con su razón |

La 509 es la que evita que esto vuelva a pasar en silencio. Cada llamada deja `camino: map_take → ciclo-rapido (…)`
en el log. Un desvío deja `⚠ camino inesperado` con su razón, y eso se ve en la primera sesión, no en la tercera.

Las tres de la 498 eran tres copias de la misma pregunta —¿es SAP?— con tres respuestas: `Uia.Sap.EsVentana` es
ahora la única. La 499 arregla un hueco que abrió la fase 1. Los clics rápidos no le decían al tope qué habían
pulsado, así que el tope de la 204 no los contaba.

**Sitios con la clase de error (patrón nº5).** Cuatro herramientas en el catálogo de la voz declaraban
`decir`/`recuerdo`, y dos puertas los usaban para desviar (`Take` y la rama SAP de `Type`). Hay tres firmas que solo
los pasaban de largo (`Decidir`, `UnPasoDecidido` y `Tramo`). Todos están corregidos.

### Fase 7 — recordar es un complemento, no un efecto de cada clic (2026-09-28)

Con la fase 6, un clic ya no cuelga recuerdos. Queda limpiar lo que esa costumbre dejó detrás: una segunda coreografía
para «fuera de una comprobación», un recuerdo que se escribía después de tocar, unas instrucciones que pedían
acumular recuerdos y una búsqueda por nombre que colgaba el recuerdo del elemento equivocado.

| # | Promesa |
|---|---|
| 501 | parar la comprobación para el plan: tras cancelarla no se da ni un paso más, y los que faltaban cuentan como no dados sobre el total del plan; el plan del piloto y el de una skill se recorren con ese mismo recorrido |
| 502 | recordar es explícito y honesto: las instrucciones no piden acumular recuerdos ni prometen que duren para siempre, la herramienta de recordar dice que no es para describir lo que Ü va a pulsar, y su respuesta empieza por «nuevo recuerdo:» sin prometer «lo recordaré» |
| 503 | un recuerdo se cuelga del elemento por su nombre exacto; «contiene» solo cuando hay uno solo que lo contenga, y si hay varios se dicen y no se cuelga de ninguno |

**La 501** salió al leer el bucle del plan para sacarlo de `FaceWindow`: no miraba el botón de parar. El plan corre en
el hilo del servidor MCP, y cancelar solo le llegaba al piloto. Había dos bucles con la misma regla (el del plan y el
de una skill) y ninguno paraba. Ahora hay uno, `Piloto.ElRecorridoDelPlan`.

**La 503** es el recuerdo mal colgado de la sesión real. El modelo mandó `recuerdo` sobre «Search», y se colgó de
«Search by voice». El «Search» de Google es un ComboBox de 1.203 px, y el filtro de puertas visibles descarta lo que
mide más de 900 px de ancho. Sin el exacto, ganaba el primero que lo contuviera. La regla de SAP (`ElCampoQueNombras`)
ya hacía lo correcto: exacto primero, «contiene» solo si es único y un empate no se adivina. Ahora es la misma para los
dos mundos.

**Sabotajes de las fases 6 y 7: 30, todos rojos.** Por promesa: 497 ×2, 498 ×3, 499 ×3, 500 ×3, 509 ×3, 501 ×4,
502 ×4 y 503 ×8. Tres no mordían a la primera y se endurecieron sus pruebas (ver Hallazgos, nº2). Uno no llegaba a
aplicarse —el patrón no casaba— y se rehízo sobre la regla pura `SePuedeNombrar`.

**Lo que queda abierto: que un recuerdo sobreviva a cerrar Ü.** Quien proyectaba el grafo a Neo4j era el latido, y
desde la 489 no corre. Además, en este PC no hay Neo4j. Un recuerdo vive en memoria mientras esa Ü esté abierta. Las
instrucciones ya no prometen «para siempre».

## Promesas retiradas

| # | Retirada el | Por qué | La sustituye |
|---|---|---|---|
| 266 | 2026-09-28 | «fuera de una comprobación, pulsar es señalar y tocar en un solo gesto, y el recuerdo se escribe DESPUÉS de tocar»: desde la 497, fuera de una comprobación no hay coreografía, y recordar es `map_esto_es`, explícito. Lo de dentro ya lo promete la 180 | 497 |
| 240 | 2026-09-27 | la carita que viaja al clic se posaba sobre el clic siguiente de Ü y abría la voz de pago | 492 |
| 487 | 2026-09-27 | «si tampoco está, decide el camino de siempre»: ese camino se colgaba 60 s por clic en Edge | 493 |

## Hallazgos

1. **La sonda medía el componente, no la entrada.** El «182 ms» de la fase 5 era verdad para `map_take` con solo
   `exit`. La voz manda `exit`, `decir` y `recuerdo`, y con eso ningún clic llegaba al ciclo. Desde la 497 el
   contrato llama con los argumentos literales de la sesión real.
2. **Tres sabotajes de diecisiete no mordieron a la primera**, y los tres por lo mismo: la prueba miraba algo que
   se parecía a la propiedad sin serlo.
   - La 498 exigía que la regla de SAP se nombrara en el bloque, y mirar y esperar la siguen nombrando. Quitar
     `EsSap` del ciclo no la ponía roja.
   - La 499 usaba un ciclo de mentira que ya traía la clave de lo pulsado.
   - La 503 inyectaba la lista de lo que se puede nombrar, y el filtro que dejó fuera el «Search» de 1.203 px no
     lo juzgaba nadie.

   Las tres se endurecieron y ahora muerden (`db22152`, `522714a`).
3. **La 291 es un reloj de pared.** Contesta «en marcha» en menos de 150 ms. Salió roja una vez (258 ms) con la
   máquina cargada y verde en la corrida siguiente. No es un fallo del núcleo, pero un juez que depende de la
   carga dice «culpable» sin haberlo probado (aprendizaje nº17). Queda anotada, sin cambiar.
4. **Los recuerdos viven en memoria.** Quien proyectaba el grafo a Neo4j era el latido, apagado desde la 489, y
   en este PC Neo4j no está. Hasta que se decida cómo persistir, un recuerdo dura lo que dura la Ü que lo aprendió.
