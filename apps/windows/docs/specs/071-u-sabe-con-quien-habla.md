# Plan de implementación: Ü sabe con quién habla

Estado: **fases W1, W2, W3 y W4 escritas; compilan en Linux y sus promesas de texto están verdes** (2026-10-01) · Nace del pedido del dueño del 2026-10-01 · Rama: `claude/wizardly-brown-ld68hq`

> Esta spec cubre la mitad Windows del diseño «los prompts de Ü, ordenados». La otra mitad vive en
> Graph (`services/graph`), en el mismo PR. **W1** (perfil, bienvenida, cable) usa las promesas
> **650-669** del contrato del grafo; **W2** (la voz: la constitución en `Instrucciones`, la persona de
> GPT-Live, el saludo, los defectos D1-D10 del mapa de la voz) usa las **670-686** del grafo y las
> **56-59** del contrato de la voz. **W3** (el delegado, segunda ronda: lo que encontraron las pruebas del
> delegado con la constitución nueva) usa las **687-691**, y **W4** (dos fallos que encontró la revisión del
> código de la rama) las **692-693**.

## Diagnóstico: qué se midió

El dueño (2026-10-01, resumen fiel): que Ü pregunte al inicio si quien lo usa es **médico** o
**persona** (uso personal), que cada perfil tenga sus prompts —con la especialidad del médico—, que
los prompts no se contradigan, y un pilar: **hacerle caso al usuario y ejecutar bien lo que pide**.

| Qué | Medida | Fuente |
|---|---|---|
| Qué pregunta la bienvenida | nombre y correo; nada de perfil | `Ui/OnboardingWindow.cs` |
| Dónde sabe Ü la especialidad del médico | en ningún sitio que viaje: `SesionMiracle` solo la leía para no borrarla al guardar el nombre (`LeerPerfilActualAsync`) | `Cuenta/SesionMiracle.cs` |
| Qué lleva el turno a Graph sobre la persona | nada: ni `/agent/turn` ni la enseñanza llevan perfil | `Domain/Protocol.cs`, `Teach/TeachSession.cs` |
| El modo viejo de `BackendClient` | cualquier `localhost` hablaba `/api` + Bearer `ClientToken`; Graph local contesta 401 → `scripts/dev-local.ps1` roto desde el 2026-09-20 | `Backend/BackendClient.cs` (commit `3d1289c`), `services/graph/web/server.js` |
| `U_BACKEND_URL` | pisaba `BackendUrl` en memoria y el siguiente `Save` (temporizador de posición) la escribía en disco | `Config.cs` |
| Un `type` de computer-use | llega con `x:-1, y:-1`; `InputExecutor.Type` hacía `Tap(-1,-1)` → clic en la esquina (0,0) antes de teclear | `openaiBrain.js:251-253`, `Actions/InputExecutor.cs` |
| La plantilla abierta | dos secciones decían «deja la sección vacía», contra la regla de Graph «No mencionado en la consulta.» | `Clinical/PlantillaAbierta.cs` |

## Por qué esto va dirigido por especificación

La regla de quién manda (cuenta Miracle vs. lo elegido) es la misma clase de error que la promesa 98:
dos identidades de distinta forma, y quien las junta hereda el desacuerdo (aprendizaje nº16). Y el
perfil se reparte por cuatro caminos —el cable del turno, dos de enseñanza y la voz—: una prueba
escrita después de cablear tres se escribiría para que pasaran esos tres.

**La regla del flujo, y no tiene excepciones:** ninguna línea de producción entra antes que la
promesa que la juzga. Cada fase empieza con el contrato ROTO y termina con el contrato INTACTO.

## La especificación

Los enunciados son los de `tests/ContratoDelGrafo/Contrato.cs`, literalmente.

