# Plan de implementación: la carita gira la cabeza, saca las manos y nunca cambia de color

Estado: **implementado, con la segunda vuelta del 2026-10-01** · Rama: `jose/carita-3d` · Promesas **440-448** (reservadas 440-449)

> El dueño, en un audio del 2026-09-30 (transcripción en `fuentes/052-audio-2026-09-30.md`): «la
> carita actualmente es 2D, quiero que sea ligeramente 3D como el repositorio que te voy a mandar
> […] se siente que gira un poco la cabeza […] actualmente solo mira con los ojos hacia los lados
> […] que pueda tener esas manitos […] que las pueda sacar de vez en cuando, meterlas, no me gusta
> que cambie de color, quiero que sea siempre blanco o negro […] micro expresiones […] encontrar
> los pilares de diseño que permitieron ese nivel de visualización y aplicar los mismos pilares».
>
> La referencia es **Coucou** (`github.com/Louis-CFM/coucou`, commit `8f77fd8` del 2026-09-30), el
> reel de Instagram de `louis_rlee`. Leído entero: `windows/src/mochi/engine.ts` (1.156 líneas, el
> puerto a Canvas 2D de `BotEngine.swift`), `CLAUDE.md`, `LICENSE` y `LICENSE-ASSETS.md`, y el
> vídeo `docs/media/demo.mp4` fotograma a fotograma (2 por segundo).

## Diagnóstico: qué hace hoy la carita, y qué hace la referencia

| Qué | Hoy (`Ui/FaceControl.cs`) | Coucou (`mochi/engine.ts`) |
|---|---|---|
| Mirar a un lado | `EyeShift`: los dos ojos se corren **3,5 unidades** en x, iguales; cejas y boca quietas | `yaw`: cada ojo vive en una esfera — `x = sin(ángulo + yaw)·rx`, y se **comprime** por `cos(ángulo + yaw)`; el que se va hacia el borde se estrecha |
| Volumen | relleno plano: degradado blanco→blanco en claro | tres capas: degradado de luz de arriba (`#EDEDEF → #C4C5CA`), **viñeta** radial que oscurece el borde (0 → 20 % de negro), y un **brillo** especular arriba a la derecha (55 % de blanco) |
| Manos | no hay | dos elipses con el mismo degradado del cuerpo, **detrás** de él (se pintan antes), abajo a los lados; `hands` 0→1 las saca, la derecha saluda (oscila a 13 rad/s con giro de ±0,35) y la otra solo se mece |
| Color | el acento **tiñe** trazo y relleno en Grabando (rojo), Esperando (ámbar), Detenido (gris), Fallo (rojo); la lengua es rosa | cambia de color por estado — justo lo que el dueño NO quiere copiar |
| Parpadeo | onda triangular **simétrica** de 340 ms, un gesto cada **8-18 s** (65 % de ellos, parpadeo) → un parpadeo cada ~20 s | cierra en **70 ms**, abre en **130 ms**; cada **2,2-5,4 s**, doble el 22 % de las veces |
| Gestos | parpadeo, mirar (solo ojos), pulso uniforme | aplastar y estirar (`sx ≠ sy` con rebote), cabeza ladeada al preguntar, salto al atender, parpadeo al cambiar de estado |
| Coste en reposo | transform para lo continuo; DP con `AffectsRender` para lo puntual | el bucle de cuadros se detiene cuando nada se mueve (`busy`) — 0 % de CPU escondida |

**Los pilares de diseño, sacados del código y no de la impresión:**

1. **Los rasgos viven en una superficie curva.** No se desplazan: se proyectan. Eso — seno para la
   posición, coseno para el ancho — es todo el «gira la cabeza». Es la diferencia que pidió el dueño.
2. **La luz es fija y la cara se mueve debajo.** Degradado de arriba, borde en sombra y un brillo:
   con esas tres capas un squircle plano se lee como un objeto.
3. **Todo se mueve con curvas de inercia**: nada va lineal. Anticipación, rebote (`back`), aplastar
   y estirar conservando el volumen (si `sy` baja, `sx` sube).
4. **El personaje vive entre gestos**: parpadeos rápidos y frecuentes que no cansan, y gestos
   grandes espaciados.
5. **Lo que no se mueve no gasta**: el bucle de cuadros existe solo mientras hay animación.

## Lo que NO se copia, y por qué

