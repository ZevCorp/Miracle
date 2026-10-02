# Plan: Ü en el Mac del médico — la misma ventana que en Windows, aprende hablando y viendo, ejecuta rápido, y el ✓ dispara lo aprendido

Para: el agente que va a desarrollar en el Mac. Escrito el 2026-10-02 desde Windows, leyendo el código de
`main` en `e77db96d`. Nada de esto se ha compilado en un Mac: lo que dice del Mac salió de leer `apps/mac/`.
Las imágenes de esta carpeta son la ventana de Windows dibujada por su propio código: son la referencia visual.

**Lo que pide el dueño:** que sea sólido. No hay que recortar para llegar antes: cada pieza se termina,
se prueba en la app instalada y se mide antes de pasar a la siguiente.

## 1. Qué hay que lograr

El médico usa un Mac. En Windows, Ü ya hace esto, medido el 2026-10-02 contra un sistema de pacientes de prueba:

| # | Capacidad | En Windows hoy |
|---|---|---|
| A | **La ventana de la consulta.** El médico entra con su cuenta de Miracle, pulsa **Escuchar**, habla con el paciente, pulsa **Parar**, y la nota queda organizada por secciones, guardada y visible en el portal. En la pestaña **Consultas**, las anteriores. | La ventana de las imágenes `1-…png` a `7-…png`. |
| B | **Aprende hablando.** Le explica por voz cómo se usa un sistema («te voy a enseñar a registrar un paciente…») y Ü guarda UNA habilidad con todos los pasos. Una sesión después, «registra a este paciente: …» la usa sola, con los datos nuevos. | La clase dio 9 de 9. Usar lo aprendido tarda 29–42 s. |
| C | **Ejecuta rápido.** Quien actúa manda un plan entero («pulsa: Pacientes», «escribe: …», «elige: EPS = Sura») y las manos lo hacen seguido, sin volver al modelo entre un paso y otro. | ~0,3 s por clic con el nombre exacto. |
| D | **El ✓ de cada sección es un gatillo.** La carita va junto a la sección, se pregunta «¿qué acción quiere que yo ejecute con esta información?» contrastándola con sus habilidades, propone UNA acción, y la ejecuta al pulsar **Aprobar**. «Ejecutar todo» hace lo mismo con todas las secciones y una acción en común. | 9 de 9: pensar 1,4–3,5 s; ejecutar 12–36 s. |
| E | **Lo que aprende se ve.** Al cerrar la voz, una tarjetita flotante carga mientras Ü repasa la sesión y despliega «Esto aprendí» con la lista. | Imágenes `8-…png` y `9-…png`. |
| F | **Learn: aprende también de lo que ve.** Un botón **Learn** enciende la estela de luz alrededor de la pantalla y graba la pantalla mientras está encendido. Esa grabación es contexto para generar la habilidad de esa sesión: los nombres exactos de botones y campos, el orden real de los clics, lo que se mostró sin decirlo. **Learn solo hace eso**: no es el Learn viejo de Windows (grabar una lección, compilarla y repasarla con el piloto). | Nuevo, pedido por el dueño el 2026-10-02. **No existe en ninguna plataforma**: el Mac es el primero (§7 F). |

**Terminado = la ventana se ve y se comporta como la de Windows, y las mediciones del §8 pasan en la app
INSTALADA en el Mac del médico.** No vale el ejecutable suelto: macOS da los permisos por bundle y firma.

## 2. Las reglas de este repo

- Lee `AGENTS.md` de la raíz y `apps/mac/AGENTS.md`. Trabaja desde `apps/mac`.
- **Tu árbol:** `bash tools/monorepo/arbol.sh nuevo <persona>/ue-en-el-mac-del-medico` desde la raíz.
- **Desde el Mac solo se toca `apps/mac/`** (y docs de la raíz). `apps/windows/` se lee como referencia; no se edita.
- **No se copia código de Windows: se copia el comportamiento y su porqué, y se reescribe en Swift.** Cada pieza
  de abajo dice qué archivo de Windows leer. Los comentarios de esos archivos explican por qué cada detalle es
  como es, con la fecha del fallo que lo causó: léelos, son la mitad del valor.
- **Nada se importa con `../` de otro proyecto.** Lo que necesites para pruebas (como `his.html`) se copia dentro
  de `apps/mac/`.
- **El método, sin atajos:** spec con promesas → promesa en ROJO → código → **romperlo a propósito** y ver la
  promesa roja → probar en la app instalada → `git push` (el portero) → PR con evidencia → squash merge.
  - La spec del Mac es `apps/mac/docs/specs/002-…md` y sus promesas empiezan en **201** (la spec NNN numera desde
    NNN×100+1).
  - El juez es `./contrato.sh`.
  - Si el trabajo es grande, pártelo en varias specs (002, 003…), una por capacidad, cada una con su PR.
- **Nada secreto en el repo** (es público). Las claves salen de Graph (`GET /api/v1/agent/claves` → `openai`,
  `typesafe`) y del Llavero. La clave publicable de Supabase y su URL sí son públicas: están en
  `apps/windows/windows-client/src/Cuenta/Nube.cs`.
