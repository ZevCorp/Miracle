# Ü sabe con quién habla, también en Android

Estado: **implementada en el núcleo y en la app; falta la corrida en el teléfono** (2026-10-01; 1001-1009 y la 7
enmendada vistas ROJAS contra el código de antes —1001-1004, 1006, 1009 y 7 pendientes, 1005, 1007 y 1008 rotas— y verdes
después: `CONTRATO INTACTO: 191 promesas`, de 182. Tras la revisión del mismo día, 1010 nueva y 1007, 1008 y 1009
ajustadas, vistas rojas y verdes después: `CONTRATO INTACTO: 192 promesas`. Cada una se vio roja otra vez con un
sabotaje, ver «Lo que se midió»)
· Nace del pedido del dueño del 2026-10-01 («Aplica lo que hiciste acá a Mac y
Android») · Rama: `claude/wizardly-brown-ld68hq`, la misma que puso la constitución en Graph, en Windows (spec 078 de
Windows) y en el cerebro local de Android (spec 009).

Desde el PR #157 Ü tiene **una sola constitución** con dos perfiles —un médico, con su especialidad, o una persona que
la usa en su día a día— y Graph acepta el perfil en el primer turno de `POST /api/v1/agent/turn`
(`profile: {kind, specialty, specialtyName}`, normalizado contra su catálogo en `services/graph/src/domain/agent/profile.js`).
Windows ya pregunta en su bienvenida y lo manda. Android no pregunta nada: le habla a todo el mundo igual, Graph no se
entera de con quién habla, y varios prompts propios de la app se presentan con otra Ü que la de la constitución.

---

## Diagnóstico: medido en el código, no supuesto

| Qué | Medida | Dónde |
|---|---|---|
| Qué pregunta la bienvenida | solo el nombre («Hola, soy Ü 👋» · «¿Cómo te llamas?») | `MainActivity.askUserName` (`MainActivity.kt:94`) |
| Qué sabe Android de la especialidad | nada: no hay catálogo ni clave guardada (`grep -ri especialidad app/src core/src` da 0) | — |
| Qué lleva el turno a Graph sobre la persona | nada: `TurnRequest` tiene seis campos, y la promesa 7 de la spec 001 los fija | `TurnProtocol.kt` · `Contrato001CerebroEnGraph.kt:352` |
| El prompt del cerebro local | sin «QUIÉN TE HABLA», a propósito: «Android todavía no pregunta» | `PromptDelCerebroLocal.kt` · spec 009, «Lo que NO entra» |
| Cuándo se manda el prompt local | una vez, en el primer mensaje del hilo; la app reanuda el hilo (`conversationId`) en cada corrida | `GraphApp.kt:374,416` |
| Prompts de la app que hablan con la persona en nombre de Ü | 4, cada uno con su propia Ü: «Eres Ü. Acabas de completar…» (`Anticipation.kt:45`), «Eres Ü, un asistente que OBSERVA…» (`LearningInquiry.kt:72`), «Eres Ü, un asistente con voz propia…» con «Chicos, antes de terminar…» (`MeetingBrain.kt:40,68`), «Eres Ü, un asistente que controla el teléfono…» con un resumen «en tono cálido» (`GeminiVideo.kt:129`). Ninguno trae quién es Ü de la constitución ni sabe si le habla a un médico | `app/…/platform` · `app/…/voice` |
| Prompts que se presentan con otro nombre | 2: «Eres Graph, un asistente que controla el teléfono…» y «Eres Graph, un asistente en APRENDIZAJE CONTINUO…» | `GeminiWorkflow.kt:66,145` |
| La memoria automática y un médico | `MemoryDistiller.capture` corre con cada pedido, `captureAnswer` con cada respuesta a una pregunta del aprendizaje pasivo, `ActiveLearning.distill` con cada respuesta del aprendizaje activo, y las notas de `GeminiVideo` van directo a `MemoryStore` con el criterio «con los nombres y datos CONCRETOS». Todos guardan lo que les parezca durable. Con un médico, «tengo un paciente de 54 años…» puede quedar en la memoria, y la constitución dice «Los datos de un paciente no van a tu memoria» | `MemoryDistiller.kt:22,52` · `ActiveLearning.kt:123` · `GeminiVideo.kt:133` · `GraphApp.kt:265,511,529` |
| La reunión y un médico | `MeetingBrain` interviene al cierre («toma la palabra») y lanza tareas sin que se las pidan; el bloque del médico dice que con un paciente delante habla solo si le hablan | `MeetingBrain.kt:40,68` |
| Prompts internos que no hablan con la persona | 3: `GeminiLearning` (`:74`), `GeminiClickDoctor` (`:35`) e `IntentDistiller` (`:25`). Se presentan como «Eres Ü» o «de Ü» y no dicen nada que la constitución prohíba | — |

