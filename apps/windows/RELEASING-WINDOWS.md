# Publicar actualizaciones (Ü Windows)

Cómo sacar una versión nueva de la carita (`U.exe`) y que le llegue **sola** a los clientes ya
instalados. El equivalente de [`apps/android/RELEASING.md`](../android/RELEASING.md), que cubre la app Android.

> Para el **backend** no hay nada que hacer: vive en Vercel y se actualiza con un `git push`. Este
> documento es solo para el cliente Windows, que vive como `.exe` en la máquina del usuario.

---

## 1. Cómo funciona (resumen)

- La carita se instala **una sola vez** con `U-Setup.exe`, en `%LocalAppData%\U` (**sin pedir admin**).
- Usa **[Velopack](https://velopack.io)**: al arrancar y cada ~30 min consulta el feed, y si hay versión
  nueva **la descarga en segundo plano** sin interrumpir al usuario.
- Cuando está descargada, la carita muestra una pastilla azul: **"⬇ Versión X lista — reiniciar"**.
  - Si el cliente la toca, o dice **«actualízate»**, el halo se vuelve morado, Ü narra el mensaje humano de la release y reinicia en el momento.
  - Si la ignora → se instala sola **al cerrar Ü**. El siguiente arranque ya es la versión nueva.
  - Si Ü no llegó a cerrarse (se apagó el equipo) → se aplica **al arrancar**, salvo que ya haya otra
    Ü de la misma instalación trabajando: aplicar la cerraría.
- **Cada intento deja rastro.** El arranque siguiente escribe en el log `actualización aplicada: X → Y`
  o `la actualización NO se aplicó`, con la línea de error de `Update.exe`. Si un equipo no se
  actualiza, esa línea dice por qué (spec 072).
- El feed son las **releases de este repo** (`ZevCorp/Miracle`; se llamó `U-Windows-App` hasta el
  2026-10-01 y GitHub redirige el nombre viejo, que es el que llevan escrito las versiones
  anteriores a la 1.3.7). Publicar = lanzar el workflow.
- Las descargas son **deltas** para quien va una versión por detrás: unos 11 MB en vez de 77. Quien
  lleve dos o más baja el paquete completo; Velopack cae solo a él. Hasta la 1.3.6 no hubo deltas: el
  workflow no bajaba la release anterior antes de empaquetar, aunque este documento decía que sí.

Código relevante:
- `windows-client/src/Update/Updater.cs` — el sondeo, la descarga, el mensaje humano y el aplicar.
- `windows-client/src/Update/ArranqueDeActualizacion.cs` — juzgar el intento anterior y aplicar al arrancar.
- `windows-client/src/Update/CarpetaDeTrabajo.cs` — por qué Ü no se queda con la carpeta de trabajo en `current`.
- `windows-client/App.xaml.cs` — `VelopackApp.Build().Run()`, lo primero del proceso (obligatorio).
- `windows-client/src/Ui/FaceWindow.xaml` — la pastilla (`UpdateBtn`).
- `windows-client/src/Config.cs` — `UpdateFeedUrl`.

---

## 2. Dónde vive el feed

Son las **releases de este mismo repositorio**. Cada versión es una release `v<version>` con
`releases.win.json` (el índice), el `.nupkg` y el `U-win-Setup.exe`.

**Estuvo en un bucket de Supabase y no podía funcionar.** El plan gratuito corta las subidas en
**50 MB** —un tope *global*, que manda por encima del 1 GB configurado en el bucket— y el paquete
pesa 80. Siete intentos entre el 2026-07-22 y el 2026-08-16 murieron todos en la última línea, cada
uno por una causa que parecía la definitiva: `--endpoint` contra `--region`, el PUT único
(`RequestEntityTooLarge`), el CRC32 que la CLI de `aws` añade a cada parte. Los tres eran problemas
reales y ninguno era la causa de fondo. El bucket estuvo **siempre vacío**, así que el botón de
actualizar sólo podía contestar «ya estás al día»: no mentía, es que al otro lado no había nada.

Si alguna vez se vuelve a mirar hacia un almacenamiento con plan gratuito, la pregunta que ahorra
una semana es **cuál es el tope de subida del PLAN**, no el del bucket.

El repositorio es **público** desde el monorepo, así que las releases se leen sin credenciales. El
token sigue teniendo trabajo, y un riesgo:

- El **workflow** publica con el token del run, que necesita `permissions: contents: write`. Sin eso
  GitHub responde `Resource not accessible by integration`, un 403 que no menciona permisos.
- La **copia distribuida** consulta con un token de **solo lectura** embebido en el build
  (`WindowsClient.csproj` → `UpdateGithubToken`, secreto `UPDATE_GITHUB_TOKEN`). Le da 5000
  peticiones por hora en vez de las 60 por IP de quien pregunta sin identificarse — y en un hospital
  todos los equipos salen por la misma IP.
- **Va idéntico en cada copia.** Si se revoca, todas reciben un 401 a la vez. Desde la spec 072 la
  copia lo nota y sigue buscando sin token; las anteriores a ella se quedarían sin actualizar, así
  que **no se revoca hasta que la flota haya pasado de la 1.3.6**.

---

## 3. Sacar una versión nueva

**Lo más corto: pedírselo a un agente.** «Publica la actualización de Windows», con o sin el
mensaje para la persona. La skill `/publica-windows` (`.claude/skills/publica-windows/`) le dice qué
comprobar antes, cómo lanzar, y cómo ver que la versión llega de verdad a un equipo.

A mano, desde la pestaña Actions → **Windows release** → *Run workflow*, con la versión (SemVer,
mayor que la publicada) y un `request_id` cualquiera. O desde la terminal:

```bash
gh workflow run windows-release.yml --ref main -f version=1.3.8 -f request_id=lo-que-sea \
  -f user_message="Ahora Ü recuerda mejor lo que hacemos y retoma la experiencia con más continuidad."
```

**Las versiones solo suben.** Velopack actualiza a un número MAYOR que el instalado y a nada más. El
2026-10-01, la víspera de instalar a los primeros usuarios, se planteó volver a empezar en `0.1`: se
descartó porque ya había equipos en la 1.3.x —entre ellos los del hospital—, y una `0.1.0` publicada
después de la `1.3.7` no les llegaría nunca, sin ningún error: verían «ya tienes la última versión»
para siempre. Si un día se quiere marcar un comienzo, se salta hacia arriba (`2.0.0`), no hacia abajo.

**Ensayar sin que le llegue a nadie.** Con `-f ensayo=true` el workflow hace el trabajo entero y
publica como pre-release, que las Ü instaladas no ven. Es para cuando lo que cambia es el propio
actualizador o este workflow; se borra después con `gh release delete <tag> --cleanup-tag --yes`.

O desde **Provider Studio → Distribuir App**, que pregunta el mensaje antes de lanzar. Hasta el
2026-09-30 no lo mandaba, GitHub rechazaba el build con un `422 Required input 'user_message' not
provided` y el botón no publicaba nada. Ojo: la producción de Graph (`graph-eight-pied`) todavía sale
del repo viejo; el arreglo está en `services/graph` y le llega con el corte.

`user_message` es obligatorio. Es la promesa que recibe la persona: debe explicar en lenguaje
humano la intención de la versión, no enumerar commits. El workflow lo guarda como
`release-message.json` dentro de la release. Ü lo lee después de descargar el paquete y usa ese
texto como fuente canónica para narrar la actualización; no intenta inventar un resumen de los
cambios técnicos.

El workflow compila, empaqueta, publica la release **y comprueba que el paquete anunciado esté de
verdad subido**. Esa última comprobación existe porque una vez el paso salió en verde con el índice
publicado y el `.nupkg` ausente: el cliente veía la versión, la intentaba bajar y fallaba cada 30
minutos. Un release que miente es peor que uno que no ocurre.

**Cliente nuevo** (primera instalación): mandale el `U-win-Setup.exe` de la release. A partir de ahí
no vuelve a instalar nada nunca. El enlace que siempre apunta al último:
`https://github.com/ZevCorp/Miracle/releases/latest/download/U-win-Setup.exe`.

---

## 4. Verificar que salió bien

```bash
# La release tiene que existir y traer su paquete dentro (no sólo el índice):
gh release view v1.1.3 --json assets --jq '.assets[].name'
```

En la máquina del cliente: el panel **Backend** de la carita muestra `Versión X` abajo, y 📜 (Logs)
tiene las líneas con tag `update`.

**A quién le llegó**, sin ir a su máquina. El log de cada equipo viaja al panel, así que se pregunta
a la base (proyecto `miracle-app` de Supabase):

```sql
-- qué versión corre cada equipo (desde la spec 072; antes decía 1.0.0.0 para todos)
select email, machine_name, app_version, last_seen_at from graph_windows_users order by last_seen_at desc;

-- quién intentó actualizar y cómo le fue
select email, created_at, label from graph_windows_events
where phase = 'update' and (label like 'actualización aplicada%' or label like 'la actualización NO se aplicó%')
order by created_at desc;
```

**Probar el mecanismo antes de publicar**, con Velopack de verdad y sin tocar la Ü instalada:

```powershell
.\scripts\banco-de-actualizacion.ps1            # diez caminos; tienen que salir todos BIEN
.\scripts\banco-de-actualizacion.ps1 -Viejo     # el sabotaje: tienen que salir MAL cinco
```

---

## 5. Checklist

- [ ] Versión incrementada respecto a la publicada.
- [ ] `user_message` escrito para la persona (obligatorio; se rechaza vacío).
- [ ] El workflow terminó en verde (comprueba solo que el paquete esté publicado).
- [ ] La release trae `releases.win.json`, el `.nupkg` **y** `release-message.json`.
- [ ] Las releases viejas **siguen** publicadas: son la base de los deltas.

---

## 6. Detalles que muerden

- **Firma de código**: sin certificado, SmartScreen avisa al correr `U-Setup.exe` la primera vez
  (Fase 0.3 de `PRODUCTION.md`). El auto-update posterior **no** vuelve a mostrar el aviso.
- **`%LocalAppData%`, no `Program Files`**: Velopack no soporta directorios privilegiados. Es a favor
  nuestro — actualiza sin UAC.
- **Nada de `PublishSingleFile`**: `ScreenRecorderLib` es mixto C++/CLI y no lo soporta. Velopack
  empaqueta la carpeta, así que no hace falta.
- **En desarrollo el updater se apaga solo**: con `dotnet run` no hay instalación detrás, `IsInstalled`
  es false y `Updater` no hace nada. Para probar el update de verdad hay que instalar con el Setup —
  eso es lo que hace `scripts\banco-de-actualizacion.ps1`.
- **Nada puede tener abierta la carpeta `current`.** Velopack actualiza renombrándola, y Windows no
  deja si es la carpeta de trabajo de un proceso vivo o si otro programa tiene un archivo suyo abierto.
  Por eso Ü suelta su carpeta de trabajo al arrancar (`CarpetaDeTrabajo`): lo que abría sin decir
  carpeta —el navegador, una app del menú Inicio— la heredaba, y con ese programa abierto la
  actualización no se aplicaba por ningún camino (2026-09-30). Un proceso nuevo que se lance con
  `WorkingDirectory` dentro de la instalación vuelve a romperlo.
- **Una Ü lanzada desde una sesión de Claude no ve lo mismo.** La app de Claude es un paquete MSIX y
  lo que sus procesos escriben en `%LOCALAPPDATA%` va a una vista privada: descargan la versión a un
  sitio que la Ü abierta desde el menú Inicio no ve. Para probar instalaciones, fuera de AppData.
- **Desinstalar borra lo aprendido.** Lecciones, skills, recuerdos y logs viven en `%LOCALAPPDATA%\U`,
  que es la raíz que el desinstalador elimina entera. No se arregla una actualización que no llega
  desinstalando: se pierde todo eso. Pendiente de mudar (spec 072, «lo que no entra»).
- **La config del usuario sobrevive**: vive en `%APPDATA%\U\config.json`, fuera de la carpeta de
  instalación que Velopack reemplaza.