| # | Promesa | Fase |
|---|---|---|
| 650 | con un médico dentro, Ü es médico y su especialidad es la de su cuenta aunque en este equipo se haya elegido otra cosa; si la cuenta no la tiene vale la elegida como médico, y si tampoco, queda sin especialidad — nunca la que quedó guardada de una persona | W1 |
| 651 | sin médico dentro manda lo que eligió la persona: «Médico», «médica» y «MEDICO » son médico; una persona va sin especialidad aunque quede una vieja guardada; y lo que nunca se eligió —o un valor que no se conoce— es «sin elegir», no un perfil por defecto, y no viaja a Graph | W1 |
| 652 | el perfil se pregunta una vez: equipo nuevo → bienvenida entera; equipo con correo y sin perfil → solo el perfil; con perfil elegido o con médico dentro → nada; y la 98 sigue igual | W1 |
| 653 | un config.json de antes carga con el perfil vacío sin perder correo, nombre ni posición; el perfil elegido con su especialidad sobrevive a guardar y volver a cargar; y el token del backend viejo no vuelve a escribirse | W1 |
| 654 | la especialidad del médico sale de profiles, viaja en la sesión guardada —restaurar sin red la trae— y sobrevive a renovar el token; una sesión de antes, sin ella, la recibe en su primera renovación sin volver a entrar | W1 |
| 655 | el primer turno de /api/v1/agent/turn lleva el perfil —profile {kind, specialty, specialtyName}—, los siguientes no lo repiten, y sin perfil el campo no viaja: el contrato de siempre sigue igual | W1 |
| 656 | la enseñanza lleva el perfil: interpret-steps lo manda junto a los pasos, process-video lo lleva en su cuerpo, y sin perfil no viaja | W1 |
| 657 | Ü habla un solo contrato con su cerebro: Graph remoto o en localhost recibe /api/v1/agent/turn con X-API-Key y sin Bearer, y Config ya no guarda el token del backend viejo | W1 |
| 658 | U_BACKEND_URL vale solo para ese proceso: Ü la usa pero no la escribe en config.json, y un config.json que trae el backend viejo o un localhost vuelve a Graph al cargar; una URL puesta a mano se respeta | W1 |
| 659 | el bloque «QUIÉN TE HABLA» sale de la constitución de Ü: el del médico lleva su especialidad («, especialista en Cardiología») o nada, el de la persona no trae vocabulario clínico, la frase de la voz igual («de Cardiología») y cabe en la vuelta de GPT-Live; sin perfil, los dos son vacíos y Ü es la de antes | W1 |
| 660 | un type sin punto —x o y negativos, como lo manda Graph— teclea donde está el foco, sin hacer clic en la esquina (0,0); con punto, toca y teclea como siempre | W1 |
| 661 | las especialidades son las del portal, en su orden y en kebab-case, y una que no está en la lista vale igual: se busca sin mayúsculas ni tildes y lo escrito a mano da su propio código | W1 |
| 662 | la plantilla abierta no pide dejar una sección vacía: si no se dijo nada, manda la regla de Graph («No mencionado en la consulta.»), no una instrucción de sección que la contradice | W1 |
| 663-669 | libres dentro de W1: no se usaron. No se reciclan para otra cosa sin decirlo aquí | — |
| 670 | las instrucciones de la voz son la constitución de Ü y la operación de Windows: quién es Ü y el pilar de obedecer —el mismo texto que lee Graph— y detrás cómo se opera la pantalla, sin repetir ninguna regla de la constitución y sin nada de la Ü de antes | W2 |
| 671 | cada perfil cumple las mismas reglas: sin elegir, médico con y sin especialidad, y persona, con el decisor encendido y apagado, las instrucciones de siempre dicen lo que exigen la 161, la 206, la 244 y la 263, no dicen nada de lo que prohíben la 161, la 206, la 244 y la 502, y nombran map_decidir solo con el decisor | W2 |
| 672 | el bloque «QUIÉN TE HABLA» va justo detrás de quién es Ü y antes de «LO QUE TE PIDEN, LO HACES», una sola vez y con lo demás igual; sin perfil, las instrucciones de siempre son las de antes byte a byte | W2 |
| 673 | el perfil llega a la voz: con GPT-Live la frase de su perfil va detrás de la persona de la voz desde la apertura, con GPT Realtime va en las instrucciones, y la ventana se lo pone al crear la voz y cada vez que cambia | W2 |
| 674 | la apertura tiene presupuesto: con cualquier perfil y el decisor, las instrucciones de siempre miden como mucho 20.000 caracteres, y el hilo que va en ellas, como mucho 8.000 y siempre lo último | W2 |
| 675 | la apertura lleva el párrafo del decisor si y solo si el catálogo trae map_decidir: se abre con las instrucciones de siempre de la conversación, no con la constante | W2 |
| 676 | el aprendiz ve y no toca, por lista blanca: con el decisor encendido o apagado, todo lo que tiene es mirar, señalar o callarse —ni map_hacer, ni map_decidir, map_tramo o map_alto, ni map_esto_es, ni memory_remember—, y una herramienta que nazca mañana no le entra por omisión | W2 |
| 677 | volver de un modo devuelve la memoria, el hilo y el perfil: con GPT-Live y con GPT Realtime, lo que recibe quien opera al volver del aprendiz lleva el recuerdo, lo último que se habló y con quién habla, con el catálogo entero; y con GPT-Live la voz recibe su persona, no las de operar | W2 |
| 678 | el botón Jev no le devuelve las manos al aprendiz: en un modo especial, que cambie el catálogo no manda nada y lo aplica la vuelta; en el modo de siempre sí; y ningún sitio de la ventana vuelve de un modo con las instrucciones a secas | W2 |
| 679 | reconectar en un modo vuelve a ese modo: tras el corte, cuando el servidor confirma la sesión nueva, la voz y el delegado vuelven a las reglas y al catálogo del aprendiz; sin modo no se manda nada; y la frase del corte ya no dice que olvidó lo último | W2 |
| 680 | una sola pregunta de peligro: la mano del plan y el decisor le preguntan a TypeSafe con la misma frase, y esa frase nombra guardar, grabar, firmar y finalizar además de enviar, borrar, pagar y cerrar sin guardar | W2 |
| 681 | una nota del sistema no es de la persona: sale con su texto y su response.create, pero no entra en el hilo durable ni se pinta «Tú: …»; el saludo de primera vez y la cuenta de un tramo van por ahí | W2 |
| 682 | cambiar de modo espera a que el servidor confirme la sesión: con GPT-Live no sale nada antes de session.started y sale entero en cuanto llega; un protocolo que no confirma no hace esperar | W2 |
| 683 | en un modo especial no hay vigilantes: lo narrado no arma el aviso de lección perdida ni se guarda como memoria personal; fuera de un modo, los dos siguen despiertos | W2 |
| 684 | los textos que recibe la voz dicen lo que pasa: la voz prestada cita el dictado tal cual le llega, self_update no le contesta en futuro y self_close no le da una segunda despedida | W2 |
| 685 | el saludo de primera vez sabe con quién habla: al médico le cuenta que le ayuda en sus programas para que le quede más tiempo para sus pacientes, a la persona que le ayuda en su día a día sin hablarle de pacientes ni de SAP, y sin elegir es el de antes; los tres ofrecen mirar el computador con UNA pregunta y dicen que es la excepción | W2 |
| 686 | los prompts de cardio llaman a Ü por su nombre, con diéresis: ninguno dice «U» | W2 |
| 687 | el delegado sabe cuándo callar, cuándo seguir y cuándo preguntar: un «espera» mientras habla es una interrupción y no apaga la voz, lo que cancela acaba con lo anterior, un diálogo que solo confirma lo pedido se contesta sin preguntar —con `choose`, y si map_unblock no lo pulsa, con map_take— y uno que trae otra decisión se pregunta una vez, dos del mismo nombre que son personas no se eligen —tampoco si la lista llega de map_hacer, ni con el decisor—, en una app de trabajo mira una vez dónde está antes de actuar porque solo eso cuenta lo enseñado, al terminar habla siempre, y tocar archivos es file_list, un map_hacer con pasos y teclas que las manos leen —de uno en uno, volviendo a la carpeta de origen—, y file_list otra vez | W3 |
| 688 | el catálogo no contradice a las instrucciones: self_mute dice que un «espera» no es apagar la voz, lo que se recuerda de una pantalla y de la persona van a herramientas distintas, ni memory_remember ni map_esto_es guardan datos de un paciente —y memory_remember dice a dónde van si piden anotarlos—, map_where_am_i dice que cuenta lo enseñado y cuándo pedirla, `choose` de map_unblock dice qué pasa sin él y qué no pulsa, `which` de map_take sirve también para la lista de map_hacer, file_list dice que en la ventana el nombre va sin la extensión que Windows esconde, map_hacer nombra todos los pasos que las manos leen y ninguno más, y ninguna descripción dice Jeff, ordenador, «sólo» ni vosotros — en el catálogo de la voz y en el del piloto, con el decisor y sin él | W3 |
| 689 | una pregunta sin respuesta no es permiso: el bucle del agente le dice al cerebro que la persona no contestó —empezando como el «(sin respuesta)» de Graph— y no «usa tu mejor criterio»; y las frases fijas que el bucle narra o dice no llevan emojis, ni «¡Vamos!», ni «voy a», ni tuteo —le puede estar hablando a un médico—, y «Listo.» se narra solo si no hubo resumen | W3 |
| 690 | con un médico, la memoria automática no guarda nada por su cuenta: lo dicho en consulta —«recuerda que la de la cama 4 es alérgica a la penicilina», «tengo un paciente de 54 años»— no llega a la memoria personal si no lo decide el modelo con memory_remember; con una persona o sin elegir, sigue guardando como siempre | W3 |
| 691 | dos del mismo nombre no los elige el plan: si «pulsa: X» encuentra varios «X» a la vista, el paso para con su lista numerada y dice cómo pulsar uno (map_take con which), sin esperar ni pasárselo a Jev; si no hay varios, lo de siempre (516, 524, 525) | W3 |
| 692 | en un equipo compartido la especialidad de un médico no se le pega al siguiente: al entrar con su cuenta, la carita guarda que en ese equipo se usa Ü como médico, pero no copia a config.json la especialidad de la cuenta; la que queda guardada es solo la que alguien eligió allí (650) | W4 |
| 693 | una reconexión no deja a nadie esperando a una conexión muerta: si al empezar otra conexión la confirmación de la anterior seguía pendiente, la nueva la hereda, y quien esperaba (volver de un modo, empezar a enseñar, hablar) despierta con la confirmación de la conexión viva en vez de rendirse a los 15 s | W4 |
| voz 56 | volver de un modo con GPT-Live es su propio mensaje: la delegación con las instrucciones que se le den, íntegras byte a byte aunque no sean las de la apertura, y a la voz su persona detrás del prefijo medido de la vuelta, nunca las de operar; con GPT Realtime volver es su apertura, y un protocolo que no lo declara vuelve con su cambio de modo | W2 |
| voz 57 | ningún append a la voz de GPT-Live pasa de 1.756 caracteres, el más largo que se midió aceptado: unas reglas que miden justo eso salen enteras, unas instrucciones de operar que no caben le devuelven su persona en vez de mandarse, y una frase de perfil desmedida deja la persona base | W2 |
| voz 58 | la voz de GPT-Live sabe con quién habla: la frase del perfil va pegada detrás de su persona al abrir y al volver, sin perfil la persona es la base exacta, y con perfil sigue diciendo las reglas de la 46 y la 55 | W2 |
| voz 59 | la persona de la voz es la de Ü: español de Colombia —computador, no ordenador—, sin «sobre todo SAP» ni emojis, y con el prefijo de la vuelta y la frase de perfil más larga cabe en 1.700 caracteres | W2 |

