# Miracle Notes ↔ Graph / Miracle Operations — Análisis técnico de integración

> **Estado del documento:** investigación. No se implementó nada, no se creó ningún endpoint,
> no se tocaron variables de entorno, no se hizo push, merge ni cambio de ramas.
>
> **Fecha del análisis:** 2026-07-26
> **Repos y commits analizados (HEAD == origin/main en los dos):**
> - `joseph1356k/Pagina-web-clientes-final` — rama `claude/miracle-notes-graph-integration-2d66h1` @ `35e32e3`
> - `joseph1356k/Graph` — rama `claude/miracle-notes-graph-integration-2d66h1` @ `09653db`
>
> **Convención de evidencia.** Cada afirmación importante lleva su origen. Se distingue con
> etiquetas explícitas:
> - **[HECHO]** — verificado leyendo código, esquema vivo o infraestructura real.
> - **[INFERENCIA]** — deducción razonable a partir de hechos, no verificada directamente.
> - **[RECOMENDACIÓN]** — propuesta de diseño.
> - **[PREGUNTA]** — no se puede resolver desde el código; la responde el equipo.

---

## 1. Resumen ejecutivo

**La conexión que ya existe es más útil de lo esperado, y el hueco real está en otro sitio
del que se pensaba.**

Cinco conclusiones que cambian el planteamiento inicial:

1. **[HECHO] Miracle Notes ya consume Graph como backend clínico.** No son dos sistemas
   desconectados: `lib/api/clinical.ts` habla con Graph (`NEXT_PUBLIC_API_BASE_URL`) usando el
   token Supabase del médico, y Graph lo verifica offline contra el JWKS del proyecto. Los dos
   repos comparten **un solo proyecto Supabase** (`miracle-app`, ref `zyvfamlhlmztliexvmej`,
   verificado en vivo). La API actual **no hay que reemplazarla: hay que ampliarla**.

2. **[HECHO] La topología segura que se buscaba ya es la topología que existe.** El cliente
   Windows habla **solo** con Graph, siempre con conexiones **salientes**, autenticado con
   `X-API-Key` en `/api/v1`. Ya se registra como dispositivo (`POST /api/v1/agent/register`)
   y ya sube lotes de eventos (`POST /api/v1/agent/events`). Nunca se abre un puerto entrante
   en la máquina del médico. No hay que inventar esta arquitectura, hay que darle un objeto
   nuevo que transportar: el trabajo.

3. **[HECHO] Lo que NO existe es la cola.** No hay tabla de trabajos, ni estados de ejecución,
   ni clave de idempotencia, ni claim/lease, ni registro de dispositivos con identidad propia,
   en ninguno de los dos repos. Todo el sistema actual es petición/respuesta conducida por el
   cliente. **Eso es exactamente lo que falta construir**, y es una pieza acotada.

4. **[HECHO] El disparador correcto ya está modelado y hasta tiene el estado de destino.**
   La firma de la nota (`signConsultationNote`) ya calcula un **SHA-256 del contenido firmado**
   y congela la fila con un trigger de inmutabilidad. Y `consultations.estado` ya contempla
   **`exportada`** = "ya subí esta nota al sistema del hospital", que hoy marca **a mano una
   secretaria** vía RPC. La automatización de Graph no inventa un flujo: **automatiza esa
   transición concreta**, y el hash de la firma sirve tal cual como clave de idempotencia.

5. **[HECHO] Hay dos bloqueadores reales, y ninguno es la elección de transporte.**
   (a) El repo del cliente Windows (`windows-app`, WPF/.NET 8) **no tiene remoto en GitHub** —
   solo commits locales — así que no se pudo leer su código: todo lo que este documento dice
   del cliente sale de los contratos espejo y la documentación dentro de Graph.
   (b) La identidad del dispositivo es **una única API key compartida, horneada en el `.exe`
   y descompilable**, y el registro de usuarios se hace por **email sin contraseña**. Para
   mover notas clínicas eso no alcanza. El plan de enrolamiento por instalación **ya está
   diseñado en el repo pero no implementado** — y es un **prerrequisito**, no una mejora
   posterior.

**Recomendación de una línea:** ampliar Graph con un módulo `Operations` aislado, cola en
Postgres del mismo Supabase, entrega por **long-poll con claim y lease** (HTTP, saliente),
reporte de progreso por **HTTP POST**, y estado en Notes por **polling en el MVP** evolucionando
a **Supabase Realtime** para la pata de visualización. **No se necesitan WebSockets para el MVP.**

---

## 2. Estado actual confirmado

### 2.1 Infraestructura real (verificada, no asumida)

| Componente | Verificación | Resultado |
|---|---|---|
| Supabase | MCP `list_projects` | **[HECHO]** Un solo proyecto: `miracle-app`, ref `zyvfamlhlmztliexvmej`, región `us-east-1`, Postgres `17.6.1.127`, estado `ACTIVE_HEALTHY` |
| Tablas | MCP `list_tables` (schema `public`) | **[HECHO]** 28 tablas, **todas con RLS activado**. Conviven las de Notes (`profiles`, `organizations`, `patients`, `consultations`, `audit_events`, `appointments`, `consultation_addenda`, `secretary_doctor_access`, `rate_limits`) y las de Graph (`clinical_templates`, `clinical_encounters`, `graph_windows_users`, `graph_windows_events`, `graph_app_users`, `graph_prompts`, `graph_exec_logs`, `graph_memory`, `graph_learned_tools`, `graph_client_config`, `graph_studio_progress`, `graph_release`, `graph_workflows`, `graph_interactions`, `runs`, `lk_*`) |
| Filas relevantes | MCP `list_tables` | **[HECHO]** `clinical_encounters` **115**, `consultations` **93**, `clinical_templates` **157**, `graph_windows_users` **1**, `graph_windows_events` **43**, `graph_app_users` **4**, `graph_exec_logs` **1980**, `consultation_addenda` **1** |
| Vercel — Notes | MCP `get_project` `prj_rFaM61JA8DwZJGkVYydTykXg6GrH` | **[HECHO]** Proyecto `miracle-web`, framework `nextjs`, Node `24.x`, último deploy **READY** en target `production`. Dominios: `itsmiracleai.com.co`, `www.itsmiracleai.com.co`, `miracle-web-umber.vercel.app` |
| Vercel — Graph | MCP `get_project` `prj_gOy4opji8kmUZgMQfaEAaapbT3JU` | **[HECHO]** Proyecto `graph`, Node `24.x`, último deploy **READY** en `production`. Dominio principal: **`graph-eight-pied.vercel.app`** |
| Vercel — backend Windows viejo | MCP `get_project` `prj_A9MAB9kuCPCrW38tp3EijYTTSFkk` | **[HECHO]** Proyecto `u-windows-backend` existe, pero su último deployment está en **`ERROR`** y `target: null` (nunca llegó a producción). **Está muerto** |
| Otros proyectos del equipo | MCP `list_projects` | **[HECHO]** Existen además `landing-descargas` y **`miracle-his-simulator`** (relevante: banco de pruebas del HIS) |

