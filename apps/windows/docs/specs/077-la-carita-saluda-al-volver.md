# Plan de implementación: la carita saluda cuando vuelves, y atiende mientras conversas

Estado: **implementado; en la app solo se vio el saludo de arranque** · Nace de lo que el dueño dijo el 2026-10-01 al ver la carita de la spec 052 · Rama: `jose/la-carita-saluda-al-volver` · Promesas **690-692** (reservadas 690-699)

> El dueño, en un audio del 2026-10-01, con la carita de la spec 052 ya en `main`: «quiero que
> cuando estemos hablando tenga algún tipo de gesto; puede ser, en la vitrina de la carita, el que
> dice grabando, justamente. Y el saludar definitivamente quiero que suceda más veces: apenas abres
> el app, o apenas interactúas como que la estás viendo por primera vez en el día o en el rato, o
> desbloqueas el computador, o mejor dicho apenas estás volviendo a interactuar con ella —encuentra
> la forma de detectar esos momentos—, que salude. Y luego que vuelva a saludar espontáneamente cada
> media hora, algo así. Creo que exageramos con lo de tres horas.»

## Diagnóstico: qué se midió

| Qué | Medida | Fuente |
|---|---|---|
| Cada cuánto saluda sola la carita | entre 90 y 180 minutos, y solo si en ese instante está en reposo; si no, se salta hasta el siguiente | `GestosDeLaCarita.ProximoSaludo` y `FaceControl.StartIdle` en `main` (`8ad51c8b`) |
| Quién más la hace saludar | nadie: `Saludar()` solo se llama desde ese reloj | grep de `Saludar(` en `windows-client/src`: 1 sitio |
| Cuántos relojes de saludo hay | dos, uno por cada dibujo de la carita (la suelta y la del muelle), sin saber el uno del otro | `Face.StartIdle()` y `CollapsedFace.StartIdle()` |
| Qué sabe hoy la app de si la persona está | nada: ni cuánto lleva el PC sin tocarse, ni si se desbloqueó | grep de `GetLastInputInfo` y de `SystemEvents`: 0 sitios |
| Qué cara pone mientras escucha en una conversación | casi la del reposo: la boca mide lo mismo (37 de ancho) y el ojo un 5 % más | la tabla de poses de `FaceControl` |
| Qué cara es «la que dice grabando» | boca pequeña (24 de ancho contra 37), ojos abiertos del todo, cejas rectas, quieta | ídem |

## Por qué esto va dirigido por especificación

Porque el saludo ya se movió dos veces en dos días, y las dos por gusto: salía cada 8-18 segundos
(«todo el tiempo haciendo gestos»), se mandó a cada dos horas («que sea raro de ver») y al día
siguiente «exageramos». Lo que el dueño pide ahora no es un número intermedio: es que salude
**cuando hay a quién saludar**. Eso es una regla con cuatro entradas y dos guardas, y sin una
promesa que la juzgue lo siguiente que se toque la deja saludando dos veces seguidas al desbloquear,
o en mitad de una conversación.

**La regla del flujo, y no tiene excepciones:** ninguna línea de producción entra antes que la
promesa que la juzga.

## La especificación

| # | Promesa | Fase |
|---|---|---|
| 690 | la carita saluda cuando vuelves: al abrir Ü, al desbloquear el computador, al volver a tocarlo tras cinco minutos sin hacerlo y al acercarle el ratón tras diez minutos sin tratarla; y sola, cada 20 a 40 minutos; nunca dos veces en menos de minuto y medio, ni en mitad de una conversación o de un trabajo | 1, 2 |
| 691 | mientras conversas con ella y te escucha, la carita atiende: pone la cara quieta y de boca pequeña de cuando graba, distinta de la del reposo; y al hablar sonríe ancho, como siempre | 3 |
| 692 | hay un solo reloj del saludo y vive en la ventana: el dibujo de la carita, solo, únicamente parpadea | 2 |

La **444** (spec 052) se reescribe en su parte del saludo, a petición del dueño: decía «el saludo sale
solo muy rara vez, entre hora y media y tres horas». Ahora dice que sola solo parpadea, y el saludo
lo promete la 690. El número no se recicla.

**La que cierra el asunto es la 690.** Las otras dos la sostienen: la 692 impide que vuelva a haber
dos relojes que no se conocen, y la 691 es la otra mitad de lo que pidió.

### Las decisiones, y de dónde salen

- **Cuatro momentos de «volver», y por qué esos.** Abrir Ü y desbloquear el computador los dijo el
  dueño. «Apenas estás volviendo a interactuar» se mide con lo que Windows ya sabe: cuánto hace de la
  última tecla o movimiento de ratón (`GetLastInputInfo`). Cinco minutos sin nada es haberse ido —un
  café, una llamada—; menos es estar leyendo. Y «la estás viendo por primera vez en el rato» es
  acercarle el ratón tras diez minutos sin tratarla.
- **Minuto y medio entre saludos.** Volver de un bloqueo dispara dos avisos a la vez —el desbloqueo y
  la primera tecla tras la ausencia—, y un saludo doble se lee como un tic.
- **No interrumpe.** En una conversación o trabajando, no saluda: el momento se pierde, no se
  aplaza. Saludar tres minutos tarde no es saludar.
- **De 20 a 40 minutos, sola.** «Cada media hora, algo así», con azar para que no sea un reloj.
- **La cara de atender es la de grabar, tal cual.** No una parecida: la misma pose, compartida, para
  que no puedan separarse sin querer. Sustituye a la de conversar de agosto, que era «casi el reposo»
  a propósito porque entonces la alternativa eran los ojos como platos y un jadeo continuo; la de
  grabar es quieta.
