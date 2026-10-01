# Plan de implementación: la voz conversa mientras el delegado trabaja, y el delegado es rápido

Estado: **implementado** (2026-10-01) · Nace de la petición del dueño del 2026-09-30 · Rama: `jose/la-voz-conversa-y-aprende`

> «Siento que la voz no habla en tiempo real mientras ejecuta sino solo al principio y al final.
> Quiero que la voz reciba en tiempo real lo que va sucediendo […] y la quiero más conversadora,
> pero que priorice la ejecución antes de cualquier cosa.» — el dueño, 2026-09-30.
>
> «La velocidad es extremadamente importante para nosotros.» — el dueño, 2026-10-01.

## El encargo, como se midió su final

**Objetivo.** Que la voz converse en tiempo real mientras el delegado ejecuta, con la orquestación
que OpenAI recomienda para GPT-Live, sin que hablar retrase una sola acción; y que el delegado
piense lo más rápido que se pueda sin dejar de acertar.

**La meta, y lo que salió** (sonda `sondas/DeLaVoz` contra el servidor real; y la Ü real por órdenes escritas):

| | Antes (medido) | Meta | Salió |
|---|---|---|---|
| Frases de la voz durante un trabajo de 4 pasos de 2,5 s | 0 | ≥ 1 en 5 de 5 | 4, 2, 2, 4 y 3: **5 de 5** |
| Silencio más largo durante ese trabajo | 11,1–12,5 s | ≤ 5 s | **3,2 s** de mediana (2,6–3,5) |
| Primer plan del delegado, con el catálogo de la app | 3.191 ms | ≤ 1.500 ms | **848 ms** de mediana (673–1.146) |
| Primera llamada tras terminar de hablar la persona | 4.046 ms | ≤ 2.500 ms | **1.552 ms** de mediana |
| «¿Cómo vas?» a mitad del trabajo | sin medir | contesta con lo hecho, sin volver a delegar | 3 de 3: «ya vamos por el dos de cuatro»; una sola delegación |
| Un paso que falla | sin medir | la voz no dice que quedó hecho | 3 de 3 lo dijo: «me falló abrir el bloc. Lo intento otra vez» |
| Aperturas rechazadas por la historia | 13 en dos días | 0 | el historial tiene presupuesto (hoy, la promesa 667 de `main`) |
| Pedidos sencillos en la Ü real (calcular, abrir y entrar, contar archivos) | 6–9 s hasta la respuesta | más rápido | **2–6 s** |

## Diagnóstico: qué se midió

| Qué | Medida | Fuente |
|---|---|---|
| Pedidos de 3 o más acciones en los que la voz no dijo nada durante el trabajo | 22 de 54; el trabajo duró 34,5 s de mediana | logs del 18 al 30 de septiembre (`u-202609*.log`), contado por turno |
| Reparto del tiempo de un pedido | pensar 25,9 s, ejecutar 8,4 s de mediana: el 81 % es el modelo | 17 líneas `voz-turno:` de esos logs |
| La persona de la voz | «Mientras se hace el trabajo, calla», «nunca en futuro», «tú no ves la pantalla» | `ProtocoloGptLive.InstruccionesDeLaVoz` en `main` |
| Las instrucciones del delegado | escritas para una sola voz que habla y actúa: «habla poco», «el silencio mientras trabajas está bien» | `ConversacionEnVivo.Instrucciones` |
| Lo que se le mandaba a la voz mientras se ejecuta | nada: `commentary.append` solo dicta recordatorios, `instructions.append` solo cambia de modo | `grep` de los tres append |
| La voz de `main`, sondeada | «Claro.» a los 1,0 s, y después 12,5 s callada hasta el resultado | sonda, 2026-10-01 01:28 |
| `session.thinking.append` con la delegación por Responses | aceptado, cero errores, en todas las corridas con micrófono | sonda |
| Persona de `main` + avances | 0 frases, 11,1 s callada: los avances solos no bastan | sonda 01:32 |
| Lo que la documentación de OpenAI recomienda | delegado `gpt-6-luna` para empezar; avances con `thinking.append` y `commentary.append`; el prompt del delegado devuelve hechos, estado y siguiente paso | guías *Delegation and tools* y *Prompting GPT-Live* |

