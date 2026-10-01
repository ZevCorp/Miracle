# Plan de implementación: Ü se presenta hablando, te conoce, y cada quien ve solo lo suyo

Estado: **implementado y sin commitear; el encuentro hablado se rehízo tras la prueba del dueño y falta que lo vuelva a probar** (2026-10-01) · Rama: `jose/el-primer-encuentro`, al día con `main` en `9f5f4b61`

> **Antes de encender la compuerta de Graph (spec 076), leer «El cruce con la 076» en los hallazgos.**
> Con la compuerta puesta, una instalación sin correo no recibe las claves de la voz, y este encuentro
> ya no pide correo.

## Diagnóstico: qué se midió

El dueño (2026-10-01): «el proceso de instalación no está listo en varios sentidos. Yo lo instalo y
me aparece una cosa para meter como correo y contraseña, una cosa así como horrible. Quiero que sea
mucho más intuitivo: que te pida muy pocos datos, solamente como el nombre, y ojalá que sea Ü
hablándote, la carita flotante que se ponga al centro. Le dices tu nombre, tus gustos, tus
preferencias; eso se da como tu system prompt de Soul, guarda algunas memorias sobre ti, y ya está.
Habrá dos tipos de usuarios: estudiantes y médicos. Si inicia sesión como médico no deberá tener
nada de estudiante, y si inicia como estudiante, nada de médico. El panel del collar, con su botón
de grabar, se usará para grabar las clases en vez de consultas: donde dice consultas será clases,
con sus system prompts, y eso será contexto para que Ü les ayude con sus trabajos».

Se leyó el arranque entero en `main` (`d3a556c5`) y se desinstaló y midió la instalación real de
esta máquina antes de escribir una línea.

| Qué | Medida | Fuente |
|---|---|---|
| Qué pide Ü recién instalada | un popup oscuro, modal y `Topmost`, con nombre y correo; sin botón de cerrar ni de cancelar | `Ui/OnboardingWindow.cs` |
| Los textos de ayuda de sus campos | se asignan a `Tag` y no se pintan nunca | `OnboardingWindow.MakeField` |
| Qué pasa mientras ese popup está abierto | nada más: `EnsureOnboarded()` es la primera línea de `OnLoaded`, así que no hay MCP, ni localizador, ni voz, ni una línea de log | `FaceWindow.OnLoaded`; memoria del 2026-09-28 |
| Cuándo se da por hecha la presentación | ANTES de hablar: `PresentacionHecha = true` y `Save()` van delante del temporizador que abre la voz | `FaceWindow.OfrecerElPrimerEncuentro` |
| Qué pasa si la voz no abre en 10 s | «ABORTADO» en el log y no vuelve a presentarse nunca | mismo método |
| Quién espera a las claves de la voz | nadie: `TraerSiFaltaAlgunaAsync()` se lanza sin esperar, y quien llama a `TraerAsync` con la petición en vuelo recibe 0 | `Credenciales/ClavesDelBackend.cs` |
| Qué ve el usuario sin clave | «Una sola vez: setx OPENAI_API_KEY "tu_key" y reinicia Ü» | `ConversacionEnVivo.ArrancarAsync` |
| Qué sabe el cliente de quién lo usa | un correo. «estudiante» o «rol» aparecen 6 veces en todo `windows-client/src`, ninguna como concepto | `grep`, 2026-10-01 |
| Sitios que encienden cosas de médico sin mirar quién es | **8**: los tres ganchos del acceso directo «Miracle Consulta», el vigía de cardiología, el rellenador de SAP, sus dos puentes y el sondeo de exportaciones cada 3 s | `grep` en `App.xaml.cs` y `FaceWindow.xaml.cs` |
| Qué hace el icono del collar | abre la consulta clínica, que exige correo y contraseña de Supabase | `FaceWindow.OnCollar` → `App.AbrirLaConsulta` |
| El dictado sin médico | funciona: sin sesión se identifica por máquina | `DictadoEnVivo.PedirSesionAsync` |
| Qué había instalado de verdad | la **1.3.4** del 18/09. La 1.3.6 que veían las sesiones de Claude vivía en la capa privada del paquete MSIX | vista real por WMI, 2026-09-30 22:06 |
| Cuánto dato vive dentro de la carpeta que Velopack borra | 4,7 GB: lecciones, recuerdos, skills, capturas y logs | inventario, misma noche |
| Cuánto tarda en desinstalar | 126 s mudos en «Removing directory» | `velopack_U.log`, 22:07:06 → 22:09:12 |

