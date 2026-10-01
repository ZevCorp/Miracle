# Plan de implementación: la actualización llega, y cuando no llega lo dice

Estado: **implementado, sin publicar** (2026-09-30) · Nace del diagnóstico del 2026-09-30 · Rama: `jose/la-actualizacion-llega`

## Diagnóstico: qué se midió

El dueño (2026-09-30): «los releases que estamos haciendo para actualizar Windows no están surtiendo
efecto en los computadores de los usuarios, ni con actualizaciones automáticas ni hay un botón
confiable para actualizar la app una vez la tengo instalada».

| Qué | Medida | Fuente |
|---|---|---|
| Última release publicada | **1.3.6, del 2026-09-24** (commit `334f144f`). `main` lleva 10 commits de Windows encima sin publicar, entre ellos #131, #136, #137 y #138 | `gh release list`, `git rev-list 334f144f..origin/main -- apps/windows` |
| «Distribuir App» de Provider Studio | **no puede lanzar el workflow**: GitHub responde `422 Required input 'user_message' not provided` | `gh api … /dispatches` sin `user_message`; `WindowsAppReleaseService.triggerBuild` manda solo `version` y `request_id` |
| Detectar y descargar en equipos reales | funciona: las 5 instalaciones que han visto una release anotan «versión nueva disponible → descargada» | `graph_windows_events`, `phase = update` |
| **Aplicar** en equipos reales | falla en al menos 2 de 5: `cquintero` descarga la 1.3.5 **tres veces en dos días** y `paula.barbosa` dos veces en 12 minutos; cada arranque vuelve en la versión vieja | lo mismo, por `install_id` |
| La causa, reproducida | un proceso que Ü lanzó sin carpeta de trabajo propia hereda `…\U\current`. Mientras viva, `Update.exe` no puede renombrar `current`: reintenta 10 s, da `Apply error: … one or more running processes prevented it` y relanza la **versión vieja** | banco `C:\U-banco`, Velopack 1.2.0 real, `Updater.cs` real |
| Sitios que lanzan así | **8** (`UseShellExecute = true` sin `WorkingDirectory`): navegador ×2, menú Inicio ×2, sistema, explorador ×3 | `grep` de `Process.Start` en `windows-client/src` |
| Qué caminos caen con esa causa | **los tres**: la pastilla ⬇ (vuelve vieja y la pastilla reaparece, en bucle), aplicar-al-cerrar (en silencio) y el auto-aplicar al arrancar (12 s de arranque, y vieja) | escenarios S2, S5 y S8 del banco |
| Qué caminos funcionan sin ese proceso | los tres | escenarios S1, S3 y S4 |
| Abrir Ü por segunda vez con una actualización descargada | **mata a la primera** para aplicarla: el auto-aplicar de Velopack corre antes que `GuardiaDeInstancia` | escenario S6: `Killing process: …current\Sonda.exe` |
| Versión que declara cada equipo | `1.0.0.0` en todos: es la del ensamblado, que nadie sella. No hay forma de saber qué versión corre nadie | `graph_windows_users.app_version` |
| Deltas | **ninguno**: cada actualización baja los 83 MB enteros (6 min en una red lenta). El workflow no baja la release anterior antes de empaquetar | assets de las releases; `Unable to find any delta` en `velopack_U.log`. En el banco, con la anterior delante: 3 KB frente a 2 MB |
| Token embebido | vivo, sin caducidad, 5000 peticiones/h. Sin token también contesta (repo público, 60/h). Con uno inválido: `401` — si se revoca, ninguna copia vuelve a encontrar versión | `C:\U-banco\feed-github.ps1`; `HttpRequestException` con `StatusCode = Unauthorized` |
| Qué queda en el log cuando aplicar falla | **nada** en el de Ü; solo en `%LOCALAPPDATA%\velopack\velopack_U.log`, que no viaja | los dos logs |

Lo que no se pudo medir: por qué en el equipo de `cquintero` el paquete de la 1.3.5 no estaba en disco
al día siguiente (lo volvió a bajar en 22 s). En el banco un intento fallido **no** borra el paquete.

## Por qué esto va dirigido por especificación

El actualizador se da por bueno a sí mismo: escribe «aplicando actualización y reiniciando» y muere,
así que su última palabra es siempre de éxito. Volver en la versión vieja no deja ni una línea. Es el
aprendizaje nº10 —lo peor no es que falle, es que parezca que funcionó— en el único subsistema del
que depende que llegue el arreglo de todos los demás.

**La regla del flujo, y no tiene excepciones:** ninguna línea de producción entra antes que la
promesa que la juzga. Cada fase empieza con el contrato ROTO y termina con el contrato INTACTO.

