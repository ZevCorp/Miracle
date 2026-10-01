# Ü Windows — guía para trabajar en `apps/windows`

> Esta es la guía de **Windows**, que desde el 2026-09-28 vive en `apps/windows/` del monorepo.
> Todos los comandos de aquí se corren **desde esta carpeta** (`cd apps/windows`), y abrir Claude
> aquí carga estas reglas, sus skills y sus hooks: Claude Code no hereda hooks ni skills entre
> carpetas. Lo común a todo el monorepo (ramas, commits, qué toca cada máquina) vive en el
> [`AGENTS.md`](../../AGENTS.md) de la raíz y se carga igual desde aquí.

## EL CICLO — léelo antes que nada

Esto es lo único que hay que recordar. Todo lo demás de este archivo explica el porqué.

```
1.  bash ../../tools/monorepo/arbol.sh nuevo jose/lo-que-sea   ← la rama, desde main fresco, EN SU PROPIO ÁRBOL
2.  cd <ese árbol>/apps/windows            ← una rama = UNA cosa, y un agente = un árbol
3.  escribe la PROMESA primero             ← en tests/ContratoDelGrafo/Contrato.cs, y compruébala ROJA
4.  escribe el código hasta que salga verde
5.  ROMPE el código a propósito            ← si la promesa no se pone roja, no vale nada
6.  pruébalo sobre el PC real              ← el contrato no puede tocar la pantalla; tú sí
7.  git push                               ← el portero decide (~60 s)
8.  PR con la evidencia → squash merge
9.  bash ../../tools/monorepo/arbol.sh cerrar   ← borra el árbol y la rama, ya mergeados
```

**El portero** (`.githooks/pre-push` de esta carpeta, al que llama el despachador de la raíz cuando
la rama toca `apps/windows/`) no se puede olvidar: bloquea el empujón directo a `main`, exige que
compile, que los contratos estén intactos, y que la rama traiga su propia promesa. Se activa una vez
por clon:

```powershell
git config core.hooksPath .githooks
```

**Los tres pasos que la gente se salta y son los que valen:**

- **El 3, la promesa antes que el código.** Una prueba escrita después se escribe para que pase.
- **El 5, romper a propósito.** Una promesa que solo se ha visto en verde es indistinguible de una
  que siempre dice que sí. El 2026-08-21 un sabotaje no llegó a aplicarse —el archivo usaba CRLF y
  el patrón usaba `\n`— y el contrato salió verde: si nos fiamos de aquel verde, damos por probadas
  cinco promesas sin haberlas probado. **El sabotaje también hay que comprobarlo.**
- **El 6, el PC real.** El contrato juzga la lógica en un segundo y sin pantalla. Que el gancho de
  teclado esté puesto, que SAP conteste, que el icono se mueva: eso solo lo dice la máquina. Se hace
  a mano y **se pega el log en el PR** — con horas, no con «probado».

**Qué NO bloquea, y a propósito:** los escenarios (`ci-terreno.ps1`, heredero del ci-local que se
colgaba trece minutos). Un paso obligatorio que nadie corre no protege nada y enseña a saltarse el
resto. Vuelve al portero cuando sea fiable — un juez solo puede bloquear cuando ya se ganó que le
crean.

## Qué es

Un asistente que **aprende a operar aplicaciones de escritorio mirando a un humano** y después las
opera solo. El caso real es **SAP GUI en un hospital** (Hospital General de Medellín, IS-H): admitir
pacientes, listar radicados, consultar órdenes clínicas. Se le enseña una vez y lo repite.

No es un grabador de macros por coordenadas: aprende *qué elemento* se tocó para poder repetirlo aunque
la ventana cambie de tamaño, posición o scroll.

## Arquitectura: cliente tonto, cerebro remoto