## Por qué esto va dirigido por especificación

Lo que se pide son dos cosas que hoy se dan por buenas solas. La presentación se marcaba como hecha
antes de ocurrir, y la separación entre un estudiante y un médico no existe en ningún sitio que se
pueda juzgar: una pantalla que «no enseña» lo clínico es nivel 4, y basta un botón nuevo para
romperla sin que nadie lo vea. La regla de quién ve qué, las palabras del panel, cuándo el encuentro
cuenta como hecho y qué pasa con una clase cuando organizar falla son lógica pura. Se escriben antes.

**La regla del flujo, y no tiene excepciones:** ninguna línea de producción entra antes que la
promesa que la juzga. Cada fase empieza con el contrato ROTO y termina con el contrato INTACTO.

## La especificación

| # | Promesa | Fase |
|---|---|---|
| 700 | el perfil de la persona sobrevive al cierre: nombre, rol, trato y gustos se leen igual tras reabrir; el rol se entiende como lo dice la gente y lo que no se entiende queda sin elegir, no en médico; un archivo roto es un perfil sin conocer, no una excepción | 1 |
| 701 | el primer encuentro hace falta solo cuando nadie conoce a la persona: sin perfil y sin identidad previa se ofrece; una instalación que ya tenía correo o sesión de médico pasa a médico conocido sin preguntar nada; un perfil ya conocido no se vuelve a ofrecer | 1 |
| 702 | el primer encuentro no se da por hecho hasta que hay nombre y rol: terminar sin alguno no lo marca y contesta qué falta; con los dos queda conocido y guardado, lo que la persona contó de sí pasa a la memoria personal, y la despedida que se le entrega a la voz es la de su rol | 2 |
| 703 | si la voz no abre, el encuentro no se pierde ni se marca: pasa a escribirse con el mismo resultado, y dejarlo a medias lo deja pendiente para el siguiente arranque | 2 |
| 704 | el alma dice quién es la persona: su nombre, su rol, cómo quiere que le hablen y lo que le gusta van en las instrucciones de la voz; sin perfil conocido no añade nada; la de un estudiante no nombra nada clínico y la de un médico nada de clases | 3 |
| 705 | cada rol ve solo lo suyo: el estudiante graba clases y no tiene consultas, cuenta clínica, estudios de cardiología, exportación a la historia clínica, escritura en SAP ni acceso directo de consulta; el médico tiene todo eso y no tiene clases; sin rol elegido no hay ni lo uno ni lo otro, y el escaneo del equipo no le promete SAP a quien no es médico | 4 |
| 706 | el panel habla el idioma de quien lo usa: para el estudiante todas sus palabras son de clase y ninguna es clínica; para el médico son las de siempre y ninguna es de clase; a ninguno le falta una palabra | 4 |
| 707 | una clase grabada no se pierde: lo dicho se guarda en el cuaderno antes de pedir los apuntes, así que si organizar falla la clase queda con su transcripción y se puede reintentar sin duplicarla; una grabación sin una palabra no crea clase y dice por qué | 5 |
| 708 | los apuntes salen de lo que se dijo y con forma: al organizador le llega la transcripción entera con el encargo de título, resumen, conceptos, tareas y dudas; lo que contesta se lee sección por sección, y una respuesta que no se entiende es un fallo nombrado, no unos apuntes vacíos | 5 |
| 709 | lo grabado en clase llega a la voz del estudiante y solo a él: sus instrucciones nombran las clases más recientes con fecha y resumen sin pasar del presupuesto, `clase_leer` devuelve los apuntes y lo dicho de la que se pide, el catálogo de siempre no cambia para nadie, y las herramientas de conocerse solo existen durante el encuentro | 6 |
| 710 | quien pide las claves mientras ya se están pidiendo espera esa misma petición y recibe lo que trae: no vuelve con las manos vacías ni dispara una segunda | 2 |
| 711 | mientras se graba, lo dicho se va guardando en el cuaderno: si Ü se cierra a mitad, la clase está ahí con lo oído hasta el último guardado, y al parar no queda duplicada | 5 |
| 712 | volver a presentarse no olvida a nadie por el camino: el encuentro nuevo empieza sin lo sabido, y mientras no termine el perfil de antes sigue intacto en disco; dejarlo a medias lo deja como estaba, y terminarlo lo reemplaza entero | 2 |

