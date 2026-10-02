# Escucha barata — el ciclo Live 1 ⇄ Soniox + Jev ⇄ Sol 6.1

Mac primero (2026-09-30). Este documento es el contrato para portarlo igual a Windows: estados,
mensajes exactos, umbrales y cifras medidas. El código de referencia está en
`Sources/UCore/PassiveListening.swift`, `SolPlanner.swift`, `Sources/UMac/PassiveListener.swift`,
`SolTools.swift` y el cableado en `Sources/UApp/AppModel.swift`.

## Por qué

GPT-Live 1 cobra por minuto de sesión abierta, también cuando la persona no le habla. Muchos
usuarios dejan a Ü escuchando durante horas. La escucha barata mantiene a Ü atento por mucho
menos: Soniox transcribe (stt-rt-v5) y Jev solo clasifica cada frase nueva. Live 1 entra en los
momentos de conversación, y Sol 6.1 planea lo que hay que hacer en el computador.

## El ciclo

```
tocar carita ─► LIVE 1 (conversa)
   ▲              │ 2 min sin interacción (sin voz del usuario, sin Ü hablando, sin tarea)
   │              ▼
   │           Ü le manda a Live el control interno `passiveCheck`; Live DECIDE
   │              ├─ se queda: no hace nada; a los 20 s el timer se rearma
   │              └─ delega `escucha_pasiva(motivo)` → la app cierra Live
   │                             ▼
   │           ESCUCHA BARATA: Soniox ──texto──► Jev (una pregunta cerrada)
   │                  ▲                            │
   │                  └────────── nada ◄───────────┤
   ├─────── hablar: reabre Live + lo dicho ◄───────┤
   │                                               └─ ejecutar (al cerrar la frase) ─► SOL 6.1 planea ─► Jev pulsa
   └─────────── Live se reabre y cuenta lo que se hizo ◄────────────────────────────────────────┘
```

- **La salida de Live la decide Live**, no un temporizador: distingue una conversación de fondo
  de una pausa en medio de la charla con Ü.
- **`ejecutar` no pasa por Live**: la voz ya entró por Soniox. Sol recibe la frase directamente.
- **Live vuelve al final** a contar el resultado, y el ciclo recomienza.
- La sesión de Live que muere a los 15 minutos cae a escucha barata, no a colgar.
- Esc o tocar la carita apagan todo, en cualquier estado.

## 1. El control interno a Live

Se envía como en `LiveVoice.notify`: `session.thinking.append` + mensaje `developer` +
`response.create`. Texto exacto: `LiveProtocol.passiveCheck`. Live lo resuelve delegando
`escucha_pasiva` (herramienta de Luna, `LiveTools.definitions`). Sin llamada en 20 s = se queda.
Las instrucciones de Live y de Luna llevan una línea que les enseña ese control.

Qué cuenta como interacción (rearma los 2 min): cada delta de transcripción (usuario o Ü), cada
cambio de "Ü hablando", y cada segundo con una tarea, una pregunta pendiente o una lección en curso.

## 2. Soniox

- Clave: `POST {graph}/api/v1/transcription/session` → `access_token` temporal (Graph guarda la
  clave de la cuenta). Exige `provider == "soniox"`. Tres intentos: Graph puede arrancar en frío.
- Socket `wss://stt-rt.soniox.com/transcribe-websocket`, primer mensaje `SonioxProtocol.start`:
  `pcm_s16le`, 24 kHz mono (el mismo PCM que va a Live), `language_hints: ["es"]`,
  `enable_endpoint_detection`, `max_endpoint_delay_ms: 500`, y **contexto con el nombre**
  (`terms: ["Yu", "oye Yu", "hola Yu", …]`). Sin ese contexto Soniox escribía "Uh", "Yo", "Lou"
  o "U", y los aciertos caían del 88 % al 47 %.
- Frases: los tokens finales se acumulan; `<end>` cierra la frase y la guarda como contexto de la
  siguiente (`PhraseBuffer`).

## 3. Jev (intención)