| Carpeta | Qué es | Dónde corre |
|---|---|---|
| `windows-client/` | Frontend C#/WPF (.NET 8) → `U.exe`. Lee la UI, captura pantalla, mueve ratón/teclado, habla. | PC del usuario |
| `windows-graph/` | Grabar/reproducir workflows sobre SAP GUI y UIA. Compila dentro de `U.exe`. | PC del usuario |
| **Graph** (`graph/`) | El cerebro: LLM, memoria, catálogo de workflows. | `graph-eight-pied.vercel.app` |

El cliente no contiene prompts ni decisiones — todo va por HTTPS. Es anti-copia deliberado: descompilar
el `.exe` no revela la inteligencia. Ver `WINDOWS.md`.

**Los arreglos de fondo casi siempre van en `windows-graph`** (es quien sabe de SAP). `windows-client`
es presentación y diagnóstico.

## Las dos superficies

1. **UIA** — genérica, cualquier app Windows.
2. **SAP GUI Scripting** (COM) — específica de SAP.

**Dentro de SAP GUI, UIA no ve nada.** Se queda en un `Pane` opaco: ni el árbol, ni los campos del
dynpro, ni la barra. Para SAP es Scripting API o nada. Detalles y trampas:
[`windows-graph/CLAUDE.md`](windows-graph/CLAUDE.md).

## Cómo se trabaja aquí: el flujo dirigido por especificación

El repo ya lo hacía sin llamarlo así. [`tests/ContratoDelGrafo/Contrato.cs`](tests/ContratoDelGrafo/Contrato.cs)
no es «un proyecto de tests»: es **la definición ejecutable de lo que el núcleo promete**, y
[`docs/plan-plata-real.md`](docs/plan-plata-real.md) fue la primera spec escrita antes que su código
— encontró un bug de meses (la promesa 19) que ninguna lectura del código había visto.

**La regla, y no tiene excepciones: ninguna línea de producción entra antes que la promesa que la
juzga.** Cada fase empieza con el contrato ROTO y termina con el contrato INTACTO.

| Etapa | Skill | Deja |
|---|---|---|
| 1. Especificar | `/especifica` | `docs/specs/NNN-<slug>.md` con promesas numeradas |
| 2. Partir en fases | `/fases` | la tabla de fases dentro de esa spec |
| 3. Poner en rojo | `/promesas` | las promesas en `Contrato.cs`, ROJAS, antes del código |
| 4. Implementar | `/implementa` | una fase → su promesa verde |
| 5. Verificar | `/verifica` | `out\evidencia.md` con los cuatro niveles |
| 6. Integrar | `/a-main` | PR con evidencia, y `main` sigue verde |

Las reglas de Windows viven en `.claude/rules/` de esta carpeta, y las comunes a todo el monorepo
(ramas y commits, qué toca cada máquina) en `.claude/rules/` de la raíz.
Las dos se cargan solas:

@.claude/rules/flujo-sdd.md
@.claude/rules/patrones-de-desarrollo.md
@.claude/rules/compuerta-a-main.md

Lo que separa una rama de `main` —los cuatro niveles, en orden de coste:

```powershell
.\scripts\verificar.ps1        # 1 compila · 2 el contrato · 3 escenarios (-Escenarios) · 4 a mano
```

Y en la nube, en cada PR que toque Windows: [`.github/workflows/windows-contrato.yml`](../../.github/workflows/windows-contrato.yml). Los
escenarios NO corren allí y no es un olvido: abren apps de verdad sobre un escritorio real.

### El portero: lo único que no se puede olvidar

Todo lo de arriba se puede saltar sin querer, porque son **peticiones**. Hasta el 2026-08-21 este
repo tenía seis archivos de reglas y siete skills describiendo el proceso, y en `.git/hooks/` solo
`post-checkout` y `post-commit`: ni una sola comprobación que impidiera nada. La consecuencia,
dicha por el usuario: *«hay demasiada burocracia para pasar a main pero no siento que me esté
verificando lo que necesito»*. Y tenía razón — era papeleo sin portero.