- **Ni la nota ni lo que dice un paciente van al log.** Se anota cuánto texto era y qué se hizo.

## 3. Lo que el Mac ya tiene, y lo que falta

Leído en `apps/mac/Sources`.

| Pieza | En el Mac hoy | Falta |
|---|---|---|
| Voz GPT-Live con un delegado que tiene herramientas | `UMac/LiveVoice.swift`, `UCore/LiveProtocol.swift`. Delegado `gpt-5.6-luna`, sin `reasoning` ni `service_tier` | `gpt-6-luna` (§6). Que la voz delegue la enseñanza (§5) |
| Herramientas del delegado | `UCore/LiveTools.swift`: `map_esto_es`, `map_recuerdos`, `map_tramo`, `map_decidir`, `look`, `read_screen`, `click_element`, `set_value`, `key`, `scroll`, `launch_app`, `open_url`, `list_apps`, `stop_task` | `habilidad_*`, `preferencia_guardar`, **`map_hacer`** |
| Manos por accesibilidad | `UMac/Accessibility.swift`, `UMac/InputDriver.swift`, `UMac/Desktop.swift` (`map_pointing_at` ya existe) | El ejecutor de planes y «elige:» |
| Jev | `UCore/JevClient.swift`, plazo 2 s | Tope de 255 opciones; un reintento si agota el plazo |
| Cuenta de Miracle del médico (Supabase) | **no existe** | Todo (§4.1) |
| Ventana de la consulta, dictado, nota, portal | **no existe** (`migration/STATUS.md`: `clinical.consultation` y `clinical.note` = missing) | Todo (§4) |
| Habilidades, repaso, tarjetita | **no existen** | §5 y §7 |
| Grabar la pantalla | `UMac/ScreenCapture.swift` hace capturas sueltas (para `look`) | Grabación continua mientras Learn está encendido, y la estela (§7 F) |
| Probar lo hablado sin micrófono | `UApp/SmokeTest.swift` (`spokenVoice`) | Órdenes de prueba (§8) |

## 4. A — La ventana de la consulta, igual que la de Windows

### 4.1 Lo que hay que leer en Windows

| Archivo (en `apps/windows/`) | Qué es |
|---|---|
| `windows-client/src/Ui/ConsultaWindow.cs` y `ConsultaWindow.Anfitrion.cs` | la ventana entera, elemento por elemento |
| `windows-client/src/Ui/Estudio.cs` | **todos** los colores, radios, sombras y botones: la ventana no inventa ninguno |
| `windows-client/src/Persona/PalabrasDelPanel.cs` | cada texto de la ventana, para médico y para estudiante |
| `windows-client/src/Ui/LoginWindow.cs` | entrar, crear cuenta |
| `windows-client/src/Cuenta/SesionMiracle.cs`, `Nube.cs` | la sesión del médico en Supabase: entrar, refrescar el token, guardarla, salir |
| `windows-client/src/Clinical/ArranqueDeConsulta.cs` y `App.xaml.cs` (`AbrirLaConsulta`) | cuándo se pide la cuenta y cuándo se abre la ventana |
| `windows-client/src/Clinical/ClinicaClient.cs` | `GET /api/clinical/templates`, `POST /api/clinical/encounters`, `…/transcript`, `…/generate-note`, `GET …/:id` |
| `windows-client/src/Clinical/Consulta.cs` | la máquina de estados: SinEmpezar → Grabando → GenerandoNota → NotaLista / Fallida |
| `windows-client/src/Clinical/PlantillaAbierta.cs` | nadie elige plantilla: se busca «Nota abierta (Ü)» y, si no está, se crea con sus secciones |
| `windows-client/src/Clinical/Transcripcion/*` | el dictado en vivo: Graph da la sesión (`POST /api/v1/transcription/session`), y se manda el audio al proveedor que diga (Soniox o Deepgram) |
| `windows-client/src/Clinical/EspejoDeConsulta.cs` | la nota se escribe en la tabla `consultations` del portal, y de ahí sale la pestaña Consultas |
| `windows-client/src/Clinical/Encargo.cs` | el texto de las secciones marcadas con ✓ |
| `windows-client/src/Ui/VocesEnVivo.cs` | lo oído, separado por quién habla (spec 070) |
| `windows-client/src/Ui/PanelDelMotivo.cs` | soltar la historia clínica y «¿por qué vino a cardiología?» (spec 051) |
| `docs/specs/004`, `008`, `010`, `016`, `031`, `051`, `070`, `080`, `084` | el porqué de cada parte |

En `apps/windows/tests/ContratoDelGrafo/Contrato.cs` están las promesas que juzgan esas clases. Busca los
nombres de clase y escribe en el Mac el equivalente de cada una que aplique. Por ejemplo: no se cambia de
cuenta mientras se graba (99); la nota se espeja al portal y se dice si no se pudo (93); nadie elige
plantilla (94).

### 4.2 La ventana, pieza por pieza

Las medidas están en puntos. La fuente es la del sistema (SF Pro en el Mac, en lugar de Segoe UI), con los
mismos tamaños y pesos. Los iconos de Segoe MDL2 pasan a sus equivalentes de SF Symbols: `chevron.down`,
`mic`, `minus`, `xmark`, `checkmark` y, para el cerebro, el dibujo de `CerebroDibujado`.

