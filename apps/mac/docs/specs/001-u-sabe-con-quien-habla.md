# 001 — Ü sabe con quién habla, y el Mac habla con la constitución

Estado: **escrito; sin compilar ni juzgar en macOS** (2026-10-01) · Nace del pedido del dueño del
2026-10-01 («aplica lo que hiciste acá a Mac y Android») · Rama: `claude/wizardly-brown-ld68hq`

Es la mitad Mac del diseño «una sola Ü», que entró a `main` en el PR #157. La de Graph es su spec 005
(`services/graph/docs/specs/005-una-sola-u.md`); la de Windows, su spec 078
(`apps/windows/docs/specs/078-u-sabe-con-quien-habla.md`); la de Android, su spec 010
(`apps/android/docs/specs/010-u-sabe-con-quien-habla.md`), en la misma rama. El mapa de todos los prompts está en `docs/monorepo/prompts-de-u.md`.

Lo que pidió el dueño, para el Mac: que Ü pregunte al empezar si quien lo usa trabaja en salud (médico, con
su especialidad) o lo usa para su día a día; que eso viaje a Graph; y que los prompts locales del Mac digan
lo mismo que la constitución.

**Escrita en una sesión Linux sin compilador de Swift**, por pedido expreso del dueño (la guía del Mac dice
que desde Linux no se tocan `Sources/` ni `Tests/`). Nada de esto se compiló ni se vio en rojo aquí: lo
juzga el CI de macOS (`mac-build.yml`, llamado por la compuerta del PR). Ver «Lo que se probó» y «El rojo y
el sabotaje, pendientes».

## Diagnóstico: qué se midió

Medido el 2026-10-01 leyendo el código de esta rama antes del cambio (`HEAD`).

| Qué | Medida | Fuente |
|---|---|---|
| Qué pregunta el Mac al empezar | nada sobre quién lo usa: solo abre Configuración si falta Accesibilidad | `Sources/UApp/AppMain.swift` (`applicationDidFinishLaunching`) |
| Qué lleva el turno a Graph sobre la persona | nada: `TurnRequest` lleva `session`, `goal`, `userId`, `state`, `results`, `inform` y `userContext` | `Sources/UCore/Protocol.swift` |
| Dónde vive la conversación con Graph | la sesión opaca vive dentro de `AgentEngine.run`: una por tarea, y no se guarda entre tareas. El Mac no tiene `conversationId` | `Sources/UCore/AgentEngine.swift`, `Sources/UApp/AppModel.swift` (`submit`) |
| Quién es Ü para los modelos del Mac | **2** sitios arman instrucciones con identidad (la voz de Live 1 y Luna, los dos por `liveInstructions`). La voz decía «Eres Ü, también llamado You o Yu…», un texto propio; Luna no tenía identidad. Ninguno llevaba la constitución | `Sources/UCore/LiveProtocol.swift` |
| Lo que contradecía a la constitución | **1** «Sé cálida» (la constitución: «cálido»); **2** «vuestra conversación» (nunca vosotros); **1** «si la petición es ambigua, haz una sola pregunta» (OBEDECE: lo que falta del cómo lo elige Ü); «Explica con sencillez y ejemplos concretos» para todos (al médico no se le explica su vocabulario) | `AssistantContext.principles`, `LiveProtocol.start` |
| Qué hace Graph con el `userContext` del Mac | lo ignora a propósito | `services/graph/src/application/use-cases/AgentTurnService.js:41` |
| Tamaño de las instrucciones, sin preferencia del usuario | voz 4.716 caracteres, Luna 3.040 | reconstruidas de las fuentes con Python |
| Otros textos para un modelo | las 3 preguntas de Jev a TypeSafe (clasifican, no hablan), las 14 descripciones de `LiveTools` y la sonda de `VoiceProbe` («Call health_check exactly once…») | `JevClient.swift`, `LiveTools.swift`, `VoiceProbe.swift` |

## Promesas

El enunciado de cada promesa va literal en el comentario `/// NNN · …` que precede a su función, en
`Tests/UCoreTests/PerfilTests.swift`.