Las de la voz son del contrato de la voz (`voz/Contrato/Contrato.cs`), que tiene su propia numeración.

Siguen tal cual y hay que vigilarlas: **98** (`HayQuePreguntar` no se toca), **85/86/97/99/100**
(`SesionMiracle`: la lectura de `profiles` pide dos columnas más y renovar puede hacer UNA lectura de
`profiles` si la sesión no traía especialidad; ninguna de esas promesas cuenta esas peticiones),
**94** (la plantilla abierta sigue con sus tres secciones y su «organiza»), **164** (ningún «ToolTip»
nuevo), **522** (nada pide `SpecialFolder` por su cuenta) y **531** (no hay ventana nueva:
`OnboardingWindow` ya estaba declarada como ventana de trabajo).

En la W2 cambian de texto, sin cambiar lo que prometen: la **138** (la lista de manos crece con
`map_hacer`, `map_decidir`, `map_tramo` y `map_alto`, y se juzga con el decisor encendido y apagado),
y los comentarios de la **40** y la **47** de la voz (la cifra 20.694 era vieja: las instrucciones miden
15.818 caracteres). Las que juzgan los textos —**46**, **55** (voz), **161**, **192**, **206**, **244**,
**263**, **284**, **502** (grafo)— siguen iguales y se comprobaron con un script sobre el texto fuente
para cada perfil, con y sin decisor, también con saltos `\r\n` (ver el informe de la fase).

La que cierra el asunto es la **655**: mientras el perfil no viaje en el primer turno, Graph no puede
hablarle a nadie distinto, y todo lo demás es cosmético.

### Con qué se juzga cada una

Sin pantalla y sin red, como la 98:

- **650, 651, 659** — `Cuenta.PerfilDeUso` es puro: se invoca `Resolver`, `Normalizar`,
  `ParaElCable`, `ParaElDelegado` y `ParaLaVoz` por reflexión. La 659 compara el bloque con las
  constantes de `Voice.ConstitucionDeU`, la copia que `tools/monorepo/constitucion.sh` mantiene igual
  a la de Graph.
- **652** — `Identidad.QueBienvenida`, con sus seis combinaciones, y la 98 otra vez.
- **653, 658** — `Config.Load`/`Save` sobre el `U_DATA_DIR` propio de la promesa; se mira el ARCHIVO.
  La 658 restaura `U_BACKEND_URL` al terminar pase lo que pase.
