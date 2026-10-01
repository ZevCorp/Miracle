# Plan de implementación: pulsar el notch no le quita el teclado a la app de delante

Estado: **implementado** (2026-09-30) · Rama: `jose/el-notch-no-quita-el-teclado` · Sigue a la spec 065

## Diagnóstico: qué se midió

El dueño, al recibir la onda del notch como botón de la voz (spec 065, 2026-09-30): «arregla lo del
teclado». Lo del teclado es esto, medido ese mismo día sobre el PC real:

| Qué | Medida | Fuente |
|---|---|---|
| Ventana de delante antes de pulsar la onda | «Claude», la app en la que se estaba escribiendo | prueba de las 22:07, spec 065 |
| Ventana de delante después | «Ü Acciones»: el notch | la misma prueba |
| Qué lleva el notch para evitarlo | nada: `ShowActivated = false` solo vale al enseñarse, no al pulsarse | `PanelDeAcciones`, constructor |
| Qué estilo trae su ventana | `0x80088`: en capas, de herramienta y siempre encima | línea `alt-tab:` de su log |

Para quien prende la voz con la onda mientras escribe en otra app, eso es tener que volver a hacer
clic en su app para seguir escribiendo. Un interruptor de voz no es un sitio donde se escribe.

## Por qué esto va dirigido por especificación

Hay un caso en que el notch SÍ tiene que quedarse el teclado: el chat, que es justo para escribir.
Sin una promesa que diga las dos mitades, el arreglo de una rompe la otra, y cualquiera de las dos
roturas se ve igual desde fuera —«el teclado no está donde lo esperaba»—.

**La regla del flujo, y no tiene excepciones:** ninguna línea de producción entra antes que la
promesa que la juzga. Cada fase empieza con el contrato ROTO y termina con el contrato INTACTO.

## La especificación

| # | Promesa | Fase que la pone verde |
|---|---|---|
| 542 | pulsar el notch compacto no le quita el teclado a la app de delante: el clic llega —la onda sigue alternando la voz— pero no activa la ventana del notch; con el chat abierto sí la activa, porque ahí se escribe, y abrirlo con su botón se lo sigue dando | 1 |

### Con qué se juzga

La ventana del notch lleva `WS_EX_NOACTIVATE` mientras está compacta y se le quita con el chat
abierto. Qué estilo toca en cada caso lo decide una función pura,
`PanelDeAcciones.EstiloSegunElChat(exstyle, chatAbierto)`, que el contrato llama con el estilo real
del notch: pone el bit, lo quita, no toca ninguno más —tampoco el del notch apartado de la 527— y
aplicarla dos veces da lo mismo que una. Que se aplique en los tres momentos en que la respuesta
cambia —al nacer la ventana, al abrir el chat y al cerrarlo— se juzga leyendo la fuente.

Lo que el contrato no puede juzgar es que Windows haga caso: eso es el nivel 4, y aquí fue el que
decidió el diseño.

## Fases

| Fase | Pone verde | Toca |
|---|---|---|
| 1 | 542 | `PanelDeAcciones.cs`: `EstiloSegunElChat`, `AjustarActivacion` y sus tres llamadas |

## Lo que NO entra

- **La carita.** Su clic también activa su ventana, pero ahí se arrastra, se abre el menú y se
  escribe; cambiarle la activación es otra conversación, y hay otra rama abierta sobre ella.
- **Devolver el teclado al cerrar el chat.** Al cerrarlo, el notch sigue siendo la ventana activa
  hasta que se pulsa otra. Ya era así.

## Lo que se encontró al implementarla

**La primera versión pasó el contrato y no arreglaba nada.** Contestaba `MA_NOACTIVATE` a la
pregunta que Windows hace antes de cada clic (`WM_MOUSEACTIVATE`). La promesa se escribió sobre esa
respuesta, se vio roja, se puso verde y se saboteó con éxito. Y el PC la desmintió a las 23:40:
tras pulsar la onda, el notch no quedaba delante… ni la app tampoco. Delante quedaba una ventana
sin título —o ninguna: el instrumento de esa pasada no distinguía las dos cosas, y se corrigió para
la siguiente—, y la letra tecleada después no se llegó a teclear porque lo de delante ya no era de
la prueba.

Antes de reescribir se midió la alternativa sin recompilar: a las 23:42 se le puso
`WS_EX_NOACTIVATE` a la ventana del notch desde fuera (`SetWindowLongPtr` desde el guion de la
prueba), y las letras cayeron en la app. La promesa y el código se rehicieron sobre el estilo, y el
gancho se borró entero: lo que no sirve no se deja de adorno, y el contrato comprueba que no vuelve.

Dos lecciones de instrumento, las dos pagadas esa noche:

- **Sin testigo no hay medida.** La primera pasada dijo «delante antes 'Ü', después 'Ü'»: la ventana
  de delante ya era la propia Ü de pruebas, así que no cambiar no probaba nada. Desde entonces la
  prueba abre una ventana testigo con una caja de texto, le hace clic, y TECLEA una letra después de
  cada clic en el notch: la letra cae en el testigo o no cae.
- **Quitar la clave de voz del entorno no impide la voz de pago** (spec 065). Aquí la Ü de pruebas
  arranca con una clave INVENTADA, que manda sobre la del registro: la sesión falla con un 401 y no
  se abre ni un segundo.

## Evidencia (2026-09-30)

**Contrato:** rojo antes del código las dos veces (`⧗ PENDIENTE: «PanelDeAcciones.AlPreguntarSiActiva»`
con la primera versión, `⧗ PENDIENTE: «PanelDeAcciones.EstiloSegunElChat»` con la definitiva), e
INTACTO al final.

**Sabotaje, comprobado que se aplicó** (el guion que sabotea falla si el reemplazo no casa, y se
contaron las líneas saboteadas en el archivo antes de cada corrida):

| Qué se rompió | Con qué salió rojo |
|---|---|
| el estilo no se quita nunca, y al nacer la ventana no se ajusta | «con el chat abierto se le quita… (quedó en 0x8080088)», «y solo se le quita eso», «[cableado] al nacer la ventana del notch no se le pone el estilo» |
| el estilo no se pone nunca, y no se ajusta ni al abrir ni al cerrar el chat | «compacto, la ventana del notch no se activa al pulsarla… (quedó en 0x80088)», «[cableado] al abrir el chat no se le quita», «[cableado] al cerrar el chat no se le vuelve a poner» |

Sitios donde cambia si el notch debe activarse: 3 (nace la ventana, se abre el chat, se cierra), y
los 3 llaman a `AjustarActivacion`.
