# El patrimonio del grafo — dónde vive en su máxima expresión

> Escrito el 2026-09-27, antes de la spec 054 («la velocidad de u/ en U.exe»). Esa spec desconecta del camino del
> clic todo lo que cuesta milisegundos, aunque rompa la arquitectura del grafo. Este archivo existe para que nada de
> lo que se desconecta se pierda: dice **en qué commit** está cada pieza entera y funcionando, y cómo recuperarla.

## El commit de referencia

| | |
|---|---|
| **Commit** | **`334f144`** — `main` real a 2026-09-27 (`feat(nota): … (promesas 420-423) (#124)`) |
| **Estado** | contrato del grafo intacto, 313/313 promesas; voz 46/46 |
| **Worktree ya sacado** | `C:\U-worktrees\main-limpio` (HEAD separado en 334f144, con build Release en `windows-client\bin\x64\Release\net8.0-windows10.0.19041.0\U.exe`) |
| **Medida de su velocidad** | un ciclo ver → clic → volver a ver: 2,4 s de mediana; abrir una app, 12-13 s (sonda del ciclo, 2026-09-27; `docs/specs/053-pulsar-como-u.md`) |

Para ver o recuperar cualquier archivo de aquí:

```powershell
git show 334f144:windows-client/src/Navigation/RecorrerSegunElNucleo.cs     # leerlo
git checkout 334f144 -- windows-client/src/Navigation/RecorrerSegunElNucleo.cs   # traerlo de vuelta a la rama
git log --oneline 334f144 -- nucleo/Grafo/Grafo.cs                          # su historia, con el porqué de cada cambio
```

## Qué hay y dónde (todo en `334f144`)

### 1. El grafo: la memoria de pantallas y puertas

| Pieza | Archivo | Qué hace | Specs / promesas |
|---|---|---|---|
| **El grafo** | `nucleo/Grafo/Grafo.cs` | Ubicaciones, puertas (aristas) y lo vivo. `Observar` (lo que hay en pantalla), `Cruzar` (aprender una arista: desde → selector → hasta, con su gesto), `DesdeAqui`, `Estoy`, rutas. Bronce (lo observado) y Plata (lo derivado). | 1-60, `docs/plan-plata-real.md`, 036 |
| **Persistir** | `nucleo/Grafo/ProyectorNeo4j.cs` | Proyecta el grafo a Neo4j por HTTP y lo `Restaurar` al arrancar. Es donde el grafo sobrevive a reiniciar. | `U_NEO4J_HTTP/USER/PASS` |
| **El visor** | `nucleo/visor/index.html`, `reglas*.json`, `windows-client/src/Navigation/ServidorDelNucleo.cs` (:8792), `TerrenoParaElVisor.cs` | El grafo dibujado en el navegador. | 75 |
| **El contrato** | `tests/ContratoDelGrafo/Contrato.cs`, `nucleo/Contrato/Contrato.cs` | Lo que el grafo promete, ejecutable. | todas |

### 2. Mirar y ubicarse

| Pieza | Archivo | Qué hace |
|---|---|---|
| **El mapa vivo** | `windows-client/src/Navigation/MapaVivo.cs` | El latido (lee la ventana de delante cada 900 ms → `Grafo.Observar` → proyecta) y la ubicación (cada 250-4000 ms, se adapta sola): atribuye el clic HUMANO a una arista, guarda la foto del álbum, proyecta. |
| **Dónde estoy** | `windows-client/src/Uia/SurfaceLocator.cs` | La identidad de una pantalla (proceso + título + sección seleccionada + URL del navegador + transacción de SAP). |
| **Leer la pantalla** | `windows-client/src/Uia/UiaReader.cs` | Lectura UIA con selectores (`Reconocedor.SelectorDe`), una petición con caché (promesa 297). |
| **Aquí** | `windows-client/src/Navigation/AquiSegunElNucleo.cs`, `TerrenoPorDelante.cs` | Situarse: lo que se alcanza ahora vs lo que se recuerda; el terreno por delante. |
| **El clic humano** | `windows-client/src/Navigation/ClickWatcher.cs`, `mapeador/Pulso/AQuienSeLeDioClic.cs` | Hook de ratón: aprender de lo que pulsa la persona. |
| **La ventana de trabajo** | `FaceWindow.xaml.cs` (`_trabajo`, `DondeTrabajo`), spec 020 | Ü trabaja en una ventana distinta del foco de la persona. |

### 3. Pulsar por el núcleo, y los batches