La lectura: la tubería era la recomendada (delegación por Responses, las herramientas en el delegado,
la foto por referencia). Lo que se apartaba era lo que se le decía a la voz y lo que no se le contaba:
se le ordenó callar, y aunque quisiera hablar no sabría de qué.

### El delegado: velocidad y aciertos

Con las instrucciones y las 28 herramientas de la app, por la voz, seis corridas por combinación
(`velocidad.py` sobre la sonda), el primer plan:

| Delegado | Esfuerzo | Prisa | Primer plan, mediana | Rango |
|---|---|---|---|---|
| `gpt-6.1-sol` (lo que había) | low | no | 3.191 ms | 1.865–5.576 |
| `gpt-6-luna` | low | no | 1.250 ms | 807–1.895 |
| `gpt-6-luna` | none | no | 910 ms | 802–998 |
| `gpt-6-luna` | medium | no | 1.380 ms | 824–2.144 |
| `gpt-6-luna` | low | priority | 924 ms | 860–3.555 |
| **`gpt-6-luna`** | **medium** | **priority** | **848 ms** | 673–1.146 |

Y sobre la Ü de verdad, el mismo binario cambiando solo el delegado por variable, seis pedidos
(calcular 1234×56; listar los dispositivos Bluetooth; calcular y entrar en Sistema; decir la RAM;
contar los archivos de Descargas; la raíz de 144 en modo científica):

| Delegado | Acertó | Lo sencillo | Lo que hay que explorar |
|---|---|---|---|
| `gpt-6.1-sol` low | 6 de 6 (una pasada) | 6–9 s | 7–12 s |
| `gpt-6-luna` low | 4 de 6 | 3–6 s | 17 s; no supo sacar la raíz ni listar los dispositivos |
| `gpt-6-luna` none | 4 de 6, y uno a medias | 4–6 s | 14 s; falló lo mismo |
| `gpt-6-luna` medium (con y sin prisa) | 16 de 18 (tres pasadas) | 2–6 s | 11–20 s |

**Lo que se decidió con eso:** `gpt-6-luna`, pensando en medio y con prisa. Bajar el esfuerzo ya no
compra velocidad (130 ms) y cuesta aciertos; la prisa baja el primer plan de 1.380 a 848 ms. Con
priority Luna vale el doble que sin ella y sigue costando la décima parte que Sol sin priority.

**Lo que se pierde, dicho:** Sol acertó los seis pedidos en su pasada y Luna 16 de 18 en tres; en lo que hay
que explorar Luna da más vueltas (hasta 8 llamadas para llegar a la RAM, contra 2 de Sol). Las dos que
falló Luna fueron en Configuración: una vez no terminó de listar los dispositivos, y otra dijo que un
diálogo de Windows le tapaba la ventana. Se vuelve a Sol sin recompilar: `U_DELEGADO=gpt-6.1-sol`.

## Por qué esto va dirigido por especificación

Porque el silencio **era** una promesa: la 46 de la voz y la 161 del grafo lo congelaron después de
que el dueño oyera el balbuceo del 2026-09-05 («habla un 80 % y hace un 30 %») y el «voy a abrirlo»
que sonaba con la app ya abierta. Volver a hablar sin decir qué se conserva de aquello trae de
vuelta las dos averías. Lo que se conserva: **quien actúa no anuncia**, y la voz **cuenta lo que ya
pasó porque el código se lo dice**, no lo que supone que va a pasar.

## El diseño, en seis frases

1. **El delegado es `gpt-6-luna`, pensando en medio y con prisa**, y las tres cosas se cambian por variable
   de entorno: `U_DELEGADO`, `U_DELEGADO_ESFUERZO`, `U_DELEGADO_PRISA`.
2. **Cada paso que termina le llega a la voz** como contexto callado (`session.thinking.append`):
   el paso de un plan, el resultado de una herramienta, un fallo. Del resultado, nunca de la intención.
3. **No se la ametralla**: el primer avance sale al momento, los que llegan pegados se juntan en el
   siguiente, y un fallo no espera.
4. **La voz lleva una persona nueva**: delega antes de comentar, acompaña con lo que le va llegando,
   habla de lo que ya pasó y sabe que ve por su equipo.
5. **El delegado deja de recibir reglas de habla**: trabaja sin anunciar y devuelve hechos, estado y
   siguiente paso. Las instrucciones de la voz única (`U_VOZ=realtime`) no cambian ni una letra, y la 161
   las sigue juzgando.