**El marco**
- Sin barra de título del sistema.
- 988×656 al abrir; eso incluye el hueco de la sombra, así que la tarjeta mide 944×612. Mínimo 400×540.
  Centrada al abrir.
- Tarjeta blanca `#FFFFFF`, radio **46**, borde 1 pt `#E3E7EE`, y una sombra grande (desenfoque 48,
  desplazamiento 12, 18 %).
- Margen interior 24/20/24/24.
- **No se maximiza**, tampoco con el atajo del sistema. Se arrastra desde cualquier sitio. Esc la minimiza.
- **Minimizar y cerrar, dibujados a la derecha** como en Windows. En el Mac van a la derecha igual: la
  ventana es la misma.

**La cabecera** (margen inferior 16)
- A la izquierda, el **nombre del médico** (14,5 pt, seminegrita, tinta `#0F1524`) con un chevron (8 pt,
  `#7C8697`). Es un botón: fondo `#E4E8EF` al pasar el ratón, radio 10.
- Al pulsarlo se abre el **menú de cuenta**: nombre editable, cambiar de cuenta, agregar una cuenta nueva,
  cerrar sesión. **Las tres cierran la sesión, y se bloquean mientras se graba.**
- Al lado, el **micrófono**: botón de 28×28 con el icono a 13 pt `#5A6478`. **Su color dice si está entrando
  voz.** Al pulsarlo se abre un menú centrado bajo el botón con las fuentes de audio: micrófono del
  computador, collar Omi y teléfono por código. Ver `PintarMenuDeMicrofono` y la spec 010. Si la fuente
  elegida no entrega audio, se graba con la que haya **y se dice**.
- Al lado, el **cerebro** (los aprendizajes, spec 016). Abre un panel en la misma superficie: la lista y la
  ficha con sus pasos.
  - En el Mac, lo que lista son **las habilidades de `aprendido.json`**, que son las únicas que existen allí y
    las que usa el ✓.
  - Es la única diferencia de contenido con Windows (que aún lista sus skills viejas por demostración). Dila en la spec.

**El segmentado** (margen inferior 18)
- Un carril `#E4E8EF` de radio 21 y relleno 4, centrado, con «Consultas» y «Nota».
- La pestaña activa es una **pastilla blanca con sombra leve** (desenfoque 14, desplazamiento 3, 10 %) y texto
  en seminegrita. La inactiva, transparente y en `#5A6478`.
- Con el cerebro abierto, ninguna se ve activa.

**La superficie** (con desplazamiento vertical; la barra va por fuera del texto)

*Nota*, en este orden:
1. El **panel del motivo** (spec 051), si se soltó una historia clínica.
2. **Lo que se va oyendo**: 15 pt, interlineado 25, tinta. Por voces si el proveedor las separa.
3. La **tarjeta de vacío** (radio 20, relleno 20/22), con tres textos:
   - título (14 seminegrita): «Pulsa Escuchar y habla con normalidad.»;
   - cuerpo (12,5 `#5A6478`): el de `PalabrasDelPanel.VacioCuerpo`;
   - «Suelta aquí la historia clínica —fotos o PDF— y te digo por qué vino a cardiología.»
4. **La nota**:
   - la tarjeta «Resumen»;
   - **una tarjeta por sección con texto**: radio 18, relleno 16/12/16/15, separación 10. Lleva el rótulo en
     mayúsculas pequeñas `#5A6478`, el párrafo a 13,5 y, a la derecha, el **✓**: círculo de 30×30 `#EAF1FE`
     con la marca en `#2E6BE6`;
   - si hay más de una sección con texto, **«✓ Ejecutar todo»**: pastilla `#EAF1FE` con texto `#2E6BE6` 13,5
     seminegrita, alto 36, ancho ≥150, centrada;
   - la tarjeta «Avisos», si los hay.
5. El hueco donde se sienta la carita (spec 031), al final.

*Consultas*: una tarjeta por consulta anterior, leída de la tabla `consultations` del portal con la sesión del
médico. Cada una lleva la fecha («2 oct · 06:54», 12 pt `#7C8697`), el motivo (14 pt) y el estado en una
pastilla `#EAF1FE`. Sin consultas: «Todavía no hay consultas.» / «La primera que grabes aparece aquí y en el portal.»

**La línea de estado** (12 pt `#5A6478`, centrada, margen 10/14/10/12). Dice, según el momento:
- «Preparando…» → «Listo.»;
- «Abriendo la consulta…»;
- el cronómetro mientras graba;
- «Guardando y organizando la nota…» → «Organizando la nota…»;
- «Nota lista. Ya se ve en el portal.» o «Nota guardada, pero no se pudo espejar al portal.»;
- y los fallos, diciendo qué hacer: «Sin conexión con Miracle. Comprueba la red y vuelve a pulsar Escuchar.»

