# Plan de implementación: el arranque no espera a que nadie diga quién es

Estado: **propuesto** · 2026-09-30 · Rama: `jose/ci-terreno-arranca` · Promesa **450** (reservadas 450-459)

> Nace de verificar la spec 052: el nivel 3 de la compuerta (`scripts\ci-terreno.ps1`) falló
> igual sobre `main` sin tocar — «la app no levanto el MCP en 30 s» — y además dejó su U.exe vivo.

## Diagnóstico: qué se midió

| Qué | Medida | Fuente |
|---|---|---|
| Instancia con `U_DATA_DIR` limpio (la del CI) | a los 15 s: una sola ventana visible, «Miracle» 440×450; MCP en 8790 **no contesta** | EnumWindows + POST a 8790, 2026-09-30 06:40 |
| Qué ventana es | «Te damos la bienvenida — nombre, correo»: `OnboardingWindow` | PrintWindow de su HWND |
| Qué escribe al disco | solo `roaming\U\config.json`; **ni una línea de log** | el directorio de datos |
| Instancia con sesión de médico (la de todos los días) | MCP arriba a los ~4 s | log `u-20260930-instalada-p25848` |
| Por qué | `FaceWindow.EnsureOnboarded` abre la ventana con **`ShowDialog()`**, dentro de `Loaded`, antes del MCP, del núcleo y del log | `FaceWindow.xaml.cs:1430` |

El comentario encima de `EnsureOnboarded` dice «nunca bloquea el uso del asistente». Es falso: un
`ShowDialog` retiene todo lo que viene detrás hasta que alguien conteste. **Esto no es un problema del
CI: es el primer arranque de cualquier equipo nuevo.** Quien cierre el popup de bienvenida con la X
sigue, pero quien lo deje abierto —o no lo vea, detrás de otra ventana— tiene una carita sin MCP, sin
núcleo y sin log. El CI solo lo hizo visible porque nadie contesta.

`main` lo arrastraba desde que existe el onboarding. La rama `experimento/reemplazo-jeff` (commit
`4198517`, no mergeado) lo «arregló» quitando la pregunta: nunca se pide quién eres. Eso cambia el
producto —sin correo no hay telemetría ni scoping de workflows— y no se copia.

### Cuántos sitios tienen la clase de error (patrón nº5)

`ShowDialog()` aparece en **4** sitios de `windows-client`. Solo **1** está en el arranque normal:

| Sitio | ¿Arranque normal? | Se queda |
|---|---|---|
| `FaceWindow.EnsureOnboarded` | **sí** | se arregla aquí |
| `App.AbrirLaConsulta` (login) | no: solo con `--consulta`, y sin sesión la consulta no puede abrirse | sí, a propósito |
| `ConsultaWindow` (login) | no: lo pide el médico al entrar | sí |
| `Aviso` | no: un fallo que hay que leer | sí |

## La especificación

| # | Promesa | Fase |
|---|---|---|
| 450 | preguntar quién eres no detiene el arranque: la ventana de identidad se abre y quien la abrió sigue en el mismo instante, sin esperar respuesta; lo contestado se guarda al cerrarla, cerrarla sin contestar no guarda nada, y el arranque de la carita no usa `ShowDialog` para preguntarlo | 1 |

### Con qué se juzga

- **Sin pantalla, con una ventana de verdad**: `Ui.PreguntaDeIdentidad.Abrir` recibe una ventana, la
  forma de leer su respuesta y qué hacer con ella. El contrato programa el cierre para dentro de
  400 ms y mira si `Abrir` volvió ANTES de que la ventana se cerrara. Con un `ShowDialog` volvería
  después — el bucle modal atiende el temporizador —, así que el mismo juez distingue los dos casos
  sin colgarse.
- **El código del arranque**: `EnsureOnboarded` no contiene `ShowDialog` (lectura de la fuente, como
  la 164).
- **Sobre la máquina**: `ci-terreno.ps1` sobre un U.exe de esta rama. Es el nivel 3, y es lo que
  estaba roto.

## El runner (`scripts\ci-terreno.ps1`)

Sin promesa en el contrato —es PowerShell que abre la app—, pero se juzga corriéndolo:

1. **Distingue sus causas** (patrón nº2). «No levantó el MCP» cubría tres cosas: el proceso murió, el
   proceso vive pero está parado delante de una ventana, o vive y sin ventanas. Ahora dice cuál, con
   el título de las ventanas visibles y la ruta del log de esa instancia.
2. **Mata lo que arrancó, y lo comprueba.** El `finally` ya corría, pero con `catch {}` mudo: si algo
   fallaba, nadie se enteraba. Ahora cierra por PID (con su árbol), verifica que ya no está y lo dice
   si sigue vivo.

## Lo que NO entra

- Quitar la pregunta de identidad (lo que hizo `4198517`).
- Los otros tres `ShowDialog`: no están en el arranque normal (ver la tabla).
- Llevar los escenarios al portero. Vuelve cuando haya kilómetros de verde.

## Hallazgos

- **`OnboardingWindow` asignaba `DialogResult = true`**, que LANZA en una ventana abierta con `Show()`.
  Sin tocarla, el arreglo habría cambiado un arranque bloqueado por una excepción al contestar. Ahora
  solo rellena `EnteredEmail` y se cierra; quien pregunta lee eso al cerrarse. Tenía un solo llamador.
- **Una consecuencia de no esperar, dicha**: en el PRIMER arranque de un equipo, la memoria personal y
  la conversación de la voz se crean con `UserId` = `anon` si la persona contesta después de que la
  carita arranque (antes el modal obligaba a contestar primero). Desde el arranque siguiente usan el
  correo. La telemetría sí se enciende en el momento de contestar.
- **El `finally` del runner sí corría** (probado: `exit` dentro de `try` ejecuta el `finally` en
  PowerShell 5.1); lo que pasaba era que su `catch {}` mudo se tragaba cualquier fallo. Repetido a
  mano paso a paso, el cierre funcionó, así que la instancia que quedó viva el 2026-09-30 06:36 no se
  pudo reproducir. Por eso la limpieza ahora COMPRUEBA que el proceso murió y, si no, lo dice y cuenta
  como fallo, en vez de suponerlo.
- **El sabotaje, comprobado por diff** (2026-09-30 06:57): `Abrir` con `ShowDialog` y el arranque con su
  `ShowDialog` de vuelta → 450 roja por sus dos motivos («volvió con la ventana ya cerrada» y «el
  arranque usa ShowDialog»), CONTRATO ROTO con 3 incumplidas, todas de la 450. El runner sobre ese
  build: «la app VIVE pero no levanto el MCP en 30 s; tiene abierta(s): 'Miracle'…», con la ruta del
  log, y sin dejar la instancia viva. Restaurado y comparado byte a byte.

## Cierre

- [x] Promesa 450 verde, contrato INTACTO
- [x] `ci-terreno.ps1` verde sobre U.exe de esta rama (catálogo de 28, situarse, mirar y visor), y
  rojo —diciendo por qué— sobre el mismo código con el `ShowDialog` de vuelta
