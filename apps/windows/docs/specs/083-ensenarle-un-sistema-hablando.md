# Plan de implementación: enseñarle un sistema hablando — la clase que deja una habilidad que Ü usa sola

Estado: **implementado** (2026-10-02) · Nace de la petición del dueño del 2026-10-02 · Rama: `jose/la-voz-conversa-y-aprende`
· Sobre la 074 (Ü aprende: habilidades), la 079 (Ü ve), la 081 y la 082

> «Mañana necesito poder hablarle por la voz y explicarle cómo funciona el proceso de utilizar un sistema de registro
> de pacientes. […] Que él de verdad entienda lo que yo le explico y aprenda a usar el sistema como yo le estoy
> enseñando, para que después él lo use por mí. […] Quiero que crees un sistema de pruebas: por ejemplo, crear un
> HTML con un sistema médico y luego inyectar prompts como si fueran a través de la voz. […] Veo clave la
> funcionalidad de señalar. […] Crea tú mismo el sistema de medición para marcar el éxito.» — el dueño, 2026-10-02.

## El encargo, como se mide su final

**La clase** (`scripts/nivel4-voz/ensenar/ensenar.py`): un sistema de registro de pacientes (`his.html`, servido por
la propia prueba) en un Edge aparte, y una clase DICHA. Cada frase se sintetiza a audio y entra por `u_decir`, el
oído de prueba: la voz la oye, decide y delega —el camino que una orden escrita se salta—. Antes de la frase que
señala, el cursor se pone sobre el elemento.

| Sesión | Lo que dice la persona |
|---|---|
| 1 · enseñar | «Te voy a enseñar a usar este sistema…» · «entra a Pacientes y pulsa Nuevo paciente. Hazlo tú.» · «llena el formulario: … y pulsa Guardar paciente» · (señalando) «esto es el nivel de triage; si es un dolor leve, va en triage 4. Selecciónalo y confirma» · «guarda todo esto como la habilidad de registrar un paciente» |
| colgar | lo que lanza el repaso |
| 2 · usar | «Registra a este paciente: Carlos Andrés Pérez Londoño, cédula 71 22 33 44, de Nueva EPS, viene por un dolor leve de rodilla» — otros datos, y ni un paso repetido |

**La medición: nueve comprobaciones, ninguna contra la palabra de Ü.** Lo que el sistema recibió (él mismo avisa de
cada paciente guardado y cada triage confirmado), lo que quedó en `aprendido.json`, y el log.

| # | Comprobación | Corrida 1 | Corrida 2 | Corrida 3 |
|---|---|---|---|---|
| 1 | cada frase hablada se delegó | ✔ | ✔ | ✔ |
| 2 | al pedírselo, entró a Paciente nuevo | ✔ | ✔ | ✔ |
| 3 | llenó y guardó a la paciente de la clase, con sus datos | ✘ | ✔ | ✔ |
| 4 | señalar sirvió: miró lo señalado y clasificó en triage 4 | ✘ | ✔ | ✔ |
| 5 | quedó UNA habilidad | ✘ (3) | ✘ (3) | ✔ |
| 6 | la habilidad trae lo enseñado y la regla del triage | ✘ | ✔ | ✔ |
| 7 | la sesión siguiente abrió con lo aprendido | ✔ | ✔ | ✔ |
| 8 | sin repetirle un paso, registró al paciente nuevo con SUS datos | ✘ | ✘ | ✔ |
| 9 | y aplicó la regla enseñada: dolor leve → triage 4 | ✘ | ✘ | ✔ |
| | **total** | **3 de 9** | **6 de 9** | **9 de 9** |

En la corrida 3, usar la habilidad: 45 s de la frase al triage confirmado, con UN plan de 17 pasos.

**Después de mezclar con `main` (la spec 080 cambió cómo se arman las instrucciones) y de «elige:»**: corridas 4 a 8 —
6, 8, 9, 9 y la última de 9 (la 4 y la 5 fallaron por la propia prueba, que colgaba con un plan corriendo, y por lo que
sigue en la tabla de abajo). Con «elige:», usar la habilidad bajó a 29–40 s: registrar al paciente y confirmar el triage.

## Diagnóstico: lo que cada corrida enseñó

