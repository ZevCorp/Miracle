# Código limpio y fiable: por qué se ensució y qué lo impide

> Escrito el 2026-09-28, tras la sesión de voz que se sintió lenta. Fuentes: el log de esa sesión
> (`u-20260928-u-desde-cero-p31596-202426.log`), la spec 054 y una revisión con 68 agentes que verificó cada
> afirmación contra el código. Lo que ya se hizo en la rama `jose/u-pulsar-en-main` está marcado **hecho**.

## Lo que pasó, en una frase

La sonda medía 182 ms por clic. La voz real medía 2.349 ms, porque **ni uno de sus 9 clics llegó al ciclo rápido**.
El modelo mandaba `decir` y `recuerdo`, y eso desviaba cada clic a la coreografía de lección. Nadie lo vio: ni
el contrato, ni la sonda, ni el log.

## Las ocho causas

Cada una tiene su prueba en el log o en el código.

1. **Se medía el componente, no la entrada.** Las sondas y el contrato llamaban a `CicloRapido.Pulsar` o a
   `map_take` solo con `exit`. El modelo real manda `exit`, `decir` y `recuerdo`. Se probó una puerta que la voz
   no usa.
2. **El desvío era mudo.** Con la coreografía, el ciclo rápido ni se llamaba, así que ninguna línea del log decía
   «me salté el ciclo». El camino tomado no existía como dato. La regresión solo se veía por una línea que faltaba.
3. **Dos promesas se contradecían.** La 191 decía que `map_take` lleva `decir` y `recuerdo` para la coreografía.
   La 485 decía que un clic por nombre va por el ciclo rápido. Nada decidía cuál ganaba, y el esquema invitaba
   al modelo a activar la contradicción en cada clic.
4. **El cableado vive dentro de un `FaceWindow` de 5.861 líneas.** No se puede construir con dobles, así que las
   promesas de cableado leen el código con regex. La 489 salió verde mientras rompía que la ventana de trabajo
   siguiera al foco: hubo 30 clics seguidos sobre la app equivocada.
5. **Conviven varias implementaciones de lo mismo.** Hay cuatro lectores de pantalla, ocho esperas con nombre
   propio y cuatro manos. Cada convivencia necesita un enrutador, y cada enrutador es un sitio donde la entrada
   real elige mal.
6. **Los efectos de pago o peligrosos no tienen guarda.** Un clic de Ü sobre la carita abrió la voz de pago cinco
   veces. Una lectura del Explorador tardó 252 s y U esperó detrás. Lo detectó el dueño, no una alarma.
7. **El sabotaje se hace a mano.** Un sabotaje que no se aplicó (CRLF contra `\n`) dio verde. Una prueba que no
   miraba la propiedad también dio verde. Desde fuera, las dos cosas se ven igual.
8. **La compuerta no pasa por el canal del dueño.** Ningún nivel automático manda un `map_take` con los argumentos
   de la voz. La 054 se cerró con «5 apps» medidas con sondas, sin el modelo de voz.

## Las nueve prácticas

Van ordenadas por lo que cuesta frente a lo que atrapan. Las tres primeras habrían atrapado este incidente antes
del merge.

### 1. Cada llamada dice su camino — hecho (promesa 509)

`Take` y `Type` anotan por dónde fueron y por qué: ciclo rápido, núcleo o coreografía. El log lo escribe en cada
llamada (`camino: map_take → ciclo-rapido (…)`). Un clic por nombre que no va por el ciclo fuera de una lección
deja `⚠ camino inesperado` con su razón.

- **Qué atrapa:** con esto, el primer clic de la sesión real habría dicho «coreografía» 9 veces de 9.
- **Siguiente paso:** una traza JSONL por llamada, con los argumentos crudos y los milisegundos, y un presupuesto
  por camino (por ejemplo, p50 ≤ 400 ms en el ciclo) que avise al pasarse.

### 2. Las pruebas usan los argumentos reales del modelo — hecho en parte (promesa 497)

La 497 llama a `map_take` con los argumentos literales de la sesión del 2026-09-28, incluido uno inventado
(`foo=bar`). Exige que vaya por el ciclo rápido.