Las dos últimas salieron de **probarlo** (2026-10-01), no del plan: una clase dura dos horas y solo
se guardaba al parar; y quien se equivocaba de rol no tenía cómo corregirlo salvo borrando un archivo.

### Las que salieron de que el dueño lo probara hablando (2026-10-01, 06:45)

Instaló la `1.3.9-encuentro.2` y habló dos minutos con la carita: no se anotó ni su nombre. Su veredicto:
«se podía interrumpir demasiado fácil; quiero que sea más impositivo, que me sienta bastante guiado, que
sean como pasos; que yo vea una animación donde se guarda mi nombre; que me explique que en memoria está
todo lo que aprende de mí». Y sobre el aspecto: «muy monocromático, tipo Apple», texto corto en pantalla,
el cajón de Memoria con «Habla o escribe aquí» en vez de «Prefiero escribir», y que al final sea Ü quien
pulse el botón.

| # | Promesa | Fase |
|---|---|---|
| 713 | el encuentro va por pasos y cada anotación trae la frase exacta del siguiente: nombre, rol, sobre ti y cierre, en ese orden; anotar algo de un paso posterior no se salta la pregunta del que falta, y con todo anotado manda cerrar | 8 |
| 714 | al cerrar, Ü explica la Memoria y para qué está, con las palabras del rol: que todo lo que aprende queda en la Memoria, que no guarda nada que no esté ahí y que se puede abrir cuando se quiera; que está para quitar el trabajo tedioso —clases y trabajos de la universidad al estudiante, la nota y la historia clínica al médico— y a ninguno le habla de controlar su computador | 8 |
| 715 | mientras dura el encuentro la voz que suena abre con la persona del encuentro —delegar todo lo que la persona diga y no ofrecer ayuda— y fuera de él con la de siempre; la del encuentro no nombra SAP ni promete operar la pantalla | 8 |
| 716 | lo que la persona dijo y la voz no delegó no se pierde: se le pasa al delegado por escrito con lo que se oyó; si ya se delegó o no se oyó nada, no se manda nada | 8 |
| 717 | lo anotado sale como piezas para la Memoria, cada una una vez y en orden: el nombre, el rol, el trato, los gustos y lo demás que contó de sí | 8 |
| 718 | lo que se lee de Ü mientras habla es lo que suena, una sola vez: con audio el texto del delegado no se suma al de la voz, sin audio es el único que hay, y las marcas entre corchetes no se leen | 8 |
| 719 | lo que se escribe contesta al paso en que se está, igual que lo dicho: el nombre al primero; estudiante o médico al segundo, y si no se entiende no avanza y lo vuelve a preguntar; lo que cuente de sí al tercero, que queda para la memoria; y con los tres el encuentro se cierra sin voz | 8 |
| 720 | la anotación que completa los tres pasos cierra el encuentro en esa misma respuesta y trae la despedida: no hace falta una segunda llamada; antes de eso atender una anotación no cierra nada, y una vez cerrado, pedir cerrar otra vez no manda repetir la despedida | 8 |

**La que cierra el asunto es la 715**, y no se puede juzgar entera sin audio: la promesa mira que la sesión
ABRE con la persona del encuentro; que con ella la voz delegue de verdad lo dice la sonda hablada (abajo).

La que cierra el asunto es la **705**. Mientras no exista una regla única que diga qué puede cada
rol, todo lo demás es cosmético: se puede cambiar una palabra del panel y dejar encendido el sondeo
de exportaciones a la historia clínica en el computador de un estudiante.

### Con qué se juzga cada una

Todas con **mapa a mano en la propia prueba**: archivos en el `U_DATA_DIR` de cada promesa, y el
micrófono, la red y el organizador inyectados como funciones, igual que `Consulta` (promesas 84 y
91). Ninguna necesita fixture congelado ni pantalla.

Lo que **no** se puede juzgar aquí y va a mano (nivel 4): que la escena se vea bien, que la carita
vuele al centro y vuelva, que la voz suene y entienda un nombre dicho en voz alta, y que el panel de
clases se lea como el de consultas.

## Las fases

### Fase 1 — hay una persona, con nombre y rol

