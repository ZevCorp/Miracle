# 003 — La carita se agarra, se arrastra y se lanza, como en Windows

Estado: **en verde** (2026-09-30) · Nace del pedido del dueño del 2026-09-30 · Rama: `samuel/mac-funciona`

La carita del Mac solo se podía mover por el fondo de su ventana. Ahora se agarra, sigue al cursor, y
al soltarla va al borde lateral más cercano; un lanzamiento horizontal la cruza al otro lado, y dos
dedos la empujan. La física vive pura en `UCore.FaceFling`; `UApp/FaceMover` la convierte en ventana.

## Promesas

| # | Promesa | Juez |
|---|---|---|
| 301 | Un toque no es un arrastre: hace falta pasar el umbral para mover la carita | `testTapIsNotDrag` |
| 302 | Soltada, la carita va al borde lateral más cercano y conserva su altura | `testDroppedFaceGoesToNearestSideAndKeepsHeight` |
| 303 | Solo un lanzamiento horizontal cruza la pantalla | `testOnlyAHorizontalThrowCrosses` |
| 304 | La fuerza decide cuánto viaja la altura, y la carita nunca sale de la pantalla | `testForceDecidesHowFarTheHeightTravelsAndNeverLeavesTheScreen` |
| 305 | La duración del vuelo sigue a la distancia, dentro de sus límites | `testFlightDurationFollowsDistanceWithinBounds` |
| 306 | El vuelo empieza donde se soltó, aterriza exacto y hace un arco | `testFlightStartsWhereReleasedLandsExactlyAndArcsUp` |
| 307 | La velocidad al soltar continúa en el vuelo | `testReleaseSpeedCarriesIntoTheFlight` |
| 308 | La velocidad medida sigue a la trayectoria | `testVelocityFollowsTheTrajectory` |
| 309 | El empuje con dos dedos usa solo el final del gesto | `testTwoFingerThrowUsesOnlyTheEndOfTheGesture` |

## Lo que se probó

`--face-drag-test` en la app instalada (2026-09-30): pasa todo salvo `M1_arrastreSigueAlCursor`, que
mide 7–8 px de retraso contra un umbral de 3. Queda abierto.
