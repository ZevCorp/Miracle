# El video de Ü — cómo se hace y cómo se cambia

La segunda macrosección de `/u` (la landing conceptual de Ü) es un **video**:
`public/u/assets/peli/u-trabajando.mp4`, 1920×1200, ~48 s, con la voz de Ü en
una sola pista. Se ve dentro de un monitor, con sus controles debajo.

No siempre fue así, y el "cómo" importa para poder cambiarlo.

## Por qué se cambió

Era una película en DOM: 13 escenas encadenadas por un reloj de
`requestAnimationFrame`, cada una disparando su propio `<audio>`. En la
práctica se oía cortada, y el reporte fue literal — *"el video de U está como
fallando, con voz se corta mucho"*.

Medido sobre la banda montada, había **entre 0,78 y 1,22 s de silencio entre
frase y frase**, doce veces seguidas. Dos causas sumadas:

- Los `dur` de cada escena estaban escritos a mano con ~700 ms de cola.
- Cada mp3 trae además ~150 ms de aire antes de la primera sílaba y ~270 ms
  después de la última, que nadie estaba descontando.

Y encima de eso, 13 `Audio.play()` encadenados: cada arranque se oye.

Tampoco se leía como un video. Ocupaba la pantalla entera, sin un solo
control, con el scroll bloqueado durante 29 s. Se parecía más a que la web se
hubiera puesto a hacer cosas sola que a una pieza que uno mira.

Hoy: **una sola pista de voz**, pausas de **0,44 s** entre frases, y un
reproductor con play, barra arrastrable —con lo reproducido y lo descargado,
como cualquier reproductor, y sin marcas de capítulo—, tiempo, sonido y
pantalla completa. Sin bloquear el scroll: si el video no está a la vista, se pausa; al
volver, sigue por donde iba.

## Qué es cada pieza

| Archivo | Qué es |
|---|---|
| `public/u/dentro.js` | La película en DOM. **Es el máster**, no lo que ve nadie. Solo se carga con `?render=1`. |
| `public/u/pelicula.js` | El reproductor del MP4: controles, sonido, entrar/salir de vista. Es lo que se carga en modo normal. |
| `public/u/index.html` | El escenario (`.v-escena`, `.v-marco`, `.v-controles`) y el markup del escritorio, que convive oculto. |
| `public/u/scene/oficina.js` | El 3D. Aquí vive el **empalme** (la cámara entra en la pantalla del iMac y aterriza en el video) y el **encaje a paradas** del scroll. |
| `scripts/render-u.mjs` | Graba el máster y monta el MP4. |
| `scripts/verificar-u.mjs` | 54 comprobaciones sobre la página. Se corre en varios tamaños: `--w/--h`, `--movil`, `--puerto`. |

## Rerenderizar el video

Cuando cambie el guion, la voz o el escritorio:

```bash
npm i --no-save playwright-core     # usa el Chrome del sistema, no descarga nada
node scripts/render-u.mjs
node scripts/verificar-u.mjs
```

Salen tres archivos a `public/u/assets/peli/`: el MP4, el póster y
`capitulos.json` (los arranques de escena). La página **no** usa el tercero: es
dato del montaje. La barra los pintaba como marcas y se quitaron — doce rayas
se leen como una pieza dividida en etapas, que es justo de lo que se venía.

Opciones: `--cola 450` (más aire entre frases), `--w/--h` (tamaño), `--crf`
(calidad; 21 por defecto), `--fps`.

**Los tiempos no se copian a mano.** El script mide con `ffmpeg` dónde suena de
verdad cada mp3, recorta el aire y le pasa esas duraciones a la página, que
reparte el tiempo de las escenas con ellas (`ajustarACola` en `dentro.js`). Por
eso al regenerar las voces no hay que tocar ningún número: se vuelve a correr y
ya. Si algún mp3 no se puede medir, esa escena se queda con su `dur` de siempre.

## Cosas que ya costaron una vez