| | |
|---|---|
| **Promesas** | 700, 701 |
| **Qué toca** | `windows-client/src/Persona/Perfil.cs` (nuevo) |
| **¿Núcleo congelado?** | no |
| **Terminado** | 700 y 701 verdes, las anteriores intactas |

### Fase 2 — el encuentro, con su final de verdad

| | |
|---|---|
| **Promesas** | 702, 703, 710 |
| **Qué toca** | `Persona/PrimerEncuentro.cs` (nuevo), `Credenciales/ClavesDelBackend.cs` |
| **Sitios con esta clase de error** | 1 «se marca antes de ocurrir» (`OfrecerElPrimerEncuentro`); 1 «la petición en vuelo devuelve 0» (`TraerAsync`) |

### Fase 3 — el alma

| | |
|---|---|
| **Promesa** | 704 |
| **Qué toca** | `Persona/Alma.cs` (nuevo), `Voice/ConversacionEnVivo.cs` (un gancho para el contexto de la persona) |

### Fase 4 — la regla de quién ve qué, y las palabras del panel

| | |
|---|---|
| **Promesas** | 705, 706 |
| **Qué toca** | `Persona/ReglaDelRol.cs`, `Persona/PalabrasDelPanel.cs` (nuevos), `Onboarding/Presentacion.cs`, y los 8 sitios contados arriba |
| **Sitios con esta clase de error** | 8 |

### Fase 5 — las clases

| | |
|---|---|
| **Promesas** | 707, 708 |
| **Qué toca** | `Clases/Clase.cs`, `Clases/CuadernoDeClases.cs`, `Clases/GrabacionDeClase.cs`, `Clases/OrganizadorDeClases.cs` (nuevos) |

### Fase 6 — las clases llegan a la voz

| | |
|---|---|
| **Promesa** | 709 |
| **Qué toca** | `Clases/ClasesParaLaVoz.cs` (nuevo), `Voice/ConversacionEnVivo.cs` (herramientas de la persona) |

### Fase 7 — lo que se ve (sin promesa propia: nivel 4)

La escena de bienvenida (`Ui/EscenaDeBienvenida.cs`), el cableado en `FaceWindow`, el panel en modo
clases dentro de `ConsultaWindow`, y la retirada de `OnboardingWindow`. Se juzga sobre el PC, con
capturas y con la voz en modo texto.

### Fase 8 — el encuentro guiado, hablado de verdad

| | |
|---|---|
| **Promesas** | 713–720 |
| **Qué toca** | `Persona/PrimerEncuentro.cs` (pasos, frases, despedida, persona de la voz, la red, `Escrito`, `Atender`), `Voice/LoQueSeLee.cs` (nuevo), `Voice/ConversacionEnVivo.cs`, `voz/Realtime/ProtocoloGptLive.cs` (la persona de la voz deja de ser fija), `Ui/EscenaDeBienvenida.cs` (rehecha), `Ui/FaceWindow.Encuentro.cs` |
| **Sitios con esta clase de error** | 2 que abren una sesión de voz (el encendido y la reconexión): los dos pasan por `PonerLaPersonaDeLaVoz` |
| **¿Núcleo congelado?** | no. `voz/` tiene su propio contrato, que sigue íntegro (46 de 46) |

## Lo que NO entra

- **Mover los datos fuera de la carpeta que Velopack borra.** Es una mudanza de 4,7 GB con migración,
  y merece su rama: aquí se anota y se respalda a mano antes de desinstalar.
- **Arrancar con Windows.** Hoy Ü no vuelve sola tras reiniciar. Cambiar el arranque del equipo de
  alguien es una decisión del dueño, no un efecto de esta rama.
- **Cuenta para estudiantes.** El estudiante no se registra: sus clases viven en su equipo. Que
  viajen a un servidor es otra spec, con su consentimiento.
- **Los prompts de clase en el backend.** Van en el cliente, como los de cardiología (spec 046), para
  que el instalador de esta rama funcione sin desplegar Graph. Mudarlos es una fase posterior.
- **El login de médico.** La cuenta clínica sigue pidiéndose con correo y contraseña al abrir la
  consulta: hay datos de pacientes detrás. Lo que cambia es que ya no es lo primero que se ve.

## Hallazgos

