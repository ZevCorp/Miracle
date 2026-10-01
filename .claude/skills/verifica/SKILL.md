---
name: verifica
description: Corre la verificación de la rama en el proyecto que toca —compila, contrato, y la prueba de verdad— y produce la tabla de evidencia que exige el PR. Es la etapa 5 del método y el paso obligatorio antes de tocar main. Úsala cuando el usuario diga "verifica", "está listo para main", "corre las pruebas", "pasa la compuerta", o antes de cualquier PR.
---

# Etapa 5 — Verificar

Producir **evidencia**, no una opinión. La salida es una tabla que se pega en el PR.

## El orden importa: lo barato primero

| # | Nivel | Qué es | Bloquea |
|---|---|---|---|
| 1 | compila | lo que se distribuye, en release | siempre |
| 2 | el contrato | el juez del proyecto, con su veredicto en la última línea | siempre |
| 3 | escenarios | si el proyecto los tiene (en Windows, `scripts\ci-terreno.ps1`) | si hay escenarios de lo tocado |
| 4 | la prueba de verdad | a mano, sobre lo real | si se tocó lo que el contrato no ve |

Los comandos de cada proyecto están en su `AGENTS.md` y en la tabla de
[`docs/monorepo/metodo.md`](../../../docs/monorepo/metodo.md). En Windows, `.\scripts\verificar.ps1`
corre los niveles 1 a 3 y deja la tabla en `out\evidencia.md`.

Si la rama toca varios proyectos, se verifica cada uno.

## Nivel 2 — leer el veredicto de verdad

- Solo vale `CONTRATO INTACTO`. Un pendiente que sobrevive es una promesa sin código: la rama no va
  a `main`, va a la fase que falta.
- `NO SE PUDO JUZGAR` no es un rojo de las promesas: el juez no corrió. Arregla el arnés antes de
  sacar conclusiones sobre el código.
- Si el veredicto nombra promesas **sin juzgar en esta máquina**, no cuentan como cumplidas. Dilo
  en la tabla.

## Nivel 4 — la prueba de verdad, contada

| Proyecto | Qué es |
|---|---|
| Windows | `U.exe` sobre **al menos dos pantallas**, con nombre, y el log leído |
| Android | el APK release en el teléfono, en **dos apps distintas** |
| Mac | la app **instalada** (`./instalar.sh`), no el ejecutable suelto |
| Graph | el servidor en marcha (`npm start`) y una llamada real, con su respuesta |

Una sola pantalla, una sola app o una sola llamada es un dato incompleto: se dice como tal.

## La tabla de evidencia

```markdown
| Nivel | Resultado | Detalle |
|---|---|---|
| Compila (release) | ✅ | … |
| Contrato | ✅ | N promesas, 0 pendientes |
| Escenarios | ⚪ no corrido | no hay escenarios de lo tocado |
| A mano | ✅ | explorer.exe (16 pantallas) y Configuración (11) |
| Clase de error | — | vivía en 3 sitios; los 3 corregidos |
```

Un nivel que no se corrió se marca **⚪ no corrido, y por qué**. Nunca ✅.

## Lo que no cuenta como verificado

- Que compile.
- «Terminé» dicho por un modelo.
- Un recuento sobre lo ejecutado en vez de sobre el plan.
- Leer el código y concluir.

## Al terminar

Si todo está verde: `/a-main`. Si no, di **qué nivel falló y con qué salida literal**, sin
interpretarla, y vuelve a `/implementa`.
