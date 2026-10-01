# Plan de implementación: cada instalación tiene su credencial, y la clave del instalador solo sirve para presentarse

Estado: **implementado en la rama, sin encender** (2026-09-30) · Nace del diagnóstico del 2026-09-30 · Rama: `jose/cada-instalacion-con-su-credencial`

> Spec 076. Cruza `apps/windows` y `services/graph`: una sola rama y un solo PR (regla 4 del monorepo).
> Nace de una petición del dueño —«vamos a instalar en usuarios finales y todas las APIs deben ir
> correctamente, supongo que en el backend de Graph»— y de lo que se midió al ir a mirarlo.

## Diagnóstico: qué se midió

| Qué | Medida | Fuente |
|---|---|---|
| El instalador es público | `U-win-Setup.exe` de la v1.3.6 contesta **HTTP 302 sin credenciales**; el repo es `PUBLIC` | `curl -I` anónimo y `gh repo view`, 2026-09-30 |
| Qué lleva embebido | la clave de Graph, la de Gemini y el token de actualizaciones: los tres secretos existen en el repo y el workflow los inyecta | `gh secret list` y `windows-release.yml`, 2026-09-30. **No se abrió el binario** |
| Qué da esa clave de Graph | `GET /api/v1/agent/claves` devuelve **las claves crudas** de OpenAI (164 caracteres) y TypeSafe (108) | llamada real a `graph-eight-pied`, 2026-09-30 |
| Quién puede pedirlas | cualquier API key válida: `AGENT_KEYS_ALLOWED_LABELS` **no está puesta** en producción | variables del proyecto `graph` en Vercel, 2026-09-30 |
| Qué clave de OpenAI se reparte | `OPENAI_API_KEY`, la misma que usa Graph para su propio LLM | `registerPublicApiRoutes.js` → `AGENT_KEYS` |
| Qué más abre esa clave | **todo** `/api/v1`: turnos del agente, pipeline, biopsia, y `operations/exports/claim`, que entrega notas clínicas firmadas | `web/server.js:609` y `registerNoteExportRoutes.js:144`. **No se probó el claim**: reclamaría un trabajo real |
| Cuántas instalaciones comparten la clave | todas: una sola clave embebida, sin identidad por instalación | `GraphConfig.BakedDefaultApiKey` |
| Clave de Gemini embebida | nadie la lee desde que la voz pasó a GPT-Live | `grep GeminiDefaultApiKey` → 3 líneas, las 3 en el `.csproj` |
| Clientes HTTP que hablan con Graph | **6** (`GraphClient`, `BackendClient`, `EjecutorDeExportaciones`, `RellenadorSap`, `DictadoEnVivo`, `ClavesDelBackend`) | `grep -rn "X-API-Key"`, 2026-09-30 |
| Voz efímera con GPT-Live | no existe: `/v1/live/client_secrets` da 404 | medido el 2026-09-18, `liveVoiceProxy.js` |
| De dónde sale la producción de Graph | `graph-eight-pied` sigue saliendo del repo viejo; el monorepo despliega a `miracle-graph` | `docs/monorepo/despliegue.md` |

**La cadena entera, en una línea:** instalador público → clave de Graph embebida → `/agent/claves` →
claves de pago de OpenAI y TypeSafe. No hace falta ser usuario: basta descargar el instalador.

La spec 045 dejó escrito que las claves «viajan a la memoria del cliente» y que eso era el corte
siguiente. Lo que la 045 no sabía es que el repo iba a ser público. Con el instalador público, la
clave embebida es pública **por construcción**, y todo lo que esa clave abre también.

## Por qué esto va dirigido por especificación

Porque el fallo es de los que parecen funcionar. Una instalación nueva tiene voz y tiene Jev, así que
«las claves ya están en el backend» parece cierto — y lo es, para cualquiera que las pida. Una prueba
escrita después comprobaría que la instalación recibe sus claves, que es justo lo que ya pasa.

**La regla del flujo, y no tiene excepciones:** ninguna línea de producción entra antes que la
promesa que la juzga. Cada fase empieza con el contrato ROTO y termina con el contrato INTACTO.