- **2026-09-30 · Las sesiones de Claude ven un `AppData` virtualizado.** Claude desktop es un paquete
  MSIX; lo que una sesión instala o escribe bajo `%LOCALAPPDATA%\U` cae en una capa privada. La sesión
  veía «1.3.6 instalada» y el dueño tenía la 1.3.4. El estado real se mira y se cambia por WMI.
- **2026-09-30 · Reinstalar encima borra los datos.** Velopack sustituye la carpeta entera, y en ella
  viven las lecciones y los recuerdos.

- **2026-10-01 · El cruce con la 076, y es lo que queda abierto.** Mientras esta rama se escribía entró
  a `main` la spec 076: cada instalación se presenta a Graph **con un correo** (`PresentarseAsync`
  devuelve `sin correo` sin él, y `POST /agent/enroll` contesta 400), y con la compuerta puesta las
  claves de la voz solo se le dan a una instalación aprobada. El correo lo daba el popup que esta
  rama quita. Medido en la corrida: `instalacion: falta el correo de quien usa Ü: sin él la
  instalación no se presenta`. **Hoy no rompe nada porque la compuerta está apagada** («desplegado,
  con la compuerta apagada», spec 076). El día que se encienda: un estudiante no tiene correo y no
  tendría voz nunca; un médico nuevo no la tendría hasta el arranque siguiente a iniciar sesión en su
  cuenta clínica — y el propio encuentro, que es por voz, caería siempre a escribirse. Lo que se hizo
  desde el cliente: el nombre dicho en el encuentro viaja como `display_name`. Lo que falta es de
  Graph y del dueño: decidir con qué se reconoce una instalación que no tiene correo (nombre + código
  dictado al administrador es lo que ya identifica de verdad: el correo «se teclea sin verificar»).
- **2026-10-01 · GPT-Live no deja cambiar las instrucciones a mitad de sesión por encima de 500
  tokens** («Context append text must not exceed 500 tokens»). El guion del encuentro va en las
  instrucciones de ABRIR la sesión, y al terminar la voz se cierra con la escena en vez de cambiar
  de modo: la siguiente vez que se enciende ya abre con el alma.
- **2026-10-01 · Una sesión de solo texto caduca a los 30 s** («sesión cerrada: expired») y la que
  reabre no sabe por dónde iba. Pasó dos veces justo tras el tercer `conocer_guardar`, y el encuentro
  se quedaba colgado con todo sabido. Por eso el guion lleva lo ya anotado, y hay un vigía: con
  nombre y rol en la mano y 9 s sin cerrar se le empuja, y a los 12 s más cierra la app. No se sabe
  si con audio pasa igual: **no se probó con micrófono**.
- **2026-10-01 · Un sabotaje deshecho con una copia de fecha vieja no se recompila.** MSBuild mira
  fechas: tras restaurar los archivos con `copy2`, el contrato juzgó el binario SABOTEADO y dio 25
  rojas. Es el aprendizaje del 2026-08-21 al revés: aquí lo que no se aplicó fue el arreglo. Al
  restaurar, tocar la fecha.
- **2026-10-01 · La segunda Ü se retiraba sin decir nada** si la primera aún soltaba su candado. Ahora
  deja una línea en el log (`GuardiaDeInstancia`).
- **2026-10-01 · Una copia de desarrollo creaba el acceso directo «Miracle Consulta» en el
  escritorio.** Solo las copias instaladas (las que tienen `sq.version` al lado) tocan el escritorio.
- **2026-10-01 · La Memoria enseñaba dos identidades que se contradecían**: «Jose · Estudiante» y,
  debajo, «Todavía no sé cómo te llamas» (el apartado leía el nombre de `config.json`, donde lo
  dejaba el popup). Ahora hay una sola tarjeta.
- **2026-10-01 · Al ponerse al día con `main`, la petición única de claves (710) rompió la 687 y la
  689.** «Volver a pedir tras una espera» se hacía poniendo la petición a null desde dentro, y cuando
  quien pide contesta en el acto la tarea ya terminada se guardaba encima. Ahora es una marca que se
  mira al pedir. Las tres promesas en verde a la vez.

- **2026-10-01 · El vigía del cierre se midió en texto, y hablado habría cortado a Ü.** Nueve segundos
  después de la última anotación una frase escrita ya llegó entera; dicha en voz alta puede ir por la
  mitad. Antes de empujar, de cerrar y de retirar la escena se espera a que lleve cuatro segundos
  callada (tope: 30 s), y la despedida tiene hasta 30 s para terminar de sonar en vez de 12. Es
  precaución leída en el código, **no medida con audio**.
