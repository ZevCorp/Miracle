# Plan de implementación: la voz se enciende y se apaga al primer clic

Estado: **en curso** · Nace del diagnóstico del 2026-09-30 · Rama: `jose/la-voz-al-primer-clic`

## Diagnóstico: qué se midió

El dueño (2026-09-30): «siempre que voy a activar la voz con la carita se demora un montón en
escucharme de verdad. La activo, se demora varios segundos en aparecer la estela y luego muchos más
en que me escuche. Quiero que sea inmediato: máximo 500 ms entre el clic y que de verdad me esté
escuchando. Y lo mismo para cerrarla: la cliqueo para cerrarla y no se cierra todavía, me toca
volver a hacer clic. Activar y desactivar la voz no es confiable».

Se midió antes de tocar nada, con tres instrumentos: los logs de la Ü del dueño, una sonda de solo
lectura contra el micrófono y el servidor, y un juez de fuera que pulsa la carita de una Ü de
`main` con el ratón de verdad y mira la pantalla (no el log) para saber cuándo se ve la estela.

| Qué | Medida | Fuente |
|---|---|---|
| Clic → estela visible, en `main` | **666–1.027 ms** (3 rondas) | juez de fuera, píxeles de la pantalla, 2026-10-01 00:02 |
| Clic → micrófono abierto, en `main` | **673–987 ms** | mismo juez, línea `micrófono abierto` |
| Clic → sesión confirmada, en `main` | **1.509–1.902 ms** con una historia de 11.450 caracteres | mismo juez, línea `sesión abierta` |
| Clic de apagar → estela apagada | 263–435 ms sin miradas en la sesión | mismo juez |
| Por qué la estela espera | `Viva` y `Cambio(true)` van DESPUÉS de `ConnectAsync` y de las instrucciones | `ConversacionEnVivo.ArrancarAsync` |
| Conectar el socket | 467–515 ms; la primera del proceso, 1.285 ms | sonda, 4 conexiones sin `session.start` |
| Conectar con el TLS ya hecho | 404–440 ms: calentar la conexión ahorra ~70 ms | sonda, `SocketsHttpHandler` compartido |
| `session.start` → `session.started` | 305–588 ms con una apertura mínima | sonda, 3 sesiones |
| Abrir el micrófono (WaveIn, 24 kHz) | **319–512 ms** hasta grabar, 433–664 ms hasta el primer trozo; **546 ms** tras 15 s de reposo | sonda, 10 aperturas |
| Abrir el micrófono por WASAPI | 333–584 ms; 526 ms en frío. No es la API: es el dispositivo («Varios micrófonos (Realtek)») | sonda, 7 aperturas |
| Cerrar el micrófono | 45–74 ms | sonda |
| Dónde se abre hoy el micrófono | en el hilo de la interfaz, con el candado que también usan la boca y el halo | `LiveAudio.AbrirLocal` |
| Audio mandado ANTES de `session.started` | **el servidor lo tira**: de «Manzana. Repite solamente la primera palabra que dije» contestó «Repite.» y no transcribió nada | sonda, caso «antes» |
| Audio guardado y mandado en ráfaga DESPUÉS de `session.started` | lo oye entero: transcribió «Manzana. Re…» y contestó «Manzana.» | sonda, caso «ráfaga» |
| Dos aperturas a la vez | `socket conectado` dos veces en el mismo segundo (10:03:16), y un segundo cierre a los 4 s | log de la Ü del dueño, 2026-09-30 |
| La sesión que no abre | 14 aperturas rechazadas con `Initial items must not exceed 8192 tokens` entre el 29 y el 30 | logs de la Ü del dueño |
| Por qué | `Historial()` manda los últimos 56 turnos sin tope de tamaño (hasta 4.000 caracteres cada uno) | `ConversacionPersonal.Historial` |
| Qué espera el apagado | `await mirada.SoltarAsync()` —un DELETE por HTTP por cada mirada, con 30 s de plazo— ANTES de `Viva = false` | `ConversacionEnVivo.TerminarAsync` |
| Qué pasa con un segundo clic mientras abre | `Viva` todavía es falso: otro `ArrancarAsync`, otro socket, y el campo `_ws` cambia de dueño | `AlternarAsync` |
| Qué hace el final de una sesión vieja | `SeAcaboLaEscuchaAsync` cierra «la voz» si `Viva`, sea la suya o la que se abrió después | `ConversacionEnVivo` |

Lo que sale de las medidas, en orden:

1. **La estela y el micrófono esperan a la red, y no hace falta.** Nada de lo que ve o hace la
   persona en el clic depende del servidor.
2. **«Escuchándome de verdad» no puede ser «el servidor confirmó»**: eso tarda 1,5–1,9 s en el mejor
   caso medido y no hay cómo bajarlo de ~800 ms (conectar + confirmar). Lo que sí se puede es que lo
   dicho desde el clic no se pierda: se capta desde el clic, se guarda, y sale entero cuando el
   servidor confirma. La sonda dice que el servidor lo acepta así, y que lo que le llega antes de
   confirmar lo tira.