**El botón Escuchar**
- 178×74, pastilla de radio 37, blanco, borde 1 pt `#E3E7EE`, sombra media (desenfoque 22, desplazamiento 5, 9 %).
- En reposo: un punto «●» de 13 pt y «Escuchar» a 17,5 pt seminegrita.
- Grabando: un cuadrado «■» rojo `#D32F45` y «Parar».
- Si al arrancar falló la plantilla, Escuchar la reintenta antes de grabar: un fallo pasajero no deja la ventana
  inservible.

**El ✓ y su propuesta** (imágenes 3, 4 y 5)
- Bajo cada sección, una línea de estado (12 pt `#5A6478`).
- Debajo, la propuesta: caja `#EAF1FE` de radio 14 y relleno 14/11/14/12, con el mensaje de la acción
  (13,5 seminegrita, tinta) y dos botones:
  - **«Aprobar»**: `#2E6BE6`, texto blanco 13 seminegrita, alto 32, ancho ≥96;
  - **«Ahora no»**: blanco, borde `#E3E7EE`, texto `#5A6478`, alto 32.
- **Ojo:** en la imagen 3, «Ahora no» sale sin margen interior y el texto se sale de la pastilla. Es un fallo de
  Windows (la plantilla de pastilla ignora el relleno). En el Mac, dale ancho mínimo y relleno.

**Soltar archivos**: fotos o PDF soltados en la vista Nota van al panel del motivo. En Consultas y en
Aprendizajes no se admite soltar.

### 4.3 El flujo, de punta a punta

1. **Cuenta.** Al abrir el panel, si no hay sesión guardada se pide la cuenta (`LoginWindow`). Es la cuenta de
   Miracle del médico, en Supabase, con correo y contraseña. La sesión se guarda en el Llavero y se refresca sola
   antes de caducar.
2. **Plantilla.** «Preparando…»: se busca la plantilla «Nota abierta (Ü)» y, si no existe, se crea →
   «Listo.». Nadie elige plantilla.
3. **Escuchar.** Se crea la consulta (`encounter`) con esa plantilla. Se pide a Graph la sesión de
   transcripción, con las cabeceras de atribución del médico (`X-Miracle-User-Id`, ver
   `SesionMiracle.CabecerasDeAtribucion`). Se manda el audio de la fuente elegida al proveedor que diga la
   sesión, y lo oído aparece en vivo.
4. **Parar.** Se guarda la transcripción y se pide la nota (`generate-note`): resumen, secciones exactas de la
   plantilla y avisos. Se pinta, y se escribe la fila en `consultations` del portal (upsert).
5. **✓ / Ejecutar todo** → §5 D (abajo).

**Estudiante.** El mismo panel graba clases («Clases» / «Apuntes»; ver `PalabrasDelPanel.DeClase` y
`GrabacionDeClase`). El médico no lo necesita; va en una spec aparte, después.

## 5. B y D — Que aprenda, y el ✓ que dispara lo aprendido

### B. Las habilidades

**Lee en Windows:** `windows-client/src/Voice/LoAprendido.cs`. En `Voice/ConversacionEnVivo.cs`: las
herramientas `habilidad_escribir`, `habilidad_leer`, `habilidad_olvidar`, `preferencia_guardar` (busca
`Fn("habilidad_escribir"`), el texto `Habilidades` (busca `private const string Habilidades`) y
`AvisoDeHabilidadesPartidas`. Las specs son `docs/specs/074-u-aprende-de-la-sesion.md` y
`083-ensenarle-un-sistema-hablando.md`.

1. **El almacén** es `~/Library/Application Support/U Mac/aprendido.json`, con:
   - `habilidades`: nombre, cuándo, pasos, cita, origen, actualizada;
   - `preferencias`: texto, cita, actualizada.

   Reglas:
   - Escritura atómica.
   - **Escribir una habilidad con un nombre que ya existe la sustituye entera.** Los nombres se comparan
     normalizados: minúsculas, sin tildes, espacios colapsados.
   - Los pasos llegan uno por línea; se les quita la numeración.
   - Los mensajes distinguen el fallo: le falta el nombre, o no trae pasos.
   - Tope de 40 preferencias; las que salen se anotan.
2. **Las cuatro herramientas**, con las descripciones de Windows reescritas. Se atienden en `AppModel.liveTool`.
   **No pasan por `busy`**: guardar no toca la pantalla.
3. **Una clase es UNA habilidad.** Cuando en la misma sesión se guarda una segunda, el resultado lo dice: si es la
   misma tarea, que reescriba la primera y olvide las parciales.
4. **Lo aprendido va en las instrucciones del delegado** al abrir la sesión. Lleva el texto `Habilidades`
   adaptado al Mac, las preferencias, y cada habilidad con sus pasos. Si no caben en 6.000 caracteres, va solo el
   nombre y se lee con `habilidad_leer`.
5. **La voz tiene que delegar la enseñanza.** Hoy la política de la voz del Mac dice «no delegues cuando la
   persona conversa», y una clase suena a conversación. Copia de `voz/Realtime/ProtocoloGptLive.cs`
   (`InstruccionesDeLaVoz`) que mirar, abrir, escribir, operar, **recordar o aprender algo, lo delegas**, y
   «PRIMERO SE EJECUTA».