Lo que TIENE que pasar vive ahora en [`.githooks/pre-push`](.githooks/pre-push). **Se activa una
vez por clon, con una línea:**

```powershell
git config core.hooksPath .githooks
```

Tarda ~60-120 s y comprueba cuatro cosas, **sobre el commit que se empuja**: si el árbol tiene
cambios sin commitear que tocan el veredicto, saca el commit a un árbol temporal y lo juzga allí
(tarda más; para el camino rápido, commitea o `git stash -u`). Las cuatro comprobaciones son las
del motor común (`tools/monorepo/portero.sh`):

| | qué exige |
|---|---|
| 0 | **a `main` no se empuja directo** — solo por PR |
| 1 | **compila** en Release |
| 2 | **los contratos** del grafo y de la voz están INTACTOS |
| 3 | **la rama trae su propia promesa** — si cambia código y no toca ningún `Contrato.cs`, no pasa |

La nº 3 es la que hace crecer la carpeta de tests **sola**, en vez de por disciplina. Se exime a
`chore/`, `docs/`, `refactor/` y `hotfix/`, que por definición no añaden comportamiento: si tu rama
de verdad no cambia lo que el sistema promete, renómbrala y pasa.

Los escenarios (nivel 3 de la compuerta) **no** están en el portero a propósito: hay uno solo para
toda la app y el 2026-08-21 se quedó trece minutos colgado. Un paso obligatorio que nadie corre no
protege nada y enseña a saltarse el resto. Vuelve cuando sea fiable.

## Ramas y árboles

La regla es de todo el monorepo y vive en
[`.claude/rules/ramas-y-commits.md`](../../.claude/rules/ramas-y-commits.md), que se carga sola:
ramas `<persona>/<que-hace>` que duran de medio día a tres días, una rama por feature, `main` solo
por PR con squash merge, y **un agente, un árbol**: la rama nace con `arbol.sh nuevo` y muere con
`arbol.sh cerrar`. Hasta el 2026-09-30 esta sección decía «`git checkout -b`»; con varias sesiones
abiertas en la misma carpeta, esa orden le cambiaba la rama a las demás.

Lo que es de Windows es el reparto. Una rama por persona evita pisarse la rama, no el archivo; lo
que evita el conflicto es repartir por superficie:

| Zona | Riesgo de choque |
|---|---|
| `windows-graph/` | bajo — es específico de SAP |
| `windows-client/` UI (carita, paneles, inspector) | **alto** — es lo que todos tocan |
| `windows-client/` servicios (voz, logging, release) | bajo |

Regla: **que dos personas no tengan features abiertas en la UI a la vez.** Si es inevitable, que sean
pantallas distintas y que ninguna rama pase de un día.

## Compilar y correr

```powershell
cd windows-client
dotnet build -c Release
```

Ejecutar `bin\x64\Release\net8.0-windows10.0.19041.0\U.exe` — la carpeta lleva la versión del SDK
desde el 2026-08-13, cuando el TFM subió para poder hablar por BLE con el collar Omi (spec 001).
**No usar `dotnet run`** para sesiones largas: el
wrapper sale con 255 cuando se cierra la ventana y confunde el diagnóstico.

Si el build falla con `MSB3027 / U.exe está bloqueado`, hay una instancia corriendo. **Ciérrala por
RUTA, nunca por nombre**: todas las instancias se llaman `U`, y entre ellas está la app INSTALADA
(`%LOCALAPPDATA%\U\app`) que el usuario tiene abierta trabajando.

```powershell
# Solo la que bloquea TU build. Cambia la ruta por la tuya si compilas a otro sitio.
Get-Process U | Where-Object { $_.Path -like "*\windows-client\bin\*" } | Stop-Process
```

