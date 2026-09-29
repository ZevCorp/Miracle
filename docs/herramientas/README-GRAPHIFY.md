# Graphify en el equipo

Este repo tiene un **grafo de conocimiento** generado con [graphify](https://github.com/safishamsi/graphify):
un mapa del código y la documentación que permite preguntar cosas como *"¿dónde se maneja el audio?"*
y obtener archivos y líneas exactas, sin que la IA tenga que leer el proyecto entero.

El grafo vive en `graphify-out/graph.json` y **no se versiona** desde el 2026-08-21: cada commit que
tocaba código arrastraba un diff de 138.000 líneas en `graph.json`, y con eso ningún PR se podía
revisar. Tras clonar, o cuando quieras el grafo al día:

```bash
graphify update .        # en la raíz, cubre todo el monorepo; dentro de apps/<proyecto>, solo ese
```

### El hook de graphify, en tu máquina y no en el repo

Hasta el 2026-09-28 los `settings.json` versionados llamaban a
`C:/Users/Jose David Jaramillo/.local/bin/graphify.EXE`, una ruta que solo existe en un PC: en los
demás el hook fallaba sin avisar. Si lo quieres, ponlo en tu `.claude/settings.local.json` (no se
versiona) con la ruta de TU graphify, en la carpeta donde abres Claude:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash|Grep", "hooks": [{ "type": "command", "command": "graphify hook-guard search" }] },
      { "matcher": "Read|Glob", "hooks": [{ "type": "command", "command": "graphify hook-guard read" }] }
    ]
  }
}
```

---

## Instalación (una sola vez, ~5 minutos)

### 1. Instalar uv

```powershell
pip install uv
```

Si `uv` no se reconoce después de instalar, cierra y abre la terminal.

### 2. Instalar graphify

```powershell
uv tool install graphifyy
```

### 3. Registrar la skill y los hooks

```powershell
graphify install
```

Y dentro de la carpeta del repo:

```powershell
graphify hook install
```

> **Este último paso es obligatorio y no se puede saltar.** Los hooks de git viven en `.git/`,
> que nunca se sube a GitHub, así que cada persona los instala en su máquina.
> Sin esto, el archivo `graph.json` genera conflictos de merge imposibles de resolver a mano.

### 4. Traer el grafo

```powershell
git pull
```

Listo. No necesitas API key ni escanear nada: el grafo ya viene hecho.

---

## Flujo de trabajo diario

No cambia nada de lo que ya haces. El grafo se mantiene solo:

| Cuando haces... | Pasa esto |
|---|---|
| `git pull` | Recibes el código y el grafo actualizado del equipo |
| Preguntas algo en Claude Code | Consulta el grafo antes de responder (configurado en `CLAUDE.md`) |
| `git commit` | El hook actualiza el grafo con tus cambios, automáticamente |
| `git push` | Tu grafo actualizado sube para los demás |

---

## Comandos útiles

### Preguntar por terminal

```powershell
graphify query "como funciona la autenticacion"
```

### Ver qué se rompe si cambias algo

```powershell
graphify affected "BackendClient"
```

### Encontrar los archivos más conectados (los críticos)

```powershell
graphify god-nodes --top 15
```

### Camino entre dos partes del sistema

```powershell
graphify path "FaceWindow" "BackendClient"
```

### Explicar un elemento y sus vecinos

```powershell
graphify explain "VoiceIO"
```

---

## Vista visual con Obsidian (opcional)

Si prefieres navegar el grafo visualmente en vez de por terminal:

1. Instala [Obsidian](https://obsidian.md) (`winget install Obsidian.Obsidian`)
2. Genera tu bóveda:

```powershell
graphify export obsidian --dir C:\mi-vault
```

3. En Obsidian: **"Abrir una carpeta como bóveda"** → selecciona `C:\mi-vault`
4. `Ctrl+G` para la vista de grafo

> **La bóveda NO se comparte por git** — cada quien genera la suya desde el `graph.json`.
> Son miles de archivos y no tiene sentido versionarlos.

### Importante en Windows

Windows limita las rutas a 260 caracteres. Usa una carpeta con ruta **corta**
(`C:\mi-vault`, no `C:\Users\TuNombre\Documents\Proyectos\...`), o la exportación fallará
con `FileNotFoundError` en algún archivo de nombre largo.

---

## Actualizar el grafo a mano

El hook lo hace solo al commitear, pero si quieres forzarlo:

```powershell
graphify update .
```

Rápido y gratis: solo re-analiza el código que cambió, sin usar IA.

Si agregaste **documentación nueva** (`.md`) y quieres que entre al grafo, hace falta la
versión completa, que sí usa IA:

```powershell
graphify extract . --backend claude-cli --max-concurrency 1
```

Requiere tener Claude Code autenticado (`claude auth login`) o una API key con saldo.

---

## Problemas comunes

**`graphify` no se reconoce como comando**
La carpeta de instalación no está en el PATH. Corre `uv tool update-shell` y abre una terminal nueva.

**`uv trampoline failed to canonicalize script path`**
El entorno quedó a medias. Se arregla reinstalando:
```powershell
uv tool install graphifyy --force
```

**Conflicto de git en `graphify-out/graph.json`**
No lo resuelvas a mano. Significa que te faltó el paso 3:
```powershell
graphify hook install
```

**La exportación a Obsidian falla con `FileNotFoundError`**
Ruta demasiado larga. Exporta a una carpeta con ruta más corta (ver arriba).

---

## Qué NO hacer

- No edites `graphify-out/` a mano — se regenera solo
- No escribas notas propias dentro de la bóveda generada — la próxima exportación las borra
  (si quieres notas propias, ponlas en una subcarpeta aparte)
- No te saltes `graphify hook install` — es lo que evita los conflictos de merge
