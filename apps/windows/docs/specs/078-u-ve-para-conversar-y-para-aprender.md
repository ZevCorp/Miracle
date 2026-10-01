# Plan de implementación: Ü ve — para contestar sin pedir permiso para mirar, y para aprender de lo que ve

Estado: **implementado** (2026-10-01) · Nace de la petición del dueño del 2026-10-01 · Rama: `jose/la-voz-conversa-y-aprende`
· Termina lo que la 073 y la 074 dejaron propuesto y sin hacer

> «Habías propuesto todo un set de mejoras para la interacción entre la voz y el modelo […] también para que
> pueda ver la pantalla. Y creo que no implementaste todas estas cosas. […] quiero que tengamos lo mejor de
> lo mejor, así que deberías implementar todas las mejoras que ya encontraste. Incluso creo que la capacidad
> de poder ver es clave para la generación de skills, además, y preferencias.» — el dueño, 2026-10-01.

## Qué se propuso, y qué quedó sin hacer

| Lo propuesto (2026-10-01, antes de la 073) | Quedó |
|---|---|
| Delegado `gpt-6-luna`; avances en vivo; los dos prompts; presupuesto del historial | hecho (073) |
| La voz sabe que ve por su equipo; señalar manda su foto | hecho (073) |
| **Foto automática al delegar**, si la pantalla cambió | sin hacer: dependía de una sonda que no se corrió |
| **Conciencia continua**: a la voz le llega dónde está la persona | sin hacer |
| **Reintentar el borrado** de las copias que quedan en OpenAI | sin hacer |
| **Borrar lo que no sirvió de la vista**: la imagen incrustada y el álbum automático | sin hacer («va en su rama») |
| Retirar **las dos** capturas por palabras clave | una: quedó `GuardarPeticionPersonalSiLaPidio` |
| **La vista al servicio de las habilidades** (pedido de hoy) | no existía: el repaso y «mira cómo lo hago» solo leían nombres |

## El encargo, como se mide su final

**Objetivo.** Que quien actúa vea la pantalla del momento en que la persona pide algo, sin gastar una vuelta
en pedir la foto; que lo que la persona muestra y lo que a Ü no le sale quede VISTO, y no solo nombrado, tanto
para quien actúa como para el repaso; y que no quede en el código ni en OpenAI lo que no sirvió.

| | Antes (medido) | Meta |
|---|---|---|
| Vueltas del delegado para contestar algo que está a la vista («pulsa el botón verde») | 2, con la foto pedida y subida en medio | 1 |
| Pedidos del dueño que empiezan mirando o piden una foto | 24 % y 31 % de 96 (logs del 5 al 30 de septiembre) | esos no gastan la vuelta |
| Lo que frena cada foto que se queda en la conversación | ~30 ms por foto y por vuelta | tope de fotos por conexión; solo si la pantalla cambió |
| «Mira cómo lo hago» sobre algo sin nombre para UIA (SAP, un lienzo) | una lista de clics sin etiqueta | la foto de cada clic, con el cursor donde pulsó |
| Lo que ve el repaso | texto | texto y las fotos de lo tocado y de lo que falló |
| Copias de fotos que se quedan en OpenAI al fallar el borrado o caerse la app | 7 en trece días; sin reintento | 0: toda copia queda apuntada hasta que se borra |
| El álbum automático | 3.238 capturas, 592 MB, 0 consultas | no existe |

## Diagnóstico: lo que contestó el servidor (sonda `sondas/DeLaVoz`, 2026-10-01)

| Pregunta | Respuesta medida |
|---|---|
| ¿Una foto metida en la conversación ANTES de que la persona hable le llega al delegado? | **Sí.** «¿Qué código de factura aparece en mi pantalla?»: contestó «7421», que solo estaba en la foto. Sin foto: «no aparece ningún código». |
| ¿Y se ahorra la vuelta? | **Sí, si sus instrucciones lo dicen.** Sin decírselo llamó igual a `map_what_i_see` (2 vueltas). Diciéndoselo: 1 vuelta, 1,1 s. «Pulsa el botón verde de abajo» → `pulsa: Radicar` en 0,86 s, leído de la foto. |
| ¿La foto con un texto al lado confunde a la voz? | **No.** 5 s callada tras recibirla; a «hola, ¿cómo estás?» contestó sin delegar. |
| ¿Se le puede contar a la voz dónde está la persona sin que lo diga? | **No por `thinking.append`**: lo dijo sola a los 0,8 s («Ya estás en el Bloc de notas…»), 2 de 2. **Por `instructions.append` calla**, pero entonces no le llega al delegado, y la voz delega igual todo lo que es de la pantalla. |
| ¿Las preferencias al abrir (`instructions.append`, promesa 716) hacen hablar sola a la voz? | **No**: 6 s callada. |
| ¿Cuánto frena llevar fotos acumuladas? | Por vuelta del delegado: 1 foto, 0,9–1,6 s; 8, 1,2–1,4 s; 20, 2,1–2,2 s; 40, 2,3–2,8 s. Unos 30 ms por foto. Cuarenta fotos se aceptaron sin error. |
| ¿Se puede quitar una foto vieja de la conversación? | No hay con qué: crear un ítem no devuelve su identificador. |

