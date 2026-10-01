# Ü para Windows — guía para trabajar en `apps/windows`

El cliente de Ü para Windows, en C# y WPF (.NET 8): aprende a operar aplicaciones de escritorio
mirando a una persona y después las opera solo. El caso real es SAP GUI en un hospital. Las reglas
comunes del monorepo (ramas, commits, qué toca cada máquina) están en el
[`AGENTS.md`](../../AGENTS.md) de la raíz.

**La guía larga es [`CLAUDE.md`](CLAUDE.md)**: qué es el producto, las dos superficies (UIA y SAP GUI
Scripting), el estado actual y diecinueve aprendizajes con fecha. Léela antes de tocar código. Esto
es el resumen operativo, para quien no la recibe sola.

Todos los comandos de aquí se corren **desde esta carpeta** (`cd apps/windows`), en PowerShell.

## El ciclo

Es el del monorepo ([`docs/monorepo/metodo.md`](../../docs/monorepo/metodo.md)), que nació aquí:

```
1.  bash ../../tools/monorepo/arbol.sh nuevo <persona>/<que-hace>   rama y árbol propios
2.  la spec:      docs/specs/NNN-<slug>.md (plantilla: docs/specs/PLANTILLA.md)
3.  la promesa:   en tests/ContratoDelGrafo/Contrato.cs, y verla ROJA
4.  el código, hasta que salga verde
5.  ROMPE el código a propósito: si la promesa no se pone roja, no vale nada
6.  pruébalo sobre el PC real, en al menos dos pantallas, y lee el log
7.  git push: el portero decide (~60-120 s)
8.  PR con la evidencia → squash merge
9.  bash ../../tools/monorepo/arbol.sh cerrar
```

| Qué | Dónde |
|---|---|
| Specs | `docs/specs/NNN-*.md`. Las promesas se numeran en continuación de las que hay; los números no se reciclan |
| Promesas | `tests/ContratoDelGrafo/Contrato.cs` (el núcleo) y `voz/Contrato/Contrato.cs` (la voz) |
| El juez | `.\scripts\contrato-del-grafo.ps1` y `.\scripts\contrato-de-la-voz.ps1` |
| Los cuatro niveles, con su tabla de evidencia | `.\scripts\verificar.ps1` → `out\evidencia.md` |
| El portero | `.githooks/pre-push`: compila en Release, los dos contratos intactos, y la rama trae su promesa |
| El CI | [`windows-contrato.yml`](../../.github/workflows/windows-contrato.yml) |
| Las reglas, con su porqué | `.claude/rules/`: el flujo, los patrones de desarrollo, la compuerta a `main`, la voz única |

## Compilar y correr

```powershell
dotnet build windows-client\WindowsClient.csproj -c Release
windows-client\bin\x64\Release\net8.0-windows10.0.19041.0\U.exe
```

## Lo que hay que saber antes de tocar

- **El log es la fuente de verdad**: `%LOCALAPPDATA%\U\logs\u-AAAAMMDD.log`. Se lee antes de
  proponer una causa.
- **Dentro de SAP GUI, UIA no ve nada.** Para SAP es Scripting API, con enlace tardío.
- **No cierres `U.exe` por nombre.** Todas las instancias se llaman `U`, y una es la que el usuario
  tiene abierta trabajando. Se cierra por ruta:
  `Get-Process U | Where-Object { $_.Path -like "*\windows-client\bin\*" } | Stop-Process`.
- **La UI de `windows-client` es la zona de choque**: que dos personas no tengan features abiertas
  ahí a la vez.
- **Se juzga el binario que se distribuye: Release, no Debug.**
- **Releases de GitHub: solo las de Windows**, y las dispara Graph (`windows-release.yml`, cuyo
  nombre no se cambia).