| # | Promesa | Juez |
|---|---|---|
| 101 | el perfil es lo que se eligió, en su forma canónica: «Médico», «médica » y «MEDICO» son médico y «Persona» es persona; cualquier otra cosa —también un valor que esta versión no conoce— es «sin elegir», no un perfil por defecto, y una persona va sin especialidad aunque se le pase una | `testPerfilDeUsoSeNormalizaYSinElegirEsLoDeAntes` |
| 102 | las especialidades son las del catálogo de Graph, en su orden, con sus códigos y sus nombres; se encuentran por código o por nombre sin mayúsculas ni tildes, y lo que no está en el catálogo no es una especialidad: el médico queda sin ella | `testEspecialidadesSonLasDelCatalogoDeGraph` |
| 103 | el primer turno de /api/v1/agent/turn lleva el perfil —profile {kind, specialty, specialtyName}—, los siguientes no lo repiten, una tarea nueva nace sin sesión y con el perfil de ese momento, y sin perfil el campo no viaja: el cuerpo es el de antes | `testElPerfilViajaSoloEnElPrimerTurno` |
| 104 | la constitución del Mac tiene los cuatro textos de Graph en su forma: quién es Ü, obedecer, el perfil del médico y el de la persona, con sus viñetas sangradas, sin nada que interpolar salvo {ESPECIALIDAD}, y con la versión de Graph | `testLaConstitucionEsLaDeGraph` |
| 105 | el bloque «QUIÉN TE HABLA» sale de la constitución: el del médico lleva su especialidad del catálogo («, especialista en Cardiología») o nada, el de la persona no trae vocabulario clínico, un nombre que no sale del catálogo no llega al prompt, y sin perfil es vacío | `testElBloqueDelPerfilSaleDeLaConstitucion` |
| 106 | la voz en vivo y Luna empiezan por la constitución: quién es Ü, el bloque «QUIÉN TE HABLA» si hay perfil y obedecer, una sola vez cada uno y en ese orden; sin perfil no hay «QUIÉN TE HABLA»; y lo propio del Mac sigue detrás: sus políticas de la voz, sus criterios y la preferencia que escribió el usuario; a Graph no se le manda otra vez, porque tiene la suya | `testLaVozYLunaEmpiezanPorLaConstitucion` |
| 107 | los criterios propios del Mac no contradicen a la constitución: Ü no es «cálida», nadie le habla de vosotros y no pregunta por una petición que solo es ambigua en el cómo; y siguen ahí el español colombiano sin voseo, la conversación compartida y Kaizen | `testLosCriteriosDelMacNoContradicenALaConstitucion` |
| 108 | el perfil elegido se guarda en este Mac y vuelve igual al abrir; uno escrito a mano o por otra versión se lee normalizado, una persona no hereda la especialidad que quedó guardada, y mientras no haya un perfil que esta versión entienda, Ü lo pregunta al empezar | `testElPerfilElegidoSeGuardaYLoNuncaElegidoSePregunta` |

**La que cierra el asunto es la 103:** mientras el perfil no viaje en el primer turno, Graph no puede
hablarle a nadie distinto. Para lo que Ü dice en el Mac sin pasar por Graph (la voz y Luna), la 106.

### Con qué se juzga cada una

Sin red, sin micrófono y sin escritorio, como el resto del contrato:

- **101, 102, 105** — `PerfilDeUso` y `Especialidades` (UCore) son puros: se llaman directamente. La 102
  fija el catálogo entero, `codigo=nombre` unido por «|», en una línea generada con node desde
  `specialtyNames.js` (no copiada a mano): si Graph cambia un nombre, se pone roja.
- **103** — `AgentEngine` con un turno de mentira, como la 6: se leen los `TurnRequest` que salen y su JSON.
  Tres tareas seguidas en el mismo motor (médico, persona, sin elegir).
- **104** — las constantes de `ConstitucionDeU`. Que digan lo mismo que la de Graph letra por letra lo
  juzga `tools/monorepo/constitucion.sh`, en la raíz; aquí se juzga lo que un literal multilínea mal sangrado
  rompería sin que nadie lo viera (las viñetas, los párrafos, los bordes) y la versión.
- **106, 107** — `LiveProtocol.start` con cada perfil: se lee el `session.start` que se mandaría a Live 1.
- **108** — un `UserDefaults(suiteName:)` propio de la prueba, que se borra al terminar. La app pregunta
  al empezar con esa misma función (`PerfilDeUso.hayQuePreguntar(en: .standard)` en `AppMain`), así que un
  cambio en la regla pone roja la 108. Que `AppMain` la siga llamando es de la app, y se prueba a mano.

La bienvenida, la fila «Cómo me usas…» del menú de Ü y de la carita, y la sección de Configuración son de
la app (`UApp`), que el corredor no importa: se prueban a mano en la app instalada (ver «La prueba de
verdad»).

## Las promesas que ya había

Revisadas el 2026-10-01 contra la constitución: **ninguna la contradice, y ninguna prueba cambió.**