- **2026-10-01 · Una Ü de pruebas que termina el encuentro como médico enciende el sondeo de
  exportaciones contra el Graph de producción**, igual que cualquier otra Ü de médico. La de la
  última corrida estuvo seis minutos así; su log no tiene ninguna línea de trabajo reclamado. Quien
  repita el recorrido como médico: cerrarla al acabar.

- **2026-10-01 · EL QUE IMPORTA: con micrófono contesta la voz, y la voz no lleva el guion.** Con
  GPT-Live quien suena es un modelo de voz con una persona corta y fija («ayudas a operar las
  aplicaciones, sobre todo SAP»), y el guion y las herramientas los lleva un delegado al que la voz le
  pasa el trabajo **cuando quiere**. Al dueño, hablando, le contestó la voz: «Mhm.», «¿En qué te puedo
  ayudar?», «Dime.»; en 121 s hubo dos respuestas del delegado y ninguna anotación. **Todas las pruebas
  de la noche habían sido en texto (`U_ORDENES_DE_PRUEBA`), y lo escrito va directo al delegado**: por
  eso salían bien. Reproducido sin micrófono con la sonda hablada (`_encuentro\sonda-voz`: frases
  sintetizadas que entran por donde entraría el micrófono, contra el servidor real):

  | Persona de la voz | Frases | Delegadas | Anotaciones | Terminó |
  |---|---|---|---|---|
  | la de siempre | 5 | 0 | 0 | no |
  | la del encuentro, «calla mientras trabaja» | 5 | 5 | 4 | sí, 67 s |
  | la del encuentro, con una palabra permitida | 5 | 5 | 4 | sí, 100 s |
  | la definitiva, con las frases torcidas del dueño | 8 | 8 | 3 | no cerró: faltó la 2ª llamada → promesa 770 |
  | la definitiva, cerrando en la misma anotación | 5 | 4, y 1 por la red | 3 | sí, 88 s |

- **2026-10-01 · «Calla» no se respeta; «di solo esta palabra», sí.** Con «mientras el delegado
  trabaja, calla» la voz decía «[tongue click] eh... dame un segundito» delante de cada frase. Con
  permiso para una palabra («Vale.», «Perfecto.») dice esa y nada más. Coincide con lo que ya estaba
  escrito en `ProtocoloGptLive`: no sabe callar.
- **2026-10-01 · La red de lo no delegado duplica si se adelanta.** La voz delega entre 3,1 y 3,9 s
  después de que la persona calla. Una red que esperaba 2,7 s le encargó lo mismo al delegado, y Ü dijo
  «Ahora cuéntame de ti…» dos veces seguidas. Ahora espera según lo que hizo la voz: si contestó ella
  sola, 2,5 s tras cerrarse el turno; si aún no ha dicho nada, 6,5 s.
- **2026-10-01 · Lo captado antes de confirmar la sesión era ruido, y la voz le contestó.** El encuentro
  lo abre la app, no un gesto; los 1.600 ms «guardados desde el gesto» eran la habitación, y de ahí salió
  el «Mhm.» delante del saludo. En una sesión que abre la app no se mandan.
- **2026-10-01 · El saludo dictado suena a los 0,9 s; pedido al delegado, a los 5–7.** Es el
  `session.commentary.append` de GPT-Live: la voz dice la frase letra por letra sin pasar por el delegado.
- **2026-10-01 · En el log de `main`, lo que dice Ü sale dos veces** («¿Cómo te llamas?¿Cómo te
  llamas?»): la frase que escribe el delegado y la que transcribe la voz son el mismo `Hecho.DiceU`, y
  se suman. Aquí solo se arregló lo que se lee en la escena (promesa 768); el acumulado que va al log, al
  hilo guardado y al paso de abajo sigue sumando las dos. **Queda fuera**, con este apunte.
- **2026-10-01 · La carita «muy gris, como sucia» era el fondo.** Es casi blanca a propósito
  (251→240, spec 052); sobre una tarjeta blanca pura se leía gris. Sobre un gris muy claro (244) y con
  su sombra debajo se lee blanca. No se tocó la carita.
