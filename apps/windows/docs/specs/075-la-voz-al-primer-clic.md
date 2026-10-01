# Plan de implementación: la voz se enciende y se apaga al primer clic

Estado: **implementado; medido sobre el PC real, pendiente de que el dueño lo pruebe hablando** (2026-10-01) · Rama: `jose/la-voz-al-primer-clic`

## Diagnóstico: qué se midió

El dueño (2026-09-30): «siempre que voy a activar la voz con la carita se demora un montón en
escucharme de verdad. La activo, se demora varios segundos en aparecer la estela y luego muchos más
en que me escuche. Quiero que sea inmediato: máximo 500 ms entre el clic y que de verdad me esté
escuchando. Y lo mismo para cerrarla: la cliqueo para cerrarla y no se cierra todavía, me toca
volver a hacer clic. Activar y desactivar la voz no es confiable».

Se midió antes de tocar nada, con tres instrumentos: los logs de la Ü del dueño, una sonda de solo
lectura contra el micrófono y el servidor, y un **juez de fuera** que pulsa la carita de una Ü de
pruebas con el ratón de verdad y mira la pantalla (no el log) para saber cuándo se ve la estela.

| Qué | Medida | Fuente |
|---|---|---|
| Clic → estela visible, en `main` | **666–1.027 ms** (3 rondas) | juez de fuera, píxeles de la pantalla, 2026-10-01 00:02 |
| Clic → micrófono abierto, en `main` | **673–987 ms** | mismo juez, línea `micrófono abierto` |
| Clic → sesión confirmada, en `main` | **1.509–1.902 ms** con una historia de 11.450 caracteres | mismo juez, línea `sesión abierta` |
| Clic de apagar → estela apagada, en `main` | 263–435 ms sin miradas en la sesión; **706 y 1.003 ms** con una | mismo juez, 2026-10-01 00:54 |
| Dos clics seguidos, en `main` | a 150 ms la dejan ENCENDIDA; cuatro a 120 ms, encendida y con 3 sockets abiertos | juez de fuera, ráfagas |
| Por qué la estela espera | `Viva` y `Cambio(true)` iban DESPUÉS de `ConnectAsync` y de las instrucciones | `ConversacionEnVivo.ArrancarAsync` |
| Conectar el socket | 467–515 ms; la primera del proceso, 1.285 ms | sonda, 4 conexiones sin `session.start` |
| Conectar con el TLS ya hecho | 404–440 ms: calentar la conexión ahorra ~70 ms | sonda, `SocketsHttpHandler` compartido |
| `session.start` → `session.started` | 293–395 ms con la apertura mínima; 586–656 con la delegación entera; **849–1.235** con la delegación y 11.450 caracteres de historia | sonda, 3 aperturas de cada una |
| Mandar la delegación aparte, detrás | no lo baja (550–903 ms): lo que pesa es la historia | sonda |
| Abrir el micrófono (WaveIn, 24 kHz) | 319–512 ms hasta grabar; **546 ms** tras 15 s de reposo | sonda, 10 aperturas |
| Abrir el micrófono por WASAPI | 333–584 ms; 526 ms en frío. No es la API | sonda, 7 aperturas |
| De eso, **inicializar** el dispositivo | **449 ms** | sonda `prelisto` |
| **Arrancarlo** ya inicializado | **240–257 ms**, también tras 20 s parado | sonda `prelisto`, 4 vueltas |
| Inicializado y sin arrancar, ¿consta como micrófono en uso? | **no**: Windows solo lo apunta entre arrancar y parar | registro `ConsentStore\microphone`, leído en cada estado |
| Pararlo | 0–1 ms | sonda `prelisto` |
| Dónde se abría el micrófono | en el hilo de la interfaz, con el candado que también usan la boca y el halo | `LiveAudio.AbrirLocal` |
| Audio mandado ANTES de `session.started` | **el servidor lo tira**: de «Manzana. Repite solamente la primera palabra que dije» contestó «Repite.» y no transcribió nada | sonda, caso «antes» |
| Audio guardado y mandado en ráfaga DESPUÉS | lo oye entero: transcribió «Manzana. Re…» y contestó «Manzana.» | sonda, caso «ráfaga» |
| Dos aperturas a la vez | `socket conectado` dos veces en el mismo segundo (10:03:16) | log de la Ü del dueño, 2026-09-30 |
| La sesión que no abre | 14 aperturas rechazadas con `Initial items must not exceed 8192 tokens` entre el 29 y el 30 | logs de la Ü del dueño |
| Por qué | `Historial()` mandaba los últimos 56 turnos sin tope de tamaño (hasta 4.000 caracteres cada uno) | `ConversacionPersonal.Historial` |
| Qué esperaba el apagado | `await mirada.SoltarAsync()` —un DELETE por HTTP por cada mirada, 475–756 ms medidos— ANTES de `Viva = false` | `ConversacionEnVivo.TerminarAsync` |
| Qué hacía el final de una sesión vieja | `SeAcaboLaEscuchaAsync` cerraba «la voz» si `Viva`, fuera la suya o la que se abrió después | `ConversacionEnVivo` |

