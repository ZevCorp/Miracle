# Ü para Mac — cliente nativo desde cero

Esta implementación vive en `apps/mac/` del monorepo (nació en la rama `codex/mac-from-scratch` y entró a `main` en #127) y no reutiliza el cliente Mac anterior.
La app está escrita en Swift/AppKit y usa:

- `AXUIElement` para leer y accionar controles accesibles.
- `CGEvent` para teclado, ratón, scroll y arrastre.
- `ScreenCaptureKit` para capturas solicitadas por Graph.
- `AVAudioEngine` con voice processing para hablar y escuchar sin realimentación.
- GPT-Live 1 por `/v1/live/sessions`, con planificación delegada a `gpt-5.6-luna`.
- Jev (`jev-latest`, TypeSafe `/v1/systemone`) para elegir controles AX directamente.
- Graph entrega las credenciales de proveedores una vez al conectar. El modo texto/dictado conserva `/api/v1/agent/turn` como respaldo.

## Voz y ejecución rápida

Deja desactivado **Usar dictado y voz de macOS como respaldo**, pulsa **Comprobar conexión** y luego el micrófono.
Graph debe entregar `openai` y `typesafe` en `/api/v1/agent/claves`. Si falta TypeSafe, se muestra y Luna
puede seguir con las herramientas AX; no se presenta esa ejecución como Jev.

Luna usa `map_tramo` para iniciar navegación (hasta 15 pasos) sin bloquear la conversación y recibe el
desenlace automáticamente. `map_decidir` hace un solo paso. Jev elige exclusivamente controles observados;
Luna se ocupa del texto, la planificación, las ambigüedades y los pasos que Jev rechaza. Confianza mínima
0,70; objetivo cumplido desde 0,70; riesgo desde 0,50 devuelve el control a Luna. La ausencia de cualquiera
de estas respuestas también devuelve el control. No se reintenta un clic fallido con otra etiqueta.

El recorrido de Jev no hace capturas, ni enumera aplicaciones, ni construye contexto Graph, ni espera 180 ms
entre acciones. Lee los atributos AX en lotes, conserva la referencia nativa elegida y comprueba cancelación
y foco antes de pulsar. La siguiente decisión observa el estado posterior. TypeSafe tiene un plazo total
de 2 segundos, incluidos los reintentos de HTTP 429/529. No se pide permiso por acción.

### Medir en la app instalada

Con el Mac desbloqueado y UFixture recién abierta (contador a cero):

```bash
open apps/mac/.artifacts/UFixture.app
open -n "$HOME/Applications/U.app" --args --execution-test /tmp/u-execution-test.json
```

La prueba usa las credenciales guardadas: comprueba sesión Live 1 → herramienta de Luna → resultado,
sin abrir el micrófono, y pide a Jev cinco clics en la ventana de prueba. El JSON separa `readAXms`,
`decisionMS` (red y respuesta TypeSafe), `actionMS` y `totalMS` por paso. Solo declara éxito si observa
el contador en cinco. No extrapoles esta ventana pequeña a navegadores o aplicaciones con árboles AX grandes.
La conversación e interrupción de voz se comprueban manualmente con el micrófono de la app.

### Si Live 1 no responde

Lo primero es saber cuál credencial de voz falla. Este diagnóstico prueba por separado la clave del
Llavero de este Mac y la que entrega Graph (una sesión corta cada una, sin micrófono) y no imprime
ninguna clave:

```bash
open -n "$HOME/Applications/U.app" --args --voice-keys-test /tmp/u-voz-claves.json
```

`responde: false` con `credit_balance_exhausted` es una cuenta de OpenAI sin saldo; con `HTTP 401`,
una clave rechazada. Ninguna de las dos se arregla en el Mac: hace falta recargar esa cuenta o
guardar otra clave (Configuración → «Clave de OpenAI para Live 1», o la de Graph en el servidor).
Si la clave responde pero la conversación no arranca, mira el audio: `--audio-test` mide el motor.
En este Mac macOS rechaza la cancelación de eco, y el motor simple arrancado en ese mismo instante
fallaba con -10875 (2026-10-01): ahora se reintenta cada medio segundo hasta que el dispositivo se
asienta, y sin cancelación de eco Ü no envía el micrófono mientras ella habla por los altavoces
(`EchoGuard`), para no contestarse a sí misma. Con audífonos esa guarda no se aplica.

Ü ya prueba sola la otra credencial cuando la primera es rechazada, y si ninguna sirve lo dice en el
notch («Voz sin servicio…») en vez de quedarse callada. Jev y el control del Mac no dependen de esa
clave: `--execution-test` los mide aparte.

## El notch y el muelle, como en Windows

Los dos se portaron de `PanelDeAcciones` y `Muelle` de Windows (2026-09-30). Las reglas viven puras en
`UCore` (`NotchLayout`, `NotchSpeech`, `NotchPresence`, `DockRule`) y las juzga el contrato; `UApp`
solo las convierte en ventanas (`NotchController`, `DockController`).

- **El notch** nace oculto. Sale cuando hay algo que decir (lo que Ü dice, un paso y su
  desenlace) cayendo desde la barra de menú con un rebote pequeño, y se va solo a los 90 s sin nada
  nuevo, salvo si hay un paso en curso. Tocar el borde de arriba lo asoma aunque no tenga nada que
  decir; si solo salió por eso, alejarse lo retira. Mide siempre 290 × 62, lo mismo que la barra de volumen de macOS; el chat lo abre a 420 × 360
  desde el mismo borde y lo sostiene mientras está abierto. Esc cierra el chat. Colgar lo retira.
- **El muelle** es la pestaña contra el borde derecho. El cursor despliega el panel hacia la izquierda
  sin mover la pestaña; al salir espera 350 ms antes de plegarse, y no se pliega mientras el chat del
  notch esté abierto. Soltar la carita encima la guarda (la pestaña se vuelve blanca); arrastrarla
  desde el panel la saca bajo el cursor y se queda donde la sueltes.

Dos cosas son más firmes que en Windows, y las dos son el notch «trabado» que se veía en Mac: lo que
llega mientras se está yendo lo trae de vuelta en vez de perderse, y la caducidad nunca lo quita de
debajo del cursor.

### Medirlo en la app instalada

La sonda mueve el cursor de verdad durante ~1 minuto y mide ventanas, tiempos y trayectorias. Abre Ü
con los ganchos de sonda y después la sonda:

```bash
open -n "$HOME/Applications/U.app" --args --probe-hooks
open -n "$HOME/Applications/U.app" --args --notch-test /tmp/u-notch-test.json
```

El JSON trae `score` (26 comprobaciones: 17 del notch, 9 del muelle), el número de cada una y
`valida`: si alguien mueve el ratón durante la prueba, la corrida se anula y se repite, no se cuenta
como fallo. El criterio de éxito del port fue 3 corridas válidas seguidas al 100 %.

## Aprender, como en Windows

El primer botón del muelle, **Aprender**, es el Learn de Windows (`OnToggleTeach` + `WorkflowTeachSession`):
le enseñas a Ü una tarea haciéndola una vez y contándole lo que haces. Las reglas viven puras en
`UCore` (`AuraRule`, `DemoStart`, `LessonBuilder`, `ApprenticeMode`, `LearningClient`) y las juzga el
contrato; `UApp/LearnController` y `UMac/StepRecorder` las ponen en marcha.

- **No hay cuenta atrás** (promesa 137): al pulsar Aprender, Ü espera a que pongas delante la app que
  vas a enseñar, con el aura tenue y sin decir «grabando». Si en un minuto no ve ninguna, lo deja.
- **Mientras graba**, los bordes de la pantalla respiran en azul (96 pt, el centro queda libre; los
  clics lo atraviesan y no sale en las capturas) y la píldora cuenta los pasos. Cada clic es un paso;
  lo que escribes en un campo es un solo paso, y el de un campo protegido nunca lleva su valor. Lo
  que dices por voz queda pegado al paso en que lo dijiste. Los clics sobre Ü no cuentan.
- **Ü es aprendiz** (promesa 138): si la voz está abierta, escucha y asiente, y rechaza cualquier
  herramienta que toque la pantalla hasta que termines. El micrófono se abre solo al enseñar y se
  cierra al terminar si lo abrió Aprender.
- **Terminar** apaga el aura al instante, guarda la lección en
  `~/Library/Application Support/U Mac/lecciones/leccion_<fecha>/leccion.json` y le pide a Graph
  (`/api/v1/learning/sessions/…`, las mismas cuatro llamadas que Windows) que estructure y nombre el
  workflow. Si Graph tarda de más, los pasos ya están guardados y el cierre se completa al reabrir Ü.

Lo que Windows tiene y Mac todavía no: el video de la demostración (Windows lo manda a Gemini por el
backend, no a Graph), los cuadros antes y después de cada clic, y «Comprobar» la tarea aprendida.

### Medirlo en la app instalada

```bash
open -n "$HOME/Applications/U.app" --args --probe-hooks
open -n "$HOME/Applications/U.app" --args --learn-test /tmp/u-learn-test.json "apps/mac/.artifacts/UFixture.app"
```

La sonda pulsa Aprender en el muelle, hace una demostración real en UFixture (clic, escribir, Enter),
pulsa Terminar y lee la lección guardada. Corre en modo de prueba: nada llega a Graph.

## Abrir la app

**Ü queda siempre encendida.** `instalar.sh` registra el agente `~/Library/LaunchAgents/com.zevcorp.u.mac.plist`:
Ü se abre sola al iniciar sesión y launchd la vuelve a abrir si se cierra por un fallo. Si la cierras
tú con «Salir de Ü», respeta tu decisión hasta el próximo inicio de sesión. Abrir Ü desde Spotlight o
el Finder con Ü ya encendida muestra su ventana. Para quitar el arranque automático:

```bash
launchctl bootout gui/$(id -u)/com.zevcorp.u.mac && rm ~/Library/LaunchAgents/com.zevcorp.u.mac.plist
```


Desde la raíz del repositorio:

```bash
./apps/mac/abrir.sh
```

El lanzador abre siempre la copia instalada en `~/Applications/U.app`; si todavía no existe, ejecuta la instalación automáticamente. También puedes abrir directamente:

```bash
open "$HOME/Applications/U.app"
```

Para probar el flujo como lo usará una persona instalada, compila y copia el bundle a `~/Applications`:

```bash
./apps/mac/instalar.sh
```

Después abre `~/Applications/U.app`. No alternes entre el ejecutable suelto, `.artifacts/U.app` y
otra copia en `~/Desktop/U/U-Mac/U.app`: macOS registra TCC por el bundle y su firma. El instalador
mueve esa copia heredada a la Papelera y verifica que la app final no use una firma ad hoc.

Las compilaciones locales usan el certificado persistente `U Local Stable Signing`, guardado en un
llavero local. Por tanto, recompilar no cambia su requisito TCC. La distribución a otras personas
debe definir `CODE_SIGN_IDENTITY` con un certificado `Developer ID Application` y notarizar el ZIP,
DMG o PKG resultante.

### Entregarla a quien la prueba (.dmg)

```bash
./apps/mac/empaquetar.sh
```

Deja `apps/mac/.artifacts/U-Mac-pruebas.dmg`: la app universal (Apple Silicon + Intel) firmada con la
identidad estable de este Mac, un acceso a Aplicaciones y un LÉEME. Sin el sello de Apple (cuenta de
Apple Developer), cada persona aprueba la app **una vez** en Ajustes del Sistema → Privacidad y
seguridad → «Abrir igualmente»; el LÉEME del disco lo explica. Todas las versiones deben salir de este
mismo Mac: la firma es la misma y los permisos que dio la persona sobreviven a las actualizaciones.
La copia instalada en Aplicaciones escribe su propio agente de inicio de sesión.

El disco lleva una credencial de voz **temporal** si este Mac tiene una en
`~/Library/Application Support/U Mac/Pruebas/openai-key` (o en `U_PRUEBAS_OPENAI_KEY`); nunca en el
repo, que es público. Viaja enmascarada, no cifrada: quien tenga el disco puede sacarla. La app deja de
usarla a los 30 días (`U_PRUEBAS_DIAS`); ponle tope de gasto en OpenAI y revócala al terminar las
pruebas. `./empaquetar.sh --sin-clave` arma el disco sin ella. Para comprobar que la del disco responde:

```bash
open -n /Applications/U.app --args --voice-keys-test /tmp/claves.json
```

(fila `pruebas`). Con esa credencial funcionan la voz y lo que Ü hace en pantalla; el chat escrito y
Aprender necesitan además la credencial de Graph en Configuración.

## Permisos

En la pestaña **Configuración**:

1. Pulsa **Permitir** junto a **Accesibilidad**. Se abre directamente el panel de macOS.
2. En la lista activa **Ü para Mac** (puede aparecer como `U` porque macOS cachea el nombre del ejecutable).
3. Activa **Grabación de pantalla** si quieres que vea capturas.
4. Activa **Micrófono y voz** si quieres conversación por voz.
5. Regresa a Ü: los estados se vuelven a comprobar automáticamente durante 30 segundos.
6. Si macOS no refleja un permiso hasta el siguiente arranque, pulsa **Reiniciar Ü para aplicar**.

En la instalación nueva la app debe indicar `Bundle: com.zevcorp.u.mac` y `Firma: local-stable`.
Esa combinación es la que se debe autorizar una única vez. No ejecutes `reparar-permisos.sh` después
de una actualización normal: hacerlo borra deliberadamente la autorización para repetir el onboarding.

El permiso de Accesibilidad es el que permite usar otras aplicaciones. Sin él, Ü solo puede mostrar la carita y hablar por texto.

### Recuperar instalaciones antiguas

Solo si una instalación anterior conservó un interruptor verde que Ü no reconoce, ejecuta una vez:

```bash
./apps/mac/reparar-permisos.sh
```

Esto resetea únicamente Accesibilidad y Grabación de pantalla de `com.zevcorp.u.mac`; no se ejecuta
desde la app ni durante actualizaciones normales. Vuelve a conceder ambos permisos y, desde entonces,
actualiza siempre con `./apps/mac/instalar.sh`.

## Configurar Graph

En Configuración pega la API key de Graph y pulsa **Guardar**. Se guarda en el Llavero de macOS, no en archivos del proyecto. El token de GitHub no sirve para Graph.

## Cómo me usas: salud o día a día

La primera vez que se abre, Ü pregunta para qué se va a usar: **Trabajo en salud** (con la especialidad, del
catálogo de Graph) o **Uso personal**. A quien trabaja en salud le habla de usted y con su vocabulario; a quien
lo usa en su día a día, de tú y sencillo. Se cambia cuando se quiera desde **Cómo me usas…** en el menú de Ü
(barra de estado o carita) o en Configuración. Se guarda en este Mac (`defaults read com.zevcorp.u.mac perfilDeUso`)
y viaja a Graph en el primer turno de cada tarea; sin elegir, Ü se porta como antes. La voz que ya está abierta
sigue como empezó: el cambio vale desde la próxima conversación. El detalle está en
[`docs/specs/001-u-sabe-con-quien-habla.md`](docs/specs/001-u-sabe-con-quien-habla.md).

## Prueba local de AX

Para probar la lectura y acción sin red ni Graph, compila la app de fixture:

```bash
cd apps/mac
swift build -c debug --product UFixture
open -n .build/arm64-apple-macosx/debug/UFixture
```

La prueba automática completa, sin micrófono ni escritorio:

```bash
swift run -c debug NativeContract
```

La app se puede ejecutar con diagnóstico:

```bash
open -n .artifacts/U.app --args --diagnose
```

El diagnóstico también muestra la ruta y el bundle ID que macOS está autorizando:

```bash
open -n "$HOME/Applications/U.app" --args --diagnose
```

El diagnóstico debe ejecutarse con Ü cerrada para que `--args` llegue a una instancia nueva.

## Detener y volver a abrir

- Doble toque en la carita: activar o silenciar el micrófono.
- `Esc`: detener una tarea y cerrar la voz en vivo.
- Para cerrar completamente: menú **Ü** en la barra de menús → **Salir de Ü**.
- Para abrir otra vez: `./apps/mac/abrir.sh`.