- **El modo render tiene que ocultar `#loading`.** La cortina de carga la retira
  `oficina.js`, y en modo render el 3D no se carga. Sin esa regla el video sale
  entero color crema con un "cargando consultorio" en medio. Pasó.
- **El reloj de la barra de tareas se congela** antes de grabar, o el video
  lleva puesta la fecha del día en que se renderizó. Se hace reemplazando el
  nodo: el intervalo del sitio sigue escribiendo, pero sobre uno desconectado.
- **El empalme aterriza en `.v-pantalla`, no en el viewport.** Cuando el
  escritorio ocupaba la pantalla entera bastaba con escalar hasta la identidad;
  ahora hay que resolver la transformación que lleva el rectángulo del video
  hasta el de la pantalla del iMac. Está explicado en `aplicarEmpalme`.
- **`baseVideo()` mide con el transform quitado y cachea por tamaño de
  ventana.** Medir con el sticky ya escalado da el rectángulo de después; medir
  en cada frame es forzar un reflow a 60 fps dentro de la única animación que no
  tiene presupuesto.
- **El screencast de CDP no da fps constantes.** Los tiempos son de reloj de
  pared y se escriben como duración por frame; `ffmpeg` los lleva a 30 fps.
  Volcarlos a fps fijo en el script sería inventarse el movimiento.
- **El servidor de pruebas tiene que servir rangos.** Buscar el segundo 34 de un
  MP4 es una petición `Range`; un servidor que siempre responde 200 deja el
  `currentTime` donde estaba y parece un bug de la página.
- **`#hud` lleva `pointer-events:none`.** Es un indicador, y en móvil caía justo
  encima del botón de play y se comía el clic.
- **Los listeners de `wheel` son pasivos: Chrome ya movió la página cuando
  corren.** El encaje guardaba ahí el punto de partida del gesto y salía el de
  DESPUÉS del scroll, así que la regla de dirección no se cumplía nunca y el
  empujón te devolvía a la parada de la que venías. Con el dedo funcionaba
  (`touchstart` ocurre una vez), y esa asimetría fue la pista. Ahora el punto de
  partida es **la última parada en la que se descansó**, no lo que diga el
  scroll durante el gesto.
- **La pantalla completa se pide sobre `#v-escena`, no sobre `#v-pantalla`.**
  Los controles son hermanos del marco: pidiéndola sobre la pantalla se quedaban
  fuera y en pantalla completa no había ni play, ni barra, ni salida.
- **El video va con `object-fit:contain`.** En pantalla completa el hueco casi
  nunca es 16:10 y `cover` recortaba el 10 % del alto — adiós barra de tareas.
- **`resize` tiene que releer el riel.** `qEmpalme` depende de `innerHeight`; si
  solo se recalcula con el scroll, redimensionar o girar el teléfono a mitad del
  empalme lo deja congelado (medido: q se quedaba en 0.5 cuando tocaba 1).
- **Con el video encima, el 3D no se dibuja.** Con `opacity:0` el canvas seguía
  compositándose y el bucle seguía llamando a `composer.render()` a 60 fps
  detrás del video. Ahora `display:none` y el bucle salta el render.
- **Pantallas bajas (teléfono apaisado) mandan por ALTO, no por ancho.** A
  844×390 la cabecera se ponía a dos filas (90 px de 390) y el monitor le
  pasaba por debajo, con la fila de controles partida y fuera de la pantalla.
  Hay un `@media (max-height:560px)` para las dos cosas — y va **después** del
  `@media (max-width:900px)` de la cabecera: misma especificidad, gana el
  último. Puesto antes solo servía por encima de 900 px de ancho, o sea en
  ningún teléfono real salvo el que se midió.
- **El presupuesto de alto del monitor sale de `--marca-h`**, el alto REAL de
  la cabecera, no de un número fijo en `rem`. Con el número fijo, cualquier
  pantalla donde la cabecera creciera se quedaba sin sitio.
