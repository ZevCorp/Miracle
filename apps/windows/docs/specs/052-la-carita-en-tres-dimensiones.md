# Plan de implementación: la carita gira la cabeza, saca las manos y nunca cambia de color

Estado: **propuesto** · 2026-09-30 · Rama: `jose/carita-3d` · Promesas **440-444** (reservadas 440-449)

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
| 440 | la carita es siempre blanca o negra: en todos sus estados —también grabando, esperando, detenida, en fallo y hablando con la boca abierta—, en los dos temas y con las manos fuera, todo lo que pinta es gris (rojo, verde y azul valen lo mismo); el estado se dice con el gesto, no con el tono | 1 |
| 441 | girar la cabeza no es correr los ojos: los rasgos se proyectan sobre una cara curva, así que al girar todos se van hacia donde mira, el ojo que se acerca al borde se estrecha más que el otro y los dos quedan más juntos; ningún rasgo se sale de la cara; sin giro todo queda donde siempre estuvo; y lo pintado se mueve de verdad hacia ese lado | 2 |
| 442 | las manos asoman y se esconden: en reposo no se ven; al saludar salen por detrás de la cara —lo que la cara tapa no cambia—, una saluda mientras la otra se queda, y al terminar vuelven a esconderse solas en menos de dos segundos y medio | 3 |
| 443 | la carita tiene volumen: con luz arriba, el cuerpo es más claro arriba que abajo y más oscuro en el borde que hacia dentro, en los dos temas | 4 |
| 444 | la carita está viva sin estar ansiosa: parpadea sola cada 3 a 7 segundos —cerrar es más rápido que abrir y el parpadeo entero dura menos de un cuarto de segundo—; los gestos grandes (girar la cabeza, sacar las manos, un pulso) siguen espaciados 8 segundos o más y los tres salen; y quieta no pide cuadros | 5 |

### Con qué se juzga

**Lo pintado, no la paleta.** El contrato corre en un hilo STA con WPF: crea un `FaceControl` de
verdad, lo mide, lo pinta en un `RenderTargetBitmap` y mira los píxeles. Una paleta en grises que
nadie usara pasaría una prueba de paleta; los píxeles no se pueden engañar así.

- **440**: cada estado × cada tema × boca abierta y manos fuera → todo píxel con R = G = B.
- **441**: `Ui.CabezaDeLaCarita.Proyectar` sobre los rasgos de siempre (ojos a ±30, cejas a ±20 y
  ±40, comisuras a ±19) para giros de −1 a 1; y en los píxeles, el centro de la tinta se desplaza
  hacia el lado del giro.
- **442**: `Ui.ManosDeLaCarita` sobre la línea de tiempo del saludo; y en los píxeles, con las manos
  fuera aparece tinta **fuera** del cuerpo y todo lo que el cuerpo cubre queda idéntico.
- **443**: luminancia muestreada en el cuerpo, lejos de los rasgos.
- **444**: `Ui.GestosDeLaCarita` (la cadencia es pura: recibe el dado, devuelve el plazo) y la
  propiedad `Animando` del control recién creado.

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

## Decisiones tomadas sin preguntar (encargo nocturno)

- **La lengua pasa a gris.** Era rosa. «Siempre blanco o negro» no deja excepciones, y una lengua
  rosa en una cara en grises es justo lo que el ojo ve primero.
- **El parpadeo se separa de los gestos.** El 2026-08 la carita «se veía ansiosa» con gestos
  frecuentes y se espaciaron a 8-18 s. Aquello eran gestos grandes. Un parpadeo de 200 ms cada 3-7 s
  es lo que hace una cara real y no se lee como ansiedad; los gestos grandes se quedan en 8-18 s.
- **Las manos pueden salirse del control.** La ventana de la carita flotante deja 28 de margen
  transparente alrededor (para la sombra); las manos caben en él.
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

## Cierre

- [x] Promesas 440-444 verdes (`.\scripts\contrato-del-grafo.ps1` → CONTRATO INTACTO, 318 ✔ · 0 ✘)
- [ ] `.\scripts\verificar.ps1` pasa, con evidencia en `out\evidencia.md`
- [x] Nivel 4, sobre U.exe real (build de esta rama, 2026-09-30 06:22-06:27): en 40 s de captura la
  carita flotante giró a la derecha dos veces y a la izquierda una, parpadeó, y en otra captura asomó
  una mano en un saludo espontáneo. Log de la instancia sin excepciones. **Una pantalla** (la carita
  flotante); la carita del muelle (`Face`, 66 px) comparte el control pero no se miró abierta.
