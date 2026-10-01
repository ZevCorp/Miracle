# Plan de implementación: el panel se queda con lo justo —Memoria, el collar y de qué lado vive—, y Memoria abre todo lo que Ü sabe de ti

Estado: **implementado** (2026-09-30) · Nace de la petición del dueño del 2026-09-30 · Rama: `jose/memoria-en-el-panel`

> «Quiero que el panel flotante de la derecha pierda todos los botones que tiene (excepto el del
> collar que abre una ventana fija) y quiero allí un botón que se llame "Memoria" que abra todo lo
> que U sabe sobre mí, toda la información que recopila (User friendly)».

## Diagnóstico: qué se midió

Medido el 2026-09-30 sobre `main` (`baf57395`) y sobre los datos reales de este PC.

| Qué | Medida | Fuente |
|---|---|---|
| Botones del óvalo en reposo | 5: `Learn`, `Work`, `Subir`, `Jev · off` y el collar. La flecha del menú ya nace `Collapsed` desde el 2026-08-06 | `FaceWindow.xaml` 483-589, `WireMenu` |
| Botones del óvalo que solo existen a ratos | 4: ⬇ actualizar, ⏹ detener, 🔄 rehacer, 🧭 comprobar | `ContextZone` |
| `Work` | no hace nada; lo dice su propio tooltip | `FaceWindow.xaml` 491 |
| `Learn` | tiene un gemelo en el panel de desarrollo (🎓, mismo manejador) | `TeachBtn` |
| `Subir` y `Jev` | su única puerta es el óvalo | `OnSubirEstudios`, `OnToggleJev` |
| Promesas del contrato que nombran esos botones | 0 | `grep` en `Contrato.cs` |
| Almacenes con datos de la persona, en disco | 13 (tabla de abajo) | `%APPDATA%\U`, `%LOCALAPPDATA%\U` |
| Formas de ver esos datos desde la app, hoy | 1 de 13: 🧠 «recuerdos de aquí», y solo los de la pantalla actual | `OnVerRecuerdos` |
| Almacenes que convierten «no pude leerlo» en «vacío» | 2: `MemoriaPersonal.Leer` y `ConversacionPersonal.Leer` devuelven un documento vacío ante un JSON roto | código |

Lo que Ü guarda de la persona en este PC, con lo que había el 2026-09-30:

