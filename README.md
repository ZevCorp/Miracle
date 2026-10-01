# Ü — el monorepo

Todo Miracle en un repo: los clientes de Ü para Windows, Mac y Android, el cerebro (Graph) y el
portal clínico (Miracle Notes). Una feature que cruza el portal y Windows es **una rama y un PR**.

| Carpeta | Qué es | Venía de |
|---|---|---|
| [`apps/windows/`](apps/windows) | Ü para Windows (C# · .NET 8), con SAP GUI | este repo |
| [`apps/mac/`](apps/mac) | Ü para Mac (Swift) | este repo |
| [`apps/android/`](apps/android) | Ü para Android (Kotlin) | [`ZevCorp/Android`](https://github.com/ZevCorp/Android) |
| [`apps/web/`](apps/web) | Miracle Notes, el portal clínico (Next.js) | [`joseph1356k/Pagina-web-clientes-final`](https://github.com/joseph1356k/Pagina-web-clientes-final) |
| [`services/graph/`](services/graph) | Graph, el cerebro: API, LLM, memoria, Provider Studio | [`joseph1356k/Graph`](https://github.com/joseph1356k/Graph) |

Cada proyecto entró con su historia entera (`git log` y `git blame` funcionan como en su repo de
origen), y guarda su README, sus reglas y su manera de construirse.

## Empezar

```bash
git config core.hooksPath .githooks                    # una vez por clon: activa el portero
bash tools/monorepo/arbol.sh nuevo <tu-nombre>/<que-hace>   # tu rama, en su propio árbol de trabajo
cd <ese árbol>/apps/<proyecto>                         # y trabaja desde ahí: ahí están sus reglas
```

- Las reglas comunes, para personas y agentes: [`AGENTS.md`](AGENTS.md).
- Cómo se trabaja en todos los proyectos, la promesa antes que el código:
  [`docs/monorepo/metodo.md`](docs/monorepo/metodo.md).
- Por qué el repo está organizado así: [`docs/monorepo/arquitectura.md`](docs/monorepo/arquitectura.md).
- Lo que viene después (contratos compartidos, despliegues):
  [`docs/monorepo/fase-2.md`](docs/monorepo/fase-2.md).

## Si tu rama nació antes del 2026-09-28

Ese día cada proyecto pasó a su carpeta. Para poner tu rama al día:

```bash
git fetch origin
bash <(git show origin/main:tools/monorepo/ponerse-al-dia.sh)
```

## Historial

Este repo nació en 2026-07 de la separación del monorepo `ZevCorp/Android`, y el 2026-09-28 volvió a
ser monorepo, esta vez con Graph y el portal dentro (#126). La historia previa a la separación está
en `apps/android/`.
