# Plan de implementación: la carita expresa lo que Ü hace, y lo que le pasa

Estado: **propuesto** · Nace de lo que el dueño dijo el 2026-10-01 al ver las specs 052 y 077 · Rama: `jose/la-carita-expresa-lo-que-hace` · Promesas **693-699**

> Felipe, en un audio del 2026-10-01, con la carita de las specs 052 y 077 delante: «cuando haga
> scroll, que saque la mano, como que presione la pantalla y se mueva con la pantalla, como si él la
> estuviera deslizando. Cuando esté escribiendo, como moviendo las dos manitos, taca taca taca, ahí al
> lado del texto; que no se vaya a su zona, que se quede ahí escribiendo. Analiza todos los puntos de
> interacción donde se pueda hacer más viva. No me gusta cómo sonríe cuando habla, que se ensancha la
> sonrisa: por ahora que no haga nada cuando hable. No veo la expresión de esperando en acción, tampoco
> la de trabajando: intégralas dentro de todas las ejecuciones, que siempre que ejecute sea súper
> expresivo. La de escuchando me gusta, pero si se queda escuchando mucho tiempo que no esté
> expandiéndose así; apenas le hago clic, máximo 25 o 40 segundos. La de te escucha me gusta, pero que
> entre y salga: hace el gesto un segundo y pasa de nuevo a sonreír. Que mientras le estoy hablando a
> veces ponga la cara de esperando, que se sienta que me está entendiendo. Me gustó mucho la
> combinación entre grabando y que pulse algo, o esperando y pulsa: ya no pulsa recto. Añádele
> muchísima personalidad.»

## Diagnóstico: qué se midió

| Qué | Medida | Fuente |
|---|---|---|
| Por qué no se ven «trabajando» ni «esperando» | con la voz viva, `ResolveMood` contesta `Hablando` o `Conversando` y **no llega a mirar** si Ü está ejecutando ni si espera: casi todo se ejecuta por voz | `FaceWindow.ResolveMood` en `main` (`b0cd05aa`): la rama de `_vivo.Viva` vuelve antes |
| Qué sabe la carita de que Ü desplaza | nada: no hay aviso | grep de `Pulso` (el único aviso de la mano): 1 |
| Quién desplaza | 3 sitios: `ManosDelPlan.Desplazar`, `Uia.Desplazamiento.Mover` (`map_scroll`), `InputExecutor.Scroll` | grep de la rueda y del patrón de desplazamiento |
| Quién escribe | 2 entradas: `ManosDelPlan.Escribir` (el plan) y `SurfaceMapTools.Type` (`map_type`) | grep |
| Qué sabe la carita de que la persona habla | nada: `speech_started` se atiende dentro de `ConversacionEnVivo` y no sale | ídem |
| Cuánto dura «escuchando» | no sale nunca en una conversación; solo en el dictado viejo, 8 s | `ResolveMood` |
| Qué cara pone al hablar | la sonrisa ancha, a la que llega en 260 ms (promesa 448) | `FaceControl` |
| Qué cara pone mientras escucha | la de grabar, fija toda la conversación (promesa 691, de esta mañana) | ídem |

## Por qué esto va dirigido por especificación

Porque es una tabla de «cuando pasa X, la carita hace Y» con una docena de filas, y cada fila se
puede romper sola sin que nadie lo note: el aviso deja de salir, la cara se queda pegada, la mano se
sale de la ventana. La de «trabajando» llevaba meses dibujada y sin verse por una rama que volvía
antes. Sin una promesa por fila, la siguiente fila que se añada tapa otra.

**La regla del flujo, y no tiene excepciones:** ninguna línea de producción entra antes que la
promesa que la juzga.

## La tabla: qué pasa, y qué hace la carita