- **Las flechas del teclado son un gesto aparte.** Mueven ~40 px, menos que el
  umbral del encaje, así que se leían como "no te has movido" y la página no
  se movía nunca: pulsar ↓ tres veces dejaba el scroll en 0. Ahora `ArrowUp`/
  `ArrowDown` van directas a la parada anterior/siguiente — salvo dentro de la
  barra de avance, donde buscan en el video.
- **El velo del cierre tiene que ser casi opaco.** Con .55 se veía por debajo
  la llamada a la acción DIBUJADA en el último fotograma: el mismo titular dos
  veces, uno nítido y otro borroso.
- **El copy del riel hay que APAGARLO dentro del video.** Su ventana llega a
  `p=1.01`, así que a `q=1` seguía encendido detrás del escenario. Con el
  escenario opaco no se veía; en cuanto se desvanece al salir hacia la landing,
  reaparecía "Aprende como tú trabajas." cruzado con la fila de controles.
- **Al girar el teléfono se vuelve a la parada por ÍNDICE, no por píxeles.** El
  documento cambia de alto y el mismo `scrollY` ya no es el mismo sitio: se
  aterrizaba en la landing sin haber pedido nada. Solo se re-ancla si nadie se
  ha movido desde la última parada — si ya se fue a la landing, girar no puede
  devolverla al video.
- **Con el dedo apoyado no se encaja.** Un arrastre lento no vuelve a disparar
  `touchstart`: bastaba con parar el dedo 160 ms —sin levantarlo— para que la
  página se fuera sola casi 900 px por debajo. Y el dedo se sigue con eventos
  TÁCTILES, no de puntero: en cuanto el navegador decide que el gesto es un
  scroll dispara `pointercancel` aunque el dedo siga puesto.
- **La última parada se toma EXACTA.** Quedarse 20 px antes es invisible (la
  escala va en 1.0003) pero el empalme sigue técnicamente a medias: `tapado` no
  se activa y el 3D sigue dibujando detrás de un canvas invisible.
- **Un gradiente radial se pinta DENTRO de su caja.** Si el radio es mayor que
  la distancia del centro al borde, no llega a `transparent`: se corta, y lo
  que queda es un rectángulo gris de borde recto sobre la escena — saltos de
  hasta 45 puntos de alfa en un píxel, y en el acto 3 una vertical perfecta
  recortando la cara de Ü. Justo la card que el comentario decía evitar. La
  regla: centro en `50% 50%`, radios `50% 50%`, última parada en `100%` — así
  toca cero exactamente en el borde — y el sesgo se hace moviendo la CAJA con
  insets asimétricos, nunca moviendo el centro del gradiente. `verificar-u.mjs`
  lo comprueba con la geometría, no con píxeles.
- **Pasado el pin del video, el scroll es del usuario.** El margen para dejar
  de encajar era `innerHeight * 0.12` —108 px— y un notch de rueda de Chrome son
  ~100: quien bajaba UN notch y se paraba veía cómo la página se devolvía sola
  al video, y otro notch hacía lo mismo. Quedaba encerrado. No hace falta
  margen: por arriba, la regla de la última parada ya obliga a aterrizar exacto.
- **En un teléfono vertical, "pantalla completa" no agranda nada por sí sola**:
  el video es 16:10 y la pantalla no, así que se pasa de 371 a 374 px de ancho.
  En iPhone lo resuelve el reproductor del sistema (`webkitEnterFullscreen`); en
  Android hay que pedir el giro con `screen.orientation.lock('landscape')`.
- **Bajar la opacidad no quita los clics.** Con el escenario de salida al 19 %
  —invisible— la barra de avance seguía a media pantalla comiéndose el clic que
  iba a la landing, y encima saltaba el video. Va con `pointer-events:none` en
  cuanto deja de verse.
