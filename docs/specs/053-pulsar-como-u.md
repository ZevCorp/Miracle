# Pulsar como Ü desde cero

Estado: **fase 1 en curso** (2026-09-27) · Paso 1 de la integración de `u/` en `main`
(plan: https://claude.ai/artifact/N3c1p4GGeNJV9nCcnETN5N) · Rama: `jose/u-pulsar-en-main`, que sale de
`jose/u-entra-a-main` (main `334f144` + `u/`).

## Qué se quiere

Que U.exe pulse tan rápido como `u/`: en `u/` una vuelta con clic cuesta ~300 ms; en `main`, pulsar cuesta 3-4 s.
Sin perder nada de lo que cuelga del clic: el grafo aprende la arista, la carita viaja al clic, el inspector ve,
el freno para, la mano dice por qué no pudo, y SAP sigue por su camino.

**Regla de la integración (del dueño):** cada pieza entra sola, se mide a fondo, y si sube la latencia se rediseña.
Por eso dos fases, una por pieza, y la segunda no empieza hasta que la primera esté medida y estable.

## La línea base (medida el 2026-09-27, U.exe de `main` 334f144, por el MCP 8790)

| Clic | la mano | esperar el cambio | total |
|---|---|---|---|
| Configuración → «Sistema» | 263 ms | **1.864 ms** («no cambió»: sí cambió) | 3.263 ms |
| Configuración → «Pantalla» | 875 ms | **1.824 ms** («no cambió») | 4.016 ms |
| Google Docs → «Blank document» (voz, 2026-09-26) | 1.312 ms | 918 ms | 3.048 ms |
| Bloc de notas → «Agregar nueva pestaña» (voz, 2026-09-26) | 760 ms | 531 ms | 3.419 ms |

La espera sondea «dónde» cada 120 ms hasta 1.800 ms, y en Configuración pasar de una sección a otra no cambia la
ubicación: se come el techo entero y concluye «no cambió» sobre una página que sí cambió. La mano es la escalera
patrón → mensaje → físico, con ~560 ms de esperas fijas en el caso físico típico.

## Fase 1 — la espera (esta rama)

`PulsarSegunElNucleo` recibe, si se le da, un lector de **lo que se ve** en la ventana de trabajo: la huella de
`u/` (accionables, textos y foco, leída con una sola petición a UIA, 20-100 ms). Con él:

| # | Promesa |
|---|---|
| 475 | tras pulsar, la espera sale en cuanto lo que se ve en la ventana de trabajo cambia y se asienta —dos lecturas iguales a 60 ms, o 300 ms más—, aunque la ubicación sea la misma; sin cambio no pasa de 150 ms tras un botón ni de 1,5 s tras un enlace; lo que cambió se cuenta como cambio de pantalla, sin ensayar el doble ni repetir el clic, y si la ubicación llega mientras se asienta, se aprende la arista |
| 476 | un pulso de SAP, o uno sin lector de lo que se ve, espera como siempre: la ubicación, hasta el techo de siempre (en SAP, UIA no ve nada y cortar la espera haría repetir el clic mientras SAP procesa) |

Lo que no cambia: el grafo aprende solo cuando cambia la **ubicación** (`Cruzar`, promesa 21/46); la mano; SAP.

**Presupuesto (regla 1 del plan):** la espera tras un botón ≤ 150 ms; tras un enlace, lo que tarde la página, con
techo 1,5 s. Se mide contra la tabla de arriba con la misma sonda (`medir-pulsar-main2.ps1`).

### Resultado de la fase 1 (medido el 2026-09-27, 2 vueltas × Configuración y Explorador, 10 pulsos)

| | línea base | fase 1 |
|---|---|---|
| esperar el cambio | 1.824-1.864 ms | **mediana 211 ms** |
| pulsar entero (ida y vuelta por el MCP) | 3.263-4.016 ms | **mediana 930 ms** |
| aristas aprendidas al cambiar de carpeta | — | **8 de 8** |

Hallazgo al medir: saliendo al PRIMER cambio (mediana 127 ms), 5 de 8 cambios de carpeta del Explorador quedaban
«sigues en Imágenes» —la lista cambia antes que el título, que es la ubicación— y el grafo no aprendía esas aristas.
De ahí el asentado (dos lecturas iguales a 60 ms): cuesta ~85 ms de mediana y devuelve el aprendizaje entero.
Y un fallo del arnés: al referenciar U.exe el núcleo de `u/`, la promesa 162 caía por `FileNotFoundException:
U.Ciclo`; el contrato ahora referencia sus DLL. Sabotajes: 3, los 3 rojos.

## Fase 2 — la mano (después, por separado)

El clic con el ratón real de `u/` (SetCursorPos + SendInput al centro del elemento ya resuelto), sin escalera.
**Pide decisión del dueño:** las promesas 234, 237 y 265 consagran la escalera «patrón primero», y 19/aprendizaje
nº19 explica por qué existe (los menús WinUI y el explorador). Cambiar la mano es cambiar lo que prometen. Lo que la
fase 2 tiene que conservar, con su sitio (inventario del 2026-09-27): el evento `UiaSurface.Pulso` que mueve la
carita (sale de `Actuar`, UiaSurface.cs:1163), el freno (`Execute`, :992), el motivo (promesa 231), el log «mano»,
el doble clic aprendido (82-83) y la guarda de SAP (FaceWindow:780, en pareja con `EsContenido`).

## Lo que queda fuera

- `PasoDelNucleo` y `ServidorDelNucleo` (8792) usan `_mapaVivo.Pulsar` y no pasan por `PulsarSegunElNucleo`.
- El `MemoriaCorta(400)` de `DondeTrabajo`: la fase 1 no depende de él para detectar el cambio.