---

## Qué cambia

1. **En el núcleo, Kotlin puro** (`core/…/domain/`):
   - `Especialidades`: el catálogo de Graph (`services/graph/src/domain/clinical/specialtyNames.js`), los 49 códigos en
     snake_case y sus nombres, en su orden, y la normalización de Graph (sin tildes, sin mayúsculas, lo que no es letra ni
     número pasa a `_`). Un código de Windows («medicina-general», el kebab-case del portal) se encuentra igual.
   - `PerfilDeUso`: el tipo (`medico` · `persona` · sin elegir), la especialidad del catálogo, el bloque «QUIÉN TE HABLA»
     de la constitución con `{ESPECIALIDAD}` sustituido, lo que se guarda y qué bienvenida toca.
   - `PromptsDeU.cabecera(perfil)`: quién es Ü (`ConstitucionDeU.QUIEN`) y, si se eligió, el bloque del perfil. Es el
     comienzo de todo prompt de la app que le habla a la persona en nombre de Ü.
2. **En el cable**: `TurnRequest.profile` (`{kind, specialty, specialtyName}`) en el primer turno de cada corrida, y
   solo si se eligió. Sin elegir, la petición es byte a byte la de antes. **Enmienda la promesa 7 de la spec 001** (ver
   abajo).
3. **El cerebro local**: `PromptDelCerebroLocal.goalPrompt` recibe el perfil y pone su bloque después de QUIEN, como
   Graph (`conscious-brain/prompt.js`). Sin perfil, el prompt de siempre.
4. **La app**, fina, con la lógica en el núcleo:
   - la bienvenida, después del nombre, pregunta «Trabajo en salud» o «Uso personal»; si es salud, la especialidad sale
     de la lista del catálogo, con «Sin especialidad»;
   - se guarda en las preferencias `graph` con las claves `perfil`, `especialidad` y `especialidadNombre`;
   - se pregunta una vez: la rama «solo el perfil» corre solo si `savedInstanceState == null`, porque girar el teléfono,
     cambiar el tema o el modo recrean la Activity y eso no es abrir la app; en la bienvenida, un toque fuera no cierra la
     pregunta (el botón Atrás sí);
   - se cambia en «Cómo me usas», dentro de los ajustes de Voz de la portada (el único sitio de ajustes de la persona); la
     lista de especialidades marca la que ya estaba elegida, y su «Atrás» vuelve a la pregunta del perfil;
   - al cambiarlo se olvida el `conversationId`: el siguiente turno es primero y lleva el perfil nuevo, también en el
     cerebro local, que solo manda su prompt al abrir el hilo. El hilo guardado recuerda con qué perfil se abrió
     (`perfilDelHiloGuardado`) y `newSession` solo lo reanuda si sigue siendo ese: `run()` puede correr en otro hilo que
     la pantalla, y un cambio entre la comprobación y el guardado re-guardaba el hilo viejo.
5. **Los prompts de la app que hablan con la persona** (`Anticipation`, `LearningInquiry`, `MeetingBrain`,
   `GeminiVideo`) empiezan con `PromptsDeU.cabecera(perfil)` en vez de su propio «Eres Ü…», y su primera frase pasa a
   decir el papel de ese momento («AHORA OBSERVAS…», «AHORA PARTICIPAS EN VIVO…»). Lo demás de cada uno —su trabajo, su
   criterio, su JSON— queda igual, con dos añadidos de tono: una línea que dice que lo que va en `question`, `say` o
   `summary` lo oye la persona y va como dicen las reglas de arriba (de usted si el perfil lo dice; los ejemplos van de
   tú), y el ejemplo «Chicos, antes de terminar…» pasa a «Antes de terminar…». `GeminiWorkflow` se presenta como Ü y no
   como Graph.