`Get-Process -Name U | Stop-Process` —lo que decía aquí hasta el 2026-09-05— se lleva por delante
**todas**, incluida la del usuario. Pasó dos veces en un día, en sesiones distintas, y las dos veces
el agente creyó estar cerrando «una instancia bloqueada» suya. Si de verdad hay que cerrar varias,
mira antes de qué ruta es cada una: `Get-Process U | Select-Object Id, Path`.

## EL LOG ES LA FUENTE DE VERDAD

```
%LOCALAPPDATA%\U\logs\u-AAAAMMDD.log
```

`LogBus` persiste todo a disco además del ring de 500 líneas en memoria. **Leerlo antes de teorizar.**

Esto no es un consejo de estilo: en la sesión del 2026-07-26 se perdieron **cuatro rondas** deduciendo
de capturas de pantalla lo que el archivo decía literalmente. Una captura no distingue "espaciado
correcto con desplazamiento constante" de "filas equivocadas" de "otra caja pintada encima" — el log sí.

Líneas útiles: `shell subType=`, `filas del árbol ·`, `fila seleccionada`, `CONTRASTE geometría`,
`✋ no se llegó a`, `⏱ TIEMPOS`. Y para la voz, `voz-clic:` — una por cada encendido y cada apagado,
con los milisegundos de cada tramo desde el gesto (las horas del log van al segundo, y no bastan).

## Estado actual (2026-08-08)

`main` está en **`61921d4`**. Las ramas viejas de trabajo ya mergeadas se borraron; a partir de aquí
rige la convención `<persona>/<que-hace>` de arriba. Lo que sigue abierto con trabajo propio:
`claude/hola-8284hn` (cola de exportaciones), `fix/priority-graph` (jerarquía de niveles) y
`feature/sap-tree-mapping` (sonda de hit-test).

Lo de abajo se verificó el 2026-07-26 y no ha cambiado desde entonces.

### La cadena completa funciona, verificada contra el SAP real

Un workflow grabado arranca desde SAP Easy Access y llega solo hasta el formulario de paciente:

```
paso 1-2  okcd «nwp1» + Enter        → NWP1                    (cambió)
paso 3    doubleClickItem(Column1)   → …/ssubVIEW_SCREEN…      (cambió)
paso 4    PressToolbarButton(NV44)   → NV2000/…/subPATEINST…   (cambió)
paso 6    input RNPA1-PASSNR                                    ✓
↩ resultado: 5/6 ejecutado(s) · 1 omitido(s)
```

Lo que hay detrás de cada eslabón está en [`windows-graph/CLAUDE.md`](windows-graph/CLAUDE.md).

Herramientas nuevas para diagnosticar, todas en el panel de la carita:

- **🧪 Ensayo en seco** — recorre el plan sin tocar la pantalla. Lo que más pesa: marca **cada cambio de
  pantalla** y, si el paso anterior es un `input` (que no navega), lo declara bloqueante — falta el paso
  que navega. Detecta en dos segundos el fallo que costó un día.
- **👣 Paso a paso** — se detiene ANTES de cada paso, con el veredicto y **la captura de cuando lo
  enseñaste** al lado. Esas capturas llevaban meses guardándose sin que las usara nadie.
- **Huella estructural** por paso: hash de los ids de los elementos interactivos + el tamaño de cada
  shell. Detecta que sigues en la misma transacción pero la pantalla no está en el mismo estado. Hoy
  **avisa, no detiene** — hasta que tenga kilómetros encima.

### Pendientes reales

1. **La carrera del `Busy`.** `session.Busy` solo es `true` *durante* el round-trip. Justo después de
   nuestro clic SAP aún no empezó, así que `Busy=false` y los elementos de la pantalla vieja resuelven →
   se puede clicar sobre la pantalla anterior. Fix: exigir la condición en **3 sondeos consecutivos**.
2. **El puente consciente improvisa.** Cuando el workflow se detiene, computer-use recibe «retoma y
   termina la tarea» y elige por su cuenta — una vez pulsó «Buscar pacientes» en vez de «Crear Triage
   Administrativo». Está atado al origen desde hoy, así que no puede teclear fuera de SAP, pero dentro
   inventa. Lo que le falta está escrito abajo, en *El agente que se rescata solo*.
