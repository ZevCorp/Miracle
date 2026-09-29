# Plan de implementación: la carita visita lo que Ü toca, y no le roba un clic

Estado: **implementado; nivel 4 hecho en Calculadora y Configuración** (falta una sesión de voz del dueño) · Nace de la limpieza del 2026-09-28 (spec 054, fases 6-7) · Rama: `jose/u-pulsar-en-main`

> **Excepción a «una spec = una rama», dicha a propósito.** Esta rama ya lleva las specs 053 y 054, y el dueño la usa
> como su «main» de trabajo: no se integra a `main` todavía. La carita va aquí porque sin ella la 054 quita algo que el
> dueño quiere y no lo devuelve. Cuando esta rama vaya a `main`, el PR tiene que contar las tres specs por separado.

## Qué se quiere

El dueño, el 2026-09-28: que la carita se mueva hasta cada elemento que Ü toca, porque se ve dónde actúa. Y que eso no
cueste velocidad ni vuelva a pasar lo del 2026-09-27: la carita se posaba ~80 px encima del clic y el clic siguiente de
Ü —la tecla de arriba en la Calculadora— caía en ella, que abre la voz de pago. Cinco sesiones en un día. Por eso la
492 la dejó quieta; esta spec la trae de vuelta con guardas que se pueden juzgar.

## Diagnóstico: qué se midió

| Qué | Medida | Fuente |
|---|---|---|
| Clics de Ü que abrieron la voz de pago por caer en la carita | 5 en un día de pruebas | log del 2026-09-27, `viaje al clic` seguido de `voz-viva: socket conectado` |
| Sitios que producen clics sintéticos con impacto de ratón | 6 de botón (`Raton`, `InputExecutor`, 4 × `mouse_event` en `UiaSurface`) + 3 de rueda; **ninguno** firma `dwExtraInfo` | mapa del 2026-09-28 (5 lectores) |
| Ventanas de Ü cuyos clics tienen consecuencias | carita (abre o cuelga la voz), globo de la línea, muelle, notch, tarjetas de recuerdo, consulta, carrusel | ídem |
| ¿`WindowFromPoint` respeta el alfa por píxel y `WS_EX_TRANSPARENT` en una ventana como la carita? | sí: la esquina transparente no es ella; con 0x20, el centro opaco tampoco | sonda 0, P1 (10:42:48) |
| ¿El bit 0x20 sobrevive a lo que WPF hace? | sí, a 8 operaciones: Topmost, mover, tamaño, opacidad, Hide/Show, Visibility, contenido, Activate | sonda 0, P2 |
| ¿Un clic REAL atraviesa la fantasma? | sí: con 0x20 cae en la ventana de abajo (carita 0, abajo 1); sin él, en la carita (1, 0) | sonda 0, P4 (10:44:05) |
| ¿Un gancho ve la firma antes que WPF? | sí: el gancho de `HwndSource` y el filtro de hilo (`ThreadFilterMessage`) leen `0x55C11C00` y, marcándolo manejado, WPF ve 0 | sonda 0, P3 y P6 |
| ¿Tirar un clic firmado evita que la ventana se active? | **no**: WPF no lo ve, pero la ventana se activa igual, y en `WM_MOUSEACTIVATE` la firma no se ve (extra = 0) | sonda 0, P6 (10:58:38) |

La última fila decide el diseño: la firma evita la voz, pero no el robo del foco ni el clic perdido. Hace falta además
**no pulsar sobre una ventana de Ü** (510), y que la carita **no se deje tocar mientras está fuera** (505).

## La especificación

| # | Promesa | Fase |
|---|---|---|
| 504 | la carita va a lo que Ü pulsó DESPUÉS de pulsarlo, con la caja del elemento, y el ciclo no la espera: el aviso sale tras el clic, se atiende en el hilo de la interfaz, y el ciclo contesta lo mismo aunque el aviso reviente; y no sigue al cursor automatizado | 4 |
| 505 | fuera de casa la carita no se deja tocar: desde que Ü la saca de casa hasta que se posa otra vez en casa es transparente al ratón, y todo lo que la mueve por iniciativa de Ü pasa por la misma visita | 2, 3 |
| 506 | la carita se posa junto a lo que Ü tocó y nunca encima: al primer lado que quepa —derecha, izquierda, abajo, arriba— sin cortar la caja del elemento, con la curva sin rebote; si no cabe en ningún lado, no viaja | 2 |
| 507 | la carita vuelve sola a su sitio —el que eligió la persona— tras un rato sin visitas, y solo al posarse ahí vuelve a dejarse tocar; un vuelo cortado no cuenta como llegada | 2, 3 |
| 508 | un clic que manda Ü lleva su firma, y ninguna ventana de Ü lo toma por un toque de la persona: el filtro del hilo de la interfaz lo tira antes que WPF, y el log lo dice | 1 |
| 510 | un clic de Ü no cae sobre una ventana de Ü: antes de pulsar se mira qué hay bajo el punto; si es la carita, se aparta —fantasma— y se pulsa; si es otra ventana de Ü, no se pulsa y se dice cuál | 4 |
| 511 | el puerto del MCP se puede cambiar con U_MCP_PUERTO, para que una Ü de pruebas no le quite el 8790 a la Ü del dueño; sin la variable, o con un puerto que no vale, es el 8790 | 5 |