6. **La memoria automática y la reunión, con un médico** (promesa 1010):
   - los tres destiladores de texto (`MemoryDistiller.capture`, `MemoryDistiller.captureAnswer` y
     `ActiveLearning.distill`) arman su prompt con `PromptsDeU.paraLaMemoria`: su papel, el bloque del perfil, la frase
     «Lo que dice QUIÉN TE HABLA sobre la memoria manda sobre el criterio de abajo.» y su criterio. Sin perfil, el prompt
     de antes;
   - `GeminiVideo`, cuyas notas van a la memoria, pone esa misma frase detrás de la cabecera cuando hay perfil, y lee el
     perfil una sola vez;
   - `MeetingBrain`, con un médico, dice antes de «Responde SOLO JSON»: «Si hay un paciente delante, manda QUIÉN TE
     HABLA: sin intervención de cierre ni tareas que no te pidan.». Sin médico, el prompt de antes.

### Lo que se decidió sin preguntar (el dueño pidió decidir lo razonable)

- **Los códigos son los de Graph, en snake_case**, no los de Windows (kebab-case, del portal): Graph normaliza los dos,
  y el catálogo que manda es el suyo. Se copia y no se lee: la regla 3 del monorepo prohíbe leer archivos de otro
  proyecto.
- **Lo que no está en el catálogo no es una especialidad.** Windows deja escribir una a mano; Graph la descarta al
  llegar. En Android el nombre va al prompt local tal cual, y un texto libre en un prompt del sistema es una entrada para
  inyectar órdenes: la especialidad se elige de la lista, y una guardada que no está en el catálogo se lee como «sin
  especialidad».
- **La bienvenida no bloquea en el perfil.** El nombre sigue siendo obligatorio (como antes); el perfil se puede cerrar
  sin elegir, y entonces Ü es la de antes y se vuelve a preguntar al abrir la app otra vez, como en Windows.
- **El perfil de un médico no viene de su cuenta.** Android no lee `profiles` de Supabase (Windows sí, promesa 700);
  aquí manda lo elegido en el teléfono.

---

## La especificación

Esta spec numera sus promesas **desde 1001** (ver `docs/como-trabajamos.md`).

| Archivo | Promesas |
|---|---|
| `core/src/commonTest/kotlin/graph/core/contrato/Contrato010PerfilDeUso.kt` (núcleo puro y `GraphBrain` con el transporte guionado de la 001) | 1001, 1002, 1003, 1004, 1005, 1006 |
| `core/src/jvmTest/kotlin/graph/core/contrato/Contrato010PerfilEnLaApp.kt` (lee las fuentes de `app`, mismo criterio que 905 y 908-911: `app` es Android y no corre en `jvmTest`) | 1007, 1008, 1009, 1010 |