6. **La línea `voz-turno` dice si la voz habló durante el trabajo** (`hablo_durante=`, `silencio_max=`): lo
   que hubo que sacar con un guion sobre trece días de logs, queda medido en cada pedido.

## La especificación

En el contrato de la voz (`voz/Contrato/Contrato.cs`):

| # | Promesa |
|---|---|
| 60 | el delegado de GPT-Live es gpt-6-luna, pensando en medio y con prisa: reasoning.effort = medium y service_tier = priority, al abrir y al cambiar de modo |
| 61 | la voz de GPT-Live conversa mientras se trabaja: su persona manda delegar antes de comentar, contar los avances que le llegan y hablar de lo que ya pasó, prohíbe dar por hecho lo que no le ha llegado, y ya no le ordena callar |
| 62 | la voz de GPT-Live sabe que ve por su equipo: su persona manda delegar lo de mirar y prohíbe decir que no puede ver |
| 63 | un avance del trabajo viaja a la voz como contexto callado: un session.thinking.append sin delegación con el texto dentro; un protocolo sin ese canal no manda nada |
| 64 | los avances no ametrallan a la voz: el primero sale al momento, los que llegan antes de cumplirse el espacio se juntan en el siguiente, y N hechos que entran son N hechos que salen, en orden y una sola vez |
| 65 | un fallo no espera: sale al momento aunque no se haya cumplido el espacio, con lo guardado delante, y dice que no se pudo |
| 66 | un avance nunca pasa de lo que cabe en un append: lo que sobra se recorta diciéndolo, y volver al modo normal sigue cabiendo con la persona nueva |
| 67 | la prisa del delegado y cuánto piensa se eligen al construir: sin prisa la delegación no lleva service_tier, ni al abrir ni al cambiar de modo, y el esfuerzo pedido es el que viaja |

En el contrato del grafo (`tests/ContratoDelGrafo/Contrato.cs`):

| # | Promesa |
|---|---|
| 680 | el historial con que abre la voz cabe siempre en lo que el servidor admite: a lo sumo 128 mensajes y un presupuesto de caracteres, quedándose con lo más reciente, y un turno más largo que el presupuesto se recorta en vez de dejar la apertura sin historia |
| 751 | con GPT-Live quien actúa no es quien habla: el delegado recibe sus propias instrucciones —encadena sin anunciar y devuelve hechos, estado y siguiente paso— sin las reglas de callar de la voz única, y las de la voz única no cambian |
| 752 | lo que se le cuenta a la voz sale del resultado y no de la intención: una herramienta que actuó es un avance con su primera línea, una que no actuó es un avance de fallo, y un paso de plan fallido también |
| 753 | la línea del turno dice si la voz habló mientras se trabajaba: cuántas frases dijo durante el trabajo y el silencio más largo |
| 754 | señalar manda su foto: tras map_pointing_at la foto del momento viaja al delegado, como promete su descripción |
| 755 | sin micrófono no se le cuenta nada a la voz: una sesión abierta para lo escrito no recibe avances, que el servidor no llegaría a entregar; y una voz que también actúa tampoco |
| 756 | el delegado, su prisa y cuánto piensa se cambian sin recompilar: U_DELEGADO elige el modelo, U_DELEGADO_PRISA la quita con 0 y la pide con 1, y U_DELEGADO_ESFUERZO dice el esfuerzo; en blanco, ausentes o con otro valor queda lo de por defecto |

### Promesas que se retiran (los números no se reciclan)

| # | Decía | Por qué se retira | La hereda |
|---|---|---|---|
| 46 (voz) | la voz de GPT-Live no anuncia lo que va a hacer: prohíbe el futuro y manda callar mientras se trabaja | es la orden de callar que el dueño pidió quitar | 61 |
| 518 (grafo) | Luna piensa en modo rápido: reasoning.effort = low | con gpt-6-luna bajar el esfuerzo ahorra 130 ms y cuesta aciertos: 4 de 6 contra 16 de 18 | 60 (voz) |
| 520 (grafo) | quien planea es GPT-6.1 Sol con el pensamiento en bajo y sin priority | decisión del dueño del 2026-09-30: «pasemos a luna 6»; y las medidas de arriba | 60 (voz) |