## El diseño, en cuatro frases

1. **El instalador solo sabe presentarse.** Con la clave embebida, una instalación nueva hace
   `POST /api/v1/agent/enroll` y recibe una credencial propia. Graph guarda su huella, no la credencial.
2. **Nadie se aprueba solo.** La instalación nace `pendiente`. Un administrador la aprueba en
   Provider Studio, como ya se hace con la voz de Android. El correo se teclea sin verificar, así que
   aprobar por correo sería dejar la puerta abierta.
3. **La compuerta se enciende por etiqueta.** `WINDOWS_DEVICE_GATE_LABELS` nombra las claves que solo
   sirven para presentarse. Vacía (por defecto), nada cambia: se puede desplegar sin romper a nadie.
4. **Revocar es de una en una.** Una instalación revocada queda fuera sin tocar a las demás.

Es el plan que ya estaba escrito y sin implementar en
`services/graph/web/public/studio-docs/autenticacion-interna-plan.md`.

## La especificación

### Windows — `apps/windows/tests/ContratoDelGrafo/Contrato.cs`

| # | Promesa | Fase que la pone verde |
|---|---|---|
| 680 | una instalación sin credencial se presenta a Graph UNA vez —con la clave embebida y diciendo quién es— y guarda la credencial que recibe; con credencial guardada no se vuelve a presentar, y sin correo todavía no se presenta | 2 |
| 681 | la credencial de la instalación viaja en cada petición a Graph y en ninguna a otro sitio; sin credencial no viaja nada | 3 |
| 682 | la credencial no aparece en el log ni en el estado, y lo que queda en disco no la lleva en claro | 2 |
| 683 | una instalación que espera aprobación, una revocada y una que no pudo presentarse se dicen cada una con su nombre, y la que espera da el código con el que el administrador la reconoce | 2 |
| 684 | no poder presentarse no tumba la app ni deja nada guardado a medias: la siguiente vez que se pide se vuelve a intentar, una vez por petición y nunca en bucle | 2 |
| 685 | mientras espera aprobación pregunta de vez en cuando y deja de preguntar en cuanto la aprueban o la revocan; si Graph ya no la conoce, se vuelve a presentar | 2 |
| 686 | los seis clientes HTTP que hablan con Graph llevan el sello de la instalación: ninguno se queda sin él | 3 |
| 687 | unas claves negadas porque la instalación espera aprobación se dicen como espera y no como clave que falta, y se vuelven a pedir cuando hacen falta en vez de darse por perdidas | 4 |
| 688 | el instalador no lleva embebida ninguna clave de terceros: en el binario solo viajan la clave para presentarse y el token de actualizaciones | 5 |

### Graph — `services/graph/scripts/verify-windows-devices.js`

| # | Promesa |
|---|---|
| G1 | presentarse da una credencial que se ve una sola vez: en la base queda su huella, no ella |
| G2 | una instalación nueva nace pendiente: ni el correo ni presentarse otra vez la aprueban |
| G3 | con la compuerta apagada, que es como nace, nada cambia: la clave embebida entra como hoy |
| G4 | con la compuerta puesta a una etiqueta, esa clave sola solo sirve para presentarse y para preguntar su estado; todo lo demás de `/api/v1` contesta 403 con el código que dice por qué |
| G5 | una instalación aprobada entra, y revocarla la deja fuera sin tocar a las demás |
| G6 | las claves de otras etiquetas —portal, extensión, ejecutor— no pasan por la compuerta |
| G7 | si no se puede comprobar la instalación, la compuerta se cierra: 503, no se deja pasar |
| G8 | ni la credencial ni su huella salen en el log, ni en la lista del panel |
| G9 | presentarse tiene tope por IP |
| G10 | aprobar y revocar exige ser administrador del panel |

**La que cierra el asunto es la G4.** Mientras la clave embebida abra algo más que presentarse, todo
lo demás es cosmético: el instalador público sigue siendo una llave.

### Con qué se juzga cada una