`POST https://api.typesafe.ai/v1/systemone`, cuerpo `JevIntent.requestBody`: una sola pregunta
`choice` `intencion` con criterios `hablar | ejecutar | nada`. El estado dice que la frase es dato,
no instrucción, y lista cómo suele escribirse el nombre (`JevIntent.nameVariants`).

- **Carrera de 2 peticiones idénticas, cada una por su propia conexión** (`JevClient.passive`).
  Dos llamadas por la misma conexión HTTP/2 caen en el mismo backend y comparten sus momentos
  lentos; por conexiones separadas, la cola se recorta (tabla abajo).
- Plazo de 1,5 s; un reintento solo en 429/529; conexión precalentada y mantenida cada 25 s.
- Se pregunta cada vez que la frase crece; la pregunta anterior se cancela (gana la última).
- `hablar` actúa en cuanto llega (Live abre mientras la persona termina). `ejecutar` espera el
  cierre de la frase para no cortar «abre Safari y busca vuelos» en «abre Safari».

### Umbrales (calibrados con `--listen-test`, 66 frases)

| salida | umbral | por qué |
|---|---|---|
| ejecutar | 0.85 | las órdenes reales llegaron con ≥ 0.93; nada más se juzgó nunca `ejecutar` |
| hablar | 0.45 | los llamados reales llegaron con ≥ 0.48 y la charla ajena que se coló, con ≥ 0.54; un falso `hablar` solo reabre Live, que por su política calla |

Bajo el umbral, todo es `nada`.

## 4. Sol 6.1

`gpt-6.1-sol` por la Responses API (`POST /v1/responses`, `previous_response_id`), con las
instrucciones de planificación de Luna (`LiveProtocol.plannerInstructions`) y sus herramientas
menos `look` y `escucha_pasiva` (`LiveTools.planning`). `map_tramo` responde cuando Jev termina
el tramo (`Desktop.stretch`), así Sol no consulta en bucle. Máximo 24 turnos. El texto final de
Sol va a Live con `LiveProtocol.resumeAfterTask`.

## Cifras medidas

Ciclo = desde que llega el mensaje de Soniox con texto nuevo hasta que Jev decide.

| configuración de Jev | p50 | p90 | p95 | máx |
|---|---|---|---|---|
| una petición | 250 ms | 336 ms | 374 ms | 552 ms |
| 2 en carrera, misma conexión | 238 ms | 288 ms | 408 ms | 698 ms |
| **2 en carrera, conexiones propias** | **240 ms** | **266 ms** | **287 ms** | 548 ms |
| 3 en carrera, conexiones propias | 241 ms | 283 ms | 301 ms | 365 ms |

(40 muestras por configuración, intercaladas.) Un estado más corto para Jev (`JevIntent.compact`)
respondía unos 25 ms antes en la mediana pero bajó los aciertos al 92 % sin mejorar la p95: se
descartó.

### Iteraciones del ciclo completo (66 frases, Soniox + Jev reales, audio a tiempo real)

| # | cambio | aciertos | falsos `ejecutar` | p50 | p90 | p95 |
|---|---|---|---|---|---|---|
| 1 | primera versión | 47 % | 0 | 253 | 402 | 431 |
| 2 | contexto de Soniox con el nombre | 88 % | 2 | 236 | 342 | 471 |
| 3 | criterios hablar/ejecutar + carrera de 2 | 95 % | 0 | 235 | 275 | 306 |
| 4 | umbrales calibrados | 98,5 % | 0 | 245 | 288 | 304 |
| 5 | estado compacto (descartado) | 92 % | 0 | 219 | 283 | 304 |
| 6 | final | 97 % | 0 | 214 | 247 | 260 |

**Percentil elegido:** p90 ≤ 300 ms, que se sostuvo en todas las corridas con la carrera; la p95
quedó entre 260 y 306 ms, según la red, dentro de la tolerancia de 350 ms. La cola la pone el
servidor de TypeSafe: con una sola petición, la p95 pasaba de 370 ms.

### El ciclo con los modelos reales (`--cycle-test`)