| # | Qué fija | Por qué sigue igual |
|---|---|---|
| 2 | «conversación compartida» en los criterios | es comportamiento de la voz en una sala, que la constitución no trata |
| 3 | las tres políticas de la voz (backchannel, interrupción, delegación) | ídem |
| 4 | «colombiano» y «sin voseo» en la voz, y Kaizen en los criterios | la constitución dice lo mismo: español de Colombia, nunca vos |
| 25 | la preferencia del usuario llega a Live, a Luna y a Graph | sigue llegando: va detrás de la constitución y de la base |

Lo que sí cambió de texto, sin promesa vieja que lo fijara (2026-10-01):

- **`AssistantContext.principles`**: «Explica con sencillez y ejemplos concretos; una instrucción útil a la
  vez. Sé cálida sin invadir.» pasa a «Una idea útil a la vez; si hay que explicar algo, con un ejemplo
  concreto y a la medida de quien te habla. Acompaña sin invadir.» (Ü es «cálido», y al médico no se le
  explica su vocabulario); «vuestra conversación» pasa a «la conversación contigo»; «si está claro que te
  hablan pero la petición es ambigua» pasa a «… pero no se entiende qué piden» (lo que falta del cómo lo
  elige Ü).
- **La base de la voz** (`LiveProtocol.start`): «Eres Ü, también llamado You o Yu. Habla en español
  colombiano, sin voseo, con calidez y sencillez. Explica una idea útil a la vez con ejemplos concretos.»
  pasa a «En voz te llaman Ü, You o Yu. Habla en español colombiano, sin voseo: una idea útil a la vez, en
  frases que se dicen de un tirón.» Quién es Ü ya lo dice la constitución, y eran dos «Eres Ü». «vuestra
  conversación» de la política de interrupción pasa a «la conversación contigo».

## La fase

Una sola: la spec es una rama, y se mergea con todas sus promesas en verde.

| Fase | Promesas | Qué toca | Sitios con esta clase de error |
|---|---|---|---|
| M1 | 101-108 | `Sources/UCore/ConstitucionDeU.swift` (nuevo), `Sources/UCore/PerfilDeUso.swift` (nuevo: `Especialidades`, `PerfilDeUso`), `Sources/UCore/Protocol.swift` (`TurnRequest.profile`, `PerfilEnElCable`), `Sources/UCore/AgentEngine.swift`, `Sources/UCore/AssistantContext.swift`, `Sources/UCore/LiveProtocol.swift`, `Sources/UApp/AppModel.swift`, `Sources/UApp/AppMain.swift`, `Sources/UApp/Views.swift`, `Sources/UApp/PerfilDeUsoView.swift` (nuevo) | **2** sitios arman instrucciones de un modelo con identidad (voz y Luna) → los 2 empiezan por la constitución, por el único camino que comparten (`liveInstructions`); **1** sitio arma el turno de Graph (`AgentEngine.run`) → lleva el perfil en el primero; **4** frases que contradecían → 0 (107) |

Lo que hace, en una línea por pieza:

- **`ConstitucionDeU`**: `quien`, `obedece`, `perfilMedico`, `perfilPersona` y `version`, copiados de Graph
  byte a byte, con su marca `// constitucion:…` delante de cada uno para `tools/monorepo/constitucion.sh`.
  `instrucciones(perfil:)` los junta: quién es · «QUIÉN TE HABLA» · obedecer, el orden de Graph y Windows.
- **`Especialidades`**: los 49 pares código/nombre de `specialtyNames.js`, en su orden y en snake_case;
  `normalizarCodigo` hace lo que `normalizeSpecialtyCode`; `buscar` encuentra por código o por nombre, y lo
  que no está devuelve nil.
- **`PerfilDeUso`**: `normalizar` (la de Windows: «Médico», «médica », «MEDICO»), `sinElegir`, `paraElCable`
  (nil sin elegir), `bloqueDelPrompt` (`{ESPECIALIDAD}` → «, especialista en <Nombre>» o nada, con el nombre
  del catálogo), `paraElMenu`, y `guardado(en:)`/`guardar(en:)`/`hayQuePreguntar(en:)` sobre `UserDefaults`.
- **El cable**: `TurnRequest.profile` (opcional, no se codifica si es nil) y `AgentEngine.perfil`, que va
  solo en el turno 0 de cada `run`, como el objetivo.
- **Los prompts**: `AssistantContext` lleva el perfil, y `liveInstructions` antepone la constitución a la
  base y a los criterios. `graphContext` (lo que va a Graph en `userContext`) no la lleva: Graph tiene la
  suya.