| # | Promesa |
|---|---|
| 1001 | El catálogo de especialidades del núcleo es el de Graph: las 49, con sus códigos en snake_case y sus nombres, en su orden; una especialidad se encuentra por su código o por su nombre sin importar mayúsculas, tildes ni guiones, y lo que no está en el catálogo no es una especialidad. |
| 1002 | Con quién habla Ü se lee de lo guardado: «Médico», «médica » y «MEDICO» son médico y «Persona» es persona; lo que nunca se eligió, o un valor que no se conoce, es «sin elegir» y no un perfil por defecto; una persona no lleva especialidad aunque quede una guardada; y la especialidad del médico, código y nombre, sale del catálogo: un texto que no está en él lo deja sin especialidad y nunca llega tal cual. |
| 1003 | El bloque «QUIÉN TE HABLA» sale de la constitución: el del médico lleva «, especialista en <Nombre>» con el nombre del catálogo, o nada si no tiene especialidad; el de la persona es el de la constitución tal cual; y sin elegir no hay bloque. |
| 1004 | El prompt del cerebro local, el de OpenAI y el de Gemini, lleva el bloque del perfil justo después de quién es Ü y antes de «EN ESTE TURNO», una sola vez y con lo demás igual que sin perfil; sin elegir, no lleva bloque y es el prompt de siempre. |
| 1005 | El primer turno de cada corrida en Graph lleva el perfil elegido en `profile`, con el tipo y el código y el nombre del catálogo; los turnos siguientes no lo repiten; y sin elegir el campo no viaja y la petición es byte a byte la de antes. |
| 1006 | La bienvenida pregunta el perfil una vez: sin nombre, entera (el nombre y después el perfil); con nombre y sin perfil, solo el perfil; con el perfil elegido, nada. Lo que se guarda —el tipo, el código y el nombre de la especialidad, en las claves `perfil`, `especialidad` y `especialidadNombre`— vuelve igual al leerlo. |
| 1007 | La app pregunta el perfil con lo del núcleo: después del nombre, la bienvenida ofrece «Trabajo en salud» y «Uso personal», y para salud la lista de especialidades del catálogo con «Sin especialidad»; se puede cambiar en «Cómo me usas»; y se guarda en las preferencias `graph` con las claves del núcleo. |
| 1008 | Los tres cerebros de la app hablan con quien se eligió: Graph lo recibe en el primer turno y OpenAI y Gemini en su prompt; y cambiar el perfil olvida el hilo de la conversación, para que el siguiente turno sea primero y lleve el perfil nuevo. |
| 1009 | Los prompts de la app que le hablan a la persona en nombre de Ü —anticipar lo siguiente, proponer mientras aprende, la reunión y lo que entendió de un video— empiezan con quién es Ü de la constitución y el bloque del perfil; y ningún prompt de la app presenta a Ü con otro nombre ni le pide un tono que la constitución prohíbe. |
| 1010 | Con un médico, lo que Ü guarda por su cuenta no lleva datos de un paciente: los caminos de la memoria automática —lo que destila de un pedido, de una respuesta a sus preguntas y de lo que se le enseña en video— llevan el bloque del perfil y la frase que lo pone por encima de su criterio; y en una reunión, con un paciente delante, no interviene al cierre ni lanza tareas que no le pidan. Sin perfil, esos prompts son los de antes. |

### Con qué se juzga