`LICENSE-ASSETS.md` de Coucou reserva **el personaje Mochi** —«su diseño, aspecto, expresiones y
animaciones como personaje»—, sus sonidos y su nombre; el MIT cubre solo el código. Ü es un producto
comercial. Por eso **se copian las técnicas** (la proyección, las capas de luz, las curvas, la
cadencia) y **no el personaje**: la carita sigue siendo la nuestra —squircle, cejas, ojos de línea
y sonrisa— y las manos son las nuestras, con nuestras proporciones y nuestros grises. El dueño dijo
«igualitas a la referencia»: se igualan el comportamiento y el movimiento, que es lo que se ve en el
vídeo; el dibujo del personaje ajeno no.

## Por qué va dirigido por especificación

Porque las tres cosas que se piden se deshacen solas. «Nunca cambia de color» ya se hizo una vez para
el notch (spec 023) y la carita siguió tiñéndose: el que añada un estado verá que los estados se
distinguen por tono y seguirá el patrón. «Gira la cabeza» se puede fingir corriendo los ojos más
lejos —que es lo que hay hoy—. Y «parece 3D» sin medida es una opinión. Las cinco promesas convierten
cada una en algo que se rompe si alguien lo contradice.

## La especificación

| # | Promesa | Fase |
|---|---|---|
| 440 | la carita es siempre blanca o negra: en todos sus estados —también grabando, esperando, detenida, en fallo y hablando—, en los dos temas, con las manos fuera y presionando, todo lo que pinta es gris (rojo, verde y azul valen lo mismo); el estado se dice con el gesto, no con el tono | 1 |
| 441 | girar la cabeza no es correr los ojos: los rasgos se proyectan sobre una cara curva, así que al girar todos se van hacia donde mira, el ojo que se acerca al borde se estrecha más que el otro y los dos quedan más juntos; ningún rasgo se sale de la cara; sin giro todo queda donde siempre estuvo; y lo pintado se mueve de verdad hacia ese lado | 2 |
| 442 | las manos asoman y se esconden: en reposo no se ven; al saludar salen por detrás de la cara —lo que la cara tapa no cambia—, una saluda mientras la otra se queda, y al terminar vuelven a esconderse solas en menos de dos segundos y medio | 3 |
| 443 | la carita tiene volumen: con luz arriba, el cuerpo es más claro arriba que abajo y más oscuro en el borde que hacia dentro, en los dos temas | 4 |
| 444 | la carita está viva sin estar ansiosa: sola solo parpadea, cada 8 a 18 segundos —cerrar es más rápido que abrir y el parpadeo entero dura menos de un cuarto de segundo—; girar la cabeza y el pulso no salen solos; el saludo sale solo muy rara vez, entre hora y media y tres horas; y quieta no pide cuadros | 5, 7 |
| 445 | la carita blanca es casi blanca sin ser blanca: su cuerpo no llega al blanco puro en ningún punto ni se apaga —el centro no baja de 240 de 255, y arriba, abajo y a los lados no baja de 225—, y conserva el volumen | 6 |
| 446 | cuando Ü pulsa algo, la carita lo presiona con la mano: saca solo la mano de ese lado, la empuja hacia fuera y la esconde sola en menos de un segundo, por detrás de la cara; la mano no se sale del aire que la ventana de la carita le deja, tampoco al saludar; y solo presiona cuando el pulso es de Ü: señalar no saca la mano | 8 |
| 447 | los gestos responden a lo que pasa: tocar la carita la hace rebotar, y al ir junto a lo que Ü toca gira la cabeza hacia ello y la sigue teniendo girada aunque cambie de estado | 9 |
| 448 | al hablar la boca no se abre: es una línea en todos los estados, sin relleno ni lengua; hablar se ve en la sonrisa, que se ensancha poco a poco al empezar una frase y se relaja al callar, sin parpadear en cada frase | 10 |

La 444 se REESCRIBIÓ el 2026-10-01, antes de llegar a `main` (ver «La segunda vuelta»): decía «parpadea
sola cada 3 a 7 segundos […] los gestos grandes siguen espaciados 8 segundos o más y los tres salen». Y
a la 440 se le quitó «con la boca abierta» —ya no hay boca que abrir— y se le añadió «presionando».

### Con qué se juzga