- **654** — `SesionMiracle` con `BackendDeMentira` y reloj falso (como la 85): entrar, renovar dos
  veces y restaurar con un backend muerto.
- **655, 656, 657** — `BackendClient` con el transporte inyectado (constructor nuevo, mismo patrón
  que `SesionMiracle` y `ClinicaClient`): se lee el CUERPO y las cabeceras que salen. La 656 juzga
  `interpret-steps` entero y `process-video` por su registro, más una línea `[cableado]` sobre
  `TeachSession.cs` (necesita `U_REPO`).
- **660** — `AgentLoop.TieneDondeTocar` y una línea `[cableado]` sobre el brazo `type` de
  `AgentLoop.cs` (necesita `U_REPO`).
- **661** — `Cuenta.Especialidades`: forma de la copia y `Buscar`.
- **662** — `PlantillaAbierta.Secciones()`.

- **670, 672** — las constantes por reflexión: `Instrucciones` = `ConstitucionDeU.Quien` + `Obedece` +
  `Operacion`; y `InstruccionesDeSiempre` por perfil contra `PerfilDeUso.ParaElDelegado`.
- **671, 674, 675** — `ConversacionEnVivo.InstruccionesDeSiempre` con cada perfil y `ConDecisor` en los
  dos valores (restaurado en `finally`); la 674 y la 675 llaman a `InstruccionesConMemoriaAsync` con un
  hilo de 41 turnos en un archivo de la promesa.
- **673** — `Perfil` → `ProtocoloGptLive.PersonaExtra` y el `session.start` que sale; `[cableado]` en
  `FaceWindow.xaml.cs`.
- **676** — `ModoAprendiz.Utensilios` con el catálogo con y sin decisor, y con una herramienta inventada.
- **677, 678, 679, 681, 682, 683** — una `ConversacionEnVivo` sin socket, con `_puerta` y `_puertaAbierta`
  sustituidas (el patrón de la 208): se juzga lo que manda de verdad. La 679 y la 682 simulan la conexión
  con `EmpiezaUnaConexion` y la confirmación con `Procesar(session.started)`. La 677 y la 683 usan una
  `MemoriaPersonal` y una `ConversacionPersonal` en archivos de la promesa.
- **680** — los dos cuerpos que salen hacia TypeSafe: `U.Ciclo.Jev.Cuerpo` y
  `PeticionASystemOne.CuerpoDeEleccion`.
- **684, 685, 686** — los textos (`VozPrestada`, `Presentacion.Saludo`, los prompts de cardio) por
  reflexión, y `[texto]`/`[cableado]` sobre las fuentes (necesitan `U_REPO`).
- **56-59 de la voz** — `ProtocoloGptLive` e `IProtocolo` sin socket, como la 47.
- **687** — la constante `Operacion` por reflexión (la misma que llega en `InstruccionesNormales`), párrafo a
  párrafo; los pasos del ejemplo de archivos contra los prefijos que leen `u/Nucleo/Ejecutor.cs` y
  `ElPlanPorObjetivos.Objetivo`, y cada `tecla:` contra `U.Ciclo.Raton.EventosDeTecla` (fuera de Windows, con su
  misma gramática).
- **688** — `Herramientas()` y `HerramientasDelPiloto()` con `ConDecisor` en los dos valores (restaurado en
  `finally`).
- **689** — `AgentLoop.SinRespuesta` por reflexión, y `[texto]`/`[cableado]` sobre `AgentLoop.cs` (necesita `U_REPO`).
- **690** — una `ConversacionEnVivo` sin socket (como la 683), con cada perfil y una `MemoriaPersonal` en un archivo de
  la promesa: se le dicen dos frases a cada vigilante y se lee lo que quedó.
- **691** — `ElPlanPorObjetivos.Objetivo` con las manos de mentira de la 516 y `Homonimos` puesto a mano (corre sin
  pantalla); `[cableado]` sobre `FaceWindow.xaml.cs` (necesita `U_REPO`).
- **692** — `[texto]` sobre `EnsureOnboarded` en `FaceWindow.xaml.cs` (necesita `U_REPO`): pone el perfil y no copia la especialidad.
- **693** — `[texto]` sobre `EmpiezaUnaConexion` en `ConversacionEnVivo.cs` (necesita `U_REPO`): hereda la espera pendiente.

La ventana de bienvenida y la fila del menú son **nivel 4**: se prueban a mano en un PC con Windows. Y
la voz también tiene su nivel 4 (abajo, fase W2).

## Las fases

### Fase W1 — Ü sabe con quién habla, y Graph se entera

| | |
|---|---|
| **Promesas que pone verdes** | 650-662 |
| **Qué toca** | `Cuenta/PerfilDeUso.cs` (nuevo), `Cuenta/Especialidades.cs` (nuevo, copia de `apps/web/lib/clinical/specialties.ts`), `Voice/ConstitucionDeU.cs` (nuevo), `Cuenta/Identidad.cs`, `Cuenta/SesionMiracle.cs`, `Config.cs`, `Domain/Protocol.cs`, `Backend/BackendClient.cs`, `Teach/TeachSession.cs`, `Agent/AgentLoop.cs`, `Clinical/PlantillaAbierta.cs`, `Ui/OnboardingWindow.cs`, `Ui/FaceWindow.xaml(.cs)` |
| **¿Núcleo congelado?** | no |
| **Terminado** | 650-662 verdes, 1-649 intactas; bienvenida probada a mano en los dos modos y desde el menú |
| **Sitios con esta clase de error** | contados con `grep` de `.PostAsync<` y `.TurnAsync(` en `windows-client/src`: **8 llamadas** a Graph por `BackendClient`, **3 con prompt** (`agent/turn`, `teach/process-video`, `teach/interpret-steps`) y las 3 llevan el perfil; las otras 5 (`teach/upload-token`, `teach/file-state`, `agent/usage`, `agent/register`, `agent/events`) no tienen prompt y no lo llevan |