**[INFERENCIA]** `u-windows-backend` es el "backend viejo" que los comentarios de Graph dicen
haber absorbido. `web/api/registerWindowsAgentRoutes.js:1-4` lo dice literalmente: *"Rutas
públicas /api/v1 del agente de escritorio Ü (cliente Windows), **absorbidas del backend viejo**
(Android/backend/api/{agent,teach}/*)"*. No hay que mantener ese proyecto.

### 2.2 Ramas: no existe una "rama de Windows"

**[HECHO]** `git branch -a` en los dos repos devuelve únicamente `main` y
`claude/miracle-notes-graph-integration-2d66h1` (y sus equivalentes en `origin`). No hay
`windows`, ni `feature/windows`, ni nada parecido.

**Conclusión importante:** *"la rama de Windows"* no es una rama de git. Es el **módulo
Windows dentro de `main` de Graph** — un conjunto de servicios y rutas (`WindowsTelemetryService`,
`WindowsPanelService`, `WindowsAppReleaseService`, `AgentTurnService`, `TeachVideoService`,
`registerWindowsAgentRoutes`, `registerWindowsTelemetryRoutes`, `registerWindowsPanelRoutes`,
`registerWindowsDistributionRoutes`, `src/domain/windowsEngines.js`) más el **repo separado
`windows-app`**, que no está en GitHub.

### 2.3 El repo del cliente Windows no es accesible — límite de este análisis

**[HECHO]** `docs/AGENTE-WORKFLOWS-CONTEXTO.md:26` (Graph):

> | **windows-app** | `C:\Users\felip\OneDrive\Documentos\Code\windows-app` | Cliente WPF/.NET 8 → `U.exe`. `windows-client/` (carita, agente, teach) + `windows-graph/` (workflows UIA/SAP, compilado dentro de U.exe). **Sin remoto GitHub** (solo commits locales). |

**[HECHO]** El código del cliente se referencia por ruta en decenas de comentarios de Graph —
`windows-client/src/Domain/Protocol.cs`, `windows-client/src/Agent/AgentLoop.cs`,
`windows-client/src/Uia/SurfaceLocator.cs`, `windows-client/src/Uia/UiInspector.cs`,
`windows-client/src/Uia/SapContextReader.cs`, `windows-client/src/Diagnostics/LogBus.cs`,
`windows-client/src/Teach/TeachSession.cs`, `windows-client/src/Mcp/WorkflowMcpRunner.cs`,
`windows-graph/src/WorkflowPlayer.cs`, `windows-graph/src/Surfaces/SapGuiSurface.cs` — pero
**ninguno de esos archivos está en los repos disponibles**.

> **Límite explícito:** todo lo que este documento afirma sobre el comportamiento interno del
> cliente Windows es **[INFERENCIA]** derivada de (a) los contratos espejo documentados en Graph,
> (b) los `studio-docs` que citan líneas concretas del cliente, y (c) la forma de los datos que
> el cliente realmente envía y que sí están en el esquema vivo. **Antes de implementar hay que
> subir `windows-app` a GitHub y releer el cliente.** Es el punto 1 de la lista de bloqueadores.

---

## 3. Arquitectura actual encontrada

### 3.1 Mapa de sistemas

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│  NAVEGADOR DEL MÉDICO                                                             │
│                                                                                   │
│  Miracle Notes  (Next.js 16.2.9 / React 19 · Vercel "miracle-web")               │
│    ├── Supabase JS directo (RLS)  ──────────────┐  consultations, patients,      │
│    │   app/app/providers.tsx                    │  audit_events, profiles,        │
│    │                                            │  appointments, addenda          │
│    ├── lib/api/clinical.ts ──── Bearer <JWT> ───┼──► Graph /api/clinical/*        │
│    │                                            │                                 │
│    └── app/api/* (route handlers, servidor) ────┼──► Graph /api/v1/*  (X-API-Key) │
│           stt/session · clinical/note-from-photo │      MIRACLE_API_KEY server-only│
└─────────────────────────────────────────────────┼─────────────────────────────────┘
                                                  │
┌─────────────────────────────────────────────────▼─────────────────────────────────┐
│  GRAPH  (Express 5 · Vercel "graph" · graph-eight-pied.vercel.app)                │
│  UNA SOLA función serverless: api/index.js → web/server.js   maxDuration 60 s     │
│                                                                                   │
│   /api/clinical/*   requireClinicalAuth  (JWT Supabase del médico, JWKS offline)  │
│   /api/v1/*         requireApiKey        (MIRACLE_API_KEYS, env, compartida)      │
│   /api/windows/*    requireAccountAuth   (sesión admin local, solo lectura panel) │
│   /api/providers/*  requireAccountAuth   (Provider Studio, admin)                 │
│                                                                                   │
│   ├── Supabase (service-role, SupabaseRestClient) ──► clinical_*, graph_windows_* │
│   ├── Neo4j  ──► Workflow / Step / WorkflowBranch / SurfaceProfile                │
│   └── api/miracle_runtime.py (sidecar Python: voz + orquestación de nota)         │
└─────────────────────────────────────────────────▲─────────────────────────────────┘
                                                  │  SOLO conexiones SALIENTES
                                                  │  X-API-Key horneada en el .exe
┌─────────────────────────────────────────────────┴─────────────────────────────────┐
│  MÁQUINA WINDOWS DEL MÉDICO   (repo windows-app — NO en GitHub)                   │
│  U.exe  (WPF/.NET 8)                                                              │
│    windows-client/  carita · AgentLoop · TeachSession · LogBus · SurfaceLocator   │
│    windows-graph/   WorkflowPlayer · UiaSurface · SapGuiSurface                   │
│                                                                                   │
│  Habla con: SAP GUI Scripting · UI Automation (UIA) · navegador (web://)          │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Las tres superficies de autenticación de Graph (son tres, y están aisladas a propósito)

**[HECHO]** `web/server.js:367-435` monta tres regímenes distintos y los comentarios insisten
en que no se mezclen:

| Superficie | Middleware | Credencial | Identidad expuesta | Quién la usa |
|---|---|---|---|---|
| `/api/clinical/templates`, `/api/clinical/encounters`, `/api/clinical/assistant` | `requireClinicalAuth` (`web/api/requireClinicalAuth.js:94`) | **JWT de usuario Supabase** (`Authorization: Bearer`) verificado offline contra JWKS (`:80-91`) | `req.clinicalUser` `{id, email, role, canManageInstitutional}` | **Miracle Notes** (navegador del médico) |
| `/api/v1/*` | `requireApiKey` (`web/api/requireAuth.js:378`) | **API key permanente compartida** desde `MIRACLE_API_KEYS` (env), comparación `timingSafeEqual` (`:365-374`) | `req.user = {id: 'api-client:<label>', role:'api-client'}` | **Cliente Windows**, extensión Chrome, rutas servidor de Notes |
| `/api/status`, `/api/workflows`, `/api/providers`, `/api/android`, `/api/windows/users`, `/api/studio/progress`, … | `requireAccountAuth` + `attachWorkflowAccess` (`web/api/requireAuth.js:316,320`) | **Sesión admin local** firmada con HMAC (`miracle-local-admin-v1`) o cookie `miracle_admin_session` | `req.user` + `req.workflowAccess.canManageGlobalWorkflows` | **Provider Studio** (panel interno) |

**[HECHO]** El aislamiento es explícito en el código: `requireClinicalAuth.js:5-9` dice
*"Does NOT touch req.user or the /api/v1 surface"*, y `server.js:363-366` advierte que las rutas
clínicas con estado *"must NOT go through this local auth"*.

**[RECOMENDACIÓN]** Este aislamiento de tres carriles es **bueno y hay que respetarlo**. El
módulo Operations necesita exactamente dos de ellos: el carril clínico (para que el médico cree
y consulte trabajos) y el carril `/api/v1` (para que el dispositivo reclame y reporte). No hay
que crear un cuarto.

### 3.3 Restricciones reales del despliegue en Vercel (verificadas, no asumidas)

**[HECHO] Graph es una sola función serverless.** `vercel.json:7-12` declara
`functions: { "api/index.js": { maxDuration: 60 } }`, y los `rewrites` mandan **todo** `/api/:path*`
a `/api?path=:path*`. `api/index.js:1-15` reconstruye la URL y delega en la app Express completa.
Consecuencias:
- Toda petición a Graph tiene un **techo duro de 60 s**.
- No hay proceso de larga vida: no se puede sostener un socket entre invocaciones, ni mantener
  estado en memoria compartido entre instancias.

**[HECHO] Ya se sostiene streaming real bajo esa restricción, y funciona en producción.**
`web/api/registerWindowsPanelRoutes.js:14-23` define las constantes con el razonamiento explícito:

```js
const STREAM_TICK_MS  = 400;    // cada cuánto se pregunta a Supabase
const STREAM_MAX_MS   = 50000;  // "Vercel corta la función a los 60 s (vercel.json:
                                //  maxDuration). Cerramos ANTES, limpio, para que el
                                //  cliente reconecte sin ver un error de red."
const STREAM_PING_MS  = 15000;  // "sin bytes en el cable, proxies y antivirus cierran"
```

Y el handler (`:80-153`) manda `Content-Type: text/event-stream`,
**`X-Accel-Buffering: no`** (`:92`, con el comentario de que sin eso un proxy con buffering
convierte el tiempo real en un volcado al final), emite un evento `open` con el cursor, empuja
solo lo nuevo (`id > lastId`), y al llegar al tope manda un evento **`bye`** para que el cliente
sepa que es un cierre planificado y reconecte **sin backoff** (`:110-120`).

**[HECHO] El cliente de ese stream no usa `EventSource`, y por una razón de seguridad
documentada** (`:67-79`): *"EventSource no admite cabeceras, así que la única forma de
autenticarlo sería meter el Bearer en el query string, donde queda en logs de acceso e
historial. Con fetch el token viaja en Authorization como el resto del panel."* La
implementación está en `web/public/windows-live.js:1233-1330`: `fetch()` + `res.body.getReader()`,
parseo de frames, reconexión inmediata al `bye`, backoff escalonado ante caída
(`STREAM_BACKOFF_MS`), y **degradación automática a polling cada 2500 ms** si el stream no se
sostiene (`fallbackToPolling`, `:1324-1330`).

**[HECHO] WebSockets sí son posibles en Vercel, pero no resuelven el problema.** La documentación
oficial (consultada vía MCP) expone `experimental_upgradeWebSocket` de `@vercel/functions` y el
patrón con `ws`, **y en la misma página incluye "Implement WebSocket Reconnection Logic"** con
backoff exponencial explícitamente *"to handle connection closures when Vercel Functions reach
their maximum duration"*. Es decir: **la conexión sigue acotada por `maxDuration`**, y vive en
una instancia concreta de la función, así que difundir un mensaje a otra instancia exigiría un
pub/sub externo.

> **Conclusión de infraestructura:** en este despliegue, un WebSocket "persistente" **no existe**.
> SSE y WebSocket tienen la *misma* limitación (el techo de la función) y la misma necesidad de
> reconexión. Lo único que cambia es la sintaxis. **Por lo tanto la decisión de transporte no debe
> tomarse por "tiempo real vs. no tiempo real", sino por durabilidad y recuperabilidad** — y ahí
> la cola en Postgres gana con claridad.

**[HECHO] Hay un límite de tasa que puede morder, y es un riesgo concreto.** `web/server.js:307-309`:

```js
const apiLimiter = rateLimit({ windowMs: 60*1000, limit: 120, ... });
app.use('/api', apiLimiter);
```

y `web/server.js:97`: `app.set('trust proxy', process.env.VERCEL ? 1 : false)`. Con `express-rate-limit`
la clave por defecto es la **IP del cliente**, y con `trust proxy = 1` en Vercel esa IP sale de
`X-Forwarded-For`.

**[INFERENCIA con consecuencia práctica]** Todos los computadores de un hospital detrás del mismo
NAT presentan **una sola IP de salida**. Con polling cada 2 s cada instalación consume ~30
peticiones/minuto; **cuatro instalaciones en el mismo hospital agotan las 120/min** y empiezan a
recibir `429` — incluido el tráfico clínico del navegador, que comparte el mismo limitador porque
está montado en `/api` a secas. **Esto hay que resolverlo antes de elegir un intervalo de polling
agresivo** (ver §7.6 y la recomendación de long-poll, que reduce las peticiones por dispositivo
en un orden de magnitud).

**[HECHO] El cuerpo admitido es amplio:** `web/server.js:196` → `bodyParser.json({ limit: '16mb' })`.
Una nota clínica completa (`note_json` + texto renderizado) entra sin problema.

---

## 4. Flujo actual entre frontend y backend

### 4.1 Qué conexión existe, exactamente

**[HECHO] Cliente HTTP único y centralizado.** `lib/api/clinical.ts` es el único punto de salida
clínico del frontend. Sus reglas están escritas en la cabecera del archivo (`:1-13`):

> - Todas las llamadas clínicas pasan por aquí (nada de `fetch` sueltos en componentes) y llevan
>   `Authorization: Bearer <token Supabase del usuario>`.
> - El frontend **NUNCA** habla directo con Supabase para `clinical_templates` / `clinical_encounters`,
>   y **NUNCA** usa la service-role key.
> - Los errores del backend (`{ error: { code, message } }`) se normalizan a `ClinicalApiError`.
> - **No se imprimen transcripciones ni notas (PHI) en consola.**

**[HECHO] Mecánica:** `apiBaseUrl()` (`:444-450`) exige `NEXT_PUBLIC_API_BASE_URL` o lanza
`API_NOT_CONFIGURED`; `getAccessToken()` (`:452-460`) saca el `access_token` de la sesión Supabase;
`buildClinicalRequest()` (`:415-438`) es una función **pura y testeable** que arma URL + `RequestInit`;
`clinicalRequest<T>()` (`:466-508`) ejecuta, normaliza errores y **loguea sin PHI**: solo
`método, ruta, status, código` (`:498`).

**[HECHO] Inventario de endpoints que Notes consume hoy** (todos en Graph):

| Función en `lib/api/clinical.ts` | Método y ruta | Línea |
|---|---|---|
| `getClinicalTemplates` | `GET /api/clinical/templates?specialty=` | 514 |
| `getClinicalTemplate` | `GET /api/clinical/templates/:id` | 524 |
| `createClinicalTemplate` | `POST /api/clinical/templates` | 533 |
| `updateClinicalTemplate` | `PUT /api/clinical/templates/:id` | 543 |
| `archiveClinicalTemplate` | `DELETE /api/clinical/templates/:id` (soft delete → `archived`) | 555 |
| `createClinicalEncounter` | `POST /api/clinical/encounters` | 566 |
| `getClinicalEncounter` | `GET /api/clinical/encounters/:id` | 575 |
| `saveClinicalTranscript` | `POST /api/clinical/encounters/:id/transcript` | 584 |
| `generateClinicalNote` | `POST /api/clinical/encounters/:id/generate-note` | 594 |
| `saveEditedClinicalNote` | `PUT /api/clinical/encounters/:id/note` | 603 |
| `updateClinicalEncounterPatient` | `PATCH /api/clinical/encounters/:id/patient` | 614 |
| `createClinicalTemplateDraftFromExample` | `POST /api/clinical/templates/draft-from-example` | 625 |
| `savePrivateEncounterNotes` | `PUT /api/clinical/encounters/:id/private-notes` | 635 |
| `regenerateClinicalEncounterWithTemplate` | `POST /api/clinical/encounters/:id/regenerate-with-template` | 645 |
| `sendAssistantChat` | `POST /api/clinical/assistant/chat` | 700 |
| `adjustNoteWithAssistant` | `POST /api/clinical/assistant/note-adjustment` | 725 |

**[HECHO] Lado servidor de Graph:** `web/api/registerClinicalRoutes.js` implementa esas rutas.
Detalle relevante para Operations: `resolveDoctorId(req)` (`:22-28`) toma
`req.clinicalUser.id` y, si no es un UUID (caso dev local), deriva un UUID estable por SHA-256
(`stableUuidFromString`, `:11-20`). Toda operación sobre un encounter pasa por
`encounterService.getOwnedEncounter(...)` con ese `doctorId` → **la propiedad ya está verificada
en el backend**, no solo por RLS.

### 4.2 El segundo patrón, que es el más importante para Operations

**[HECHO] Notes también llama a Graph desde el servidor, con la API key de plataforma.** Dos rutas
existentes lo hacen, y son el precedente exacto que necesita el flujo de trabajos:

`app/api/stt/session/route.ts` — cabecera del archivo (`:7-17`):
> El backend Miracle autentica `POST /api/v1/transcription/session` con la API key de plataforma
> (`MIRACLE_API_KEY`) — **un secreto que jamás puede llegar al navegador**. Esta ruta la guarda
> server-side y solo entrega la sesión […] a médicos con sesión Supabase.

Y la implementación (`:19-50`): `requireApiUser()` → `rateLimit('stt:'+userId, 10)` →
`fetch(base + '/api/v1/transcription/session', { headers: { 'X-API-Key': apiKey } })` con
`AbortSignal.timeout(20_000)`.

`app/api/clinical/note-from-photo/route.ts` (`:206-235`) hace lo mismo contra
`/api/v1/biopsy/extract`, con dos detalles notables:
- `AbortSignal.timeout(55_000)` con el comentario *"Un poco por debajo del maxDuration (60 s) para
  devolver un error limpio antes de que Vercel mate la función"* → el equipo ya razona en términos
  del techo de 60 s.
- `503` de Graph se traduce a `{ connected: false }` y la UI **degrada a relleno manual** en vez de
  romperse. **Ese es el patrón de degradación que Operations debe copiar.**

**[HECHO] Guardas reutilizables:** `lib/api/guard.ts` expone `requireApiUser()` (valida la sesión
vía `supabase.auth.getClaims()`) y `rateLimit(key, limit)` con **doble barrera**: un `Map` en
memoria por instancia más un contador durable en Postgres (`rpc('check_rate_limit')`), con el
razonamiento explícito de que *"el Map solo no sirve en Vercel: cada cold start lo pierde y el tope
real se multiplica por el número de instancias"* (`:45-52`), y **fail-open** ante error del
limitador porque *"el flujo clínico no debe caerse porque el limitador tenga un problema"*.

### 4.3 Dónde se guarda la nota, y en qué estructura

**[HECHO] Hay DOS representaciones de la misma nota, en dos tablas, con el MISMO id.** Esto es
central para el diseño de la cola.

**(a) `clinical_encounters` — propiedad de Graph.** Definida en
`Graph/supabase/migrations/20260710042652_clinical_note_engine.sql` (sección 2):

```sql
create table if not exists public.clinical_encounters (
  id                uuid primary key default gen_random_uuid(),
  doctor_id         uuid null,
  patient_id        text null,                              -- ¡TEXT, no FK!
  consultation_type text not null,                          -- presencial|telemedicina|audio_upload
  consent           boolean not null default false,
  template_id       uuid null references public.clinical_templates(id),
  template_snapshot jsonb not null,                         -- copia congelada
  status            text not null default 'created',
  transcript        text default '',
  note_json         jsonb null,
  created_at timestamptz, updated_at timestamptz,
  constraint clinical_encounters_status_check check (status in
    ('created','recording','transcript_ready','note_generating','note_generated','completed','failed'))
);
```
RLS activado; `grant all ... to service_role`; políticas de lectura/escritura por `auth.uid() = doctor_id`.

**(b) `consultations` — propiedad de Notes.** Definida en
`Pagina-web-clientes-final/supabase/migrations/20260628000000_multi_tenant_organizations.sql:126-143`:

```sql
create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org() references public.organizations(id),
  medico_id  uuid not null default auth.uid() references auth.users(id),
  patient_id uuid references public.patients(id) on delete set null,
  servicio text, especialidad text,
  tipo   text not null default 'presencial',
  estado text not null default 'borrador',
  motivo text, fecha timestamptz, duracion_min int, plantilla text, resumen text,
  note       jsonb not null default '[]'::jsonb,
  codigos    jsonb not null default '[]'::jsonb,
  transcript jsonb not null default '[]'::jsonb,
  firma      jsonb,
  created_at timestamptz
);
```

**[HECHO] El puente entre las dos usa el mismo id, a propósito.**
`lib/clinical/encounter-to-consultation.ts:10-12`:
> **Regla de identidad:** la consulta usa el **MISMO id** que el encounter, así el puente es 1:1,
> idempotente (re-guardar actualiza, no duplica) y navegable (`/app/consultas/<encounter_id>`).

La función `encounterToConsultation()` (`:91-114`) construye la fila espejo: `estado: "borrador"`,
`plantilla: snapshot?.name`, `especialidad: specialtyDisplayName(snapshot?.specialty)`,
`note: noteJsonToSections(note)` (`:42-50`, aplana `note_json.sections` a `{id,titulo,kind:'texto',texto}`),
`motivo: deriveMotivo(note)` (`:64-70`, saca la sección que hace match con `/motivo/i` o cae al `summary`).

**[HECHO] Forma exacta de `note_json`** — `lib/api/clinical.ts:45-91`:

```ts
interface ClinicalNoteJson {
  summary: string;
  sections: { key: string; label: string; content: string;   // "Campo principal del
              confidence?: number; evidence?: string }[];     //  contenido. Nunca usar
  discharge?: {                                               //  value/text/body."
    plan: { medications: { name, dose?, route?, frequency?, duration?, instructions?, evidence? }[];
            non_pharmacological: { text, evidence? }[];
            follow_up:           { text, evidence? }[] };
    recommendations: { text, evidence? }[];
    alarm_signs:     { text, evidence?, urgency?: 'emergency'|'priority'|'monitor' }[];
  };
  warnings: string[];
  missing_required_sections: string[];
}
```

`discharge` está marcado como *"Older notes may not have this until re-saved; use
`ensureClinicalDischarge` in UI"* (`:87`) — hay una función de compatibilidad (`:383-406`) que
rellena la estructura vacía. **Operations debe usar la misma normalización**, no asumir que
`discharge` viene.

**[HECHO] `template_snapshot` ya resuelve el problema de las plantillas históricas.**
`src/application/use-cases/ClinicalEncounterService.js:~35-45` (`buildTemplateSnapshot`) congela
`{template_id, name, specialty, description, scope, is_default, sections, snapshot_at}` **en el
momento de crear el encounter**, y `createEncounter` (`:47-80`) lo persiste en la columna
`template_snapshot jsonb not null`. Tipo en `lib/api/clinical.ts:98-107`.
**Editar la plantilla después NO cambia la nota histórica.** Esa pieza ya está hecha y es correcta.

### 4.4 El momento exacto en que una nota está terminada (hay dos, y importan los dos)

**[HECHO] Momento A — Graph: `status = 'completed'`.**
`ClinicalEncounterService.saveEditedNote()` (`~:123-135`) valida la nota contra el
`template_snapshot` (`noteValidationService.validateEditedNote`) y persiste con `status: 'completed'`.
Es el `PUT /api/clinical/encounters/:id/note`. **Es la nota clínica final desde el punto de vista
del motor.**

**[HECHO] Momento B — Notes: `estado = 'aprobada'` con firma.** Este es **el disparador correcto
para la automatización.** `app/app/consultas/actions.ts:20-96` (`signConsultationNote`, server action):

1. `getCurrentProfile()` valida la sesión (`:23-24`).
2. Lee `estado` y sólo continúa si es `borrador` o `revisada` (`:36-38`).
3. **Re-verificación server-side de que no es una consulta de demostración** (`:42-52`): cuenta
   `audit_events` con `accion = DEMO_AUDIT_ACCION`; si hay, rechaza — *"el bloqueo en la UI no es
   suficiente por sí solo"*.
4. **Calcula un SHA-256 del contenido firmado** (`:56-64`):
   ```ts
   const contentHash = createHash("sha256")
     .update(JSON.stringify({ note: consultation.note,
                              resumen: consultation.resumen,
                              codigos: consultation.codigos })).digest("hex");
   const firma = { por, fecha, hash: contentHash };
   ```
   con el comentario *"El hash completo queda en la firma (atadura contenido↔firma)"*.
5. **UPDATE condicional por estado** (`:69-86`): `.update({estado:'aprobada', firma})
   .eq('id',...).in('estado',['borrador','revisada'])` — si otra sesión firmó en medio, afecta 0
   filas y **no pisa esa firma**. Es un compare-and-swap correcto.
6. Inserta `audit_events` con `accion: "Nota aprobada y firmada"` y el prefijo del hash (`:88-93`).

**[HECHO] Y desde ese momento la fila es inmutable por trigger de base de datos.**
`supabase/migrations/20260721000000_consultation_immutability_and_addenda.sql:15-53` define
`private.enforce_consultation_immutability()`, un trigger `before update` que, si
`old.estado in ('aprobada','exportada')`:
- permite **una sola** transición de estado: `'aprobada' → 'exportada'`;
- rechaza cualquier cambio en `note, resumen, codigos, transcript, firma, patient_id, medico_id,
  organization_id, fecha, motivo, servicio, especialidad, tipo, plantilla, duracion_min`
  con `CONSULTATION_IMMUTABLE`.

Compara **valores** (`is distinct from`), no columnas presentes, *"los updates del cliente que
reenvían el mismo contenido (p. ej. `persist()` al exportar) pasan sin fricción"*. Las correcciones
van en `consultation_addenda`, append-only (solo `select` + `insert`, sin policies de update/delete).

**[HECHO] Y el estado de destino de la automatización YA EXISTE, y hoy lo marca una persona.**
`supabase/migrations/20260723010000_secretary_mark_exported.sql` — RPC `security definer`
`public.secretary_mark_exported(p_consultation_id uuid)`. Su cabecera dice literalmente:

> La secretaria necesita poder marcar que **YA subió una nota aprobada al sistema propio del
> hospital** (estado `"exportada"`).

y el cuerpo sólo transiciona `estado = 'aprobada' → 'exportada'` para una consulta de un médico que
la secretaria tenga asignado en `secretary_doctor_access`, sin poder tocar nota, códigos ni
aprobación. Tipos y etiquetas en `lib/mock/types.ts:7-12` y `:114-120`:

```ts
type ConsultationStatus = "en_curso" | "borrador" | "revisada" | "aprobada" | "exportada";
STATUS_LABEL = { …, aprobada: "Aprobada", exportada: "Exportada" };
```

> **Este es el hallazgo de producto más importante del análisis.** El flujo
> `Miracle Notes → Graph/Windows → SAP/HIS` no es una función nueva: es **la automatización de un
> paso manual que ya está modelado, con su estado, su RPC, su control de acceso y su etiqueta en la
> UI**. La automatización debe terminar produciendo exactamente esa transición
> `aprobada → exportada`, y el trigger de inmutabilidad ya la permite (y sólo permite esa).

### 4.5 Identificadores disponibles hoy

| Concepto | Identificador | Dónde vive | Estado |
|---|---|---|---|
| Consulta / encuentro | `uuid` — **el mismo** en `clinical_encounters.id` y `consultations.id` | ambas tablas | **[HECHO]** listo, 1:1 |
| Médico | `auth.users.id` (uuid) → `clinical_encounters.doctor_id` y `consultations.medico_id` | ambas | **[HECHO]** listo |
| Paciente | `consultations.patient_id` **uuid FK** → `patients.id`; `clinical_encounters.patient_id` **text, sin FK, nullable** | divergen | **[HECHO]** inconsistente (ver §7.3) |
| Plantilla | `template_id uuid` + `template_snapshot jsonb` con `snapshot_at` | `clinical_encounters` | **[HECHO]** listo e inmutable |
| Hospital / tenant | `consultations.organization_id` uuid FK → `organizations` | **solo en Notes** | **[HECHO]** **falta en `clinical_encounters`** → Graph hoy no sabe de qué hospital es un encounter (ver §7.2) |
| Dispositivo Windows | `graph_windows_users.email` (PK) + `last_install_id` | Graph | **[HECHO]** débil: email sin contraseña, `install_id` no es clave (ver §7.1) |
| Corrida de automatización | `graph_windows_events.run_id` (text, correlaciona una corrida) | Graph | **[HECHO]** existe y es reutilizable |
| Trabajo de automatización | — | — | **[HECHO] NO EXISTE** |

### 4.6 Qué hay de tiempo real en Notes hoy: nada

**[HECHO]** Búsqueda de `realtime`, `.channel(`, `EventSource`, `WebSocket` en `app/`, `lib/`,
`components/`: los únicos aciertos son `WebSocket` en `lib/stt/transcribe-audio-file.ts:74` y en el
comentario de `app/api/stt/session/route.ts:15`, y ambos son el **socket del navegador directo al
proveedor de STT** (Soniox/Deepgram), no a un backend propio. **Cero `.channel(`, cero Supabase
Realtime, cero SSE.**

**[HECHO] El estado se lee de una carga acotada al montar.** `app/app/providers.tsx:126-131`:
`CONSULTATIONS_CAP = 300`, `PATIENTS_CAP = 500`, con el comentario *"Topes de la carga inicial del
store (bounded load)"*. Las actualizaciones se propagan por `revalidatePath` desde server actions,
no por push.

**[HECHO] `upsertConsultation` (`:596-630`) ya protege la nota firmada:** si la fila existente está
en `aprobada` o `exportada`, **rechaza** y avisa *"Esta nota ya está firmada. Los cambios van como
adenda."*; y las filas existentes se actualizan **en parcial (sin estado ni firma)** — *"el puente
nunca degrada una nota firmada"*.

**[HECHO] Componentes que mostrarían el estado de Operations (ya existen y son el sitio natural):**
- `components/app/StatusBadge.tsx` — badge de estado, tono derivado de `statusTone(estado)`.
- `components/app/NotificationsBell.tsx:25-29` — campana que hoy cuenta `borrador`/`revisada`
  como "pendientes de revisión". Extensible a "pendientes de registrar en el HIS".
- `app/app/consultas/[id]/page.tsx` (1149 líneas) — detalle de la consulta: donde vive la firma y
  donde iría el panel de automatización.
- `app/app/configuracion/ConfiguracionForm.tsx:68-77` — **ya hay un slot vacío**:
  ```tsx
  <IntegrationRow name="Sistema de historia clínica (HIS/HCE)" status="no"
    onConnect={() => showToast("La conexión con el HIS se habilita durante el piloto.", "info")} />
  ```
  **[RECOMENDACIÓN]** Ese es el lugar para emparejar dispositivo + elegir tipo de HIS.

---

## 5. Funcionamiento actual de Graph Windows

### 5.1 Lo que el cliente Windows ya hace contra Graph (cuatro cosas, todas salientes)

**[HECHO] (a) Registro / heartbeat del dispositivo.**
`POST /api/v1/agent/register` → `registerWindowsTelemetryRoutes.js:16-24` →
`WindowsTelemetryService.register()` (`:76-104`). Hace **upsert por email** (select-then-update/insert,
sin abrir RLS) sobre `graph_windows_users`, guardando:
`display_name, owner_id (= email), last_install_id, app_id (default 'windows-u'), app_version,
machine_name, os_version, first_seen_at, last_seen_at`.

Esquema en `Graph/supabase/migrations/20260722120000_windows_live_users_and_events.sql`, cuya
cabecera fija **la regla de topología más importante del sistema**:

> A diferencia de Android (que escribe directo a Supabase con la anon key + RLS), **el cliente
> Windows habla SOLO con el backend Graph (`/api/v1`, `X-API-Key`), y es Graph quien escribe aquí
> con service-role.** Por eso estas tablas tienen RLS activado **SIN políticas** para
> `anon`/`authenticated`: ningún cliente las toca directo; el backend (service-role) las salta.
>
> **Identidad canónica = EMAIL** (el usuario da nombre+correo al instalar). Si el correo se repite
> (reinstalación u otra máquina) es el MISMO usuario: `register` hace upsert por email.
> **Sin contraseña por ahora.**

**[HECHO] (b) Ingesta de eventos por lotes.**
`POST /api/v1/agent/events` → `WindowsTelemetryService.ingestEvents()` (`:109-155`). Acepta
`{email, installId, events[]}`, **capa el lote en `MAX_EVENTS_PER_BATCH = 200`** (`:16`), filtra los
que no traen `kind`, normaliza camelCase/snake_case, refresca el heartbeat **best-effort** (con
`try/catch` vacío y el comentario *"el usuario podría no haberse registrado aún; los eventos igual
se guardan"*), e inserta en `graph_windows_events`:

```sql
create table public.graph_windows_events (
  id bigint generated always as identity primary key,   -- cursor monotónico
  email text not null, install_id text not null default '',
  kind  text not null,          -- conscious_run_start|analyze|action|conscious_run_end
                                -- workflow_start|workflow_step|workflow_end | mcp | log
  phase text not null default '',   -- start | end | ok | error | skipped
  app_id text, surface_url text, workflow_id text,
  run_id text not null default '',  -- correlaciona todos los eventos de una corrida
  label  text not null default '',
  detail jsonb not null default '{}'::jsonb,   -- "Payload libre para cualquier dato extra"
  client_at  timestamptz,       -- cuando ocurrió en la máquina del usuario
  created_at timestamptz not null default now()
);
```
con índices `(email, id desc)`, `(run_id, id)`, `(email, app_id, id desc)`.

La migración presume de extensibilidad: *"Pensado para colgar cualquier métrica futura sin cambiar
el esquema: basta un `kind` nuevo y payload en `detail`."*

**[HECHO] La telemetría nunca debe tumbar al agente.** `registerWindowsTelemetryRoutes.js:5-7`:
*"La telemetría NUNCA debe tumbar al agente: los errores se responden con su código pero el cliente
los traga."* **[RECOMENDACIÓN]** El reporte de progreso de un trabajo **no puede** heredar esa
semántica: si el reporte terminal se pierde, el trabajo queda huérfano. Hay que distinguir
"telemetría best-effort" de "transición de estado confirmada" (ver §16.2).

**[HECHO] (c) El bucle del agente consciente — el cliente conduce, Graph decide.**
`POST /api/v1/agent/turn` → `AgentTurnService.handleTurn()`. La cabecera del archivo
(`src/application/use-cases/AgentTurnService.js:1-23`) define el reparto:

> El bucle completo (capturar pantalla → decidir → ejecutar → repetir) **lo conduce el CLIENTE
> Windows**; aquí solo se resuelve cada turno de forma **stateless**: la decisión (brain) vive en el
> servidor, la ejecución (gestos/MCP) vive en el cliente. El contrato `Action[]`/`BrainTurn` es la
> costura y es **SAGRADO**: mismos nombres de campos JSON que `Protocol.cs` del cliente.

Contrato (espejo de `windows-client/src/Domain/Protocol.cs`, citado en `:10-16`):
```
Request : { session?, goal?, userId?, state{screen,uiContext,width,height,screenshot?,apps?,
            surfaceId?,surfaceOrigin?,surfacePathname?}, results?[], inform? }
Response: { session, actions[], question?, done, text, needsScreenshot, narration, speech?, intents[] }
          | { error }
```
La sesión viaja como **blob opaco** que el cliente devuelve (`encodeSession`/`decodeSession`,
`:89-93`) → el servidor no guarda estado entre turnos. Matriz de códigos: `400` request inválido,
`500` provider sin configurar, `502` error del cerebro (`:74-79, 131-133`).

> **[HECHO] Consecuencia clave:** el modelo *"el cliente pregunta, el servidor responde, el cliente
> ejecuta"* **ya está implementado, en producción, y es la costura que el equipo declara sagrada.**
> Una cola con `claim` es exactamente el mismo patrón aplicado a un objeto distinto. **No es un
> cambio de arquitectura: es un uso más de la arquitectura que ya existe.**

**[HECHO] (d) Enseñanza por video.** `POST /api/v1/teach/{upload-token,file-state,process-video}`
→ `TeachVideoService`, consumido por `windows-client/src/Teach/TeachSession.cs`
(`registerWindowsAgentRoutes.js:29-44`). Los tres son POST *"así los llama TeachSession.cs"*.

### 5.2 Cómo se representan los comandos, las acciones y los flujos

**[HECHO] Tres niveles, ya definidos:**

1. **`Action[]`** — la unidad atómica que el cerebro devuelve por turno. Incluye `kind: 'mcp'` con
   `tool` y `args` (`AgentTurnService.js:122-128`).
2. **`Workflow` / `Step`** — el flujo aprendido, en **Neo4j**. `src/domain/entities/Workflow.js`,
   `Step.js`, `WorkflowBranch.js`; persistencia en
   `src/infrastructure/repositories/Neo4jWorkflowRepository.js`. Según
   `docs/AGENTE-WORKFLOWS-CONTEXTO.md:59-68`: las variables **no se almacenan, se derivan**
   (`inferVariables()`: `input_N`, `target_N`); steps 1-indexed; el step de alineación usa
   `stepOrder: 0`; **`updateFullWorkflow` REEMPLAZA todos los steps** (no toca branches → *no
   reindexar*).
3. **`valueMode` por step** — `fixed | dynamic | flexible` (+ `bindTo`), default `fixed`, clasificado
   por el LLM al terminar la grabación (`WorkflowExecutionGuideBuilder.classifyValueModes`).
   Documentado en `web/public/studio-docs/coincidencia-superficie-estado.md`.

   **[HECHO] Y aquí hay una deuda que afecta directamente a Operations.**
   `docs/AGENTE-WORKFLOWS-CONTEXTO.md:113-115`: *"`dynamic` — valor por-ejecución
   (contexto/usuario); `bindTo` ata a otra variable […]. **La sustitución dinámica por contexto es
   la FASE SIGUIENTE (no implementada).**"* Y `:122-124`: *"`dynamic` + `bindTo` end-to-end:
   clasificado y persistido, pero la sustitución por-ejecución (tomar el valor del contexto del
   chat / de otro step) **no corre aún**. Es el próximo gran paso."*

   > **Esto es la pieza técnica que Operations necesita y que todavía no existe.** Meter una nota
   > clínica en SAP **es** sustitución dinámica por contexto: el `input` del campo "motivo de
   > consulta" tiene que tomar su valor del `note_json` de este encounter, no del valor que se grabó
   > al enseñar. Ver §7.5.

**[HECHO] Exposición al LLM vía MCP.** `web/api/registerMcpRoutes.js` — `POST /api/v1/mcp`,
JSON-RPC 2.0 **stateless**: `initialize`, `tools/list`, `tools/call`. Y el detalle decisivo
(`docs/AGENTE-WORKFLOWS-CONTEXTO.md:75-77`): *"`tools/call` (**devuelve el PLAN; Graph nunca
ejecuta**). Superficie por headers `X-Surface-Origin`/`X-Surface-Pathname`."*
`AgentTurnService.assembleTools()` (`:59-68`) arma el catálogo del turno: base + herramientas
aprendidas + **workflows de la superficie actual**, e inyecta `workflow_id` en los args porque *"el
nombre MCP (`workflow_*`) es para el modelo; el cliente ejecuta por id"*.

**[HECHO] Plan de ejecución explícito por HTTP:** `POST /api/v1/workflows/:id/plan` →
`workflowExecutor.getExecutionPlanById(id, variables, execution_intent, access)`
(`registerPublicApiRoutes.js:590-609`). **Acepta un objeto `variables`** — es el gancho natural para
inyectar los valores de la nota.

### 5.3 Ejecución en la máquina: qué existe y qué falta para SAP/HIS

**[INFERENCIA — desde `docs/AGENTE-WORKFLOWS-CONTEXTO.md:83-97` y los `studio-docs`, no desde el
código del cliente]**

- **`windows-graph/src/WorkflowPlayer.cs`** — pide el plan, verifica la superficie
  (`SurfaceMismatch`), **se alinea conscientemente** si no está ahí (`Aligner` →
  `AppAligner.EnsureAsync`: enfocar o lanzar la app y confirmar con el locator), y **aprende**: si
  se alineó, llama a `PrependAlignmentStepAsync` y Graph antepone un step `app:<proc>` en orden 0,
  idempotente. Ese endpoint sí es verificable:
  `POST /api/v1/workflows/:id/prepend-alignment` (`registerPublicApiRoutes.js:548-588`), que además
  cortocircuita si el primer step ya empieza por `app:` → `{already_present: true}`.
  **[HECHO] Es un ejemplo de idempotencia bien hecha que conviene imitar.**
- **Superficies** — `windows-graph/src/Surfaces/`: `UiaSurface` (UI Automation, selectores
  `uia:aid=…;ct=…` / `name=` / `path=`) y **`SapGuiSurface` (SAP GUI Scripting, selectores `sap:`,
  identidad `sapgui://SID/TCODE`)**. `IUiSurface` es la abstracción; el player reelige superficie
  por step.
- **Localización — "el URL de Windows"** — `windows-client/src/Uia/SurfaceLocator.cs`: ID jerárquico
  de dónde está parado el usuario: `uia://proceso.exe/titulo-slug`, `web://dominio/ruta`,
  **`sapgui://SID/TCODE`**. Es el mismo formato que `source_url` de los workflows → scoping,
  mismatch y alineación comparten eje. Viaja en cada turno como
  `ScreenState.surfaceId/Origin/Pathname`.
- **Logs locales** — `windows-client/src/Diagnostics/LogBus.cs:22`, `LogBus.Log(tag, mensaje)` con
  tags reales `inspector | sap | uia | nav | align | workflow | workflow-ui | teach | update |
  telemetry | fatal | onboarding | unobserved-task`.
  **[HECHO]** `src/domain/windowsEngines.js:18-23` dice que ese bus es **EN MEMORIA** y su único
  suscriptor es la ventana local: *"nada de eso sale de la máquina. El puente LogBus → telemetría
  (`kind='log'`, `detail.tag=<tag>`) es lo que enciende estas tabs con datos reales."*

**[HECHO] ¿Existe ya lógica SAP/HIS? Sí, parcial, y el propio repo dice qué falta.**
`src/domain/windowsEngines.js:42-51` declara el motor `sapgui` ("Escaneo SAP GUI", tags `['sap']`,
kinds `['sap_scan']`, `appIds: ['sap','saplogon','saplgpad']`), hay un documento dedicado
(`web/public/studio-docs/motor-escaneo-sapgui.md`, ~288 líneas), y
`docs/AGENTE-WORKFLOWS-CONTEXTO.md:130-132` fija el estado real:

> **SAP**: el árbol de lectura ya añade SAP GUI Scripting al UiContext (`SapContextReader`, gate:
> proceso `sap*`); scripting habilitado en server y cliente del usuario. **Falta probar
> grabación/ejecución real de workflows SAP en su máquina.**

**[HECHO] ¿Existe ya forma de mapear una plantilla a campos del sistema? Sí — y esto es un activo
grande.** `src/application/use-cases/NoteFieldMatcher.js` + `NoteFieldMatchingPolicy.js`, expuesto
por `POST /api/v1/autofill/match` (`registerPublicApiRoutes.js:266-313`) y como etapa `autofill` de
`POST /api/v1/pipeline` (`:212-261`).

- **Entrada:** `noteContent` (texto/markdown) + `fields[]` **que aporta el cliente**, cada uno con
  `{stepOrder, actionType, label, selector, controlType, allowedOptions[], currentValue}` — máximo
  60 campos, 80 opciones por campo (`NoteFieldMatcher.js:19-28`).
- **Salida:** `matches[{stepOrder, value, confidence, evidence}]` + `readyToSubmit` + `submitReason`.
- **[HECHO] Umbral de confianza duro:** `normalizeResult` (`:44-59`) descarta todo match con
  `confidence < 0.75` o `value === ''`.
- **[HECHO] La política del prompt** (`NoteFieldMatchingPolicy.js:4-5`) dice: *"You receive a
  free-text clinical note (markdown) and a list of **pending form fields** from a workflow on the
  current page. Your job: for each field where the note contains an explicit value or a
  high-confidence derived value, output a match so the assistant can fill that field immediately."*

> **Respuesta directa a "¿dónde vive el mapeo?":** hoy vive **partido, y bien partido**. El
> **inventario de campos** lo produce el cliente (lee la pantalla real: UIA/SAP) y la
> **correspondencia nota→campo** la decide Graph con un LLM. Miracle Notes **no participa** en el
> mapeo, y no debería: no sabe nada del HIS. Ver §16.4.

### 5.4 Errores, reintentos, cancelación y "cómo sé que terminó" — hoy

**[HECHO]**
- **Errores:** matriz HTTP declarada "sagrada" en `agent/turn` (400/500/502). En telemetría, los
  errores se responden pero *el cliente los traga*.
- **Veredicto de una acción:** derivado, no almacenado. `src/domain/windowsEngines.js:167-184`
  (`outcomeForEvent`) devuelve `'ok' | 'error' | 'skipped' | null` a partir de `phase`, o
  `detail.outcome`, o `detail.level in ('error','fatal')`. **`null` es significativo**: *"este evento
  no es un intento medible […] y por tanto NO entra en el denominador del porcentaje de éxito.
  Contar los `start` como éxitos inflaría el marcador."*
- **"Terminó":** se infiere de un evento `workflow_end` / `conscious_run_end` correlacionado por
  `run_id`. **No hay una transición de estado confirmada ni un registro terminal.**
- **Reintentos:** **[HECHO] no existen** a nivel de sistema. `WorkflowPlayer` tiene tolerancia
  *dentro* de una ejecución (`flexible`: exacto → aproximado → saltar sin romper), y colapsa runs de
  `input` consecutivos al mismo selector, pero no hay reintento de una unidad de trabajo.
- **Cancelación:** **[HECHO] no existe** para una ejecución en curso.
  `docs/AGENTE-WORKFLOWS-CONTEXTO.md:135` lista como pendiente *"Reinicio en caliente de la
  enseñanza (🔄): `WorkflowTeachSession.RestartAsync` no existe aún"*.
- **Precedente de estados que sí existe:** `graph_prompts` (Android) tiene
  `status text check (status in ('running','ok','error','cancelled'))` + `started_at`/`finished_at` +
  `device_id` FK (migración `20260719120000`). **[RECOMENDACIÓN]** Es el molde más cercano a lo que
  hace falta, pero le faltan `attempts`, `lease`, `idempotency_key` y estados parciales.

### 5.5 Almacenamiento local y cola interna en el cliente

**[INFERENCIA]** Hay **configuración** local confirmada: `%APPDATA%\U\graph.json` guarda la API key,
con prioridad `graph.json > env GRAPH_API_KEY > key embebida`
(`studio-docs/distribucion-app-conectada.md:28-30`), y `docs/AGENTE-WORKFLOWS-CONTEXTO.md:31-32` lo
confirma. Hay **encolado en memoria** durante la grabación: `WorkflowRecorder` *"observa la
superficie (evento `StepObserved`), **encola** y manda steps"* (`:53-55`), y `ingestEvents` acepta
lotes de hasta 200, lo que sugiere que el cliente acumula antes de enviar.

**[PREGUNTA]** **No hay evidencia de una cola local durable** (que sobreviva a un cierre de la app o
a una caída de red prolongada). Es una pregunta directa para el equipo y una pieza probablemente
necesaria (§18, Fase 2).

### 5.6 Distribución y la identidad del dispositivo — el problema de seguridad

**[HECHO]** `web/public/studio-docs/distribucion-app-conectada.md` describe el modelo actual:
`GraphWorkflows.csproj` declara `AssemblyMetadata GraphDefaultApiKey` **vacía por defecto**; el CI
(`.github/workflows/windows-release.yml` del repo `windows-app`) exporta `GraphDefaultApiKey` desde
el secreto `GRAPH_DEFAULT_API_KEY` y MSBuild la **hornea en `U.Graph.dll`**. Resultado: descargar →
instalar → funciona, cero pasos para el usuario.

Y el propio documento cierra con el límite (`:52-58`):

> La key embebida es **una sola, compartida** por todas las instalaciones, y **queda en el binario
> (descompilable)**. Mitigado: es revocable/rotable desde Provider Studio. Pero para tener
> **identidad por instalación** (revocar/atribuir uso por dispositivo, y que una key filtrada no
> comprometa a todos) viene la mejora de **autenticación interna**.

**[HECHO] Y ese plan ya está escrito, decidido y sin implementar.**
`web/public/studio-docs/autenticacion-interna-plan.md` — *"Estado: **planificado, no implementado**"*.
Evaluó tres opciones y eligió la tercera:

1. Login de usuario (email/SSO) — *rechazado por ahora*: rompe el "cero config".
2. Firmar cada request (HMAC/mTLS) — *rechazado*: el secreto sigue siendo compartido y descompilable.
3. **Enrolamiento por instalación (device provisioning) — ELEGIDO.**

Flujo decidido (`:31-40`): primer arranque → device id estable (hash de máquina, en `graph.json`) →
`POST /api/v1/enroll` con la **key de enrolamiento embebida de bajo privilegio** (lo único que puede
hacer es dar de alta un dispositivo) → Graph valida (rate-limited), crea/actualiza el registro y
emite un **token per-install** en tabla **`graph_windows_devices`** → el cliente lo usa para todo
`/api/v1` y lo renueva → Provider Studio lista los enrolados y permite **revocar uno** sin tocar a
los demás.

Y el cambio de fondo que exige (`:49-58`): hoy las keys viven en `MIRACLE_API_KEYS` (env de Vercel) y
emitir una **requiere un redeploy** (`ApiKeyService.generate` → `triggerRedeploy`), lo que *"NO sirve
para emitir un token por instalación en caliente"*. Hace falta un `requireApiKey` que acepte **dos
fuentes**: env (admin/enrolamiento) + **DB (per-install)**.

Alcance del primer corte, ya enumerado en el propio doc (`:60-70`): tabla `graph_windows_devices`
(`device_id, token_hash, enrolled_at, last_seen, revoked, label`) + `WindowsDeviceService`;
`POST /api/v1/enroll`; `requireApiKey` dual; device id estable + enrolamiento + renovación en el
cliente; card "Dispositivos Windows" en Provider Studio; la key embebida degradada a scope mínimo.

> **[RECOMENDACIÓN] Esto no es una mejora futura: es la Fase 1 del proyecto Operations.** El diseño
> ya está hecho y consensuado. Construirlo primero desbloquea *"cada instalación de Graph tiene una
> identidad segura"* y *"los comandos solo pueden ser ejecutados por el dispositivo autorizado"*, que
> son dos de los principios de seguridad que pediste. Sin esto, cualquiera que descompile el `.exe`
> puede reclamar los trabajos de cualquier médico.

---

## 6. Código y módulos reutilizables

Ordenados por valor. **[HECHO]** en todos los casos: el código existe y está en producción.

### 6.1 Reutilizable tal cual (copiar el patrón, no reescribirlo)

| # | Activo | Ubicación | Qué aporta a Operations |
|---|---|---|---|
| 1 | **Patrón SSE bajo Vercel, resuelto** | `web/api/registerWindowsPanelRoutes.js:14-153` + cliente `web/public/windows-live.js:1233-1330` | Streaming de estado que ya respeta el techo de 60 s (`STREAM_MAX_MS=50000`), evento `bye` para cierre planificado, `X-Accel-Buffering: no`, cursor `since`/`lastId` sin duplicar ni perder, backoff y **fallback automático a polling 2500 ms**. Es *el* transporte de visualización, ya depurado |
| 2 | **Cursor monotónico + feed extensible** | tabla `graph_windows_events` (migr. `20260722120000`) | `id bigint identity` como cursor, `run_id` para correlacionar una corrida, `phase` para el veredicto, `detail jsonb` para lo demás. La forma del evento de progreso está resuelta |
| 3 | **Derivación de motor y veredicto** | `src/domain/windowsEngines.js:140-272` | `engineForEvent` (prioridad: `detail.engine` > `detail.tag` > `kind` > `app_id` > `otros`), `outcomeForEvent` (`ok|error|skipped|null`, con `null` significativo), `summarizeEngines` (% de éxito **por versión de app**). Aplica igual a "¿cuántos trabajos de registro clínico salen bien, y mejoró con la versión nueva?" |
| 4 | **Precedente de tabla con estados y dispositivo** | `graph_app_users` + `graph_prompts` (migr. `20260719120000`) | `device_id text primary key`, `status check (running|ok|error|cancelled)`, `started_at/finished_at`, índice `(device_id, started_at desc)`, y **upserts vía RPC `security definer`** para no abrir `SELECT` a los clientes. Molde directo de `operations_jobs` |
| 5 | **Registro + ingesta del dispositivo Windows** | `WindowsTelemetryService.js:76-155`, `registerWindowsTelemetryRoutes.js` | Ya existe el canal saliente y su servicio. `claim` y `report` son dos rutas más en el mismo carril `/api/v1`, con el mismo estilo de validación (`normEmail`, `str`, `toIso`, `toDetail`) |
| 6 | **Plan de enrolamiento por instalación** | `studio-docs/autenticacion-interna-plan.md` | Diseño completo y decidido: `POST /api/v1/enroll`, `graph_windows_devices`, `requireApiKey` dual env+DB, revocación por dispositivo. **Implementar, no rediseñar** |
| 7 | **Contrato de la nota, ya estable** | `lib/api/clinical.ts:45-107` (Notes) ↔ `clinical_encounters` (Graph) | `note_json` con `sections[{key,label,content,confidence,evidence}]` + `discharge` + `warnings` + `missing_required_sections`, y `template_snapshot` con `snapshot_at`. **El payload del trabajo ya está definido; no hay que inventar un formato** |
| 8 | **Mapeo nota → campos** | `NoteFieldMatcher.js`, `NoteFieldMatchingPolicy.js`, `POST /api/v1/autofill/match` | El motor de correspondencia ya existe, con umbral `confidence >= 0.75` y `readyToSubmit`. Devuelve `evidence` por match → sirve como registro de "qué campo se llenó y por qué" |
| 9 | **Plan de workflow con variables** | `POST /api/v1/workflows/:id/plan` (`registerPublicApiRoutes.js:590-609`) | Acepta `{variables, execution_intent}`. Es el gancho para inyectar los valores de la nota sin tocar el workflow guardado |
| 10 | **Ejecución + alineación + aprendizaje** | `WorkflowPlayer` (cliente) + `POST /api/v1/workflows/:id/prepend-alignment` | Abrir/enfocar la app objetivo (`SAP`), verificar superficie, y **aprender la alineación de forma idempotente** (`already_present: true`). Cubre "Graph abre o controla SAP/HIS" |
| 11 | **Superficie SAP** | `SapGuiSurface` (cliente), motor `sapgui` en `windowsEngines.js:42-51`, `studio-docs/motor-escaneo-sapgui.md` | SAP GUI Scripting con selectores `sap:` e identidad `sapgui://SID/TCODE`. La capa de bajo nivel contra SAP existe |
| 12 | **Cliente HTTP clínico de Notes** | `lib/api/clinical.ts` (`buildClinicalRequest` puro, `ClinicalApiError`, `CLINICAL_ERROR_MESSAGES`) | Añadir métodos de Operations es extender un archivo, con errores amigables y logging sin PHI ya resueltos |
| 13 | **Rutas servidor Notes → Graph con API key** | `app/api/stt/session/route.ts`, `app/api/clinical/note-from-photo/route.ts` | Patrón exacto para hablar con `/api/v1` sin exponer el secreto, con `AbortSignal.timeout` por debajo del `maxDuration` y **degradación a `{connected:false}`** en vez de romper |
| 14 | **Guardas de Notes** | `lib/api/guard.ts` (`requireApiUser`, `rateLimit` doble barrera memoria+Postgres, fail-open) | Reutilizable directo para la ruta que crea el trabajo |
| 15 | **Firma con hash de contenido** | `app/app/consultas/actions.ts:56-67` | `firma.hash` = SHA-256 de `{note, resumen, codigos}`. **Es la clave de idempotencia natural del trabajo** |
| 16 | **Inmutabilidad + estado destino** | migr. `20260721000000` (trigger) y `20260723010000` (RPC `secretary_mark_exported`) | El trigger ya permite **solo** `aprobada → exportada`; la RPC es el molde de la transición acotada con `security definer` |
| 17 | **Cliente Supabase service-role** | `src/infrastructure/SupabaseRestClient.js` | `select/insert/update` sobre PostgREST con service-role, errores normalizados con `statusCode` y `supabaseCode`. La cola se persiste con esto |
| 18 | **Distribución de la app** | `WindowsAppReleaseService.js`, `registerWindowsDistributionRoutes.js`, `GET /api/windows/latest-installer` (pública) | Ya se puede disparar un build en CI, seguir su estado y servir el instalador vigente. Desplegar una versión con Operations no requiere infraestructura nueva |
| 19 | **Banco de pruebas y panel** | `web/public/windows-lab.html/js/css`, `GET /api/windows/engines`, `/users/:email/stats`, `/users/:email/graph`, `graph_studio_progress` | Panel de logs en vivo por usuario, con tabs por motor y marcador de éxito por versión. Un motor `operations` nuevo es **una entrada en `windowsEngines.js`** y aparece solo (`:39-41`: *"añadir un motor es tocar solo `src/domain/windowsEngines.js`, nunca el front"*) |
| 20 | **Simulador de HIS** | Proyecto Vercel `miracle-his-simulator` | **[INFERENCIA]** Objetivo de pruebas end-to-end sin tocar un hospital real |

### 6.2 Lo que NO sirve para este caso (y por qué)

**[HECHO]**

1. **`MIRACLE_API_KEYS` como identidad de dispositivo.** Es una lista estática en env, la misma para
   toda la flota, horneada en el binario y descompilable. Sirve para "este binario es nuestro"; **no
   sirve para "este trabajo es de este médico en esta máquina"**. Su reemplazo ya está diseñado
   (§5.6).
2. **`graph_windows_users` como registro de dispositivos.** Está **keyed por email** y el upsert es
   por email: *"Si el correo se repite (reinstalación u otra máquina) es el MISMO usuario"* (migr.
   `20260722120000`). Es exactamente lo contrario de lo que hace falta — **necesitamos distinguir
   dos computadores del mismo médico**. `last_install_id` existe pero no es clave ni identidad. Y no
   hay contraseña: *"Sin contraseña por ahora."*
3. **`graph_windows_events` como registro de trabajos clínicos.** Dos razones independientes:
   - **Semántica:** es best-effort por diseño (*"La telemetría NUNCA debe tumbar al agente"*), sin
     transacción ni unicidad. Una transición de estado clínica no puede ser best-effort.
   - **Privacidad:** `detail jsonb` es un payload libre y **el panel admin lo muestra** vía
     `GET /api/windows/users/:email/events` (+ su stream), gated solo por
     `canManageGlobalWorkflows`. Meter contenido de notas por ese feed pondría **PHI en un log
     visible a administradores de plataforma**. Ver §9-R4.
4. **La sesión opaca de `agent/turn` como estado de trabajo.** `encodeSession`/`decodeSession`
   (`domain/agent/session.js`) es deliberadamente **stateless en el servidor**: el estado vive en el
   cliente y viaja en cada request. Si la máquina se apaga, ese estado desaparece. Un trabajo
   clínico debe sobrevivir al apagón → **el estado va en la base de datos**.
5. **El proyecto Vercel `u-windows-backend`.** Último deployment en `ERROR`, `target: null`, y sus
   rutas ya fueron absorbidas por Graph. No construir nada ahí.
6. **`InMemoryAgentLearningStore`** (`domain/agent/learning.js`, usado como fallback en
   `AgentTurnService.js:44`) y el fallback en memoria de `SupabaseAgentMemoryRepository`
   (`server.js:175-179`). En serverless cada instancia tiene su propia memoria: sirven como red de
   seguridad para desarrollo, **nunca como cola**.
7. **`UsageLedgerStore` sobre el sistema de archivos.** `server.js:100-105` resuelve la raíz a
   `/tmp/graph-generated` cuando `process.env.VERCEL`. `/tmp` en serverless es efímero y por
   instancia. **No es almacenamiento durable.**
8. **`EventSource` en el navegador.** Ya descartado en el repo con una razón de seguridad válida
   (no admite cabeceras → el token acabaría en el query string y en logs de acceso). Usar
   `fetch` + `getReader`, como ya hace `windows-live.js`.
9. **Playwright** (`package.json` de Graph, dependencia `playwright ^1.59.1`). Es ejecución
   *server-side* en el navegador; el HIS del hospital corre en la máquina del médico. No aplica al
   flujo Windows→SAP.
10. **Escritura directa del cliente a Supabase (el modelo Android).** `graph_app_users` /
    `graph_prompts` / `graph_exec_logs` tienen políticas `for insert to anon, authenticated with
    check (true)`. Funciona para telemetría de una app de consumo; **para notas clínicas es
    inaceptable** y además rompería la regla explícita de que *"el cliente Windows habla SOLO con el
    backend Graph"*. **Mantener la regla de Windows, no adoptar la de Android.**

---

## 7. Limitaciones encontradas

### 7.1 No hay identidad de dispositivo — bloqueador de seguridad
**[HECHO]** Una sola key compartida, horneada y descompilable (`distribucion-app-conectada.md:52-58`);
registro por email sin contraseña con upsert que **fusiona máquinas distintas**
(`20260722120000_windows_live_users_and_events.sql`, cabecera). Emitir keys nuevas **exige un
redeploy de Vercel** (`autenticacion-interna-plan.md:49-53`).
**Impacto:** imposible responder "¿qué dispositivo puede ejecutar este trabajo?" ni "revocar este
computador". **Bloquea el MVP.**

### 7.2 Graph no sabe de qué hospital es un encounter
**[HECHO]** `consultations` tiene `organization_id uuid not null` con FK y todo el RLS multi-tenant
colgando de `private.current_org()`. **`clinical_encounters` no tiene columna de organización.**
**Impacto:** no se puede resolver "qué tipo de HIS/SAP aplica" ni "qué mapeo de campos usar" desde el
lado de Graph, ni aislar trabajos por tenant. El `tenant` es un campo obligatorio del contrato de
trabajo (§16.1) y **hoy no existe en el origen**.

### 7.3 El identificador de paciente es inconsistente entre las dos tablas
**[HECHO]** `consultations.patient_id` es `uuid references public.patients(id) on delete set null`;
`clinical_encounters.patient_id` es **`text null`, sin FK**. Además `patients` tiene **2 filas** en
producción, frente a 93 `consultations` y 115 `clinical_encounters` → **[INFERENCIA]** la mayoría de
las consultas no tiene paciente registrado, y `encounterToConsultation` lo asume:
`pacienteId: patient?.id ?? ""` (`:98`).
**Impacto:** *"Graph identifica el paciente"* no está garantizado. Buscar al paciente en SAP exige un
identificador que el sistema **puede no tener**. El estado `requiere intervención del médico` no es
un caso raro: es el camino esperado cuando falta el documento.

### 7.4 No existe ninguna primitiva de cola
**[HECHO]** Búsqueda de `job`, `queue`, `lease`, `claim`, `idempotenc`, `pending` en
`src/`, `web/`, `api/`, `supabase/` de Graph: **cero aciertos relevantes** (los únicos son
`s.pending` de los brains y textos de prompts). No hay tabla de trabajos, ni de dispositivos, ni
clave de idempotencia, ni `FOR UPDATE SKIP LOCKED`, ni expiración.
**Impacto:** es el corazón de lo que hay que construir. También significa que **no hay nada que
migrar ni romper**: es aditivo.

### 7.5 La sustitución dinámica de valores por contexto no está implementada
**[HECHO]** `docs/AGENTE-WORKFLOWS-CONTEXTO.md:113-115` y `:122-124`: `valueMode: dynamic` +
`bindTo` están **clasificados y persistidos**, pero *"la sustitución por-ejecución (tomar el valor
del contexto del chat / de otro step) **no corre aún**. Es el próximo gran paso."* Y `:117-119`
avisa que *"workflows grabados antes de `valueMode` tienen todo `fixed` → re-grabar"*.
**Impacto:** **esta es la limitación funcional central.** Meter `note_json` en campos de SAP *es*
sustitución dinámica. Hoy un workflow reproduciría los valores que se grabaron al enseñar, no los de
la nota actual. Hay dos caminos (`POST /workflows/:id/plan` con `variables`, o
`autofill/match` + acciones de escritura) y **ninguno está probado end-to-end para este caso**.

### 7.6 El límite de tasa es por IP y los hospitales están detrás de NAT
**[HECHO]** `server.js:307-309` (120 req/min sobre todo `/api`) + `:97` (`trust proxy = 1`).
**Impacto:** **[INFERENCIA]** varias instalaciones tras la misma IP de salida comparten el cupo, y el
tráfico clínico del navegador comparte el mismo limitador. Un polling agresivo puede provocar `429`
en la propia consulta del médico. Obliga a (a) preferir long-poll, y (b) segmentar el limitador por
identidad de dispositivo en lugar de por IP.

### 7.7 SAP/HIS no está probado en la máquina real
**[HECHO]** `docs/AGENTE-WORKFLOWS-CONTEXTO.md:130-132`: *"Falta probar grabación/ejecución real de
workflows SAP en su máquina."* Y `windowsEngines.js:44` plantea la pregunta del motor como abierta:
*"¿El escaneo de la pantalla SAP encuentra y resuelve los campos?"*
**Impacto:** el riesgo técnico está concentrado en el último tramo, no en el transporte. El
transporte se puede construir con confianza; **la escritura en SAP hay que medirla antes de
prometerla**.

### 7.8 Notes no tiene ningún camino de estado en vivo
**[HECHO]** Cero Realtime, cero SSE, cero polling de estado; carga acotada al montar
(`CONSULTATIONS_CAP = 300`). **Impacto:** hay que construir la pata de visualización desde cero en
Notes (pero el patrón ya existe en Graph, §6.1-1).

### 7.9 Los logs actuales pueden filtrar PHI y son visibles a administradores
**[HECHO]** `graph_windows_events.detail jsonb` es libre, `label` admite 500 caracteres, y el panel
`GET /api/windows/users/:email/events(/stream)` los muestra a cualquier usuario con
`canManageGlobalWorkflows`. Nada valida que no haya contenido clínico.
Contraste: el lado clínico **sí** es disciplinado (`lib/api/clinical.ts:13`, *"No se imprimen
transcripciones ni notas (PHI) en consola"*; `:498` loguea solo ruta/status/código; las rutas de
Notes dicen *"Nunca se registra el cuerpo"*).
**Impacto:** el feed de eventos de Operations debe ser **una tabla aparte con campos tipados y una
lista blanca**, no `detail` libre.

### 7.10 La documentación de Notes describe mal a Graph
**[HECHO]** `CONTEXTO.md:82` (Notes): *"⚪ "Graph" | `github.com/joseph1356k/Graph` | Repo viejo/aparte
(backend de la extensión + cosas antiguas). **No es la web.**"* Y `:70` afirma *"⚠️ **NO existe** un
"super-admin" de plataforma"*, cuando la migración `20260630000000_superadmin_and_membership.sql`
**crea el rol `superadmin`** y hay páginas `app/superadmin/*` en producción.
**Impacto:** riesgo organizativo real. Un desarrollador que lea `CONTEXTO.md` concluirá que Graph es
legado y construirá la integración en el sitio equivocado.

### 7.11 Dos representaciones de la nota, y la automatización necesita las dos
**[HECHO]** `note_json.sections[].content` (Graph, estructurado) vs `consultations.note`
(`NoteSection[]` aplanado por `noteJsonToSections`, más `firma`, `codigos`, `organization_id`,
`estado`). El hash de la firma se calcula sobre **la forma de Notes**, no sobre `note_json`.
**Impacto:** el trabajo debe llevar el `note_json` (para llenar campos) **y** referenciar la
`consultation` (para cerrar el círculo con `exportada` y con `firma.hash`). No es un problema, pero sí
un detalle de contrato que hay que fijar explícitamente.

### 7.12 Sin cola local durable confirmada en el cliente
**[PREGUNTA / INFERENCIA]** Ver §5.5. Si el cliente no persiste eventos pendientes, una caída de red
durante la ejecución pierde el progreso y probablemente el resultado terminal.

---

## 8. Incertidumbres

Ordenadas por impacto en el diseño. Las que empiezan por **[BLOQUEA]** hay que resolverlas antes de
implementar.

1. **[BLOQUEA] El código del cliente Windows.** `windows-app` no está en GitHub
   (`AGENTE-WORKFLOWS-CONTEXTO.md:26`). No se pudo verificar: si hay cola local durable, cómo se
   genera hoy el `install_id`, si existe una máquina de estados de ejecución, cómo se cancela, si hay
   reintentos, cómo se comporta sin red, ni si `SapGuiSurface` sabe escribir (no solo leer).
   **Sin ese código, cualquier plan de implementación del lado cliente es especulación.**
2. **[BLOQUEA] Qué HIS/SAP exactamente.** El repo habla de `sapgui://SID/TCODE` y de appIds
   `sap|saplogon|saplgpad`, pero no hay ninguna transacción, pantalla o campo concreto documentado.
   Sin saber el sistema, la versión y las transacciones, no se puede estimar el mapeo ni el esfuerzo.
3. **[BLOQUEA] ¿El HIS tiene API?** Todo el diseño actual asume automatización de interfaz. Si el
   HIS expone HL7 v2, FHIR o cualquier API, escribir por API es órdenes de magnitud más fiable que
   pilotar la UI, y la automatización pasa a ser el plan B. **Es la pregunta de mayor apalancamiento
   de todo el proyecto** y no se puede responder desde el código.
4. **Red del hospital.** ¿Permite HTTPS saliente a `graph-eight-pied.vercel.app`? ¿Hay proxy con
   inspección TLS, o listas blancas de dominios? Un proxy con buffering rompería un long-poll o un
   stream (el repo ya se topó con esto: `X-Accel-Buffering: no`, `registerWindowsPanelRoutes.js:88-92`).
   **[INFERENCIA]** Habrá que validar en sitio, y probablemente pedir un dominio propio en vez de
   `*.vercel.app`.
5. **`organization_id` y el modelo de tenant en Graph.** ¿Se añade la columna a
   `clinical_encounters`? ¿Se resuelve por join contra `consultations`? ¿Se manda en el trabajo? Los
   tres funcionan; el equipo debe elegir (§7.2).
6. **Plan de Vercel y sus topes.** Se verificó que `vercel.json` fija `maxDuration: 60` y que el
   código respeta 50 s. **No se verificó el plan de la cuenta** ni si Fluid Compute está activo, lo
   que determina cuánto se podría subir ese techo si se quisiera long-poll más largo.
7. **Volumen esperado.** Hoy: 93 consultas, 1 dispositivo Windows, 43 eventos. **[INFERENCIA]** el
   volumen es de piloto. Con esos números casi cualquier arquitectura funciona; la elección debe
   optimizar **corrección y recuperabilidad**, no rendimiento.
8. **`patient_id` en la práctica.** Con 2 pacientes registrados frente a 115 encounters, ¿cómo se
   identifica hoy al paciente en la consulta? ¿Se espera que Graph lo busque en SAP por documento?
   ¿De dónde saldría ese documento?
9. **Semántica del `run_id`.** Existe como columna y correlaciona una corrida, pero no se documenta
   quién lo genera ni su formato. Para trabajos hace falta decidir si `run_id == job_id` o si un
   trabajo puede tener varias corridas (un reintento, por ejemplo).
10. **Neo4j en el camino crítico.** Los workflows viven en Neo4j (no en Supabase) y `/api/health`
    reporta `degraded` si Neo4j no responde. **[PREGUNTA]** ¿Dónde está alojado, con qué SLA? Si el
    trabajo depende de leer un workflow, Neo4j entra en el camino crítico del registro clínico.
11. **`consent`.** `clinical_encounters` tiene `consent boolean not null default false` y la política
    de INSERT lo exige (`with check (… and consent = true)`), pero una migración posterior se llama
    `20260715185441_remove_clinical_encounter_consent_gate.sql`. **[PREGUNTA]** ¿Cuál es la regla
    vigente, y afecta al derecho de escribir en el HIS?
12. **Qué significa "completado parcialmente" para el hospital.** ¿Una nota a medias en el HIS es
    aceptable, o es peor que ninguna? Determina si la estrategia es *todo-o-nada con rollback* o
    *mejor esfuerzo con reporte*. **Es una decisión clínica, no técnica.**

---

## 9. Riesgos

| # | Riesgo | Severidad | Evidencia | Mitigación propuesta |
|---|---|---|---|---|
| R1 | **Suplantación de dispositivo:** con la key descompilada, un tercero reclama trabajos de cualquier médico y recibe notas clínicas completas | **Crítica** | `distribucion-app-conectada.md:52-58`; `requireAuth.js:345-395` | Enrolamiento per-install **antes** de mover notas (Fase 1). Trabajos siempre ligados a `target_device_id`. `claim` exige token de dispositivo válido y no revocado |
| R2 | **Escritura errónea en la historia clínica:** la automatización escribe en el paciente equivocado, o en el campo equivocado | **Crítica** | `NoteFieldMatcher` descarta bajo 0.75 pero **el mapeo campo↔paciente no está verificado**; §7.3 | Verificación obligatoria de identidad del paciente en pantalla antes de escribir; si no coincide → `needs_doctor`, nunca escribir a ciegas. Confirmación explícita en el primer piloto |
| R3 | **Doble registro:** la misma nota entra dos veces en el HIS | **Alta** | No hay idempotencia en ningún sitio (§7.4) | `idempotency_key` con índice **único** derivada de `firma.hash`; `claim` atómico con lease; `attempts` acotado; y verificación en el HIS antes de escribir cuando sea posible |
| R4 | **Fuga de PHI a logs de plataforma:** el contenido clínico acaba en `graph_windows_events.detail` y se muestra en el panel admin | **Alta** | §7.9; panel gated solo por `canManageGlobalWorkflows` | Tabla de eventos propia, **campos tipados y lista blanca**, prohibido texto libre. Nunca `note_json` ni transcript ni nombre/documento. Ver §16.2 |
| R5 | **Trabajo huérfano:** el dispositivo reclama, se cae y el trabajo queda "en ejecución" para siempre | **Alta** | Telemetría best-effort por diseño; no hay lease | `lease_expires_at` + barrido de leases vencidos → vuelve a `pending` si `attempts < max`, si no `failed`. El barrido puede ser un Vercel Cron o un chequeo perezoso en cada `claim` |
| R6 | **`429` en el flujo clínico** por el limitador compartido por IP | Media-Alta | `server.js:307-309` + `:97`; §7.6 | Long-poll en vez de polling agresivo; limitador propio por `device_id` para `/api/v1/operations/*`; subir o segmentar el cupo de `/api` |
| R7 | **La escritura en SAP no funciona como se espera** y el proyecto se descubre bloqueado en el último tramo | Media-Alta | *"Falta probar grabación/ejecución real de workflows SAP"* (`AGENTE-WORKFLOWS-CONTEXTO.md:130-132`) | **Fase 0: prueba de concepto de escritura en SAP con 2-3 campos, antes de construir la cola.** Es la validación más barata del riesgo más caro |
| R8 | **Sustitución dinámica ausente:** el workflow escribe los valores grabados en vez de los de la nota | Media-Alta | §7.5, `AGENTE-WORKFLOWS-CONTEXTO.md:122-124` | Decidir el camino (plan con `variables` vs. `autofill/match` + escritura) y probarlo en la Fase 0, con los mismos 2-3 campos |
| R9 | **Confianza excesiva del médico** en una automatización que falla en silencio | Media-Alta | El sistema ya tiene el principio "Revisión humana obligatoria" en `ConfiguracionForm.tsx` | Estado visible y honesto por defecto; `partial` y `needs_doctor` **nunca** se presentan como éxito; la transición a `exportada` solo con resultado `completed` |
| R10 | **Neo4j en el camino crítico** de un registro clínico | Media | `/api/health` marca `degraded` sin Neo4j; workflows en Neo4j | Cachear el plan del workflow en el payload del trabajo al crearlo, para que la ejecución no dependa de Neo4j en ese momento |
| R11 | **Documentación engañosa** lleva a construir en el repo equivocado | Media | §7.10, `CONTEXTO.md:82` | Corregir `CONTEXTO.md` **antes** de repartir tareas. Coste: minutos |
| R12 | **La cola queda incompatible con el cliente actual** por tocar contratos "sagrados" | Media | `AgentTurnService.js:8`, `registerWindowsAgentRoutes.js:6-9` (*"No tocar sin tocar el cliente"*) | Rutas **nuevas** bajo `/api/v1/operations/*`. **Cero cambios** en `agent/turn`, `agent/register`, `agent/events`, `teach/*` |
| R13 | **`/tmp` o memoria como almacenamiento** por inercia | Media | `server.js:100-105` (`/tmp/graph-generated`); stores en memoria (§6.2-6,7) | Regla explícita: **el estado de un trabajo vive solo en Postgres** |
| R14 | **Bloqueo por red hospitalaria** (proxy, TLS, listas blancas) descubierto tarde | Media | §8-4 | Validar conectividad en sitio en la Fase 0, con `curl` desde la máquina del médico; considerar dominio propio |
| R15 | **Ambigüedad legal:** ¿quién firma el acto clínico que escribe un robot? | Media | La firma existe en Notes (`firma` con hash) pero el HIS registraría una escritura hecha por automatización | **[PREGUNTA]** para el equipo legal/hospital. Registrar en `audit_events` que el registro fue automático, con `job_id`, y conservar el hash firmado |
| R16 | **Pérdida del progreso al perderse la red** por falta de cola local | Media | §7.12 | Cola local durable en el cliente + reenvío idempotente de eventos (clave por `job_id + seq`) |
| R17 | **Deriva de contrato entre repos** (dos repos, un contrato) | Baja-Media | Ya pasó: `CONTEXTO.md` desactualizado; y los comentarios avisan de contratos espejo | Un solo documento de contrato versionado, referenciado desde los dos repos (ya existe el patrón: `docs/clinical-api-contract.md` en Graph y `docs/backend-clinical-api-contract.md` en Notes) |
| R18 | **Multi-tenant sin tenant** en Graph → trabajos cruzados entre hospitales | Baja-Media | §7.2 | Resolver `organization_id` antes de la Fase 2; incluirlo en el trabajo y en toda consulta |


---

## 10. Alternativas arquitectónicas

Las tres son reales, implementables sobre lo que existe hoy, y ninguna requiere reescribir la API
actual. Se describen con el mismo nivel de detalle para poder compararlas.

### Alternativa A — Cola en Postgres + long-poll con claim/lease + eventos HTTP
*(la obligatoriamente sencilla: el MVP)*

**Flujo**

```
 MÉDICO / MIRACLE NOTES                GRAPH (Vercel)                 WINDOWS (U.exe)
 ─────────────────────                 ──────────────                 ───────────────
 1. Firma la nota
    signConsultationNote()
    estado: aprobada + firma{hash}
          │
 2. POST /api/clinical/encounters/:id/operations-jobs
    Bearer <JWT Supabase>  ───────────►  requireClinicalAuth
    Idempotency-Key: firma.hash             │
                                            ├─ verifica propiedad (getOwnedEncounter)
                                            ├─ resuelve device destino
                                            ├─ INSERT operations_jobs (status=pending)
                                            │  ON CONFLICT (idempotency_key) DO NOTHING
                                            └─► { job_id, status: 'pending', deduped? }
                                                        ▲
 3. Notes muestra "Pendiente"                           │
    GET .../operations-jobs  (polling 4 s)  ────────────┘

                                                                 4. POST /api/v1/operations/
                                            ◄──────────────────────  jobs/claim  (long-poll)
                                            │                        X-Device-Token
                                            ├─ RPC claim_next_job()
                                            │  FOR UPDATE SKIP LOCKED
                                            │  status: pending→claimed
                                            │  lease_expires_at = now()+3min
                                            │  attempts += 1
                                            ├─ si nada en ~40 s → 204
                                            └─► { job, note_json, template_snapshot,
                                                  plan_hint, lease_expires_at }
                                                                       │
                                            ◄──────────────────────  5. POST .../jobs/:id/events
                                            │   {to_status:'running',     (progreso, cada paso)
                                            ├─  progress_pct, current_action,
                                            │   fields_ok[], fields_failed[]}
                                            │                        │
                                            │                    6. WorkflowPlayer:
                                            │                       alinea SAP → escribe campos
                                            │                       │
                                            ◄──────────────────────  7. POST .../jobs/:id/result
                                            │   {outcome:'completed'|'partial'|
                                            │    'failed'|'needs_doctor', fields_ok[],
                                            │    fields_failed[], error_code}
                                            │
                                            ├─ transición terminal (idempotente por seq)
                                            └─ si completed → RPC marcar consultation
                                                             'aprobada' → 'exportada'
                                                        │
 8. Notes ve "Completado" en el siguiente poll ◄────────┘
    (y la consulta pasa a "Exportada")
```

**Tecnologías**
Postgres (Supabase, mismo proyecto) · HTTP/JSON · Express 5 sobre función serverless de Vercel ·
`SupabaseRestClient` con service-role · RPC `SECURITY DEFINER` con `FOR UPDATE SKIP LOCKED` ·
polling desde el navegador · long-poll desde Windows.

**Cambios necesarios por repositorio**

| Repo | Cambios |
|---|---|
| **Graph** | 3 migraciones (`operations_devices`, `operations_jobs`, `operations_job_events`) + 2 RPC (`claim_next_job`, `expire_stale_leases`) · `OperationsJobService` + `OperationsDeviceService` · `registerOperationsRoutes.js` (crear/consultar/cancelar/reintentar en el carril clínico; enroll/claim/events/result en `/api/v1`) · `requireApiKey` con fuente dual env+DB · limitador propio por `device_id` · una entrada `operations` en `windowsEngines.js` |
| **Notes** | Métodos nuevos en `lib/api/clinical.ts` (crear/consultar/cancelar/reintentar) · un hook de polling acotado (solo con trabajo activo, con backoff y tope) · panel de estado en `app/app/consultas/[id]/page.tsx` · emparejamiento de dispositivo en `ConfiguracionForm.tsx` (el slot HIS/HCE ya existe) · extender `StatusBadge`/`NotificationsBell` |
| **windows-app** | Enrolamiento en el primer arranque + `device_id` estable + token en `graph.json` · bucle de `claim` con long-poll y backoff · cola local durable de eventos · ejecución con valores de la nota · reporte de progreso y resultado · manejo de cancelación (bandera consultada entre pasos) |

**Ventajas**
- **Durable por construcción.** El trabajo sobrevive al apagón, al cierre de la app, al reinicio de
  la función y al despliegue. Es la única propiedad que de verdad importa aquí.
- **Idempotencia natural y gratis:** índice único sobre `idempotency_key` derivada de `firma.hash`,
  que **ya se calcula hoy**.
- **Cero conexiones entrantes.** Cumple literalmente el principio de seguridad pedido.
- **Encaja con Vercel sin fricción:** todo son peticiones cortas; el long-poll de ~40 s vive
  cómodamente bajo el techo de 60 s que el repo ya respeta con 50 s.
- **Reutiliza el modelo mental existente**: es el mismo *"el cliente pregunta, el servidor decide,
  el cliente ejecuta"* de `agent/turn`.
- **Depurable con `curl`.** Todo el flujo se puede reproducir a mano, que es exactamente cómo el
  equipo ya verifica (`AGENTE-WORKFLOWS-CONTEXTO.md:160-168`).
- **Concurrencia correcta con una sola línea de SQL** (`SKIP LOCKED`): dos dispositivos no pueden
  tomar el mismo trabajo.

**Desventajas**
- Latencia de entrega: 0-40 s si no hay conexión en vuelo (con long-poll continuo, en la práctica
  ~inmediata mientras la app esté abierta).
- Latencia de visualización: hasta 4 s (el intervalo de polling en Notes).
- El long-poll consume una invocación de función mientras espera.
- Requiere disciplina en el barrido de leases vencidos.

**Complejidad:** **Baja-Media.** 3 tablas, 2 RPC, ~8 endpoints. Es la alternativa con menos piezas
móviles.

**Seguridad:** **Alta** (con la Fase 1 hecha). Nada entrante; identidad por dispositivo; el trabajo
solo se entrega al `target_device_id`; el payload clínico solo viaja en la respuesta del `claim`
autenticado; eventos con campos tipados sin PHI.

**Compatibilidad con Vercel:** **Excelente.** No necesita ninguna capacidad que no esté ya probada
en el repo.

**Latencia esperada:** entrega ~1-3 s con la app abierta (long-poll en vuelo), hasta ~40 s en el peor
caso; progreso visible en Notes en ≤4 s.

**Tolerancia a desconexiones:** **Excelente.** El trabajo espera indefinidamente en `pending`. Si el
dispositivo se cae a mitad, el lease vence y el trabajo vuelve a la cola.

**Escalabilidad:** Suficiente con holgura para el volumen real (§8-7) y bastante más allá.
`SKIP LOCKED` sobre un índice parcial escala a miles de trabajos sin esfuerzo. El límite práctico
aparece con muchos dispositivos en long-poll simultáneo (concurrencia de funciones), no con la cola.

**Costos operativos:** **Bajos.** Sin infraestructura nueva. El coste es invocaciones de Vercel: un
long-poll de 40 s por dispositivo ≈ 90 invocaciones/hora/dispositivo de duración larga. Con 1-20
dispositivos es irrelevante; con cientos hay que medir.

**Riesgos:** que el intervalo de polling de Notes agrave R6 (mitigable: solo se hace polling cuando
hay trabajo activo); que el barrido de leases se olvide (mitigable: hacerlo perezosamente dentro del
propio `claim`, sin depender de un cron).

**Cuándo elegirla:** **ahora**. Es la única de las tres que se puede tener funcionando y bien
probada en semanas, y es la base sobre la que las otras dos se construyen como mejora.

---

### Alternativa B — Tiempo real puro (Supabase Realtime o WebSocket en Vercel)

Dos sub-variantes, porque tienen implicaciones de seguridad opuestas.

**B1 — Windows suscrito directamente a Supabase Realtime**

```
Notes ──POST──► Graph ──INSERT──► Postgres ──Realtime WS──► Windows (suscrito a operations_jobs)
                                        │
                                        └──Realtime WS──► Navegador del médico
Windows ──POST /api/v1/...──► Graph (reporte de progreso y resultado)
```

**B2 — WebSocket contra Vercel**

```
Windows ──WS (experimental_upgradeWebSocket)──► función Vercel ──► Postgres
                                                     ▲
                                                     └── necesita pub/sub externo para difundir
```

**Tecnologías** B1: Supabase Realtime (Phoenix/WS) + RLS + una credencial Supabase en el cliente.
B2: `@vercel/functions` `experimental_upgradeWebSocket` o `ws`, + Redis/Upstash o similar para fan-out.

**Cambios necesarios**

| Repo | B1 | B2 |
|---|---|---|
| Graph | Publicación Realtime + RLS específica para el canal | Ruta WS + integración con pub/sub externo + gestión de reconexión server-side |
| Notes | Suscripción Realtime (fácil: ya usa `@supabase/supabase-js`) | Cliente WS propio |
| windows-app | Cliente Realtime en .NET + gestión de credencial Supabase | Cliente WS en .NET + reconexión con backoff |
| Infra | — | **Nuevo servicio de pub/sub** (coste y operación nuevos) |

**Ventajas**
- Latencia de entrega mínima (sub-segundo).
- B1 es **muy bueno para la pata del navegador**: Notes ya tiene `@supabase/supabase-js`, las tablas
  ya tienen RLS, y el WebSocket va **navegador↔Supabase**, así que **no toca el techo de 60 s de
  Vercel en absoluto**. Es la mejora de visualización más barata que existe.

**Desventajas**
- **B1 rompe una regla explícita del sistema.** La migración `20260722120000` establece que *"el
  cliente Windows habla SOLO con el backend Graph (`/api/v1`, `X-API-Key`), y es Graph quien escribe
  aquí con service-role"*, y que esas tablas tienen *"RLS activado SIN políticas […]: ningún cliente
  las toca directo"*. Suscribir el `.exe` a Supabase obliga a poner una credencial Supabase en el
  binario y a abrir políticas de lectura — **exactamente el modelo Android que el equipo
  deliberadamente NO aplicó a Windows** (§6.2-10).
- **B2 no da lo que promete.** La propia documentación de Vercel acompaña el WebSocket de una
  sección de reconexión *"to handle connection closures when Vercel Functions reach their maximum
  duration"*: la conexión sigue acotada. Y al vivir en una instancia concreta, difundir a otra exige
  pub/sub externo. **Más piezas para la misma limitación.**
- **Ninguna de las dos resuelve el problema real.** Un canal en tiempo real dice *"hay un trabajo"*,
  no *"este trabajo está pendiente, lo tomó este dispositivo, va por el 40 %, y si se cae vuelve a la
  cola"*. **Igual hace falta la tabla.** Tiempo real sin cola pierde trabajos cuando el
  destinatario está apagado — que es el caso normal.
- Depurar un WS con `curl` no se puede; el equipo perdería su método de verificación habitual.

**Complejidad:** **Alta** (B2 más que B1). **Seguridad:** **Media-Baja en B1** (credencial Supabase en
el binario, superficie de lectura abierta); Media en B2. **Compatibilidad con Vercel:** B1 excelente
(no pasa por Vercel); B2 **pobre**. **Latencia:** excelente (<1 s). **Tolerancia a desconexiones:**
**Mala si se usa como único mecanismo** — un mensaje enviado a un cliente apagado se pierde;
Supabase Realtime **no es una cola durable**. **Escalabilidad:** buena en B1; en B2 limitada por
concurrencia de funciones y por el pub/sub. **Costos:** B1 bajo; **B2 el más alto** (servicio nuevo).
**Riesgos:** falsa sensación de solución; regresión de seguridad en B1; deuda operativa en B2.

**Cuándo elegirla:** **B1 solo para la pata de visualización en Notes**, y **después** de tener la
cola. B2: solo si apareciera un requisito de interactividad bidireccional de muy baja latencia (por
ejemplo control remoto en vivo de la pantalla del médico) que hoy no existe. **Nunca como mecanismo
de entrega de trabajos.**

---

### Alternativa C — Híbrida: cola durable + push para despertar + Realtime para ver
*(el destino, no el punto de partida)*

**Flujo** — igual que A, con dos añadidos:

```
Notes ──POST──► Graph ──INSERT operations_jobs (fuente de verdad)
                          │
                          ├──(a) NOTIFY / canal Realtime "hay trabajo para device X"
                          │        └──► Windows despierta y hace claim inmediato
                          │             (si el push falla, el long-poll lo recoge igual)
                          │
                          └──(b) Realtime sobre operations_jobs (RLS por médico)
                                   └──► navegador del médico ve el estado sin polling
Windows ──POST /api/v1/operations/jobs/:id/{events,result}──► Graph  (igual que A)
```

**Diferencia conceptual clave:** el push es **una optimización de latencia, no un canal de
entrega**. La cola sigue siendo la única fuente de verdad; si el push se pierde, no se pierde nada.
Es el mismo principio que ya aplica `windows-live.js`: stream para lo rápido, **polling como red de
seguridad** (`:22`, *"solo red de seguridad: el camino normal es el stream"*).

**Cambios necesarios:** todo lo de A, más — en Graph: publicar el aviso; en Notes: suscripción
Realtime sustituyendo el polling (con el polling como fallback); en windows-app: escucha del aviso
(vía SSE con `fetch`+`getReader` contra Graph, **no** vía Supabase directo, para no romper la regla
de topología).

**[RECOMENDACIÓN] En la pata Windows, usar SSE contra Graph reutilizando el patrón ya existente de
`registerWindowsPanelRoutes.js`, no Supabase Realtime.** Así el cliente sigue hablando solo con
Graph, la autenticación sigue siendo el token de dispositivo, y el código del servidor está ya
escrito y probado.

**Ventajas:** latencia de A mejorada a sub-segundo sin perder durabilidad; visualización sin polling
(elimina R6 por completo en la pata del navegador); degrada con elegancia (si el push muere, todo
sigue funcionando más lento).
**Desventajas:** dos caminos que mantener y probar (incluido el caso "llegó por los dos");
más superficie de código; **prematuro antes de tener A funcionando y medido**.
**Complejidad:** Media-Alta. **Seguridad:** Alta (igual que A si el push va por Graph).
**Compatibilidad con Vercel:** Buena (SSE ya resuelto; Realtime del navegador no pasa por Vercel).
**Latencia:** <1 s entrega, <1 s visualización. **Tolerancia a desconexiones:** Excelente (hereda A).
**Escalabilidad:** Muy buena. **Costos:** Bajos-Medios. **Riesgos:** sobre-ingeniería si se hace
antes de tiempo; complejidad de pruebas por los dos caminos.

**Cuándo elegirla:** cuando A esté en producción y (a) los médicos digan que 40 s de espera se noten,
o (b) el polling de Notes empiece a molestar al limitador. **Es la Fase 6, no la Fase 2.**

---

## 11. Comparación de alternativas

| Criterio | **A — Cola + long-poll** | **B — Tiempo real puro** | **C — Híbrida** |
|---|---|---|---|
| Durabilidad del trabajo | **Total** (Postgres) | **Ninguna** por sí sola | **Total** (hereda A) |
| Funciona con el PC apagado | **Sí**, espera en `pending` | **No**, el mensaje se pierde | **Sí** |
| Funciona con Graph cerrado | **Sí** | **No** | **Sí** |
| Idempotencia | **Índice único, trivial** | Hay que añadirla aparte | **Índice único** |
| Recuperación tras caída a mitad | **Lease vencido → recola** | No modelada | **Lease vencido → recola** |
| Latencia de entrega | 1-3 s típico, ≤40 s peor caso | **<1 s** | **<1 s** |
| Latencia de visualización | ≤4 s (polling) | **<1 s** | **<1 s** |
| Compatibilidad con Vercel | **Excelente** | B1 buena / **B2 pobre** | **Buena** |
| Conexiones entrantes al PC | **Ninguna** | Ninguna | **Ninguna** |
| Respeta "Windows solo habla con Graph" | **Sí** | **B1 no** | **Sí** (si el push va por Graph) |
| Credenciales en el binario | Token per-install (revocable) | **B1: + credencial Supabase** | Token per-install |
| Infraestructura nueva | **Ninguna** | **B2: pub/sub** | Ninguna |
| Depurable con `curl` | **Sí, todo** | No el canal | Sí (camino de respaldo) |
| Piezas a construir | **3 tablas, 2 RPC, ~8 rutas** | Canal + igualmente la tabla | A + push + suscripción |
| Complejidad | **Baja-Media** | Alta | Media-Alta |
| Costos operativos | **Bajos** | B2 altos | Bajos-Medios |
| Riesgo de sobre-ingeniería | **Bajo** | Alto | Medio |
| Tiempo a un MVP fiable | **Más corto** | Más largo | Medio |
| **Veredicto** | **Elegir ahora** | **Solo B1, solo para ver, y después** | **Destino, Fase 6** |

**Lectura de la tabla en una frase:** las tres filas que deciden son *durabilidad*, *funciona con el
PC apagado* y *recuperación tras caída*. En esas tres, A y C empatan y B pierde de forma
estructural — y A cuesta la mitad que C.

---

## 12. Recomendación principal

**Construir la Alternativa A, con la Fase 1 de seguridad como prerrequisito no negociable, y dejar
la Alternativa C como evolución explícitamente planificada.**

Cinco razones, todas ancladas en el estado real del repositorio:

1. **El problema no es de latencia, es de durabilidad.** El caso normal es que el computador esté
   apagado, o Graph cerrado, o el médico en otra consulta. Ninguna tecnología de tiempo real
   resuelve eso; una cola sí. Y una vez que hay cola, el tiempo real es un adorno que se puede
   añadir sin romper nada.

2. **Es la arquitectura que el sistema ya tiene, aplicada a un objeto nuevo.** El cliente ya conduce
   su bucle contra `/api/v1` con conexiones salientes; Graph ya decide y el cliente ya ejecuta; ya
   hay registro de dispositivo y feed de eventos con cursor. Un `claim` es un `agent/turn` con otra
   carga. **La costura "sagrada" no se toca.**

3. **El disparador y el destino ya existen.** `firma.hash` es la clave de idempotencia; el trigger de
   inmutabilidad ya permite **solo** `aprobada → exportada`; y `secretary_mark_exported` es el molde
   de la transición acotada. Estamos automatizando un paso que ya está modelado, no inventando un
   flujo.

4. **El riesgo real está en el último tramo, no en el transporte.** Lo que no está probado es
   escribir en SAP con valores dinámicos (§7.5, §7.7). Elegir el transporte más simple libera todo el
   presupuesto de riesgo para lo que de verdad puede fallar.

5. **La seguridad exige el enrolamiento primero, y ya está diseñado.** Mover notas clínicas con una
   key compartida descompilable no es aceptable, y el plan (`autenticacion-interna-plan.md`) está
   escrito y decidido. Implementarlo primero convierte tres de tus principios de seguridad en
   propiedades verificables del sistema.

**Lo que explícitamente NO recomiendo:** eliminar o reemplazar la API actual; crear un servicio
separado de Miracle Operations; usar WebSockets para el MVP; suscribir el `.exe` a Supabase; construir
el mapeo de campos en Miracle Notes; o construir la cola antes de validar que se puede escribir en
SAP.

---

## 13. Arquitectura recomendada

### 13.1 Ubicación: un módulo nuevo dentro de Graph, aislado como el módulo clínico

**[RECOMENDACIÓN]** `Operations` vive en **Graph**, como un módulo aislado con el mismo patrón que ya
usa el módulo clínico (servicios en `src/application/use-cases/`, rutas en un
`registerOperationsRoutes.js`, persistencia vía `SupabaseRestClient`).

**Por qué en Graph y no en Notes:**
- **[HECHO]** El cliente Windows ya está cableado a Graph: una base URL, una credencial, un
  `GraphConfig`. Poner la cola en Notes obligaría a una segunda base URL y una segunda credencial en
  el `.exe`.
- **[HECHO]** Graph ya tiene lo que la cola necesita: `SupabaseRestClient` con service-role, el
  patrón SSE resuelto, el limitador, el catálogo de workflows (Neo4j), `NoteFieldMatcher`, el plan de
  ejecución, y el panel de observabilidad.
- **[HECHO]** El `note_json` y el `template_snapshot` **ya están en Graph** (`clinical_encounters`).
  Crear el trabajo desde Graph no requiere mover datos clínicos entre sistemas.
- Notes es el producto de cara al médico; su trabajo es **firmar, mostrar y decidir**, no orquestar
  automatizaciones.

**Por qué un módulo y no un servicio nuevo:** un servicio separado añadiría un despliegue, un
secreto, un CORS, un contrato y una fuente de deriva, para resolver un problema de **tres tablas**.
La única razón para separarlo sería aislar el ciclo de despliegue — y no hay evidencia de que eso sea
un problema hoy.

### 13.2 Superficie de rutas (conceptual, no definitiva)

| Carril | Ruta conceptual | Auth | Quién llama |
|---|---|---|---|
| Clínico | `POST /api/clinical/encounters/:id/operations-jobs` | `requireClinicalAuth` (JWT del médico) | Notes |
| Clínico | `GET /api/clinical/encounters/:id/operations-jobs` | `requireClinicalAuth` | Notes (polling) |
| Clínico | `POST /api/clinical/operations-jobs/:jobId/cancel` | `requireClinicalAuth` | Notes |
| Clínico | `POST /api/clinical/operations-jobs/:jobId/retry` | `requireClinicalAuth` | Notes |
| Clínico | `GET /api/clinical/operations-devices` | `requireClinicalAuth` | Notes (emparejar dispositivo) |
| `/api/v1` | `POST /api/v1/operations/enroll` | key de **enrolamiento** (bajo privilegio) | windows-app, 1ª vez |
| `/api/v1` | `POST /api/v1/operations/jobs/claim` | **token de dispositivo** | windows-app (long-poll) |
| `/api/v1` | `POST /api/v1/operations/jobs/:id/events` | token de dispositivo | windows-app |
| `/api/v1` | `POST /api/v1/operations/jobs/:id/result` | token de dispositivo | windows-app |
| `/api/v1` | `POST /api/v1/operations/jobs/:id/heartbeat` | token de dispositivo | windows-app (renueva lease) |
| Admin | `GET /api/windows/operations/*` | `requireAccountAuth` + `canManageGlobalWorkflows` | Provider Studio |

**[RECOMENDACIÓN] Cero cambios** en `agent/turn`, `agent/register`, `agent/events`, `teach/*`,
`mcp`, `workflows/*`, `autofill/match`, `pipeline`, ni en ninguna ruta `/api/clinical` existente.
Todo es aditivo. El contrato espejo con `Protocol.cs` queda intacto.

### 13.3 Las cinco decisiones estructurales

1. **La cola vive en Postgres del proyecto Supabase existente** (`zyvfamlhlmztliexvmej`). Es la
   única fuente de verdad. Ni memoria, ni `/tmp`, ni el estado opaco de la sesión, ni Neo4j.
2. **La entrega es *pull*, siempre.** El backend nunca inicia una conexión hacia la máquina del
   médico. Long-poll de ~40 s (bajo el techo de 60 s ya respetado), `204` si no hay nada.
3. **El reclamo es atómico con lease.** RPC `SECURITY DEFINER` con `FOR UPDATE SKIP LOCKED`, que
   marca `claimed_by_device`, `lease_expires_at` e incrementa `attempts` en la misma sentencia. Dos
   dispositivos no pueden tomar el mismo trabajo, y un trabajo abandonado vuelve solo.
4. **La idempotencia es de base de datos, no de aplicación.** Índice **único** sobre
   `idempotency_key` derivada de `firma.hash`. Reintentar la creación devuelve el mismo `job_id` con
   `deduped: true`, nunca un segundo trabajo.
5. **El progreso viaja por HTTP POST a una tabla propia con campos tipados.** No se reutiliza
   `graph_windows_events` para el contenido clínico (§6.2-3, R4). La telemetría genérica sigue
   funcionando en paralelo, para el panel de motores.

### 13.4 Cómo se cierra el círculo con el estado de la consulta

**[RECOMENDACIÓN]** Cuando un trabajo termina en `completed`, Graph invoca una RPC `SECURITY DEFINER`
acotada — modelada sobre `secretary_mark_exported` — que hace **exclusivamente**
`consultations.estado: 'aprobada' → 'exportada'` para esa consulta, verificando que el trabajo
pertenece a ese médico y a esa consulta.

Ventajas: el trigger de inmutabilidad **ya permite esa transición y solo esa** (migr.
`20260721000000`); la UI de Notes ya sabe pintar `Exportada`; y no se abre ningún permiso nuevo de
escritura sobre `consultations`.

Y en paralelo, un `audit_events` con `accion: "Nota registrada en el HIS por automatización"` y el
`job_id` en `detalle` — la tabla es append-only y ya existe (`grant select, insert`, sin update ni
delete).

**[RECOMENDACIÓN]** `partial`, `failed`, `cancelled` y `needs_doctor` **no** transicionan el estado.
La consulta se queda en `aprobada` y el panel muestra qué pasó. Un registro a medias en el HIS
**nunca** debe presentarse como exportado.

---

## 14. Diagrama de secuencia

### 14.1 Camino feliz — registro de una nota clínica

```
Médico   Notes(nav)   Notes(srv)      Graph            Postgres        U.exe(Win)      SAP/HIS
  │          │            │             │                  │              │              │
  │ firma    │            │             │                  │              │              │
  ├─────────►│            │             │                  │              │              │
  │          │ signConsultationNote()    │                  │              │              │
  │          ├───────────►│             │                  │              │              │
  │          │            │  UPDATE consultations           │              │              │
  │          │            │  estado=aprobada, firma{hash}   │              │              │
  │          │            ├────────────────────────────────►│              │              │
  │          │            │◄────────────────────────────────┤ trigger congela la fila     │
  │          │◄───────────┤ {ok, firma}                     │              │              │
  │          │                                              │              │              │
  │          │ POST /api/clinical/encounters/:id/operations-jobs           │              │
  │          │ Bearer JWT · Idempotency-Key: firma.hash     │              │              │
  │          ├────────────────────────►│                    │              │              │
  │          │                         │ requireClinicalAuth (JWKS)        │              │
  │          │                         │ getOwnedEncounter(:id, doctorId)  │              │
  │          │                         ├───────────────────►│              │              │
  │          │                         │ resuelve target_device_id         │              │
  │          │                         │ INSERT operations_jobs status=pending            │
  │          │                         │ ON CONFLICT (idempotency_key) DO NOTHING         │
  │          │                         ├───────────────────►│              │              │
  │          │◄────────────────────────┤ {job_id, status:'pending'}        │              │
  │◄─────────┤ "Pendiente de registrar en el HIS"           │              │              │
  │          │                         │                    │              │              │
  │          │                         │       long-poll ya en vuelo desde antes          │
  │          │                         │◄──────────────────────────────────┤              │
  │          │                         │ POST /api/v1/operations/jobs/claim (X-Device-Token)
  │          │                         │ RPC claim_next_job(device_id)     │              │
  │          │                         │  UPDATE … WHERE status='pending'  │              │
  │          │                         │    AND target_device_id=$1        │              │
  │          │                         │    FOR UPDATE SKIP LOCKED         │              │
  │          │                         │  SET status='claimed',            │              │
  │          │                         │      lease_expires_at=now()+3min, │              │
  │          │                         │      attempts=attempts+1 RETURNING*              │
  │          │                         ├───────────────────►│              │              │
  │          │                         ├──────────────────────────────────►│              │
  │          │                         │ {job, note_json, template_snapshot,              │
  │          │                         │  plan_hint, lease_expires_at}     │              │
  │          │                         │                    │              │              │
  │          │                         │◄──────────────────────────────────┤              │
  │          │                         │ POST …/events {to_status:'running', pct:0}        │
  │          │                         ├───────────────────►│ INSERT event + UPDATE job   │
  │          │ GET …/operations-jobs (poll 4 s)             │              │              │
  │          ├────────────────────────►│───────────────────►│              │              │
  │◄─────────┤ "En ejecución · 0 %"    │                    │              │              │
  │          │                         │                    │              ├─ alinear ───►│
  │          │                         │                    │              │  (abrir/enfocar SAP,
  │          │                         │                    │              │   confirmar superficie
  │          │                         │                    │              │   sapgui://SID/TCODE)
  │          │                         │                    │              ├─ verificar paciente ►
  │          │                         │◄──────────────────────────────────┤              │
  │          │                         │ POST …/events {pct:35, current_action:'campo 3/8',
  │          │                         │                fields_ok:[…keys…]} │              │
  │          │                         ├───────────────────►│              ├─ escribir ──►│
  │          │                         │                    │              │  campo a campo
  │          │ (poll)                  │                    │              │              │
  │◄─────────┤ "En ejecución · 35 %"   │                    │              │              │
  │          │                         │                    │              ├─ guardar ───►│
  │          │                         │◄──────────────────────────────────┤              │
  │          │                         │ POST …/result {outcome:'completed',               │
  │          │                         │   fields_ok:[8], fields_failed:[], seq:N}         │
  │          │                         │ transición terminal (idempotente por seq)         │
  │          │                         ├───────────────────►│              │              │
  │          │                         │ RPC marcar_exportada(consultation_id, job_id)     │
  │          │                         ├───────────────────►│ aprobada→exportada (trigger OK)
  │          │                         │ INSERT audit_events (append-only) │              │
  │          │                         ├───────────────────►│              │              │
  │          │                         │◄──────────────────────────────────┤ 200 {ack}    │
  │          │ (poll)                  │                    │              │              │
  │◄─────────┤ "Completado · Exportada"│                    │              │              │
```

### 14.2 Camino de fallo — el dispositivo se cae a mitad de la ejecución

```
U.exe   Graph   Postgres
  │       │        │
  ├──────►│ claim  → status=claimed, lease_expires_at = T+3min, attempts=1
  ├──────►│ events → status=running, pct=40, fields_ok=[a,b,c]
  │       │
  ✗ la máquina se apaga / se pierde la red / el proceso muere
  │       │
  │       │  … pasa T+3min sin heartbeat ni resultado …
  │       │
  │       ├─ en el siguiente claim de CUALQUIER dispositivo (barrido perezoso):
  │       │  RPC expire_stale_leases()
  │       │    WHERE status IN ('claimed','running') AND lease_expires_at < now()
  │       │      → si attempts < max_attempts: status='pending', claimed_by=null
  │       │        + evento {to_status:'pending', error_code:'LEASE_EXPIRED'}
  │       │      → si attempts >= max_attempts: status='failed'
  │       │        + evento {to_status:'failed', error_code:'MAX_ATTEMPTS'}
  │       │
  │  (la máquina vuelve)                                          
  ├──────►│ claim  → recibe el MISMO job_id, attempts=2
  │       │         con fields_ok=[a,b,c] ya conocidos del intento anterior
  ├─ el cliente decide: verificar en pantalla qué campos ya están escritos
  │  antes de reescribir (evita duplicar dentro del HIS)
  ├──────►│ result → outcome='completed'
```

**[RECOMENDACIÓN]** El `claim` de un reintento debe devolver `fields_ok` acumulados de los intentos
previos, para que el cliente pueda reanudar en vez de repetir. Y para el caso de duda, el cliente
debe **leer la pantalla antes de escribir** — capacidad que ya existe (`SapContextReader`,
`UiInspector`).

### 14.3 Camino de intervención — falta el paciente

```
U.exe ──claim──► job (patient_ref = null o sin documento)
  │
  ├─ intenta resolver el paciente en SAP → no encuentra / ambiguo
  │
  ├──POST …/result {outcome:'needs_doctor',
  │                 error_code:'PATIENT_NOT_RESOLVED',
  │                 needs:[{field:'patient_document', reason:'no encontrado en SAP'}]}
  │
Graph ── status='needs_doctor'; NO transiciona la consulta (sigue 'aprobada')
  │
Notes ── el panel muestra "Requiere tu intervención: falta identificar al paciente"
  │      + acción "Reintentar" (crea un intento nuevo con la misma nota)
```

---

## 15. Modelo conceptual de datos

Tres tablas nuevas. **[RECOMENDACIÓN]** RLS activado **sin políticas** para `anon`/`authenticated`
en las dos primeras (patrón de `graph_windows_*`: solo el backend con service-role las toca), y
**con** política de lectura por médico en `operations_jobs` si más adelante se adopta Realtime en el
navegador (Alternativa C).

### 15.1 `operations_devices` — identidad de instalación

| Campo | Tipo | Notas |
|---|---|---|
| `device_id` | `text` **PK** | Generado por el cliente: hash estable de la máquina, persistido en `graph.json`. **Es la identidad, no el email** |
| `token_hash` | `text` | Hash del token per-install. **Nunca el token en claro** |
| `doctor_user_id` | `uuid` null | Emparejamiento con `auth.users.id`. Null hasta que el médico lo vincule desde Notes |
| `organization_id` | `uuid` null | Tenant del dispositivo |
| `label` | `text` | Nombre legible: "Consultorio 3 · portátil" |
| `email` | `text` | Compatibilidad con `graph_windows_users` (telemetría) |
| `machine_name`, `os_version`, `app_version` | `text` | Diagnóstico y marcador por versión |
| `his_kind` | `text` | `sap_gui` \| `web` \| `otro` — qué sistema hay en **esta** máquina |
| `enrolled_at`, `last_seen_at` | `timestamptz` | |
| `revoked_at` | `timestamptz` null | **No borrar: revocar.** Un `claim` con dispositivo revocado → `401` |

Índices: `(doctor_user_id) where revoked_at is null`, `(last_seen_at desc)`.

**Resuelve:** "cada instalación tiene identidad segura", "los comandos solo los ejecuta el
dispositivo autorizado", y **"cómo identificamos el dispositivo correcto cuando un médico tiene
varios computadores"** — que es imposible con el esquema actual (§7.1).

### 15.2 `operations_jobs` — la cola

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | `job_id` |
| `kind` | `text` | `clinical_note_registration` \| `interactive_command` |
| `encounter_id` | `uuid` | → `clinical_encounters.id` |
| `consultation_id` | `uuid` | El mismo valor (§4.3), explícito para cerrar el círculo con `exportada` |
| `doctor_user_id` | `uuid` | Dueño. Toda lectura desde Notes se filtra por aquí |
| `organization_id` | `uuid` | **Requiere resolver §7.2** |
| `patient_ref` | `jsonb` | **Solo referencias**: `{patient_id?, document_type?, document_number?}`. **Nunca el nombre** |
| `template_id` | `uuid` | |
| `template_snapshot_hash` | `text` | Hash del snapshot → detecta si el trabajo se creó con otra versión de plantilla |
| `target_device_id` | `text` null | Null = cualquier dispositivo del médico; con valor = solo ese |
| `his_kind` | `text` | Copiado del dispositivo al crear |
| `payload` | `jsonb` | `{note_json, rendered_text, plan_hint?}`. **Es PHI** → ver §15.5 |
| `idempotency_key` | `text` **UNIQUE** | `sha256(consultation_id + firma.hash + attempt_group)` |
| `priority` | `smallint` | `0` normal, `>0` interactivo (§16.3) |
| `status` | `text` CHECK | ver §15.4 |
| `attempts` / `max_attempts` | `int` | `max_attempts` por defecto 3 |
| `claimed_by_device` | `text` null | |
| `lease_expires_at` | `timestamptz` null | |
| `expires_at` | `timestamptz` | TTL del trabajo. Vencido → `expired`, no se entrega |
| `progress_pct` | `smallint` | Espejo del último evento, para no hacer join al leer |
| `current_action` | `text` | Idem. **Texto de UI, no PHI** |
| `fields_ok` / `fields_failed` | `jsonb` | Arrays de **claves de sección / ids de campo**, sin valores |
| `result` | `jsonb` null | `{outcome, error_code, error_message, needs[]}` |
| `created_at`, `updated_at`, `terminal_at` | `timestamptz` | |

Índices clave:
- `unique (idempotency_key)` — la garantía de no-duplicado.
- **Índice parcial para el `claim`:** `(target_device_id, priority desc, created_at) where status = 'pending'`.
- `(status, lease_expires_at) where status in ('claimed','running')` — barrido de leases.
- `(doctor_user_id, created_at desc)` — lectura desde Notes.
- `(consultation_id)`.

### 15.3 `operations_job_events` — bitácora tipada, append-only

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `bigint identity` PK | **Cursor monotónico**, igual que `graph_windows_events` |
| `job_id` | `uuid` | |
| `device_id` | `text` | |
| `seq` | `int` | Secuencia **del cliente**. `unique (job_id, seq)` → reenvío idempotente |
| `from_status` / `to_status` | `text` | Transición explícita |
| `progress_pct` | `smallint` | |
| `current_action` | `text` | Lista blanca de textos de UI |
| `fields_ok` / `fields_failed` | `jsonb` | **Solo claves**, nunca valores |
| `error_code` | `text` | Código estable y enumerado |
| `error_message` | `text` | **Saneado**, sin PHI |
| `evidence_ref` | `text` null | Referencia opaca a evidencia, **no la evidencia** (§15.5) |
| `client_at` / `created_at` | `timestamptz` | Reloj del cliente y del servidor, como ya hace `graph_windows_events` |

Índices: `(job_id, id)`, `unique (job_id, seq)`.

**[RECOMENDACIÓN]** `unique (job_id, seq)` es lo que hace que reenviar un evento tras una caída de red
sea seguro: el segundo intento choca y se ignora. Sin esa restricción, la cola local durable del
cliente duplicaría eventos.

### 15.4 Máquina de estados

```
                            ┌──────────► cancelled  (médico, desde Notes)
                            │
   pending ──claim──► claimed ──primer evento──► running ──┬──► completed
      ▲                  │                          │      ├──► partial
      │                  │  lease vencido           │      ├──► failed
      └──────────────────┴──────────────────────────┘      └──► needs_doctor
         (si attempts < max_attempts)
      │
      └── expires_at vencido ──► expired
                                 (si attempts >= max) ──► failed
```

**Quién puede cambiar cada estado** — el control de acceso importa tanto como los estados:

| Transición | Autorizado | Verificación |
|---|---|---|
| `∅ → pending` | **Notes / el médico** | `requireClinicalAuth` + propiedad del encounter + firma existente |
| `pending → claimed` | **Solo el dispositivo destino** | RPC atómica con `target_device_id` y token válido no revocado |
| `claimed → running` | Solo `claimed_by_device` | Token del dispositivo == `claimed_by_device` |
| `running → completed\|partial\|failed\|needs_doctor` | Solo `claimed_by_device` | Idem, y solo si el lease está vigente |
| `claimed\|running → pending` | **Solo el backend** (barrido) | `lease_expires_at < now()` y `attempts < max_attempts` |
| `claimed\|running → failed` | **Solo el backend** | Lease vencido y `attempts >= max_attempts` |
| `pending\|claimed\|running → cancelled` | **Notes / el médico** | Propiedad del trabajo. Si está `running`, se marca la intención y el cliente la lee entre pasos |
| `pending → expired` | **Solo el backend** | `expires_at < now()` |
| cualquier terminal → cualquier cosa | **Nadie** | Los estados terminales son finales. Reintentar **crea un trabajo nuevo** |

**[RECOMENDACIÓN] Reintentar no reabre un trabajo terminal: crea otro**, con
`idempotency_key` que incluye un `attempt_group` incrementado. Así el historial de intentos queda
completo y auditable, y la unicidad sigue protegiendo contra el doble clic.

### 15.5 Datos clínicos: qué se guarda, dónde y cuánto tiempo

**[RECOMENDACIÓN]** Reglas explícitas, porque aquí es donde un diseño descuidado crea un problema
regulatorio:

1. **`payload` (con `note_json`) es PHI.** Vive en `operations_jobs`, en el mismo Postgres que ya
   contiene la nota (no se crea una copia en un sistema nuevo). **Se purga al alcanzar un estado
   terminal + N días** (sugerencia: 7, decisión del equipo): el trabajo y su bitácora se conservan,
   el contenido clínico no. `note_json` sigue en `clinical_encounters`, que es su sitio.
2. **La bitácora nunca contiene contenido clínico.** Solo `job_id`, `device_id`, estados, porcentaje,
   códigos de error, y **claves** de sección/campo (`motivo_consulta`, no *"dolor torácico de 3
   días"*).
3. **Prohibido en logs y en eventos:** transcripción, `note_json`, nombre o documento del paciente,
   capturas de pantalla, y el token de dispositivo. Esta regla ya es la norma en el lado clínico
   (`lib/api/clinical.ts:13`, `:498`; *"Nunca se registra el cuerpo"* en las rutas de Notes) — hay que
   extenderla a Operations, donde hoy no existe (§7.9).
4. **`evidence_ref` es una referencia opaca, no la evidencia.** Si en el futuro se guardan capturas,
   van a Storage con acceso restringido y retención propia; el evento solo lleva el identificador.
   **[PREGUNTA]** ¿Se quiere evidencia visual? Una captura de una pantalla de SAP con datos de
   paciente es PHI de pleno derecho.
5. **Auditoría por el canal que ya existe:** `audit_events` (append-only, `grant select, insert`) con
   el `job_id` en `detalle`. No se inventa un canal de auditoría nuevo.

---

## 16. Contratos conceptuales

**[RECOMENDACIÓN]** Estos son contratos **conceptuales**, no definitivos: los nombres exactos de
campos y rutas se fijan al implementar, contra el código real del cliente Windows (que hoy no se
puede leer, §2.3). Se responde también a tu pregunta de si tus contratos propuestos son correctos o
excesivos.

### 16.1 Trabajo de registro clínico

**Tu lista propuesta, revisada campo por campo:**

| Campo que propusiste | Veredicto | Comentario |
|---|---|---|
| Identificador del trabajo | ✅ **Necesario** | `job_id` uuid |
| Identificador de la consulta | ✅ **Necesario** | Y ojo: `encounter_id` **y** `consultation_id` son el mismo uuid hoy (§4.3), pero conviene llevar los dos campos explícitos por si algún día divergen |
| Identificador del médico | ✅ **Necesario** | Es la clave de autorización de toda lectura |
| Identificador del paciente | ⚠️ **Necesario pero problemático** | Hoy puede no existir (§7.3). Debe ser `patient_ref` **opcional** con referencias, no el nombre. Si falta → `needs_doctor` |
| Identificador del dispositivo | ✅ **Necesario** | Como `target_device_id` **nullable**: null = cualquier dispositivo del médico |
| Identificador del hospital | ✅ **Necesario** — y **hoy no existe en el origen** | §7.2. Hay que resolverlo antes de la Fase 2 |
| Tipo de HIS | ✅ **Necesario** | Pero **derivado del dispositivo**, no elegido por Notes: el HIS es una propiedad de la máquina |
| Versión de la plantilla | ✅ **Necesario** | Mejor como `template_snapshot_hash` + `template_id`. El snapshot completo ya viaja en el payload |
| Nota estructurada | ✅ **Necesario** | `note_json` tal cual, con `ensureClinicalDischarge` aplicado |
| Texto renderizado | ✅ **Necesario** | Ver §16.5: hacen falta los dos, y por razones distintas |
| Prioridad | ⚠️ **Aún no** | Con un tipo de trabajo y volumen de piloto, `priority` puede existir como columna con default 0 y no usarse. **Se vuelve necesaria en la Fase 5** (comandos interactivos) |
| Fecha de creación | ✅ **Necesario** | |
| Fecha de expiración | ✅ **Necesario** | Un trabajo de hace tres semanas no debe ejecutarse solo cuando alguien abra el portátil |
| Estado | ✅ **Necesario** | §15.4 |
| Número de intentos | ✅ **Necesario** | Con `max_attempts`, o los reintentos son infinitos |
| Clave de idempotencia | ✅ **Necesario, y es lo más importante de la lista** | Con índice **único** en la base, no validación en aplicación |

**Añadidos que faltaban en tu lista y sí hacen falta:**
`claimed_by_device` y `lease_expires_at` (sin ellos no hay recuperación tras caída),
`fields_ok`/`fields_failed` (sin ellos no hay reanudación ni fallo parcial informativo), y
`result` con `error_code` enumerado.

**Forma conceptual de lo que devuelve el `claim`:**

```
{
  job: { job_id, kind, encounter_id, consultation_id, doctor_user_id, organization_id,
         patient_ref?, template_id, template_snapshot_hash, his_kind,
         priority, created_at, expires_at, attempts, max_attempts,
         lease_expires_at, fields_ok_previous[] },
  content: { note_json, rendered_text, template_snapshot },
  hint:    { workflow_id?, execution_plan?, surface_id? }
}
```

### 16.2 Evento de ejecución

**Tu lista, revisada:** trabajo asociado ✅ · dispositivo ✅ · estado anterior ✅ · estado nuevo ✅ ·
porcentaje ✅ · acción actual ✅ (como texto de UI de lista blanca) · campos completados ✅ (**solo
claves**) · campos fallidos ✅ (**solo claves**) · error ✅ (con `error_code` enumerado, no solo
mensaje) · evidencia o metadatos permitidos ⚠️ (**solo como `evidence_ref` opaca**, §15.5-4) ·
fecha y hora ✅ (dos: `client_at` y `created_at`, como ya hace `graph_windows_events`).

**Añadido imprescindible:** **`seq`** — secuencia del cliente con `unique (job_id, seq)`. Sin ella,
la cola local durable duplica eventos al reconectar.

**Y una distinción que tu lista no hace y es crítica:**

| | Evento de progreso | Resultado terminal |
|---|---|---|
| Semántica | **Best-effort** (como la telemetría actual) | **Debe confirmarse** |
| Si se pierde | No pasa nada, el siguiente lo corrige | **El trabajo queda huérfano** |
| Reintento del cliente | Opcional | **Obligatorio, hasta recibir `ack`** |
| Ruta | `POST …/jobs/:id/events` | `POST …/jobs/:id/result` |

Mezclarlos en un solo endpoint con la semántica *"el cliente se traga los errores"* de la telemetría
actual (`registerWindowsTelemetryRoutes.js:5-7`) sería un error de diseño con consecuencias clínicas.

### 16.3 Comando interactivo (flujo secundario)

**Tu lista, revisada:** tipo de comando ✅ · parámetros ✅ · médico ✅ · dispositivo ✅ (aquí **no**
nullable: un comando interactivo va a *esta* máquina) · consulta ✅ (opcional) · prioridad ✅ (**aquí
sí es necesaria**) · expiración ✅ (**muy corta**: 30-60 s) · estado ✅ (subconjunto reducido) ·
resultado ✅.

**[RECOMENDACIÓN] Sí hay que distinguir trabajos clínicos de comandos interactivos, pero con `kind`
en la misma tabla, no con dos sistemas.** Razonamiento:

| | Trabajo clínico | Comando interactivo |
|---|---|---|
| Expiración | Horas o días | **30-60 segundos** (un comando viejo no debe ejecutarse nunca) |
| Reintentos | Sí, con `max_attempts` | **No.** Si falló, el médico lo vuelve a pulsar |
| Idempotencia | Crítica (doble registro clínico) | Menor, pero útil contra doble clic |
| Latencia aceptable | Segundos a minutos | **Pocos segundos, o es inservible** |
| Payload | PHI | Normalmente sin PHI (`abrir_his`, `ir_a_seccion`) |
| Prioridad | Normal | **Adelanta a los clínicos** |
| Estados | Los 8 | `pending → claimed → completed\|failed\|expired` |

Comparten la cola, el `claim`, el lease, la autenticación de dispositivo, el reporte y el panel.
Duplicar todo eso para siete comandos sería sobre-ingeniería. **La misma tabla con `kind` y
`priority` da las dos semánticas.**

**Cómo se evita que un comando viejo se ejecute:** `expires_at` corto **verificado dentro de la RPC
de `claim`** (no en la aplicación), más el orden `priority desc, created_at`. Un comando expirado
nunca se entrega, aunque el dispositivo lleve tres horas apagado.

**¿Hace falta tiempo real para los comandos?** **[RECOMENDACIÓN]** Con long-poll continuo la latencia
efectiva es de 1-3 s, que para "abrir el HIS" o "buscar paciente" es aceptable. Si las pruebas
mostraran que no lo es, **esa** es la razón legítima para pasar a la Alternativa C — y solo para este
caso de uso.

### 16.4 ¿Dónde vive el mapeo sección clínica → campo del HIS?

**[RECOMENDACIÓN]** Partido en tres, respetando lo que ya funciona:

| Capa | Responsabilidad | Por qué ahí | Estado |
|---|---|---|---|
| **windows-app** | **Inventario de campos**: leer la pantalla real y producir `fields[]` con `{stepOrder, label, selector, controlType, allowedOptions, currentValue}` | Es el único que ve la pantalla. Y el contrato ya existe | **[HECHO]** existe (es la entrada de `autofill/match`) |
| **Graph** | **Correspondencia** nota→campo, vía `NoteFieldMatcher` (LLM, umbral 0.75, con `evidence`), y/o el `execution_plan` del workflow con `variables` | Tiene el LLM, la nota y el catálogo de workflows. Es el "QUÉ" de la costura | **[HECHO]** existe; **[LIMITACIÓN]** la inyección de valores dinámicos no está probada (§7.5) |
| **Miracle Notes** | **Nada.** Solo la plantilla y la nota | No sabe ni debe saber nada del HIS. Meter mapeos aquí acoplaría el producto clínico a cada hospital | **[HECHO]** correcto hoy |

**Hospitales con configuraciones distintas:** se resuelve por **workflow aprendido por superficie**,
que es el mecanismo que el sistema ya tiene. Cada hospital enseña su flujo; el workflow queda ligado a
`sapgui://SID/TCODE` o `uia://proceso.exe/...`; el scoping por superficie ya selecciona el correcto
(`AgentTurnService.assembleTools`, `AgentWorkflowStore.workflows(userId, apps, surface)`).
**[RECOMENDACIÓN] No construir una tabla de mapeos declarativa en la Fase 1.** Sería un segundo
sistema de mapeo compitiendo con el aprendizaje de workflows, que es la innovación central del
producto (`ARQUITECTURA_Y_PLAN.md:22-27`: *"Sin el aprendizaje de workflows, el autofill no
funciona"*). Si tras el segundo o tercer hospital el aprendizaje no basta, entonces sí se justifica
una capa declarativa — con datos para diseñarla.

**Campos opcionales o inexistentes:** ya hay tres mecanismos.
(a) `NoteFieldMatcher` simplemente **no emite match** si no hay valor con confianza ≥0.75.
(b) `valueMode: 'flexible'` en el step → *"exacto → aproximado → **saltar sin romper**"*.
(c) `fields_failed` en el evento y `outcome: 'partial'` → el médico ve exactamente qué quedó sin
llenar. **No hay que inventar nada; hay que conectarlo.**

**Validación de la nota antes de enviarla:** también existe.
`ClinicalNoteValidationService.validateEditedNote(noteJson, template_snapshot)` corre en
`PUT /api/clinical/encounters/:id/note`, y `note_json` ya expone `warnings` y
`missing_required_sections` (`lib/api/clinical.ts:89-90`).
**[RECOMENDACIÓN]** La creación del trabajo debe **rechazar** con un código claro si
`missing_required_sections` no está vacío, y **exigir** que la consulta esté en `aprobada` con
`firma`. Es una validación de dos líneas sobre datos que ya están ahí.

### 16.5 ¿Texto final, JSON estructurado, o ambos?

**[RECOMENDACIÓN] Ambos, y no es redundancia: cada uno alimenta un mecanismo distinto.**

- **`note_json`** → es lo que hace posible el mapeo **campo a campo**. `sections[].key` es la unidad
  de correspondencia: sin él, "poner cada sección en su campo" es imposible y `fields_ok`/
  `fields_failed` no tendrían nada que nombrar.
- **`rendered_text`** → es lo que se necesita para (a) el `noteContent` que `NoteFieldMatcher`
  **ya espera** hoy (recibe *"a free-text clinical note (markdown)"*), y (b) el caso muy real de un
  HIS con **un solo campo de texto libre**, donde no hay nada que mapear y hay que volcar la nota
  completa.
- **`template_snapshot`** → el orden, las etiquetas y qué secciones eran obligatorias, congelados.
  Sin él, el cliente no puede reconstruir el documento en el orden correcto.

**Y sí, hay que enviar la copia inmutable de la plantilla** — que además **ya existe y ya es
inmutable** (`template_snapshot` con `snapshot_at`, §4.3). Es la respuesta completa a *"cómo se evita
que una plantilla modificada cambie una nota histórica"*: ya está resuelto, no hay que hacer nada.

**[RECOMENDACIÓN]** El `rendered_text` debe generarlo **Graph** al crear el trabajo, a partir de
`note_json` + `template_snapshot`, y **no** el navegador. Razón: así el texto que se registra en el
HIS es reproducible desde el servidor y auditable, y no depende de lo que renderizó una versión
concreta del frontend. Notes ya tiene `lib/clinical/consultation-text.ts` como referencia de formato.

---

## 17. División de responsabilidades por repositorio

### 17.1 Veredicto sobre la separación que propusiste

**Tu separación es correcta en lo esencial.** Coincide con la costura que el sistema ya declara
sagrada (*"Graph decide QUÉ, la superficie decide CÓMO"*, `AGENTE-WORKFLOWS-CONTEXTO.md:9-11`).
Cuatro correcciones y un añadido:

**Corrección 1 — "Backend central: Autenticación" es ambiguo y hay que precisarlo.**
Graph **no** autentica médicos: **verifica** tokens que emite **Supabase**
(`requireClinicalAuth.js:80-91`, JWKS offline). El emisor de identidad de personas es Supabase Auth;
Graph es el verificador y el autorizador. Lo que Graph **sí** debe emitir es la identidad de
**dispositivos** (tokens per-install), que hoy no existe. La distinción importa: si se escribe
"Graph autentica", alguien construirá un login propio y duplicará el sistema de identidad.

**Corrección 2 — "Asignar trabajos a dispositivos" no es del todo del backend.**
El backend **valida y hace cumplir** la asignación (el `claim` solo entrega a `target_device_id`), pero
**el emparejamiento médico↔dispositivo lo decide el médico** desde Notes — en el slot que ya existe
en `ConfiguracionForm.tsx`. Sin un acto humano de emparejamiento, el backend no tiene forma legítima
de saber cuál de los tres computadores del médico es "el del consultorio".

**Corrección 3 — falta una responsabilidad en Miracle Notes: la validación previa.**
Notes debe **negarse a enviar** una nota que no está firmada, o que tiene
`missing_required_sections`, o que es una consulta de demostración (verificación que ya existe,
`actions.ts:42-52`). Es la primera barrera y la más barata.

**Corrección 4 — falta una responsabilidad en Graph: renderizar el texto.**
Por reproducibilidad y auditoría (§16.5).

**Añadido — una cuarta responsabilidad, hoy sin dueño: el catálogo de HIS por institución.**
Qué sistema usa cada hospital, qué workflow le corresponde, qué transacción de SAP. Hoy no vive en
ningún sitio (§7.2 lo hace imposible). **[RECOMENDACIÓN]** que viva en Graph, ligado a
`organization_id`, y se **derive del dispositivo** en la Fase 1 (`operations_devices.his_kind`)
mientras el modelo de tenant se resuelve.

### 17.2 Tabla de responsabilidades

| Responsabilidad | Miracle Notes | Graph (backend) | windows-app | Estado |
|---|---|---|---|---|
| Generar la nota | Dispara | **Ejecuta** (LLM + plantilla) | — | **[HECHO]** |
| Permitir revisión del médico | **Dueño** | — | — | **[HECHO]** |
| Firmar la nota (acto clínico) | **Dueño** (hash + inmutabilidad) | — | — | **[HECHO]** |
| Validar antes de enviar | **Dueño** (1ª barrera) | **Dueño** (2ª barrera, autoritativa) | — | **[HECHO]** las piezas; falta conectarlas |
| Enviar la nota aprobada | **Dispara** | **Crea el trabajo** | — | **A construir** |
| Renderizar el texto final | — | **Dueño** | — | **A construir** |
| Emparejar médico ↔ dispositivo | **Dueño** (UI) | **Persiste y hace cumplir** | Se enrola | **A construir** |
| Emitir identidad de dispositivo | — | **Dueño** | Guarda y renueva el token | **A construir** (diseñado) |
| Verificar identidad del médico | Obtiene el JWT | **Verifica** (JWKS) | — | **[HECHO]** |
| Cola, estados, idempotencia, leases | — | **Dueño exclusivo** | — | **A construir** |
| Entregar el trabajo | — | **Responde al `claim`** | **Reclama (pull)** | **A construir** |
| Decidir QUÉ escribir (mapeo) | — | **Dueño** (`NoteFieldMatcher`, plan) | Aporta el **inventario de campos** | **[HECHO]** parcial (§7.5) |
| Decidir CÓMO escribirlo | — | — | **Dueño** (UIA / SAP GUI Scripting) | **[HECHO]** parcial (§7.7) |
| Abrir/enfocar SAP, alinear superficie | — | Aprende la alineación | **Dueño** | **[HECHO]** |
| Reportar progreso | — | Recibe y persiste | **Dueño** | **A construir** |
| Confirmar resultado terminal | — | **Persiste y `ack`** | **Reintenta hasta el `ack`** | **A construir** |
| Cola local durable ante caída de red | — | — | **Dueño** | **A construir** (§7.12) |
| Mostrar estado al médico | **Dueño** | Expone lectura | — | **A construir** |
| Reintentar / cancelar | **Dueño** (UI) | **Dueño** (reglas) | Obedece cancelación entre pasos | **A construir** |
| Cerrar el círculo `aprobada → exportada` | Ve el resultado | **Dueño** (RPC acotada) | — | **A construir** |
| Auditoría clínica | Lee | **Escribe** (`audit_events`) | — | **[HECHO]** el canal |
| Catálogo de HIS por institución | Configura | **Dueño** | Reporta `his_kind` | **A construir** |
| Observabilidad y marcador | — | **Dueño** (panel, motores) | Emite telemetría | **[HECHO]** el patrón |

### 17.3 ¿La API actual está en el repositorio correcto?

**Sí.** **[HECHO]** El módulo clínico está en Graph, y ahí debe quedarse:
- Graph es el hub que ya define la costura con el cliente Windows, con contratos declarados
  "sagrados". Mover el API clínico rompería esa costura sin beneficio.
- Graph tiene Neo4j (workflows), los providers de LLM configurables desde Provider Studio, el
  `SupabaseRestClient` con service-role y el patrón SSE.
- Notes ya funciona bien como consumidor: un cliente HTTP centralizado, con errores normalizados y
  disciplina de PHI.

**Pero hay un problema documental que sí hay que arreglar** (§7.10): `CONTEXTO.md:82` describe Graph
como *"Repo viejo/aparte […] No es la web"*, lo que es falso y peligroso. **[RECOMENDACIÓN]**
corregirlo antes de repartir tareas. Coste: minutos. Coste de no hacerlo: alguien construye
Operations en el repo equivocado.

---

## 18. Plan de implementación por fases

**Principio rector:** cada fase termina en algo verificable, y las dos primeras atacan los dos
riesgos que pueden matar el proyecto (R7: no se puede escribir en SAP; R1: no hay identidad de
dispositivo). **La cola se construye en tercer lugar, a propósito** — construirla antes de saber si
se puede escribir en SAP sería invertir en el tramo fácil.

### Fase 0 — Desbloquear y validar el riesgo caro *(antes de escribir código de producto)*

| # | Tarea | Repo | Verificación de salida |
|---|---|---|---|
| 0.1 | **Subir `windows-app` a GitHub** y leer el cliente | windows-app | El repo es accesible; se confirma o corrige todo lo marcado **[INFERENCIA]** en §5 |
| 0.2 | **Prueba de concepto de escritura en SAP**: un workflow enseñado que escriba **2-3 campos** con valores que **no** son los grabados, tomados de un `note_json` de prueba | windows-app + Graph | Los 3 campos aparecen escritos en SAP con los valores de la nota. **Si esto falla, el proyecto cambia de forma** |
| 0.3 | Decidir el camino de sustitución dinámica: `POST /workflows/:id/plan` con `variables` **vs.** `autofill/match` + acciones de escritura | Graph | Una decisión escrita, con la evidencia de 0.2 |
| 0.4 | **Validar la red del hospital**: `curl` a `graph-eight-pied.vercel.app` desde la máquina del médico; probar un long-poll de 40 s y un SSE de 50 s | — | Long-poll y stream sobreviven al proxy del hospital, o se documenta qué los rompe |
| 0.5 | **Preguntar si el HIS tiene API** (HL7 v2 / FHIR / cualquier cosa) | — | Respuesta del hospital. **Es la pregunta de mayor apalancamiento del proyecto** |
| 0.6 | Resolver el modelo de tenant: cómo obtiene Graph el `organization_id` de un encounter | Graph | Decisión escrita (columna nueva, join, o campo en el trabajo) |
| 0.7 | Corregir `CONTEXTO.md` (Graph no es un repo viejo; el superadmin sí existe) | Notes | Documentación que no engaña |

**Criterio de salida de la fase:** 0.2 verde. Si 0.2 es rojo, se re-planifica antes de invertir en
0.8+ (el problema sería de automatización, no de integración).

### Fase 1 — Identidad de dispositivo *(el prerrequisito de seguridad)*

Implementa el plan ya escrito en `studio-docs/autenticacion-interna-plan.md:60-70`.

| # | Tarea | Repo |
|---|---|---|
| 1.1 | Migración `operations_devices` (§15.1) — RLS activado, sin políticas de cliente | Graph |
| 1.2 | `OperationsDeviceService`: enroll, rotar, revocar, `last_seen`, verificación por `token_hash` | Graph |
| 1.3 | `POST /api/v1/operations/enroll`, gated por la **key de enrolamiento** (bajo privilegio), con límite de tasa propio | Graph |
| 1.4 | `requireApiKey` con **fuente dual**: env (admin/enrolamiento) + **DB** (per-install). Sin romper ningún consumidor actual | Graph |
| 1.5 | La key embebida en el `.exe` pasa a ser **solo de enrolamiento** | windows-app + CI |
| 1.6 | `device_id` estable (hash de máquina) + token en `graph.json` + renovación | windows-app |
| 1.7 | Card "Dispositivos Windows" en Provider Studio (listar, ver uso, **revocar uno**) | Graph |
| 1.8 | Emparejamiento médico↔dispositivo desde Notes, en el slot HIS/HCE existente | Notes |

**Verificación:** dos instalaciones del mismo médico aparecen como **dos dispositivos distintos**;
revocar uno no afecta al otro; un token revocado recibe `401`; la key de enrolamiento **no** puede
leer ni escribir nada más que enrolar.

### Fase 2 — La cola y el camino feliz *(el MVP)*

| # | Tarea | Repo |
|---|---|---|
| 2.1 | Migraciones `operations_jobs` + `operations_job_events` (§15.2, §15.3), con el índice **único** de idempotencia y el índice parcial del `claim` | Graph |
| 2.2 | RPC `claim_next_job(device_id)`: `FOR UPDATE SKIP LOCKED`, lease, `attempts++`, respeta `expires_at`, orden `priority desc, created_at` | Graph |
| 2.3 | RPC `expire_stale_leases()`, invocada **perezosamente dentro de cada `claim`** (sin depender de un cron) | Graph |
| 2.4 | `OperationsJobService`: crear (con idempotencia), leer, transicionar, cancelar, reintentar; render de `rendered_text` | Graph |
| 2.5 | Rutas del carril clínico: crear / consultar / cancelar / reintentar (`requireClinicalAuth` + propiedad) | Graph |
| 2.6 | Rutas de `/api/v1/operations`: `claim` (long-poll ~40 s, `204` si vacío), `events`, `result`, `heartbeat` | Graph |
| 2.7 | Validación de entrada: firma presente, `missing_required_sections` vacío, no demo, encounter `completed` | Graph |
| 2.8 | Métodos nuevos en `lib/api/clinical.ts` + códigos de error amigables en `CLINICAL_ERROR_MESSAGES` | Notes |
| 2.9 | Panel de estado en el detalle de consulta + polling acotado (**solo con trabajo activo**, con tope y backoff) | Notes |
| 2.10 | Bucle de `claim` en el cliente + **cola local durable** de eventos + reenvío idempotente por `seq` | windows-app |
| 2.11 | Reporte de progreso y resultado, con **reintento del terminal hasta recibir `ack`** | windows-app |
| 2.12 | RPC `marcar_exportada(consultation_id, job_id)` acotada + `audit_events` | Graph |
| 2.13 | Entrada `operations` en `windowsEngines.js` → aparece en el panel sin tocar el front | Graph |

**Verificación:** el camino de §14.1 completo, contra el `miracle-his-simulator`; el médico ve
`Pendiente → En ejecución → Completado` y la consulta pasa a `Exportada`; **firmar dos veces produce
un solo trabajo**.

### Fase 3 — Escritura real en SAP/HIS y fallos parciales

| # | Tarea | Repo |
|---|---|---|
| 3.1 | Conectar el camino elegido en 0.3 al payload del trabajo (valores de la nota → campos) | Graph + windows-app |
| 3.2 | Verificación obligatoria de identidad del paciente **antes de escribir**; si no coincide → `needs_doctor` (mitiga **R2**) | windows-app |
| 3.3 | `fields_ok` / `fields_failed` reales; `outcome: 'partial'` cuando corresponda | windows-app |
| 3.4 | `plan_hint` cacheado en el payload al crear el trabajo, para no depender de Neo4j en ejecución (mitiga **R10**) | Graph |
| 3.5 | Reanudación en el reintento: usar `fields_ok_previous`, leer la pantalla antes de reescribir (mitiga **R3**) | windows-app |

**Verificación:** un HIS real (o el simulador) con 8+ campos; un caso con un campo inexistente
termina en `partial` con la lista correcta; un paciente que no existe termina en `needs_doctor` **sin
escribir nada**.

### Fase 4 — Robustez, cancelación y observabilidad

| # | Tarea | Repo |
|---|---|---|
| 4.1 | Cancelación: intención en el trabajo, leída por el cliente **entre pasos** (no a mitad de una escritura) | Graph + windows-app |
| 4.2 | Reintento desde Notes = **trabajo nuevo** con `attempt_group+1` (§15.4) | Graph + Notes |
| 4.3 | Purga del `payload` a los N días de estado terminal (§15.5-1) | Graph |
| 4.4 | Límite de tasa por `device_id` para `/api/v1/operations/*`, y revisión del cupo de `/api` (mitiga **R6**) | Graph |
| 4.5 | Auditoría de PHI: test automático que falle si un evento contiene `note_json`, transcript, nombre o documento (mitiga **R4**) | Graph |
| 4.6 | Panel de Operations: trabajos por médico/dispositivo, % de éxito por versión de app, último error | Graph |
| 4.7 | `NotificationsBell` cuenta también "pendientes de registrar en el HIS" | Notes |

### Fase 5 — Comandos interactivos *(el flujo secundario)*

| # | Tarea | Repo |
|---|---|---|
| 5.1 | `kind = 'interactive_command'` + `priority > 0` + `expires_at` de 30-60 s (§16.3) | Graph |
| 5.2 | Catálogo cerrado de comandos: `iniciar_consulta`, `abrir_his`, `buscar_paciente`, `ir_a_seccion`, `registrar_nota_actual`, `completar_campos_pendientes`, `ejecutar_workflow`, `cancelar` | Graph |
| 5.3 | Paleta de comandos en Notes — **ya existe el componente**: `components/app/CommandPalette.tsx` | Notes |
| 5.4 | Ejecución y `ack` de comandos en el cliente | windows-app |

### Fase 6 — Tiempo real *(la Alternativa C, cuando se justifique)*

| # | Tarea | Repo |
|---|---|---|
| 6.1 | Aviso "hay trabajo para el dispositivo X" por **SSE contra Graph**, reutilizando el patrón de `registerWindowsPanelRoutes.js` (no Supabase directo) | Graph + windows-app |
| 6.2 | Supabase Realtime sobre `operations_jobs` con RLS por médico → Notes sin polling | Notes + Graph |
| 6.3 | Mantener el long-poll y el polling **como red de seguridad**, igual que ya hace `windows-live.js:22` | ambos |

**Disparadores para entrar en la Fase 6:** los médicos reportan que la espera se nota, **o** el
polling de Notes empieza a tocar el limitador. **Sin uno de los dos, no se hace.**

---

## 19. Pruebas necesarias

### 19.1 Unitarias (rápidas, sin red)

| Qué | Dónde | Por qué |
|---|---|---|
| Máquina de estados: toda transición legal permitida, toda ilegal rechazada | Graph | §15.4 es el contrato del sistema |
| Derivación de `idempotency_key` a partir de `consultation_id + firma.hash + attempt_group` | Graph | Determinista y estable |
| Render de `rendered_text` desde `note_json` + `template_snapshot`: orden, etiquetas, `discharge` ausente | Graph | Reproducibilidad (§16.5) |
| Validación de entrada: sin firma, `missing_required_sections` no vacío, demo, encounter no `completed` | Graph | 2ª barrera autoritativa |
| **Redacción de eventos**: dado un evento con PHI, el saneador la elimina | Graph | **R4**. Debe fallar el build si se rompe |
| `buildClinicalRequest` con las rutas nuevas (ya es una función pura y testeada) | Notes | Patrón existente |
| Cálculo del estado visible en la UI a partir del trabajo (incluido `partial` ≠ éxito) | Notes | **R9** |
| Parseo del payload del `claim` y del contrato de eventos | windows-app | Contrato espejo |

### 19.2 Integración (con Postgres real)

| Qué | Escenario | Resultado esperado |
|---|---|---|
| **Reclamo concurrente** | 2 dispositivos hacen `claim` a la vez sobre 1 trabajo | Exactamente uno lo recibe. `SKIP LOCKED` verificado, no asumido |
| **Idempotencia** | Crear el mismo trabajo 5 veces en paralelo | 1 fila, mismo `job_id`, `deduped: true` en los 4 siguientes |
| **Lease vencido** | `claim`, luego silencio hasta pasado el lease | Vuelve a `pending`, `attempts=1`; el siguiente `claim` lo entrega |
| **Agotamiento de intentos** | Lease vencido `max_attempts` veces | `failed` con `error_code: 'MAX_ATTEMPTS'`, **nunca bucle infinito** |
| **Reenvío de eventos** | Enviar el mismo `(job_id, seq)` dos veces | El segundo se ignora; una sola fila |
| **Terminal duplicado** | Enviar `result` dos veces | El segundo devuelve `ack` sin re-transicionar ni re-exportar |
| **Expiración** | Trabajo con `expires_at` pasado | El `claim` **no** lo entrega; queda `expired` |
| **Comando viejo** | Comando con `expires_at` de 30 s, dispositivo que despierta 2 h después | No se entrega. Cubre tu pregunta explícita |
| **Cierre del círculo** | `completed` sobre una consulta `aprobada` | Pasa a `exportada`; el trigger de inmutabilidad **no** protesta |
| **Cierre indebido** | `partial` / `failed` | La consulta **sigue** en `aprobada` |
| **Trabajo cruzado** | Médico A intenta leer/cancelar un trabajo de B | `404`/`403`, sin filtrar existencia |
| **Dispositivo revocado** | `claim` con token revocado | `401`; el trabajo sigue `pending` |
| **Dispositivo equivocado** | `claim` desde un dispositivo ≠ `target_device_id` | No recibe el trabajo |

### 19.3 End-to-end

| Qué | Cómo |
|---|---|
| Camino feliz completo (§14.1) | Contra `miracle-his-simulator`: firmar en Notes → ver `Exportada` |
| Caída a mitad (§14.2) | Matar el proceso del cliente durante la ejecución; verificar recola y reanudación |
| Falta el paciente (§14.3) | Encuentro sin `patient_id`; verificar `needs_doctor` **sin escritura** |
| Fallo parcial | HIS con un campo que no existe; verificar `partial` + `fields_failed` correcto |
| Cancelación | Cancelar con el trabajo `running`; verificar que para entre pasos, no a mitad de una escritura |
| Máquina apagada | Crear el trabajo con el PC apagado; encenderlo; verificar que se ejecuta |
| Graph cerrado | Crear el trabajo con `U.exe` cerrado; abrirlo; verificar que se ejecuta |
| Reinstalación | Reinstalar el cliente; verificar que el `device_id` se mantiene (o que el re-emparejamiento es explícito) |

### 19.4 Seguridad y privacidad

| Qué | Criterio de aceptación |
|---|---|
| **PHI en logs** | Un test recorre eventos y logs de una corrida completa y **falla** si aparece contenido de la nota, transcript, nombre o documento (**R4**) |
| **PHI en el panel admin** | El panel de Operations **no** muestra contenido clínico, solo claves y códigos |
| Key de enrolamiento con privilegio mínimo | Con esa key: `enroll` funciona; `claim`, `events`, `workflows`, `pipeline` → `401` |
| Token nunca en claro | `operations_devices` guarda solo `token_hash`; el token no aparece en ningún log ni respuesta salvo en el enrolamiento |
| Aislamiento por tenant | Un trabajo de la organización A nunca se entrega a un dispositivo de B |
| Límite de tasa del enrolamiento | Fuerza bruta contra `enroll` se corta |
| Purga del payload | Tras N días de estado terminal, `payload` es `null` y el trabajo sigue auditable |

### 19.5 Resiliencia y carga

| Qué | Por qué |
|---|---|
| Long-poll a través de un proxy con buffering | El repo ya se topó con esto (`X-Accel-Buffering: no`). Hay que verificarlo en la red del hospital, no en la oficina |
| Función cortada a los 60 s durante un `claim` | El cliente debe reconectar sin duplicar ni perder |
| **Escenario NAT** | 4-6 dispositivos simulados tras una IP + tráfico de navegador; medir `429` (**R6**) |
| Cola local durable | Cortar la red durante la ejecución; al volver, los eventos llegan sin duplicar |
| Reloj desfasado | `client_at` muy adelantado o atrasado no debe romper el orden (el orden lo da `id`/`seq`, no el reloj del cliente) |
| Payload grande | Nota con 30 secciones largas, contra el límite de 16 MB de `bodyParser` |

### 19.6 Sobre las herramientas existentes

**[HECHO]** Notes tiene `vitest` con 17 archivos de test y CI que corre `lint`, `typecheck`, `test`,
`build` (`.github/workflows/ci.yml`). Graph tiene scripts de verificación propios
(`npm run test` → `verify-institutional-catalog`, `verify-clinical-workflow`,
`verify-clinical-assistant`) y `audit:readiness`.
**[RECOMENDACIÓN]** Añadir `scripts/verify-operations-*.js` siguiendo el estilo de Graph, y sumarlos
al `npm test`. **No introducir un framework de tests nuevo en Graph** solo para esto: el estilo de
scripts verificables con `curl`/Node es el que el equipo ya usa para desplegar con confianza.

---

## 20. Preguntas que aún deben responder los responsables del proyecto

Ordenadas por impacto. Las marcadas **[BLOQUEA]** impiden empezar.

### Producto y clínica

1. **[BLOQUEA] ¿Qué HIS/SAP exactamente, en qué versión, y qué transacciones o pantallas concretas?**
   El repo solo tiene el patrón genérico `sapgui://SID/TCODE`. Sin esto no hay estimación posible.
2. **[BLOQUEA] ¿El HIS expone alguna API (HL7 v2, FHIR, servicio propio)?** Si la respuesta es sí,
   escribir por API es mucho más fiable que pilotar la UI y el diseño cambia sustancialmente. **Es la
   pregunta de mayor apalancamiento del proyecto.**
3. **¿Qué significa "completado parcialmente" para el hospital?** ¿Una nota a medias en el HIS es
   aceptable, o es peor que ninguna? Determina si la estrategia es *todo-o-nada* o *mejor esfuerzo con
   reporte* (§8-12). **Es una decisión clínica, no técnica.**
4. **¿El médico mira mientras la automatización trabaja, o es desatendida?** Cambia el diseño de la
   UI, la agresividad de la latencia y la política de cancelación.
5. **¿Quién es responsable del registro que escribe la automatización?** La firma existe en Notes,
   pero el HIS registraría una escritura hecha por un robot (**R15**). Pregunta legal, con implicación
   de auditoría.
6. **¿Se quiere evidencia visual (capturas) de la escritura?** Una captura de SAP con datos de
   paciente es PHI de pleno derecho: implica Storage con acceso restringido y retención propia
   (§15.5-4).
7. **¿Cuánto tiempo debe conservarse el contenido clínico en la cola tras terminar?** (§15.5-1;
   sugerencia: 7 días).

### Identidad, datos y organización

8. **[BLOQUEA] ¿Cómo obtiene Graph el `organization_id` de un encounter?** Hoy no existe (§7.2).
   Tres opciones válidas (columna nueva, join contra `consultations`, campo en el trabajo); hay que
   elegir una.
9. **¿Cómo se identifica al paciente en la práctica?** Con 2 pacientes registrados frente a 115
   encounters (§7.3), buscar en SAP exige un documento que el sistema puede no tener. ¿De dónde sale?
10. **¿Se unifica `patient_id` entre `consultations` (uuid FK) y `clinical_encounters` (text)?**
11. **¿Un médico tendrá varios computadores? ¿Varios médicos compartirán uno?** El diseño soporta
    ambos, pero el emparejamiento en la UI y la resolución de `target_device_id` cambian.
12. **¿Cuál es la regla vigente de `consent`?** La columna lo exige pero hay una migración que se
    llama `remove_clinical_encounter_consent_gate` (§8-11). Afecta al derecho de escribir en el HIS.

### Infraestructura y operación

13. **[BLOQUEA] ¿Se puede subir `windows-app` a GitHub?** Sin acceso al cliente, el plan del lado
    Windows es especulación (§2.3). Si no se puede por política, hace falta al menos una copia leíble
    del contrato y de los módulos de ejecución.
14. **¿La red del hospital permite HTTPS saliente a `graph-eight-pied.vercel.app`?** ¿Hay proxy con
    inspección TLS o lista blanca de dominios? ¿Conviene un dominio propio en vez de `*.vercel.app`?
15. **¿Qué plan de Vercel tiene la cuenta, y está activo Fluid Compute?** Determina si el techo de
    60 s se puede subir (verificado: `vercel.json` fija 60 y el código respeta 50; el plan **no** se
    verificó).
16. **¿Dónde está alojado Neo4j y con qué disponibilidad?** Si el trabajo depende de leer un workflow,
    Neo4j entra en el camino crítico de un registro clínico (**R10**).
17. **¿Cuántos médicos y consultas se esperan en el piloto?** Hoy el volumen es de piloto (93
    consultas, 1 dispositivo). El diseño recomendado sirve con holgura, pero conviene confirmar el
    orden de magnitud objetivo.
18. **¿Qué se hace con el proyecto Vercel `u-windows-backend`?** Está en `ERROR`, sin producción, y sus
    rutas ya fueron absorbidas. **[RECOMENDACIÓN]** archivarlo para que nadie construya ahí.
19. **¿Es `miracle-his-simulator` un simulador utilizable como banco de pruebas?** **[INFERENCIA]** por
    el nombre; si lo es, es el objetivo de pruebas end-to-end de la Fase 2.
20. **¿Quién corrige `CONTEXTO.md`, y cuándo?** (§7.10). Coste: minutos. Coste de no hacerlo: alguien
    construye Operations en el repo equivocado.

---

## Recomendación directa — las 10 respuestas

### 1. ¿Debemos ampliar la API actual o crear un módulo o servicio nuevo?

**Ampliar, con un módulo nuevo dentro de Graph. Ni reemplazar la API, ni crear un servicio aparte.**

La API actual es **suficiente y correcta para lo que hace**, y ya transporta exactamente los datos que
Operations necesita (`note_json`, `template_snapshot`, propiedad verificada por médico). Lo que le
falta no es capacidad de transporte: le falta **la noción de trabajo con estado** — cola, idempotencia,
lease, dispositivo destino. Eso son 3 tablas, 2 RPC y ~8 rutas **aditivas**, en el mismo repo, con el
mismo estilo, sin tocar un solo contrato existente. Un servicio separado añadiría un despliegue, un
secreto, un CORS y una fuente de deriva para resolver un problema de tres tablas.

Y la API **está en el repo correcto** (Graph): es el hub que ya define la costura con el cliente
Windows. Lo que hay que arreglar no es el código, es la documentación de Notes que llama a Graph
*"repo viejo/aparte"*.

### 2. ¿Qué mecanismo debe usar Graph Windows para recibir trabajos?

**Long-poll con `claim` atómico y lease, siempre saliente. `POST /api/v1/operations/jobs/claim`,
espera de ~40 s, `204` si no hay nada.**

Por qué no las otras:
- **Polling corto:** funciona, pero multiplica peticiones y choca con el limitador de 120/min por IP
  detrás del NAT del hospital.
- **SSE para entregar:** el patrón ya existe y funciona, pero no da atomicidad. Dos dispositivos
  recibirían el mismo aviso y necesitarías el `claim` igualmente. Es útil para *avisar*, no para
  *entregar*.
- **WebSocket:** en Vercel sigue acotado por `maxDuration` (la propia documentación acompaña la API de
  una sección de reconexión por ese motivo) y vive en una instancia, así que difundir exige pub/sub
  externo. Más piezas, misma limitación.
- **Supabase Realtime en el `.exe`:** obligaría a poner una credencial Supabase en el binario y abrir
  políticas de lectura — rompe la regla explícita de que *el cliente Windows habla solo con Graph*.

El long-poll con `claim` da atomicidad, durabilidad, cero conexiones entrantes, latencia de 1-3 s con
la app abierta, y se depura con `curl`.

### 3. ¿Necesitamos WebSockets para el MVP?

**No. Y probablemente tampoco después.**

No aportan nada que SSE no dé ya en este despliegue, y ninguno de los dos resuelve el problema real:
**el caso normal es que el computador esté apagado**. Un canal en tiempo real no guarda mensajes; una
cola sí. Cuando la latencia se vuelva un problema medido —no supuesto— la mejora correcta es
**Supabase Realtime para la pata del navegador** (que no pasa por Vercel) y **SSE contra Graph para
avisar al dispositivo**, ambos como *optimización sobre la cola*, nunca como sustituto.

### 4. ¿Cómo debería viajar la nota clínica?

**Las tres piezas juntas, en la respuesta del `claim` (no en un push):**

1. **`note_json`** tal cual, con `ensureClinicalDischarge` aplicado → habilita el mapeo campo a campo
   (`sections[].key` es la unidad de correspondencia).
2. **`rendered_text`** generado **por Graph** (no por el navegador) → es lo que `NoteFieldMatcher` ya
   espera como `noteContent`, y lo único que sirve si el HIS tiene un solo campo de texto libre.
3. **`template_snapshot`** — que **ya existe y ya es inmutable**, congelado con `snapshot_at` al crear
   el encounter. Esto responde por completo a *"cómo evitamos que una plantilla modificada cambie una
   nota histórica"*: **ya está resuelto**.

Viaja **solo** en la respuesta a un `claim` autenticado con token de dispositivo, y se **purga** del
trabajo a los N días de alcanzar un estado terminal. **Nunca** en eventos, logs ni en el panel admin.

### 5. ¿Dónde debería vivir la cola de trabajos?

**En Postgres, en el proyecto Supabase que ya existe (`zyvfamlhlmztliexvmej`), gestionada por Graph
con service-role.**

Es la única fuente de verdad. Ni memoria de proceso, ni `/tmp` (efímero por instancia en serverless),
ni el estado opaco de la sesión de `agent/turn` (desaparece con la máquina), ni Neo4j (ahí viven los
workflows, no los trabajos), ni un broker nuevo (no hay volumen que lo justifique, y añadiría un
sistema que operar).

Postgres da además, gratis, las dos garantías más difíciles: **unicidad** (índice único de
idempotencia) y **reclamo atómico** (`FOR UPDATE SKIP LOCKED`).

### 6. ¿Cómo debería reportarse el progreso?

**Por HTTP POST del dispositivo hacia Graph, y distinguiendo dos cosas que no son iguales:**

- **Progreso** → `POST …/jobs/:id/events`, **best-effort** (si se pierde, el siguiente corrige), con
  `seq` y `unique (job_id, seq)` para que el reenvío tras una caída sea seguro.
- **Resultado terminal** → `POST …/jobs/:id/result`, **debe confirmarse**: el cliente reintenta hasta
  recibir `ack`. Si esto se trata como telemetría best-effort —como hace el feed actual, donde *"el
  cliente se traga los errores"*— los trabajos quedan huérfanos.

En **tabla propia con campos tipados** (`from_status`, `to_status`, `progress_pct`, `current_action`,
`fields_ok[]`, `fields_failed[]`, `error_code`), **no** reutilizando `graph_windows_events`: su
`detail jsonb` es libre y el panel admin lo muestra, así que meter contenido clínico ahí pondría PHI
en un log visible a administradores de plataforma.

El médico lo ve por **polling acotado en Notes** (solo mientras hay trabajo activo), evolucionando a
Realtime en la Fase 6.

### 7. ¿Qué debe construirse primero?

**En este orden, y el orden importa:**

1. **Subir `windows-app` a GitHub.** Sin el código del cliente, la mitad del plan es especulación.
2. **Probar que se puede escribir en SAP con valores dinámicos** — 2-3 campos, tomados de una nota, no
   los grabados. Es el riesgo caro y la prueba es barata. **Si esto falla, el proyecto cambia de
   forma**, y es mejor saberlo antes de construir la cola.
3. **Identidad de dispositivo** (el plan ya escrito en `autenticacion-interna-plan.md`). No se mueven
   notas clínicas con una key compartida descompilable.
4. **La cola y el camino feliz** (Fase 2).
5. Escritura real + fallos parciales, robustez, y solo al final comandos interactivos y tiempo real.

**Deliberadamente NO primero:** la cola. Es el tramo que mejor conocemos y el que menos riesgo tiene;
construirlo antes de saber si SAP se puede escribir sería invertir el presupuesto de riesgo al revés.

### 8. ¿Cuáles son los principales riesgos?

Los cinco que de verdad deciden el resultado:

1. **Escritura errónea en la historia clínica** — paciente o campo equivocado. Mitigación: verificar
   la identidad del paciente **en pantalla antes de escribir**; si no coincide, `needs_doctor` y **no
   se escribe nada**.
2. **Suplantación de dispositivo** — la key está horneada en el `.exe` y es descompilable. Cualquiera
   podría reclamar notas clínicas de cualquier médico. Mitigación: enrolamiento per-install **antes**
   de la Fase 2.
3. **Que la escritura en SAP no funcione como se espera** — es lo único que el repo declara sin
   probar, y es el último tramo. Mitigación: prueba de concepto en la Fase 0.
4. **Doble registro en el HIS** — hoy no hay ninguna idempotencia en el sistema. Mitigación:
   índice único sobre `idempotency_key` derivada de `firma.hash`, más `claim` atómico con lease.
5. **Fuga de PHI a logs de plataforma** — el feed de eventos actual acepta payload libre y lo muestra
   en el panel admin. Mitigación: tabla propia con campos tipados y un test que falle el build si
   aparece contenido clínico.

Y uno organizativo que cuesta minutos y puede costar semanas: **`CONTEXTO.md` describe Graph como un
repo viejo**. Alguien va a construir la integración en el sitio equivocado.

### 9. ¿Qué información necesitas de nosotros antes de implementar?

**Cuatro bloqueadores, en orden de importancia:**

1. **El código de `windows-app`** (subirlo a GitHub, o dar acceso de lectura).
2. **Qué HIS/SAP exactamente**, versión, y las transacciones o pantallas concretas donde va la nota.
3. **Si el HIS tiene API** (HL7 v2, FHIR, o propia). Es la pregunta que más puede cambiar el diseño.
4. **Cómo obtiene Graph el hospital/`organization_id` de un encounter** — hoy esa columna no existe en
   `clinical_encounters`.

**Y cuatro decisiones que no son técnicas y no puedo tomar por ustedes:**

5. ¿Una nota **parcialmente** registrada en el HIS es aceptable, o es peor que ninguna?
6. ¿La automatización es **desatendida** o el médico la mira?
7. ¿Quién responde por el registro que escribe la automatización? (pregunta legal)
8. ¿Cuánto tiempo se conserva el contenido clínico en la cola, y se quiere evidencia visual?

Más dos de infraestructura que conviene verificar en sitio: **¿la red del hospital permite HTTPS
saliente a `*.vercel.app` sin romper un long-poll?** y **¿qué plan de Vercel tiene la cuenta?**

### 10. ¿Cuál sería el plan de implementación recomendado?

```
FASE 0 · Desbloquear y validar el riesgo caro
  Subir windows-app · PoC de escritura en SAP con valores dinámicos ·
  decidir el camino de sustitución · validar la red del hospital ·
  preguntar por la API del HIS · resolver el tenant · corregir CONTEXTO.md
  ── Puerta: si el PoC de SAP falla, se re-planifica antes de seguir ──

FASE 1 · Identidad de dispositivo   (implementa el plan ya escrito)
  operations_devices · enroll con key de bajo privilegio · requireApiKey dual env+DB ·
  device_id estable + token en graph.json · card de dispositivos en Studio ·
  emparejamiento desde Notes (el slot HIS/HCE ya existe)
  ── Verificación: dos instalaciones = dos dispositivos; revocar uno no afecta al otro ──

FASE 2 · La cola y el camino feliz   (el MVP)
  operations_jobs + operations_job_events · RPC claim (SKIP LOCKED + lease) ·
  RPC de expiración perezosa · crear/consultar/cancelar/reintentar ·
  claim/events/result/heartbeat · panel de estado en Notes con polling acotado ·
  cola local durable en el cliente · RPC aprobada→exportada + auditoría
  ── Verificación: firmar dos veces produce UN trabajo; el círculo se cierra en "Exportada" ──

FASE 3 · Escritura real y fallos parciales
  Valores de la nota → campos · verificación de paciente antes de escribir ·
  fields_ok/fields_failed reales · partial · plan cacheado (sin Neo4j en ejecución) ·
  reanudación en el reintento

FASE 4 · Robustez y observabilidad
  Cancelación entre pasos · reintento = trabajo nuevo · purga del payload ·
  límite de tasa por dispositivo · test que falla si hay PHI en eventos ·
  panel de Operations · campana con "pendientes de registrar"

FASE 5 · Comandos interactivos   (flujo secundario)
  kind='interactive_command' + priority + expires_at de 30-60 s ·
  catálogo cerrado de 8 comandos · CommandPalette (ya existe) · ack en el cliente

FASE 6 · Tiempo real   (solo con un disparador medido)
  SSE contra Graph para avisar al dispositivo (patrón ya escrito) ·
  Supabase Realtime para Notes · long-poll y polling se quedan como red de seguridad
```

**La forma del plan en una frase:** las dos primeras fases no construyen la integración — **eliminan
las dos razones por las que podría fracasar**. La integración en sí (Fase 2) es la parte fácil,
porque el 80 % de sus piezas ya están escritas y en producción.

---

## Anexo — Índice de evidencia

Todas las rutas son relativas a la raíz del repo indicado, en la rama
`claude/miracle-notes-graph-integration-2d66h1` (idéntica a `main`: Notes `35e32e3`, Graph `09653db`).

### Miracle Notes — `joseph1356k/Pagina-web-clientes-final`

| Archivo | Líneas | Qué demuestra |
|---|---|---|
| `lib/api/clinical.ts` | 1-13 | Reglas del cliente clínico: Bearer del médico, nada de service-role, sin PHI en consola |
| `lib/api/clinical.ts` | 45-91 | Forma exacta de `note_json` (`sections`, `discharge`, `warnings`, `missing_required_sections`) |
| `lib/api/clinical.ts` | 98-107 | Tipo de `EncounterTemplateSnapshot` con `snapshot_at` |
| `lib/api/clinical.ts` | 415-438 | `buildClinicalRequest` — función pura y testeable |
| `lib/api/clinical.ts` | 444-508 | `apiBaseUrl` (`NEXT_PUBLIC_API_BASE_URL`), `getAccessToken`, logging sin PHI (`:498`) |
| `lib/api/clinical.ts` | 514-732 | Inventario completo de endpoints consumidos |
| `lib/clinical/encounter-to-consultation.ts` | 1-12 | El puente y la regla de identidad (mismo id, 1:1, idempotente) |
| `lib/clinical/encounter-to-consultation.ts` | 42-114 | `noteJsonToSections`, `deriveMotivo`, `encounterToConsultation` |
| `app/app/consultas/actions.ts` | 20-96 | `signConsultationNote`: **SHA-256 del contenido**, CAS por estado, auditoría, bloqueo de demos |
| `app/api/stt/session/route.ts` | 7-50 | Patrón servidor→Graph con `X-API-Key`, secreto nunca al navegador |
| `app/api/clinical/note-from-photo/route.ts` | 206-240 | Igual + `AbortSignal.timeout(55_000)` bajo el `maxDuration` + degradación a `{connected:false}` |
| `lib/api/guard.ts` | 13-72 | `requireApiUser` y `rateLimit` de doble barrera, fail-open |
| `lib/mock/types.ts` | 7-12, 114-120 | `ConsultationStatus` incluye **`exportada`**, con su etiqueta |
| `app/app/providers.tsx` | 126-131, 596-630 | Carga acotada (300/500) y `upsertConsultation` que protege la nota firmada |
| `app/app/configuracion/ConfiguracionForm.tsx` | 68-77 | **Slot vacío** "Sistema de historia clínica (HIS/HCE)" |
| `components/app/NotificationsBell.tsx` | 25-29 | Campana que cuenta pendientes — extensible |
| `supabase/migrations/20260628000000_multi_tenant_organizations.sql` | 126-143 | Tabla `consultations` con `organization_id`, `firma`, `note`, `estado` |
| `supabase/migrations/20260721000000_consultation_immutability_and_addenda.sql` | 15-53 | Trigger de inmutabilidad: **solo** `aprobada → exportada` |
| `supabase/migrations/20260723010000_secretary_mark_exported.sql` | todo | RPC acotada; *"YA subió una nota aprobada al sistema propio del hospital"* |
| `next.config.ts`, `proxy.ts`, `package.json` | — | Next 16.2.9, React 19, `proxy.ts` en lugar de `middleware.ts`, Supabase SSR |
| `CONTEXTO.md` | 82, 88, 112 | Proyecto Supabase y Vercel; **y la descripción errónea de Graph** |
| `.env.example` | 10-20 | `NEXT_PUBLIC_API_BASE_URL` y `MIRACLE_API_KEY` (server-only) |
| `.github/workflows/ci.yml` | todo | CI: lint, typecheck, test, build |

### Graph — `joseph1356k/Graph`

| Archivo | Líneas | Qué demuestra |
|---|---|---|
| `vercel.json` | 7-12, 13-20 | **Una sola función** con `maxDuration: 60`; rewrite de todo `/api/*` |
| `api/index.js` | 1-15 | Entrada serverless que delega en la app Express completa |
| `web/server.js` | 97, 196 | `trust proxy = 1` en Vercel; límite de cuerpo de 16 MB |
| `web/server.js` | 100-105 | `/tmp/graph-generated` en Vercel — almacenamiento **efímero** |
| `web/server.js` | 307-309 | **Limitador de 120 req/min sobre todo `/api`**, por IP |
| `web/server.js` | 367-435 | Los tres carriles de autenticación, aislados a propósito |
| `web/api/requireClinicalAuth.js` | 1-9, 80-91, 94-138 | Verificación offline del JWT Supabase por JWKS; `req.clinicalUser` |
| `web/api/requireAuth.js` | 316-341 | `requireAccountAuth` + `attachWorkflowAccess` |
| `web/api/requireAuth.js` | 345-395 | **`MIRACLE_API_KEYS`: keys estáticas en env, `timingSafeEqual`** |
| `web/api/registerClinicalRoutes.js` | 11-32 | `resolveDoctorId` / `stableUuidFromString` |
| `web/api/registerClinicalRoutes.js` | 141-281 | Rutas de plantillas y encounters, con verificación de propiedad |
| `web/api/registerWindowsAgentRoutes.js` | 1-9 | *"absorbidas del backend viejo"*; contrato espejo de `Protocol.cs`, *"No tocar sin tocar el cliente"* |
| `web/api/registerWindowsTelemetryRoutes.js` | 1-7 | `agent/register` y `agent/events`; *"La telemetría NUNCA debe tumbar al agente"* |
| `web/api/registerWindowsPanelRoutes.js` | 14-23 | **`STREAM_MAX_MS = 50000` por el `maxDuration` de 60 s** |
| `web/api/registerWindowsPanelRoutes.js` | 67-79 | Por qué no `EventSource`: el token acabaría en el query string |
| `web/api/registerWindowsPanelRoutes.js` | 80-153 | SSE completo: `X-Accel-Buffering`, cursor `since`, evento `bye`, ping |
| `web/public/windows-live.js` | 22, 1233-1330 | Cliente con `fetch`+`getReader`, backoff, **fallback a polling 2500 ms** |
| `web/api/registerPublicApiRoutes.js` | 78-135 | Manifiesto de capacidades de `/api/v1` |
| `web/api/registerPublicApiRoutes.js` | 212-313 | Etapa `autofill` y `POST /api/v1/autofill/match` |
| `web/api/registerPublicApiRoutes.js` | 548-588 | `prepend-alignment` — **idempotencia bien hecha** (`already_present`) |
| `web/api/registerPublicApiRoutes.js` | 590-609 | `POST /api/v1/workflows/:id/plan` con `variables` |
| `web/api/registerWindowsDistributionRoutes.js` | 1-6, 62-70 | Distribución del instalador; `latest-installer` pública a propósito |
| `src/application/use-cases/AgentTurnService.js` | 1-23 | **El cliente conduce el bucle; el servidor resuelve un turno stateless.** Contrato "sagrado" |
| `src/application/use-cases/AgentTurnService.js` | 59-68, 122-128 | Catálogo MCP por superficie; inyección de `workflow_id` |
| `src/application/use-cases/WindowsTelemetryService.js` | 1-13, 76-104 | Upsert **por email**; `install_id` no es identidad |
| `src/application/use-cases/WindowsTelemetryService.js` | 109-155 | Lotes de hasta 200 eventos, heartbeat best-effort |
| `src/application/use-cases/ClinicalEncounterService.js` | ~35-45, 47-80 | **`buildTemplateSnapshot` con `snapshot_at`** — plantilla congelada |
| `src/application/use-cases/ClinicalEncounterService.js` | ~123-135 | `saveEditedNote` → `status: 'completed'` |
| `src/application/use-cases/NoteFieldMatcher.js` | 19-28, 44-59 | Campos que aporta el cliente; **umbral `confidence >= 0.75`** |
| `src/application/use-cases/NoteFieldMatchingPolicy.js` | 4-5 | El prompt: nota en markdown + campos pendientes → matches |
| `src/domain/windowsEngines.js` | 16-27 | El `LogBus` del cliente es **en memoria**; el puente a telemetría es lo que falta |
| `src/domain/windowsEngines.js` | 30-106 | Catálogo de motores, incluido **`sapgui`** con sus appIds |
| `src/domain/windowsEngines.js` | 140-272 | `engineForEvent`, `outcomeForEvent` (`null` significativo), `summarizeEngines` por versión |
| `src/infrastructure/SupabaseRestClient.js` | 1-60 | Cliente PostgREST con service-role, errores normalizados |
| `supabase/migrations/20260710042652_clinical_note_engine.sql` | sección 2 | Tabla `clinical_encounters`: `template_snapshot`, `status`, `patient_id` **text**, **sin `organization_id`** |
| `supabase/migrations/20260722120000_windows_live_users_and_events.sql` | 1-20 | **"El cliente Windows habla SOLO con el backend Graph"**; identidad = email, sin contraseña |
| `supabase/migrations/20260722120000_windows_live_users_and_events.sql` | 22-75 | Esquema de `graph_windows_users` y `graph_windows_events` (cursor `bigint`, `run_id`, `detail` libre) |
| `supabase/migrations/20260719120000_android_telemetry_and_client_config.sql` | 33-80 | **Molde más cercano a la cola**: `graph_app_users` (device_id PK) + `graph_prompts` (status, timestamps) + RPC `security definer` para upsert sin abrir SELECT |
| `web/public/studio-docs/distribucion-app-conectada.md` | 16-34, 52-58 | Key horneada en el build; **"una sola, compartida […] descompilable"** |
| `web/public/studio-docs/autenticacion-interna-plan.md` | todo | **Enrolamiento per-install: diseñado, decidido, NO implementado.** Alcance del primer corte |
| `docs/AGENTE-WORKFLOWS-CONTEXTO.md` | 9-11 | *"Graph decide QUÉ, la superficie decide CÓMO. Esa costura es sagrada"* |
| `docs/AGENTE-WORKFLOWS-CONTEXTO.md` | 23-33 | **`windows-app` sin remoto GitHub**; deploy de Graph; auth `/api/v1` |
| `docs/AGENTE-WORKFLOWS-CONTEXTO.md` | 59-97 | Modelo de workflows, `valueMode`, MCP (*"devuelve el PLAN; Graph nunca ejecuta"*), `WorkflowPlayer`, `SapGuiSurface` |
| `docs/AGENTE-WORKFLOWS-CONTEXTO.md` | 113-115, 122-124 | **La sustitución dinámica por contexto NO está implementada** |
| `docs/AGENTE-WORKFLOWS-CONTEXTO.md` | 130-132 | **"Falta probar grabación/ejecución real de workflows SAP en su máquina"** |
| `docs/AGENTE-WORKFLOWS-CONTEXTO.md` | 160-168 | Cómo verifica el equipo: `curl` contra producción |
| `ARQUITECTURA_Y_PLAN.md` | 22-27 | *"Sin el aprendizaje de workflows, el autofill no funciona"* |
| `.env.example` | 74-95 | Variables del módulo clínico: `SUPABASE_URL`, service-role, `CLINICAL_ADMIN_*` |

### Infraestructura verificada por MCP (no por lectura de código)

| Verificación | Herramienta | Resultado |
|---|---|---|
| Proyecto Supabase único | `Supabase.list_projects` | `miracle-app` / `zyvfamlhlmztliexvmej` / `us-east-1` / PG 17.6.1.127 / `ACTIVE_HEALTHY` |
| Esquema vivo | `Supabase.list_tables` | 28 tablas en `public`, **todas con RLS**; conteos de filas de §2.1; **ninguna tabla de trabajos ni de dispositivos** |
| Notes en Vercel | `Vercel.get_project` | `miracle-web`, nextjs, Node 24.x, producción **READY**, `itsmiracleai.com.co` |
| Graph en Vercel | `Vercel.get_project` | `graph`, Node 24.x, producción **READY**, `graph-eight-pied.vercel.app` |
| Backend Windows viejo | `Vercel.get_project` | `u-windows-backend`: último deployment **`ERROR`**, `target: null` → muerto |
| Otros proyectos | `Vercel.list_projects` | Incluye **`miracle-his-simulator`** y `landing-descargas` |
| WebSockets en Vercel | `Vercel.search_vercel_documentation` | Existen (`experimental_upgradeWebSocket`, `ws`), **pero la propia doc incluye reconexión con backoff "when Vercel Functions reach their maximum duration"** |
| Ramas | `git branch -a` (ambos repos) | Solo `main` + la rama de trabajo. **No existe ninguna rama de Windows** |