| Almacén | Qué es | Había |
|---|---|---|
| `config.json` | nombre, correo, y también la clave del cliente y el id de instalación | 1 |
| `memoria-personal.json` | lo que se le dijo que recordara, y los recordatorios | 12 datos, 4 recordatorios |
| `conversacion-personal.json` | lo hablado, turno a turno (tope: 160) | 75 turnos |
| `skills\*.skill.json` | habilidades enseñadas | 2 |
| `lecciones\*\leccion.json` + `teach-videos\` | grabaciones de pantalla y voz de cada enseñanza | 4 lecciones, 7 videos, 2,9 GB |
| `recuerdos\miradas\` + `album.json` | fotos de la pantalla al pasar por cada sitio (tope: 7 días o 2 GB) | 1.614 fichas, 440 sitios, 564 MB |
| `recuerdos\fotos\` | la foto de la ventana de cada elemento del que Ü tiene apuntado para qué sirve | 118 |
| `titulos-web.json` | sitios web abiertos, con los títulos de sus pestañas | 153 dominios |
| `collar.json`, `nombres-de-dispositivos.json` | el collar y los nombres puestos a micrófonos | collar enlazado |
| `omi-telefono.json` | el código para emparejar el teléfono. No es un dato de la persona: no se lee ni se enseña (625) | 1 |
| `logs\` | el registro de lo que Ü hace | 70 archivos, 13 MB |
| fuera del PC | el registro se copia al servidor con el correo (`EspejoDelLog`), los workflows viven en Graph, y la voz pasa por el servicio de voz | código |

## Por qué esto va dirigido por especificación

Una ventana que dice «esto es todo lo que sé de ti» es una afirmación sobre el sistema entero, y
puede ser falsa de tres formas sin que nada falle: callarse un almacén, enseñar como vacío uno que
no pudo leer, o enseñar algo que no debía salir (la clave del cliente vive en el mismo archivo que
el nombre). Las tres se parecen a «funciona». Sin promesa, la ventana se juzgaría a sí misma.

**La regla del flujo, y no tiene excepciones:** ninguna línea de producción entra antes que la
promesa que la juzga. Cada fase empieza con el contrato ROTO y termina con el contrato INTACTO.

## La especificación

620-629 reservadas el 2026-09-30. `main` va por la 423; hay ramas vivas hasta la 609 (spec 070).

| # | Promesa | Fase que la pone verde |
|---|---|---|
| 620 | el panel en reposo ofrece tres botones y nada más: «Memoria», el collar y el de cambiar de lado; Learn, Work, Subir y Jev ya no están en él *(nació como «dos puertas»; el dueño pidió el tercero el mismo día, antes de que llegara a `main`)* | 3 y 5 |
| 621 | lo que salió del panel no se pierde: subir estudios y encender Jev siguen teniendo su puerta en el panel de desarrollo, con el mismo manejador | 3 |
| 622 | la Memoria cuenta TODO lo que Ü guarda de ti: cada almacén tiene su apartado con su cuenta, y un almacén sin nada dice «todavía nada» en vez de desaparecer | 1 |
| 623 | un almacén que no se pudo leer dice que no se pudo leer y por qué; no se enseña como vacío | 1 |
| 624 | la Memoria habla como una persona: ni rutas, ni nombres de archivo, ni identificadores, ni direcciones internas; las fechas se dicen «hoy», «ayer» o con día y mes | 1 |
| 625 | lo secreto no se enseña: ni la clave del cliente, ni el identificador de la instalación, ni el código del teléfono | 1 |
| 626 | abrir la Memoria no cambia nada de lo guardado: los archivos quedan byte a byte como estaban | 1 |
| 627 | el botón «Memoria» abre su ventana, y volver a pulsarlo la trae al frente o la quita, con la misma regla que el del collar | 2 |
| 628 | tocar el botón desde otra ventana no cuenta como haber dejado la Memoria: si perdió el foco por ese mismo toque sigue estando al frente y el botón la quita; si lo había perdido antes, la trae | 4 (nació de un hallazgo) |
| 629 | el panel se puede mandar al otro lado de la pantalla: a la izquierda queda a la misma distancia de su borde que tenía del derecho y entra desde ese borde; el lado elegido es el que se encuentra al volver a abrir Ü, y un lado guardado que no se entiende es la derecha | 5 (pedido del dueño al probarlo) |

Con la 629 se agota el bloque 620-629.

La que cierra el asunto es la **622**: mientras el plan de apartados no sea el denominador, todo lo
demás es una ventana bonita sobre una parte de los datos.

### Con qué se juzga cada una

- **620, 621 y 627** leen las fuentes (`FaceWindow.xaml` y su código) por `U_REPO`, como las
  promesas del notch: lo que puede volver a llenarse de botones es el XAML.
- **622 a 626** se juzgan con almacenes **escritos por las clases que los escriben en la app**
  (`MemoriaPersonal`, `ConversacionPersonal`, `AlbumDeMiradas`, `SkillEnsenada`, `PestanasAbiertas`),
  en el directorio propio de la prueba. No es un detalle: la Memoria lee los archivos ella misma
  —tiene que poder decir «no pude leerlo», y las clases dueñas se tragan ese error—, así que el
  formato vive en dos sitios. Lo que impide que se separen es que el contrato escribe por un camino
  y lee por el otro (aprendizaje nº16).

## Las fases

### Fase 1 — todo lo guardado se puede contar, en palabras de persona y sin tocarlo

| | |
|---|---|
| **Promesas que pone verde** | 622, 623, 624, 625, 626 |
| **Qué toca** | `windows-client/src/Memoria/LoQueUSabe.cs` (nuevo, sin pantalla) |
| **¿Núcleo congelado?** | no |
| **Terminado** | las cinco verdes, las anteriores intactas |

### Fase 2 — la ventana

| | |
|---|---|
| **Promesa que pone verde** | 627 |
| **Qué toca** | `windows-client/src/Ui/MemoriaWindow.cs` (nuevo), `FaceWindow.xaml.cs` (`OnMemoria`) |
| **Terminado** | 627 verde; la ventana solo pinta lo que le da la fase 1 |

### Fase 3 — el panel se queda con dos puertas

| | |
|---|---|
| **Promesas que pone verde** | 620, 621 |
| **Qué toca** | `FaceWindow.xaml`, `VestirElPanelConElEstudio` |
| **Terminado** | 620 y 621 verdes, y a mano: el óvalo se ve con «Memoria» y el collar |
| **Sitios que nombran los botones que se van** | `LearnBtn` 1, `WorkBtn` 1, `SubirBtn` 1, `JevBtn` 3 (contados con grep en `FaceWindow.xaml.cs`; fuera de él, ninguno) |

## Decisiones que la petición no decía, y cómo se tomaron

1. **Los botones que solo existen a ratos se quedan** (⏹ detener, ⬇ actualizar, 🔄 rehacer,
   🧭 comprobar). No se ven en reposo, y ⏹ es la única forma de parar con el ratón algo en marcha.
2. **`Subir` y `Jev` se mudan al panel de desarrollo** (Ctrl+Shift dos veces), no se borran. Es lo
   que ya se hizo el 2026-08-07 con enseñar y silenciar: «mover algo de sitio no es reescribirlo».
   `Learn` ya tenía allí a su gemelo 🎓. `Work` no hacía nada y se va del todo.
3. **La Memoria solo enseña; no borra ni corrige.** Ver «lo que NO entra».

## Lo que NO entra

- **Olvidar desde la Memoria** (borrar un dato, un recordatorio, las miradas). Es la continuación
  natural y la primera que pediría alguien al verse retratado, pero borrar es otra promesa —qué se
  borra, de dónde, y si el servidor se entera— y merece su spec.
- **Enumerar lo que hay en el servidor** (workflows de Graph, el registro copiado). La Memoria dice
  que existe y qué es; no lo lista, porque hoy no hay una puerta que lo devuelva por persona.
- ~~**Que `MemoriaPersonal`, `ConversacionPersonal`, el álbum, las fotos y las skills respeten
  `U_DATA_DIR`.**~~ Lo arregló `main` esa misma noche, por su lado: al poner la rama al día, esos
  almacenes ya seguían a `UserPaths`. La Memoria les pregunta a ellos dónde escriben, así que se
  mudó sin tocarse.
- **Un guardia que ponga rojo el contrato cuando aparezca un almacén nuevo sin apartado.** Sería lo
  que mantiene cierto el «TODO» de la 622 con el tiempo; hoy el plan está completo por inventario.

## Hallazgos

- **2026-09-30 — dos almacenes dicen «vacío» cuando no pudieron leer.** `MemoriaPersonal.Leer` y
  `ConversacionPersonal.Leer` devuelven un documento nuevo ante un JSON roto, y el siguiente
  `Escribir` lo pisa: un archivo dañado se convierte en memoria en blanco sin una línea de log. La
  Memoria no hereda el vicio (623), pero el vicio sigue en la voz.
- **2026-09-30 — la rama de trabajo del clon estaba 923 commits detrás de `main`.** El panel que se
  veía en `windows-client/` ya no era el de `apps/windows/windows-client/`.
- **2026-09-30 — de las fotos de «esto es…» no se sabe quién las pidió.** La foto se guarda cuando
  `map_esto_es` prospera, y esa herramienta la llama la persona señalando y también el modelo mientras
  trabaja. El apartado se iba a llamar «lo que me explicaste señalándolo»; con los datos reales
  aparecieron «Show more messages» y «Select currency» de las 19:54, que nadie explicó. Se quedó en
  «lo que sé de las cosas de tu pantalla», sin afirmar una causa que el archivo no distingue (nº2).
- **2026-09-30 — la flecha del menú se contaba como botón visible.** Estaba escondida desde el
  2026-08-06, pero solo en `WireMenu`. La promesa 620 la contó al nacer («hay 6»). Ahora nace
  `Collapsed` en el XAML, que es donde se lee.
- **2026-09-30 — en el panel de desarrollo, 🔍 📍 🧠 📜 se pintan con tinta oscura sobre fondo oscuro.**
  `VestirElPanelConElEstudio` les pone `Estudio.Tinta` «sobre el blanco del estudio», y el panel donde
  viven sigue siendo `#F20F131C`. Se ve en la foto del nivel 4. Ya estaba así en `main`; no es de esta rama.