### D. El ✓ y «Ejecutar todo»

**Lee en Windows:**
- `windows-client/src/Voice/LaAccionDeLaNota.cs`: la petición, el esquema, la comprobación y la orden.
- `Ui/ConsultaWindow.cs`: `PensarLaAccionAsync`, `MostrarPropuesta`, `EjecutarLaAccionAsync`, `BotonEjecutarTodo`.
- `Ui/FaceWindow.Acciones.cs`: `ProponerAccionAsync`, `EjecutarAccionAsync`.
- La spec, `docs/specs/084-los-checks-ejecutan-lo-aprendido.md`.

1. **Sin ninguna habilidad, no se llama al modelo.** Se dice: «Todavía no me has enseñado ninguna tarea.
   Enséñame una hablando —«te voy a enseñar a…»— y vuelve a pulsar ✓.»
2. **La carita sale de la ventana y va junto a la sección.** Si estaba sentada en la nota, se levanta. Se pone a
   «pensar» y la sección dice «Pensando qué quieres que haga con esto…».
3. **La petición** va a la Responses API (`POST /v1/responses`):
   - modelo `gpt-6-luna`, `reasoning.effort` `low`;
   - `text.format` `json_schema` **estricto** `{hay, accion, habilidad, porque}`;
   - las instrucciones hacen la pregunta «¿QUÉ ACCIÓN QUIERE QUE YO EJECUTE CON ESTA INFORMACIÓN?» (copia
     `Instrucciones` y `DeVarias`);
   - la entrada lleva **todas las habilidades con sus pasos** y la información tal cual.
4. **El código comprueba lo que propone el modelo:**
   - una habilidad que no existe (comparada sin mayúsculas, tildes, comillas ni punto final) **no llega al
     botón**, y se dice cuál nombró;
   - una respuesta ilegible es un error, no «no hay acción».
5. **Nada se ejecuta antes de «Aprobar».** «Ahora no» descarta la propuesta.
6. **Aprobar** manda la orden **por el mismo camino que lo escrito en el chat**: `liveVoice.text(...)`, y si la voz
   está cerrada se abre antes. La orden es el texto de `LaAccionDeLaNota.Orden`: la acción, la habilidad, «sin
   preguntarme», la información tal cual, y «un dato que falta se deja vacío y se dice».
7. **Saber cuándo terminó.** Hoy `LiveVoice` no avisa cuando el delegado acaba su turno: añade ese aviso. La acción
   termina cuando el delegado devolvió su turno y pasan ~2,5 s sin otro trabajo ni una meta abierta, con un plazo
   de 5 min. Mientras trabaja, la sección muestra lo que va haciendo; al final, lo que contó.
8. **«Ejecutar todo»** es lo mismo con todas las secciones juntas y una acción en común.
9. **Ni la nota ni la propuesta van al log**: solo cuántos caracteres eran y qué habilidad se usó.

## 6. C — Que ejecute rápido: `map_hacer`

**Lee en Windows:**
- `u/Nucleo/Ejecutor.cs`: el vocabulario, `Partir`, `Compactar`, `Normalizar`, `QuedoElegida`, `LaContiene`.
- `windows-client/src/Navigation/ManosDelPlan.cs` (`Elegir`) y `Navigation/PulsaDeUnTiro.cs`.
- El texto `ElRitmoDeLasManos` en `Voice/ConversacionEnVivo.cs`.
- La spec, `docs/specs/081-las-manos-rapidas-hacen-los-clics.md`.

1. **La herramienta** es `map_hacer {pasos}`, con una lista JSON de pasos. El parser del Mac
   (`LiveTools.parseArguments`) solo acepta `[String: String]`: `pasos` llega como texto y se decodifica aparte.
2. **El vocabulario:**

   | Paso | En el Mac |
   |---|---|
   | `abre: <app o https://…>` | con el navegador delante, la dirección va en la misma pestaña, como un solo paso; si no, `open_url` / `launch_app`. Espera a que la ventana pinte algo propio |
   | `pulsa: <nombre exacto>` | `AXPress` sobre el control con ese nombre en la última lectura. Si no está exacto, lo resuelven las manos de un tiro (una pregunta a Jev), no una vuelta al modelo |
   | `escribe: <texto>` | teclado (`InputDriver`, Unicode) y comprobar el `AXValue`. `set_value` no dispara los eventos de una página React: solo de respaldo |
   | `tecla: <atajo>` | `InputDriver.key`; los atajos con Command |
   | `elige: <campo> = <opción>` | una `<select>` web o un `NSPopUpButton` es `AXPopUpButton`: `AXPress`, luego `AXMenuItem` cuyo título **contiene** la opción («4» → «Triage 4 - Urgencia menor»), luego `AXPress`, y **leer el valor**. Hasta 1,5 s de espera a que la lista aparezca |
   | `desplaza: abajo\|arriba [n]` | rueda sobre el centro de la ventana |
   | `esperar` | hasta dos lecturas iguales, techo 3 s |
   | un objetivo sin prefijo | va a las manos (el bucle de `map_tramo`) |

