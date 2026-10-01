# Plan de implementación: las manos rápidas hacen los clics — quien planea deja de pagar por pulsar

Estado: **implementado** (2026-10-01) · Nace de la petición del dueño del 2026-10-01 · Rama: `jose/la-voz-conversa-y-aprende`
· Sobre la 062 (el plan por objetivos), la 054 (el ciclo rápido) y la 073 (el delegado `gpt-6-luna`)

> «Le pedí que fuera a hacer una investigación en Google […] lo hizo fluido, pero no a la máxima velocidad que
> ya tenemos. La máxima velocidad es donde el razonador le delega todo el trabajo de los clics a Jev, y Jev,
> por cada ciclo de clic —mirar la pantalla, hacer clic y volver a mirar—, se demora unos 350 milisegundos.
> […] Siento que todo se está ejecutando con Luna, que no está entrando Jev.» — el dueño, 2026-10-01.

## El encargo, como se mide su final

**Objetivo.** Que un pedido de muchos clics vaya al ritmo de las manos y no al de quien planea: que cada clic
cueste lo que cuesta el ciclo —ver, pulsar, volver a ver—, que quien planea no gaste una vuelta suya por gesto,
y que una orden escrita no se muera a mitad del trabajo.

| | Antes (medido) | Meta |
|---|---|---|
| Un clic pedido por un nombre que no es el exacto («pulsa: 1», y el botón se llama «Uno») | 1.260 ms | ≤ 600 ms |
| Un clic pedido por su nombre exacto (ciclo rápido) | 357 ms | no empeora |
| «Calcula 123 por 45 con los botones», de la orden a la respuesta | 25 s, 3 planes, y repitió la cuenta | ≤ 10 s, 1 plan |
| Ir a una dirección con el navegador delante | 3 pasos, 1,6–2,2 s («tecla: Ctrl+L», «escribe:», «tecla: Enter») | 1 paso |
| Una orden escrita que dura más de 30 s | muere: «sesión cerrada: expired», y lo hecho se pierde | termina |
| Vueltas de quien planea en la investigación en Google, primeros 30 s | 9, con planes de 1 a 3 pasos | se mide; no se promete un número |

## Diagnóstico: qué se midió

**El build que probó el dueño no era esta rama.** La investigación en Google (07:31) corrió en
`C:\U-versiones\encuentro\U.exe`, con el delegado `gpt-6.1-sol` en `low` y sin prisa: 10 vueltas de ~3,5 s —39 s
de 79, el 51 %— y las manos, 13 pasos casi todos de teclado. Jev decidió dos veces y pulsó una. Esta rama trae
`gpt-6-luna` con prisa (primer plan en 848 ms, spec 073), que es de donde sale la mayor parte de lo que se gana.

**Con esta rama, lo mismo** (`scripts/nivel4-voz/por-ordenes/banco.py`, sobre la Ü de pruebas):

| Pedido | Lo que pasó |
|---|---|
| «Calcula 123 por 45 pulsando los botones» | Luna planeó «pulsa: 1», «pulsa: 2»… Ningún botón se llama así («Uno», «Dos», «Multiplicar por», «Es igual a»): cada clic buscó el nombre, no lo encontró, esperó a que la pantalla se quedara quieta (166–273 ms), volvió a buscar, y se lo pasó a Jev (408–813 ms por vuelta, y a veces otra para confirmar). **1.260 ms por clic.** Jev pulsó «=» dos veces, el resultado salió mal, y Luna repitió la cuenta entera —ya con los nombres exactos, que había leído en la respuesta—: **357 ms por clic**. |
| La investigación en Google (Edge aparte) | 9 llamadas en 30 s: 7 planes de 1 a 3 pasos, un `map_look` y un `map_scroll` sueltos. **Ninguna vuelta de Jev**: Luna escribe direcciones y pulsa por nombre exacto (94–187 ms). 3 de los 7 planes eran «tecla: Ctrl+L → escribe: https://… → tecla: Enter» (1,6–2,2 s) cuando «abre: https://…» con el navegador delante ya carga en la misma pestaña, en un paso. Y a los 30 s exactos, **la sesión se murió**. |

**La sesión escrita caduca a los 30 s** (sonda `sondas/DeLaVoz --texto`, contra el servidor): sin un solo trozo
de audio, `session.closed: expired` a los 30.975 ms con el delegado a mitad del trabajo, y los avances a la voz
acaban en `context_injection_incomplete`. Con silencio por el caño (`--con-silencio`): 47 s, el trabajo termina y
los cuatro avances se aceptan. No es de las órdenes de prueba: es de cualquier orden escrita en el panel.

**La lectura.** «Jev no entra» es cierto, y no es una avería: es el reparto. En `u/`, que es la versión que el
dueño recuerda, Luna tenía dos herramientas y todo clic era un objetivo de las manos. Aquí tiene «pulsa:», que
por nombre exacto es lo más rápido que hay (357 ms contra 500–800 de Jev), y las instrucciones le dicen «nunca
pierdes nada por usarlo». Eso es falso cuando el nombre no es el exacto: pierde 900 ms por clic, y a veces el
resultado.