- **El nombre accesible tiene que contener el texto visible** (WCAG 2.5.3). El
  botón de sonido decía "Silenciar" y se llamaba "Quitar el sonido": quien usa
  control por voz dice lo que lee y no pasa nada. Donde hay texto visible no se
  pone `aria-label`, y el de pantalla completa se llama igual que lo que enseña.
- **La pantalla completa hereda el estilo EN LÍNEA del fundido de salida.** Se
  veía el video lavado al 50 % — justo el botón cuyo trabajo es enseñarlo mejor
  —, y como ahí la rueda ya no scrollea, no se recuperaba en toda la sesión. Se
  limpia al entrar y se recalcula al salir.
- **UN solo sitio decide si el video debe estar corriendo.** Lo decidían dos
  —el `IntersectionObserver` y el fundido de salida— con umbrales distintos, y
  quedaba una banda con el video sonando y el ratón sin poder callarlo. Se tapó
  para el lado de bajar y **reapareció subiendo**, más ancha (142 px en una
  pantalla de 900): el observer cruzaba su umbral antes de que la salida
  soltara los clics, y ganaba él. Ahora los dos solo actualizan su dato y
  llaman a `revisar()`, que es quien decide. Dos dueños del mismo estado
  siempre acaban así — pasó tres veces en este archivo (esto, la opacidad en
  pantalla completa, y el `dedoAbajo` del encaje).
- **Una media query que va ANTES de la regla base no gana.** Pasó dos veces: con
  la cabecera en apaisado y con el velo del hero en móvil. Misma especificidad,
  gana la última — y los bloques `@media` de este archivo están repartidos por
  todo el `<style>`, así que hay que mirar dónde cae cada uno.
- **`.v-rotulo` necesita `position:relative;z-index:1`.** `.v-fondo` es
  absoluto con `z-index:0`, así que se pinta por encima de cualquier hermano
  estático: el rótulo estaba ahí, con su caja medida, y no se veía.

## El cierre

El último fotograma del video trae dibujada su llamada a la acción — y un
dibujo no se pulsa. Con la película en DOM ese botón sí funcionaba, así que
dejarlo en pixeles habría sido perder algo por el camino. Al terminar el video
sale `#v-fin` encima de la pantalla, con el botón de verdad (`data-agendar`,
que abre el calendario) y un "ver otra vez". Nunca antes de terminar: un panel
encima de una pieza que está corriendo es exactamente el pop-up que se quitó.

## El texto de las paradas se mide, no se supone

Desde que el encaje **obliga** a parar en el plano del acto 3, el copy de ese
plano dejó de ser algo que se cruza de paso. Y ahí el riel encuadra la cara de
Ü, que es casi blanca, justo detrás del texto blanco: medido, el peor fondo
daba **2.4:1** — ilegible.

Lo mismo pasa en el hero, que también es parada: el titular caía sobre el
bisel claro del iMac (1.9:1) y en móvil el eyebrow sobre la pared beige.

Los dos llevan un velo elíptico detrás (`::before`) y una sombra pegada a la
letra. Elipse y no caja a propósito: en esta pieza no hay cards. Hoy miden
**5.1–8.3:1** según pantalla y bloque.

`verificar-u.mjs` lo comprueba de verdad, y la forma de medirlo costó cuatro
intentos: **se fotografía el fondo con el texto oculto**, se miden las cajas de
las LÍNEAS (`Range.getClientRects()`, no la caja del bloque — un `<span>` de
bloque ocupa todo el ancho aunque su texto acabe a la mitad, y medir el hueco
vacío penalizaba un sitio sin una letra), y se cuenta el ALFA del color: el
eyebrow del hero es blanco al 90 %, así que lo que se ve no es blanco sino esa
mezcla con lo que hay detrás. Separar letra y fondo
en una sola captura no funciona — el párrafo no es blanco puro, así que
descartar "lo casi blanco" acaba midiendo la propia letra (daba 3:1 sobre fondo
negro), y descartar por cercanía al color del texto recorta justo el rango de
fondos malos y satura la medida. Con el texto oculto lo que queda es
exactamente el fondo, el color sale del CSS, y se mide por celdas dentro de
cada línea: lo que rompe la lectura es una mancha clara detrás de MEDIA línea,
y cualquier promedio del bloque se la traga. Comprobado que la prueba falla si
se quita el velo (1.34:1).