**La lectura.** La conciencia de la pantalla que sirve es la del **delegado**, y se la da la foto. Contarle a la
voz dónde está la persona no se hace: por el único canal que llega al delegado la voz lo dice en alto, y eso es
exactamente el parloteo que no queremos. Queda medido y descartado, no olvidado.

## El diseño, en siete frases

1. **Con cada pedido viaja la pantalla de ese momento.** Al empezar a hablar la persona (y al mandar algo
   escrito), Ü captura, sube y mete en la conversación la foto, con una línea que dice dónde está según el mapa
   y que eso no lo dijo ella. Solo si la pantalla cambió desde la última, con un respiro entre fotos y un tope
   por conexión. Se apaga con `U_FOTO_AL_PEDIR=0`.
2. **Las instrucciones del delegado lo dicen**: ya ves la pantalla al empezar; no gastes una vuelta en mirar.
3. **Lo que la persona muestra se ve.** Cada clic suyo, mientras hay sesión, deja la foto del instante de
   pulsar —con el cursor dibujado—, y `habilidad_lo_que_hice` se las manda a quien actúa.
4. **El diario lleva fotos**: de lo que la persona tocó y de lo que a Ü no le salió. Viven con el diario y se
   retiran con él.
5. **El repaso ve**: recibe esas fotos como imágenes, rotuladas con su línea. La cita sigue saliendo de lo que
   la persona DIJO: ver ayuda a nombrar bien, no sustituye a la compuerta.
6. **Toda copia subida a OpenAI queda apuntada en disco hasta que se borra**, y lo pendiente se reintenta al
   abrir la voz: un borrado que falla o una app que se cae ya no dejan fotos allí.
7. **Se va lo que no sirvió**: el álbum automático y `map_look_back`, la imagen incrustada de GPT-Live, y la
   segunda captura por palabras clave.

## La especificación

En el contrato del grafo:

| # | Promesa |
|---|---|
| 740 | la pantalla solo viaja con el pedido si cambió: dos capturas de la misma pantalla dan la misma huella aunque parpadee el cursor o corra el reloj, y otra ventana da otra; y no viaja si no ha pasado el respiro, si ya van las del tope, o si está apagada |
| 741 | al empezar a hablar la persona, y al escribir, Ü manda la pantalla de ese momento antes que el pedido; una conexión nueva empieza la cuenta de cero; y las instrucciones del delegado dicen que ya ve la pantalla al empezar, sin que las de la voz única cambien |
| 742 | lo que la persona muestra se ve: cada clic suyo lleva la foto del instante de pulsar, en su orden; se entregan una sola vez, a lo sumo las del tope, y sin sesión no se toma ninguna |
| 743 | el diario lleva las fotos de lo que la persona tocó y de lo que a Ü no le salió: las más recientes hasta el tope, numeradas en el texto; se guardan con el diario, se vuelven a leer iguales y se retiran con él |
| 744 | el repaso ve: lo que se le pide al modelo lleva cada foto del diario como imagen, rotulada con su línea; sin fotos la petición es la de siempre; y se le puede quitar la vista sin quitarle el repaso |
| 745 | toda copia subida a OpenAI queda apuntada en disco hasta que se borra: un borrado que falla la deja pendiente, un reintento que sale bien la quita, y otra sesión —o la app después de caerse— encuentra lo pendiente |
| 746 | el álbum automático ya no existe: nada captura la pantalla al cambiar de sitio, map_look_back no está en el catálogo y la Memoria no tiene el apartado «pantalla» |
| 747 | lo que la persona dice no se guarda crudo por una lista de palabras: cerrar un turno no escribe en la memoria personal |
| 748 | quien actúa sabe qué día es: las instrucciones con que abre dicen el día de la semana, la fecha y la hora locales |
| 749 | lo que devuelve el delegado no se cuenta dos veces: con el micrófono abierto lo dice la voz, y solo eso queda como dicho por Ü; en una sesión escrita, que no tiene voz, es la respuesta |