3. **Las reglas medidas que hay que copiar:**
   - Partir los gestos pegados con `;`, `,`, `→` o un salto de línea; una coma dentro de `escribe:` no parte.
   - Compactar «Cmd+L, escribir dirección, Enter» en un `abre:`.
   - «pulsa: EPS» seguido de «elige: EPS = …» sobra.
   - «seleccionar X en Y» es `elige: Y = X`.
   - **Al primer fallo, para.** Los demás pasos se devuelven como omitidos: el denominador es el plan.
   - Devolver cada paso con ✔/✘ y, al final, lo que hay en pantalla con sus nombres exactos.
   - **Esperas por evidencia, no por tiempo fijo.**
   - En un navegador, a las manos no se les ofrecen Atrás/Adelante.
   - Jev: nunca más de 255 opciones; sin repetidos; un reintento si agota el plazo.
4. **El delegado** pasa a `gpt-6-luna` con `reasoning.effort` `medium` y `service_tier` `priority`. En Windows bajó el
   primer plan de 1.380 a 848 ms (`ProtocoloGptLive.Delegacion`). Mídelo en el Mac antes de dejarlo.
5. **El texto `ElRitmoDeLasManos`** va detrás de las instrucciones del delegado. Entre otras reglas: los números
   dictados por grupos («diez, veinte, treinta») se escriben pegados (102030).

## 7. E y F — El repaso al colgar, la tarjetita, y Learn

**Lee en Windows:** `Voice/ElRepaso.cs`, `Voice/DiarioDeLaSesion.cs`, `Voice/LoQueAprendi.cs`, `Ui/AprendiendoWindow.cs`.

1. **El diario.** Durante la sesión se apunta lo que dijo la persona, lo que dijo Ü, y cada herramienta con su
   resultado.
2. **El repaso.** Al cerrar la voz, si la persona habló:
   - el diario se escribe a disco y se manda a la Responses API (`gpt-6-luna`, esquema estricto de `operaciones`);
   - **el código aplica solo lo que trae una cita literal de la persona**, de 3 o más palabras;
   - con un médico, el tipo «dato» ni se ofrece: nada de un paciente entra en lo aprendido;
   - un diario que no se pudo repasar se repasa al abrir la próxima vez.

   Medido en Windows: con las herramientas de guardar escondidas a propósito, el repaso solo dejó la habilidad
   entera (12 pasos, con la regla del triage) en 8,8 s.
3. **La tarjetita** (imágenes 8 y 9).
   - Ventana: un `NSPanel` no activante y flotante, fuera de Cmd+Tab, abajo al centro. Esquinas de 24 y sombra suave.
   - Mientras repasa: un aro que gira (pista `#EAF1FE`, arco `#2E6BE6`) y «Repasando lo que me enseñaste…».
   - Al terminar: la estrella ✦ entra con un rebote, «Esto aprendí», y cada línea entra deslizándose, una tras otra.
   - Si no hubo nada: «Nada nuevo que aprender esta vez».
   - Se va sola a los 8 s + 2,5 s por línea (4 s si no hubo nada). Un clic la cierra.
   - Lo guardado **durante** la clase sale en el acto.
   - **Termina siempre**, también si el repaso falla.

### F. Learn: la estela de luz y la grabación de pantalla

**Lo que pidió el dueño (2026-10-02):** «necesita, para aprender bien, contexto de vídeo: que haya un botón de
learn que active la estela de luz alrededor de la pantalla, pero no con la funcionalidad actual del botón learn,
sino que ahora learn solo active grabación de pantalla para darle aún más contexto a la generación de la skill
que se aprenda en aquella sesión».

**Lee en Windows, como referencia de la estela** (no del comportamiento, que es el viejo):
- `windows-client/src/Ui/AuraDeAprendizaje.cs`: la estela, su regla (`ReglaDelAura`) y su píldora;
- `Ui/FaceWindow.xaml`: dónde vive el botón (`TeachBtn`, «🎓», nombre accesible «Enseñar»);
- `docs/specs/006-la-pantalla-dice-que-u-aprende.md`: el porqué de la estela;
- para las fotos en el repaso: `Voice/DiarioDeLaSesion.cs` (`FotosParaElRepaso`) y, en `Voice/ElRepaso.cs`,
  cómo van las imágenes y la sección «LAS FOTOS» de las instrucciones.

**1. El botón.**
- Va en la barra de la carita, donde Windows tiene el 🎓, con el mismo icono y el nombre accesible «Learn».
- Es un interruptor, y su fondo en color de acento dice que está encendido.
- Encenderlo **no** abre la voz, **no** graba una lección y **no** compila nada: enciende la estela y la
  grabación, y apagarlo las apaga.

**2. La estela, igual que la de Windows.**
- Una ventana transparente sobre toda la pantalla que **no recibe clics** (`ignoresMouseEvents`), flotante y
  fuera de Cmd+Tab.
- En los cuatro bordes, un degradado azul (`#4C8DFF`) que entra **96 pt** hacia dentro. Su opacidad, a una
  distancia d del borde, es `0,85 × (1 − d/96)²`, y cero desde los 96 pt.