- **2026-09-30 — abrir la Memoria deja una mirada en el álbum.** Lo hace la Ü que esté corriendo al ver
  una ventana nueva («pasando por aquí»), no la Memoria: la 626 lo separa. En la prueba la foto quedó
  apuntada a `dotnet.exe`, porque quien abrió la ventana fue la sonda.

- **2026-09-30, 22:21 — la 627 estaba verde y el segundo clic NO quitaba la ventana.** La sonda de las
  20:52 pulsaba el botón sin que ninguna ventana cambiara de foco, y por eso vio «2º clic: visible=False».
  En la app el botón vive en otra ventana —el muelle, que es una ventana normal: tocarla la activa—,
  así que cuando el clic llega al manejador la Memoria ya perdió el foco *por ese toque*. `IsActive`
  contestaba que no, y la regla, «tráela». Medido con el óvalo en una ventana como el muelle:
  `2o toque, con el foco ya en el ovalo -> visible=True`. De ahí la promesa 628 y la fase 4: la
  ventana apunta cuándo pierde el foco, la carita apunta cuándo se apoya el ratón, y la regla compara.
  Es el aprendizaje «una sonda no es la persona», pagado otra vez.
- **2026-09-30 — el botón del collar tiene la misma forma y no se ha medido.** `OnAbrirConsulta`
  pregunta `abierta.IsActive` desde el mismo sitio. Sitios con esta clase de error: 2 (`grep` de
  `AlPulsarSuBoton`); arreglado 1. El del collar no se toca aquí: no se pudo abrir la consulta para
  medirlo, y arreglar sin medir es lo que acaba de salir mal.