La 509 ya existe (spec 054). Los números 504-508 y 510 no los usa ninguna rama.

**La que cierra el asunto es la 505.** Mientras no exista, la 506 no basta: posarse al lado de A deja a la carita
encima de B, que es justo el botón vecino del teclado de la Calculadora. La 508 y la 510 son las redes de debajo.

### Con qué se juzga cada una

- **Reglas puras**, en el estilo de `ReglaDelMuelle` y `ReglaDelHalo`: `ReglaDeLaVisita.Junto` (506), `EstanciaDeLaCarita`
  con reloj y vuelo de mentira (505, 507), `ToquesDeU.Descartar` (508).
- **El ciclo de mentira** (`CicloCon`) para 504 y 510: orden de clic y aviso, la caja, el mismo resultado con un aviso
  que revienta, y no pulsar cuando el punto no está libre.
- **`[cableado]`** —lectura de fuentes con `U_REPO`— solo para lo que ninguna prueba puede construir: que la cara se
  suscribe al pulso con `BeginInvoke`, que `Senalador` pasa por `Visitar`, que el filtro se instala. Etiquetadas, para
  que se cuenten (docs/codigo-limpio-y-fiable.md, práctica 7).
- **Nivel 4**, en el PC real: 20+ clics seguidos en la Calculadora y en Configuración, con 0 sesiones de voz abiertas
  por clics de Ü y la carita volviendo a casa.

## Las fases

### Fase 1 — la firma (508)

| | |
|---|---|
| **Qué toca** | `u/Nucleo/Raton.cs` (Firma, EsDeU, EntradasDelClic), `windows-graph/src/Surfaces/UiaSurface.cs` (10 `mouse_event`), `windows-client/src/Actions/InputExecutor.cs` (3 `MOUSEINPUT`), `windows-client/src/Ui/ToquesDeU.cs` (nuevo), `App.xaml.cs` |
| **Sitios con esta clase de error** | 6 de botón + 3 de rueda (contados con grep) |
| **Terminado** | 508 verde; contrato de u/ intacto (433 sigue comparando `Gesto` con tres pasos) |

### Fase 2 — las reglas puras (505, 506, 507)

| | |
|---|---|
| **Qué toca** | `windows-client/src/Ui/ReglaDeLaVisita.cs`, `windows-client/src/Ui/EstanciaDeLaCarita.cs` (nuevos) |
| **Terminado** | 506 verde; 505 y 507 verdes en su parte pura |

### Fase 3 — la cara las usa (505, 507)

| | |
|---|---|
| **Qué toca** | `FaceWindow.xaml.cs`: `Visitar` en lugar de `IrJuntoA`, el fantasma en `OnSourceInitialized`, el latido de la vuelta (un `DispatcherTimer` que solo mueve su ventana: promesa 489), la casa en `ColocarVentana` y `OnWindowMoved`; `Vuelo.cs`: aterrizar no es cancelar |
| **Terminado** | 505 y 507 verdes enteras |

### Fase 4 — el ciclo avisa y mira antes de pulsar (504, 510)

| | |
|---|---|
| **Qué toca** | `CicloRapido.cs` (`TrasPulsar`, `LibrarElPunto`, propiedades y no parámetros del constructor: la usan 485-499 con 5 argumentos), `FaceWindow.xaml.cs` (el ciclo avisa por el pulso, la cara se suscribe una vez) |
| **Terminado** | 504 y 510 verdes; 485-499 y 509 intactas |

### Fase 5 — dos Ü en el mismo PC (511)

| | |
|---|---|
| **Qué toca** | `windows-client/src/Mcp/ServidorMcp.cs` (`Puerto` sale de `U_MCP_PUERTO`), `FaceWindow.xaml.cs` (un 8790 escrito a mano) |
| **Por qué entra aquí** | el nivel 4 de esta spec no se podía correr sin cerrar la Ü del dueño: las dos querían el 8790 |
| **Terminado** | 511 verde |

### Lo que cambió al atacar el plan (dos críticas, workflow del 2026-09-28)

El plan lo atacaron dos agentes, uno buscando cómo la carita podría seguir robando un clic y otro buscando pruebas
que salieran verdes sin probar nada. Se aceptaron sus objeciones con evidencia, y cada una entró primero como prueba
en rojo:

- **La mirada bajo el punto estaba en 1 de las 6 manos que pulsan.** La coreografía de lección enseña la tarjeta hasta
  4 s antes de pulsar, y la carita volvía a casa tocable justo antes del clic. Ahora la regla es una
  (`UiaSurface.LibrarElPunto`) y la consultan las seis. Si el punto cae en la carita, aunque ya sea fantasma, se aparta
  y su rato fuera empieza otra vez.
- **La persona con el ratón manda.** Si pulsa o arrastra la carita, la captura se lleva cualquier clic de Ü. Mientras
  el botón esté abajo o una ventana de Ü tenga la captura, Ü no pulsa.
- **Apartar la carita esperaba a la interfaz sin techo.** Ahora son 100 ms a la prioridad más alta, y se mide
  (`⏱ librar el punto`).
- **Pruebas que no miraban la propiedad:**
  - un fantasma invertido pasaba: ahora el bit se juzga en una ventana de verdad;
  - un aviso vacío pasaba: ahora el aviso tiene nombre (`AvisarALaCarita`) y se comprueba que llega;
  - un `dwExtraInfo = IntPtr.Zero` pasaba: ahora se exige la firma;
  - un filtro que nunca tiraba pasaba: ahora el filtro instalado se prueba con un mensaje.
- **Un fallo de la visita abría el diálogo de «Ü tropezó» encima de lo que Ü pulsaba.** Ahora la visita entera va en
  `try`. `AvisarDelPulso` se tragaba el fallo; ahora lo devuelve.
- **Un recorrido que se quedaba en una parada volaba con el muelle que rebota.** Ahora va como una visita.
- **Un bucle modal se salta el filtro de hilo.** La carita, el muelle y la consulta tienen además su propio gancho.

## Sabotajes: 15, todos rojos

Uno o más por promesa y por archivo que la sostiene, aplicados después del commit y comprobados:
- 504 ×3: el aviso antes del clic, el catch mudo y la cara esperando a la carita;
- 505 ×2: el bit invertido, que salió `0x80120` en la ventana de verdad, y salir sin fantasma;
- 506 ×1: vuelve la sujeción que la dejaba encima;
- 507 ×2: tocable en cualquier sitio, y volver sin esperar;
- 508 ×3: el clic sin firma, el filtro que tira también el de la persona, y un `mouse_event` sin firma;
- 510 ×3: el ciclo no mira, la carita no se aparta, y la persona con el ratón no manda;
- 511 ×1: se ignora la variable.

Ninguno quedó sin aplicar ni sin veredicto: el guion prueba con CRLF si el patrón no casa con LF.

## Nivel 4: el PC real (2026-09-28, 13:36-13:46)

Una Ü de la rama en el 8795 (promesa 511), con datos propios y **sin clave de voz**, junto a la Ü estable del dueño
abierta. Los 28 clics por `map_take` llevaban `decir`, `recuerdo` y un argumento inventado, como la voz real. Fueron 19
en teclas apiladas de la Calculadora (el incidente del 2026-09-27) y 9 en Configuración. El guion es
`nivel4-carita.ps1`: solo corre con el PC quieto y vigila también el log de la Ü del dueño.

| Qué | Medido |
|---|---|
| clics por el ciclo rápido | 28 de 28 (`⏱ ciclo` en cada uno) |
| clics dados con visita | todos; los 2 sin visita de una corrida fueron clics no dados («no está», la página aún cargaba) |
| fantasma al salir | `carita fantasma … exstyle=0x80028` (en capas, encima y 0x20), releído de la ventana |
| vuelta a casa tocable | 2 de 2 tandas: `carita en casa … exstyle=0x80008` a los 3,5 s |
| hubo que apartar la carita | 1 vez, 15 ms (`⏱ librar el punto`) |
| toques de Ü descartados / clics tapados | 0 / 0 |
| sesiones de voz, en la rama y en la Ü del dueño | 0 y 0 |

### Lo que cuesta la carita: A/B en las mismas condiciones

El mismo guion contra la rama justo antes de la carita (`6cb5fce` + el puerto de la 511), alternando, con la Ü del
dueño abierta en todas las corridas:

| mediana del ciclo | sin carita | con carita |
|---|---|---|
| Calculadora | 140 · 140 ms | 171 · 157 · 156 ms |
| Configuración | 578 · 907 ms | 750 · 734 · 906 ms |

En la Calculadora la carita cuesta **~16 ms**, un paso del reloj del sistema (15,6 ms), y lo cuesta en «volver a ver»:
sin ella 94 ms, con ella 125. El clic no cambia. El vuelo arranca justo tras el clic y compite con la lectura de la
app. En Configuración la diferencia se pierde en el ruido de la propia página (±300 ms entre corridas iguales).

Si esos 16 ms importan, la salida es avisar a la carita después de «volver a ver» y no antes. Llegaría ~100 ms más
tarde y la 504 cambiaría de enunciado: lo decide el dueño.