## El encaje a paradas (la sección del 3D)

El riel es continuo pero el texto no: cada bloque de copy vive en una ventana de
`p` (`data-desde`/`data-hasta`) y entre ventana y ventana no hay nada que leer.
Medido: soltar el scroll entre 200 y 500 px, o entre 1700 y 1950, dejaba un
plano del consultorio sin una sola palabra.

Ahora, **cuando el scroll se para** (160 ms sin eventos), se termina el viaje
hasta la parada más cercana; y si el gesto avanzó de verdad y la más cercana es
la de partida, sigue a la siguiente en esa dirección — un empujón corto avanza
una escena entera. Las paradas se derivan de los propios bloques de copy, así
que si el copy se mueve, las paradas se mueven con él.

Lo que no hace, a propósito: no toca nada mientras el dedo está encima, se
cancela con cualquier gesto nuevo, y no pasa de `#dentro` (la landing de abajo
se scrollea como cualquier web).

## Móvil

En vertical el video ocupa poco más de un cuarto de la pantalla: es 16:10 sobre
una pantalla que no lo es. Para que no quede un monitor flotando en un fondo
vacío, ahí —y solo ahí, en apaisado no sobra un píxel— la sección se presenta
con su rótulo encima (`.v-rotulo`), que además es lo que falta en móvil: el
título de la sección vive DENTRO del video y ahí se lee a 6 px.

Al salir hacia la landing el escenario se desvanece (`alSalir` en
`pelicula.js`): sin eso quedaba la cola de la fila de controles pegada bajo la
barra de navegación y un bloque oscuro vacío hasta la sección siguiente.

A 390 px de ancho el texto de dentro del video queda a unos 6 px y no se lee. Por eso en móvil el botón de pantalla
completa se nombra ("Ver en grande") — en apaisado sí se lee, y en iPhone lo
abre el reproductor del sistema. Un segundo render en vertical resolvería mejor
esto, pero **el layout móvil del escritorio en DOM está roto** (paneles
encimados), así que primero habría que arreglar eso.

## Lo que se dejó fuera a sabiendas

- **El markup del escritorio se sirve a todo el mundo**: **6,5 KB** ocultos con
  `display:none`, de una página de 114 KB (35 KB gzip). El CSS que solo sirve al
  máster son otros ~16 KB, identificables por prefijo (`.escritorio`, `.d-*`,
  `#d-*`, `html.modo-render`). Sacarlo todo a un `render.html` es posible; no se
  hizo porque partir el `<style>` de la página en dos archivos que hay que
  mantener sincronizados cuesta más de lo que ahorran 6,5 KB sin comprimir.
- **No hay un segundo render en vertical para móvil.** A 390 px el video mide
  371×232 y el texto de dentro queda en ~2 px: ilegible. Es física —16:10 en una
  pantalla vertical— y la salida es "Ver en grande", que ahora sí agranda en los
  dos sistemas. Un render 4:5 se puede montar desde el máster con `ffmpeg` y
  `capitulos.json`, pero es otro encargo, y antes habría que arreglar el layout
  móvil del escritorio en DOM, que está roto (paneles encimados).
- **No hay pista de subtítulos (`<track>`).** El video trae el texto QUEMADO —
  titular de capítulo y la frase narrada literal en la burbuja—, que es lo que
  WCAG 1.2.2 pide. Una pista seleccionable y escalable sería mejor, sobre todo
  en móvil, pero es trabajo aparte.
- **Subiendo desde la landing se puede descansar en el tramo de salida.** El
  encaje no pasa de `#dentro` a propósito: la landing se scrollea como cualquier
  web. Lo que se ve ahí es el escenario desvaneciéndose, no un plano mudo.
