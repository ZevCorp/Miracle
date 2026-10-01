# Plan de implementación: la onda del notch prende y apaga la voz

Estado: **implementado, sin probar a mano por el dueño** (2026-09-30) · Rama: `jose/la-onda-prende-la-voz`

## Diagnóstico: qué se midió

El dueño, con una captura del notch sobre Chrome (2026-09-30): «quiero que este icono que se ve a la
izquierda en el notch tenga el mismo funcionamiento que el de mensaje pero para activar y desactivar
la voz (misma acción que cuando hago clic en la carita)».

| Qué | Medida | Fuente |
|---|---|---|
| El icono de la izquierda | un `Path` dentro de un `Viewbox` de 26: se pinta y no se puede pulsar | `PanelDeAcciones`, constructor |
| El de mensajes, a la derecha | un `Button` de 32 × 32 con mano al pasar y nombre para UIA | `PanelDeAcciones.BotonMensajes` |
| Qué hace el clic en la carita | `StartMicByFace`: carrillón y `OnMic`, que alterna la conversación | `FaceWindow.xaml.cs` |
| Quién más entra por ahí | el doble Ctrl y el botón del collar: 3 gestos, un solo sitio que decide qué es «alternar» | `DobleCtrl`, `EngancharCollar` |
| Ventanas cuyo clic abre o cuelga la voz | 3 con su propio gancho contra los clics de Ü: carita, muelle y consulta. El notch no | `ToquesDeU.Proteger`, promesa 508 |

## Por qué esto va dirigido por especificación

Cambia lo que el notch promete: hasta hoy ningún clic en él tocaba la voz. Y lo cambia en la zona
que ya costó cinco sesiones de voz de pago en un día (2026-09-27, promesa 508): una ventana más
cuyo clic abre la voz es una ventana más donde un clic de Ü no puede contar como de la persona.

**La regla del flujo, y no tiene excepciones:** ninguna línea de producción entra antes que la
promesa que la juzga. Cada fase empieza con el contrato ROTO y termina con el contrato INTACTO.

## La especificación

| # | Promesa | Fase que la pone verde |
|---|---|---|
| 540 | la onda del notch es un botón como el de mensajes: pulsarla alterna la voz por el mismo camino que el clic en la carita y no abre el chat; su blanco mide lo mismo que el de mensajes sin mover el icono; y, como su clic ya abre o cuelga la voz, el notch lleva el mismo gancho que tira los clics de Ü | 1 |
| 541 | el icono del notch es siempre el del estado que toca: recién nacido enseña la onda —no un hueco—, y al retirarse vuelve a la onda quieta, no se queda con el dibujo ni con el giro del último paso | 2 |

Los números 532–535 los tiene `jose/exportar-al-his-web`, sin mergear: no se pisan.

La 541 no estaba en la petición: salió de la primera prueba sobre el PC real, que fotografió un
notch recién arrancado **sin nada a la izquierda**. Un botón que no se ve no es un botón, y el
momento en que más falta hace —Ü recién abierta, voz apagada, se llama al notch desde el borde— es
justo el momento en que el dibujo faltaba.

### Con qué se juzga

El contrato corre en un hilo STA, así que **construye el notch de verdad** —sin enseñarlo— y lo
pulsa: busca los dos botones por el nombre con el que los ve UIA, levanta el `Click` de la onda y
cuenta cuántas veces sale `VozSolicitada` y si el chat se abrió. Después mide y coloca la pieza y
mira dónde quedó el icono: en el mismo sitio que antes, con un blanco de 32 que no sale recortado.

Lo que no se puede pulsar sin la app entera —que `FaceWindow` cuelgue esa señal de
`StartMicByFace` y no de otro camino— se juzga leyendo la fuente, como el resto del cableado.

## Fases

| Fase | Pone verde | Toca |
|---|---|---|
| 1 | 540 | `PanelDeAcciones.cs` (el botón, la señal, el gancho), `FaceWindow.xaml.cs` (una suscripción) |
| 2 | 541 | `PanelDeAcciones.cs` (`PintarIcono` al nacer y en `Olvidar`, que es lo que hace `Limpiar` al acabar de irse) |

## Lo que NO entra

- **Que la onda diga si la voz está encendida.** Hoy el notch se retira al colgar, así que con la
  voz apagada solo se ve si se le llama desde el borde, y ahí la onda sale igual que encendida.
  Es una decisión de dibujo del dueño, no de esta rama.
- **Que pulsar el notch no le quite el teclado a la app de debajo.** Medido: tras el clic en la
  onda, la ventana de delante pasa de la app en uso a «Ü Acciones». Al botón de mensajes le conviene
  —va a escribirse en él—; a un interruptor de voz no. La carita tampoco lleva `WS_EX_NOACTIVATE`
  (su estilo en el log es `0x80088`), aunque con ella no se midió el clic. Arreglarlo es otra
  promesa (`WM_MOUSEACTIVATE`) y otra rama.
- Cambiar qué icono sale en cada estado (promesa 253): el botón envuelve al que toque.

## Lo que se encontró al implementarla

- **El primer criterio de «no lo recorta» era falso.** Exigía que WPF no le pusiera ningún recorte
  al botón, y salió rojo sin que faltara un píxel: en esta pantalla, al 125 %, la columna de 26 se
  redondea a 25,6 y WPF le pone un recorte de 32 × 39,2 que lo contiene entero. Ahora se mide lo que
  queda a la vista. Con el margen quitado a propósito, quedan 25,6 de 32 y sale rojo.
