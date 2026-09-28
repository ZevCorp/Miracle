# Plan de implementación: la carita visita lo que Ü toca, y no le roba un clic

Estado: **en curso** · Nace de la limpieza del 2026-09-28 (spec 054, fases 6-7) · Rama: `jose/u-pulsar-en-main`

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

## Promesas retiradas

| # | Retirada el | Por qué | La sustituyen |
|---|---|---|---|
| 492 | 2026-09-28 | «la carita no se pone donde Ü va a hacer clic: ni sigue al cursor automatizado ni viaja al clic». Era una prohibición, no la propiedad que se quería: el dueño quiere que la carita vaya a cada elemento. Y su guarda de texto nunca cubrió el vuelo de `Senalador` antes de los clics con coreografía, así que salía verde sin probar lo que prometía (aprendizaje nº18). Lo que protegía —que Ü no pulse sobre la carita— lo cumplen ahora 505, 506, 508 y 510; lo de no seguir al cursor sigue dentro de la 504 | 504-508, 510 |

## Hallazgos

## Cierre

- [ ] 504-508 y 510 verdes; 492 retirada con su fila
- [ ] Sabotaje de cada una, comprobado
- [ ] `.\scripts\verificar.ps1` y contrato de u/ en verde
- [ ] Nivel 4 en Calculadora y Configuración, con el log pegado
