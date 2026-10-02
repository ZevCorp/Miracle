# Plan de implementación: el ✓ ejecuta lo aprendido, y lo aprendido se ve

Estado: **implementado** (2026-10-02) · Nace de la petición del dueño del 2026-10-02 · Rama: `jose/los-checks-ejecutan-lo-aprendido`
· Sobre la 074 (Ü aprende: habilidades y repaso) y la 083 (enseñarle un sistema hablando)

> «Agrega un feedback visual siempre, como un icono de cargando que al terminar de cargar despliegue la lista de las
> cosas que aprendió, algo flotante muy cute. 1. Cambia el botón "grabar" por "escuchar". 2. Al hacer clic en el
> check de una sección transcrita, que el asistente flotante se acerque a esa sección, empiece a pensar lo que tiene
> que hacer contrastándolo con sus skills (una cadena de pensamiento de tipo "¿qué acción quiere el usuario que yo
> ejecute con esta información?"). Sale un mensaje de acción, por ejemplo (Registrar los signos vitales en X software
> que me enseñaste) y el usuario aprueba con un botón. Entonces al aprobarlo la carita va y ejecuta lo que hay que
> hacer. […] Todo ese funcionamiento actual de los checks es viejo y no funcionó. Lo único que importa sobre los
> checks es la conexión con los conocimientos […] (incluido el botón que dice todo a SAP, que ahora diga "ejecutar
> todo" con el mismo proceso pero analizando una acción en común con toda la info que hay).» — el dueño, 2026-10-02.

Y, sobre la frase de la 083 «si el modelo no llama a guardar durante la clase, todo depende del repaso; ese camino
solo no lo medí con una clase larga»: **«Mídelo».**

## Lo que cambia

| Antes | Ahora |
|---|---|
| El ✓ de una sección la mandaba a SAP por el piloto y sus skills grabadas (spec 008). El dueño lo declaró muerto. | El ✓ es un **gatillo sobre lo aprendido hablando**: la carita sale de la nota y va junto a la sección, se pregunta qué acción quiere la persona con esa información contrastándola con sus habilidades, **propone una** en una frase, y solo al pulsar **Aprobar** la ejecuta quien tiene las manos. |
| «✓ Todo a SAP» | «✓ Ejecutar todo»: el mismo proceso con toda la información junta y **una acción en común**. |
| El botón decía «Grabar». | Dice «Escuchar». |
| Al apagar la voz, el repaso corría en segundo plano y nada decía si ya había quedado. | Una tarjetita flotante, abajo al centro: un aro que gira mientras repasa y, al terminar, la lista de lo que aprendió (o «nada nuevo»). Lo que se guarda durante la clase sale en el acto. |
| El camino «solo el repaso» no se podía medir. | `U_PRUEBA_SOLO_REPASO=1` (con las órdenes de prueba) le quita a quien actúa las herramientas de guardar. |

**Lo que se queda y por qué.** `Encargo` sigue componiendo el texto de las secciones marcadas, y `PuenteASap` sigue
existiendo sin que la nota lo llame (la promesa 112 exige los tipos; retirarlos va en su rama `chore/`).

**El modelo propone, el código comprueba, la persona aprueba.** Una propuesta que nombra una habilidad que no existe
no llega al botón; sin ninguna habilidad no se llama al modelo; y nada se ejecuta sin el botón de aprobar. La
información de la nota no se escribe en el log: se anota cuánta era y qué se propuso.

## Las promesas

| # | Promesa |
|---|---|
| 820 | el repaso solo se puede medir: con las órdenes de prueba y `U_PRUEBA_SOLO_REPASO=1` quien actúa no tiene con qué guardar durante la sesión; sin las dos variables es la misma lista |
| 821 | sin ninguna habilidad aprendida, el ✓ contesta que todavía no le han enseñado nada, sin llamar al modelo |
| 822 | la propuesta del ✓ se comprueba: una acción cuya habilidad no existe no llega al botón de aprobar; la que existe pasa con su nombre tal como está guardado; una respuesta ilegible no es «no hay acción» |
| 823 | el ✓ es un gatillo sobre lo aprendido: la carita va junto a la sección, propone UNA acción y solo al aprobarla la ejecuta quien tiene las manos; «Ejecutar todo» es lo mismo con una acción en común; el ✓ ya no lleva nada a SAP y el botón dice «Escuchar» |
| 824 | lo que Ü aprende se ve: carga mientras repasa y al terminar despliega todo lo aprendido, cada cosa una vez; si no hubo nada lo dice; lo guardado durante la clase se enseña en el acto |
| 825 | el ✓ y el botón de aprobar se prueban sin ventana por el mismo puente —`u_nota` y `u_aprobar`—, solo con `U_ORDENES_DE_PRUEBA=1` |

El código de esta spec se escribió antes que sus promesas (el dueño pidió velocidad): se prueban por sabotaje.

## Medido (2026-10-02, contra el servidor real)

**El repaso solo, con la clase larga** (`ensenar.py` con `U_PRUEBA_SOLO_REPASO=1`, una corrida): quien actúa dijo
«no tengo disponible la herramienta para crear habilidades», y al colgar el repaso dejó **una habilidad de 12 pasos
en 8,8 s**, con la regla del triage. La clase dio **9 de 9**: la sesión siguiente registró al paciente nuevo con esa
habilidad. Es una corrida, no tres.

**Los checks** (`scripts/nivel4-voz/ensenar/checks.py`, una Ü que ya sabe la habilidad que dejó ese repaso; nueve
comprobaciones contra lo que el sistema de pacientes de prueba recibe):

| | Corrida k4 | Corrida k5 |
|---|---|---|
| A · ✓ en una sección con un paciente: propone la acción con la habilidad enseñada | ✔ (3,5 s) | ✔ (2,7 s) |
| A · aprobada, el sistema recibe a la paciente con sus datos | ✔ | ✔ |
| A · y el triage 4 de la regla enseñada | ✔ (36 s) | ✔ (23 s) |
| B · sección que no es de nada enseñado: no propone, y dice qué falta | ✔ (1,9 s) | ✔ (1,5 s) |
| C · «Ejecutar todo» con dos secciones: una acción en común | ✔ (3,2 s) | ✔ (1,4 s) |
| C · aprobada, el sistema recibe al paciente | ✔ | ✔ |
| C · con su triage 4 | ✔ (13 s) | ✔ (12 s) |
| D · al colgar, el indicador carga y termina | ✔ | ✔ |
| E · sin nada aprendido, lo dice sin llamar al modelo | no se midió (fallo del arnés: dos Ü a la vez) | ✔ |
| **total** | **8 de 9** | **9 de 9** |

La tarjetita se miró dibujada desde su propia ventana (una sonda, sin capturar la pantalla): cargando, lista de dos
líneas y «nada nuevo».

## Lo que NO se probó

- **Los botones de la ventana de la nota con el ratón.** Las pruebas entran por `u_nota` y `u_aprobar`, que llaman a
  las mismas dos funciones que la ventana, pero el ✓, la tarjeta de la propuesta y «Aprobar» pintados en la nota no
  se han pulsado. Tampoco se ha visto a la carita volar junto a la sección.
- Una nota de verdad, dictada, con secciones clínicas reales; ni el sistema real del dueño; ni SAP.
- La lista de lo aprendido tras una clase con el micrófono de verdad.

## Lo que queda fuera

- Retirar `PuenteASap`, `EnviarEncargoAsync` y el piloto del encargo: ya no los llama nadie desde la nota. Rama `chore/`.
- La orden aprobada entra al hilo de la conversación como dicha por la persona, con la información de la sección.