- **Qué atrapa:** cualquier cambio de esquema o de prompt que cambie lo que manda el modelo.
- **Siguiente paso:** un script que coseche las llamadas de cada sesión real y las sanee (nada de SAP ni de datos
  de pacientes). Van a `tests/ContratoDelGrafo/bronce/voz/` y el contrato las recorre todas.

### 3. Cada enrutador tiene su tabla completa — pendiente

Toda función que elige entre dos caminos (`Take`, `Type`, `LoQueVeo`) tiene una promesa con **todas** las
combinaciones de entrada y el camino esperado de cada una. Se juzga por `Call`, no por el componente.

- **Qué atrapa:** la fila «nombre UIA + decir + recuerdo + fuera de lección» obliga a elegir entre ciclo y
  coreografía **al escribir la spec**, y el choque con la 191 aparece antes del código.
- **Costo:** unas dos horas por enrutador. Hoy hay tres o cuatro.

### 4. La mano de Ü nunca toca a Ü, y la voz solo la abre una persona — hecho (spec 061)

Son tres guardas en tiempo de ejecución, cada una con su promesa:

- **Fuera de casa la carita es fantasma** (505): transparente al ratón desde que sale hasta que se posa en casa.
- **Antes de cada clic sintético se mira qué hay bajo el punto** (510), en las seis manos que pulsan. Si es la carita,
  se aparta; si es otra ventana de Ü, no se pulsa y se dice cuál. Si la persona tiene el ratón, tampoco.
- **El clic de Ü lleva una firma** (508), y ninguna ventana de Ü lo toma por un toque de la persona.

- **Qué atrapó en el PC real:** 28 clics sobre teclas apiladas y listas, con la carita visitando cada una. Hubo 0
  sesiones de voz abiertas y 0 clics perdidos. Una vez hubo que apartar la carita, y costó 15 ms.
- **Lo que desbloqueó:** la carita vuelve a ir a cada elemento. La 492 («la carita no viaja») se retiró: era una
  prohibición, no la propiedad que se buscaba.
- **Lo que queda:** la firma no evita que una ventana se active (medido). La 510 lo evita en las seis manos, pero
  `WS_EX_NOACTIVATE` en la carita, el muelle y el notch cerraría el hueco del todo: otra spec.

### 5. Plazo por herramienta y un perro guardián del hilo de UI — pendiente

Ninguna herramienta bloquea U más allá de su techo (8 s para un clic, 30 s como tope global). Si el hilo de UI
llega más de un segundo tarde, se anota con su pila.

- **Qué atrapa:** los 252 s del Explorador habrían sido «no terminé en 8 s» y una línea con la pila.
- **Lo único hecho:** apartar la carita antes de un clic espera a la interfaz como mucho 100 ms, y se mide.

### 6. El sabotaje lo hace un script que comprueba que mordió — hecho en parte

Cada spec declara sus sabotajes como datos: archivo, qué buscar, qué poner y qué promesa tiene que ponerse roja.
El script normaliza los finales de línea y exige una coincidencia y un diff no vacío. Restaura desde una copia,
nunca con `git checkout`, y falla si la promesa nombrada no se pone roja.

- **Qué atrapa:** las dos variantes del incidente 7.
- **Lo que atrapó hoy:** de los primeros 17 sabotajes, 3 salían verdes. Las pruebas miraban algo parecido a la
  propiedad sin serlo, y se endurecieron hasta que mordieron. Uno no llegaba a aplicarse y el script lo dijo.
- **Estado:** existe en el scratchpad y ya prueba con CRLF si no casa con LF. Falta versionarlo en `scripts/` y
  hacer que restaure desde una copia.

### 7. Sacar la composición de `FaceWindow` — pendiente

El cableado (qué lector, qué mano y qué ventana usa cada herramienta) pasa a una clase que el contrato pueda
construir con dobles. La regex sobre fuentes queda solo para «esto no debe existir», marcada `[cableado]` y con
un cupo que solo baja.

- **Qué atrapa:** con la composición construible, la 489 habría sido «con otra app delante, el clic lee esa app»,
  y habría salido roja.