Lo que sale de las medidas, en orden:

1. **La estela y el micrófono esperaban a la red, y no hace falta.** Nada de lo que ve o hace la
   persona en el clic depende del servidor.
2. **«Escuchándome de verdad» no puede ser «el servidor confirmó»**: eso tarda de 1,2 a 2,6 s y no
   hay cómo bajarlo de ~800 ms (conectar + confirmar). Lo que sí se puede es que lo dicho desde el
   clic no se pierda: se capta, se guarda, y sale entero cuando el servidor confirma. La sonda dice
   que el servidor lo acepta así, y que lo que le llega antes de confirmar lo tira.
3. **El micrófono tardaba medio segundo en abrir, y casi todo era inicializarlo.** Inicializado de
   antemano, arrancarlo son ~250 ms — y preparado no capta ni enciende el indicador de Windows.
4. **El clic no alternaba: preguntaba un estado que cambiaba tarde.** Encender tardaba en constar
   (tras la red) y apagar tardaba en constar (tras borrar las miradas); entre medias, otro clic
   hacía lo contrario de lo que la persona quería.

## Por qué esto va dirigido por especificación

Es un bug que ya volvió: la spec 010 quitó 250 ms al clic («un botón de encender que tarda en
encender no se lee como lento, se lee como roto») y el retardo de fondo siguió ahí. Y cambia lo
que el sistema promete: hasta hoy nada decía cuándo consta encendida la voz, ni qué pasa con lo
que se dice mientras abre, ni qué hace un segundo clic.

**La regla del flujo, y no tiene excepciones:** ninguna línea de producción entra antes que la
promesa que la juzga. Cada fase empieza con el contrato ROTO y termina con el contrato INTACTO.

## La especificación

| # | Promesa | Fase |
|---|---|---|
| 660 | un clic enciende la voz sin esperar a la red: con el servidor todavía sin contestar, la voz ya consta encendida, avisó una sola vez y pidió el micrófono; un corte de red al conectar se reintenta sin apagarla, y si no hay manera se apaga y lo dice | 3 |
| 661 | lo que se dice mientras la sesión abre no se pierde ni se adelanta: nada sale antes de que el servidor confirme, y al confirmar sale entero y en orden, por delante de lo que se capte después; lo que no quepa en la espera se tira por lo más viejo y queda contado | 5 |
| 662 | cada clic alterna la voz exactamente una vez: una ráfaga de N clics la deja encendida si N es impar y apagada si es par, los avisos alternan sin repetirse, y la conexión que llega tarde se suelta sin abrir sesión | 4 |
| 663 | apagar no espera a nadie: con el borrado de las miradas colgado, al volver del clic la voz ya consta apagada, avisó, soltó el micrófono y no manda un trozo más; las miradas se retiran igual | 3 |
| 664 | apagar y volver a encender seguido deja viva la segunda: ni el cierre de la sesión vieja ni su escucha que termina cierran la nueva | 4 |
| 665 | el micrófono preparado entrega lo que pide el protocolo, venga como venga de Windows: de 48 kHz estéreo en coma flotante o de 16 kHz mono sale PCM16 mono al ritmo pedido, con la misma duración y el mismo tono, igual a trozos de 10 ms que de una vez | 6 |
| 666 | cada encendido y cada apagado dejan una línea voz-clic con los milisegundos de cada tramo desde el gesto, y el tramo que no llegó lo dice en vez de faltar | 2 |
| 667 | la historia que se manda al abrir cabe siempre en lo que el servidor acepta: se queda con los turnos más recientes que entren en el presupuesto, enteros y en orden | 1 |