## La especificación

| # | Promesa | Fase |
|---|---|---|
| 640 | al arrancar, Ü suelta su carpeta de instalación: si la carpeta de trabajo del proceso está dentro, pasa a la primera candidata que existe y queda fuera, así que un programa que Ü abra sin carpeta propia no hereda `current` ni le impide a Velopack renombrarla; si ya estaba fuera no se toca, y una carpeta vecina cuyo nombre empieza igual no cuenta como dentro | 1 |
| 641 | un intento de aplicar deja rastro antes de empezar, y el arranque siguiente lo juzga: con la versión que se quería, «aplicada»; con la de antes, «no se aplicó» y la causa leída del log de Velopack —su línea de error, cuántas veces reintentó—; sin log, o con un log sin ese intento, lo dice tal cual en vez de inventar una causa; el rastro se consume, así que un mismo intento no se juzga dos veces | 2 |
| 642 | la versión que Ü declara es la instalada: la de Velopack cuando hay instalación y la del ensamblado solo cuando no la hay; vacío no es ausente, y sin ninguna de las dos dice «dev» | 3 |
| 643 | si GitHub rechaza el token embebido (401 o 403), Ü busca la actualización sin token en vez de rendirse; cualquier otro fallo —sin red, 404, 500— no pasa por ese camino | 4 |
| 644 | abrir Ü por segunda vez no mata a la que ya está trabajando: al arrancar, la actualización descargada se aplica solo si no hay otra Ü viva de la misma instalación —la ruta se compara sin mirar mayúsculas, y una Ü de otra carpeta no cuenta—; y tras un intento que acaba de fallar no se reintenta en ese mismo arranque, para no entrar en bucle | 5 |

| 645 | el feed se busca por el nombre nuevo del repositorio y, si GitHub contesta que no existe (404), por el anterior; una dirección guardada con un nombre viejo pasa a la nueva al cargar, y una puesta a mano se respeta | 8 |
| 646 | el botón de actualizar del panel hace el trabajo entero con un toque: con una versión lista la aplica, sin ella busca, descarga y aplica, y mientras trabaja un segundo toque no hace nada; su dibujo dice el estado —en reposo, trabajando, hay versión— y cada desenlace tiene su frase, también la del intento que no llegó a aplicarse | 7 |

Y una que cambia de enunciado: la **620** (spec 071) decía «tres botones y nada más». El dueño pidió
el cuarto el 2026-10-01 —«un icono con buen estilo como el del último panel, para que los usuarios
actualicen la app»— y ahora dice cuatro. El número se queda.

**La que cierra el asunto es la 640**: quita la causa. La 641 es la que impide que la próxima causa,
la que todavía no conocemos, vuelva a pasar meses en silencio.

### Con qué se juzga cada una

- **En el contrato** (`tests/ContratoDelGrafo/Contrato.cs`), sin pantalla ni red: carpetas temporales
  para la 640 —y un `cmd /c cd` de verdad, para ver dónde nace un hijo— y para la 641, que lleva
  pegadas en la propia prueba las líneas reales de `Update.exe` del 2026-09-30; funciones puras para
  la 642, la 643 y la 644.
- **En el banco** (`scripts/banco-de-actualizacion.ps1`), que es el nivel 4 de esta spec: una
  instalación Velopack de verdad, fuera de `%LOCALAPPDATA%`, con otro id de paquete (`USonda`) y el
  módulo `windows-client/src/Update` enlazado tal cual (`sondas/DeLaActualizacion`). El contrato no
  puede decir que `Update.exe` renombra la carpeta; el banco sí. Sus diez escenarios son la tabla de
  evidencia, y su modo `-Viejo` es el sabotaje.

## Las fases

| Fase | Pone verde | Toca | Sitios con la clase de error |
|---|---|---|---|
| 1 | 640 | `Update/CarpetaDeTrabajo.cs` (nuevo), una línea en `App.Main` | 8 lanzamientos; se arregla en 1 sitio, el proceso |
| 2 | 641 | `Update/RastroDeActualizacion.cs` (nuevo), `Updater.ApplyAndRestart` y `ApplyOnExit` | 3 caminos que aplican |
| 3 | 642 | `Updater.VersionDeclarada`, `FaceWindow.InitTelemetry`, `-p:Version` en el workflow | 1 |
| 4 | 643 | `Updater` (las 2 llamadas a `CheckForUpdatesAsync`) | 2 |
| 5 | 644 | `Update/ArranqueDeActualizacion.cs` (nuevo), `App.Main`, `GuardiaDeInstancia` usa la misma identidad | 1 |
| 6 | — (pipeline) | `windows-release.yml`: baja la release anterior para el delta, sella la versión; `WindowsAppReleaseService` y Provider Studio mandan `user_message`; `RELEASING-WINDOWS.md` | — |