| Pieza | Archivo | Qué hace | Specs |
|---|---|---|---|
| **Recorrer (el batch)** | `windows-client/src/Navigation/RecorrerSegunElNucleo.cs` | Una tanda de pasos: cada uno se espera VIVO (`EsperarloVivo`, la compuerta), se pulsa, se comprueba la llegada, se cuenta N de M, Escape corta. Homónimos numerados (`which`). | 56-59, 203, 204, 009 |
| **Pulsar** | `windows-client/src/Navigation/PulsarSegunElNucleo.cs` | Un clic con su espera, el ensayo del doble clic, la repetición, y **`Grafo.Cruzar`**: la arista aprendida. | 44-46, 82-83, 003 |
| **Ir** | `IrSegunElNucleo.cs`, `PasoDelNucleo.cs` | Ir a un destino por las aristas aprendidas. | 63-66 |
| **El tramo** | `ElTramo.cs` | Hasta 15 pasos, para tras 3 repeticiones sin cambio. | 037 |
| **Abrir** | `AbrirSegunElNucleo.cs`, `windows-client/src/Uia/AppAligner.cs`, `PestanasAbiertas.cs` | Abrir o traer una app/pestaña, por consecuencia. | 36-43, 232, 262 |
| **La mano** | `windows-graph/src/Surfaces/UiaSurface.cs` (`Execute`, la escalera patrón → mensaje → físico), `ComoSePulsa.cs`, `ComoSeEscribe.cs` | Pulsar y escribir por UIA, con freno, motivo, carita (`Pulso`). | 26-27, 231, 234, 237, 240, 265, 410 |
| **SAP** | `windows-graph/src/Surfaces/SapGuiSurface.cs`, `SapSelector.cs`, `SapComEvents.cs`, `LaCajaDeUnaIdentidadDeSap.cs` | Scripting API por enlace tardío: árbol, grid, dynpro, sesión de delante. | 68-72, 77-81, 226, 012 |
| **Las herramientas** | `windows-client/src/Mcp/SurfaceMapTools.cs`, `ComoSeContesta.cs` | `map_take`, `map_type`, `map_open_app`, `map_what_i_see`, `map_decidir`, `map_go_to`…; el inventario pegado a cada acto (263). |
| **Puertas peligrosas** | `PuertasPeligrosas.cs` | Lo que no se pulsa sin preguntar. |

### 4. Decidir

| Pieza | Archivo | Specs |
|---|---|---|
| **El decisor (Jev / Luna)** | `windows-client/src/Decision/ElDecisor.cs`, `ClienteTypeSafe.cs`, `ConfiguracionDelDecisor.cs`, `InterruptorDelDecisor.cs` | 035, promesas 275-288 |
| **El tope de intentos** | `windows-client/src/Voice/TopeDeIntentos.cs` | 204-207 |
| **El bucle del agente** | `windows-client/src/Agent/AgentLoop.cs` | — |

### 5. Memoria y enseñanza

| Pieza | Archivo | Specs |
|---|---|---|
| **Memoria personal y recordatorios** | `windows-client/src/Voice/MemoriaPersonal.cs`, `RecordatoriosEnVivo.cs` | 337 |
| **El álbum de miradas** | `windows-client/src/Navigation/AlbumDeMiradas.cs` | 255, 258 |
| **Lecciones y skills** | `UnaLeccion.cs`, `SkillEnsenada.cs`, `InstanciarSkill.cs`, `LoQueHaceLaSkill.cs`, `RecuerdosDeUnaSkill.cs`, `CapturasDeLaSkill.cs`, `FotosDeLosRecuerdos.cs` | 005, 013-017, 196-201, 225-229 |
| **La voz** | `windows-client/src/Voice/ConversacionEnVivo.cs` (catálogo de herramientas, turnos, delegación) | 018, 205-224 |

## Lo que la spec 054 hace con esto

La spec 054 no borra ninguno de estos archivos de la historia: se quedan en `334f144` para siempre. Lo que hace es
**sacarlos del camino del ciclo** (ver → clic → volver a ver) cuando cuestan milisegundos. Cada desconexión queda
escrita en `docs/specs/054-*.md` con: qué se desconectó, cuánto costaba medido, qué promesa se retiró (con su
número, que no se recicla) y desde qué archivo de esta tabla se recupera.

El camino de vuelta, cuando toque: reconectar el grafo **fuera** del ciclo —en otro hilo, después de contestar, sin
leer la pantalla por su cuenta— alimentándolo con la misma lectura que ya hizo el ciclo.
