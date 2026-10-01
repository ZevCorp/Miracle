---
name: lee-el-log
description: Lee los logs de Ü (Windows, Android, Mac) y de Graph con método forense — encuentra el log correcto, elige la instancia, arma una línea de tiempo con tiempos y silencios, y devuelve las causas posibles y las filas del «Diagnóstico» de una spec. Úsala SIEMPRE antes de proponer una causa cuando algo "no funciona", "se quedó pegado", "la voz no abre", "no se actualizó", "está lento", "qué pasó", cuando el usuario pegue un log o un trozo de logcat, o al escribir el diagnóstico de una spec. El log antes que la teoría.
---

# Leer el log antes de teorizar

Patrón nº1: el 2026-07-26 se gastaron cuatro rondas de capturas de pantalla en algo que el log decía
en una línea. Y patrón nº2: un síntoma casi nunca tiene una sola causa posible; el log es lo que
descarta.

## 1. Encontrar el log correcto

| Dónde corre | Dónde está |
|---|---|
| Ü Windows instalada | `%LOCALAPPDATA%\U\logs\u-AAAAMMDD-instalada-p<pid>-<HHmmss>.log` |
| Ü Windows de un árbol | el mismo sitio; el origen es el nombre de la carpeta del árbol (`u-…-jose-voz-p7788-….log`) |
| Con `U_DATA_DIR` (contrato, `dev-paralelo.ps1` en `C:\U-dev2`) | `<U_DATA_DIR>\logs\` |
| La actualización (Velopack) | `%LOCALAPPDATA%\velopack\velopack_U.log`, aparte |
| Android | `adb logcat -c` antes de reproducir; después `adb logcat -d -v threadtime -s Graph:D > logcat.txt`. Un cierre inesperado: `CrashActivity` copia la traza al portapapeles (el release no es depurable, `run-as` no sirve) |
| Mac | `log show --last 30m --style compact --predicate 'subsystem == "com.zevcorp.u.mac"' > mac.log` |
| Graph en Vercel | MCP de Vercel `get_runtime_logs` (el plan Hobby guarda **1 hora**: pídelo ya) |
| Lo que Windows mandó a Graph | `GET /api/windows/users/<email>/events?since=…&limit=…` (provider admin), o SQL sobre `graph_windows_events` (abajo) |

Dos trampas medidas:
- **Desde los logs del 2026-09-22 hay un archivo por instancia.** Si hay dos Ü abiertas (la
  instalada y la de tu árbol), sus líneas no se mezclan en un archivo: hay que elegir.
- **Claude Desktop es MSIX**: un proceso lanzado desde él ve un `%LOCALAPPDATA%` privado. Si «no
  hay log», busca también en `%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Local\U\logs`.

En Windows, léelo sin bloquearlo: `Get-Content <log> -Tail 200 -Wait`. Nunca `File.ReadAllText`
desde otro proceso (rompió a `LogBus` una vez).

## 2. La línea de tiempo

```bash
L=.claude/skills/lee-el-log/scripts/linea_de_tiempo.py
python3 $L <carpeta-o-archivo> --instancias                       # qué Ü escribieron ese día
python3 $L <carpeta> --instancia instalada --resumen              # tags, errores, silencios largos
python3 $L <carpeta> --instancia instalada --tag 'voz-viva|voz-clic' --desde 09:20:00
python3 $L <carpeta> --busca 'timeout|1011' --contexto 3          # cada acierto con su alrededor
python3 $L <carpeta> --instancia jose-voz --ms --tag voz-clic     # mediana y máximo por tramo
python3 $L logcat.txt --tag voice --md                            # tabla para la spec
```

Entiende el formato por instancia de Windows, el viejo (`[HH:mm:ss] tag: msg`) y logcat. Con una
carpeta, toma el día más reciente (`--dia AAAAMMDD` para otro). Marca con ✘ lo que suena a error.

Tags que más dicen en Windows: `voz-viva` (la sesión: solo «el servidor la confirmó» prueba que
abrió), `voz-clic` (ms por tramo del clic), `update`, `mapa-mcp` (`->`/`<-` con ms), `clic-sap`,
`nav`, `plan`, `✋ no se llegó a`. En Android: `[voice]`, `[graph]`, `[workflow]`, `[mcp]`.

## 3. De la línea de tiempo a las causas

1. **Ubica el momento**: la última línea normal antes del síntoma y la primera anormal. El
   silencio más largo antes de un error suele ser una espera que nadie cortó.
2. **Escribe todas las causas compatibles** con lo que se ve, no la primera. Para cada una, qué
   línea la confirmaría y cuál la descarta.
3. **Descarta con el log**, no con el código. Si el log no alcanza para decidir, lo que falta es
   un rastro: dilo, y propón la línea de log que lo decidiría (eso también es un hallazgo).
4. **Lo medido y lo supuesto, separados.** Una duración sacada de dos horas a segundos es ±1 s;
   dilo.

## 4. Lo que entregas

Al usuario: la línea de tiempo corta (las 5-15 líneas que importan), las causas con su evidencia,
y lo que falta saber. Si va a una spec, las filas de su «Diagnóstico»:

```markdown
| Qué | Medida | Fuente |
|---|---|---|
| la sesión de voz no abre al segundo clic | 0 de 2 «el servidor la confirmó» tras un 1011 | u-20261001-instalada-p4120-091500.log, 09:21:02-09:22:15 |
| encender hasta la primera voz | mediana 1500 ms (2 clics) | mismo log, `--ms --tag voz-clic` |
```

## Graph: lo que Windows mandó

Solo lectura, con el MCP de Supabase (`execute_sql`) sobre el proyecto de Graph:

```sql
-- lo último de un usuario (los logs se juntan por plantilla y hora: mira detail->>'veces')
select created_at, kind, phase, label, detail
from public.graph_windows_events
where email = '<email>' and created_at > now() - interval '2 hours'
order by id desc limit 200;

-- quién está en qué versión
select email, app_version, machine_name, last_seen_at from public.graph_windows_users order by last_seen_at desc;
```

Los logs de más de 7 días ya no están en `graph_windows_events`: van a `archivo.graph_windows_logs`
(una fila por hora, `lineas` con un JSON por línea), que no se expone por la API. Si hace falta lo
completo, está en el PC del usuario.