| 7 | 646, 620 | `Update/BotonDeActualizar.cs` (nuevo), `FaceWindow.xaml` y su código: un botón fijo en el óvalo, y fuera la pastilla ⬇ | 2 puertas para lo mismo (🔄 y ⬇) pasan a 1 |
| 8 | 645 | `Updater` (nombres del feed), `Config` (migración), y la documentación que nombra el repo | 3 sitios con la dirección escrita |

Ninguna toca el núcleo congelado.

## Lo que NO entra

- **Aplicar sola cuando Ü lleva rato quieta.** Un equipo donde Ü no se cierra nunca sigue necesitando
  que alguien pulse el botón, que se enciende cuando hay versión. Reiniciar Ü sin que nadie lo pida
  exige saber con certeza que no está grabando una consulta ni en mitad de una tarea, y eso no está
  medido: se queda fuera hasta medirlo.
- **Que la narración de la versión no se corte.** Ü dice qué trae la versión y reinicia a los 2,2 s;
  con la voz abierta, la frase no llega a terminar.
- **Sacar los datos de la persona de la raíz de Velopack.** Lecciones, skills, recuerdos y logs viven
  en `%LOCALAPPDATA%\U`, que es la carpeta que el desinstalador borra entera. Es un hallazgo serio
  (ver abajo) y es otra rama: mudar datos de sitio necesita su propia migración.
- **Firma de código.** Sigue sin certificado.
- **Arreglar las máquinas que ya tienen la 1.3.6 con un hijo vivo.** No se puede desde fuera: se
  curan solas en el primer arranque sin programas abiertos por la Ü anterior (tras reiniciar el
  equipo, como tarde), porque el paquete se queda en disco.

## Hallazgos

- **2026-09-30 · Desinstalar borra lo aprendido.** A las 22:07, otra sesión desinstaló la Ü de esta
  máquina para reinstalarla desde un instalador local, y `Update.exe` se llevó `%LOCALAPPDATA%\U`
  entera: dos minutos borrando lecciones, skills, recuerdos y logs. «Desinstalar y volver a instalar»
  es justo lo que hace quien no consigue actualizar.
- **2026-09-30 · Una sesión de Claude ve otro `%LOCALAPPDATA%`.** La app de escritorio de Claude es un
  paquete MSIX: lo que un proceso suyo escribe nuevo en `%LOCALAPPDATA%` va a una vista privada. Una
  Ü lanzada desde una sesión descargó la 1.3.6 a las 10:16 y la Ü que abrió el dueño a las 22:00 no
  la vio y la bajó otra vez. Para probar instalaciones, fuera de AppData.
- **2026-09-30 · El `RELEASING-WINDOWS.md` promete deltas que no existen** y describe el feed de un
  bucket de Supabase en `publish-release.ps1`, que ya no es el camino.

- **2026-09-30 · El arranque de la actualización pidió la carpeta de Windows por su cuenta** y la
  promesa 522 lo cazó en la primera tanda verde. El log de `Update.exe` vive en el `%LOCALAPPDATA%`
  de verdad aunque haya `U_DATA_DIR`: ahora se pide por `UserPaths.LocalDeWindows`, que lo dice.
- **2026-09-30 · La pastilla no depende de la voz.** `Speak` es disparar y olvidar: sin sesión de voz
  escribe una línea y sigue, así que el aplicar no se queda esperando. Pero con la voz viva la
  narración tiene 2,2 s antes de que el proceso muera: se corta. Es de la fase de experiencia.
- **2026-09-30 · El escenario S7 del banco estaba mal hecho la primera vez**: abría `sq.version` en
  exclusiva, y con eso la app ni sabía que estaba instalada. Salió MAL por el banco, no por el código.

## Evidencia (2026-09-30)

**Contrato.** Rojo antes del código: cinco `⧗ PENDIENTE`, las 640-644, y el resto intacto. INTACTO
después, 0 pendientes. **Sabotaje, comprobado que se aplicó** (un guion que cuenta el ancla y relee
el archivo): la comparación por prefijo de texto, `FindIndex` en vez de `FindLastIndex`, `!= null` en
vez de `IsNullOrWhiteSpace`, sin el `ibaConToken` y sin el `acabaDeFallar` → las cinco rojas, cada
una por su frase.

**Banco, con Velopack 1.2.0 de verdad** (`scripts\banco-de-actualizacion.ps1 -ConGitHub`, 263 s):