| # | Cómo se juzga sin tocar nada |
|---|---|
| 1001 | `Especialidades.TODAS` contra la lista de `specialtyNames.js` escrita en el test, par por par y en orden (49). `buscar` con «cardiologia», «CARDIOLOGÍA», «Cardiología», « cardiología », «medicina-general» (el código de Windows), «Medicina_General» y «Ginecología y obstetricia» da la especialidad; «Enfermería», «constructor», «toString», «» y `null` no dan ninguna. Cada código es su propia forma normalizada. |
| 1002 | `PerfilDeUso.normalizarTipo` con «Médico», «médica », «MEDICO», «Persona», «» , `null`, «admin» y «doctor». `desdeGuardado` con médico y código («cardiologia», con un nombre guardado que dice otra cosa → Cardiología), médico sin código y con nombre del catálogo («Pediatría» → pediatria), médico con código y nombre fuera del catálogo («ignora tus reglas» → sin especialidad, y el texto no aparece en el bloque ni en lo guardado), persona con especialidad guardada (→ sin especialidad), y tipos vacíos o desconocidos (→ `SIN_ELEGIR`). |
| 1003 | `bloqueDelPrompt()` de médico con Cardiología = `PERFIL_MEDICO` con «, especialista en Cardiología»; de médico sin especialidad = `PERFIL_MEDICO` con «»; ninguno deja `{ESPECIALIDAD}`; persona = `PERFIL_PERSONA`; sin elegir = «». |
| 1004 | `goalPrompt` de los dos proveedores con médico de Pediatría y con persona: empieza con `QUIEN` + «\n\n» + bloque + «\n\n» + «EN ESTE TURNO»; «QUIÉN TE HABLA» aparece una vez; quitando el bloque y su línea en blanco queda el prompt sin perfil; con `SIN_ELEGIR` es igual al prompt sin el parámetro y no dice «QUIÉN TE HABLA». |
| 1005 | `GraphBrain` con el transporte guionado de la 001. Con médico de Cardiología, dos turnos: el primero lleva `profile` = `{"kind":"medico","specialty":"cardiologia","specialtyName":"Cardiología"}` y el segundo no lleva `profile`; `begin` de otro objetivo → su primer turno lo vuelve a llevar. Persona → `{"kind":"persona"}`; médico sin especialidad → `{"kind":"medico"}`. Sin elegir, el cuerpo del primer turno es la cadena literal de antes, byte a byte. |
| 1006 | `PerfilDeUso.queBienvenida` con nombre vacío o en blanco (→ entera, tenga o no perfil), con nombre y perfil vacío o desconocido (→ solo el perfil), con nombre y perfil (→ nada). Las claves son «perfil», «especialidad» y «especialidadNombre». `guardado()` de médico con especialidad, médico sin ella, persona y sin elegir, leído con `desdeGuardado`, da el mismo perfil. |
| 1007 | Lee `MainActivity.kt`: dice «Trabajo en salud», «Uso personal», «Sin especialidad» y «Cómo me usas»; usa `PerfilDeUso.queBienvenida(` y `Especialidades.TODAS`; `askUserName` sigue con la pregunta del perfil, y en `onCreate` la rama SOLO_PERFIL pregunta solo si `savedInstanceState == null` (girar el teléfono, el tema o el modo recrean la Activity). Lee `GraphApp.kt`: las preferencias son `getSharedPreferences("graph"`, el perfil se lee con `PerfilDeUso.desdeGuardado(` y las claves `PerfilDeUso.CLAVE_…`, y se guarda con `guardado()`. Ninguna fuente de la app escribe las claves a mano. |
| 1008 | Lee `GraphApp.kt`: en `newBrain`, `OpenAiBrain(`, `GeminiBrain(` y `GraphBrain(` reciben el perfil; la función que cambia el perfil pone `conversationId = ""`; `run` anota `perfilDelHiloGuardado = perfilDelHilo` al guardar el hilo, y `newSession` reanuda solo si `resume && perfilDelHiloGuardado == cambiosDePerfil` (`run` puede correr en otro hilo que la pantalla). Lee `OpenAiBrain.kt` y `GeminiBrain.kt`: su `goalPrompt(` lleva el perfil. |
| 1009 | `PromptsDeU.cabecera(SIN_ELEGIR)` = `QUIEN`; con un perfil = `QUIEN` + «\n\n» + su bloque. Lee `Anticipation.kt`, `LearningInquiry.kt`, `MeetingBrain.kt` y `GeminiVideo.kt`: usan `PromptsDeU.cabecera(` y no se presentan por su cuenta («Eres Ü,» / «Eres Ü.»). En toda la app, fuera de comentarios: ni «Eres Graph», ni «viva y divertida», «con chispa», «¡Claro!», «Chicos,», ni voseo («querés», «podés», «tenés», «decime», «contame»); y en los diez archivos con prompts propios (esos cuatro, `MemoryDistiller`, `ActiveLearning`, `GeminiWorkflow`, `GeminiLearning`, `GeminiClickDoctor` e `IntentDistiller`), ningún emoji fuera del log. `GeminiWorkflow.kt` dice «Eres Ü». |
| 1010 | `PromptsDeU.paraLaMemoria(perfil, papel, criterio)`: sin perfil, `papel` + «\n\n» + `criterio` (el prompt de antes); con médico de Cardiología, médico sin especialidad y persona, `papel`, el bloque, `PRECEDENCIA_DE_LA_MEMORIA` («Lo que dice QUIÉN TE HABLA sobre la memoria manda sobre el criterio de abajo.») y `criterio`, separados por líneas en blanco; con un médico trae «Los datos de un paciente no van a tu memoria». Lee las fuentes: `MemoryDistiller.capture`, `MemoryDistiller.captureAnswer` y `ActiveLearning.distill` usan `PromptsDeU.paraLaMemoria(`; `GeminiVideo.generate` usa `PromptsDeU.PRECEDENCIA_DE_LA_MEMORIA` y lee `perfil()` una sola vez; `MeetingBrain` dice «Si hay un paciente delante, manda QUIÉN TE HABLA: sin intervención de cierre ni tareas que no te pidan.» y `consider` lo condiciona a `.esMedico`. |