| Cuando… | la carita… | Promesa |
|---|---|---|
| Ü ejecuta una herramienta (y hasta 3 s después, para no parpadear entre dos seguidas de una misma tarea) | trabaja: ceja torcida y balanceo, aunque haya conversación | 693 |
| Ü te preguntó algo y espera | espera: ceja arriba y cabeza ladeada, hasta que contestas o pasan 20 s | 693 |
| le prendes la voz | escucha —cejas arriba, respira— durante 25 s como mucho; después se calma y sonríe | 693 |
| Ü habla | no cambia de cara: el halo ya dice que habla | 693 |
| empiezas a hablarle | pone un momento la cara de atender y vuelve a sonreír | 694, 695 |
| sigues hablándole | cada 3,5 a 5,5 s alterna la cara de entender y la de atender, un momento cada vez | 695 |
| Ü pulsa algo | gira la cabeza, saca la mano (spec 052) y además pone una expresión, alternando atender y entender | 696 |
| Ü desplaza la pantalla | se pone dentro de la ventana, apoya la mano y se desliza con el contenido | 697 |
| Ü escribe | teclea con las dos manos junto al campo, y no vuelve a casa hasta terminar | 698 |
| termina bien un trabajo | se alegra un momento | 699 |
| la agarras y la sueltas | se sorprende al agarrarla y rebota al soltarla | 699 |
| cuelgas una conversación de verdad (más de 20 s) | se despide con la mano | 699 |

## La especificación

| # | Promesa | Fase |
|---|---|---|
| 693 | la cara de la carita sale de lo que pasa: mientras Ü ejecuta trabaja, aunque haya conversación; si te preguntó y espera, espera; recién prendida la voz escucha, y a los 25 segundos se calma; y cuando Ü habla no cambia de cara | 1 |
| 694 | los gestos entran y salen: atender, entender, alegrarse y sorprenderse duran menos de dos segundos, se ven mientras duran y la carita vuelve sola a la cara de su estado | 2 |
| 695 | mientras le hablas la carita te sigue: al empezar pone un momento la cara de atender, y si sigues hablando alterna la de entender y la de atender cada 3,5 a 5,5 segundos; como mucho medio minuto, y en cuanto Ü contesta o ejecuta deja de hacerlo | 3 |
| 696 | lo que Ü pulsa lo pulsa con expresión: de un pulso al siguiente la carita alterna la cara de atender y la de entender | 4 |
| 697 | cuando Ü desplaza la pantalla la carita la desliza: se pone dentro de la ventana, junto a su borde, apoya la mano y se mueve con el contenido —sube si el contenido sube, baja si baja— sin salirse de la pantalla, y la mano aguanta apoyada mientras se mueve; si la pantalla no se movió, no desliza | 5 |
| 698 | cuando Ü escribe la carita teclea: saca las dos manos y las mueve alternándolas mientras dura lo escrito —más cuanto más largo, entre uno y tres segundos—, y no vuelve a casa hasta que termina; si no llegó a escribir, no teclea | 6 |
| 699 | la carita reacciona a lo que le pasa: al terminar bien un trabajo se alegra, al agarrarla se sorprende y al soltarla rebota, y al colgar una conversación de más de veinte segundos se despide con la mano | 7 |

Y dos promesas de `main` cambian, a petición del dueño. Los números no se reciclan:

- **448** decía «hablar se ve en la sonrisa, que se ensancha poco a poco al empezar una frase y se
  relaja al callar». El dueño, al verlo: «no me gusta cómo sonríe cuando habla». Ahora: la boca no se
  abre **ni la cara cambia** al hablar.
- **691** decía que mientras te escucha pone la cara de grabar. El dueño: «me gusta, pero que entre y
  salga, que no se quede pegado». Ahora conversando sonríe como en reposo, y la cara de atender es un
  gesto de la 694.

### Las decisiones, y de dónde salen

- **Trabajar manda sobre conversar.** Era al revés, y por eso «trabajando» no se veía: casi todo lo
  que Ü ejecuta lo ejecuta en una conversación.
- **Se sabe que Ü preguntó por el signo de interrogación.** Su última frase, al cerrar el turno,
  acaba en «?». No hay otra señal: la herramienta de preguntar y una pregunta dicha de palabra llegan
  igual.
- **25 segundos de escuchar**, de los «25 o 40» que dijo: es respirar agrandándose, y medio minuto
  de eso al lado del trabajo ya pesa.
- **Los gestos al oírte van por reloj, pero solo mientras hablas.** No se sabe cuándo terminas de
  hablar —el servidor avisa de que empezaste, no de que acabaste—, así que el reloj se para cuando Ü
  contesta, cuando ejecuta, o a los 30 segundos. No es el reloj de reposo que se quitó en la 052: nace
  de que le estás hablando.