- **680–685, 687:** objetos construidos a mano en la propia prueba. A la credencial se le inyectan el
  disco, la red y el log, igual que a `ClavesDelBackend` en la promesa 300: sin red y sin pantalla.
- **682:** el almacén de verdad (DPAPI) sobre un archivo temporal. Se leen los bytes que quedaron.
- **686:** por reflexión sobre los seis clientes: se mira el manejador que lleva cada `HttpClient`.
- **688:** por reflexión sobre los atributos `AssemblyMetadata` de `U.dll` y `U.Graph.dll`.
- **G1–G10:** Express de verdad con un Supabase de mentira debajo, como `verify-agent-decisor.js`.

## Las fases

### Fase 1 — Graph sabe quién es cada instalación

| | |
|---|---|
| **Promesa que pone verde** | G1–G10 |
| **Qué toca** | `services/graph`: migración `graph_windows_devices`, `WindowsDeviceService.js`, `registerWindowsDeviceRoutes.js`, `web/server.js`, `scripts/verify-windows-devices.js`, `package.json`, `.env.example` |
| **¿Núcleo congelado?** | no |
| **Terminado** | `verify-windows-devices.js` en verde y `npm test` igual que antes |

### Fase 2 — Ü se presenta y guarda su credencial

| | |
|---|---|
| **Promesa que pone verde** | 680, 682, 683, 684, 685 |
| **Qué toca** | `windows-graph/src/Instalacion/CredencialDeInstalacion.cs`, `AlmacenProtegido.cs` |
| **¿Núcleo congelado?** | no |
| **Terminado** | esas cinco verdes, las anteriores intactas |

### Fase 3 — la credencial viaja en todo lo que va a Graph

| | |
|---|---|
| **Promesa que pone verde** | 681, 686 |
| **Qué toca** | `windows-graph/src/Instalacion/SelloDeInstalacion.cs`, y los 6 clientes |
| **Sitios con esta clase de error** | 6 (contados con grep el 2026-09-30) |
| **Terminado** | 681 y 686 verdes |

### Fase 4 — esperar aprobación se dice, y se sale de ella sin reinstalar

| | |
|---|---|
| **Promesa que pone verde** | 687 |
| **Qué toca** | `ClavesDelBackend.cs`, `ConversacionEnVivo.cs`, y el arranque en `FaceWindow.xaml.cs` |
| **¿Núcleo congelado?** | no. `FaceWindow` es zona de choque: pocas líneas y una sola rama abierta |
| **Terminado** | 687 verde; corrida a mano contra un Graph local con la compuerta puesta |

### Fase 5 — el instalador deja de llevar la clave de Gemini

| | |
|---|---|
| **Promesa que pone verde** | 688 |
| **Qué toca** | `WindowsClient.csproj`, `.github/workflows/windows-release.yml` |
| **Terminado** | 688 verde |

### Fase 6 — el panel aprueba y revoca

| | |
|---|---|
| **Promesa que pone verde** | G10 (ya verde desde la fase 1); esta fase es la pantalla |
| **Qué toca** | `services/graph/web/public/provider-studio.*` |
| **Terminado** | la tarjeta «Instalaciones» lista, aprueba y revoca contra un Graph local |

## Cómo se enciende, en orden

La rama se puede mergear y desplegar sin encender nada. Encender es del dueño, y va en este orden:

1. Aplicar la migración `graph_windows_devices` en Supabase.
2. Desplegar Graph. La compuerta nace apagada: nada cambia.
3. Sacar una versión de Windows con esta rama. Las instalaciones se actualizan solas, se presentan y
   aparecen como pendientes en Provider Studio.
4. Aprobar las que se conocen.
5. Poner `WINDOWS_DEVICE_GATE_LABELS` con la etiqueta de la clave embebida y redesplegar. Desde aquí
   el instalador público, solo, no abre nada.
6. Rotar lo que estuvo al alcance: la clave de OpenAI, la de TypeSafe y la de Gemini.

Hasta el paso 5, las claves siguen al alcance de cualquiera con el instalador.

## Lo que NO entra