Lo que hace, en una línea por pieza:

- **`PerfilDeUso`** (record puro): `Normalizar`, `Resolver` (la regla de la 98: si hay médico, manda
  la cuenta), `ParaElCable` (null sin elegir), `ParaElDelegado` (`"\n\nQUIÉN TE HABLA: …"` desde la
  constitución, `""` sin elegir; lo usará W2 en `InstruccionesDeSiempre`), `ParaLaVoz` (la frase
  corta de GPT-Live; la usará W2 en `PersonaExtra`), `ParaElMenu`, `Describir`.
- **`ConstitucionDeU`**: `Quien`, `Obedece`, `PerfilMedico`, `PerfilPersona` (las cuatro que compara
  `constitucion.sh` con Graph), `VozMedico`, `VozPersona` y `Version`.
- **`Config`**: `Perfil`, `Especialidad`, `EspecialidadNombre` (texto, no enum); `ClientToken` se va;
  `BackendUrlEnUso` separa la URL de esta ejecución de la que se guarda.
- **`SesionMiracle`**: `Credencial` lleva la especialidad (parámetros opcionales: un `sesion.dat` viejo
  carga igual); `CompletarPerfilAsync` lee `full_name,specialty_code,specialty_name`; renovar conserva
  el perfil y, si no había especialidad, la pide UNA vez.
- **El cable**: `TurnRequest.Profile` y `PerfilEnElCable` en `Protocol.cs`; `BackendClient.Perfil`
  (lo pone en el primer turno) y transporte inyectable; `TeachSession` lo manda en la enseñanza.
- **El modo viejo se va**: `BackendClient` habla siempre `/api/v1` con X-API-Key.
- **La bienvenida**: `OnboardingWindow` con dos modos (`Completa` / `SoloPerfil`), en la piel del
  estudio claro; tarjetas «Trabajo en salud» / «Uso personal», especialidad editable si es salud.
  `FaceWindow.EnsureOnboarded` decide con `QueBienvenida`; con médico Miracle, perfil médico sin
  preguntar. Una fila del menú («Cómo me usas») abre la misma ventana para cambiarlo, porque la
  bienvenida promete «Lo puedes cambiar cuando quieras desde el menú de Ü».

### Fase W2 — la voz

| | |
|---|---|
| **Promesas que pone verdes** | 670-686 del grafo, 56-59 de la voz, y la 138 ampliada |
| **Qué toca** | `Voice/ConversacionEnVivo.cs`, `voz/Realtime/ProtocoloGptLive.cs`, `voz/Realtime/IProtocolo.cs`, `Teach/ModoAprendiz.cs`, `Piloto/VozPrestada.cs`, `Onboarding/Presentacion.cs`, `Decision/PeticionASystemOne.cs`, `u/Nucleo/Jev.cs` (solo la frase de peligro), `Cardio/LecturaCardio.cs`, `Cardio/LecturaDeLaHistoria.cs`, `Cardio/ClienteCardio.cs` (comentario), `Ui/FaceWindow.xaml.cs` |
| **¿Núcleo congelado?** | no |
| **Terminado** | 670-686 y 56-59 verdes, el resto intacto; nivel 4 de la voz en un PC con Windows (abajo) |
| **Sitios con esta clase de error** | contados con `grep`: **3** vueltas de modo con las instrucciones a secas (`FaceWindow.xaml.cs`: terminar de enseñar, devolver la voz prestada, botón Jev) → las 3 por `VolverAlModoNormalAsync`/`ReenviarElCatalogoAsync`; **3** usos de la constante en la apertura (`InstruccionesConMemoriaAsync`) → `InstruccionesDeSiempre`; **4** manos colándose en el aprendiz (`map_hacer`, `map_decidir`, `map_tramo`, `map_alto`) → lista blanca; **2** notas del sistema como texto de la persona (saludo, tramo) → `AvisarAlModeloAsync`; **2** preguntas de peligro a TypeSafe → 1; **5** vigilantes despiertos en los modos (`VigilarLaLeccion`, `JuzgarLaLeccion`, `GuardarPeticionPersonalSiLaPidio`, `GuardarDetallePersonalSiEsRelevante`, `SeguirContandoSiQuedan`) |

Lo que hace, en una línea por pieza:

- **Las instrucciones**: `Instrucciones` = `ConstitucionDeU.Quien` + `Obedece` + `Operacion` (sigue siendo
  `private const string`, por la 263). `Operacion` es el texto de operación de Windows del diseño, tal cual.
  Medían 25.096 caracteres; tras W2, 15.818, y con un médico y el decisor, 17.887 (tras W3, ver abajo).
- **Las de siempre**: `InstruccionesDeSiempre` (instancia) = quién es Ü · «QUIÉN TE HABLA» · obedece ·
  operación · decisor, con los saltos en `\n`. `InstruccionesNormales` (estática) es lo mismo sin perfil.
  Abrir, reconectar y volver usan las de siempre con la memoria y el hilo (D3). Del hilo van 8.000
  caracteres, no 18.000 (D5, a medias: quitarlo del todo espera a una sonda).
- **La voz**: `ProtocoloGptLive.InstruccionesDeLaVoz` es la persona del diseño (español de Colombia, cálida,
  sin «sobre todo SAP»); `PersonaExtra` (propiedad, no parámetro: la 208) lleva la frase del perfil, y
  `Persona` = base + extra abre la sesión y vuelve. `TopeDelAppend` = 1.756: ningún append pasa de ahí.
  `IProtocolo.VueltaDeModo` (otro nombre, con implementación por defecto) vuelve sin comparar con la
  apertura (D2).
- **Los modos**: `ConversacionEnVivo` sabe en qué modo está (`_modo`); `CambiarModoAsync` espera la
  confirmación del servidor (D8); `VolverAlModoNormalAsync` y `ReenviarElCatalogoAsync` (D2); al reconectar
  vuelve al modo (D4); en un modo no hay vigilantes de lección ni memoria automática (D9).