**Lo pintado, no la paleta.** El contrato corre en un hilo STA con WPF: crea un `FaceControl` de
verdad, lo mide, lo pinta en un `RenderTargetBitmap` y mira los píxeles. Una paleta en grises que
nadie usara pasaría una prueba de paleta; los píxeles no se pueden engañar así.

- **440**: cada estado × cada tema, con las manos fuera y con una mano presionando → todo píxel con
  R = G = B.
- **441**: `Ui.CabezaDeLaCarita.Proyectar` sobre los rasgos de siempre (ojos a ±30, cejas a ±20 y
  ±40, comisuras a ±19) para giros de −1 a 1; y en los píxeles, el centro de la tinta se desplaza
  hacia el lado del giro.
- **442**: `Ui.ManosDeLaCarita` sobre la línea de tiempo del saludo; y en los píxeles, con las manos
  fuera aparece tinta **fuera** del cuerpo y todo lo que el cuerpo cubre queda idéntico.
- **443**: luminancia muestreada en el cuerpo, lejos de los rasgos.
- **444**: `Ui.GestosDeLaCarita` (la cadencia es pura: recibe el dado, devuelve el plazo), la
  propiedad `Animando` del control recién creado y, `[cableado]`, que `StartIdle` solo parpadea y
  saluda.
- **445**: luminancia en seis puntos del cuerpo lejos de los rasgos, y ningún píxel a 255.
- **446**: `Ui.ManosDeLaCarita.Presion` sobre su línea de tiempo; el alcance de la mano —al presionar
  y al saludar— contra el aire que dice `ReglaDelHalo`; en los píxeles, una sola mano, por su lado y
  por detrás; y `[cableado]`, que el pulso presiona y señalar no.
- **447**: una carita girada sigue girada tras cambiar de estado; y `[cableado]`, que el toque rebota
  y la visita mira.
- **448**: la tinta de la boca en cada estado y tema —su columna más alta no pasa de 9, o sea que es
  una línea—; el ancho de la sonrisa con `Llegada` en 0, 0,5 y 1; y los tiempos y el parpadeo de
  `Ui.GestosDeLaCarita` (`CuantoTardaEnLlegar`, `ParpadeaAlCambiar`).

**Sobre la máquina** (nivel 4, a mano): abrir U.exe y mirar la carita girar y saludar. Que *se vea
bien* no lo juzga ninguna promesa; lo dice el ojo.

## Las fases

| Fase | Promesa | Qué toca | Terminado |
|---|---|---|---|
| 1 — grises | 440 | `Ui/PaletaDeLaCarita.cs` (nueva), `FaceControl` deja de teñir | 440 verde |
| 2 — la cabeza | 441 | `Ui/CabezaDeLaCarita.cs` (nueva), `FaceControl.Giro` sustituye a `EyeShift` | 441 verde |
| 3 — las manos | 442 | `Ui/ManosDeLaCarita.cs` (nueva), `FaceControl.Manos` y `Saludar()` | 442 verde |
| 4 — el volumen | 443 | las tres capas de luz en `OnRender` | 443 verde |
| 5 — la vida | 444 | `Ui/GestosDeLaCarita.cs` (nueva), parpadeo propio y gestos grandes | 444 verde |

## La segunda vuelta (2026-10-01): lo que el dueño vio, y lo que cambió

El dueño vio la carita de la primera vuelta junto a la de `main` (una ventana de prueba con las dos,
movidas gesto por gesto) y dijo, en dos audios:

- **Le gustó**: el degradado y las sombras, que voltee la cara («me gusta bastante»), que salude con
  las manos, el rebote y los parpadeos.
- **El blanco quedó «muy opaco»**: «quiero que sea prácticamente blanco sin que sea blanco, porque
  el blanco puro lastima los ojos». Medido en la primera vuelta: el centro del cuerpo daba 234 de 255
  y el borde bajaba de 200. → promesa 445.
- **No le gustó CUÁNDO hace las cosas**: «el repo de inspiración es de un diseñador que lo hizo para
  que esté todo el tiempo haciendo gestos; prefiero que nuestra interacción sea mucho más basada en
  acciones reales que va ejecutando la carita». La carita de siempre «parpadea cada cierto tiempo que
  no se siente invasivo»; el saludo, «como cada dos horas […] con rangos aleatorios, pero largos […]
  que sea raro de ver». → la 444 reescrita: sola solo parpadea, a la cadencia de siempre (8-18 s), y
  girar y el pulso dejan de salir solos.