- **Que las claves de terceros no salgan nunca de Graph.** Con esta spec una instalación aprobada
  sigue recibiendo las claves crudas en memoria. Es la spec siguiente (073), y tiene dos partes de
  coste distinto. Lo que es petición y respuesta —Jev, los planes de Luna, cardio, las fotos— se pasa
  por Graph, y Android ya lo hace con `/api/v1/agent/decidir`; falta medir cuánto le cuesta el salto
  al ciclo de Jev, que hoy va a ~180 ms. La voz no tiene credencial efímera (medido el 2026-09-18),
  así que solo queda un relé, y el de Vercel corta a los 285 s en el plan actual: es una decisión de
  infraestructura del dueño, no de código.
- **El token de actualizaciones.** El repo es público, así que ya no hace falta para leer releases,
  pero sin él GitHub limita a 60 consultas por hora por IP, y un hospital sale por una sola. Se queda.
- **El `ClientToken` del backend viejo** (`Config.cs`). Está en un repo público. Quitarlo del código
  no lo des-publica: lo que toca es apagar o rotar `u-windows-backend`, y eso es del dueño.
- **`u/App`**, que pide las claves por su cuenta (`u/Nucleo/Claves.cs`). No se distribuye.

## Lo que se rompió a propósito (paso 5)

Las dos baterías salieron verdes a la primera, que es justo cuando no significan nada. Se saboteó de a
uno, comprobando que cada sabotaje se aplicaba (el texto viejo aparece exactamente una vez) y
restaurando desde una copia, no con git.

| Lado | Sabotajes | Resultado |
|---|---|---|
| Graph | 14: guardar la credencial en claro, obedecer el `status` del cuerpo, compuerta encendida de nacimiento, dejar pasar sin credencial, dejar pasar a una pendiente, dejar pasar a una revocada, memoria que no caduca, compuerta para todas las etiquetas, abrir con la base caída, credencial en el log, huella en la lista, alta sin tope, revocar sin ser admin, escribir cualquier estado | 14 de 14 pusieron roja su promesa |
| Windows | 14, en cuatro tandas: presentarse teniendo credencial, presentarse sin correo, sello a cualquier host, cabecera vacía sin credencial, almacén en claro, credencial en el log, fallo sin causa, reintentos seguidos, insistir ante un 404, seguir preguntando ya aprobada, no olvidar la desconocida, un cliente sin sello, claves dadas por perdidas, sitio para la clave de Gemini | 14 de 14, y ninguna promesa ajena se puso roja |

## La corrida sobre el PC real (paso 6)

El 2026-09-30, con el `web/server.js` de Graph entero corriendo en local con la compuerta puesta
(`WINDOWS_DEVICE_GATE_LABELS=windows-instalador`) sobre un PostgREST de mentira, y una Ü de pruebas
(`C:\U-versiones\instalacion\U.exe`, datos aparte) apuntando a él. Las otras Ü abiertas no se tocaron.

```
22:52:37  clave del instalador sola · GET /api/v1/agent/claves -> 403 instalacion_sin_credencial
22:52:37  clave del instalador sola · GET /api/v1/workflows -> 403 instalacion_sin_credencial
22:52:37  clave del instalador sola · POST /api/v1/operations/exports/claim -> 403 instalacion_sin_credencial
22:52:37  clave de OTRA etiqueta (portal) · GET /api/v1 -> 200
[22:53:14] instalacion: esta instalación espera aprobación · código D976-0733          <- log de Ü
[agent/enroll] alta device=d9760733… estado=pendiente                                    <- log de Graph
[agent/gate] etiqueta=windows-instalador code=instalacion_pendiente device=d9760733…     <- peticiones de Ü, ya selladas
[22:53:18] workflow-ui: ListWorkflowsAsync falló: Esta instalación espera la aprobación de un administrador. (HTTP 403)
22:53:23  panel: D976-0733 (nivel4@instalacion.test) -> aprobada: HTTP 200
[22:53:34] instalacion: instalación aprobada · código D976-0733                         <- 11 s, sin reiniciar
           (se cierra Ü y se abre otra vez)
[22:53:55] instalacion: instalación aprobada · código D976-0733                         <- sale del disco
           altas en el log de Graph tras el reinicio: las mismas 3 de antes, ninguna nueva
22:54:05  panel: D976-0733 (nivel4@instalacion.test) -> revocada: HTTP 200
[22:54:05] instalacion: el acceso de esta instalación fue revocado · código D976-0733   <- en la siguiente petición
```