Números: 532–535, 542, 620–629 y 640–648 los tienen otras ramas sin mergear; aquí se empieza en 660.

La que cierra el asunto es la **662**: mientras un clic pueda no alternar, todo lo demás es
velocidad sobre un interruptor que no es de fiar.

La 661 lleva una cláusula que no estaba al principio: **lo escrito** mientras la sesión abre
tampoco se pierde. Salió al revisar qué más daba por abierta una voz que solo estaba encendida.

### Con qué se juzga cada una

Sin socket, sin micrófono y sin clave: la conversación se construye de verdad y se le cambian las
puertas, como ya hacen la 208 y la 254. A las que había (`_puerta`, `_puertaAbierta`,
`_subeLaMirada`, `_borraLaMirada`) se suman dos: `_abreElCable` (lo que tarda el servidor en
contestar la conexión: el contrato lo deja colgado y lo suelta cuando quiere) y `_elMicro` (abrir y
cerrar el micrófono: el contrato solo lo anota). Los trozos de micrófono entran por `MandarTrozo` y
los mensajes del servidor por `Procesar`.

El cable de mentira **no obedece a la cancelación**, a propósito: una conexión de verdad puede
contestar después de que la persona ya apagó, y ese es justo el caso del log del 30.

La 665 juzga `DeLaMezclaAPcm16` con tonos sintéticos; la 666, `RelojDelClic` con un reloj de
mentira; la 667, `ConversacionPersonal.Historial` sobre un archivo temporal.

**Lo que el contrato no puede juzgar**, y por eso va al nivel 4 con el juez de fuera:

- los milisegundos sobre el PC real: ningún contrato sabe cuánto tarda este micrófono;
- que el cierre de una sesión no toque **el socket** de la siguiente: con el cable de mentira no
  hay socket. Lo juzga la ráfaga «encender, 2,5 s, apagar y encender a 150 ms»;
- que `LiveAudio` arranque de verdad el micrófono preparado: el cableado se lee en la fuente, y lo
  que prueba que corre es la línea `micrófono abierto … estaba preparado` del log;
- el collar que conecta tarde (`LiveAudio._cierres`): haría falta un collar de mentira.

## Las fases

| Fase | Pone verde | Toca |
|---|---|---|
| 0 | — | medir: sonda del micrófono y del servidor, juez de fuera sobre `main` |
| 1 | 667 | `Voice/ConversacionPersonal.cs` |
| 2 | 666 | `Voice/RelojDelClic.cs` (nuevo) |
| 3 | 660, 663 | `Voice/ConversacionEnVivo.cs`: encender y apagar constan en el gesto; la red va detrás |
| 4 | 662, 664 | `Voice/ConversacionEnVivo.cs`: cada sesión es dueña de su socket y de su cancelación |
| 5 | 661 | `voz/Realtime/PreEscucha.cs` (nuevo), `Voice/ConversacionEnVivo.cs` |
| 6 | 665 | `Voice/MicrofonoPreparado.cs` y `Voice/DeLaMezclaAPcm16.cs` (nuevos), `Voice/LiveAudio.cs`, una línea en `Ui/FaceWindow.xaml.cs` |

Sitios con la clase de error «el final de algo viejo toca lo nuevo», contados: **5** en
`ConversacionEnVivo` (el cierre tras sus esperas, la escucha que termina, la reconexión cancelada,
el apagado aplazado por orden de voz, la conexión que contesta tarde) y **3** en `LiveAudio` (el
collar que conecta tarde, su salida al micrófono local, el reintento de diez segundos).

## Lo que NO entra

- **Calentar la conexión con el servidor.** Medido: ahorra ~70 ms de 470.
- **Abrir la sesión, o el socket, antes del clic.** GPT-Live cobra por segundo de sesión; y un
  socket por cada vez que el ratón pasa cerca, para ganar ~450 ms de respuesta, es otra decisión.