La 40 y la 42 de la voz conservan su enunciado; su comprobación del modelo delegado pasa a
`gpt-6-luna`. La 210 del grafo, igual, y su doble de entorno deja de contestar lo mismo a toda
variable. La 161 del grafo se queda como está: juzga las instrucciones de la voz única, que no cambian.

### Con qué se juzga cada una

- **60–63, 66, 67**: el JSON que saca `ProtocoloGptLive`, sin socket.
- **64–65**: `AvancesParaLaVoz` con un reloj inyectado, sin esperar.
- **680**: `ConversacionPersonal.Historial()` sobre un archivo temporal de la prueba.
- **751–752, 754–756**: funciones puras de `ConversacionEnVivo`, pedidas por nombre con reflexión, y el
  cableado leído de la fuente.
- **753**: `CuentaDelTurno` con un reloj inyectado.

Lo que el contrato no puede juzgar es lo que **hace el servidor** con todo esto. Eso lo mide la sonda,
y por eso la sonda entra al repo con esta spec.

## Sabotaje

26 sabotajes en ocho tandas, cada uno comprobado aplicado antes de correr (el guion falla si su texto
no casa) y sobre código ya commiteado. Cada promesa nueva se puso roja por su razón escrita, y las
que no tocaba el sabotaje siguieron verdes:

| Tanda | Sabotaje | Rojas |
|---|---|---|
| voz A | delegado Sol · persona que delega «cuando termines de comentar» · sin «nunca digas que no puedes ver» · avance como dictado · fallo sin urgencia · sin recorte | 60, 61, 62, 63, 65, 66 (y 40, 42 por el delegado) |
| voz B | sin espacio entre avances | 64 (y 65, 66, que cuentan con él) |
| voz C | lo guardado se tira · la vuelta de modo con 25.000 caracteres | 64, 66 |
| voz D | esfuerzo por defecto en low · priority siempre | 60, 67 |
| voz E | sin prisa por defecto · el esfuerzo pedido no viaja | 60, 67 |
| grafo A | historial sin presupuesto · GPT-Live con las de la voz única · ningún avance es fallo · se cuentan todas las frases · señalar sin foto | 680, 751, 752, 753, 754 |
| grafo B | el plan no le llega a la voz · mirar se cuenta · sin tope de 128 · el delegado con «habla poco» | 680, 751, 752 |
| grafo C y D | avances sin micrófono · `U_DELEGADO` ignorada · el micrófono no se anota · la prisa no se quita | 755, 756 |

## El nivel 4: sobre el servidor real y sobre la Ü real

**El servidor** (sonda, la frase entra como audio sintetizado; ni micrófono, ni altavoz, ni escritorio):
70 sesiones entre baterías y medidas de velocidad. Lo que dijo la voz en una corrida, tal cual:

> «Dale. Lo lanzo ahora mismo. Ya se abrió la calculadora. Ya escribí 1234 por 56. Y el bloc de notas
> ya está abierto. Listo: el resultado es 69.104 y ya quedó escrito en el bloc de notas.»

**La Ü real** (`C:\U-versiones\conversa\U.exe`, datos propios, MCP en su propio puerto, órdenes por
`u_orden`), el 2026-10-01 entre las 02:16 y las 03:21, en **tres pantallas**: la Calculadora,
Configuración y la carpeta Descargas. 48 pedidos en nueve pasadas. Con la rama, de un log:

```
[02:17:57] plan: 📋 plan de 4 paso(s): abre: calculadora → escribe: 25*4= → abre: Configuración → ir a Sistema
[02:17:58] voz-viva: avance a la voz: AVANCE DEL TRABAJO EN CURSO (todavía no ha terminado). abrí «calculadora».
[02:18:00] voz-viva: avance a la voz: AVANCE DEL TRABAJO EN CURSO (todavía no ha terminado). escribí «25*4=». abrí «Configuración». «ir a Sistema»: cumplido.
[02:18:11] voz-viva: Ü dijo: El resultado de 25 por 4 es 100. Configuración quedó abierta en Sistema.
[02:18:24] voz-turno: llamadas=1 … pensar=2472 ms ejecutar=3356 ms luna=42% hablo_durante=0 silencio_max=3360 ms
```