| Lo que pasó | La causa | El arreglo |
|---|---|---|
| El plan paró en la lista de «Tipo de documento»: «hay 121 «Cédula de ciudadanía» a la vista» | la lista desplegable de un navegador sale repetida en el árbol de UIA: la misma opción, en el mismo sitio | lo mismo leído varias veces es uno (811) |
| El número de documento se quedó sin llenar, y Ü paró a preguntar | dictado «diez veinte treinta cuarenta cincuenta», no supo si eran cinco números o uno | un número dictado por grupos se escribe pegado y se confirma al final (813) |
| De una clase quedaron tres habilidades | guardó una por cada frase de la persona | una clase es una habilidad que se reescribe; y al guardar otra en la misma sesión, el resultado nombra las que ya hay (812, 813) |
| Al usarla llenó todo y NO guardó | le faltaban el teléfono y la fecha, que nadie le dio, y paró a pedirlos | se hace con los datos que dieron, se termina, y se dice qué quedó vacío (813) |
| El plan de la sesión 2 fue «1 de 1 hechos» con un clic | `pasos` llegó como texto pegado con comas, y se tomó por un paso | también se parte por comas (814) |
| «Jev no contestó: Too many choices. Must have at most 255» | con una lista abierta la lectura pasaba de 255 accionables | repetidos fuera y tope de 255 (815) |
| Cada lista desplegable costaba de 4 a 7 s, y tres listas eran 20 de los 33 s de un plan | abrirla y leerla abierta es lento en Chromium; fijarle el valor por UIA no la cambia (sonda) | con el foco en el campo, teclear la opción la elige en menos de 1 s: «elige: campo = opción» (816) |
| En la clase no hizo lo que se le pidió («selecciónalo y confirma»): devolvió una pregunta | dudó de si un «dolor de cabeza» es «leve» | mientras le enseñan, lo que le piden hacer lo hace tal como se lo dicen (813) |
| «elige: Nivel de triage = 4» no eligió nada, y las manos acabaron pulsando «Atrás» y «Avanzar» del navegador 27 s | teclear solo acierta si la opción empieza por lo tecleado; y el objetivo de «llegar» dice «o Atrás» | si tecleando no queda, se recorre la lista con las flechas hasta la opción que contiene lo pedido (816); en un navegador no se les ofrecen los botones de navegar (817) |
| Probar por escrito no probaba nada de esto | con GPT-Live lo escrito va directo al delegado; lo hablado lo recibe la voz | el oído de prueba, `u_decir` (810) |

Y una decisión del dueño que entra aquí: **una decisión de las manos que agota su plazo se pide una vez más** (la
promesa 466 de `u/` decía lo contrario, con la regla de Luna; decidir no hace nada en la pantalla).

## La especificación

En el contrato del grafo:

| # | Promesa |
|---|---|
| 810 | el oído de prueba deja probar lo HABLADO sin micrófono: con las órdenes de prueba encendidas existe u_decir, que le da a la sesión un audio como si la persona hablara —la voz oye, decide y delega—, sin abrir el micrófono y sin sonar; sin ellas no existe |
| 811 | lo mismo leído varias veces es uno: dos accionables con el mismo nombre, tipo y caja no son «varios con ese nombre»; los que están en otro sitio sí, y siguen parando el plan |
| 812 | una clase es una sola habilidad: al guardar una habilidad cuando en la misma sesión ya se guardaron otras, el resultado las nombra y pide dejar una sola con todos los pasos; con la primera no dice nada |
| 813 | quien actúa sabe aprender una clase y usarla: una habilidad por clase que se reescribe con cada parte, hacer lo que le piden mientras aprende, guardar lo que funcionó con sus reglas, y al usarla terminar con los datos que le dieron sin parar a pedir los que faltan; un número dictado por grupos se escribe pegado, y una lista desplegable se elige en un paso |
| 814 | un plan que llega pegado con comas también se parte: «pulsa: A, escribe: B, pulsa: C» son tres pasos; una coma dentro de lo que se escribe no parte nada |
| 815 | lo que se le ofrece a las manos cabe en su pregunta: lo leído varias veces va una vez, nunca van más de 255 opciones, y cada una conserva su número |
| 816 | una lista desplegable se elige sin abrirla: «elige: campo = opción» pone el foco en el campo, teclea la opción y da el paso por hecho solo si la lista dice que quedó elegida; si no, falla diciendo en qué quedó y cómo hacerlo con dos pasos |

| 817 | en un navegador las manos no pulsan Atrás ni Avanzar por su cuenta: no se les ofrecen los botones de navegar del navegador salvo que el objetivo los nombre; en una app sí, que por ahí se vuelve |

En el contrato de `u/`, cambiada: **466** — una decisión que salió y agotó su plazo se pide una vez más, y no más.

## Lo que NO entra

- **Las listas que no son un `<select>` de verdad** (las que un sitio dibuja con `div`): «elige:» no las encuentra
  como lista, falla diciéndolo, y se hacen con dos «pulsa:», que es lo de antes.
- **SAP.** Esta clase se midió en un sistema web. En SAP GUI la mano es otra (Scripting) y no se probó.
- **El micrófono de verdad.** El oído de prueba mete audio sintetizado por donde entra el micrófono: prueba que la
  voz delega y que todo lo demás funciona, no la acústica de la sala ni el eco.

## Hallazgos

- Señalar funciona como se esperaba: con el cursor sobre «Nivel de triage», la voz delegó, quien actúa llamó a
  `map_pointing_at`, guardó qué es (`map_esto_es`) y lo usó en el paso siguiente.
- La voz delega cada frase que pide algo; la de presentación («te voy a enseñar…») la contesta ella sola («Dale, te
  sigo»), que es lo correcto.
- En modo hablado quien actúa cuenta lo que hizo en la frase siguiente: llega a destiempo (lo dice cuando la persona
  ya está hablando otra vez). No estorbó, pero se nota.

## Cierre

- [x] Todas las promesas verdes
- [x] Medido sobre la Ü real con la clase hablada, en un sistema web (4 vistas): ocho corridas; las últimas, 9 de 9
- [x] Sabotaje comprobado sobre el commit `834801d3`, con cada cambio visto aplicado: rojas las 810–816 y la 466 de `u/`
- [ ] Probado por el dueño con su micrófono y con el sistema de verdad