- **Costo:** dos o tres días en ramas cortas. `FaceWindow` es zona de choque alta.

### 8. Una implementación por capacidad, con trinquete — hecho en parte

Leer, esperar y pulsar tienen **una** implementación cada una. Una spec que añade otra borra la vieja o deja un
contador que el portero hace bajar. Quitar código obliga a listar lo que ese código escribía: el latido escribía
la ventana de trabajo, y al quitarlo nadie lo sabía.

Hoy se juntaron cinco pares en uno: un recorrido de planes (eran dos bucles), una regla de «¿es SAP?» (eran tres),
una regla de «¿a qué elemento se refiere un nombre?» (eran dos), una regla de «¿está libre el punto?» (para las seis
manos) y una firma. Falta el trinquete que impida que vuelvan a separarse.

### 9. Una spec de velocidad se acepta por la voz real — hecho en parte

Si una spec promete velocidad en algo que usa la voz, su evidencia incluye una sesión de voz real después del
cambio: el % de llamadas por el camino esperado y el p50. Las cifras de la sonda no bastan.

Hoy se midió con los argumentos de la voz real, por el MCP y en el PC real: 28 de 28 clics por el ciclo rápido. Se
midió también con un A/B contra la rama sin carita, en las mismas condiciones, y la carita cuesta ~16 ms en la
Calculadora. Falta una sesión de voz del dueño.

### 10. Atacar el plan antes de escribir el código — nueva, y funcionó

Antes de implementar la carita, el plan lo atacaron dos críticos con el código delante: uno buscando cómo podría
seguir robando un clic, otro buscando pruebas que salieran verdes sin probar nada. Encontraron **17 objeciones, 4
altas**:

- la coreografía de lección dejaba volver la carita a casa, tocable, justo antes del clic;
- la guarda estaba en 1 de 6 manos;
- con la persona pulsando la carita, la captura se llevaba el clic de Ü;
- un fantasma invertido pasaba el contrato.

Ninguna de las pruebas escritas hasta entonces las veía: todas estaban verdes. Cada objeción aceptada entró primero
como prueba en rojo.

- **Cuándo:** en toda spec que toque la UI de `windows-client` o un efecto de pago.
- **Costo:** una hora de agentes, frente al día perdido que costaba un fallo en la sesión del dueño.

## Lo que ya cambió en la rama

| Promesa | Qué hace ahora el sistema |
|---|---|
| 497 | un clic por nombre va por el ciclo rápido traiga lo que traiga; la coreografía solo cuando la app la pide (lección, encargo) |
| 498 | «¿es SAP?» es una regla (`Uia.Sap.EsVentana`), no tres copias |
| 499 | el tope de intentos cuenta también los clics rápidos |
| 500 | la voz ya no ofrece `decir` ni `recuerdo`; el piloto sí, para comprobar lecciones |
| 509 | cada llamada dice su camino, y un desvío avisa |
| 501 | parar una comprobación para el plan, y los pasos que faltan cuentan como no dados |
| 502, 503 | recordar es explícito y honesto, y se cuelga del elemento por su nombre exacto |
| 504-508, 510 | la carita va a cada elemento que Ü pulsa, fantasma fuera de casa, y ninguna mano pulsa sobre Ü |
| 511 | una Ü de pruebas convive con la del dueño (`U_MCP_PUERTO`) |

Los recuerdos pasan a ser un **complemento explícito**: `map_esto_es`, cuando la persona enseña algo. Ya no son
un efecto lateral de cada clic.

## El orden que se recomienda

Hecho hoy: la limpieza (501-503), la medida con los argumentos reales y las guardas de la carita (504-511).

1. Una sesión de voz del dueño con la carita visitando, contada con `anatomia-del-clic.ps1`.
2. Plazo por herramienta y trinquete (prácticas 5 y 8).
3. Versionar el sabotaje por script (práctica 6) y el guion del nivel 4 (`nivel4-carita.ps1`) en `scripts/`.
4. La tabla completa de cada enrutador (práctica 3).
5. Sacar la composición de `FaceWindow`, por trozos (práctica 7).
6. Decidir cómo persisten los recuerdos: hoy viven en memoria mientras la Ü está abierta.