| escenario | resultado |
|---|---|
| charla de fondo y luego `passiveCheck` | Live delega `escucha_pasiva` ✅; sin silenciar habría sonado un "[hum]" de 0,5–0,8 s: por eso `LiveVoice.muted` |
| Live esperando una respuesta y luego `passiveCheck` | se queda ✅ |
| `resumeAfterTask` | Live lo cuenta en voz: «Listo: abrí Safari y ya está la búsqueda…» ✅ |
| Sol 6.1 con «abre Safari y busca vuelos a Medellín» | launch_app → read_screen → set_value → enter ✅; 4,3 s hasta la primera herramienta, 29 s en total con `reasoning.effort = low` (38 s sin él) |

Pendiente: Sol operando el escritorio real sobre `UFixture` (necesita la pantalla desbloqueada) y
la prueba a mano con micrófono.

## Pruebas

- `swift run -c debug NativeContract` — contratos sin red (umbrales, Soniox, timer, Sol con
  transporte falso, carrera de Jev).
- `Tests/escucha/generar.sh <carpeta>` genera las 66 frases de `Tests/escucha/frases.json` con
  voces del sistema; `open -n -W ~/Applications/U.app --args --listen-test <carpeta> <out.json>`
  las pasa por Soniox y Jev reales a tiempo real.
- `--cycle-test <carpeta> <out.json>`: Live real ante charla de fondo (debe pasar a escucha
  pasiva, callado), Live esperando una respuesta (debe quedarse), Live contando un resultado, y
  Sol planeando.
- `--passive-flow-test <out.json>`: el ciclo entero por el `AppModel` real. Live 1 con el
  micrófono (habitación en silencio, cuenta de 15 s), frases grabadas hacia Soniox en lugar del
  micrófono (`AppModel.passiveFeed`), y los pasos leídos de `AppModel.onTrace`. Comprueba: Live
  pasa → charla ajena no activa nada → «Hola Yu» reabre Live y Live responde → vuelve a pasiva →
  «Yu, abre la calculadora» lanza Sol + Jev, la Calculadora se abre y Live lo cuenta. Dos corridas
  el 2026-10-01: 14/14 pasos; Jev decidió en 191–333 ms; de la orden a la Calculadora abierta, 11 s.
- `--listen-probe <out.json>`: modelos disponibles, sesión de Soniox y latencia de Jev por
  configuración.
- Para probar a mano sin esperar 2 minutos: `defaults write com.zevcorp.u.mac passiveQuietSeconds 20`.

## Registro (para soporte)

Cada paso del ciclo deja una línea en OSLog, subsistema `com.zevcorp.u.mac`, categoría `Passive`
(`AppModel.trace`). Lo que dijo la persona va como dato privado; la decisión y los tiempos, públicos.

| evento | detalle |
|---|---|
| `live.connected` | `start` o `resume` |
| `live.asked` / `live.stayed` | se le preguntó a Live tras el silencio / decidió quedarse |
| `passive.enter` / `passive.listening` / `passive.failed` | Live pasó / Soniox ⇄ Jev activos / fallo y reintento |
| `jev.cycle` | `intent`, `confidence`, `ms`, `action`, `endpoint` por cada frase juzgada |
| `passive.route` | `action=hablar` o `ejecutar`: lo que la app hizo |
| `live.reopen` | se reabre Live 1 |
| `sol.start` / `sol.tool` / `sol.end` | plan, cada herramienta, `ok`, `turns`, `seconds` |

Verlo en vivo: `log stream --predicate 'subsystem == "com.zevcorp.u.mac" AND category == "Passive"' --level info`.
El registro vive en el Mac de cada usuario; todavía no se envía a Graph.

## Modo de prueba en el notch (temporal)

`defaults write com.zevcorp.u.mac passiveTestMode -bool true` hace que el notch muestre solo los
pasos del ciclo («Prueba · …», con la cuenta de los 2 minutos cada 15 s) y calle lo demás. Se quita
del código al terminar la prueba manual (`passiveTest`, `showTrace`, `notchSink` en `AppModel`).