- **Respira** mientras graba: la opacidad va de 0,55 a 1 en 1,6 s, ida y vuelta, con curva seno.
- Arriba al centro, una píldora (fondo `#0F1524` translúcido, radio 14) con un punto azul y
  «Ü está aprendiendo · grabando la pantalla».
- **La estela no sale en la grabación** (`sharingType = .none`), igual que en Windows
  (`WDA_EXCLUDEFROMCAPTURE`). La carita, la tarjetita y la ventana de Ü tampoco deben salir: lo que importa es el
  sistema que se enseña.

**3. La grabación.**
- `ScreenCaptureKit`, de la pantalla donde está el cursor, a una resolución con la que se lean los rótulos
  (≈1280 de ancho).
- No hace falta vídeo fluido: **fotogramas cuando la pantalla cambia**, con un fotograma por segundo como máximo.
  Se guarda también **cada clic y cada tecla de la persona**, con su instante y el fotograma de ese momento, con el
  cursor dibujado encima.
- Si el permiso de Grabación de pantalla no está dado, Learn **no se enciende** y lo dice; no hace como que graba.
- Todo va a una carpeta de la sesión en `~/Library/Application Support/U Mac/`.

**4. A qué sesión pertenece.** Cada fotograma lleva su instante. Al cerrar una sesión de voz, los fotogramas de
mientras duró esa sesión son de su diario.
- Si Learn se encendió antes de hablar, lo grabado desde entonces entra en la primera sesión.
- Si se apagó a mitad, entra hasta ese momento.

**5. El repaso, con lo que vio** (el del punto 2 de arriba):
- Cuando la sesión tuvo Learn, el repaso recibe, además del diario, **los fotogramas elegidos**, cada uno con su
  rótulo de tiempo alineado con el diario: «00:42 — la persona acababa de decir «…»», «01:05 — pulsó «Guardar
  paciente»».
- **Se eligen así:** todos los de los clics de la persona, y los de los cambios de pantalla más grandes, hasta un
  tope. Que el tope sea un número, que se diga en la spec y que se mida el coste. En Windows, las fotos del repaso
  tienen un tope de 6; con Learn hacen falta bastantes más.
- Van en la misma petición del repaso, como imágenes en alta (`detail: high`), **dentro de la petición**: no se
  suben a ningún almacén.
- Las instrucciones del repaso suman una sección para el vídeo. Úsalo para escribir bien los pasos: el nombre
  exacto de cada botón, campo y lista; el orden real; lo que se mostró sin decirlo. Lo que **decide** qué se guarda
  sigue siendo lo que la persona dijo, con su cita literal.
- Si en esa sesión ya se guardó la habilidad durante la clase, el repaso puede **reconstruirla entera con el mismo
  nombre**, completándola con lo que vio.

**6. Privacidad, porque en la pantalla de un médico hay pacientes.**
- La grabación **se borra en cuanto su sesión se repasa**, y también si el repaso la descarta.
- Nada del vídeo va al log: solo cuántos fotogramas había y cuántos viajaron.
- Con un médico, el repaso ya no guarda datos de nadie (el tipo «dato» ni se ofrece). Las habilidades dicen
  **cómo** se hace, nunca **con quién**: los datos del paciente que se vean en los fotogramas no entran en los pasos.

**Promesas sugeridas:**
- Learn encendido = estela + grabación, y nada más (ni voz, ni lección).
- Sin permiso de grabación no se enciende, y lo dice.
- La estela no sale en lo grabado.
- Los fotogramas van a la sesión de su instante.
- El repaso de una sesión con Learn lleva fotogramas, y respeta el tope.
- La grabación se borra al repasar.
- Ni una línea del log con contenido de la pantalla.

## 8. Cómo se mide que está terminado

Ninguna medición se fía de lo que Ü dice: se juzga lo que el sistema de pacientes recibe. El sistema de prueba es
`apps/windows/scripts/nivel4-voz/ensenar/his.html`, que avisa por POST a `/api/pacientes`, `/api/triage`,
`/api/vista` y `/api/rechazo`. Cópialo a `apps/mac/` y sírvelo con un servidor local que apunte esos POST.

**1. La ventana, contra las imágenes.** Pon las capturas de la ventana del Mac al lado de las de esta carpeta, en
los mismos estados:
- vacía;
- escuchando;
- nota con secciones;
- pensando;
- propuesta con Aprobar;
- hecho;
- Consultas.

Cada diferencia se corrige o se explica en la spec.

**2. El flujo clínico de verdad,** con una cuenta de prueba del portal:
1. entrar;
2. Escuchar 30 s de una consulta leída en voz alta;
3. Parar;
4. la nota aparece con sus secciones;
5. la consulta aparece en Consultas **y en el portal**.

Repítelo con la red cortada a mitad: tiene que decir qué pasó y qué hacer, no quedarse cargando.

**3. La clase hablada (9 comprobaciones).** Guion y comprobaciones en
`apps/windows/scripts/nivel4-voz/ensenar/ensenar.py`. Las frases se sintetizan con la voz `onyx` de OpenAI y
entran por el camino del micrófono: en el Mac, el análogo es `SmokeTest.spokenVoice`.