## El diseño, en cinco frases

1. **«pulsa:» con un nombre que no está se resuelve de un tiro.** Con la lectura que ya se hizo, las manos
   eligen una vez qué es eso en esta pantalla, lo pulsan y terminan: sin esperar a que la pantalla se quede
   quieta —ya lo está: es la lectura de después del clic anterior—, sin segunda búsqueda y sin vuelta para
   confirmar. Solo si no se atreven —no está en esta pantalla— pasa a ser un objetivo de llegar hasta él, como
   hasta hoy (525).
2. **Una dirección va en un paso.** «tecla: Ctrl+L», «escribe: https://…», «tecla: Enter» es «abre: https://…»,
   y el plan lo lee así aunque quien planea lo escriba en tres.
3. **Quien planea sabe cuándo es «pulsa:» y cuándo es un objetivo.** «pulsa:» con un nombre leído en EN
   PANTALLA AHORA; si no lo ha leído, UN objetivo por intención y las manos hacen todos los clics. Y en una
   página, las direcciones por «abre:», el desplazamiento por «desplaza:» y nada de una llamada por gesto.
4. **Una sesión abierta no se muere por falta de audio.** Si no sale audio —lo escrito, el micrófono apagado—,
   Ü manda silencio al ritmo de un micrófono.
5. **Lo que no se encuentra deja dicho por qué.** Hoy un «pulsa:» que acaba en Jev no deja una línea que diga
   que el nombre no estaba: se ve solo una espera y unas vueltas.

## La especificación

En el contrato del grafo:

| # | Promesa |
|---|---|
| 790 | una sesión abierta no se muere por falta de audio: si el protocolo caduca sin él y no ha salido audio en un cuarto de segundo —lo escrito, el micrófono apagado—, Ü manda silencio al ritmo de un micrófono; con audio de verdad saliendo no manda nada, y un protocolo que no caduca tampoco |
| 791 | un «pulsa:» cuyo nombre no está se resuelve de un tiro: las manos eligen una vez sobre la lectura que ya se hizo, pulsan y el paso queda cumplido, sin esperar a la pantalla ni buscar otra vez; si no se atreven, el paso pasa a ser el objetivo de llegar hasta él; y varios con ese nombre siguen parando el plan con su lista |
| 792 | una dirección va en un paso: un plan que trae la tecla de la barra de direcciones, una dirección escrita y Enter se ejecuta como «abre:» esa dirección; lo que se escribe y no es una dirección no se toca, y el plan dice lo que hizo de verdad |
| 793 | quien planea sabe cuándo es «pulsa:» y cuándo un objetivo: sus instrucciones dicen que «pulsa:» va con un nombre leído en pantalla y que sin él va un objetivo por intención, que una dirección va por «abre:», y ya no dicen que con «pulsa:» nunca se pierde nada |
| 794 | un «pulsa:» que no encontró su nombre deja dicho qué buscaba, cuántos accionables había y quién lo resolvió; y cuando las manos no lo resuelven, por qué |
| 802 | varios gestos pegados en un paso son varios pasos: «pulsa: A; pulsa: B» se ejecuta como dos, en su orden; lo que se escribe conserva sus puntos y comas, y la barra de direcciones se busca también en la ventana dueña de la de delante |
| 803 | «abre: calculadora nueva», «abre: una calculadora» y «abre: otra calculadora» abren la calculadora: el artículo y el adjetivo no son parte del nombre de la app; una dirección y un nombre que no los lleva quedan como vienen |

En el contrato de la voz:

| # | Promesa |
|---|---|
| 71 | GPT-Live declara que su sesión caduca sin audio, y los demás protocolos no |

### Con qué se juzga cada una

- **790, 71**: funciones puras (cuándo toca silencio, cuánto silencio) y el cableado; lo que hace el servidor,
  la sonda `--texto --con-silencio`.
- **791, 794**: `ElPlanPorObjetivos` con las manos inyectadas, como la 516, la 524, la 525 y la 741.
- **792**: una función pura sobre la lista de pasos.
- **793**: el texto de las instrucciones de quien actúa.
- El resultado sobre la pantalla de verdad: `scripts/nivel4-voz/por-ordenes/banco.py`.

## Las fases

| Fase | Pone verde | Toca |
|---|---|---|
| 0 | 790, y la 71 de la voz | `IProtocolo`, `ProtocoloGptLive`; `ConversacionEnVivo.cs` |
| 1 | 791, 794 | `Navigation/ElPlanPorObjetivos.cs`, `Ui/FaceWindow.xaml.cs` |
| 2 | 792 | `u/Nucleo/Ejecutor.cs` |
| 3 | 793 | `ConversacionEnVivo.cs` (lo que se le añade a quien actúa) |

## Lo que NO entra

