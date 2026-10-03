# Plan de implementación: la Ü se vuelve la carita

Estado: **propuesto** · Lo pidió el dueño el 2026-10-03, con la carita de la spec 085 recién en `main` · Rama: `jose/la-u-se-vuelve-carita` · Promesas **880-883** (reservadas 880-889)

> Felipe, el 2026-10-03, con la ventana de la consulta y la carita ampliada delante: «Quiero agregar una
> animación de introducción, donde está una ventana negra, con el mismo tamaño que la ventana de la
> captura, pero totalmente negra, donde habrá una letra Ü gigante blanca. Al darle play —un botón oculto
> o mejor aún un atajo, como pulsar la U durante 3 s— se transformará en nuestra carita original: los
> puntos de la diéresis pasan a ser las cejas, los laterales de la U los ojos y la parte de abajo la boca,
> terminando en nuestro diseño exacto de la boca. Luego mira hacia un lado, al centro de nuevo, y hace la
> transición de gestos de “Ü te pregunta” – “cuelgas”.»

## Qué se construye

Una pieza de presentación: `U.exe --intro` abre SOLO una ventana negra del tamaño y la forma de la ventana
de la consulta, con una Ü blanca gigante en el centro. Mantener la tecla U tres segundos la pone en
marcha: la Ü se deshace en los rasgos de la carita, le crece el cuerpo por detrás, mira a un lado, vuelve,
pone la cara de cuando Ü te pregunta y se despide con la mano como al colgar.

**La transformación vive dentro de la carita, no al lado.** `FaceControl` gana una propiedad, `LaU`, de 1
(la letra) a 0 (la cara). Con `LaU = 0` pinta por el camino de siempre, línea por línea; en medio pinta los
mismos tres rasgos interpolados entre la Ü y la pose de la cara. Así el final no puede ser una copia que
se le parezca: es la carita, y lo que hace después —mirar, preguntar, despedirse— son sus propios gestos.

## Las piezas de la Ü y a qué rasgo van

| Pieza de la Ü | Rasgo | Cómo |
|---|---|---|
| punto izquierdo, punto derecho | cejas | un trazo casi sin largo —un punto— se estira hasta la ceja |
| lado izquierdo, lado derecho | ojos | dos rectas verticales que se acortan y bajan hasta la línea del ojo |
| el fondo de la U | la boca | la curva honda se aplana hasta la sonrisa de la pose |
| — | el cuerpo | crece desde el centro cuando los rasgos ya casi llegaron; donde los cubre, el trazo pasa de blanco a tinta |

El grosor va de el de la letra al de la carita, y el lienzo gira los −2° de la carita al llegar.

## Las promesas

| # | Promesa |
|---|---|
| 880 | la Ü se vuelve la carita: con la intro entera la carita pinta una Ü blanca —dos puntos y una U— sin cuerpo; al deshacerse los puntos van a las cejas, los lados de la U a los ojos y su fondo a la boca, y el cuerpo crece desde el centro; y al terminar pinta exactamente la carita de siempre |
| 881 | la intro solo arranca si mantienes la U tres segundos: soltarla antes no hace nada, y mantenerla otra vez la repite desde la Ü |
| 882 | la intro cuenta su historia en orden: se transforma, mira a un lado, vuelve al centro, pone la cara de cuando Ü te pregunta y se despide con la mano como al colgar |
| 883 | la ventana de la intro es negra, del tamaño y la forma de la ventana de la consulta, y abrirla con --intro no arranca nada más: ni la carita de siempre, ni la actualización, ni el candado de instancia |

## Las fases

| Fase | Promesa | Toca | Termina cuando |
|---|---|---|---|
| 0 — rojo | 880-883 | `Contrato.cs` | las cuatro rojas por lo que dicen |
| 1 — la letra | 880 | `Ui/LaUDeLaCarita.cs` (nueva, pura), `FaceControl.LaU` | 880 verde |
| 2 — el guion | 881, 882 | `Ui/GuionDeLaIntro.cs` (nueva, pura) | 881 y 882 verdes en lo puro |
| 3 — la ventana | 881-883 | `Ui/IntroWindow.cs` (nueva), `App.Main` | las cuatro verdes |

## Lo que NO entra

- Sonido. La intro es muda.
- Abrirla desde la carita o desde un menú: es una pieza para presentar, y un botón visible la pondría delante
  de quien no la busca.
- Grabarla en vídeo: se graba con la ventana delante, como cualquier otra.

## Hallazgos

## Cierre

- [ ] Promesas 880-883 verdes (`.\scripts\contrato-del-grafo.ps1`)
- [ ] `.\scripts\verificar.ps1` pasa
- [ ] Nivel 4: `U.exe --intro` sobre el PC real, con la U mantenida de verdad