## Lo que NO entra

- **El carrusel** (`EncimaDe`/`VolverASuSitio`) se queda fuera de `Visitar`: es un gesto de la persona, no de Ü. Solo
  cambia que recuerda la casa y no el sitio de una visita.
- **La activación por un clic firmado sobre una ventana de Ü en casa.** La 510 la evita en el ciclo rápido, que es el
  camino de la voz. Los otros cinco productores quedan con la firma (sin voz, sin acción), pero pueden robar el foco
  si caen sobre una ventana de Ü. Arreglarlo del todo pide `WS_EX_NOACTIVATE` en la carita, el muelle y el notch, que
  cambia cómo se escribe en ellos: otra spec.
- **El teclado.** El doble Ctrl que abre la voz no mira si la tecla es inyectada. Ü no manda Ctrl sueltos, pero no hay
  guarda: otra spec.
- **SAP.** Sus clics son COM, no ratón: no se pueden robar, y tampoco avisan a la carita. SAP no tendrá visita hasta
  que su superficie dé una caja.
- **Lo que cuesta el pulso en la escalera.** Con la cara escuchando el pulso, cada clic lento pregunta otra vez a UIA
  por la caja del elemento (una llamada entre procesos), aunque ya la tenía. Está fuera del ciclo rápido. Arreglarlo es
  pasar la caja pulsada en vez de volver a preguntarla: otra spec, midiendo el `⏱ TIEMPOS` de la escalera antes y
  después.

## Promesas retiradas

| # | Retirada el | Por qué | La sustituyen |
|---|---|---|---|
| 492 | 2026-09-28 | «la carita no se pone donde Ü va a hacer clic: ni sigue al cursor automatizado ni viaja al clic». Era una prohibición, no la propiedad que se quería: el dueño quiere que la carita vaya a cada elemento. Y su guarda de texto nunca cubrió el vuelo de `Senalador` antes de los clics con coreografía, así que salía verde sin probar lo que prometía (aprendizaje nº18). Lo que protegía —que Ü no pulse sobre la carita— lo cumplen ahora 505, 506, 508 y 510; lo de no seguir al cursor sigue dentro de la 504 | 504-508, 510 |

## Hallazgos

1. **La firma sola no basta.** La sonda 0 midió que tirar un clic firmado no evita que la ventana se active. Sin eso, la
   508 se habría dado por la guarda completa. De ahí la 510.
2. **Un plan revisado por dos críticos con evidencia encontró 17 objeciones.** 4 eran altas, y dos de ellas habrían
   dejado la carita robando clics en la coreografía de lección y con la persona pulsándola. Ninguna prueba escrita hasta
   entonces las habría visto: todas salían verdes.
3. **En esta consola, un `<<'EOF'` se come una de cada dos barras invertidas.** Un patrón `\r?\n` escrito así acabó
   como un retorno de carro real y partió una línea del contrato (commit `1007d1b`). Los scripts con barras invertidas
   se escriben a archivo, no por heredoc.
4. **La firma de la sonda (`0x55C11C00`) no es la de producción (`0x0055DC01`).** El mecanismo no depende del valor:
   lo que se probó es que el gancho lee lo que se mande. En el nivel 4 no hizo falta: ningún clic de Ü cayó en una
   ventana de Ü, porque el fantasma y la 510 lo evitaron antes.
5. **La Ü estable del dueño encarece las lecturas de cualquier otra.** Es un build anterior a la 054 y todavía lee la
   ventana de delante cada 250 ms (≈136 ms por lectura). Con ella abierta, la Configuración de la rama iba a ~750 ms por
   ciclo contra los 229 de la spec 054. Por eso el A/B se hizo con ella abierta en las dos versiones.
6. **Con 2 s de quietud, en una app lenta la carita vuelve a casa entre clic y clic.** En Configuración cada ciclo tarda
   casi un segundo y la carita hace elemento → casa → elemento. `QuietudMs` es una propuesta, no una medida: se ajusta
   con el dueño.
7. **Una carpeta de datos nueva se para en la ventana que pide el correo.** La Ü de pruebas quedó viva, sin MCP y sin una
   línea de log. Hay que sembrar la configuración, con una identidad de prueba y el servidor apuntando a un puerto
   muerto. `ci-terreno.ps1` arranca igual y tendrá el mismo problema: queda anotado para su dueño.

## Cierre

- [x] 504-508, 510 y 511 verdes; 492 retirada con su fila
- [x] Sabotaje de cada una, comprobado (15 de 15 rojos)
- [ ] `.\scripts\verificar.ps1` y contrato de u/ en verde
- [x] Nivel 4 en Calculadora y Configuración (arriba), con 0 sesiones de voz
- [ ] Una sesión de voz del dueño con la carita visitando