3. **Se queda en bucle** cuando la compuerta lo frena y no consigue traer SAP al frente: 14 turnos
   rebotando y gastando `wait`.
4. `topNode` no resuelve en algunas pantallas. Sin él no hay cajas por fila en el inspector.
5. ~~**Código inerte:** la supresión de sub-elementos dentro de árboles~~ — quitada el 2026-09-30:
   medía `0 sub-elementos` en los 16 repartos de shells SAP que guardaban los logs.
6. La **huella es ciega al contenido** de un shell salvo por su tamaño: dos pantallas con el mismo
   número de filas dan la misma huella.

### El agente que se rescata solo (diseño acordado, sin implementar)

Cuando no encuentra la ruta, hoy improvisa. Le falta, en orden de impacto:

1. **Un objetivo comprobable por máquina.** El workflow ya sabe a dónde tenía que llegar: es el
   `observedSurface` del paso que falló. Decírselo convierte la improvisación en una búsqueda acotada
   con criterio de éxito verificable — y «terminé» deja de ser una opinión del modelo.
2. **El inventario de lo accionable sin coordenadas**: los botones de toolbar con su clave, las filas
   con la suya, los campos con su id. Que diga «pulsa `NV44`» en vez de «clic en (683, 242)».
3. **Validar el aterrizaje con la misma compuerta** que usa el player. Hoy hay dos jueces y uno es un
   modelo optimista.
4. **Que lo aprendido se quede**: insertar el paso descubierto en el workflow, como ya hace
   `PrependAlignmentStepAsync` con la alineación. Eso cierra la premisa del producto — el hueco de
   `NV44` lo tapó un humano leyendo COM; con esto lo tapa el sistema la primera vez.

## El puente con el portal clínico (`apps/web/`, antes repo `Pagina-web-clientes-final`)

Mientras el médico dicta, el portal produce **conceptos canónicos** (`vital.talla`, `vital.peso`,
`vital.presion.sistolica`…) y el agente los va escribiendo en los campos de SAP al llegar a la pantalla.

Repartición, decidida a propósito: **el portal no sabe de SAP y el agente no sabe de medicina.** Los
conceptos son estables; las pantallas cambian. El acoplamiento vive en el cliente, que es quien ve la
pantalla y aprende el mapeo concepto↔selector una vez por pantalla.

- El portal expone `GET /api/agent/values?code=XXXXXXXX` → `{ rev, values, evidence }`, con ETag para
  que el sondeo cada 1,5 s sea barato, y `409 + stop:true` cuando la consulta se firma.
- **Emparejamiento por código**, no por credencial: el agente no puede llevar el JWT del médico. El
  código dura 8 h o hasta que se firme la consulta, lo primero que pase.
- Lado Windows: **sin implementar todavía**. Falta pegar el código, sondear, y colocar sin sobrescribir
  lo que ya tenga valor.

## Aprendizajes de método

Estos costaron caro. Aplicarlos ahorra rondas enteras.

1. **Leer el log antes de teorizar.** Ver arriba.

2. **Un mensaje de error no debe concluir, debe describir el paso que falló.** El texto
   *"getters de selección sin resultado"* se imprimía también cuando el árbol **nunca se había
   resuelto** — una conclusión disfrazada de hecho. Mandó la investigación al lugar equivocado dos
   veces. Si un mensaje afirma una causa, tiene que poder distinguirla de las demás.

3. **Un `try/catch` mudo convierte un bug de aridad en "la API no existe".** La creencia documentada de
   que SAP no da geometría por nodo venía de llamar los getters con un argumento de menos. Al capturar
   en silencio, "falló por firma" y "no existe" son indistinguibles.

4. **Una caja que miente es peor que no tener caja.** Invita a confiar en ella. Aplicado dos veces: no
   dibujar filas sin `topNode`, y distinguir geometría *leída* de *estimada*.