En el contrato de la voz:

| # | Promesa |
|---|---|
| 69 | la pantalla del momento del pedido viaja en un solo mensaje: delante el texto que dice que es la pantalla, que no lo dijo la persona y dónde está, y detrás la foto por referencia con detalle alto; sin identificador no se manda nada, y un protocolo que no ve por referencia no manda nada |
| 70 | lo que devuelve el delegado se distingue de lo que dice la voz: response.output_text.done llega marcado como del delegado, y la transcripción de la voz no |

### Promesas que se retiran (los números no se reciclan)

| # | Decía | Por qué se retira |
|---|---|---|
| 255 | el álbum de miradas vive en local con su ficha […] y se poda: siete días o dos gigas | el álbum se va: 3.238 capturas, 592 MB y ninguna consulta en trece días |
| 257 | se guarda una mirada por CAMBIO de ubicación y no por reloj | es la captura automática del álbum |
| 258 | el modelo puede pedir lo que vio antes (`map_look_back`) | la puerta del álbum: 0 llamadas |

### Promesas que cambian su comprobación

- **622** («la Memoria cuenta TODO lo que Ü guarda de ti»): de trece apartados a doce; sale «pantalla».
  La **623** y la **626** dejan de sembrar y de vigilar `album.json`.
- **La de los eventos de GPT-Live** (contrato de la voz, `GptLiveMandaConSusEventos`): la foto incrustada deja
  de existir en GPT-Live —no cabía ninguna: 118.000 bytes en un buzón de 32.768—; la foto entra por
  referencia (54).

### Con qué se juzga cada una

- **740**: funciones puras sobre pantallas de mentira (una función de luminancia), sin pantalla.
- **741, 746, 747**: cableado leído de la fuente, el catálogo y las instrucciones compuestas.
- **742, 743, 745**: las clases sobre archivos temporales, con la captura y el borrado inyectados.
- **744**: el repaso con un modelo de mentira; lo que se juzga es la petición que sale.
- **748, 749**: funciones puras, y su cableado.
- Lo que hace **el servidor** con la foto lo mide la sonda; lo que hace **el modelo** con las fotos del diario,
  la batería de `sondas/DelRepaso`.

## Las fases

| Fase | Pone verde | Toca |
|---|---|---|
| 1 | 740, 741, y la 69 de la voz | nuevo `Voice/PantallaAlPedir.cs`; `CapturaDePantalla.cs`; `IProtocolo`, `ProtocoloGptLive`; `ConversacionEnVivo.cs` |
| 2 | 742 | `Voice/LoQueHiciste.cs`; `ConversacionEnVivo.cs` |
| 3 | 743, 744 | `Voice/DiarioDeLaSesion.cs`, `Voice/ElRepaso.cs`, `ConversacionEnVivo.cs` |
| 4 | 745 | nuevo `Voice/CopiasPorBorrar.cs`; `Voice/MiradaSubida.cs` |
| 5 | 746, 747 | se borran `Navigation/AlbumDeMiradas.cs` y `CuandoSeMira.cs`; `MapaVivo.cs`, `LoQueUSabe.cs`, `ConversacionEnVivo.cs`; `ProtocoloGptLive.Fotograma` |
| 6 | 748, 749, y la 70 de la voz | `ConversacionEnVivo.cs`, `Hecho.cs`, `ProtocoloGptLive.cs` |

## Lo que NO entra

- **Contarle a la voz dónde está la persona.** Medido y descartado (ver el diagnóstico).
- **Borrar las fotos del álbum que ya hay en disco** (`%LOCALAPPDATA%\U\recuerdos\miradas`). El código que
  las escribía se va; borrar los archivos de la persona es decisión suya. Dejan de crecer.
- **El Learn por demostración** (`Teach/`, el piloto, `map_skills`, el panel de aprendizajes). Comparte carpeta
  con los workflows de SAP, que son el producto; son unas setenta promesas. Va en su rama `chore/`.
- **El prototipo de Gemini en Graph** y **el prompt del repaso en Graph**: son de `services/graph`, que se
  despliega solo al mergear. Van en su PR.
- **Vídeo continuo**: `gpt-live-1` no acepta imagen ni vídeo.

## Hallazgos