- **2026-10-01 · El equipo se suspendió cuatro horas a mitad de una corrida** (08:42–12:49). Tres
  guiones de prueba revivieron al despertar y mandaron sus pasos sobre la instancia siguiente. Pedir que
  no se duerma antes de una tanda, y no llamar a `lanzar.ps1` con tubería: U hereda la salida y el guion
  se queda esperando a que U muera.

## Lo verificado, y lo que no

| Nivel | Qué | Resultado |
|---|---|---|
| 1 | compila en Release | sí |
| 2 | contrato del grafo | **INTACTO**, con 700–720 y con las 440–448 y 680–689 de `main` |
| 2 | contrato de la voz | **ÍNTEGRO**, 46 de 46 (se tocó `voz/Realtime/ProtocoloGptLive.cs`) |
| 2 | sabotaje | 700–712: 13 averías aplicadas y comprobadas, las 13 en rojo. 713–720: 8 de 8 aplicadas y comprobadas, las 8 en rojo. Deshecho con la fecha tocada, INTACTO |
| 3 | escenarios | no corridos: no hay escenario de esto |
| 4 | **el dueño, con micrófono, sobre la copia instalada** (`1.3.9-encuentro.2`, 06:45) | **falló**: 121 s, ni nombre ni rol anotados. Es lo que originó la fase 8 |
| 4 | la sonda hablada contra el servidor real (frases sintetizadas, sin micrófono) | con la persona del encuentro: 5 de 5 y 8 de 8 frases delegadas, pasos en orden, frases dichas letra por letra, despedida entera; ver la tabla de los hallazgos |
| 4 | la app entera, con la voz en texto | escribir el nombre en el cajón → anotado; pastilla «Estudiante» → anotado; lo demás por una orden → cierre, despedida, Ü pulsa «Empezar», la carita vuelve a su sitio; perfil y recuerdo guardados |
| 4 | la escena, pintada fuera de pantalla (16 cuadros) | los tres pasos, «Te escucho», lo oído, el vuelo al campo, guardado, las dos pastillas del rol, el cierre, Ü bajando a pulsar, y «Ahora no» → «Personalizar después» |

**Pantallas, con nombre:** la escena de bienvenida (sus cuatro estados), el panel de clases (lista y
apuntes), la consulta clínica del médico, la Memoria. Cuatro.

**Lo que NO se probó, y hay que decirlo así:**

- **El encuentro nuevo con un micrófono de verdad.** La sonda mete audio sintetizado por donde entra el
  micrófono: mide a la voz y al delegado, no una habitación, un acento ni unos parlantes. La compuerta
  que impide cortar a Ü mientras habla (`NoSeDejaInterrumpir`) no la ejerce la sonda. **Lo tiene que
  probar el dueño**, que es quien encontró el fallo anterior.
- **La red de lo no delegado (716) en la app.** Con la persona definitiva la voz delegó sola 12 de 13
  frases. En la que no —la sonda había hablado encima de Ü, cosa que en la app impide la compuerta—
  entró la red de la sonda a los 5,5 s, la voz delegó también, y Ü repitió una frase. De ahí salió la
  espera de 6,5 s cuando la voz aún no ha dicho nada; **esa espera nueva no se ha vuelto a medir**, y a
  la red no se la ha visto rescatar un turno dentro de la app.
- **La cabeza siguiendo al ratón**: está cableada y no se pudo ver en un cuadro fijo.
- **Grabar una clase de verdad** con el micrófono: se probó la organización con una transcripción sembrada.
- **«Volver a presentarnos» dentro de la app entera**: el botón y el aviso se vieron en una sonda, y la
  lógica la juzga la 712.

## Cierre

- [x] Todas las promesas verdes (`.\scripts\contrato-del-grafo.ps1` → CONTRATO INTACTO) y la voz íntegra
- [ ] `.\scripts\verificar.ps1` pasa — no puede: exige el árbol commiteado, y esta rama no se commitea sin que el dueño lo pida
- [x] Probado sobre el PC en limpio como estudiante y como médico, con la voz en texto
- [x] El encuentro hablado medido contra el servidor real con audio sintetizado
- [ ] Probado por el dueño con micrófono, sobre la copia instalada (`1.3.9-encuentro.3`)
- [ ] Decidido cómo se presenta a Graph una instalación sin correo (el cruce con la 076)