Las 9 comprobaciones:
1. cada frase se delegó;
2. entró a Paciente nuevo;
3. guardó a Ana con sus datos;
4. señalar sirvió y quedó en triage 4;
5. quedó UNA habilidad;
6. con los pasos y la regla del triage;
7. la sesión siguiente abrió con lo aprendido;
8. registró a Carlos con SUS datos sin repetirle un paso;
9. triage 4.

**3 bis. La clase con Learn: ¿aprende más viendo?** Es la misma clase con un cambio: en dos pasos, la persona **no
dice el nombre** del botón o del campo. Dice «ahora pulsa aquí» mientras lo pulsa ella con el ratón (por ejemplo,
«Guardar paciente» y «Confirmar triage»).
- Se corre **con Learn y sin Learn**.
- Se cuenta cuántos de esos nombres, que solo se **vieron**, quedan escritos exactos en la habilidad.
- Con Learn tienen que estar todos, y la sesión siguiente tiene que usar la habilidad sin fallar en esos pasos.
- Sin Learn es la línea base: lo que hoy se pierde.

Tres corridas de cada una.

**4. Los checks (9 comprobaciones).** Ver `apps/windows/scripts/nivel4-voz/ensenar/checks.py`. Necesita dos
órdenes de prueba que solo existan con `U_ORDENES_DE_PRUEBA=1`: el ✓ con un texto, que devuelve la propuesta, y
aprobar.
- **A.** Una sección con un paciente → propone con la habilidad enseñada → aprobada → el HIS lo recibe con sus
  datos → triage 4.
- **B.** «Comprar pan, llamar al contador…» → no propone, y dice qué falta.
- **C.** «Ejecutar todo» con dos secciones → una acción → el HIS lo recibe → triage 4.
- **D.** Colgar → la tarjetita carga y termina.
- **E.** Sin nada aprendido → lo dice sin llamar al modelo.

**5. Con el ratón y la nota real:** dictar una consulta, pulsar el ✓ de una sección, ver la propuesta, Aprobar, y
ver el resultado en el HIS. En Windows esto quedó sin probar con el ratón; en el Mac no puede quedar sin probar.

**6. Repetir.** Cada medición, **tres corridas seguidas**. En Windows, una corrida de 5 de 9 fue el servidor de
voz tardando más de 35 s: sin repetir, no se distingue un fallo del código de uno de la red.

**7. El sistema real del médico**, si existe: una clase corta y su uso. Los nombres de sus botones y sus listas
dirán si «pulsa:» y «elige:» aciertan allí.

## 9. Lo que se aprendió en Windows y vale en el Mac

- **Probar por escrito no prueba la voz.** Lo escrito va directo al delegado; lo hablado lo decide la voz. Una
  noche entera probada por escrito falló a la primera frase hablada.
- **El delegado a veces pregunta en vez de actuar.** Las instrucciones lo prohíben durante una clase.
- **Una sesión de voz sin audio** se cerraba sola a los ~30 s en Windows. Si abres una sesión solo-texto para el ✓,
  mándale silencio al ritmo del micrófono.
- **Lo peor no es que falle: es que parezca que funcionó.** Un paso no hecho deja rastro. Una acción solo termina
  cuando quien actúa devolvió su turno. Un cargando siempre termina.
- **Un mensaje describe el paso que falló**, no concluye una causa que no puede distinguir.

## 10. Instalarlo en el Mac del médico

- Sin firma Developer ID, lo más fiable es **compilar en su Mac**: las herramientas de línea de comandos de Apple
  (`xcode-select --install`) y `./instalar.sh`, que deja la app en `~/Applications` con firma local estable.
- Si no se puede compilar allí: copiar la `.app` instalada, quitarle la cuarentena
  (`xattr -dr com.apple.quarantine U.app`) y abrirla con clic derecho → Abrir.
- **Permisos** en Ajustes → Privacidad: Accesibilidad, Micrófono y Grabación de pantalla, **a la copia
  instalada**. Cambiar de copia después los pierde.
- **Configuración:** la credencial de Graph, el perfil «Médico» con su especialidad, y su cuenta de Miracle en la
  ventana. En Configuración tiene que decir «Voz: disponible · Jev: disponible».
- **Allí mismo, antes de dárselo:** una consulta corta, una clase de dos pasos y un ✓.

## 11. Fuera de este trabajo

SAP (no existe en Mac), las metas largas (spec 082), el modo estudiante, retirar el aprendizaje viejo por
demostración, y firmar y notarizar. Las fotos sueltas del repaso de Windows (spec 079) no hacen falta: Learn las
sustituye con algo mejor.

**Windows sigue con su Learn viejo.** Lo que pide este plan es para el Mac. Si el dueño lo quiere también en
Windows, es una rama aparte, desde Windows.

## 12. Qué devolver

Un PR por spec, cada uno con:
- las promesas y la salida de `./contrato.sh`;
- el sabotaje: qué se rompió y qué se puso rojo;
- las capturas de la ventana del Mac al lado de las de Windows;
- las mediciones con su recuento y sus tiempos, en tres corridas;
- en cuántas pantallas y en qué navegador se probó;
- y, dicho en claro, lo que no se probó.