- **El aprendiz**: lista blanca de ojos (D1). «vale» → «sí» al asentir: la constitución dice «nunca vale», y
  el append queda en 1.754 caracteres.
- **Peligro**: `U.Ciclo.Jev.PreguntaDePeligro`, una sola frase con guardar, grabar, firmar y finalizar,
  para la mano del plan y para el decisor (D6).
- **Notas del sistema**: `AvisarAlModeloAsync` (D7); el saludo y la cuenta del tramo van por ahí.
- **Textos**: la voz prestada cita el dictado real (`PrefijoDelDictado`); `self_update` y `self_close`
  dicen lo que pasa (D10). `Presentacion.Saludo(nombre, perfil)` con las tres variantes del diseño. Cardio
  dice «Ü». `map_hacer` y `map_open_app` ya no dicen «Jeff» ni «ordenador».

**Nivel 4 de la voz (en un PC con Windows, con crédito en OpenAI):** abrir la voz con cada perfil y oír
cómo saluda; enseñar (🎓) y comprobar que asiente con una palabra y que, al terminar, el log dice
`vuelvo al modo de siempre` y NO `Context append text must not exceed`; pulsar Jev durante una enseñanza
(no le devuelve las manos); cortar la red a mitad de una enseñanza (vuelve aprendiz); pedir «guárdalo»
en un plan de `map_hacer` sobre SAP (para en «Grabar» y, si se pidió, pulsa con `map_take`). Pegar en el PR
las líneas `voz-viva: … el servidor la confirmó`.

### Fase W3 — el delegado, segunda ronda

| | |
|---|---|
| **Promesas que pone verdes** | 687-691 |
| **Qué toca** | `Voice/ConversacionEnVivo.cs` (`Operacion`, `ParrafoDelDecisor` y las descripciones del catálogo), `Agent/AgentLoop.cs`, `Navigation/ElPlanPorObjetivos.cs` y su cableado en `Ui/FaceWindow.xaml.cs` (691) |
| **¿Núcleo congelado?** | no |
| **Terminado** | 687-691 verdes y rojas contra el código de antes, 1-686 intactas; las de siempre de un médico con el decisor caben en 20.000 (674) |
| **Sitios con esta clase de error** | contados con `grep`: **2** sitios mandaban cualquier «deja de hablar» a `self_mute` (la operación y la descripción; el tercero, la persona de la voz, ya lo arregló la constitución); **2** herramientas contestaban «¿qué recuerdas?» (`map_recuerdos`, `memory_recall`); **2** frases empujaban a tocar archivos gesto a gesto (la operación y el comentario de los `file_*`); **2** herramientas con formas de vosotros (`map_look_back` ×3, `map_show` ×1) y **1** con «sólo»; **1** «usa tu mejor criterio» en Windows (el de Android, `core/.../Engine.kt`, es de otra carpeta: ver «Lo que NO entra»); **1** emoji que se oía al comprobar (`¡Listo! 🎉`); **3** caminos a la memoria personal (`GuardarPeticionPersonalSiLaPidio`, `GuardarDetallePersonalSiEsRelevante` y `memory_remember`): los 2 automáticos se apagan con un médico, y el tercero lo decide el modelo con su descripción y la constitución |

Lo que hace, en una línea por pieza (los hallazgos son de las pruebas del 2026-10-01 sobre el delegado con
la constitución `constitucion-de-u@2026-10-01.2`):

- **Callar no es apagar**: «cállate», «silencio», «apaga la voz», «deja de escucharme» → `self_mute`; un
  «espera», «para» o «ya, ya» mientras habla es una interrupción: se calla, escucha y hace lo que venga. En la
  operación y en la descripción de `self_mute`.
- **Lo que cancela, acaba**: «olvídalo», «no, mejor…» terminan lo anterior; lo que corrige lo mismo sigue con la
  corrección; lo que es otra cosa se resuelve y después se retoma.
- **Diálogos**: el que solo confirma lo pedido («¿Eliminar?» tras «bórralo») se contesta en `choose` sin
  preguntar; el que trae una decisión que el pedido no resolvió («¿Guardar los cambios?» al cerrar), una vez.
  `map_unblock` veta Eliminar, Borrar, Aceptar, Enviar o Sobrescribir aunque se lo pidan (`SafeToClick.EsDestructivo`):
  tras su «NO pulso…», lo pedido se pulsa con `map_take`, como en `map_hacer`. Y sin `choose` elige la salida que no
  compromete (Cancelar, No): lo dice la descripción de `choose`, que antes decía «solo si hay una única salida».
- **Homónimos**: si son personas o pacientes distintos, no se eligen con `which`: se pregunta una vez con lo que
  los distingue. En un `map_hacer` no llegaba: el ciclo rápido no pulsaba, el paso pasaba a Jev como «llegar a «X» y
  pulsarlo» y Jev elegía uno. Ahora el plan para con la lista numerada y dice cómo pulsar uno (`map_take` con
  `which`) (691); con el decisor encendido, a una persona o un paciente no la elige el decisor.
- **Llegar**: tras un acto no se pide `map_what_i_see`, pero `map_where_am_i` sí, una vez, al llegar a una app de
  trabajo y antes de actuar en ella: es lo único que cuenta lo enseñado allí (`SurfaceMapTools.WhereAmI`; los actos
  traen solo el inventario). Su descripción lo dice, y que para abrir, calcular o configurar no hace falta: sin esa
  condición chocaba con «no mires antes» de PARA ACTUAR.
- **Terminar**: al terminar habla siempre, una vez; la lección guardada al actuar se cuenta en una frase; y la
  lista de cuándo se habla incluye preguntar o avisar (lo irreversible que nadie pidió, lo que no cuadra) y contar
  recuerdos de uno en uno.