5. **Contención no es alineación.** Se quitó una corrección vertical argumentando que el contraste
   `CUADRA` probaba que la banda cruda era correcta. `CUADRA` solo verifica que el clic caiga *dentro*;
   una banda desplazada la pasa igual. El síntoma volvió.

6. **Cuando una limitación documentada resulta falsa, borrar la maquinaria de compensación — no
   parchearla.** Había tres capas (`topNode` + recorrido con plegado + alto calibrado) para reconstruir
   lo visible. Al probarse que SAP sí da geometría por nodo, había que eliminarlas; en su lugar se
   siguieron ajustando, y cada capa aportaba su propio modo de fallo. La versión final es una regla:
   *si el top que da SAP cae dentro del alto del árbol, la fila se ve.*

7. **Arreglar la clase de error, no el caso.** El veredicto rojo falso se arregló para árboles y media
   hora después reapareció idéntico en el grid: **ningún** shell se acciona por etiqueta. Si un arreglo
   se apoya en "este tipo de elemento no usa ese criterio", revisar todos los que tampoco lo usan.

8. **No optimizar la cadencia antes del costo por iteración.** Bajar el refresco a 200 ms antes de
   arreglar las ~2.600 llamadas COM/s amplificó un bug latente y disparó una cacería de una hora.

9. **Antes de mergear, contar en cuántas pantallas se probó.** Una sola pantalla verificada es una
   apuesta a que las demás se comportan igual — y el run de NWP1 demostró que no.

10. **Lo peor no es que falle: es que parezca que funcionó.** El salto-adelante se comió 19 pasos y
    reportó «29 de 30»; otra corrida devolvió `ok=True pasos=2/2` de un plan de 4. Los dos venían del
    mismo vicio: el denominador se calculaba sobre los pasos *con veredicto*, y los saltados no dejaban
    veredicto, así que el total encogía con ellos. **Un paso no ejecutado tiene que dejar rastro**
    (`Omitted`), o el recuento describe con exactitud una corrida que no hizo el trabajo.

11. **Antes de arreglar la clase de error, cuenta cuántos sitios la tienen.** Cableé el diagnóstico de
    la superficie SAP en dos de los **tres** sitios que la construyen. El que faltaba era justo el que
    usa el operador, así que el fallo siguió mudo una corrida más — mientras yo citaba el aprendizaje
    nº7 en el commit.

12. **Un mensaje que no distingue sus causas manda la investigación al lugar equivocado — otra vez.**
    «sin clic reciente que SAP reconozca» cubría tres situaciones: no hay clic anotado, el clic es
    viejo, o el hit-test no encuentra nada. Es el aprendizaje nº2, incumplido al escribirlo.

13. **Pregúntale a la API antes de creerle al código.** Una sonda de solo lectura con enlace tardío
    puro contestó en veinte minutos tres preguntas que llevaban semanas resueltas «por deducción»: que
    el enganche COM sí calza (con sus DISPIDs), que **no existe getter de foco**, y que los botones de
    una barra de ALV son items con clave. Es barato y sustituye rondas enteras de teoría.

14. **Un dato que viene de la red puede llegar vacío en vez de ausente.** `??` no cae al respaldo con
    cadena vacía. Ese detalle convirtió cada clic de árbol en un `SetFocus()` que reportaba éxito.

15. **Antes de escribir en un repo que no conoces, lee sus reglas.** El portal clínico avisa en su
    `AGENTS.md` de que su Next.js no es el que uno cree, y no usa service-role en ninguna parte: eso es
    una postura de seguridad, no un olvido. Ir con `security definer`, que es lo que ya usan, en vez de
    meter una llave nueva.

