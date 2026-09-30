# Promesas que no juzgan lo que corre

> Auditoría del 2026-09-30, sobre `main` en `e977e395`. Es el aprendizaje nº18 medido: «un guardia que
> se cree puesto es peor que ninguno». Una promesa en verde sobre una función que la app no llama
> certifica una copia. El código que corre puede cambiar y la promesa seguirá diciendo que todo está
> bien.

## Cómo se encontró

1. Roslyn listó los miembros de U.exe **sin una sola referencia en código de producción**, contando
   los cuatro contratos como uso.
2. Los contratos llaman al núcleo por reflexión, con los nombres en cadenas (`GetMethod("SeAbre")`), y
   Roslyn no ve esas llamadas. Así salieron 20 miembros sin llamador que un contrato parecía pedir
   por nombre.
3. Cada uno se revisó a mano: qué promesa lo juzga, qué hace producción en su lugar y qué commit le
   quitó el último llamador.

**6 de los 20 eran un falso positivo del método**: la cadena era de otro método con el mismo nombre.
Ningún contrato los juzga, así que eran código muerto sin más.

## Lo que se hizo

| Miembro | Qué se hizo | Por qué |
|---|---|---|
| `ReglaDelGlobo.SeAbre` | **Cableado**: `FaceWindow.MostrarConversacion` lo llama | Desde el #113 (2026-09-22) su condición estaba copiada en línea, idéntica. Ahora la promesa 155 juzga lo que corre. |
| `RastroDelCursor.Olvidar` | Quitado | Sin llamador desde que nació (2026-08-05) y sin promesa. El rastro se filtra por tiempo con `Ultimas`. |
| `PanelDeAcciones.Mensaje` | Quitado | Nació sin llamador en el #113. Producción usa `Habla`, que además pinta el notch. |
| `GraphConfig.Save` | Quitado | Sin llamador desde el 2026-07-26. Si alguien lo llamara tras `Load`, escribiría en disco la clave del entorno, justo lo que el comentario de `GraphConfig` promete no hacer. |

Tres de los falsos positivos se **quedan** porque los usa una rama viva o porque la decisión no es de
limpieza:

- `PuertasPeligrosas.PorQue` y `EspejoDelLog.Apagar`: las ramas de jero los llaman.
- `RellenadorSap.Deshacer`: su comentario lo presenta como «la salida de emergencia» que hace aceptable
  escribir en SAP sin pedir permiso, y nadie lo llama. Retirarlo o cablearlo es una decisión de
  seguridad clínica.

## Lo que queda por decidir (toca promesas: es de los dueños)

Cambiar el enunciado de una promesa o retirarla cambia lo que el sistema promete. Por eso se decide
aquí y no en una limpieza. Los números retirados no se reciclan.

### Divergió: la promesa dice una cosa y la app hace otra

| Promesa | Lo que promete | Lo que hace la app | Desde |
|---|---|---|---|
| 155, mitad `DespliegaElMuelle` | Un fallo no abre el globo pero **sí despliega el muelle**: «un fallo que nadie ve es indistinguible de una app que no hace nada» | Los cuatro `MostrarConversacion(AlgoFallo)` (actualizador y comprobar) no despliegan nada | #113, 2026-09-22 |
| 235, `ComoSeEscribe.Decidir` | Sin campo destino y sin terminal → `SinCampo` (no se teclea a ciegas); en una terminal gana el patrón | `SurfaceMapTools.Type` reimplementa la regla en línea. Sin destino, busca el único campo de la ventana o el que tiene el foco, y escribe; en una terminal, teclea sin buscar | nació así en el #65 |

Hay que elegir cuál es la verdad. Si gana la promesa, se cablea y cambia el comportamiento. Si gana la
app, se reescribe la promesa.

### Juzga una función que ya no aplica

| Promesa | Qué juzga | Por qué ya no aplica |
|---|---|---|
| 26 (contrato de voz) | `Omi.Emparejamiento.Motivo`: rechazar un código que no cuadra | Quien rechaza es la función de Supabase `omi-directo`, cuya fuente no está en el monorepo |
| 28 (contrato de voz) | `Omi.Selector.LatenciaNominalMs` | Una declaración que nadie lee |
| 177 | `Teach.CuadroDelMomento.Elegir`: el cuadro más cercano a un momento | Lo que corre es `cuadroMasCercano` en `agente-piloto/piloto.mjs`, gemelo en JS. La promesa debería juzgar ese |
| 242, mitad visual | `PaletaDelNotch.DelPunto/EsAro/Late`: el fallo es un aro, lo omitido baja de luz, lo que está en curso late | El #73 (2026-09-16) lo sustituyó por `IconosDelNotch` (promesa 253): lo en curso gira, fallo y omitido son aros con signo, y nada baja de luz |

### Costuras legítimas (bien como están)

`AlmacenCardio.Guardar` (354), `SurfaceMapTools.EsperarTramo` (291-295), `MedidaDelNotch.AltoDe` (249),
`UiaReader.Recoge` y `RecogeConHijas` (297-298), `TopeDeIntentos.Despues` de 7 parámetros (204) y
`ComoSePulsa.Decidir` de 4 (234, 237-238). Cada una delega en la función que sí corre, o la parte en
dos hilos como hace producción.

Una nota sobre la 249: desde el #113, con el chat abierto el notch crece a 420×360, y la promesa no
contempla ese estado.

## Cómo no volver a llegar aquí

Si un arreglo copia en línea la lógica de una función que ya tiene promesa, está desconectando la
promesa. Se nota en el diff: desaparece el último llamador de un método que el contrato pide por
nombre. Comprobarlo cuesta un `git grep` del método antes de mergear.