- **Lo que tarda el servidor en confirmar.** Depende sobre todo de la historia que lleva la
  apertura (849–1.235 ms con 11.450 caracteres, 586–656 sin ella). Con lo dicho a salvo desde el
  gesto, deja de ser lo que la persona espera para hablar; sigue siendo lo que espera para que Ü
  conteste a una frase muy corta. Bajarlo es recortar la historia, y eso es otra conversación.
- **El micrófono de unos audífonos Bluetooth no se deja preparado.** No se ha medido si
  inicializarlo basta para cambiarles el perfil a manos libres; por precaución se abre en el gesto,
  como hasta hoy (320–550 ms). En este equipo el micrófono por defecto es el del portátil.
- **El collar.** Con él conectado no hay dispositivo que abrir; lo que cambia para él es que
  colgar mientras se le busca ya no deja ningún micrófono abierto.

## Hallazgos

Lo que salió al implementarla, por orden (2026-10-01):

- **La primera idea para el micrófono fue adelantarse al clic, y se retiró.** Con abrirlo costando
  320–550 ms, se puso «en guardia»: al acercar el ratón a la carita el dispositivo empezaba a abrirse
  sin entregar nada. Medido sobre el PC, seis rondas con el ratón 150 ms encima antes de pulsar:
  micrófono a los 103–399 ms del clic; una séptima, en frío, **551 ms**. Pasaba del medio segundo,
  no valía para el doble Ctrl ni para la onda del notch, y encendía el indicador de micrófono de
  Windows con solo pasar el ratón. Entonces se le preguntó a la API qué parte de «abrir» era cara
  (aprendizaje nº13): inicializar, 449 ms; arrancar, 240–257. La guardia se borró entera
  (aprendizaje nº6) y el micrófono se deja inicializado.
- **Dentro de la app, arrancar el micrófono preparado tarda menos que en la sonda**: 7–38 ms cuando
  hace poco que se usó, contra los ~250 de un arranque tras 20 s parado.
- **El sabotaje de la 662 encontró una protección que no lo era.** Con las comprobaciones de «¿sigo
  siendo la sesión vigente?» quitadas, solo fallaban 2 de 6 ráfagas: en las otras cuatro la conexión
  tardía se paraba porque pedirle el testigo a una cancelación ya desechada lanza. Quién llegaba
  antes decidía. La cancelación de una sesión apagada ya no se desecha.
- **Lo escrito mientras abre se tiraba.** Con la voz encendida desde el gesto, una frase escrita
  podía llegar antes que el socket y `EnviarTextoInternoAsync` salía sin decir nada. Ahora espera a
  la confirmación. La cláusula salió roja la primera vez por una razón que no era esa: «abre el bloc
  de notas» ya venía dentro de la apertura, en la descripción de una herramienta.
- **`LiveAudio` tenía la misma clase de error con el collar**, tres veces: el collar que conecta
  después de colgar se enganchaba igual, su salida de emergencia abría el micrófono del computador
  con la voz apagada, y el reintento de diez segundos volvía a buscarlo.
- **El juez de fuera rompió a quien juzgaba.** Leía el log de la Ü con `File.ReadAllText`, que no
  comparte la escritura; si la app anotaba en ese instante, su log fallaba una vez y `LogBus` se
  apagaba para siempre (`_fileBroken`). Una tanda entera salió sin una línea de voz. El juez abre
  ahora compartiendo. Que `LogBus` no vuelva a intentarlo nunca es una deuda aparte.
- **Y medía la estela contra la foto equivocada**: con una referencia por caso, el caso que empezaba
  encendido comparaba contra una carita con estela, y «10 % de diferencia» se leyó como apagada. La
  referencia es una, la de la carita apagada, tomada antes del primer clic.
- **La promesa 337 está atada a la 663**: el sabotaje que quitaba el aviso de apagado la puso roja
  también (el notch se retira en ese mismo cambio). Bien atadas.
- **Mandar la delegación aparte no acelera la confirmación.** Se probó abrir con lo mínimo y mandar
  herramientas e instrucciones detrás: 550–903 ms contra 849–1.235. Lo que pesa es la historia.

## Lo que se midió sobre el PC real

Con el juez de fuera: ratón de verdad sobre la carita de una Ü de pruebas, la estela mirada en los
píxeles de la pantalla y el resto en el log de esa Ü. Milisegundos desde que se suelta el botón.
Una pantalla, y hay que decirlo: la carita suelta, en este portátil, con su micrófono.