- **La app**: `AppModel.perfil` (de `UserDefaults`), `elegirPerfil` y `eligiendoPerfil`; al empezar, si no se
  eligió, la ventana se abre con la bienvenida (`PerfilDeUsoView`: «Trabajo en salud» / «Uso personal», y la
  especialidad del catálogo si es salud, con «Otra, o prefiero no decirla»). Se puede aplazar («Ahora no»).
  Para cambiarlo: «Cómo me usas…» en el menú de Ü de la barra de estado y en el menú de la carita, y
  «Cambiar…» en Configuración. Ir a una pestaña (Configuración…, un aviso de permisos, Memoria) gana a la
  bienvenida pendiente: `AppModel.selectedTab` la cierra al cambiar, y si no se eligió, la pregunta vuelve
  al abrir la app, como en Windows. Por eso, al arrancar, `AppMain` elige la pestaña antes de abrir la
  bienvenida.

### Medidas

Las instrucciones que abren Live 1, sin preferencia del usuario (reconstruidas de las fuentes con Python):

| | voz | Luna |
|---|---|---|
| antes | 4.716 | 3.040 |
| sin elegir | 8.661 | 7.006 |
| persona | 9.255 | 7.600 |
| médico sin especialidad | 10.194 | 8.539 |
| médico de Urgencias | 10.233 | 8.578 |

La voz casi se duplica. Windows le da a la voz de GPT-Live una persona corta (1.288 caracteres) y deja la
constitución al delegado; aquí se siguió el pedido de que la voz se arme con la constitución. Si Live 1 la
rechaza o tarda en confirmar la sesión, el camino es el de Windows (ver «Lo que queda fuera»).

## Lo que se probó en esta máquina (Linux, sin Swift)

- `./contrato.sh --cruce`: specs, tests y corredor cuadran (39 promesas con juez, 39 llamadas, `PASS: 39`).
- La constitución Swift contra la de Graph, con un script de Python que lee el literal multilínea con las
  reglas de Swift (el salto tras la apertura y el anterior al cierre no cuentan; a cada renglón se le quita
  la sangría del cierre; un renglón en blanco queda vacío; un renglón con menos sangría no compilaría), y
  otra vez con la función `raw_string_cs` de `tools/monorepo/constitucion.sh`: los cuatro textos y la
  versión, iguales byte a byte (1.677, 2.370, 1.600 y 608 bytes).
- Las aserciones de texto de 101, 102, 104, 105, 106 y 107, y de las viejas 2, 4 y 25, repetidas en Python
  sobre los textos reconstruidos de las fuentes: 364 comprobaciones, 0 fallos. No sustituye al compilador.
- El catálogo entero de la 102, contra el que da node desde `specialtyNames.js`: igual.
- El sabotaje de la 104, simulado con las reglas de Swift: sin los dos espacios de las viñetas de `quien`, o
  con su cierre dos espacios a la izquierda, la prueba ve 0 viñetas donde pide 5 (✘ 104), y la lectura de
  `tools/monorepo/constitucion.sh` difiere de Graph. Con el cierre a la DERECHA no hay rojo que ver: no
  compila («insufficient indentation of line in multi-line string literal»), y por eso no es el sabotaje.
- La sintaxis de los archivos tocados, con tree-sitter-swift: sin errores nuevos (el único, en
  `AppModel.swift`, ya estaba en `HEAD`: el parser no entiende `as? Bool ?? true` ni `startJev`).

## El rojo y el sabotaje, pendientes

No se vieron: sin Swift no hay corredor. Quedan para el CI de macOS y para el dueño. Los sabotajes previstos,
uno por promesa:

| # | Sabotaje | Debe dar |
|---|---|---|
| 101 | quitar `"medica"` de `PerfilDeUso.normalizar` | ✘ 101 |
| 102 | borrar «Medicina familiar» de `Especialidades.todas` | ✘ 102 |
| 103 | mandar `profile: perfil` en todos los turnos (sin `index == 0 ?`) | ✘ 103 |
| 104 | quitar los dos espacios de las viñetas de `quien` (o correr sus comillas de cierre dos espacios a la IZQUIERDA) | ✘ 104, y rojo en `tools/monorepo/constitucion.sh` |
| 105 | `bloqueDelPrompt` con el texto recibido en vez del nombre del catálogo | ✘ 105 |
| 106 | `liveInstructions` sin `constitucion` delante | ✘ 106 |
| 107 | devolver «Sé cálida sin invadir.» a los criterios | ✘ 107 |
| 108 | `guardado(en:)` sin leer la especialidad | ✘ 108 |