3. **El micrófono tarda en abrir 320–550 ms él solo**, con la API que sea. Para estar captando a los
   500 ms del clic hay que empezar a abrirlo antes del clic: al acercar el ratón a la carita.
4. **El clic no alterna: pregunta un estado que cambia tarde.** Encender tarda en constar (tras la
   red) y apagar tarda en constar (tras borrar las miradas); entre medias, otro clic hace lo
   contrario de lo que la persona quería.

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
| 665 | el micrófono se pone en guardia al acercarse a la carita: lo captado en guardia no se entrega a nadie, sin clic se suelta solo, y con clic lo siguiente se entrega sin volver a abrir el dispositivo | 6 |
| 666 | cada encendido y cada apagado dejan una línea voz-clic con los milisegundos de cada tramo desde el gesto, y el tramo que no llegó lo dice en vez de faltar | 2 |
| 667 | la historia que se manda al abrir cabe siempre en lo que el servidor acepta: se queda con los turnos más recientes que entren en el presupuesto, enteros y en orden | 1 |

Números: 532–535, 542, 620–629 y 640–648 los tienen otras ramas sin mergear; aquí se empieza en 660.

La que cierra el asunto es la **662**: mientras un clic pueda no alternar, todo lo demás es
velocidad sobre un interruptor que no es de fiar.

### Con qué se juzga cada una

Sin socket, sin micrófono y sin clave: la conversación se construye de verdad y se le cambian las
puertas, como ya hacen la 208 y la 254. A las que había (`_puerta`, `_puertaAbierta`,
`_subeLaMirada`, `_borraLaMirada`) se suman dos: `_abreElCable` (lo que tarda el servidor en
contestar la conexión: el contrato lo deja colgado y lo suelta cuando quiere) y `_elMicro` (abrir y
cerrar el micrófono: el contrato solo lo anota). Los trozos de micrófono entran por `MandarTrozo` y
los mensajes del servidor por `Procesar`.

La 665 y la 666 juzgan su regla pura (`OidoEnGuardia`, `RelojDelClic`) con un reloj de mentira; la
667, `ConversacionPersonal.Historial` sobre un archivo temporal.

**Lo que el contrato no puede juzgar**, y por eso va al nivel 4 con el juez de fuera: los
milisegundos sobre el PC real. Ningún contrato sabe cuánto tarda este micrófono en abrir.

## Las fases

| Fase | Pone verde | Toca |
|---|---|---|
| 0 | — | medir (hecho): sonda del micrófono y del servidor, juez de fuera sobre `main` |
| 1 | 667 | `Voice/ConversacionPersonal.cs` |
| 2 | 666 | `Voice/RelojDelClic.cs` (nuevo) |
| 3 | 660, 663 | `Voice/ConversacionEnVivo.cs`: encender y apagar constan en el clic; la red va detrás |
| 4 | 662, 664 | `Voice/ConversacionEnVivo.cs`: cada sesión es dueña de su socket y de su cancelación |
| 5 | 661 | `voz/Realtime/PreEscucha.cs` (nuevo), `Voice/ConversacionEnVivo.cs` |
| 6 | 665 | `Voice/OidoEnGuardia.cs` (nuevo), `Voice/LiveAudio.cs`, `Ui/FaceWindow.xaml.cs` |

## Lo que NO entra

- **Calentar la conexión con el servidor.** Medido: ahorra ~70 ms de 470. No paga una conexión
  abierta por cada vez que el ratón pasa cerca.
- **Abrir la sesión antes del clic.** GPT-Live cobra por segundo de sesión; una sesión por cada
  acercamiento sin clic es dinero tirado.
- **El doble Ctrl y el botón del collar no tienen guardia**: no hay ratón que se acerque. Encienden
  la estela en el acto y guardan lo dicho igual, pero su micrófono empieza a captar cuando el
  dispositivo abre (320–550 ms en esta máquina). Con el collar conectado no hay dispositivo que abrir.
- **Que la onda del notch ponga el micrófono en guardia.** Enciende por el mismo camino (promesa
  540) y hereda todo lo demás; la guardia al acercarse a ella es otra rama.
- **Lo que tarda el servidor en confirmar** (el tamaño de la apertura, el delegado): con lo dicho a
  salvo desde el clic, deja de ser lo que la persona espera.

## Hallazgos

## Cierre

- [ ] Todas las promesas verdes (`.\scripts\contrato-del-grafo.ps1` → CONTRATO INTACTO)
- [ ] `.\scripts\verificar.ps1` pasa, con evidencia en `out\evidencia.md`
- [ ] Probado sobre el PC real con el juez de fuera: rondas y ráfagas, antes y después
- [ ] Estado de este documento: **implementado** (AAAA-MM-DD)