- **«Cuando haga clic, que saque las manos y haga el clic»**, y que al ponerse junto a lo que pulsa
  lo voltee a mirar con el giro nuevo. → promesas 446 y 447.
- **La boca al hablar es «extremadamente horrible»**, heredada de un experimento viejo: «toma la
  decisión de diseño correcta […] si la decisión es que no haya animación […] que le guste a los
  usuarios». → promesa 448.

### La decisión de la boca, y de dónde sale

Tres bocas abiertas ya se juzgaron mirando la pantalla y las tres se rechazaron: la rellena con
lengua que hay en `main` («horrible» el 2026-09-06 y otra vez hoy), y la hueca de trazo («parece que
tuviera labios negros»). Ese mismo día el dueño pidió «la cara compuesta» y que la voz se viera en el
halo; se hizo en la rama `jose/estetica-de-la-carita` y nunca llegó a `main`, así que siguió viendo
la boca que había rechazado.

La referencia apunta al mismo sitio: Coucou no tiene boca. Dice todo con los ojos, el cuerpo y las
curvas de inercia. Y hay una razón de tamaño: la carita mide 66 px y su trazo 1,8; una boca que
cambia de forma a ritmo de sílaba, a ese tamaño, es una mancha que tiembla.

Así que **la boca no se abre**. Sigue siendo la línea de la sonrisa, y hablar se ve de dos maneras:

1. **La sonrisa se ensancha mientras dice una frase y se relaja al callar.** Es la pose `Hablando`
   que ya existía, pero ahora se LLEGA a ella: 260 ms para ensancharse, 900 para relajarse — los
   tiempos de la envolvente que el dueño eligió el 2026-09-06 para el halo («a ritmo de sílaba da la
   sensación de una persona ansiosa»). Va a ritmo de frase, no de sílaba.
2. **El halo**, que ya late con el nivel real de la voz y no se toca.

Con eso se borra la maquinaria entera de la boca abierta (`MouthOpen`, `MouthRound`, la lengua y su
color, el vaivén para la voz sin nivel): cuando una pieza se retira, se borra, no se deja apagada.

Y de paso, **todas** las expresiones dejan de saltar: la carita pasa de una pose a otra en ~300 ms.
Era el tercer pilar de la referencia («nada va lineal») y solo se había aplicado a los gestos.

### Lo que se decidió sin preguntar en esta vuelta

- **El parpadeo vuelve a 8-18 s**, el reloj de la carita de siempre. La primera vuelta lo bajó a
  3-7 s; el dueño señaló como buena la cadencia vieja.
- **Presiona con UNA mano**, la del lado de lo que pulsó. Dos manos empujando a la vez se leen como
  un aplauso, no como un clic.
- **La mano presiona al llegar**, no antes: el clic de verdad ya salió (promesa 504: el ciclo no
  espera a la carita), y el gesto lo cuenta en cuanto la carita se posa.
- **Señalar no presiona.** `Senalador` (mostrar algo) y `UiaSurface.Pulso` (pulsarlo) entraban por la
  misma visita; ahora la visita sabe cuál de las dos es.
- **Cambiar de estado ya no devuelve la cabeza al frente.** Lo hacía de un salto, y con el giro
  nuevo se nota: mientras Ü trabaja y narra, el estado va y viene entre hablar y callar.
- **Un parpadeo por cambio de estado, salvo entre hablar y callar**, que en una conversación pasa
  cada pocos segundos.
- **El halo no se toca.** Su latido sigue el nivel de voz sin envolvente; es de otra spec y el dueño
  lo ajustó mirando la pantalla el 2026-09-30.

### Las fases de la segunda vuelta

| Fase | Promesa | Qué toca | Terminado |
|---|---|---|---|
| 6 — casi blanca | 445 | `Ui/PaletaDeLaCarita.cs` (la clara) | 445 verde, 443 sigue verde |
| 7 — sola solo parpadea | 444 | `Ui/GestosDeLaCarita.cs`, `FaceControl.StartIdle` | 444 verde |
| 8 — la mano que presiona | 446 | `Ui/ManosDeLaCarita.cs`, `FaceControl.Presionar`, `FaceWindow.Visitar`, `EstanciaDeLaCarita` | 446 verde |
| 9 — gestos por lo que pasa | 447 | `FaceWindow.StartMicByFace`, `FaceControl.OnMoodChanged` | 447 verde |
| 10 — la boca | 448 | `FaceControl` (poses que se mezclan, fuera la boca abierta), `FaceWindow` (el pulso de la voz ya no mueve boca) | 448 verde |