**Lo que el nivel 4 NO probó:** la voz hablando durante el trabajo **en la Ü real**. Las órdenes de
prueba entran escritas y sin micrófono, y por ese camino no hay voz a la que contarle nada (promesa 755).
Que la voz acompaña está medido contra el servidor con la sonda, con la persona, el mensaje y la regla
de la app; falta oírlo con el micrófono abierto, y eso lo hace una persona.

### Cómo se repite la medida

```powershell
# 1. La app, y el session.start que manda (sus instrucciones y sus 28 herramientas)
dotnet build windows-client\WindowsClient.csproj -c Release -o C:\U-versiones\conversa
dotnet build sondas\VolcarApertura\VolcarApertura.csproj -c Release -p:UBin=C:\U-versiones\conversa -o C:\U-versiones\conversa
C:\U-versiones\conversa\volcar-apertura.exe C:\U-tmp\apertura.json C:\U-tmp\delegado.txt

# 2. El servidor: ¿habla la voz mientras se trabaja?, y ¿cuánto piensa el delegado?
dotnet build sondas\DeLaVoz\DeLaVoz.csproj -c Release -o C:\U-tmp\sonda
python sondas\DeLaVoz\medir\bateria.py   C:\U-tmp\sonda\sonda-de-la-voz.exe C:\U-tmp\delegado.txt base,falla,pregunta,rapido
python sondas\DeLaVoz\medir\velocidad.py C:\U-tmp\sonda\sonda-de-la-voz.exe C:\U-tmp\apertura.json luna-medium-priority,sol-low

# 3. La Ü real: seis pedidos por combinación, sobre el mismo binario (opera el escritorio)
python scripts\nivel4-voz\por-ordenes\calidad.py  C:\U-versiones\conversa\U.exe por-defecto,sol-low C:\U-versiones\nivel4
python scripts\nivel4-voz\por-ordenes\analizar.py C:\U-versiones\nivel4 por-defecto,sol-low
```

Todo lo de arriba gasta la voz de pago (`OPENAI_API_KEY`). La sonda no suena ni toca el escritorio; la
batería de la Ü real abre la Calculadora y Configuración y las cierra si las abrió ella.

## Lo que NO entra

- **Vídeo continuo.** `gpt-live-1` no acepta imagen ni vídeo; la vista sigue siendo la foto a demanda
  por el delegado (spec 027), que es lo que la documentación recomienda.
- **La delegación por cliente.** Daría control del historial y de cuándo entra la foto, a cambio de
  escribir nuestro propio bucle de Responses. No hizo falta para esta meta.
- **El álbum de miradas y la imagen incrustada.** No se usan (0 consultas en 13 días) y se pueden
  retirar, pero retirar el álbum es retirar las promesas 255, 257 y 258: va en su rama.
- **La voz única (`U_VOZ=realtime`).** Sus instrucciones no cambian.

## Hallazgos

- **2026-10-01 · Las órdenes de prueba podían ir a la Ü de otra sesión.** El arnés eligió el puerto 8797 y
  otra Ü de pruebas ya escuchaba ahí: la mía no pudo abrir su MCP, y dos de mis órdenes («abre la
  calculadora…», «abre Configuración…») las cumplió la de otra sesión. El arnés ahora busca un puerto
  libre, exige ver en SU log que el MCP abrió en ese puerto y que la orden llegó, y lee solo el log de su
  proceso.
- **2026-10-01 · En el probador un paso fallido devolvía una pantalla de éxito.** Con `--falla 3` la sonda
  contestaba con el Bloc de notas abierto y el número escrito, y el delegado concluía —con razón— que había
  quedado hecho. No era la voz inventando. La pantalla de mentira es ahora la de lo que sí se hizo.
- **2026-10-01 · El delegado terminó con una promesa.** Escribió «resultado de la calculadora» donde iba el
  número, devolvió «lo corrijo ahora» y terminó sin corregirlo. Sus instrucciones llevan ahora «no termines
  con una promesa» (751).
- **2026-10-01 · La voz leyó la etiqueta.** Con avances del estilo «Hecho: abrí la calculadora» dijo «Hecho:
  ya abrí la calculadora» en 3 de 14 corridas. Los avances van sin etiqueta: lo que llega ya está en pasado.