## La prueba de verdad (en la app instalada), pendiente

1. `defaults delete com.zevcorp.u.mac perfilDeUso`, `./instalar.sh` y abrir: sale «¡Hola! Soy Ü». «Ahora no»
   deja la Ü de antes; al volver a abrir, pregunta otra vez.
2. «Trabajo en salud» y Cardiología → Configuración dice «Trabajo en salud · Cardiología».
3. Una tarea por texto → el primer turno que recibe Graph trae `profile` y los siguientes no (en los logs de
   Graph o con un proxy).
4. Abrir la voz → Live 1 confirma la sesión con las instrucciones nuevas (unos 10.200 caracteres): medir que
   la acepta y cuánto tarda. Saludar: le habla de usted.
5. «Cómo me usas…» en el menú de Ü → «Uso personal»: la tarea siguiente lleva `kind: persona`; la voz que
   estaba abierta sigue como empezó, y el aviso lo dice.
6. Con la bienvenida pendiente (sin elegir): «Configuración…» del menú, «Configuración» o «Memoria» del notch,
   y pedir la voz o una tarea sin permisos muestran lo pedido, no la bienvenida. Al volver a abrir Ü, pregunta
   otra vez.

## Lo que queda fuera

- **Cambiar el perfil con la voz abierta.** Windows lo aplica en caliente (un `session.update` de la
  delegación y un `session.instructions.append`, con un tope medido de 1.756 caracteres). El Mac no tiene ese
  camino y aquí no se podía medir: el perfil nuevo vale desde la próxima conversación de voz.
- **Una persona corta para la voz.** Si Live 1 no acepta, o tarda, la voz con la constitución entera (ver
  «Medidas»), se hace como Windows: persona corta para la voz y la constitución para Luna.
- **`userContext`** sigue mandando a Graph los criterios de la voz junto con la preferencia del usuario.
  Graph lo ignora (`AgentTurnService.js:41`) y piensa leer solo el texto personal, dentro de `<memoria>`.
  Mandar solo el texto cambia el cable y no tiene promesa aquí.
- **La pregunta de peligro de Jev** (`JevClient`: «enviar, borrar, pagar, confirmar, guardar o cerrar sin
  guardar») no nombra grabar, firmar ni finalizar, como la de Windows y Graph (promesa 730 de Windows). Es
  una clasificación de TypeSafe, no identidad ni tono.
- **La descripción de `map_esto_es`** no dice que los datos de un paciente no se guardan (lo hizo Windows en
  su 738). El bloque del médico sí lo dice, y Luna lo lleva.
- **Los textos de la interfaz** (avisos y errores de `AppModel` y `Views`) tutean; a un médico la constitución
  le habla de usted. No son prompts.
- **La cuenta Miracle**: el Mac no la tiene, así que no existe la regla de Windows de que con un médico
  dentro manda la especialidad de su cuenta (su 700).
- **Especialidades fuera del catálogo** (enfermería, fisioterapia): el médico queda sin especialidad.
  Windows deja escribirlas; Graph las descarta igual.
- **La enseñanza** (`/teach/…`): el Mac no la tiene, así que el perfil no tiene más caminos que el turno.
- **`migration/`** (la paridad con Windows) no se tocó: su evidencia se mide en la app instalada.

## Hallazgos

- 2026-10-01 · Graph ignora el `userContext` del Mac: los criterios de la voz nunca llegaron al cerebro de
  Graph. El perfil va en su propio campo, que Graph sí lee.
- 2026-10-01 · El Mac no guarda un id de conversación. «Olvidar la conversación al cambiar de perfil» ya
  pasa sola: la sesión de Graph dura una tarea, y la siguiente nace sin ella y con el perfil nuevo (103).
- 2026-10-01 · Ninguna prueba vieja fijaba las frases que contradecían a la constitución («cálida»,
  «vuestra», «la petición es ambigua»): se cambiaron sin enmendar ninguna promesa.

## Cierre

- [ ] `./contrato.sh` → `CONTRATO INTACTO: 39 promesas.` — **sin correr: se escribió en Linux sin Swift; lo
      juzga `mac-build.yml` en el PR**
- [ ] Cada promesa vista en rojo antes de su código, y otra vez al sabotearla (tabla de arriba)
- [ ] Probado en la app instalada (`./instalar.sh`), con los seis pasos de arriba
- [ ] Estado de este documento: **implementado** (AAAA-MM-DD)