**Sitios con cada clase** (contados con grep el 2026-10-01): quién hace mirar a la carita, 1
(`FaceWindow.Visitar`); quién la deja de hacer mirar, 3; quién abre el micrófono al tocarla, 1 función
(`StartMicByFace`) con 2 llamadores —la del muelle y la suelta—; quién escribía la boca, 1
(`MoverLaBoca`); quién avisa de una visita, 2 (`Senalador.Senala` y `UiaSurface.Pulso`).

## Decisiones tomadas sin preguntar (encargo nocturno)

- **La lengua pasa a gris.** Era rosa. «Siempre blanco o negro» no deja excepciones, y una lengua
  rosa en una cara en grises es justo lo que el ojo ve primero. *(Deshecha en la segunda vuelta: la
  lengua se fue con la boca abierta.)*
- **El parpadeo se separa de los gestos.** El 2026-08 la carita «se veía ansiosa» con gestos
  frecuentes y se espaciaron a 8-18 s. Aquello eran gestos grandes. Un parpadeo de 200 ms cada 3-7 s
  es lo que hace una cara real y no se lee como ansiedad; los gestos grandes se quedan en 8-18 s.
  *(Deshecha en la segunda vuelta: el parpadeo vuelve a 8-18 s y los gestos grandes ya no salen
  solos.)*
- **Las manos pueden salirse del control.** La ventana de la carita flotante deja aire transparente
  alrededor y las manos caben en él. Eran 28 de aire al escribirlo; `main` lo bajó a 17 el mismo día,
  y desde la segunda vuelta la promesa 446 lo mide contra `ReglaDelHalo` en vez de darlo por hecho.
- **La mirada fija (`MirarHacia`) ahora gira la cabeza** en vez de correr los ojos: es lo que pidió
  el dueño y es el mismo gesto con más cuerpo.

## Lo que NO entra

- El personaje de Coucou: ojos de píldora, cuerpo, colores, sonidos, partículas. Ver arriba.
- Seguir el ratón con la mirada (Coucou lo hace). No se pidió, y una carita que te persigue por la
  pantalla mientras trabajas es otra conversación.
- El notch y la barra grande: sus paletas ya tienen promesa (242) y no se tocan.

## Hallazgos

- **2026-09-30, el rojo antes del código, medido.** Con las promesas escritas y sin una línea de
  producción: CONTRATO ROTO, 25 incumplidas, todas de la 440-444. La 440 encontró el tinte donde se
  sabía (Grabando, Esperando, Detenido y Fallo, ~20.000 píxeles con tono cada uno) y donde no: la
  **lengua rosa** tiñe hasta el Reposo en cuanto se abre la boca (61 píxeles, `#FFF1F2`). La 443
  midió el tema claro plano: 255 arriba, 255 abajo, 255 en el borde.
- **El sabotaje, comprobado por diff.** Cinco roturas a la vez, cada una contra su promesa: lengua
  rosa → 440 roja; girar = correr 3,5 unidades → 441 roja («1 contra 1», la tinta se mueve 2,4 px y
  no 6); manos pintadas encima → 442 roja («200 px cambiaron»); tema claro plano → 443 roja; cerrar
  en 170 ms → 444 roja. Ninguna otra promesa se movió (22 incumplidas, todas de la 440-444).
  Restaurado y comparado byte a byte con el respaldo.
- **Una trampa del propio banco de pruebas.** `%TEMP%\u-contrato\bin-app` guarda el ÚLTIMO build del
  contrato, y el último era el saboteado. Una hoja de contacto pintada desde ahí habría enseñado la
  carita rota como si fuera la buena. Se pintó desde un build aparte de las fuentes restauradas.
- **Capturar la carita viva**: `CopyFromScreen` sin `CAPTUREBLT` no ve las ventanas en capas
  (`AllowsTransparency`), y con la app de Claude a pantalla completa encima tampoco se ve con él.
  `PrintWindow` sobre el HWND de la carita sí, y en un proceso *DPI-aware*: sin eso la pantalla al
  125 % recorta la captura y parece que la carita se sale de su ventana.

