<!--
El PR es donde queda escrito qué entró y por qué. Va aunque lo mergees tú mismo cinco minutos
después. Rellena lo que aplique a los proyectos que toca y borra lo demás: cada casilla existe
porque su ausencia costó un diagnóstico.
-->

## Qué cambia

<!-- En la voz de los commits: lo que el sistema ahora hace. Si toca varios proyectos, una línea por
     proyecto: una feature que cruza el portal y Windows va en UN PR. -->

**Proyectos:** <!-- apps/windows · apps/mac · apps/android · apps/web · services/graph · la raíz -->

## Qué promete ahora el sistema que antes no

<!-- Las promesas del contrato del proyecto, con su número y su enunciado:
     Windows: apps/windows/tests/ContratoDelGrafo/Contrato.cs (spec en apps/windows/docs/specs/)
     Android: apps/android/core/src/commonTest/.../contrato (spec en apps/android/docs/specs/)
     Mac: apps/mac/Tests/UCoreTests (spec en apps/mac/docs/specs/)
     Graph: services/graph/scripts/verify-*.js (spec en services/graph/docs/specs/)
     Si no toca ninguna promesa, dilo y explica por qué no hacía falta. -->

## Evidencia

<!-- Pegada, no resumida. Un nivel que no se corrió va como NO CORRIDO con su motivo, nunca como OK.
     Windows: la tabla de apps/windows/scripts/verificar.ps1 (out\evidencia.md).
     Los demás: el veredicto de su juez (la última línea), la compuerta y lo que se probó a mano.
     Cada promesa nueva: se vio en rojo antes de su código, y otra vez al romperlo a propósito. -->

| Nivel | Resultado | Detalle |
|---|---|---|
| | | |

**En cuántas pantallas o dispositivos se probó, con nombre:**
<!-- «explorer.exe (16 pantallas) y Configuración (11)». Uno solo es una apuesta a que los demás se
     comportan igual, y el run de NWP1 demostró que no. Si fue uno, dilo así. -->

**La clase de error vivía en N sitios; N corregidos:**
<!-- El número sale de un grep, no de la memoria. -->

## Qué se dejó fuera, y por qué

## Riesgo

- [ ] Toca **la raíz** (`AGENTS.md`, `.github/`, `.githooks/`, `tools/`): afecta a todos los proyectos
- [ ] Cambia una **API entre proyectos** (Graph ↔ clientes, portal ↔ Windows): los dos lados van en esta rama
- [ ] Toca el **núcleo congelado** de Windows (`SurfaceMap.cs`…), autorizado por el dueño
- [ ] Toca la **UI de `apps/windows/windows-client`** — zona de choque alto: ¿hay otra rama abierta ahí?
- [ ] Cambia el **enunciado** de una promesa ya existente (eso cambia lo que el sistema promete a todo
      lo que se construye encima: se habla antes de mergear)
- [ ] Cambia el comportamiento en **SAP** y se probó contra el SAP real