---

## La enmienda a la promesa 7 de la spec 001

La 7 decía «el request solo tiene session, goal, userId, state, results e inform», y su test fijaba ese conjunto. El
perfil es un campo nuevo del request, así que la 7 se enmienda **el 2026-10-01**, en la spec 001 y en su test a la vez,
con lo mínimo:

- el campo nuevo es **opcional**: sin perfil elegido no viaja (la 1005 juzga que la petición es byte a byte la de antes);
- es **solo del primer turno**: los siguientes no lo llevan;
- dentro de `profile` solo van `kind`, `specialty` y `specialtyName`, y no es prompt: Graph no usa `specialtyName` como
  texto, solo lo busca en su catálogo (`profile.js`).

Lo que la 7 protege —que el cliente no mande modelo, prompt ni catálogo de herramientas— no cambia. La conversación
queda escrita en la spec 001, junto a la promesa.

---

## Lo que se midió

- **El contrato antes del código** (núcleo con esqueletos `TODO()`, app sin tocar): `CONTRATO ROTO: 10 promesa(s)
  incumplida(s)`. Pendientes 7, 1001-1004, 1006 y 1009; rotas 1005 (el primer turno no llevaba `profile`), 1007 y 1008
  (la app no preguntaba ni pasaba el perfil). La parte «sin elegir» de la 1005 ya pasaba contra el código de antes: el
  cuerpo literal del test es el que mandaba Android, byte a byte.
- **Después**: `CONTRATO INTACTO: 191 promesas.` (182 de antes + 9 nuevas). `tools/monorepo/constitucion.sh`: la
  constitución sigue diciendo lo mismo en las tres copias.
- **Los sabotajes**, uno por corrida del juez, cada uno comprobado con un `diff` antes de juzgar:

  | Sabotaje | Qué salió rojo |
  |---|---|
  | `profile` en todos los turnos, no solo en el primero (`GraphBrain`) | 7 y 1005 |
  | una especialidad fuera del catálogo vale con el texto escrito (`Especialidades.buscar`) | 1001, 1002, 1003 y 1005 |
  | el bloque del perfil después de «EN ESTE TURNO» (`PromptDelCerebroLocal`) | 1004 |
  | el bloque del médico sin «, especialista en …» (`PerfilDeUso.bloqueDelPrompt`) | 1003 |
  | la bienvenida no pregunta el perfil a quien ya tenía nombre (`queBienvenida`) | 1006 |
  | después del nombre no viene el perfil (`askUserName`) | 1007 |
  | `OpenAiBrain` sin el perfil (`GraphApp.newBrain`) | 1008 |
  | cambiar el perfil no olvida el hilo (`GraphApp.cambiaElPerfil`) | 1008 |
  | `Anticipation` vuelve a su «Eres Ü.» sin la cabecera | 1009 |

- **La revisión del 2026-10-01** encontró cinco cosas y se arreglaron con sus promesas primero. Con las pruebas nuevas y
  sin el código: `CONTRATO ROTO: 3 promesa(s) incumplida(s)` (1007: la pregunta volvía al recrear la Activity; 1008: el
  hilo guardado no recordaba su perfil; 1010: nada llevaba la frase ni la regla de la reunión). Después:
  `CONTRATO INTACTO: 192 promesas.` Sabotajes de esa ronda:

  | Sabotaje | Qué salió rojo |
  |---|---|
  | la rama SOLO_PERFIL sin `savedInstanceState == null` (`MainActivity.onCreate`) | 1007 |
  | `newSession` reanuda sin mirar con qué perfil se abrió el hilo | 1008 |
  | `paraLaMemoria` sin la frase de precedencia | 1010 |
  | `ActiveLearning.distill` sin `paraLaMemoria` | 1010 |
  | la línea del paciente en la reunión sin la condición `esMedico` | 1010 |

