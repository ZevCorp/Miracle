---
name: prueba-de-verdad
description: Hace el nivel 4 de la verificación — probar el cambio sobre lo real (Ü en el PC con al menos dos pantallas, el APK release en el teléfono en dos apps, la app Mac instalada, Graph en marcha con una llamada real, el portal en el navegador) — sin romper la instalación del usuario, midiendo antes/después contra main, y devolviendo la fila de evidencia con nombres y lo que NO se probó. Úsala después de que el contrato esté verde y antes de /a-main, cuando el usuario diga "pruébalo de verdad", "pruébalo en el PC/teléfono", "nivel 4", "¿funciona en la app real?", "mide antes y después", o cuando el cambio toque algo que el contrato no ve (UI, voz, tiempos, SAP, permisos del sistema).
---

# La prueba de verdad

El contrato juzga la lógica; no ve una carpeta que Windows no deja renombrar, un micrófono que tarda
450 ms en inicializar, ni un permiso de macOS atado a la firma. Esos fallos se encontraron aquí, no
leyendo código. Y una sola pantalla, una sola app o una sola llamada es un dato incompleto: se dice
como tal (aprendizaje nº9).

## Reglas que valen en todas

- **No romper lo del usuario.** Su Ü instalada sigue viva, su teléfono sigue siendo suyo, su base de
  producción no se toca. Copias aparte, datos aparte.
- **Antes y después.** El número de la rama solo dice algo al lado del de `main`, medido igual.
- **Con nombre.** «explorer.exe (16 pantallas) y Configuración (11)», no «en varias pantallas».
- **Lo que no se probó, escrito.** Es parte del resultado, no una disculpa.

## Windows (en un PC con Windows)

```powershell
cd apps\windows
.\scripts\dev-paralelo.ps1                     # compila en Release FUERA del repo (C:\U-dev2) y lanza con su propio U_DATA_DIR
.\scripts\dev-paralelo.ps1 -Backend http://localhost:3000   # contra un Graph local (dev-local.ps1 -SoloBackend)
```

- Convive con la Ü estable: no la cierres. Si hay que cerrar la de prueba, **por ruta**:
  `Get-Process U | Where-Object { $_.Path -like "*U-dev2*" } | Stop-Process`. Nunca por nombre.
- Se juzga **Release**, nunca Debug (Smart App Control lo bloquea, y no es lo que se distribuye).
- Mínimo **dos pantallas distintas**, con nombre (una app de SAP y una de Windows, o dos de SAP).
- Mide con el log: `/lee-el-log` con `--instancia` (la de la rama se llama como su carpeta) y `--ms`.
  El mismo recorrido con la estable da el «antes».
- Voz: la batería A/B `scripts\nivel4-voz\correr.ps1` (main contra rama, ~25 min, alguien delante o
  sin bloqueo de pantalla). Una prueba de voz vale si el log dice `voz-viva: sesión abierta … el
  servidor la confirmó`, no si apareció texto.
- Actualización: `.\scripts\banco-de-actualizacion.ps1` (y `-Viejo`, el sabotaje). Una Ü lanzada
  desde la app de Claude ve otro `%LOCALAPPDATA%` (MSIX): para instalaciones, fuera de AppData.
- «Ü desde cero»: `.\scripts\bateria-u.ps1` (mueve el ratón de verdad).

## Android (con el teléfono por USB)

```bash
cd apps/android
./gradlew :app:assembleRelease
adb install -r app/build/outputs/apk/release/*.apk      # el release: es lo que se distribuye
adb logcat -c
# … la prueba, en DOS apps distintas …
adb logcat -d -v threadtime -s Graph:D > /tmp/prueba.txt
python3 .claude/skills/lee-el-log/scripts/linea_de_tiempo.py /tmp/prueba.txt --resumen
```

Tabla por app: qué se pidió, qué hizo, estado HTTP, ms, resultado. Un cierre inesperado: la traza
la copia `CrashActivity` al portapapeles.

## Mac (en un Mac)

```bash
cd apps/mac && ./build.sh release && ./instalar.sh && ./abrir.sh
log show --last 15m --style compact --predicate 'subsystem == "com.zevcorp.u.mac"'
```

La app **instalada** en `~/Applications/U.app`, nunca el ejecutable suelto: macOS ata los permisos
(accesibilidad, pantalla, micrófono) al bundle y a la firma, y lo que funciona suelto no se repite
instalado.

## Graph

```bash
cd services/graph && npm start                         # con .env (ver .env.example)
curl -s -X POST localhost:3000/<ruta> -H "X-API-Key: …" -H 'content-type: application/json' \
     -d '{…}' -w '\n%{http_code} en %{time_total}s\n'
```

Una llamada real, con su respuesta y su tiempo, contra el servidor en marcha. Si toca a un cliente,
el cliente apuntando a ese Graph local (`dev-paralelo.ps1 -Backend`, o la URL en el panel de Android).
Producción no se usa como banco de pruebas: sale sola al mergear, con prueba de humo.

## El portal

`/verifica-web`: el CI local y `pantallas.mjs` con el rol que entra y uno que no, en móvil y
escritorio, claro y oscuro.

## La fila de evidencia

```markdown
| A mano | ✅ | U.exe de la rama (C:\U-dev2) en SAP «Admisión» y explorer.exe: clic→voz 1.100 ms (main 1.900, 3 clics cada uno); log u-20261001-voz-p7788-…: «el servidor la confirmó» 3/3 |
| Lo que NO se probó | — | el collar; la salida por parlantes; un PC sin GPU |
```

Si no se pudo hacer aquí (la máquina no es la del proyecto), la fila es **⚪ no corrido, y por qué**,
y en el PR se pide a quien pueda. Nunca ✅.