16. **Una comparación entre identidades de distinta forma da falso SIEMPRE, y en silencio.** El
    2026-08-08 aparecieron **cuatro** en un solo día, todas con meses de antigüedad y ninguna rompiendo
    nada visible:

    | Dónde | Comparaba | Consecuencia |
    |---|---|---|
    | `AnotarPuertas` | `"mail.google.com"` vs `"chrome."` | ninguna puerta web entró jamás al mapa |
    | `OlvidarAccion` | clave de 2 partes vs diccionario de 3 | el grafo no podía autocorregirse |
    | `GraphCrawler` | `"explorer"` vs `"explorer.exe"` | el recorrido mecánico nunca cruzó una puerta |
    | `guardia-nucleo` | `windows-app` vs `U-Windows-App` | el candado no protegía nada |

    Ninguna daba error. Las cuatro hacían que el sistema **aprendiera menos de lo que creía** — y eso
    se parece demasiado a «se usa poco». La señal de alarma es cuando los dos lados de una comparación
    salen de funciones distintas: `AppDe` conserva el `.exe`, `ProcessFromOrigin` lo quita, y quien las
    junta hereda el desacuerdo. **Normalizar en un solo sitio, o comparar por el mismo camino.**

17. **Un juez que no puede correr no dice «no sé», dice «culpable».** El contrato del grafo reportaba
    *«CONTRATO ROTO: 10 promesas incumplidas»* sin haber probado nada: no conseguía cargar sus propios
    ensamblados. Lo mismo el crawler, que imprimía `0 salida(s)` cuando ni había llegado a mirar la
    pantalla. Un arnés tiene que distinguir **«falló la promesa»** de **«no pude ejecutarla»**, o su
    veredicto manda la investigación al sitio equivocado — y el fallo estaba en el arnés que existe
    justo para eso.

18. **Un guardia que se cree puesto es peor que ninguno.** El candado del núcleo llevaba cinco horas
    protegiendo nada porque su lista de rutas se anclaba al nombre de la carpeta del repo. Se descubrió
    al editar `SurfaceMap.cs` y **no ver el diálogo**. Cualquier comprobación anclada a algo accidental
    —el nombre de una carpeta, una ruta de máquina— degrada en silencio a «siempre no», y mientras
    tanto todo el mundo trabaja creyendo que hay una red debajo.

19. **Seleccionar no es abrir, y devolver `true` no es haber hecho el trabajo.** `RealClick` prefería
    `SelectionItemPattern.Select()` para todo lo seleccionable —correcto para los menús WinUI, que
    ignoran el ratón sintético— y en el explorador eso marcaba la entrada del panel lateral **sin
    navegar**, reportando éxito. Una ruta de tres tramos moría en el primero. El orden correcto es
    actuar primero y **verificar después**: el clic real, y solo si no agarró, el patrón.

## graphify

El mapa del código de este proyecto vive en `graphify-out/`. **No se versiona** (hasta el 2026-08-21
sí, y cada commit que tocaba código arrastraba un diff de 138.000 líneas en `graph.json`: ningún PR
se podía revisar). Se crea con `tools\graphify\instalar.ps1` y desde ahí se rehace solo tras cada
commit, cambio de rama y pull.

Cuándo usarlo está en las reglas comunes (`AGENTS.md` de la raíz, §Herramientas), y salió de medirlo
el 2026-10-01 con agentes sobre este mismo código:

- **A quién afecta tu rama:** `bash tools/graphify/impacto.sh` (desde cualquier carpeta del repo).
  Es lo que alimenta el punto 4 del PR —cuántos sitios tocan lo que cambiaste— sin contarlos a mano.
- **Quién depende de una pieza:** `graphify affected "RellenadorSap"`, desde `apps/windows`.
- **Pregunta amplia:** `graphify query "…"` una vez, y después se lee el código.
- **Con un nombre exacto, Grep directo.** La regla anterior —«primero `graphify query` para cualquier
  pregunta»— se retiró: sumaba llamadas y no ahorraba ninguna (27.500 tokens con ella frente a
  22.300 sin ella en la misma tarea).
