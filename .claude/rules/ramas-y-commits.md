# Ramas, commits y el tamaño del trabajo

Resumen operativo de la guía de Windows ([`apps/windows/CLAUDE.md`](../../apps/windows/CLAUDE.md) §*Ramas*), que desde el 2026-09-28 vale para todo el monorepo. Lo que un agente tiene que respetar
sin preguntar.

## La rama

```
<persona>/<que-hace>     jose/puente-portal-clinico · jero/carrera-del-busy · pipe/inventario-accionable
```

El nombre de quien la abre, en minúscula, y después **el resultado** en kebab-case. El prefijo es
dueño de *la rama*, no del código.

- **Nace** siempre desde `main` fresco, **y en su propio árbol de trabajo**:
  `bash tools/monorepo/arbol.sh nuevo jose/lo-que-sea`. **Nunca desde la rama anterior**, y nunca
  con `git checkout -b` en una carpeta que comparten varias sesiones.
- **Vive** de medio día a tres días. Una vez al día: `git pull --rebase origin main`.
- **Una rama es una feature — ni media, ni dos.** Al cambiar de feature se cambia de rama y de
  árbol, aunque la anterior no esté terminada (`git commit -am "wip: hasta donde llegué"`, push, y
  la siguiente con `arbol.sh nuevo`).
- **Muere** al mergear, con su árbol: `bash tools/monorepo/arbol.sh cerrar`. Comprueba que el PR
  está mergeado y que no queda nada sin commitear, y entonces borra el árbol y la rama. Si algo
  queda, lo nombra y no lo borra.

**En el método: una spec = una rama.** Las fases son commits dentro de ella. Se mergea cuando
*todas* sus promesas están verdes, no fase a fase.

## Un agente, un árbol

Dos agentes no comparten árbol de trabajo, igual que dos personas no comparten rama. En una carpeta
compartida, el `git switch` de uno le cambia la rama al otro debajo de los pies, y un `git add -A`
se lleva los cambios ajenos a su commit.

- **Antes de la primera edición**, el agente trabaja en un árbol que creó él (`arbol.sh nuevo`) o
  que le dieron. Claude Code entra con la herramienta `EnterWorktree`, pasándole la ruta.
- **Un guardia lo hace cumplir.** El árbol es de la primera sesión de agente que escribe en él. Otra
  sesión que intente editarlo o commitear en él se detiene, con la orden para crear el suyo. Quién
  está en qué árbol: `bash tools/monorepo/arbol.sh estado`.
- **Seguir el trabajo de una sesión que ya terminó** es legítimo: `bash tools/monorepo/arbol.sh
  tomar`. La marca caduca sola a las 4 horas sin actividad.
- **Al terminar, no se deja nada atrás**: `arbol.sh cerrar` para lo propio, y `arbol.sh limpiar`
  para barrer todo lo terminado que nadie usa. Ninguno borra trabajo que no esté en `main`.
- **Por qué `cerrar` y no `git branch -d`:** con squash merge, `-d` protesta siempre, porque los
  commits de la rama no son los que entraron a `main`. `cerrar` mira el PR, que sí distingue lo
  mergeado de lo que no. `-D` a mano sigue sin usarse: se salta esa comprobación.

A una persona sola en su clon, el guardia no la toca.

## `main` no se toca

`main` cambia **solo por merge de un PR**, y GitHub lo hace cumplir: `main` está protegido y exige
el check `compuerta`. Si `git status` dice `On branch main` y hay cambios, te equivocaste de sitio:

```
git stash -u && bash tools/monorepo/arbol.sh nuevo jose/lo-que-sea
# y en el árbol nuevo:  git stash pop
```

**Squash merge** por defecto. El PR va aunque lo mergees tú mismo cinco minutos después: es donde
queda escrito qué entró y por qué, y donde corre el contrato.

## El mensaje de commit

El repo tiene una voz y se mantiene: **`tipo(ámbito): lo que el sistema ahora hace, en español y en
minúscula`**. Describe el *resultado*, no el archivo tocado.

```
feat(bronce): el terreno guarda lo observado; lo declarado vive en su capa
feat(arquitecto): terminar deja de ser declarar, y pasa a ser entender
test(plata): las promesas de la derivacion, escritas antes que su codigo
fix(plata): el nivel se indexa por SELECTOR, y el mapa deja de salirse de la app
fix(nucleo): la profundidad se CALCULA entera; un atajo no dice a que hondura vive su destino
```

Tipos en uso: `feat`, `fix`, `test`, `docs`, `chore`, `wip`.

Lo que hace bueno a esos mensajes y hay que imitar:

- **Dicen el cambio de comportamiento**, no la edición. `feat(plata): añadir método Derivar` sería peor
  que el original aunque describa lo mismo.
- **Nombran lo que se acabó**: «y se acaba el segundo cálculo», «deja de cortarse en el mobiliario».
- El cuerpo, cuando lo hay, lleva **la medida**: cuántos sitios tenían la clase de error (patrón nº5),
  en cuántas pantallas se probó (aprendizaje nº9), qué promesa pasó a verde.

En el método, el commit de una fase cita su promesa:

```
feat(plata): el mobiliario derivado abre rutas, y se acaba el segundo calculo

Promesa 16 en verde (sin cromo derivado no hay atajo). Contrato: 19/19, 0 pendientes.
Probado en explorer.exe y Configuracion — 2 pantallas, no 1 (aprendizaje nº9).
```

## Reparto: lo que de verdad evita choques

Una rama por persona evita pisarse la rama, no el archivo.

| Zona | Riesgo |
|---|---|
| `apps/windows/windows-graph/` | bajo — específico de SAP |
| `apps/windows/windows-client/` UI (carita, paneles, inspector) | **alto** — es lo que todos tocan |
| `apps/windows/windows-client/` servicios (voz, logging, release) | bajo |
| `apps/mac/`, `apps/android/`, `apps/web/`, `services/graph/` | cada uno el suyo: se toca de uno en uno y con el CI de su carpeta |
| la raíz (`AGENTS.md`, `.github/`, `.githooks/`, `tools/`) | **alto** — la usan todos los proyectos a la vez |

**Que dos personas no tengan features abiertas en la UI a la vez.** Si es inevitable: pantallas
distintas y ninguna rama de más de un día.

## Lo que un agente no hace sin que se lo pidan

- Commitear o hacer push.
- Mergear a `main`, ni forzar nada (`push --force`, `-D`, `reset --hard`) sobre trabajo compartido.
- Abrir una rama paralela con trabajo que otro ya tiene abierto. Se habla.
- Cambiar de rama, o tomar el árbol, donde está trabajando otra sesión.