El archivo de la credencial (`instalacion-7de2046a.bin`, 310 bytes) no contiene `udev_` ni `token`
leído como texto. La tarjeta «Instalaciones» de Provider Studio se abrió en el navegador contra ese
mismo Graph: listó las tres, y «Aprobar» sobre D976-0733 la dejó en «Aprobada · decidió nivel4».

**Lo que esta corrida NO probó, y se dice:** que Ü pida las claves a Graph después de aprobada. En
esta máquina `OPENAI_API_KEY` y `TYPESAFE_API_KEY` están puestas como variables de usuario, y la del
entorno manda (promesa 300), así que Ü no las pide. Ese camino lo juzgan la 687 en el contrato y, del
lado de Graph, una llamada real con una instalación aprobada (`claves -> 200`, sirve `openai` y
`typesafe`). Tampoco se probó contra Supabase de verdad: la migración está escrita y sin aplicar. Y
se probó en UNA máquina: es un dato incompleto.

## Hallazgos

- **2026-09-30 — `verificar.ps1` exige el árbol commiteado** y se salta el contrato si no lo está. La
  tabla de evidencia de la compuerta queda pendiente del commit; lo de arriba salió de correr
  `contrato-del-grafo.ps1` directo (376 verdes, 0 rojas), el contrato de la voz (46/46) y `npm test`.
- **2026-09-30 — la 686 cuenta seis clientes, no «todos».** Un séptimo cliente HTTP hacia Graph que
  se escriba mañana sin `RedDeGraph.Cliente` no lo caza nadie hasta que falle con 403.
- **2026-09-30 — que espera aprobación se dice en la línea de estado, que se pisa.** La persona lo ve
  al abrir Ü y otra vez al pedir la voz, pero no hay un aviso que se quede puesto. Es interfaz, zona de
  choque, y va en su propia rama.
- **2026-09-30 — revocar tarda hasta un minuto en las otras instancias de Vercel.** Es el precio de
  no ir a la base en cada petición. En la instancia que revoca es inmediato.
- **2026-09-30 — `Config.BackendUrl` y `GraphConfig.BaseUrl` son dos ajustes para el mismo Graph.** El
  sello sigue al segundo. En producción apuntan al mismo sitio; con uno cambiado a mano, lo que vaya
  por el otro viaja sin credencial.
- **2026-09-30 — el instalador es público.** `Updater.cs` y `Config.cs` siguen diciendo «el
  repositorio es privado». Lo era cuando se escribieron.
- **2026-09-30 — la clave embebida abre la cola de exportaciones.** `operations/exports/claim` acepta
  cualquier API key válida. La compuerta lo cierra para la clave embebida; un ejecutor de verdad
  necesita su propia etiqueta, o ser una instalación aprobada.
- **2026-09-30 — la clave de OpenAI que se reparte es la del propio Graph.** Rotarla es rotar también
  el LLM de Graph. Separarlas es un cambio de una variable y va en el paso 6.

## Cierre

- [x] Todas las promesas verdes (`.\scripts\contrato-del-grafo.ps1` → CONTRATO INTACTO, 376 verdes)
- [x] `node scripts/verify-windows-devices.js` en verde (10 de 10), y `npm test` como antes
- [ ] `.\scripts\verificar.ps1` pasa, con evidencia en `out\evidencia.md` — falta commitear
- [x] Corrida a mano contra un Graph local con la compuerta puesta: pendiente → aprobada → revocada
- [ ] Encendido en producción, en el orden de «Cómo se enciende»
- [x] Estado de este documento: **implementado en la rama** (2026-09-30)