### Fase 4 — el botón sabe si la ventana estaba delante

| | |
|---|---|
| **Promesa que pone verde** | 628 (y la 627, cuyo juez se muda con la decisión) |
| **Qué toca** | `Ui/ReglaDeLaVentana.cs` (`EstabaAlFrente`), `Ui/MemoriaWindow.cs` (`AlTocarSuBoton`), `FaceWindow.xaml` y su código (`OnMemoriaSeToca`) |
| **Terminado** | 628 verde; con el óvalo en una ventana como el muelle, el segundo toque la quita |

### Fase 5 — el panel vive en el lado que la persona elija

El dueño, al probarlo (22:37): «quiero que le agregues un botón como el de la imagen para poder hacer
que esa pill flotante aparezca a la izquierda o a la derecha de la pantalla». El dibujo eran dos hojas,
una al lado de la otra.

| | |
|---|---|
| **Promesa que pone verde** | 629, y la 620 con su enunciado nuevo |
| **Qué toca** | `Ui/ReglaDelMuelle.cs` (el lado, dicho una vez), `Ui/Muelle.cs`, `Config.cs` (`LadoDelMuelle`), `FaceWindow.xaml` y su código (`LadoBtn`, `OnCambiarDeLado`) |
| **Sitios con «derecha» escrito a mano en el muelle** | 3: dónde se coloca, a qué lado se acopla la pestaña y desde dónde entra el panel. Los tres pasan por la regla |
| **Lo que ya existía y se reusó** | `ApplyBarSide`, el espejo del contenido, de cuando la barra viajaba con la carita |
| **Terminado** | 629 verde; el dueño lo cambia de lado con su ratón y el panel se pliega y vuelve a salir en el lado nuevo |