- **Deslizar es mover la ventana de la carita**, no el dibujo dentro de ella: con 17 px de aire no hay
  sitio para un recorrido que se note. Va dentro de la ventana que se desplaza, y fuera de casa es
  fantasma (promesa 505), así que estar encima del contenido no le roba ningún clic.
- **Teclea donde esté el campo, si se sabe.** El campo con el foco se le pregunta a UIA fuera del hilo
  de la interfaz y fuera del ciclo: escribir no espera a la carita. Si no se sabe cuál es, teclea
  donde está: un gesto en el sitio equivocado es peor que un gesto sin sitio.
- **Los avisos salen DESPUÉS de la acción**, como el del pulso (promesa 504): la carita cuenta lo
  que pasó, y ni el clic ni la rueda ni el teclado la esperan.
- **La despedida, solo tras una conversación de verdad.** Prender y apagar la voz en dos segundos no
  es despedirse de nadie. Y pasa por la misma regla del saludo (spec 077): nunca dos en minuto y medio.

### Con qué se juzga

- **Reglas puras**: `ReglaDelAnimo` (693), `ExpresionesDeLaCarita` (694, 696), `GestosAlOir` (695),
  `ReglaDeLaVisita.Desliz` (697), `ManosDeLaCarita.Tecleo/Desliz/CuantoTeclea` (697, 698),
  `EstanciaDeLaCarita.IrA/Quedarse` con reloj y vuelo de mentira (697, 698).
- **Lo pintado**: la expresión puesta al 0, al 50 y al 100 %; las dos manos fuera al teclear; la mano
  apoyada al deslizar.
- **`[cableado]`**, para lo que solo se puede leer: que los tres sitios que desplazan y los dos que
  escriben avisan, que la conversación avisa de que empezaste a hablar, y que la ventana lo atiende.
- **Sobre la máquina** (nivel 4): pulsar, desplazar y escribir por el MCP de una Ü de pruebas, con el
  log y las fotos. La conversación pide voz de pago: no se prueba en la app.

## Las fases

| Fase | Promesa | Qué toca | Terminado |
|---|---|---|---|
| 1 — el ánimo | 693, 448, 691 | `Ui/ReglaDelAnimo.cs` (nueva), `FaceWindow.ResolveMood`, las poses de `FaceControl` | 693 verde |
| 2 — los gestos | 694 | `Ui/ExpresionesDeLaCarita.cs` (nueva), `FaceControl.Expresar` | 694 verde |
| 3 — al oírte | 695 | `Ui/GestosAlOir.cs` (nueva), `ConversacionEnVivo` (un aviso), `FaceWindow` | 695 verde |
| 4 — pulsar con expresión | 696 | `FaceWindow.Visitar` | 696 verde |
| 5 — deslizar | 697 | `Ui/LoQueUHace.cs` (nueva), `ReglaDeLaVisita`, `ManosDeLaCarita`, `FaceControl.Deslizar`, los 3 sitios que desplazan | 697 verde |
| 6 — teclear | 698 | `ManosDeLaCarita`, `FaceControl.Teclear`, `EstanciaDeLaCarita`, los 2 sitios que escriben | 698 verde |
| 7 — lo que le pasa | 699 | `FaceWindow`, `FaceGestures`, `ReglaDelSaludo` | 699 verde |

## Lo que NO entra

- La personalidad de la VOZ: qué dice Ü y con qué tono. Es otra conversación —las instrucciones de la
  voz y quién las oye, que son médicos—, y se le pregunta al dueño antes de tocarla.
- Girar la cabeza en vertical, la insignia de estado y tragar documentos (lo que queda de Coucou).
- Señalar con la mano: la promesa 446 dice que señalar no la saca.
- El color: el dueño lo dio por resuelto el mismo día, con el build de la 052 ya instalado.

## Hallazgos

## Cierre

- [ ] Promesas 693-699 verdes (`.\scripts\contrato-del-grafo.ps1`)
- [ ] `.\scripts\verificar.ps1` pasa
- [ ] Nivel 4, sobre U.exe real