**Encender** — `main`, 5 rondas; la rama, 12 (8 seguidas y 4 con 22 s de reposo entre una y otra):

| Desde el clic | `main` | la rama |
|---|---|---|
| Estela en la pantalla | 635–1.027 ms | **20–99 ms** |
| Micrófono grabando | 673–987 ms | **4–20 ms**; 246 la primera vez tras arrancar la app |
| Primer trozo de audio captado | no se medía | 94–120 ms; 297 la primera vez |
| El servidor confirma la sesión | 1.350–1.902 ms | 1.239–2.073 ms |
| Lo dicho entre el clic y la confirmación | se pierde | sale al confirmar: 1.200–2.000 ms guardados en cada ronda |

En las ráfagas el micrófono llegó a tardar 257–263 ms en arrancar (2 de 11 encendidos): es el
máximo medido, y es lo que cuesta arrancarlo cuando no viene de usarse.

**Apagar** — la app pinta la estela apagada a los 0–14 ms del clic (línea `voz-clic`). El juez
exige tres fotos seguidas sin estela, y por eso su cifra es mayor:

| Desde el clic | `main` | la rama |
|---|---|---|
| Estela fuera de la pantalla, sesión sin miradas | 263–435 ms | 106–176 ms (una de 252) |
| Estela fuera de la pantalla, con una mirada en la sesión | **706 y 1.003 ms** | 147 y 158 ms |
| El micrófono deja de entregar | 175–897 ms | 0–1 ms |
| La mirada se borra de OpenAI | antes de apagar | después, a los 437–500 ms, sin que nadie la espere |

**Ráfagas** — once casos; se juzga la estela en la pantalla seis segundos después del último clic:

| Caso | `main` | la rama |
|---|---|---|
| dos clics a 150 ms | **queda ENCENDIDA** | apagada (3 de 3 pasadas) |
| dos clics a 400 ms, el segundo mientras abre | hereda el estado del anterior | apagada (3 de 3) |
| tres clics a 200 ms | idem | encendida (3 de 3) |
| encender, 2,5 s, apagar y encender a 150 ms | encendida | encendida, y sigue viva (2 de 2) |
| cuatro clics a 120 ms | **queda ENCENDIDA, con 3 sockets abiertos** | apagada, 0 sockets (2 de 2) |
| cinco clics a 90 ms | encendida, con 3 sockets | encendida, 1 socket (2 de 2) |
| encender, 1,2 s, apagar, 300 ms, encender | encendida | encendida (1 de 1) |
| un clic para apagar, tras cada caso que acaba encendido | apagada | apagada (todas) |

En `main`, de los cuatro casos de más de un clic que parten de apagada, fallan dos; los otros tres
arrancan del estado que dejó el fallo anterior y no se pueden contar. En la rama no falló ninguno en
22 casos pasados: 11 con la primera versión del micrófono (la guardia, ya retirada) y 11 con el
preparado. Con dos clics a 150 ms la rama ni siquiera llega a abrir un socket: no hay sesión de pago
que cerrar.

Los archivos, con sus horas: `C:\U-versiones\voz-medidas\` (`antes-*.txt`, `despues-*.txt`).

**Lo que no se probó**: hablarle. Las pruebas pulsan y miden; que lo dicho en el primer medio
segundo llega al modelo está juzgado por partes —la sonda (el servidor oye una ráfaga mandada tras
confirmar), la promesa 661 (lo guardado sale entero y en orden) y el log (cuántos milisegundos se
guardaron en cada ronda)—, no de punta a punta con una voz. Tampoco el doble Ctrl ni el botón del
collar, que entran por el mismo `StartMicByFace`; ni la salida por parlantes, donde el carrillón del
clic entra ahora en lo guardado (en estas pruebas la salida eran unos audífonos).

## Cierre

- [ ] Todas las promesas verdes (`.\scripts\contrato-del-grafo.ps1` → CONTRATO INTACTO)
- [ ] `.\scripts\verificar.ps1` pasa, con evidencia en `out\evidencia.md`
- [ ] Probado sobre el PC real con el juez de fuera: rondas y ráfagas, antes y después
- [ ] El dueño lo probó hablando