- **2026-09-30, 22:37 — el dueño creyó que el panel se había vuelto «un óvalo flotante» y que el botón
  del collar ya no abría su ventana.** Ninguna de las dos cosas era de la rama: eran de mi montaje de
  prueba, que enseñaba el panel suelto en una ventana siempre visible y sin `App` detrás. En la app el
  panel seguía en su muelle y el collar abría la consulta. Un montaje que se parece al producto y no
  se comporta como él hace que quien lo prueba reporte regresiones que no existen: para que el dueño
  pruebe, la app entera.

## Evidencia (2026-09-30)

| Nivel | Estado | Detalle |
|---|---|---|
| 1 · compila | OK | Release, dentro de `contrato-del-grafo.ps1` |
| 2 · el contrato, antes | ROJO por lo escrito | 313 ✔ y las ocho nuevas ✘: 620 «hay 6», 621 sin puerta, 622-626 `PENDIENTE LoQueUSabe`, 627 `PENDIENTE MemoriaWindow` |
| 2 · el contrato, después | **CONTRATO INTACTO** | 321 ✔, 0 pendientes |
| 2 · sabotaje | las ocho se ponen rojas | ver abajo |
| 3 · escenarios | NO CORRIDO | no hay escenarios de la carita |
| 4 · PC real | hecho con una sonda, **no con la app entera** | ver abajo |

**El sabotaje**, aplicado con anclas comprobadas (cada reemplazo exige casar una sola vez) y deshecho
restaurando copias con su SHA-256 verificado:

| Sabotaje | Se puso roja | Lo que dijo |
|---|---|---|
| `Work` vuelve al óvalo | 620 | «hay 3 (WorkBtn, MemoriaBtn, CollarModoBtn)» |
| el botón de Jev llama a otro manejador | 621 | «encender Jev tiene su botón en el panel de desarrollo» |
| no se filtra por persona | 622 | «lo contado son 2 cosas…: 3», «lo que recordó otra persona… no se enseña» |
| un apartado se cae del plan | 622 | «sin nada guardado se cuentan los doce apartados» |
| lo dañado se da por ausente | 623 | cinco apartados «Vacio» donde tocaba «NoSePudoLeer» |
| lo ocupado se da por ausente | 623 | «conversacion… en vez de decir «vacío»: Vacio» |
| los sitios se dicen como los guarda la máquina | 624 | «en uia://chrome.exe/…», falta «Bloc de notas» |
| la clave del cliente sale junto al nombre | 625 | «la clave del cliente no se enseña» |
| se lee por la puerta de la voz | 626 | «…no escribe, no borra y no crea nada: memoria-personal.json» |
| `OnMemoria` deja de usar la regla | 627 | «lo decide la misma regla que el botón del collar» |

**El nivel 4.** No se arrancó la app entera: al arrancar reconecta el collar, y en ese momento había
otra Ü corriendo (`C:\U-versiones\diarizacion`) a la que se lo habría quitado. Una sonda construyó la
carita SIN mostrarla —todo lo que arranca voz, collar y MCP vive en `OnLoaded`—, vistió el óvalo con
`VestirElPanelConElEstudio`, y pulsó «Memoria» por su manejador de verdad, con los datos reales:

```
[20:52:32.646] ovalo · boton «MemoriaBtn» contenido=«Memoria» visibility=Visible seVeria=True alto=38 ancho=124
[20:52:32.650] ovalo · boton «CollarModoBtn» contenido=«Canvas» visibility=Visible seVeria=True alto=38 ancho=38
               (UpdateBtn, StopBtn, RestartTeachBtn, ComprobarBtn y MenuActivator: seVeria=False)
[20:52:32.811] panel de desarrollo · «SubirBtn» contenido=«Subir fotos de estudios» alto=28 ancho=266
[20:52:32.812] panel de desarrollo · «JevBtn» contenido=«Jev · off» alto=28 ancho=266
[20:52:33] la-memoria: la ventana se abre
[20:52:33] la-memoria: leída en 280 ms · 12 apartados · 12 con datos · 0 vacíos · 0 sin poder leer
[20:52:36.185] tras el 1er clic: ventana existe=True visible=True activa=True en (828,76) 508x740
[20:52:36.640] en lo pintado, la clave del cliente: no sale
[20:52:36.641] en lo pintado, el id de instalacion: no sale
[20:52:36.641] en lo pintado, «\»: 0 · «://»: 0 · «.json»: 0 · «.exe»: 0 · «.log»: 0 · «local_»: 0 · «leccion_»: 0
[20:52:36.643] en lo pintado, «.jpg»: 1 texto · el título de una página web, copiado tal cual
[20:52:37.265] clic en «Ver las 12»: textos 125 -> 141; ahora hay un «Ver menos»: True
[20:52:38.427] 2o clic (la ventana estaba activa=True): visible=False activa=False
[20:52:40.270] 3er clic: visible=True activa=True
[20:52:40.598] Escape: visible=False
```

Mientras tanto, `config.json`, `memoria-personal.json`, `conversacion-personal.json`, `collar.json` y
`titulos-web.json` no cambiaron de tamaño ni de fecha.

**OJO con la línea de las 20:52:38.** «2o clic: visible=False» es de una sonda que pulsaba sin mover
el foco. No vale como prueba del segundo clic; ver el hallazgo de las 22:21.

**La fase 4 (promesa 628), de las 22:21 en adelante.** Contrato: rojo antes (627 con su juez nuevo y
628 `PENDIENTE EstabaAlFrente`), `CONTRATO INTACTO` después con 322 ✔. Sabotaje, en dos tandas:

| Sabotaje | Se puso roja | Lo que dijo |
|---|---|---|
| solo cuenta tener el foco (el fallo medido, de vuelta) | 628 | «perdió el foco 4 ms antes del toque…», «…la quita, aunque el óvalo se haya quedado con el foco» |
| la ventana decide sin la regla | 627 | «lo decide la misma regla que el botón del collar» |
| el margen sube a 5 s | 628 | «lo perdió segundo y medio antes: ya estaba detrás», «el margen… entre 100 y 500 ms: 5000» |
| nadie apunta cuándo se apoya el ratón | 628 | «el instante del toque es el de apoyar el ratón, no el de soltarlo» |

Con el óvalo en una ventana como el muelle (sin marco, transparente, siempre delante, que toma el
foco al tocarla), antes y después del arreglo:

```
antes   [22:21:29.336] 2o toque, con el foco ya en el ovalo -> visible=True activa=True
despues [22:28:49.928] 2o toque, con el foco ya en el ovalo -> visible=False activa=False
        la-memoria: la ventana se quita de en medio
```

El caso contrario —la Memoria detrás desde hace rato, y el botón la trae— NO quedó medido con la
sonda: Windows no le da el foco a un proceso que no está delante, y la ventana se reactivaba sola a
mitad de la prueba. Lo juzga la 628 con números; con el ratón, lo tiene que ver una persona.

**El dueño lo probó a las 22:29** sobre ese mismo óvalo de prueba, con la Memoria leyendo del
respaldo (`C:\U-respaldo\2026-09-30-antes-de-reinstalar`, porque otra sesión había quitado las
carpetas de verdad para probar el instalador): `toque en Memoria · antes: la ventana no existe ·
despues: visible=True activa=True`, `leída en 232 ms · 12 apartados · 10 con datos · 2 vacíos`.

**La fase 5 (promesa 629).** Contrato: rojo antes (620 «hay 2», 629 `PENDIENTE`), `CONTRATO INTACTO`
después con 323 ✔. Sabotaje, en dos tandas:

| Sabotaje | Se puso roja | Lo que dijo |
|---|---|---|
| un cuarto botón en el panel | 620 | «hay 4 (MemoriaBtn, CollarModoBtn, WorkBtn, LadoBtn)» |
| la izquierda es el cero de la pantalla | 629 | «empieza a 10 del borde izquierdo: 0», «…igual de separado en los dos lados: 10 y 0» |
| lo que no se entiende manda a la izquierda | 629 | «"arriba" es la derecha…», y lo mismo con vacío, espacios y nada |
| entra siempre desde la derecha | 629 | «el panel entra desde el borde donde vive» |
| el botón no guarda el lado | 629 | «pulsarlo pasa al otro lado y lo deja guardado en ese mismo gesto» |
| el lado no llega al disco | 629 | «elegida la izquierda, al volver a abrir sigue a la izquierda» |
| el muelle se coloca con el borde derecho a mano | 629 | «el muelle se coloca y se desliza por la regla» |

Con el muelle DE VERDAD (la carita construida sin mostrarse y `MudarElPanelAlMuelle`), en una pantalla
de 1536x816:

```
[22:46:33.679] desplegado -> lado=Derecha · ventana en x=1314..1526 · hueco al borde izq=1314 der=10
[22:46:34.347] tras pulsar el boton de lado -> lado=Izquierda · ventana en x=10..223 · hueco al borde izq=10 der=1313
[22:46:34.353] guardado en la configuracion: «izquierda»
[22:46:34.354] orden en la fila: Grid dock=Left ancho=14 | Decorator dock=Left ancho=198
[22:46:37.966] pulsado otra vez -> lado=Derecha · ventana en x=1314..1526 · guardado «derecha»
```

**Y el dueño, con su ratón, en la app entera** (`C:\U-versiones\memoria\U.exe`, datos en
`C:\U-versiones\memoria-datos`), de su log:

```
[22:43:52] muelle: desplegado · el cursor entró            ← el hover de siempre, antes del botón de lado
[22:43:55] cuenta: sesión restaurada · …                   ← el collar abre su ventana
[22:51:30] muelle: desplegado · el cursor entró
[22:51:32] muelle: ahora vive a la izquierda
[22:51:34] muelle: plegado · el cursor se fue y no quedaba nada abierto
[22:51:34] muelle: desplegado · el cursor entró            ← en el borde izquierdo
[22:51:42] muelle: ahora vive a la derecha
[22:51:44] muelle: ahora vive a la izquierda
[22:52:02] muelle: ahora vive a la izquierda               ← y `LadoDelMuelle: "izquierda"` en su config.json
```

**Al poner la rama al día con `main` (23:30, siete commits nuevos).** Cuatro choques, los cuatro en la
línea que dice dónde escribe cada almacén: se quedó la ruta de `main` (`UserPaths`) con el acceso de
esta rama encima. Y el contrato, que es para lo que se vuelve a correr tras un rebase, salió ROJO:

```
   ✘ toda ventana de Ü está declarada flotante o de trabajo — faltan: MemoriaWindow
✘ 531. las piezas flotantes de Ü … no salen en Alt+Tab …
```

La 531 nació en `main` esa noche (spec 064). `MemoriaWindow` se declaró de trabajo, como la de los
estudios: se lee con calma y se vuelve a ella con Alt+Tab. Después: `CONTRATO INTACTO`, 379 ✔.

## Cierre

- [x] Todas las promesas verdes (`.\scripts\contrato-del-grafo.ps1` → CONTRATO INTACTO, 379 ✔ sobre `main` `e0ceac4e`)
- [x] Sabotaje: las diez se ponen rojas, cada una por lo suyo
- [x] Probado con los datos reales de este PC: el óvalo vestido y la ventana de la Memoria, por una sonda
- [x] La app entera, con el ratón del dueño: el muelle con su hover, el collar, y el panel cambiando de lado
- [ ] **Sin hacer:** en la app entera y con el ratón, pulsar «Memoria» y su segundo toque (que la quite
      si estaba delante y la traiga si llevaba rato detrás), y volver a abrir Ü para ver que nace a la
      izquierda. En su prueba con la app entera el dueño cambió el panel de lado once veces y abrió el
      collar; «Memoria» no la pulsó.
- [x] `.\scripts\verificar.ps1` con el árbol commiteado (23:39): contrato 379/379, contrato de la voz
      46/46, 0 pendientes. Escenarios: NO CORRIDO.
