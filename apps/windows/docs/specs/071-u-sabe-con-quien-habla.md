# Plan de implementación: Ü sabe con quién habla

Estado: **fases W1 y W2 escritas, sin compilar** (2026-10-01) · Nace del pedido del dueño del 2026-10-01 · Rama: `claude/wizardly-brown-ld68hq`

> Esta spec cubre la mitad Windows del diseño «los prompts de Ü, ordenados». La otra mitad vive en
> Graph (`services/graph`), en el mismo PR. **W1** (perfil, bienvenida, cable) usa las promesas
> **650-669** del contrato del grafo; **W2** (la voz: la constitución en `Instrucciones`, la persona de
> GPT-Live, el saludo, los defectos D1-D10 del mapa de la voz) usa las **670-686** del grafo y las
> **56-59** del contrato de la voz.

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
| 687-689 | libres dentro de W2: no se usaron. No se reciclan para otra cosa sin decirlo aquí | — |
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
  Medían 25.096 caracteres; ahora 15.818, y con un médico y el decisor, 17.887.
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