- **Quitarle a quien planea las herramientas de un gesto** (`map_take`, `map_scroll`, `map_go_to`). En `u/` no
  existían y por eso todo iba por las manos; aquí tienen usos que el plan no cubre (`which`, un selector, una
  pestaña que ya existe). Se mide primero si con las instrucciones basta.
- **Leer más rápido una página** (`u/Nucleo/LectorUia.cs`): es el suelo de cada ciclo en un navegador, y hay una
  sonda a medias en `jose/u-leer-lo-visible`. Va en su rama.
- **El notch mientras corre un plan**: hoy pinta «map_hacer» en crudo mientras trabaja. Es de la interfaz, que
  es la zona de choque; va aparte.
- **La foto del pedido cuando se habla**: con la voz sube mientras la persona habla y no retrasa nada; escrito,
  se espera a ella antes de mandar el texto (0,5–2,2 s). No se toca aquí.

## Hallazgos

Medido el 2026-10-01 con `banco.py` sobre la Ü de pruebas (`C:\U-versiones\conversa`), corridas `m4`, `m6` y `c1`.

**Los milisegundos por ciclo de clic, por camino** (ver, pulsar, volver a ver; el paso entero):

| Camino | Antes | Ahora | Dónde |
|---|---|---|---|
| Por nombre exacto («pulsa: Dos») | 357 | **141–359, mediana 274** sobre 22 clics | Calculadora |
| Las manos deciden (un objetivo) | 400–800 | **354–861, mediana ~490**: ≈250 de decidir + 100–270 de esperar a la app | Calculadora |
| Un nombre que no es el exacto | 1.260 | **782** de un tiro (una medida) | Calculadora |
| Por nombre exacto | — | 125–703; un clic de 2,5–4 s cuando la página destino tarda en pintar | Configuración |
| Las manos deciden | — | 1.004–1.306: de eso, 528–1.028 son esperar a que Configuración termine de animar | Configuración |

**Lo que el número dice.** El suelo de las manos es la decisión del modelo (≈230–260 ms por la red) más lo que
tarde la app en quedarse quieta: en la Calculadora queda en ~490 ms y por nombre exacto en ~274. Los 350 ms se
alcanzan cuando quien planea usa nombres que ya leyó, que es lo que la promesa 793 le pide; cuando delega un
objetivo entero, cada clic paga una decisión. En Configuración lo que manda es la app, no Ü.

**Lo que apareció midiendo, y entró:**

1. **Varios gestos pegados en un paso** (802): «pulsa: Más; pulsa: Dos; … pulsa: Es igual a» llegó como UN paso,
   se resolvió «de un tiro» como un solo clic y quedó cumplido: la cuenta salió mal y la meta tardó 30 s en vez de 18.
2. **«abre: calculadora nueva»** (803): no es el nombre de nada; falló en dos de tres metas y costó una vuelta.
3. **La barra de Edge** (792, 802): primero el nombre («Dirección y barra de búsqueda»), y después lo que de verdad
   la tapaba: un Edge recién abierto pone delante una ventana suya sin título, y ahí no hay barra. El mensaje
   «no encontré la barra» cubría cuatro causas; ahora dice cuál (aprendizaje nº2, otra vez).
4. **El caño abierto** (790): una orden escrita de 78 s y otra de 86 s terminaron; antes morían a los 30,9.
   La sonda mide además que basta un trozo de silencio cada 5 s para que no caduque (57 s viva): es un ahorro
   posible, sin tocar aquí.

**Lo que NO se arregló, y queda dicho:**

- Una decisión de las manos que agota su plazo (3 s) tumba el objetivo entero. Reintentarla es seguro —decidir no
  hace nada—, pero el contrato de `u/` promete lo contrario (466: «un plazo agotado no se reintenta»): cambiarlo es
  cambiar un contrato, y eso se habla con el dueño.
- Las manos se equivocaron de sitio dos veces sin saberlo: «ir a Pantalla» acabó en Personalización › Pantalla de
  bloqueo, y «calcular 12 por 12» pulsó 1, 2, ×, 2, =. Quien planea lo vio en el relato (promesa 800: dice qué se
  pulsó) y lo corrigió en la vuelta siguiente.
- El banco toca el navegador de la persona si Ü abre una dirección «aparte»: quedaron tres pestañas, cerradas a mano.

## Cierre

- [x] Todas las promesas verdes: grafo 498, voz 64 y `u/` 45, sin rojas ni pendientes
- [x] Sabotaje comprobado sobre el commit `7b4674da`, en dos rondas y con cada cambio visto aplicado: rota la
      lógica, rojas 790–794, 802, 803 y la 71 de la voz, y ninguna más; roto el cableado (el bucle del caño, la
      lectura quieta, la barra por su clase, el log del plan, el foco de la barra, la otra copia), rojas 790, 791,
      792, 794, 802 y 803, cada una por la comprobación que tocaba
- [x] Medido sobre la Ü real, con el log: Calculadora, Configuración, Explorador y Edge (4 pantallas)
- [x] Estado de este documento: **implementado** (2026-10-01), con lo que queda dicho en «Lo que NO se arregló»