- **Acercar el ratón cuenta como tratarla aunque no salude.** Si no, pasar por encima cada pocos
  minutos nunca dejaría correr los diez.

### Con qué se juzga

- **690**: `Ui.ReglaDelSaludo`, pura, con el reloj de mentira: los cuatro motivos, la guarda de
  minuto y medio, que ocupada no saluda y no gasta el turno, la ausencia de cinco minutos contada
  desde lo que tarda el PC sin tocarse, y los plazos del saludo espontáneo. Y `[cableado]`: que la
  ventana se suscribe al desbloqueo, saluda al arrancar, pregunta por la vuelta y por el rato, y
  saluda al acercarle el ratón.
- **691**: lo pintado. La tinta de la boca conversando mide lo mismo que grabando y bastante menos
  que en reposo; hablando, bastante más.
- **692**: `[cableado]`: `StartIdle` solo parpadea, `Saludar()` se llama desde un solo sitio de la
  ventana, y `GestosDeLaCarita` ya no tiene plazo de saludo.
- **Sobre la máquina** (nivel 4): abrir Ü y verla saludar con su línea en el log; acercarle el ratón.

## Las fases

| Fase | Promesa | Qué toca | Terminado |
|---|---|---|---|
| 1 — la regla | 690 | `Ui/ReglaDelSaludo.cs` (nueva) | la parte pura de la 690 verde |
| 2 — un solo reloj, en la ventana | 690, 692 | `FaceWindow.xaml.cs` (el saludo), `FaceControl.StartIdle`, `GestosDeLaCarita` | 690 y 692 verdes |
| 3 — la cara de atender | 691 | la tabla de poses de `FaceControl` | 691 verde |

**Sitios** (grep del 2026-10-01): quién llama a `Saludar()`, 1 (el reloj de `StartIdle`, que corre
dos veces); quién pone la cara de conversar, 1 (la tabla de poses).

## Lo que NO entra

- Saludar al volver de una suspensión por su cuenta: la suspensión acaba en un desbloqueo o en una
  primera tecla, y esos dos ya saludan.
- Otro gesto distinto para la conversación (asentir, ladear): el dueño eligió la cara de grabar.
- La carita sentada en el muelle no saluda: el saludo pide que la ventana de la carita esté a la vista, y
  sentada no lo está. Ahí el ratón abre el muelle.
- El saludo del rato a una silla vacía: si llevas cinco minutos sin tocar el PC no sale, y al volver te
  saluda la vuelta.

## Hallazgos

- **2026-10-01, el rojo antes del código, medido.** CONTRATO ROTO con la 690, la 691 y la 692, y la
  444 —ya sin su parte del saludo— verde. La 691 midió por qué conversar no se distinguía: la boca
  conversando daba 41 de ancho, lo mismo que en reposo, contra 28 grabando; 635 píxeles separaban las
  dos caras.
- **El sabotaje, comprobado por diff y por el veredicto.** Tres roturas a la vez: sin la guarda entre
  saludos → 690 roja («a los 5 s de un saludo no saluda otra vez», «ni a los 85 s»); conversar otra
  vez con la pose de agosto → 691 roja; el dibujo saludando por su cuenta → 692 roja. 414 ✔ y 3 ✘:
  ninguna otra se movió.
- **Una Ü de pruebas a la vista se toca como si fuera la de verdad.** A los 73 segundos de levantarla,
  alguien le prendió la voz cuatro veces en 23 segundos (07:12:43 a 07:13:06): el dueño, tocándola o
  con el doble Ctrl, que es global y lo oyen todas las Ü abiertas. Tenía la voz desactivada a
  propósito, así que cada vez falló. Se cerró en el acto, y con ella la prueba de acercarle el ratón,
  que pedía diez minutos sin que nadie la tratara.
- **Acercarle el ratón nada más aparecer no sirve de atajo.** Se intentó para no esperar los diez
  minutos: el cursor estaba sobre la carita a las 07:15:20,4 y el único saludo fue el de arranque, a
  las 07:15:21. El aviso de «el ratón entró» solo llega cuando el ratón se MUEVE sobre algo que ya
  está pintado; colocado antes de que la carita exista, no hay entrada que contar.

## Cierre

- [x] Promesas 690-692 verdes (`.\scripts\contrato-del-grafo.ps1` → CONTRATO INTACTO, 417 ✔ · 0 ✘)
- [x] `.\scripts\verificar.ps1` pasa, con la tabla en el PR
- [x] Nivel 4, sobre U.exe real (build de esta rama, `C:\U-versiones\carita-saludo`, 2026-10-01
  07:11): **el saludo de arranque**, dos veces. El log: `[07:11:30] ui-anim: saluda: se abrió Ü`, un
  segundo después de aparecer la carita; las fotos con `PrintWindow` la enseñan con las dos manos
  fuera y la derecha arriba. Y los cuatro toques del dueño siguen rebotando (`toque: la carita
  rebota`), con el saludo ya cableado en ese mismo sitio.
- [ ] **No se vio en la app**, y lo sostienen la regla pura y el `[cableado]` de la 690: el saludo al
  desbloquear (habría que bloquearle el computador al dueño), al volver tras cinco minutos sin tocar
  el PC, al acercarle el ratón tras diez sin tratarla y el del rato (20-40 minutos). Tampoco la cara
  de conversar, que pide una sesión de voz de pago: se miró en la ventana de prueba y la juzga la 691
  con los píxeles.