- **Archivos**: `file_list`, UN `map_hacer` con pasos que existen y `file_list` otra vez. Varios, de uno en uno y
  volviendo a la carpeta de origen tras cada «tecla: Ctrl+V» (el siguiente no está a la vista en el destino). En
  «pulsa:» el nombre va como se ve en la ventana, sin la extensión que Windows esconde: `CicloRapido.Buscar` compara
  el nombre entero, y «enero.pdf» no casa con «enero». Lo dice la descripción de `file_list`. El ejemplo crea
  «Facturas» y no «Fotos»: «carpeta: Fotos» abre **Imágenes** (`Explorador.PorNombre`). «seleccionar juntos:» y
  «entrar en:», que proponía el hallazgo, no son pasos: el ejecutor los mandaría a Jev como una frase.
- **Memoria**: «qué sabes de mí» → `memory_recall` o el hilo; «¿qué recuerdas de aquí?» → `map_recuerdos`; lo que se
  vio en una pantalla → `map_look_back`. `memory_remember` y `map_esto_es` no guardan datos de un paciente; si piden
  anotar uno, va donde el médico diga (la historia, una nota), y si no lo dijo, se le pregunta dónde, una vez.
- **`map_hacer.pasos`** nombra todos los pasos que leen las manos —«abre:», «pulsa:» (a la vista o no),
  «carpeta:», «escribe:», «tecla:», «desplaza:» con muescas y «esperar»— y ninguno más.
- **La memoria automática con un médico**: los dos vigilantes que guardaban por palabra clave («recuerda que…»,
  «tengo un…») no guardan nada con un médico. En consulta, «tengo un paciente de 54 años» es lo normal, y lo
  guardado vuelve en cada sesión siguiente. Lo que va a la memoria lo decide el modelo con `memory_remember`.
- **El bucle del agente**: una pregunta sin respuesta viaja como `(sin respuesta: la persona no contestó)`, el
  mismo comienzo que Graph pone cuando no llega nada; «¡Vamos!» pasa a «En marcha.» y «¡Listo! 🎉» a «Listo.»,
  porque al comprobar se oyen, y «Listo.» solo se narra si no hubo resumen. Las frases fijas dejan el tú, porque Speak
  sale por la voz viva y puede estar hablándole de usted a un médico: «El cerebro no respondió y tuve que parar.» y
  «No entendí qué hacer. ¿Cómo sería con otras palabras?».
- **El presupuesto (674)**: lo nuevo se pagó quitando lo que repetían las descripciones —el párrafo del decisor
  (1.071 → 619 caracteres, sin «Jev» ni «TypeSafe»), la viñeta de `sobre` de map_esto_es, la de map_pointing_at
  dentro de VARIAS COSAS, la de map_exclude— y «Se te mide por lo que dejas hecho», que empujaba a callar al final.
  En la revisión de la W3 se fueron también la alarma de «TOMO NOTA» y «no te asustes si la pantalla no cambia», que
  ya dicen `memory_remember` y `map_take`. Con la constitución de este día, las de siempre miden 17.547 (sin perfil) y
  19.831 (médico de Cardiología con el decisor). La 674 juzga el peor caso —un médico con una especialidad de 60
  caracteres, y el decisor—: 19.880 de 20.000, **120 de holgura**. Lo que crezca la constitución sale de ahí.

Pruebas de la W3, en Linux con `-p:EnableWindowsTargeting=true`: U.exe y los dos contratos compilan con 0 errores;
el contrato de la voz, entero en verde; el del grafo, 687-689 verdes (la 690 necesita WPF/UIA, como la 683) y ninguna promesa cambia de estado frente a la
rama antes de la W3 (las rojas son las de siempre: WPF/UIA no cargan en Linux); el arnés de la W2 (670-684 con el
`ConversacionEnVivo.cs` real) en verde, 671 y 674 incluidas, y con la 690 añadida, verde. Sabotajes: «seleccionar juntos:» y «Ctrl+Equis» en el
ejemplo de archivos → ✘ 687; «¡Listo! 🎉» de vuelta → ✘ 689; sin `_perfil.EsMedico` en cualquiera de los dos vigilantes → ✘ 690; el código de
antes → ✘ 687, 688 y 689.

## Lo que NO entra

- **La telemetría con el perfil** (`Telemetry.cs`, `RegisterPayload`): opcional, para que Provider
  Studio distinga médicos de personas. No cambia lo que Ü le dice a nadie.
- **Ocultar lo clínico a una persona** (el acceso directo «Miracle Consulta» y `SubirBtn`): es UI, y
  va en una rama propia cuando se decida.
- **Filtrar las plantillas por especialidad** en la ventana de consulta.
- **`GraphConfig` y `GRAPH_BASE_URL`**: si `graph.json` se guarda con la base del entorno, tiene el
  mismo defecto que tenía `U_BACKEND_URL`. No se tocó: no hay un `Save` de `GraphConfig` en el camino
  de arranque, pero merece su propia promesa.