### De la segunda vuelta (2026-10-01)

- **El rojo antes del código, medido.** CONTRATO ROTO con las 444-448 y ninguna otra. La 445 midió lo
  que el dueño había dicho con los ojos: centro 234 de 255, abajo 195, junto al borde 199 y 196. La
  447, que cada cambio de estado dejaba el giro en 0.
- **El sabotaje, comprobado por diff y por el veredicto.** Cinco roturas a la vez: parpadeo otra vez a
  3-7 s → 444 roja; la paleta vieja → 445 roja (232, 222, 194, 197, 194); las dos manos al presionar →
  446 roja («por el otro lado no sale nada: 840 px»); el giro a 0 al cambiar de estado → 447 roja;
  la pose sin mezclar → 448 roja («46 → 46 → 46 de ancho»). 384 ✔ y 5 ✘: ninguna otra se movió.
  `git diff --stat` enseñó las tres fuentes tocadas antes de juzgar, y `git checkout` las devolvió.
- **Las manos se dibujaron con 28 de aire y `main` lo bajó a 17 el mismo día.** Nadie lo había
  medido. Caben: al saludar llegan a 1,40 radios y al presionar a 1,48, de 1,54 que hay hasta el
  canto de la ventana. Ahora lo dice el contrato, anclado a `ReglaDelHalo`.
- **La promesa 504 anclaba la firma de `Visitar`** con una expresión regular (`Visitar\(Rect fisico\)`).
  Al añadirle `pulsa` se puso roja sin que lo que promete —el cuerpo entero dentro del `try`— hubiera
  cambiado. Se amplió el ancla, no la promesa.
- **Cada cambio de estado cortaba lo que la carita estuviera haciendo**: soltaba el pulso y el salto
  además de lo continuo. Con el rebote al toque se habría visto, porque tocarla abre la voz y la voz
  cambia el estado. Ahora solo para lo continuo del estado anterior, y vuelve andando.
- **Tres Ü a la vez en la pantalla.** Otra sesión levantó su Ü de pruebas mientras corría el nivel 4
  y su carita cayó exactamente encima de la de esta rama: el clic habría sido para ella. Se comprueba
  con `WindowFromPoint` antes de tocar, y la propia sube lo justo para el clic.
- **`instancia: nueva` del Bloc de notas trajo al frente la nota sin guardar del dueño.** No se
  escribió ni se cerró nada; la segunda pantalla pasó a ser un Explorador nuevo. Y Configuración no se
  dejó traer al frente desde una sonda.

## Cierre

- [x] Promesas 440-448 verdes (`.\scripts\contrato-del-grafo.ps1` → CONTRATO INTACTO, 389 ✔ · 0 ✘)
- [x] `.\scripts\verificar.ps1` pasa, con la tabla en el PR
- [x] Nivel 4 de la segunda vuelta, sobre U.exe real (build de esta rama, 2026-10-01 02:06-02:15,
  `C:\U-versiones\carita-3d`, con sus datos y su puerto), **dos pantallas**: en la Calculadora, Ü
  pulsó «Cinco», «Siete», «Nueve» y «Cerrar»; en el Explorador, «Descargas», «Documentos» y «Cerrar».
  Siete pulsos, y en los siete el log dice `visita «…»` y `presiona a la izquierda|derecha: la mano
  sale al posarse, en N ms` (seis a la izquierda, uno a la derecha); las fotos con `PrintWindow`
  enseñan la cabeza girada y la mano fuera, entera dentro de la ventana. Señalar «Uno» visitó sin
  presionar. Un clic real sobre la carita: `toque: la carita rebota`, y la foto la enseña aplastada.
  **No se probó en la app**: la sonrisa al hablar (pide una sesión de voz de pago; se miró en la
  ventana de prueba y la juzga la 448), el saludo espontáneo (sale cada hora y media a tres horas) y
  la carita sentada en el muelle.
- [x] Nivel 4 de la primera vuelta, sobre U.exe real (build de esta rama, 2026-09-30 06:22-06:27): en 40 s de captura la
  carita flotante giró a la derecha dos veces y a la izquierda una, parpadeó, y en otra captura asomó
  una mano en un saludo espontáneo. Log de la instancia sin excepciones. **Una pantalla** (la carita
  flotante); la carita del muelle (`Face`, 66 px) comparte el control pero no se miró abierta.