- **2026-10-01 · Un número mal dicho, 1 de 22.** El delegado devolvió 69.104 y la transcripción de la voz
  dice «setenta y un mil ciento cuatro». No se sabe si lo dijo así o si es la transcripción. Sin arreglar.
- **2026-10-01 · Un esfuerzo que el modelo no admite no impide abrir.** `gpt-6.1-sol` con `none`: la sesión
  abre, el servidor contesta «Unsupported value» y el delegado no hace nada. Seis pedidos sin respuesta y
  sin un error en pantalla. Queda escrito en el protocolo; no se valida todavía.
- **2026-10-01 · Volver de un modo especial dejaba a Ü sin memoria.** Los tres sitios que vuelven mandaban
  las instrucciones de fábrica. Ahora vuelven con las de la apertura (`VolverAlModoNormalAsync`), y unas
  instrucciones de operar que no caben en un append ya no se le mandan a la voz (66).
- **2026-10-01 · La apertura perdía el párrafo del decisor.** Salía de la constante y no de
  `InstruccionesNormales`. Arreglado de paso: las dos aperturas salen de `InstruccionesPara` (751).
- **2026-10-01 · El texto del delegado entra dos veces en «Ü dijo».** `response.output_text.done` se
  traduce como algo que Ü dice, y la voz lo vuelve a decir con sus palabras: en el log, «Abrí tu correo
  en Gmail. Abrí tu correo en Gmail.». Se guarda así en el hilo. Sin arreglar: va con la spec 074, que
  lleva un diario propio.

## Al mezclar con `main` (2026-10-01)

`main` avanzó mientras esta rama vivía: entró «una sola Ü» (PR #157, spec 078 de main), que reescribió las
instrucciones de la voz y del delegado, y la spec 075 (la voz al primer clic). Lo que cambió aquí:

- **Los números.** Las promesas nacieron como 680–686; `main` ya tenía esos números (spec 076). Son ahora la
  **751 a la 756**, en el mismo orden. **La 680 se fue**: el presupuesto de la historia al abrir ya lo promete
  la 667 de `main`, con su propio tope (20.000 caracteres), y la rama se quedó con el código de `main`.
- **La 46 de la voz vuelve.** Esta spec la había retirado porque con ella la persona acababa ordenando
  «mientras se hace el trabajo, calla». `main` la sigue exigiendo (58), y al juntar los dos textos se vio que lo
  que hacía callar era esa frase y no la regla. La persona de hoy dice las dos cosas —«NO ANUNCIES LO QUE VAS A
  HACER» y «MIENTRAS SE TRABAJA te llegan avances»—, cabe en el presupuesto de la vuelta (1.283 caracteres;
  1.694 con el prefijo y la frase de perfil más larga, de 1.700) y se volvió a medir con la sonda: 2, 4 y 4
  frases durante el trabajo en tres corridas, todas en pasado. La 61 ya no prohíbe «NO ANUNCIES…».
- **Las instrucciones del delegado ya no son un texto aparte.** Eran cabecera + cuerpo + habla + cola; `main`
  dejó un solo texto para las dos voces (constitución + operación, con presupuesto y con el perfil en medio).
  Lo que es solo del delegado va ahora **detrás** de las de siempre (`ConversacionEnVivo.LoQueSeAnade`): que
  otra voz habla por él, que encadena sin anunciar, que devuelve hechos, estado y siguiente paso, y que donde
  la operación diga «habla» lo devuelve en su resultado. La 751 dice eso; antes decía «sin las reglas de callar
  de la voz única», que con el texto de `main` ya no es cierto: le llegan, y se le dice cómo leerlas.
- **Volver de un modo** es el `VolverAlModoNormalAsync` de `main` (promesas 727 y 728), que compone de nuevo. El
  de la rama, que reenviaba las instrucciones guardadas de la apertura, se fue.

## Cierre

- [x] Todas las promesas verdes: VOZ ÍNTEGRA (53) y CONTRATO INTACTO (385), 2026-10-01
- [x] Sabotaje comprobado, promesa por promesa (26 sabotajes)
- [x] La sonda cumple la meta contra el servidor real
- [x] Probado en la Ü real, en tres pantallas: Calculadora, Configuración y Descargas
- [ ] Oído con el micrófono abierto por una persona: lo único que el arnés no puede hacer
- [x] Estado de este documento: **implementado** (2026-10-01)