1. **Con las instrucciones de verdad, la foto no bastaba.** La sonda contestó en una vuelta con unas
   instrucciones de veinte líneas. La Ü de pruebas, con las 28.583 letras reales, no: a «¿qué número se ve
   ahora mismo en la calculadora?» llamó a `map_where_am_i` y a `map_look` antes de decir «144» —3 vueltas,
   7,5 s (`vista-1.log`, 12:56:55)—. Más arriba, esas mismas instrucciones dicen que una foto nunca decide
   dónde se está y que eso solo lo dice `map_where_am_i`. Arreglo: el texto que acompaña a la foto da el sitio
   **con el nombre de esa herramienta** («map_where_am_i contesta ahora mismo «…»»), y el párrafo del delegado
   nombra las tres llamadas que sobran para empezar. Después: 1 vuelta, ~2 s, 2 corridas de 2
   (`vista-2.log` 13:01:37 → 13:01:39, `vista-3.log`). Lo que mide una sonda con un prompt corto no vale para el
   prompt largo: se mide con el de verdad.
2. **Dos comprobaciones que no podían fallar**, destapadas por el sabotaje y no por el verde:
   - 744, «rotulada justo delante»: el texto del diario también dice «[FOTO 1]» y «sin nombre», y es lo que
     queda delante de la imagen cuando el rótulo falta. Ahora exige que ese texto sea SOLO el rótulo.
   - 745, el cableado: `ArrancarAsync … ReintentarLasCopiasPendientes(` casaba con la **declaración** del
     método, más abajo en el archivo. Ahora exige la llamada: una línea que empieza por el nombre y acaba en `;`.
3. **El contrato capturó y subió una pantalla de verdad, una vez.** La 208 corre la conversación con un
   servidor de mentira; al mandar texto, el código nuevo capturó la pantalla real y la subió a OpenAI con la
   clave del entorno. Se borró en esa misma corrida (`copias-por-borrar.json` quedó en `[]`). Arreglo: sin
   quien suba la mirada inyectado, un contrato no manda la pantalla (`_puerta != null && _subeLaMirada == null`).
4. **Ver cambia lo que se aprende, medido.** El caso nuevo de la batería: la persona muestra cómo se radica una
   cuenta en una pantalla donde UIA no nombra nada. A ciegas (`--sin-fotos`) la habilidad sale como «pulsa el
   control situado en (342, 236)», 3 de 3; con las fotos, «Pulsa «Facturación» · «Radicar cuenta» ·
   «Urgencias Adultos» · «Guardar»», 3 de 3.
5. **Lo del delegado se contaba dos veces** en el diario y en el hilo cuando había micrófono: una como lo que
   devolvió y otra como lo que dijo la voz. De ahí la 749 y la 70 de la voz.
6. **`origin/main` tomó el número 078 y las promesas 700–743 mientras esto se escribía** (PR #157, «una sola
   Ü»). Esta spec y las 073 y 074 de la rama se renumeran al poner la rama al día; hasta entonces sus números
   son los de la rama.

### Lo medido al cerrar (2026-10-01)

| | Antes | Ahora |
|---|---|---|
| Contestar algo que está a la vista (Ü de pruebas, calculadora) | 3 vueltas, 7,5 s | 1 vuelta, ~2 s |
| La pantalla del pedido: capturar y subir | — | 511–1.390 ms, antes de que llegue el texto |
| Copias en OpenAI al colgar (3 corridas, 10 fotos) | sin reintento | 10 borradas, 0 apuntadas |
| «Mira cómo lo hago» donde nada tiene nombre | coordenadas | los nombres, leídos de las fotos |
| Batería del repaso (25 casos × 2, modelo de verdad) | 207/207 con 24 casos | 150/150; mediana 4,1 s |
| Sabotajes | — | 30, cada uno rojo; 2 no lo fueron a la primera (hallazgo 2) |

**Sin probar con el micrófono**: la foto que sube mientras la persona habla (el arnés escribe, y ahí se espera
a la foto antes de mandar el texto), y los clics de la persona con `habilidad_lo_que_hice` sobre SAP de verdad.

## Cierre

- [x] Todas las promesas verdes (los dos contratos): voz 56/56, grafo 410/410
- [x] Sabotaje comprobado, promesa por promesa (tandas A–E)
- [x] La sonda y la batería cumplen contra el servidor real
- [x] Probado en la Ü real, con el log: `scripts/nivel4-voz/por-ordenes/vista.py`, 8 de 8 dos veces, solo con la
      Calculadora — una pantalla, y dicho como tal
- [x] Estado de este documento: **implementado** (2026-10-01)