- **`InputHitTest` no sirve sobre una pieza que nunca se enseñó**: contesta «nada» en todas partes,
  también en el centro del botón. La promesa mira por geometría (`VisualTreeHelper.HitTest`) y lleva
  al botón de mensajes de testigo: si la sonda no lo encuentra a él, dice «no pude juzgar» y no
  «promesa rota».
- **El clic deja rastro**: `notch: onda pulsada: se pide alternar la voz`. El clic en la carita no
  escribe ninguna línea propia, y una voz que se abre sola se investiga preguntando quién la abrió.

## Evidencia (2026-09-30)

**Contrato:** cada promesa roja antes de su código (`⧗ PENDIENTE: «PanelDeAcciones.VozSolicitada
(la señal del botón de la onda)» todavía no existe`, con 365 en verde; después `⧗ PENDIENTE:
«PanelDeAcciones.Olvidar (volver a la onda al retirarse)»`, con 366), e INTACTO al final: 367 en
verde, 0 rotas. Corrido en Release, en esta máquina (1920 × 1080 al 125 %).

**Sabotaje, comprobado que se aplicó** (la línea saboteada se buscó en el archivo antes de cada
corrida, y los archivos se restauraron de una copia, no con `git checkout`):

| Qué se rompió | Con qué salió rojo |
|---|---|
| el margen que le da los 32 al blanco | «de 32×32 quedan a la vista 25,6×32», «borde derecho: False», «el icono… está en x=3,2» |
| la onda abre el chat en vez de pedir la voz | «pulsar la onda pide alternar la voz una vez (salió 0)», «y no abre el chat» |
| la carita no cuelga la señal de `StartMicByFace` | «[cableado] la carita no cuelga la onda del notch del mismo StartMicByFace…» |
| el notch sin `ToquesDeU.Proteger` | «[cableado] el notch abre la voz con un clic y no tiene su propio gancho…» |
| el constructor sin `PintarIcono` (así está `main`) | «recién nacido enseña la onda, no un hueco (lo pintado es (nada))» |
| `Olvidar` sin `PintarIcono` (así está `main`) | «no se queda con el visto del último paso (lo pintado es M4.5,12.6L9.8,17.6 19.5,6.8)», «vuelve a la onda QUIETA (… girando: True)» |

Sitios que tenían la clase de error «ventana cuyo clic toca la voz sin gancho propio»: 3 ventanas
ya lo llevaban (carita, muelle, consulta); el notch era la cuarta y entra con él puesto.

**Sobre el PC real** (una Ü de pruebas aparte en `C:\U-versiones\onda`, con datos propios; el
cursor movido con `SetCursorPos`, los clics con `mouse_event`, y antes de cada clic se comprobó
con `WindowFromPoint` que debajo estaba el notch de esa Ü; 1 pantalla, 1920 × 1080 al 125 %; se
esperó a que el PC llevara 25 s sin tocarse):

```
22:07:20.096  notch asomado a los 715 ms con el cursor quieto en el borde de arriba
22:07:20.897  UIA: onda en x=765 y=30, 40x40 px (ControlType.Button); mensajes 40x40 px en x=1109
22:07:21.187  clic [de U, firmado, centro de la onda] en (785,50), firma 0x55DC01
[22:07:21] toque: toque de Ü sobre 0xC1B5C (msg 0x201): descartado, no es la persona
[22:07:21] toque: toque de Ü sobre 0xC1B5C (msg 0x202): descartado, no es la persona
22:07:22.867  clic [de la persona, borde izquierdo de la onda] en (767,50), firma 0x0
[22:07:22] notch: onda pulsada: se pide alternar la voz
[22:07:23] voz-viva: socket conectado, esperando confirmación de «gpt-live-1» (OpenAI GPT-Live)
[22:07:24] voz-viva: micrófono abierto a 24000 Hz
[22:07:24] voz-viva: sesión abierta con «gpt-live-1» (OpenAI GPT-Live): el servidor la confirmó
22:07:23.286  ventana de delante: antes 'Claude', tras el clic 'Ü Acciones'
22:07:25.689  clic [de la persona, centro de la onda] en (785,50), firma 0x0
[22:07:25] notch: onda pulsada: se pide alternar la voz
[22:07:25] voz-viva: micrófono cerrado
[22:07:25] voz-viva: sesión cerrada
```

| Gesto | Resultado medido |
|---|---|
| clic con la firma de Ü en la onda | descartado; ni «onda pulsada» ni voz |
| clic de persona en el borde izquierdo del blanco (2 px dentro, fuera del dibujo) | abre la voz: el servidor confirma la sesión a los ~2 s |
| segundo clic de persona, en el centro | la cuelga en el mismo segundo |
| notch recién arrancado, antes de la 541 | sin dibujo a la izquierda (foto de las 22:07) |
| notch recién arrancado, con la 541 | la onda está (foto de las 22:17, build final) |

**Lo que esa prueba costó y no estaba previsto:** se abrió una sesión de voz DE VERDAD durante
unos 2 s (22:07:23–22:07:25). La Ü de pruebas se arrancó sin `OPENAI_API_KEY` en su entorno, que
era la forma de que un clic no pudiera abrir la voz de pago, y la abrió igual:
`ClavesDelBackend.DelEntornoDeSiempre` lee también la variable de USUARIO del registro. La segunda
pasada (22:17, sobre el build final) fue solo asomar y fotografiar, sin clics, por eso.

**Lo que NO se midió sobre el PC:** el clic con el build final (el de las 22:07 es anterior a la
541, que no toca el camino del clic); la onda con otro icono puesto —aro, visto, admiración—; una
segunda pantalla u otra escala; y el clic con una app a pantalla completa debajo. Una pantalla es
un dato incompleto.