- **`apps/windows/u/`**: su voz/Luna es copia vieja de «PARA ACTUAR, PLANEA», y es prototipo vivo de
  otro integrante (PR #131). No se toca, salvo la frase de peligro de `u/Nucleo/Jev.cs` (D6), que usa
  también U.exe.
- **`ElEncargoDeComprobar`** sigue pidiendo `map_esto_es`, que el catálogo de Graph no tiene: quitarla
  rompería la 139 y la 141, que la exigen. Se deja (decisión del diseño).
- **D5 entero**: que el hilo no viaje dos veces con GPT-Live (en las instrucciones y en el historial de la
  voz) espera a una sonda que diga si el delegado ve el historial de la voz. Hoy solo se recorta a 8.000.
- **Las otras cinco listas de «lo peligroso»** (`PuertasPeligrosas`, `SafeToClick`, el prompt,
  `ElEncargoDeComprobar`, `u/Nucleo/ProtocoloVivo`): no preguntan a TypeSafe y no se tocaron.
- **W3: «usa tu mejor criterio» en Android** (`apps/android/core/src/commonMain/kotlin/graph/core/application/Engine.kt`,
  con su «¡Vamos!» y su «¡Listo! 🎉»): es la misma clase de error, pero de otra carpeta y con su propia spec (la
  006 de Android cita la frase). Va en una rama de Android.
- **W3: la persona de la voz con un paciente delante** (`ConstitucionDeU.VozMedico`: «Con un paciente delante,
  solo lo que pida»): puede leerse como callar el aviso que pasa el delegado. Es de la constitución, que tiene sus
  dos copias; no se tocó desde aquí.
- **W3: el hilo durable con un médico** (`ConversacionPersonal`): guarda la conversación de la consulta y la
  devuelve en las instrucciones de la sesión siguiente. No es la memoria de la constitución, pero lleva lo mismo.
  Es una decisión de producto (qué se guarda de una consulta y cuánto dura); se anota para el dueño.
- **W3: los «✓»/«✗» que narra `WorkflowMcpRunner`**: al comprobar se oyen. No son emojis de dos unidades y no los
  juzga la 689.
- **W3: lo que el bucle narra y viene de Graph** (`resp.Narration`, `resp.Intents`, `resp.Speech`): al comprobar se
  oye, y si anuncia, lo arregla el prompt del cerebro en Graph. La 689 juzga solo las frases fijas del bucle.
  `$"En marcha: {goal}"` tampoco se oye en la práctica: al comprobar, el encargo pasa de 90 caracteres y se narra
  «En marcha.»; fuera de la comprobación, lo narrado solo se escribe en el notch.
- **W3: `SurfaceMapTools.Desbloquear` sigue vetando lo destructivo aunque se lo pidan** (y con él, el «Aceptar» de un
  diálogo informativo de una sola salida). No se tocó el veto: la salida para lo que sí se pidió es `map_take`, como en
  `map_hacer`, y la operación y la descripción de `choose` lo dicen.
- **Un médico que entra por la ventana de consulta con la carita abierta**: la carita no se entera
  hasta el próximo arranque (`EnsureOnboarded` usa una `SesionMiracle` propia que se descarta). Se
  acepta.

## Hallazgos

- 2026-10-01 · El modo viejo de `BackendClient` no solo era código muerto: rompía `dev-local.ps1`
  desde el 2026-09-20, porque trataba el Graph LOCAL como el backend viejo. Quitarlo lo arregla.
- 2026-10-01 · `U_BACKEND_URL` se colaba en disco por el `Save` de la posición de la carita: después
  de una sesión de `dev-local.ps1`, la Ü de todos los días quedaba apuntando a localhost.
- 2026-10-01 · Graph ignora `timezone`, `locale` y `clientNowUtc` del turno (solo los leía el backend
  viejo). Se dejan: la fase G2 de Graph los empieza a leer para «Ahora: …».
- 2026-10-01 · W2: el append del aprendiz mide 1.754 caracteres con `\n` y unos 1.777 con `\r\n`. El tope
  medido es 1.756: en un clon con autocrlf el aprendiz se rechazaba sin que nadie tocara el texto. Ahora
  la conversación iguala los saltos a `\n` antes de mandar un modo, y las de siempre también.
- 2026-10-01 · W2: «Se cortó un instante. Sigo, pero olvidé lo último que hablábamos.» era falso desde que
  la sesión nueva abre con la memoria y el hilo. Ahora: «Se cortó un instante; ya volví.».

## Cierre

- [ ] Todas las promesas verdes (`.\scripts\contrato-del-grafo.ps1` → CONTRATO INTACTO) — **sin
      correr: la fase se escribió en una sesión Linux sin dotnet; la juzga `windows-contrato.yml`**
- [ ] `.\scripts\verificar.ps1` pasa, con evidencia en `out\evidencia.md`
- [ ] Probado en ≥2 pantallas, con nombre: la bienvenida en equipo nuevo, en equipo con correo, y
      desde el menú; un médico con sesión Miracle (sin pregunta, fila del menú «de tu cuenta Miracle»)
- [ ] Estado de este documento: **implementado** (AAAA-MM-DD)

### Fase W4 — dos fallos de la revisión del código

| | |
|---|---|
| **Promesas que pone verdes** | 692-693 |
| **Qué toca** | `Ui/FaceWindow.xaml.cs` (`EnsureOnboarded`), `Voice/ConversacionEnVivo.cs` (`EmpiezaUnaConexion`) |
| **¿Núcleo congelado?** | no |
| **Terminado** | 692-693 verdes y rojas contra el código de antes (corrida en Linux del 2026-10-01: 106 rojas → 104, las mismas 104 de siempre sin WPF ni UIA) |
| **Sitios con esta clase de error** | **1** copia de la especialidad de la cuenta a `config.json` (`EnsureOnboarded`); **1** sitio que crea la espera de la apertura (`EmpiezaUnaConexion`), del que cuelgan **3** que la esperan (`VolverAlModoNormalAsync`, `CambiarModoAsync`, `HablarConVozVivaAsync`) |

- **La especialidad es de la cuenta, no del equipo.** `EnsureOnboarded` copiaba la especialidad de la cuenta a
  `config.json` al poner el perfil médico. En un PC de hospital, la Dra. A (Cardiología) entraba y salía, y al
  Dr. B —sin especialidad en su cuenta— el delegado le decía «especialista en Cardiología», porque `Resolver` usa
  la guardada como respaldo. Ahora solo se guarda el perfil; la especialidad del médico viaja en su sesión (654).
- **Una reconexión no deja esperas huérfanas.** Si una conexión moría antes de `session.started` sin mandar error
  y se reconectaba, la espera de la anterior no la resolvía nadie: volver de un modo se rendía a los 15 s y el
  aprendiz quedaba puesto al terminar de enseñar. Ahora la conexión nueva hereda la espera pendiente.
- **Nivel 4:** en un PC con Windows, entrar con una cuenta con especialidad, salir, entrar con otra sin ella y
  mirar en el log `onboarding`/el bloque del delegado que no dice la especialidad de la primera.