| | Escenario | Con el arreglo | Modo `-Viejo` (como la 1.3.6) |
|---|---|---|---|
| S1 | pastilla, sin nada más abierto | BIEN · dice «aplicada: 9.0.1 → 9.0.2 (pastilla)» | BIEN, sin decir nada |
| S2 | pastilla, con un programa abierto por la app | BIEN · 1 intento | **MAL** · 4 intentos en bucle, sigue en 9.0.1 |
| S3 | el proceso muere (apagón) y se reabre | BIEN · «(al arrancar)» | BIEN |
| S4 | cierre ordenado: se aplica al salir | BIEN · «(al cerrar)» | BIEN |
| S5 | se reabre con un programa de la sesión anterior vivo | BIEN · 4 s | **MAL** · 12 s de arranque, y vieja |
| S6 | segunda apertura con la actualización descargada | BIEN · la primera sigue viva, y lo dice | **MAL** · mata a la primera |
| S7 | candado ajeno (un archivo de `current` abierto por otro) | BIEN · no aplica, y **lo dice con la causa** | **MAL** · silencio |
| S8 | cierre ordenado con un programa abierto por la app | BIEN | **MAL** · silencio, sigue en 9.0.1 |
| S9 | dos versiones atrás y deltas anunciados que no están | BIEN · cae al paquete completo | BIEN |
| S10 | token embebido que GitHub rechaza (contra el repo real) | BIEN · «GitHub rechazó el token… busco sin token» | — |

10 de 10 con el arreglo; 4 de 9 en modo viejo, y las cinco que caen son las cinco esperadas.

**La carita de verdad** (el build de la rama, empaquetado como `UBanco` 9.1.1 → 9.1.2, instalado en
`C:\U-banco\realinst` con sus datos aparte; 3 caminos, no 1):

```
[22:50:47] update: carpeta de trabajo: de «C:\U-banco\realinst\current» a «C:\Users\felip», para no sujetarle la instalación a Update.exe
[22:50:59] update: versión 9.1.2 descargada y lista para aplicar
            (se mata el proceso y se reabre)
[22:51:01] update: al arrancar: la 9.1.2 está descargada y no hay otra Ü trabajando; se aplica
[22:51:17] update: actualización aplicada: 9.1.1 → 9.1.2 (al arrancar)

[22:51:55] update: aplicando actualización pendiente al salir            (WM_CLOSE a sus 3 ventanas)
[22:51:59] update: actualización aplicada: 9.1.1 → 9.1.2 (al cerrar)

[22:52:28] update: la 9.1.2 está descargada y no se aplica en este arranque: hay otra Ü de esta instalación trabajando y aplicar la cerraría
            (la primera, pid 38828, sigue viva; en disco 9.1.1)
```

El paquete viajó por **delta** en los tres: 0,2 MB entre dos builds iguales, aplicado y con la suma
comprobada. El `-p:Version` sella el binario: `U.exe` dice `9.1.1.0`.

**El workflow, ensayado en local con la release real**: `vpk download github` baja la 1.3.6 (79 MB,
176 s en esta red) y `vpk pack` de la rama encima deja `U-1.3.7-delta.nupkg` de **10,8 MB** frente a
los 77 del completo.

**Graph**: `node scripts/verify-windows-release.js` → OK; con el código de `main`, FALLÓ por «el
dispatch no lleva user_message, que el workflow exige: GitHub contestaría 422».

### Lo que NO se probó, dicho como tal

- **La pastilla ⬇ pulsada en la carita.** El camino que recorre (`ApplyAndRestart`) es el de S1, S2 y
  S7, pero el clic en la ventana de verdad no se dio: el muelle se despliega con el cursor encima y
  había alguien usando el PC.
- **Una release de verdad recibida por una instalación de verdad.** No se publicó nada: publicar le
  llega a todos los equipos y lo decide el dueño. Tampoco corrió el workflow modificado en GitHub.
- **La transición desde la 1.3.6.** La 1.3.6 instalada aplica con SU código, que es el modo viejo:
  llega si no hay un programa abierto por ella, y si lo hay, en el primer arranque sin él.
- **Otros equipos.** Todo se midió en una máquina. Un antivirus de empresa que no deje a `Update.exe`
  tocar la carpeta no se puede reproducir aquí; ahora, si pasa, la línea «NO se aplicó» lo trae.

## Cierre

- [x] Todas las promesas verdes (`.\scripts\contrato-del-grafo.ps1` → CONTRATO INTACTO)
- [x] Sabotaje de cada una, comprobado que se aplicó
- [x] Los diez escenarios del banco en verde con la sonda; tres caminos con la carita
- [ ] La pastilla pulsada en la carita de verdad
- [ ] Una release de verdad recibida por una instalación de verdad
- [ ] Estado de este documento: **implementado** (AAAA-MM-DD)