- **Dónde corrió**: en la sesión que escribió esta spec, Gradle no alcanzaba `dl.google.com` (el proxy rechaza el
  CONNECT con 403), así que no hay plugin de Android (AGP 8.5.2) ni SDK. El juez de verdad (`scripts/contrato.sh`, sin
  cambios) corrió sobre una copia de `apps/android` cuyo `settings.gradle.kts` solo incluye `:core`, con Gradle en
  `--offline` contra la caché. **`:app` no se compiló.** Lo que sí: los trece archivos de `app` que no son UI y tocan o
  sostienen lo de esta spec (`OpenAiBrain`, `GeminiBrain`, `Anticipation`, `LearningInquiry`, `MeetingBrain`,
  `GeminiVideo`, `MemoryDistiller`, `ActiveLearning`, `GeminiWorkflow`, `GeminiJson`, `GeminiHttp`, `LogBus`,
  `MemoryStore`) compilaron contra el núcleo nuevo, con stubs de `android.util.Log`, `android.util.Base64`,
  `android.graphics.BitmapFactory`, `android.os.SystemClock`, `android.content.Intent`, `Telemetry` y de lo que
  `ActiveLearning` usa de `GraphApp`. `GraphApp.kt` y `MainActivity.kt` se revisaron a mano; los compila
  `android-apk.yml`.

---

## Lo que NO entra

- **El perfil en la enseñanza** (`/teach/process-video` en `core/…/graph/learning/Protocol.kt`): Graph lo acepta y
  Windows lo manda (su promesa 706). En Android la enseñanza por video pasa por `GeminiVideo`, que ahora lleva el
  perfil en su prompt; el camino por Graph va en una rama propia.
- **La voz en vivo** (`PersonaDeLaVoz`, GPT-Live): tiene su tope de caracteres medido (spec 002) y su propia persona
  corta; Windows le suma una frase por perfil (`VozMedico`/`VozPersona`) que la copia de Android de la constitución no
  tiene. Va con la voz, no aquí.
- **La sangría en los prompts de la app.** `LearningInquiry`, `Anticipation`, `MeetingBrain`, `MemoryDistiller` y
  `ActiveLearning` interpolan textos de varias líneas (la memoria, el resumen, la transcripción, la respuesta dictada)
  dentro de un `"""…""".trimIndent()`, y
  entonces no se quita la sangría del código fuente (el mismo defecto que la spec 009 arregló en el cerebro local). La
  cabecera va fuera de esa raw string y llega limpia; el resto no se tocó, porque la regla de esta spec es cambiar la
  persona y el tono, no la función.
- **Los prompts internos** (`GeminiLearning`, `GeminiClickDoctor`, `IntentDistiller`):
  no le hablan a la persona, no la contradicen y no llevan la cabecera; en ellos sobraría.
- **El perfil desde la cuenta Miracle**: Android no lee `profiles` de Supabase.
- **El nombre de la persona en la bienvenida de la burbuja** (`GraphApp.run` pregunta el nombre si nadie abrió la app):
  sigue preguntando solo el nombre. El perfil se pregunta al abrir la app.
- **Comprobar a máquina que el catálogo sigue a `specialtyNames.js`**: el test lleva la lista escrita; si Graph añade
  una especialidad, se añade aquí y en el test, a mano.
- **La corrida a mano** (nivel 4): con el APK en el teléfono, en dos apps. Lo que hay que mirar: la bienvenida en una
  instalación nueva (nombre y después «¿Para qué me vas a usar?»), en una que ya tenía nombre (solo el perfil), y
  «Cómo me usas» en Voz; con el proveedor Graph, el log `[graph] turno 1` y, del lado de Graph, que la sesión trae el
  perfil; con OpenAI o Gemini, que tras cambiar el perfil el log dice `[perfil] … el próximo pedido abre un hilo nuevo`
  y el siguiente pedido le habla de usted a un médico.
