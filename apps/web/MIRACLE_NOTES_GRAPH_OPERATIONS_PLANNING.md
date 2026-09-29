# Planning — Integración Miracle Notes ↔ Graph / Miracle Operations

> **Tipo de documento:** planificación técnica ejecutable. **No se implementó nada**: sin código,
> sin migraciones, sin cambios de archivos de producto, sin commits, sin push, sin PRs, sin deploys,
> sin cambios de variables de entorno.
>
> **Fecha:** 2026-07-26 (noche).
> **Repos y versiones analizadas:**
> - `joseph1356k/Pagina-web-clientes-final` — `main` @ `35e32e3` (clon local == remoto, verificado
>   contra la API de GitHub).
> - `joseph1356k/Graph` — clon local `main` @ `09653db`; **el `main` remoto avanzó HOY a `bc484ac`**
>   (PRs #8, #9, #10 merged entre 19:58 y 20:34 UTC). El delta remoto se leyó archivo por archivo
>   vía API de GitHub y está incorporado a este documento.
> - Cliente Windows (C#): **no accesible en esta sesión**. El PR #8 de Graph lo cita como repo
>   **"U-Windows-App"** — ver §18-I1.
>
> **Etiquetas de evidencia** usadas en todo el documento:
> `HECHO CONFIRMADO` (leído en código/esquema/infra real) · `INFERENCIA` · `RECOMENDACIÓN` ·
> `PREGUNTA ABIERTA` · `DEPENDENCIA DE OPERATIONS` · `DECISIÓN CONDICIONADA`.
>
> Este documento **corrige explícitamente** varios hallazgos del análisis previo
> (`MIRACLE_OPERATIONS_INTEGRATION_ANALYSIS.md`, misma sesión, pre-verificación remota) — ver §16.

---

## 1. Resumen ejecutivo

**El proyecto es más pequeño y está más maduro de lo que parecía hace unas horas.** Cinco hechos lo
definen:

1. `HECHO CONFIRMADO` — **El botón `Exportar a HC` ya existe y hoy es un engaño honesto.** Aparece
   con la consulta `aprobada` (`app/app/consultas/[id]/page.tsx:494` y móvil `:595`), llama a
   `exportNote(c.id)` (`app/app/providers.tsx:821-869`) y lo único que hace es cambiar
   `consultations.estado` a `'exportada'` (RPC `secretary_mark_exported` si el rol es secretaria;
   UPDATE directo en los demás roles) y mostrar *"Nota exportada a la historia clínica"*. **No toca
   Graph, no crea ningún trabajo, no tiene idempotencia.** El propio repo lo documenta como hueco
   (F9 en `DIAGNOSTICO.md:60`, C2 en `:115`). Hay **un solo embudo** (`exportNote`) con **un solo
   callsite** en la UI: el punto de inyección es mínimo y quirúrgico.

2. `HECHO CONFIRMADO` — **La fuente de verdad de la nota firmada es `consultations`, no
   `clinical_encounters.note_json`.** Las ediciones manuales del médico en el detalle van SOLO a
   `consultations.note` (`providers.tsx:916-929` → `persist`); `note_json` en Graph queda
   desactualizado. La firma calcula el SHA-256 **sobre `{note, resumen, codigos}` de
   `consultations`** (`app/app/consultas/actions.ts:56-64`) y un trigger de BD congela la fila.
   **Cualquier exportador que lea `note_json` puede subir al HIS una versión distinta de la
   firmada.** Esta es la decisión de diseño nº 1 del planning (§10, §22-A1).

3. `HECHO CONFIRMADO` — **La pieza técnica que faltaba se terminó HOY.** El `main` remoto de Graph
   mergeó la sustitución dinámica de valores (PR #9: `DynamicValueResolver` +
   `WorkflowExecutor.applyDynamicValues`): `POST /api/v1/workflows/:id/plan` con
   `variables.context` (texto libre) resuelve los pasos `valueMode:'dynamic'` contra ese contexto;
   un campo dinámico sin dato **hace fallar el plan listando qué falta** (nunca degrada en silencio
   al valor grabado). Verificado en vivo por el equipo contra producción
   (`docs/VALORES-DINAMICOS.md`, workflow `wf_1785097992574`). **La nota clínica puede entrar como
   `context` tal cual.** El análisis anterior marcaba esto como la limitación central sin
   implementar — queda corregido (§16).

4. `HECHO CONFIRMADO` — **Lo único que NO existe es el eslabón de entrega:** no hay en ninguno de
   los dos repos una cola, tabla de trabajos, comando pendiente ni mecanismo push hacia el cliente
   Windows (barrido exhaustivo, §6.4). Todo el sistema es *pull* iniciado por el cliente. La pieza
   a construir es exactamente una: **una tabla de exportaciones con claim y confirmación**, y es
   pequeña (1 tabla, 2 RPC, ~6 endpoints, 6 estados).

5. `HECHO CONFIRMADO` / `DEPENDENCIA DE OPERATIONS` — **El riesgo restante vive en el último tramo
   físico, y es del equipo de Operations:** el propio repo declara que el Aligner *"hoy solo alinea
   apps nativas: SAP y web todavía no"* (`windows-lab.js:264`), que *"falta ejercitar la grabación
   real de SAP en la máquina del cliente"* (`windows-lab.js:136`) y que la prueba física va
   *"cuando el cliente esté listo… siempre contra el ambiente de calidad"*
   (`docs/VALORES-DINAMICOS.md`). Por eso la estrategia central de este planning es **desacoplar la
   demo del SAP real**: un ejecutor simulado (script Node contra el contrato) permite demostrar el
   flujo completo Notes→Graph→resultado→`Exportada` sin una línea de C#, y sirve de especificación
   ejecutable para el equipo de Operations.

**Recomendación en una línea:** crear en Graph una entidad persistente `graph_note_exports`
(Supabase compartido) alimentada desde un nuevo endpoint del carril `/api/clinical`; el contenido
exportado es el **firmado** de `consultations`, verificado por hash; Operations lo consume por
*pull* (`claim`/`result` bajo `/api/v1/operations`) recibiendo el **plan ya sustituido** por el
DynamicValueResolver; Notes muestra el estado por **Supabase Realtime con fallback a polling**; y
`estado='exportada'` ocurre **solo** tras la confirmación — la transición exacta que el trigger de
inmutabilidad ya permite. La interacción nativa (Flujo B) se resuelve en fase 1 con **deep links
formalizados + `open_url` que ya existe**; el command bridge se documenta pero **no** se construye.

---

## 2. Objetivo del producto

Que el flujo clínico completo sea real de punta a punta:

1. El médico crea/abre la consulta, graba, genera la nota con plantilla, revisa/edita, **aprueba y
   firma** (todo esto ya existe y funciona — §8).
2. El botón **`Exportar a HC` dispara un proceso real**: la versión exacta firmada llega a
   Operations, Operations la registra en SAP/HIS, reporta el resultado, y Miracle Notes muestra el
   estado verdadero en cada momento.
3. La consulta queda `exportada` **únicamente** cuando el registro terminó bien.
4. Secundario: estudiar si Operations puede interactuar con Miracle Notes de forma **nativa**
   (API/deep links/comandos) en vez de automatizar visualmente nuestra propia aplicación.

## 3. Alcance

- Diseño del flujo de exportación (Flujo A): entidad persistente, contratos conceptuales
  Notes↔Graph y Graph↔Operations, estados, idempotencia, reintentos, recuperación, autorización,
  UI de estado, estrategia de pruebas y demo sin SAP.
- Estudio del Flujo B (interacción nativa): inventario de lo que ya se puede, qué formalizar ahora,
  qué dejar preparado.
- Correcciones al conocimiento previo del sistema (código verificado hoy, incluido el delta remoto
  de Graph).
- Plan por fases con trabajo paralelo entre equipos y dependencias explícitas de Operations.

## 4. Fuera de alcance

Conforme a las restricciones del encargo, este planning **no** diseña ni implementa: automatización
de SAP ni selectores concretos; mapeo detallado de campos del HIS (es del equipo de Operations —
aquí solo se define el **contrato de entrada** que ese equipo recibe); árboles específicos del
hospital; el cliente Windows ni sus instaladores; enrolamiento avanzado de dispositivos (se
referencia el plan ya escrito y se marca como condición de producción, §22-A8); control remoto
genérico; microservicios nuevos; mensajería externa; activación automática del micrófono;
plataforma genérica de comandos; automatización visual de Miracle Notes.

---

## 5. Estado actual confirmado de Miracle Notes

Todo `HECHO CONFIRMADO` sobre `main@35e32e3` salvo etiqueta contraria.

**Stack y despliegue.** Next.js 16.2.9 (App Router) + React 19 + Tailwind v4 + Supabase
(`@supabase/ssr`, `supabase-js`), desplegado en Vercel (`miracle-web`, producción READY,
`itsmiracleai.com.co` — verificado por API de Vercel). `proxy.ts` protege `/app`, `/superadmin`,
`/onboarding`. CI: lint + typecheck + vitest + build (`.github/workflows/ci.yml`).

**Datos.** Supabase `miracle-app` (`zyvfamlhlmztliexvmej`) — **el mismo proyecto que usa Graph**
(verificado en vivo: un solo proyecto en la cuenta). Tablas propias: `profiles`, `organizations`,
`patients`, `consultations`, `audit_events`, `appointments`, `consultation_addenda`,
`secretary_doctor_access`, `rate_limits`. Multi-tenant por `organization_id` con RLS
(`supabase/migrations/20260628000000_multi_tenant_organizations.sql`). Roles: `medico`,
`supervisor`, `admin`, `secretaria`, `superadmin`.

**Cliente HTTP clínico.** `lib/api/clinical.ts` — único punto de salida hacia Graph
(`NEXT_PUBLIC_API_BASE_URL`), `Authorization: Bearer <JWT Supabase>`, errores normalizados
(`ClinicalApiError` + `CLINICAL_ERROR_MESSAGES`), constructor puro testeable
(`buildClinicalRequest`, `:415-438`), logging sin PHI (`:498`). 16 funciones cubren plantillas,
encounters, transcript, generate-note, note, private-notes, regenerate, asistente. **Es el archivo
a extender para la exportación; no se crea otro cliente.**

**Rutas servidor propias que ya llaman a Graph `/api/v1` con la API key de plataforma**
(`MIRACLE_API_KEY`, server-only): `app/api/stt/session/route.ts` y
`app/api/clinical/note-from-photo/route.ts` (con `AbortSignal.timeout(55s)` bajo el `maxDuration`
de Graph y degradación a `{connected:false}`). Guardas reutilizables en `lib/api/guard.ts`
(`requireApiUser`, `rateLimit` doble barrera memoria+Postgres, fail-open).

**Store cliente.** `app/app/providers.tsx` (1.027 líneas): carga acotada al montar
(`CONSULTATIONS_CAP=300`, `PATIENTS_CAP=500`), `mutate()`→`persist()` (UPDATE directo a
`consultations` con reintentos 1s/3s/8s, `:310-346`), `remoteAudit` (INSERT `audit_events`),
`upsertConsultation` que **se niega** a espejar sobre nota firmada (`:596-608`).

**Firma.** Server action `signConsultationNote` (`app/app/consultas/actions.ts:20-96`): valida
sesión y estado (`borrador|revisada`), re-verifica que no sea consulta demo contra `audit_events`,
calcula `contentHash = sha256(JSON.stringify({note, resumen, codigos}))`, UPDATE condicional
(`.in('estado',[…])` — CAS contra firmas simultáneas) a `estado='aprobada'` + `firma{por,fecha,hash}`,
y auditoría. Desde ese momento el trigger
`private.enforce_consultation_immutability` (migración `20260721000000`) congela todo el contenido
y **solo permite la transición `aprobada → 'exportada'`**.

**Exportación actual.** Ver §9 — es local y sin efecto real.

**Tiempo real: no hay nada.** `public/sw.js` es un service worker pass-through deliberado (sin
cache, sin push, `:1-24`); no hay Supabase Realtime (`.channel(` = 0 usos), ni SSE, ni polling de
estado. `NotificationsBell` cuenta localmente `borrador|revisada`. **El canal de estado de la
exportación hay que construirlo** (§22-A5).

**Deep links reales** — ver §14.

## 6. Estado actual confirmado de Graph

`HECHO CONFIRMADO` sobre clon local `main@09653db` + delta remoto a `bc484ac` leído por API (§16).

**6.1 Despliegue y forma.** Express 5 empaquetado como **una sola función serverless** en Vercel
(`vercel.json`: `api/index.js`, `maxDuration: 60`; todo `/api/*` reescrito a ella). Producción
READY en `graph-eight-pied.vercel.app` (verificado por API de Vercel). Rate-limit global
`120 req/min` por IP sobre `/api` (`web/server.js:307-309`) con `trust proxy=1` — relevante para
hospitales detrás de NAT. Body limit 16 MB. Patrón SSE bajo el techo de 60 s ya resuelto y en
producción (`registerWindowsPanelRoutes.js`: tope 50 s + evento `bye` + `X-Accel-Buffering: no`;
cliente con `fetch`+`getReader` y fallback automático a polling — `windows-live.js:1233-1330`).

**6.2 Tres carriles de autenticación, aislados a propósito** (`web/server.js:367-435`):

| Carril | Middleware | Credencial | Identidad | Consumidor |
|---|---|---|---|---|
| `/api/clinical/*` | `requireClinicalAuth` | JWT Supabase del profesional (verificación offline por JWKS) | `req.clinicalUser` | Miracle Notes |
| `/api/v1/*` | `requireApiKey` | API key permanente (`MIRACLE_API_KEYS`, env, compartida) | `api-client:<label>` | Cliente Windows, extensión, rutas servidor de Notes |
| `/api/*` admin | `requireAccountAuth`+`attachWorkflowAccess` | sesión local firmada | `req.user` | Provider Studio |

`RECOMENDACIÓN`: la exportación usa exactamente los dos primeros carriles (crear/consultar por el
clínico; claim/result por `/api/v1`). No se crea un cuarto régimen.

**6.3 Módulo clínico.** `registerClinicalRoutes.js` + `ClinicalEncounterService` +
`SupabaseRestClient` (service-role — puede leer y escribir **cualquier** tabla del proyecto,
incluida `consultations` de Notes). `clinical_encounters` guarda `template_snapshot` congelado
(`snapshot_at`) y `note_json`; **no tiene `organization_id`** y su `patient_id` es `text` sin FK
(divergencias con `consultations`, ver §11).

**6.4 No existe ninguna cola ni comando pendiente.** Barrido exhaustivo de
`command|pending|queue|outbox|jobs|inbox|next_action` en `src/` y `web/api/`: los únicos hits son
tool-calls del turno LLM (viajan en el token de sesión), el guard anti-solapamiento del SSE del
panel, y el poll a GitHub Actions. **El modelo es pull iniciado por el cliente, siempre**:
`POST /api/v1/agent/turn` (una vez por turno), `POST /api/v1/workflows/:id/plan`,
`POST /api/v1/agent/{register,events}` (telemetría best-effort — *"NUNCA debe tumbar al agente"*).

**6.5 Piezas directamente reutilizables para la exportación:**
- **Sustitución dinámica (remoto, hoy):** `DynamicValueResolver` (umbral 0.7, prohibido inventar,
  `formatExample` solo da formato) + `WorkflowExecutor.applyDynamicValues` (sin context → intacto;
  dynamic sin resolver → error listando labels; `bindTo` comparte valor; selects por
  `selectedValue`). Dry-run disponible: `scripts/verify-live-plan.js <workflowId> "<context>"`.
- **NoteFieldMatcher** (`POST /api/workflows/:id/note-field-matches`, `/api/v1/autofill/match`):
  `{noteContent, fields[]}` → `{matches[{stepOrder, value, confidence≥0.75, evidence}],
  readyToSubmit}` — nota→campos ya resuelto; la forma de `matches` es la de `variables input_<n>`.
- **Contrato de pasos SAP** (remoto, PR #8): `Step` con `nodeKey/nodePath/nodeAction` para GuiTree,
  espejado con el cliente C#.
- **Patrones**: RPC `SECURITY DEFINER` acotada (`secretary_mark_exported` en Notes;
  `graph_upsert_app_user` en Graph), tablas RLS-sin-políticas solo-service-role
  (`graph_windows_*`, `graph_studio_progress`), SSE 50s+`bye`, token interno
  (`X-Graph-Internal-Token`).

**6.6 Identidad del cliente Windows (limitación).** API key única compartida horneada en el `.exe`
(descompilable — `studio-docs/distribucion-app-conectada.md:52-58`); registro por email sin
contraseña con upsert que fusiona máquinas (`graph_windows_users`). El plan de **enrolamiento
per-install está escrito y decidido pero no implementado**
(`studio-docs/autenticacion-interna-plan.md`). Ver `DECISIÓN CONDICIONADA` en §22-A8.

**6.7 Tabla `public.runs`.** Existe en el Supabase compartido (3 filas) pero **ningún** repo la
crea ni la usa (grep en ambos). Convención de Graph = prefijo `graph_`. `PREGUNTA ABIERTA`:
confirmar su dueño (posible herramienta externa). `RECOMENDACIÓN`: no reutilizarla.

## 7. Estado actual relevante de Operations

Lo verificable desde Graph (el cliente C# no fue accesible):

- `HECHO CONFIRMADO` — El equipo movió **hoy** las tres piezas que la exportación necesita del lado
  motor: pasos de árbol SAP (PR #8, contra *"el árbol real del hospital"* — 'Órdenes Clínicas'
  aparece 17 veces), sustitución dinámica end-to-end a nivel de plan (PR #9, verificada en vivo), y
  autoría explícita de `valueMode/bindTo` (PR #10, con arneses `e2e-dynamic-live` y
  `verify-live-plan`).
- `HECHO CONFIRMADO` — El cliente Windows ya manda `context` en las invocaciones de workflow
  (*"El cliente Windows ya manda el context (WorkflowMcpRunner) — no necesita cambios"*, PR #9).
- `HECHO CONFIRMADO` — Límites declarados por el propio equipo: Aligner solo apps nativas (SAP y
  web pendientes); grabación real de SAP en la máquina del cliente sin ejercitar; prueba física
  *"cuando el cliente esté listo"*, siempre contra **ambiente de calidad** (existe un SAP de
  calidad).
- `INFERENCIA` — El cliente C# vive en un repo llamado **U-Windows-App** (citado dos veces en PRs de
  hoy). El análisis anterior decía "sin remoto GitHub"; probablemente quedó obsoleto.
  `PREGUNTA ABIERTA`: confirmar y dar acceso de lectura al equipo de integración (§18-I1).
- `HECHO CONFIRMADO` — Telemetría por usuario operativa (`graph_windows_users/events`, panel con
  SSE, catálogo de motores en `windowsEngines.js` — añadir un motor `export` es una entrada en ese
  archivo y las tabs aparecen solas).

## 8. Flujo real desde creación de consulta hasta firma

`HECHO CONFIRMADO` — rastreado de punta a punta:

```
1 CREAR      /app/consultas/nueva (o QuickConsultationLauncher, o AgendaHoy con cita)
             → createClinicalEncounter (Graph POST /api/clinical/encounters; congela
               template_snapshot) → router.push('/app/consultas/en-vivo?encounter=<id>&record=1')

2 GRABAR     en-vivo: DictationPanel; STT en streaming va NAVEGADOR→proveedor directo
             (token temporal vía app/api/stt/session → Graph /api/v1/transcription/session);
             la transcripción se persiste a Graph (saveClinicalTranscript)

3 GENERAR    generateClinicalNote (Graph LLM) → note_json {summary, sections[{key,label,
             content,confidence,evidence}], discharge, warnings, missing_required_sections}

4 GUARDAR    en-vivo guardarNota(): PRIMERO saveEditedClinicalNote (Graph, status→'completed')
             y DESPUÉS upsertConsultation(encounterToConsultation(...)) — espejo en
             `consultations` con el MISMO uuid, estado 'borrador'
             (en-vivo/page.tsx:389-437; puente en lib/clinical/encounter-to-consultation.ts)

5 EDITAR     · en el detalle [id]: updateNote → mutate → persist → SOLO consultations.note
               (note_json en Graph queda VIEJO)                       ← divergencia clave
             · ajuste con IA (aiEdit): Graph primero (adjustNote + saveEditedClinicalNote),
               espejo después
             · en-vivo (si se vuelve): Graph primero, espejo después

6 REVISAR    markReviewed (opcional): borrador → 'revisada' (providers.tsx:871-877)

7 FIRMAR     signConsultationNote (server action): hash sha256({note,resumen,codigos}) →
             estado 'aprobada' + firma{por,fecha,hash}; trigger congela la fila;
             correcciones posteriores = consultation_addenda (append-only)
```

`HECHO CONFIRMADO` (detalle con consecuencia): el espejo `encounterToConsultation` copia **solo**
`note_json.sections` (key→`id`, label→`titulo`, content→`texto`) y `summary`→`resumen`;
**`discharge` (el cierre clínico universal: medicamentos, recomendaciones, signos de alarma) NO
viaja al espejo** y por tanto **no forma parte del contenido firmado**
(`lib/clinical/encounter-to-consultation.ts:42-50, 91-114`). `PREGUNTA ABIERTA` (§19-P6): ¿el
hospital necesita el bloque discharge en el HIS? Si sí, hay que decidir si se promueve al espejo
firmado (cambio en Notes) o se excluye de la exportación (estado actual).

## 9. Comportamiento real actual de `Exportar a HC`

`HECHO CONFIRMADO` — la hipótesis previa del encargo era correcta y se precisa:

- **Dónde:** `app/app/consultas/[id]/page.tsx:494-498` (desktop) y `:595-597` (barra móvil).
  Único callsite de `exportNote` en toda la app.
- **Cuándo:** `canExport = !demo && c.estado === "aprobada"` (`:170`). **Sin filtro de rol, a
  propósito** (comentario `:167-169`: marcar exportada *"es justamente la tarea de la
  secretaria… se abre a cualquier rol una vez el médico ya firmó"*). Con `exportada` el botón
  desaparece y queda un chip informativo.
- **Qué hace** (`providers.tsx:821-869`), por rama:
  - `secretaria` → `supabase.rpc('secretary_mark_exported')` (SECURITY DEFINER que solo mueve
    `aprobada→exportada` de médicos asignados) + estado local + `remoteAudit`.
  - cualquier otro rol → `mutate(id, c => ({...c, estado:'exportada'}))` → `persist()` = UPDATE
    directo (el trigger lo permite: es LA transición permitida) + `remoteAudit`.
  - En ambos casos: toast *"Nota exportada a la historia clínica."* **antes de que nada real
    ocurra en ningún HIS.**
- **Qué NO hace:** llamar a Graph, crear trabajo, esperar confirmación, distinguir éxito de
  fracaso, prevenir dobles ejecuciones más allá de la desaparición del botón.
- **Veredicto de reutilización:** el **embudo** se conserva (mismo nombre, mismo callsite), el
  **cuerpo** se reemplaza (§22-A3). La rama de secretaria/RPC **se conserva** re-etiquetada como
  "marcado manual" explícito — es la válvula de escape del piloto y ya está auditada (§22-A3).

## 10. Fuente de verdad de la nota firmada

**Decisión de este planning** (`RECOMENDACIÓN`, justificación completa en §22-A1):

- La versión exacta vinculada a la firma es la tupla `{consultations.note, resumen, codigos}` —
  es lo que `signConsultationNote` hashea y lo que el trigger congela.
- `clinical_encounters.note_json` **no participa en la exportación**: queda como borrador
  estructurado interno de Graph (puede estar desactualizado tras ediciones manuales, §8-5).
- Graph (service-role, mismo Supabase) lee `consultations` al crear el trabajo y **re-verifica el
  hash** recomputándolo con la misma serialización de `actions.ts` (riesgo nº 1 de la demo:
  divergencia de serialización — se mitiga con un vector de prueba compartido, §46-R1).
- Notas firmadas **sin** `firma.hash` (el campo es opcional en `SignNoteResult`): se exportan
  calculando el hash al crear el trabajo (`hash_source='computed_at_export'` en auditoría) — el
  trigger ya las congeló; exigir re-firma sería fricción sin ganancia de seguridad.
- **Adendas: no se exportan automáticamente en el MVP.** Una adenda posterior a `exportada`
  crea divergencia Notes↔HIS que hoy se resuelve por procedimiento (registrarla a mano en SAP),
  documentado como limitación honesta. Futuro: `kind='adenda_export'` sobre la misma entidad
  (§25) sin cambio de esquema.

## 11. Relación entre `consultations` y `clinical_encounters`

`HECHO CONFIRMADO`:

| Aspecto | `clinical_encounters` (Graph) | `consultations` (Notes) |
|---|---|---|
| id | uuid | **el MISMO uuid** — regla de identidad deliberada del puente (`encounter-to-consultation.ts:10-12`: 1:1, idempotente, navegable) |
| Nota | `note_json` estructurado (puede quedar viejo) | `note` NoteSection[] — **conserva las keys** (`id`==key) |
| Firma | no existe | `firma{por,fecha,hash}` + trigger de inmutabilidad |
| Organización | **no tiene** `organization_id` | `organization_id` NOT NULL + RLS multi-tenant |
| Paciente | `patient_id text` sin FK | `patient_id uuid` FK → patients |
| Estados | created…completed/failed (motor) | en_curso/borrador/revisada/aprobada/exportada (negocio) |

- **¿El mismo uuid se cumple siempre?** `INFERENCIA` acotada: se cumple para todo lo creado por el
  flujo actual (el espejo usa `encounter.id` como id de la consulta). Consultas **antiguas o de
  flujos alternativos** (p. ej. laboratorio/patología por foto, seeds) pueden existir en
  `consultations` **sin** encounter correspondiente — y es exactamente por eso que la exportación
  debe leer de `consultations` (siempre existe) y tratar el encounter como opcional. No hay
  contrato formal escrito; este documento lo formaliza como regla (§30).
- **Dónde viven las últimas ediciones:** en `consultations.note` (§8-5). **Qué queda vinculado a la
  firma:** esa misma tupla. **Fuente de la exportación:** `consultations` (§10).

## 12. Transformaciones actuales de la nota

`HECHO CONFIRMADO` — inventario de dónde se transforma y qué se puede perder:

1. `note_json` → espejo (`noteJsonToSections`): key→`id`, label→`titulo`, content→`texto`,
   `kind:'texto'` fijo. **Se pierden:** `confidence` y `evidence` por sección (aceptable: son
   metadatos de generación), **y todo `discharge`** (§8, PREGUNTA ABIERTA P6). `summary`→`resumen`.
   `codigos` nace vacío (el backend aún no genera códigos CIE/CUPS).
2. Espejo → PDF / "Copiar nota" (`[id]/page.tsx`, `lib/clinical/consultation-text.ts`): texto
   plano ordenado por secciones + adendas. Referencia útil para el `rendered_text` del payload.
3. Nota → campos del HIS: **no existe aún en el flujo clínico**, pero el mecanismo está:
   `NoteFieldMatcher` (nota texto + inventario de campos → matches por stepOrder) y ahora
   `DynamicValueResolver` (context + steps dynamic → valores por ejecución). Las **keys de sección
   sobreviven** hasta `consultations.note[].id`, así que el `rendered_text` puede llevar títulos
   estables.
4. `RECOMENDACIÓN` (dónde transformar para exportar): **Graph, al crear el trabajo**, construye
   `rendered_text` desde el `note` firmado (título en mayúsculas + texto por sección, mismo formato
   que los PDFs) y `context = rendered_text`. Renderizar en el servidor hace el texto reproducible
   y auditable, independiente de la versión del frontend.

## 13. Capacidades existentes reutilizables

Resumen operativo (detalles en §6.5 y en el análisis previo §6):

| Capacidad | Dónde | Rol en la integración |
|---|---|---|
| Cliente clínico centralizado | Notes `lib/api/clinical.ts` | Se extiende con 4 funciones de exportación |
| Guardas server | Notes `lib/api/guard.ts` | Para cualquier ruta servidor nueva |
| Embudo `exportNote` | Notes `providers.tsx:821` | Punto de inyección único |
| Firma + hash + trigger + RPC secretaria | Notes actions.ts + migraciones | Disparador, verificación e inspiración de la RPC final |
| Carriles de auth de Graph | `requireClinicalAuth` / `requireApiKey` | Los dos lados del trabajo |
| `SupabaseRestClient` service-role | Graph | Lee `consultations`, escribe la tabla nueva |
| DynamicValueResolver + plan | Graph (remoto) | Nota→valores de pasos SAP, con fallo honesto |
| `verify-live-plan.js` | Graph (remoto) | Dry-run de calidad de sustitución sin ejecutar |
| NoteFieldMatcher / autofill | Graph | Alternativa/complemento de mapeo (web) |
| Contrato pasos SAP (nodeKey…) | Graph (remoto) ↔ cliente C# | El ejecutor físico ya lo espeja |
| SSE 50s+bye / Realtime patrones | Graph / Supabase | Canales de estado |
| Telemetría + motores + panel | Graph `windowsEngines.js` | Observabilidad del motor `export` (una entrada) |
| RPC SECURITY DEFINER acotadas | ambos | Molde de `graph_mark_exported` y del claim |
| Distribución del .exe + latest-installer | Graph | Desplegar el cliente cuando Operations esté listo |
| `miracle-his-simulator` (Vercel) | infra | Banco del matcher (no del ejecutor — Aligner web pendiente) |

## 14. Deep links existentes

`HECHO CONFIRMADO` — inventario exacto (lo que hay, no lo que se desea):

| URL | Parámetros | Validación | Estado de contrato |
|---|---|---|---|
| `/app/consultas/nueva` | `paciente=<uuid>`, `appointment=<id>` | paciente inexistente → simplemente no preselecciona; cita sin `patient_id` verificado exige resolución explícita (anti-homónimos) | interno, formalizable |
| `/app/consultas/en-vivo` | `encounter=<uuid>` (obligatorio; sin él redirige a nueva), `paciente`, `appointment`, `record=1` | `record` se captura UNA vez al montar y se limpia de la URL (evitar reencender micrófono al remontar) | interno, formalizable |
| `/app/consultas/<id>` | `adenda=1` (enfoca el formulario de adenda) | id bajo RLS | interno, formalizable |
| `/app/consultas`, `/app/notas`, `/app/pacientes` | filtros/paginación (`estado`, `q`, `page`, `medico`…) | — | interno |
| **NO existe** | `plantilla=`, `tipo=` en nueva | — | añadirlos sería cambio menor en Notes si el Flujo B lo pide |

Reglas ya vigentes que el contrato de deep links debe heredar: **nunca nombres/documentos/PHI en la
URL, solo UUIDs opacos** (comentario explícito en `nueva/page.tsx:48-49` y en el botón "Regrabar");
sesión requerida (sin sesión → login → redirect, comportamiento correcto y esperado).

**Micrófono / `record=1`** — `HECHO CONFIRMADO`: el autostart corre desde un `useEffect`
(`DictationPanel.tsx:58-64`) tras una creación de encounter que fue un acto explícito del médico;
`getUserMedia` solo funciona sin gesto si el permiso ya está concedido y persistido para el
origen. **Lo único prometible a Operations:** "deja la pantalla lista para grabar; arranca solo si
el permiso ya estaba concedido; si no, queda a un clic". Nada de auto-encendido garantizado.

## 15. MCP, agente y acciones nativas existentes

`HECHO CONFIRMADO`:

- **Servidor MCP:** `POST /api/v1/mcp` (JSON-RPC 2.0 **stateless**, protocolo `2025-03-26`;
  `GET`→405). Superficie por headers `X-Surface-Origin/-Pathname`; sin origin → lista vacía.
  `tools/list` declara los workflows (nombre derivado del **id**, cap 30, un solo arg `context`);
  `tools/call` **devuelve el PLAN, nunca ejecuta** — y en remoto (PR #9) ahora pasa `context` como
  variable → el plan sale **sustituido**.
- **Catálogo base del cerebro** (`mcpCatalog.js`): 22 herramientas — 5 gestos + 17 acciones de
  sistema, incluidas **`open_url(url)`** y `launch_app(app)`. Los ejecutores viven en el cliente
  Windows. El prompt del cerebro ordena: workflow > `launch_app` > computer-use, y prohíbe
  terminal.
- **Bucle del agente:** `POST /api/v1/agent/turn` — el cliente conduce, el servidor decide un turno
  stateless; sesión = blob HMAC opaco. Contrato espejo con `Protocol.cs`, declarado sagrado.
- **No hay** acción "abrir pantalla de Miracle Notes", ni deep-link tipado, ni foco de ventana. El
  único gancho hacia una web externa es `open_url` genérico. (Consecuencias en §23/§24.)

## 16. Cambios recientes relevantes (y correcciones a hallazgos previos)

**Delta remoto de Graph (`09653db → bc484ac`, todo HOY 2026-07-26):**

| PR | Merged | Qué cambia para esta integración |
|---|---|---|
| **#9** `feature/dynamic-values` | 20:19 UTC | `DynamicValueResolver` (117 líneas) + `applyDynamicValues` en `WorkflowExecutor`: `variables.context` → valores por ejecución; **fallo honesto** listando labels; `bindTo` comparte; selects por clave; MCP pasa context como variable. Tests: `verify-dynamic-values.js` (8 casos, en `npm test`) |
| **#10** `feature/explicit-value-modes` | 20:32 | `addStep` persiste `valueMode/bindTo` explícitos ("el que autora manda"); **fix**: `updateFullWorkflow/copyWorkflow` ya no descartan la clasificación (el prepend-alignment la borraba); arneses en vivo `e2e-dynamic-live.js` y `verify-live-plan.js` |
| **#8** `feature/tree-node-steps` | 19:58 | `Step` + `nodeKey/nodePath/nodeAction` (GuiTree SAP) de punta a punta, retrocompatible; cita el repo C# **U-Windows-App** |
| **#7** `best-practices` | **ABIERTO** | CLAUDE.md, lint+typecheck, hooks, CI para Graph. `INFERENCIA`: mergeará pronto; la F1 debería rebasar sobre él |
| `bc484ac` | 20:34 | `docs/VALORES-DINAMICOS.md`: reglas, dry-run, runbook, evidencia en vivo, "ambiente de calidad" |

**Correcciones explícitas al análisis previo (`MIRACLE_OPERATIONS_INTEGRATION_ANALYSIS.md`):**

1. **§7.5 "La sustitución dinámica no está implementada" — OBSOLETO.** Implementada y verificada en
   vivo hoy (PR #9/#10). Queda pendiente solo la **ejecución física** del plan sustituido en la
   máquina SAP (lado C#).
2. **"windows-app sin remoto GitHub" — PROBABLEMENTE OBSOLETO.** PRs de hoy citan el repo
   **U-Windows-App**. `PREGUNTA ABIERTA` I1: confirmar y pedir acceso.
3. **La suposición implícita de exportar `note_json` — INCORRECTA.** El contenido firmado vive en
   `consultations` y `note_json` puede estar viejo (§8-5, §10). El diseño de payload del análisis
   anterior se corrige en §29.
4. **El botón de exportación** no era una hipótesis: existe, con el comportamiento exacto descrito
   en §9 (el análisis anterior no lo había localizado).
5. **Tabla `runs`**: confirmado que no pertenece a ninguno de los dos repos (el análisis anterior
   la listó sin atribución).

**Riesgo derivado de esta velocidad de cambio → §17.**

## 17. Riesgos de integrar contra código en evolución

1. `HECHO CONFIRMADO` — Graph mergeó 3 PRs **hoy** en el área exacta de esta integración
   (executor/plan/steps). Cualquier rama de integración larga quedará desactualizada en días.
   `RECOMENDACIÓN`: (a) la F1 se construye **sobre el main remoto del día**, no sobre el clon de
   esta sesión; (b) el módulo de exportación se acopla solo a **superficies estables**:
   `getExecutionPlanById(id, {context}, …)`, los carriles de auth, `SupabaseRestClient` — nunca a
   internals del executor; (c) el contrato con Operations vive en UN documento versionado
   referenciado por ambos repos (patrón ya usado por `clinical-api-contract.md`).
2. Contratos "sagrados" espejados con el C# (`Protocol.cs`, códigos HTTP de `agent/turn`,
   pasos `nodeKey/nodePath`): **no tocarlos**. Todo lo nuevo va en rutas nuevas
   (`/api/v1/operations/*`) — mismo criterio que ya salvó a `/api/clinical` de mezclarse con
   `/api/v1`.
3. PR #7 (tooling) abierto: coordinar el merge antes de F1 para no chocar con lint/CI nuevos.
4. `valueMode` de workflows viejos es todo `fixed` (pre-clasificador) — el workflow SAP de
   exportación debe **enseñarse o re-grabarse después** de PR #10, con modos explícitos donde
   importe. `DEPENDENCIA DE OPERATIONS`.
5. El propio equipo trabaja "directo en producción" (`AGENTE-WORKFLOWS-CONTEXTO.md:33`); la
   exportación introduce datos clínicos reales → los ensayos deben ir contra el **ambiente de
   calidad** de SAP y con consultas de prueba, nunca contra producción del hospital.

## 18. Incertidumbres

- **I1** `PREGUNTA ABIERTA` — ¿El cliente C# está en GitHub como **U-Windows-App**? ¿Puede el
  equipo de integración leerlo? Sin él, todo lo dicho del lado cliente es inferencia por contratos.
- **I2** `PREGUNTA ABIERTA` — ¿Qué transacción/pantalla exacta de SAP recibe la nota, y existe el
  workflow enseñado? (El árbol real ya se exploró — PR #8 — pero el workflow de "registrar nota" no
  consta.)
- **I3** `PREGUNTA ABIERTA` — ¿El HIS expone alguna API (HL7v2/FHIR/propia)? Sigue siendo la
  pregunta de mayor apalancamiento: con API, la automatización de UI pasa a plan B.
- **I4** `PREGUNTA ABIERTA` — ¿Quién es el dueño de `public.runs` (3 filas)?
- **I5** `PREGUNTA ABIERTA` — ¿La red del hospital permite HTTPS saliente a `*.vercel.app` y
  tolera un poll de 20-30 s? (El SSE del panel ya sufrió proxies con buffering.)
- **I6** `PREGUNTA ABIERTA` — ¿`discharge` debe llegar al HIS? Hoy no está en el contenido firmado
  (§8).
- **I7** `PREGUNTA ABIERTA` — ¿Cómo se identifica al paciente en SAP? `patients` tiene 2 filas
  reales frente a 93 consultas; en patología el nombre vive dentro de la nota. El
  `needs_doctor` por paciente no resoluble será frecuente al inicio.
- **I8** `PREGUNTA ABIERTA` — Plan de Vercel de la cuenta (¿se puede subir `maxDuration` si el
  resolver LLM del claim se acerca al techo?). Hoy no hace falta; conviene saberlo.
- **I9** `INFERENCIA` — El volumen es de piloto (93 consultas, 1 dispositivo, 1 org). Todas las
  decisiones de tamaño de este documento asumen ese orden de magnitud con puntos de extensión, no
  una escala hipotética.

## 19. Preguntas abiertas (consolidadas para responsables)

**P1** (=I3) ¿API del HIS? · **P2** (=I2) ¿Transacción SAP objetivo y workflow enseñado? ·
**P3** (=I1) Acceso a U-Windows-App · **P4** ¿Quién puede disparar la exportación automática:
solo médico dueño + admin/supervisor, o también secretaria? (§37 propone; confirmar) ·
**P5** ¿Retención del payload PHI en el trabajo? (propuesta: purga a 72 h del estado terminal) ·
**P6** (=I6) ¿discharge al HIS? · **P7** (=I7) ¿Identificador de paciente en SAP y su fuente? ·
**P8** ¿La demo oficial es con simulador (recomendado) o exige SAP de calidad? ·
**P9** (=I4) Dueño de `public.runs` · **P10** (=I5) Red del hospital ·
**P11** ¿Se corrige `CONTEXTO.md` de Notes (describe a Graph como "repo viejo… no es la web"),
riesgo organizativo ya señalado en el análisis previo?

---

## 20. Alternativas para la exportación

Tres alternativas reales (no se inventan opciones de relleno). La C es una variante de la A, se
presenta porque responde a la "Opción conceptual 2" del encargo.

### Alternativa A — Trabajo persistente en Graph con claim/result por pull *(recomendada)*

**Flujo:** Notes crea el trabajo por `/api/clinical` → Graph valida (firmada + hash) y persiste
`graph_note_exports` con snapshot → el ejecutor de Operations hace `claim` (pull, X-API-Key) y
recibe payload + **plan ya sustituido** → ejecuta en SAP → `result` con ack → Graph marca el
trabajo `completed` y la consulta `exportada` en una transacción → Notes lo ve por Realtime/poll.

**Componentes:** 1 tabla + 2 RPC + 4 rutas clinical + 2 rutas operations + hook de estado en Notes
+ ejecutor simulado. **Responsabilidades:** §38. **Cambios:** §39.

- **Persistencia:** Postgres compartido; snapshot inmutable en el trabajo; estado 100 % en BD.
- **Autenticación:** JWT clínico para crear/leer; X-API-Key (hoy) para claim/result
  (`DECISIÓN CONDICIONADA` §22-A8).
- **Estados/idempotencia/recuperación:** §28, §33, §36.
- **Vercel:** perfecto encaje — solo requests cortas; el claim con resolver LLM cabe en 60 s
  (verificado en vivo hoy por el propio equipo con la resolución dinámica).
- **Ventajas:** durabilidad total (sobrevive recarga, red, PC apagado, redeploys); idempotencia por
  índice único; cero conexiones entrantes al PC; contrato estable para Operations; demo sin SAP
  con un script; el 80 % de las piezas ya existe.
- **Desventajas:** latencia de arranque = intervalo de poll del ejecutor (20-30 s, irrelevante para
  el caso de uso); una tabla y dos RPC nuevas que mantener.
- **Riesgos:** serialización del hash (§46-R1); lease huérfano (mitigado: reclamable al vencer).
- **Complejidad:** baja-media. **Trabajo paralelo:** máximo (contrato congelado en F0 + simulador).
- **Razón para elegirla:** es la única que da a la vez durabilidad, idempotencia y desacoplamiento,
  usando solo patrones que el sistema ya tiene (pull del cliente, RPC acotadas, service-role).

### Alternativa B — Activación directa: Graph empuja el goal al agente (sin entidad propia… al principio)

**Flujo:** al pulsar Exportar, Graph inyecta el objetivo en el bucle consciente del agente
(`agent/turn`) o invoca el workflow vía MCP, y persiste solo un registro de intento.

- **Evaluación honesta:** no existe canal push — el turno lo inicia el cliente; habría que esperar
  a que el agente "pase por ahí" o construir… una cola (es decir, la Alternativa A con pasos
  extra). El bucle consciente es conversacional: sin ack transaccional, sin reintento, sin
  garantía de ejecución única; mezclar una transacción clínica con un loop LLM no determinista
  contradice la separación consciente/subconsciente del propio sistema. El registro de intento
  termina necesitando los mismos campos que el trabajo completo.
- **Ventajas:** ninguna neta sobre A. **Desventajas:** fiabilidad teatral; imposible demostrar sin
  el cliente real. **Razón para descartarla:** reinventa A sin sus garantías.

### Alternativa C — Coordinación apoyada solo en infraestructura existente (sin tabla nueva)

**Flujo:** reutilizar lo que ya hay como cola improvisada: `graph_windows_events` como bitácora de
intentos + `consultations.estado` como único estado + el ejecutor lee "pendientes" consultando
`consultations` con `estado='aprobada'` y una marca.

- **Evaluación honesta:** `graph_windows_events` es telemetría best-effort visible en el panel
  admin (meter PHI ahí es inaceptable, y no tiene unicidad ni transiciones); usar
  `consultations.estado` como cola exige estados nuevos en la máquina de la consulta (tocar el
  trigger de inmutabilidad y el enum de negocio, contaminando el dominio clínico con estados de
  transporte); no hay dónde guardar lease/attempts/result sin… añadir columnas que equivalen a la
  tabla nueva. La tabla `public.runs` existente no es de nadie conocido (§6.7).
- **Ventajas:** cero migraciones. **Desventajas:** todas las anteriores. **Razón para
  descartarla:** el ahorro es ilusorio; la "no-tabla" se paga con acoplamiento al dominio clínico
  y pérdida de garantías. *(El principio del encargo "no introducir cola externa por moda" se
  cumple en A: la 'cola' es una tabla en el Postgres que ya existe, no infraestructura nueva.)*

## 21. Comparación de alternativas

| Criterio | **A — Trabajo persistente + pull** | B — Goal al agente | C — Sin tabla nueva |
|---|---|---|---|
| Sobrevive recarga / red / PC apagado | **Sí** | No | Parcial |
| `exportada` solo tras confirmación real | **Sí (por construcción)** | Difuso | Requiere estados nuevos en consultations |
| Idempotencia | **Índice único** | No modelada | Frágil |
| Reintentos/lease | **Sí** | No | A mano |
| PHI contenida | **payload en tabla propia, purgable** | En el loop LLM | En telemetría visible admin ❌ |
| Demo sin SAP | **Script simulador** | Imposible sin cliente real | Difícil |
| Acoplamiento a código en evolución | **Bajo** (superficies estables) | Alto (loop del cerebro) | Alto (dominio clínico) |
| Trabajo paralelo Notes/Graph/Ops | **Máximo** | Bajo | Medio |
| Complejidad | Baja-media | Media (aparente baja) | Baja (aparente) |
| Vercel | **Excelente** | OK | OK |
| **Veredicto** | **Elegir** | Descartar | Descartar |

## 22. Arquitectura recomendada para la exportación

### A1. Fuente de verdad y verificación

(Decisión ya enunciada en §10.) Se exporta **lo que se firmó**: `{note, resumen, codigos}` de
`consultations`, leído por Graph con service-role al crear el trabajo, con **re-verificación del
hash** (`sha256(JSON.stringify({note, resumen, codigos}))` — replicar la serialización de
`actions.ts:56-64` literalmente; ambos lados son Node; **vector de prueba compartido** en el
contrato F0). Mismatch → `409 hash_mismatch`, no se crea trabajo. Notas sin hash →
`computed_at_export`. El snapshot queda **dentro del trabajo** (autocontenido y auditable aunque
después lleguen adendas). `note_json` no participa. Adendas: manual en MVP (§10).

Por qué NO re-sincronizar `note_json` al firmar (opción evaluada y descartada): convierte la firma
en transacción distribuida (un fallo de red dejaría "firmada pero no sincronizada"), no arregla las
93 notas históricas, y mantiene dos fuentes de verdad en vez de eliminar una.

### A2. Entidad persistente: `graph_note_exports`

Migración en `Graph/supabase/migrations/` (convención `graph_`; nombres **conceptuales** — se
fijan en F0):

```
graph_note_exports
  id               uuid PK default gen_random_uuid()
  kind             text NOT NULL default 'note_export'   -- extensión futura: 'command' (§25). Costo hoy: cero
  consultation_id  uuid NOT NULL UNIQUE                   -- LA idempotencia (§33)
  organization_id  uuid NOT NULL                          -- copiado de consultations al crear
  doctor_id        uuid NOT NULL                          -- medico_id de la consulta → RLS de lectura
  requested_by     uuid NOT NULL                          -- clinicalUser que pulsó Exportar (auditoría)
  workflow_id      text NOT NULL                          -- workflow SAP a ejecutar (piloto: 1 por org, config de Graph)
  status           text NOT NULL default 'pending'
                   CHECK (status IN ('pending','claimed','completed','needs_doctor','failed','cancelled'))
  attempts         int NOT NULL default 0                 -- ++ en cada claim; máx 3 (constante en código)
  claimed_by       text                                   -- identidad del ejecutor (hoy email registrado; per-install después)
  lease_expires_at timestamptz                            -- claim + 10 min; vencido ⇒ re-reclamable
  payload          jsonb NOT NULL                         -- snapshot PHI (abajo). Purgable
  payload_hash     text NOT NULL                          -- == firma.hash (o computed_at_export)
  hash_source      text NOT NULL default 'firma'          -- 'firma' | 'computed_at_export'
  result           jsonb                                  -- {outcome, folio?, unresolved_fields?[labels], detail_code?}
  error_code       text                                   -- tipado, sin PHI (§35)
  created_at / claimed_at / finished_at / updated_at / purged_at  timestamptz
```

`payload` (snapshot):

```json
{
  "note":          NoteSection[]  — firmado, con keys (id) y títulos,
  "resumen":       string, "codigos": [],
  "firma":         {"por","fecha","hash"},
  "patient_ref":   "<uuid o vacío — NUNCA nombre/documento>",
  "rendered_text": "MOTIVO DE CONSULTA:\n…\n\nIMPRESIÓN DIAGNÓSTICA:\n…",
  "context":       "<= rendered_text — listo para variables.context del DynamicValueResolver>"
}
```

No se guarda `template_snapshot` aparte: las keys/títulos ya van en `note` y los **campos** del
formulario los define el workflow, no la plantilla.

**Estados: 6, deliberadamente menos que los 8 del análisis previo.**
`pending → claimed → completed | needs_doctor | failed`, más `cancelled`.
- Sin `running`: `claimed` + lease lo cubre — no hay progreso intermedio que la UI necesite (llenar
  un formulario dura minutos; el reporte granular de progreso sería sobre-ingeniería hoy). Si un
  día se quiere una barra de progreso, se añade telemetría best-effort, no estados.
- Sin `expired` como estado: **lease vencido = condición re-reclamable** (`status='claimed' AND
  lease_expires_at < now()` en el claim), no una transición que gestionar.
- `needs_doctor` ≠ `failed` porque la acción del médico difiere: completar campos en SAP vs
  reintentar. Deriva directo del contrato del resolver (dynamic sin dato → falla listando labels).

**RLS y accesos:** RLS activado. Escritura/claim: **solo Graph con service-role** (cero políticas
INSERT/UPDATE para `authenticated` — patrón `graph_windows_*`). Lectura: política SELECT para el
médico dueño (`doctor_id = auth.uid()`) + admin/supervisor de la org (espejo de las policies de
`consultations`) — necesaria para Realtime (§A5). `DECISIÓN CONDICIONADA` (hardening opcional
posterior, no MVP): mover `payload` a tabla hermana solo-service-role si preocupa exponer al
médico su propia nota vía Realtime (no es fuga: es su nota).

**Índices:** `UNIQUE(consultation_id)`; parcial `(status, created_at) WHERE status='pending'` para
el claim FIFO; `(doctor_id, created_at desc)` para lectura.

### A3. Contrato Notes → Graph (carril `/api/clinical`, JWT)

| Endpoint conceptual | Reglas |
|---|---|
| `POST /api/clinical/exports {consultation_id}` | Valida: consulta existe y es de la org/médico del solicitante (§37); `estado='aprobada'` con `firma`; hash re-verificado; no-demo (mismo chequeo de `audit_events` que la firma). Construye snapshot + `rendered_text`. **Responde 201 `{export_id, status:'pending'}` inmediato** — jamás espera al ejecutor. Duplicado → **409 con el estado del trabajo existente** (idempotente para el frontend). |
| `GET /api/clinical/exports?consultation_id=` | Estado actual (fallback de polling y carga inicial). Devuelve `{export: {id, status, attempts, error_code, result_summary, created_at, finished_at}}` — **sin `payload`** (la UI no lo necesita; menos PHI en tránsito). |
| `POST /api/clinical/exports/:id/retry` | Solo desde `failed | needs_doctor | cancelled`. Resetea la MISMA fila a `pending` (attempts se conserva como historia; el máx aplica por claim), re-verifica que la consulta siga `aprobada`, audita. |
| `POST /api/clinical/exports/:id/cancel` | Solo desde `pending` (un `claimed` ya se está ejecutando: no hay cancelación remota de SAP en MVP — honestidad antes que botones placebo). |

**Cambio en Notes:** el cuerpo de `exportNote` se reemplaza: llama `createNoteExport()` (función
nueva en `lib/api/clinical.ts`), toast **"Exportación enviada al asistente"** — nunca "exportada" —
y la UI pasa a estado derivado del trabajo (§A5). La consulta **permanece `aprobada`** hasta la
confirmación. La rama actual de marcado directo/RPC secretaria **se conserva** como acción
secundaria explícita **"Marcar como exportada (manual)"** con confirmación que aclara *"esto NO
envía nada a SAP"*, deshabilitada mientras exista un trabajo `pending|claimed`. Razón: válvula de
escape del piloto (SAP caído, ejecutor apagado), ya auditada, y la secretaria conserva su función.

### A4. Contrato Graph → Operations (carril `/api/v1/operations`, pull)

| Endpoint conceptual | Reglas |
|---|---|
| `POST /api/v1/operations/exports/claim {device}` | RPC `graph_claim_next_note_export(claimed_by)`: `FOR UPDATE SKIP LOCKED`, FIFO sobre `pending` **o** `claimed` con lease vencido y `attempts < 3`; setea `claimed`, lease `now()+10min`, `attempts+1`. Sin trabajo → **204**. Con trabajo → `200 {export:{id, workflow_id, attempts, lease_expires_at}, payload, plan}`. |
| `POST /api/v1/operations/exports/:id/result` | Body `{outcome:'ok'|'needs_doctor'|'error', folio?, unresolved_fields?, error_code?, detail?}`. Solo el `claimed_by` vigente con lease válido. `ok` → transacción `graph_mark_exported` (§A6). Terminales idempotentes: repetir el mismo result devuelve ack sin re-transicionar. **El cliente DEBE reintentar el result hasta recibir ack** — a diferencia de la telemetría, esto nunca es best-effort. |

**El plan se resuelve en el claim, server-side** (`RECOMENDACIÓN`): Graph invoca internamente
`getExecutionPlanById(workflow_id, {context: payload.context}, {source:'operations', export_id})`.
Ventajas: (a) el cliente C# queda tonto — ejecuta los steps del contrato que ya espeja (PR #8);
(b) el fallo "dynamic sin resolver" aflora **en el claim**: el trabajo pasa directo a
`needs_doctor` con `unresolved_fields` (labels — no son PHI) **sin viaje al cliente**; (c) cabe en
los 60 s (la resolución en vivo se verificó hoy). **Plan B** [`DEPENDENCIA DE OPERATIONS`]: si el
lado C# prefiere pedir el plan él mismo (`POST /workflows/:id/plan` con el context del payload),
el claim devuelve solo payload — decidir en F0; default = server-side.

**Definición exacta de `completed`:** el trabajo pasa a `completed` **única y exclusivamente**
cuando llega `result {outcome:'ok'}` con ack — donde `ok` significa que el cliente ejecutó la
acción de guardado en el HIS y **verificó la señal de éxito de SAP** (diálogo/folio en status
bar), idealmente devolviendo `folio`. Qué constituye esa verificación en cada transacción es
[`DEPENDENCIA DE OPERATIONS`] y parte del contrato F0. La telemetría (`graph_windows_events`,
kinds nuevos `export_claimed`/`export_step` con ids y contadores, **cero contenido clínico**) es
solo observabilidad: **jamás transiciona estados**.

### A5. Estado en Miracle Notes

- **Primario — Supabase Realtime** sobre la fila del trabajo: Notes ya tiene `supabase-js`, la
  tabla vive en el mismo proyecto y la policy SELECT por médico aplica a `postgres_changes`.
  Cero cambios en Vercel, cero SSE nuevo. Requiere: añadir la tabla a la publication + la policy.
- **Fallback — polling 10 s** a `GET /api/clinical/exports?consultation_id=` mientras el detalle
  esté visible y el trabajo no esté terminal (para el caso "olvidamos la publication el día de la
  demo" y para navegadores/red hostiles).
- **Recarga:** al montar el detalle, un SELECT inicial fija el estado; la suscripción aplica
  deltas. **Nada vive en memoria** → recarga, cambio de pestaña y segundo dispositivo muestran lo
  mismo.

| status | Badge | Texto UI |
|---|---|---|
| `pending` | En cola | "Enviando a la historia clínica…" (+ si >5 min: "El asistente de escritorio no ha tomado la tarea — ¿está encendido el equipo?") |
| `claimed` | En proceso | "El asistente está registrando la nota en el HIS…" |
| `completed` | Exportada | "Exportada a la historia clínica" + fecha + folio si vino |
| `needs_doctor` | Requiere acción | "Quedaron campos sin completar en SAP: [labels]" + Reintentar / Marcar manual |
| `failed` | Falló | "No se pudo exportar (<código>)" + Reintentar / Marcar manual |
| `cancelled` | Cancelada | "Exportación cancelada" + Reintentar |

### A6. Transición final `aprobada → exportada`

RPC nueva **`graph_mark_exported(consultation_id, export_id)`** (SECURITY DEFINER), invocada por
Graph al procesar `result ok`, que en UNA transacción: (1) marca el trabajo `completed` (solo si
estaba `claimed` del reportante); (2) `UPDATE consultations SET estado='exportada' WHERE id=? AND
estado='aprobada'` — la transición exacta que el trigger permite (los triggers aplican también a
service-role; solo RLS se bypassea); (3) inserta `audit_events` *"Nota exportada a HC (automática)
· export <id> · folio <x>"*. Por qué RPC y no UPDATE suelto: atomicidad de las tres escrituras, y
hoy Graph **no escribe** `consultations` — la RPC hace explícita y estrecha esa única escritura
cross-boundary, espejando el patrón de `secretary_mark_exported`.
`failed`/`needs_doctor`/`cancelled`: la consulta **se queda en `aprobada`**; no se tocan ni el
trigger ni el enum de estados de negocio.

### A7. Probar sin SAP terminado — adapter/simulador reemplazable (diseño, no implementación)

1. **`scripts/simulate-operations-executor.js`** (Graph): loop `claim → imprime payload/plan →
   espera N s → result` con `--outcome ok|needs_doctor|error` y `--folio`. **Es el cliente de
   referencia**: el equipo web prueba TODA su UI contra él; Graph valida sus endpoints; para
   Operations es la **especificación ejecutable** del contrato C#. Habilita la demo E2E completa
   sin C# ni SAP. (Mismo patrón que los `verify-*` existentes: Node + API key, sin dependencias.)
2. **`verify-live-plan.js` + `miracle-his-simulator`**: QA de **calidad de resolución** (¿el plan
   sustituido trae los valores correctos de esta nota?) en dry-run. **No** sirve para ejecución
   E2E del cliente Windows (el Aligner aún no alinea web) — es banco del matcher, no del ejecutor.
3. El "adapter" es el propio contrato claim/result: **cualquier proceso** que lo hable es un
   ejecutor válido (simulador hoy, U-Windows-App mañana, un conector API del HIS pasado mañana si
   P1 resulta afirmativa). Reemplazable por construcción, sin tocar Notes ni Graph.

### A8. Seguridad — `DECISIÓN CONDICIONADA`

- **Aceptable YA (QA/demo, datos de prueba, 1 dispositivo):** claim/result con la X-API-Key
  compartida + mitigaciones baratas: `device` debe existir en `graph_windows_users`; lease corto;
  `claimed_by` auditado; **purga de `payload`** (`:= null`, `purged_at`) a las 72 h del estado
  terminal (script manual/cron en piloto); `error_code` y telemetría tipados sin PHI; labels de
  campos sí permitidos (no son PHI).
- **Bloquea producción con pacientes reales:** la key horneada en un `.exe` descompilable permite
  a quien la extraiga **reclamar trabajos y leer PHI**. El upgrade es el enrolamiento per-install
  ya diseñado (`autenticacion-interna-plan.md`) — y este diseño lo anticipa: el claim es el único
  choke point y los carriles de auth son middleware intercambiable, así que **el contrato no
  cambia** al endurecer. No bloquear la demo por esto; sí el rollout real.
- **PHI:** solo en `payload`; servido únicamente en el claim autenticado; nunca en telemetría,
  `error_code`, URLs ni logs (regla ya vigente en el cliente clínico de Notes, se extiende aquí).

### A9. Resumen del reparto (detalle por fases en §41)

F0 congelar contrato (esquema + endpoints + vector de hash + definición de `ok`) → F1 Graph
(tabla, RPCs, rutas, simulador) → F2 Notes en paralelo (exportNote, hook estado, UI, manual
gateado) → F3 **demo E2E con simulador (hito)** → F4 Operations (claim loop C#, ejecución física,
workflow SAP en calidad) → F5 hardening condicionado.

## 23. Alternativas para la interacción nativa

### N1 — API de dominio + deep links formalizados *(recomendada para fase 1)*

Formalizar como **contrato versionado** la lista cerrada de URLs que ya existen (§14):
`/app/consultas/<id>`, `?adenda=1`, `/app/consultas/nueva?paciente=&appointment=`,
`/app/consultas/en-vivo?encounter=[&record=1]` — con reglas: solo UUIDs opacos, nunca PHI, sesión
requerida (sin sesión → login → redirect es comportamiento aceptado), `record` = "listo para
grabar", nunca promesa de micrófono. Operations las abre con **`open_url`, que ya existe** en el
catálogo (los ejecutores viven en el cliente). Cambios en Notes: solo documentación (+ opcional
`plantilla=` en nueva si un caso real lo pide). **Ventaja:** valor inmediato con costo casi cero.
**Límite:** no controla foco de pestaña ni ejecuta mutaciones — que ningún caso actual requiere.

### N2 — Herramienta nativa en Graph: `open_miracle({screen, id, record?})`

Una systemTool nueva en `mcpCatalog.js` cuyo **ejecutor en el cliente** construye la URL desde el
contrato N1 (el cerebro nunca fabrica URLs → elimina URLs malformadas o con datos indebidos, y el
catálogo declara pantallas válidas). [`DEPENDENCIA DE OPERATIONS`: el ejecutor es C#.]
**Cuándo:** después de F3, si el uso real de N1 muestra que el cerebro se equivoca armando URLs.
No es prerequisito de nada.

### N3 — Command bridge (pestaña abierta recibe comandos semánticos)

**Evaluado y pospuesto.** Contra los hechos: Notes no tiene hoy canal de entrada (sw.js
pass-through, sin Realtime en producción), no hay garantía de pestaña abierta ni foco, y ningún
caso de la demo lo necesita. Su fiabilidad hoy sería teatral. **Diseño futuro documentado** (no
construir): misma tabla con `kind='command'` + TTL corto (30-60 s, un comando viejo jamás se
ejecuta) + Notes suscrito por el MISMO canal Realtime de A5 a filas `kind='command'` de su usuario
→ ejecuta navegación client-side → reporta por el MISMO endpoint de estado. Confirmación del
médico para cualquier acción que no sea pura navegación. **La exportación construye ~80 % de esta
infraestructura sin proponérselo** — esa es la relación correcta entre ambos (§25).

### N4 — Automatización visual de Miracle Notes

Solo como último recurso explícitamente justificado; hoy no hay ningún caso que la requiera y
contradice la prioridad de mecanismos nativos. Descartada para el planning.

## 24. Recomendación: qué implementar ahora y qué dejar preparado

**Ahora (junto a la exportación):** N1 — el documento de contrato de deep links (esfuerzo: horas,
riesgo: cero, no toca código). Nada más del Flujo B entra en F0-F3.

**Preparado, no construido:** N2 (`open_miracle`) como tarea candidata de F4+ para Operations;
N3 (command bridge) como diseño §23-N3 apoyado en la infraestructura de exportación; `plantilla=`
en nueva consulta si un caso lo pide.

**Nunca prometer:** auto-encendido de micrófono; foco de pestañas; acciones clínicas
(firmar/aprobar/exportar) por URL o comando sin confirmación del médico.

**Evaluación honesta pedida por el encargo:** incluir interacción nativa *como construcción* en
esta primera implementación **distraería** del objetivo (el único entregable con demanda real hoy
es la exportación); incluirla *como contrato de deep links* **simplifica** el futuro a costo ~cero.
Esa es la línea que se recomienda.

## 25. Relación entre exportaciones y comandos

- **Comparten** (por diseño, cuando el bridge llegue): la tabla (`kind` discrimina), el canal
  Realtime hacia Notes, el patrón claim/ack, la disciplina de PHI y auditoría.
- **Difieren** (y por eso `kind` existe desde el día 1, a costo cero): TTL (horas vs 30-60 s),
  reintentos (sí con máx vs **no** — un comando fallido se re-emite), destinatario (ejecutor
  Windows vs pestaña del médico), confirmación (no aplica vs requerida según acción), payload
  (PHI vs ids opacos).
- **Regla de no-confusión:** un comando jamás transiciona estados clínicos; una exportación jamás
  navega la UI. Si un caso futuro parece necesitar ambos, son dos filas.

---

## 26. Diagrama de componentes

```
┌─ NAVEGADOR DEL MÉDICO ────────────────────────────────────────────────────────┐
│ Miracle Notes (Next.js 16 · Vercel "miracle-web")                             │
│                                                                               │
│  [id]/page.tsx  ── botón "Exportar a HC" (canExport: aprobada)                │
│        │         └─ botón secundario "Marcar exportada (manual)" [gateado]     │
│        ▼                                                                      │
│  providers.tsx  exportNote()  ── CUERPO REEMPLAZADO ─────────┐                 │
│        │                                                     │                 │
│  lib/api/clinical.ts (Bearer JWT Supabase) ──────────────────┼──► POST /api/   │
│        │                                                     │    clinical/    │
│  useExportStatus (nuevo)                                     │    exports      │
│    ├─ SELECT inicial (supabase-js, RLS)                      │                 │
│    ├─ Realtime postgres_changes  ◄────────────────┐          │                 │
│    └─ fallback poll 10 s ─────────────────────────┼──────────┼──► GET  …/exports│
└───────────────────────────────────────────────────┼──────────┼─────────────────┘
                                                    │          │
┌─ GRAPH (Express 5 · una función serverless Vercel ·│maxDuration 60 s) ─────────┐
│                                                    │          ▼                 │
│  registerClinicalRoutes.js  (requireClinicalAuth · JWT del médico)             │
│    POST /exports · GET /exports · POST /:id/retry · POST /:id/cancel           │
│         │  valida: aprobada + firma + hash + no-demo + propiedad               │
│         │  construye snapshot + rendered_text + context                        │
│         ▼                                                                      │
│  OperationsExportService (nuevo)                                               │
│    ├── SupabaseRestClient (service-role) ──► lee consultations (firmado)       │
│    │                                     ──► escribe graph_note_exports        │
│    ├── WorkflowExecutor.getExecutionPlanById(wf, {context}) ──► plan sustituido │
│    │        └── DynamicValueResolver (LLM, umbral 0.7)   [remoto, PR #9]       │
│    └── RPC graph_claim_next_note_export · RPC graph_mark_exported              │
│                                                                                │
│  registerOperationsRoutes.js (nuevo · requireApiKey · X-API-Key)               │
│    POST /api/v1/operations/exports/claim   ──► 204 | {export, payload, plan}   │
│    POST /api/v1/operations/exports/:id/result ──► ack                          │
└────────────────────────────────▲───────────────────────────────────────────────┘
                                 │ SOLO conexiones SALIENTES (pull)
        ┌────────────────────────┴───────────────────┬──────────────────────────┐
        │                                            │                          │
┌───────┴────────────────────┐          ┌────────────┴──────────────┐  ┌────────┴────────┐
│ EJECUTOR SIMULADO (F1)     │          │ U-Windows-App (C#) [F4]   │  │ Conector API HIS │
│ scripts/simulate-          │          │ claim loop → WorkflowPlayer│  │ (si P1 = sí)     │
│ operations-executor.js     │          │ → SAP GUI Scripting        │  │                  │
│ claim→espera→result        │          │ → verifica folio → result  │  │                  │
└────────────────────────────┘          └───────────┬───────────────┘  └──────────────────┘
   cualquier proceso que hable                      │
   claim/result ES un ejecutor válido          ┌────▼──────────┐
   (adapter reemplazable por contrato)         │  SAP / HIS    │
                                               │ (calidad→prod)│
┌─ POSTGRES (Supabase "miracle-app" · COMPARTIDO) ─────────────┴──────────────────┐
│  consultations (Notes: firma + trigger inmutabilidad + estado)                  │
│  graph_note_exports (NUEVA: cola + snapshot + estado + lease)                   │
│  audit_events (append-only) · clinical_encounters · graph_windows_* (telemetría) │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 27. Diagramas de secuencia

### 27.1 Camino feliz

```
Médico  Notes        Graph                  Postgres         Ejecutor        SAP
  │       │            │                       │                │            │
  ├─firma─►│ signConsultationNote               │                │            │
  │       ├────────────────────────────────────►│ estado=aprobada, firma{hash}
  │       │            │                       │ trigger congela │            │
  │       │            │                       │                │            │
  ├─"Exportar a HC"───►│                       │                │            │
  │       ├─POST /api/clinical/exports (JWT)──►│                │            │
  │       │            ├─ lee consultations ──►│                │            │
  │       │            ├─ sha256({note,resumen,codigos}) == firma.hash ✓     │
  │       │            ├─ no-demo ✓ · propiedad ✓                            │
  │       │            ├─ INSERT graph_note_exports (pending, snapshot)──►│  │
  │       │◄─201 {export_id, status:'pending'}  │                │            │
  │◄──────┤ toast "Exportación enviada al asistente"  (NO "exportada")       │
  │       ├─ Realtime SUBSCRIBE + SELECT inicial ──────────────►│            │
  │◄──────┤ "En cola"  │                       │                │            │
  │       │            │◄─POST /v1/operations/exports/claim ─────┤            │
  │       │            ├─ RPC claim (SKIP LOCKED, lease +10min, attempts+1)►│ │
  │       │            ├─ getExecutionPlanById(wf,{context}) → plan sustituido │
  │       │            ├─200 {export, payload, plan} ───────────►│            │
  │       │◄─Realtime: status='claimed' ◄──────┤                │            │
  │◄──────┤ "El asistente está registrando…"    │                ├─alinear───►│
  │       │            │                       │                ├─escribir──►│
  │       │            │                       │                ├─guardar───►│
  │       │            │                       │                │◄─folio ────┤
  │       │            │◄─POST …/result {ok, folio} ─────────────┤            │
  │       │            ├─ RPC graph_mark_exported (1 transacción):            │
  │       │            │    export→completed · consultations aprobada→exportada
  │       │            │    · INSERT audit_events                │            │
  │       │            ├─ack ──────────────────────────────────►│            │
  │       │◄─Realtime: status='completed' ◄─────┤                │            │
  │◄──────┤ "Exportada a la historia clínica · folio 4711"       │            │
```

### 27.2 Campos sin resolver → `needs_doctor` (sin viaje al cliente)

```
Ejecutor ─claim─► Graph ─getExecutionPlanById({context})─► DynamicValueResolver
                    │                                        │
                    │◄── Error: "No pude resolver del contexto los campos
                    │     dinámicos: «Nº documento»"          │
                    ├─ UPDATE export: status='needs_doctor',
                    │   error_code='unresolved_fields',
                    │   result.unresolved_fields=['Nº documento']   ← labels, NO PHI
                    ├─ 204 al ejecutor (no hay trabajo entregable)
                    ▼
Notes ◄─Realtime─ "Requiere acción: quedaron campos sin completar en SAP:
                   Nº documento"  [Reintentar] [Marcar exportada manual]
```

`RECOMENDACIÓN`: que el fallo aflore en el claim (no en el cliente) es lo que hace este camino
barato y auditable — el trabajo nunca sale de Graph con un plan incompleto.

### 27.3 El ejecutor muere a mitad (lease vencido)

```
Ejecutor ─claim─► claimed, lease=T+10min, attempts=1
   ✗ (PC apagado / red / proceso muerto — sin result)
   … T+10min …
Ejecutor' ─claim─► RPC ve: status='claimed' AND lease_expires_at < now() AND attempts < 3
                   → re-reclama la MISMA fila, attempts=2, lease renovado
   ├─ ejecuta → result ok → completed
   (si attempts alcanza 3 sin ok → failed, error_code='max_attempts')
```

`INFERENCIA` con consecuencia práctica: en un reintento el formulario de SAP puede tener campos ya
escritos del intento anterior. `DEPENDENCIA DE OPERATIONS`: el ejecutor debe **leer la pantalla
antes de escribir** (capacidad que ya existe: `SapContextReader`/inspector) o el workflow debe
empezar desde una pantalla limpia. Se documenta en el contrato F0.

### 27.4 Doble clic / doble pestaña

```
Notes(pestaña A) ─POST /exports─► INSERT ✓ → 201 {id, pending}
Notes(pestaña B) ─POST /exports─► UNIQUE(consultation_id) viola
                                 → 409 {export_id, status:'pending'}  ← mismo trabajo
Ambas pestañas ─Realtime/poll─► el mismo estado. Cero trabajos duplicados.
```

### 27.5 Recarga del navegador a mitad de vuelo

```
(estado real: claimed)
Médico recarga F5 → [id]/page.tsx monta → SELECT graph_note_exports WHERE consultation_id
                  → "El asistente está registrando…" (estado correcto, derivado de BD)
                  → SUBSCRIBE Realtime aplica deltas desde ahí
```

## 28. Modelo conceptual de estados

```
                                    ┌──────────────► cancelled ──retry──┐
                                    │  (médico, solo desde pending)     │
                                    │                                   ▼
   ∅ ──POST /exports──► pending ────┴──claim──► claimed ──result ok──► completed ✔
        (Notes)          ▲   ▲                    │                    (terminal, y
                         │   │                    ├─result needs_doctor─► needs_doctor
                         │   │                    │                          │
                         │   │                    ├─result error──► failed ◄──┤
                         │   │                    │                    │      │
                         │   └──lease vencido ────┘                    │      │
                         │      (attempts < 3)                         │      │
                         │                                            │      │
                         └────────────────retry (médico)──────────────┴──────┘
                                (solo desde failed | needs_doctor | cancelled)

   lease vencido con attempts >= 3 ──► failed (error_code='max_attempts')
   claim con plan irresoluble ──────► needs_doctor (error_code='unresolved_fields')
```

**Quién puede mover cada transición** (§37 detalla la autorización):

| Transición | Autorizado | Verificación |
|---|---|---|
| `∅ → pending` | Médico dueño / admin / supervisor vía `/api/clinical` | JWT + propiedad + `aprobada` + hash + no-demo |
| `pending → claimed` | Solo el ejecutor con X-API-Key | RPC atómica `SKIP LOCKED` |
| `claimed → completed/needs_doctor/failed` | Solo `claimed_by` con lease vigente | Comparación en la ruta `result` |
| `claimed → pending` (lease vencido) | Solo Graph (dentro del claim siguiente) | `lease_expires_at < now() AND attempts < 3` |
| `claimed → failed` (agotado) | Solo Graph | `attempts >= 3` |
| `pending → cancelled` | Médico | Propiedad; **no** desde `claimed` (no hay cancelación remota de SAP en MVP) |
| `terminal → pending` (retry) | Médico | Propiedad + consulta sigue `aprobada` |
| `completed → *` | **Nadie** | Terminal absoluto |

**Estado de la consulta:** solo `completed` produce `aprobada → exportada` (§22-A6). Los demás
terminales dejan la consulta en `aprobada` — **no se añade ningún estado nuevo a la máquina
clínica**, no se toca el trigger ni el enum.

## 29. Modelo conceptual de persistencia

Una sola tabla nueva (§22-A2). Decisiones de modelado y su razón:

| Decisión | Razón |
|---|---|
| **Snapshot** del contenido firmado dentro del trabajo (no solo referencia) | El trabajo es autocontenido y auditable; el ejecutor recibe exactamente lo firmado sin volver a resolver la fuente; una adenda posterior no altera lo que se envió |
| **+ `payload_hash`** junto al snapshot | Ata el snapshot a la firma; permite auditar después que lo exportado era lo firmado |
| `UNIQUE(consultation_id)` | Es **una** transición de negocio por consulta. Idempotencia estructural, no de aplicación |
| `attempts` + máx en código (no columna) | El límite es política, no dato; cambiarlo no exige migración |
| Lease (`claimed_by` + `lease_expires_at`) en vez de estado `expired` | Menos estados, misma garantía: vencido = re-reclamable |
| `error_code` tipado + `result.unresolved_fields` con **labels** | Diagnóstico sin PHI; el médico ve qué falta sin exponer contenido |
| `purged_at` | Retención explícita del PHI; el trabajo sobrevive a la purga como registro auditable |
| `kind` desde el día 1 | Extensión a comandos (§25) a costo cero; no se construye nada para ello ahora |
| `organization_id` copiado al crear | `clinical_encounters` no lo tiene (§11); el trabajo sí debe tenerlo para aislamiento y para futuras políticas por tenant |
| `requested_by` ≠ `doctor_id` | Un admin/supervisor puede disparar la exportación de la nota de otro médico; la auditoría debe distinguirlo |
| **Nada** en memoria de proceso, `/tmp` ni en el token de sesión | Vercel es serverless: `/tmp` es efímero por instancia y la sesión del agente muere con la máquina |
| **No** se reutiliza `graph_windows_events` para el estado | Es best-effort por diseño y visible en el panel admin → PHI y sin unicidad (§20-C) |
| **No** se reutiliza `public.runs` | No pertenece a ningún repo conocido (§6.7) |

## 30. Contrato conceptual Miracle Notes ↔ Graph

`RECOMENDACIÓN` — conceptual; nombres exactos se fijan en F0.

**Reglas del contrato (invariantes que ambos lados prometen):**

1. Notes envía **solo el identificador de la consulta**; nunca el contenido de la nota. Graph
   resuelve el contenido desde la fuente firmada. Razón: elimina la posibilidad de que el frontend
   envíe algo distinto de lo firmado, y reduce PHI en tránsito.
2. Graph es la **autoridad de validación**: aunque la UI solo muestre el botón con `aprobada`, el
   backend re-verifica estado, firma, hash, no-demo y propiedad. La UI no es una barrera de
   seguridad.
3. La respuesta a crear es **inmediata y no bloqueante**; el resultado nunca viaja en esa respuesta.
4. Crear dos veces la misma exportación **no crea dos trabajos**: `409` con el estado del existente
   (el frontend lo trata como éxito idempotente).
5. La lectura de estado **no incluye `payload`**.
6. El identificador de la consulta y el del encounter coinciden hoy (§11) pero el contrato usa
   **`consultation_id`** como clave — la exportación es de la consulta firmada, no del encounter.
7. Errores con **código estable** (mapeables a `CLINICAL_ERROR_MESSAGES` de Notes) y mensaje apto
   para el médico; nunca JSON crudo ni PHI en logs.

**Superficie conceptual:** `POST /exports`, `GET /exports?consultation_id`, `POST /:id/retry`,
`POST /:id/cancel` (detalle en §22-A3).

**Códigos de error del contrato** (nuevos en `CLINICAL_ERROR_MESSAGES`):

| Código | Significado | Mensaje al médico (borrador) |
|---|---|---|
| `EXPORT_NOT_SIGNED` | la consulta no está `aprobada`/sin firma | "Firma la nota antes de exportarla." |
| `EXPORT_HASH_MISMATCH` | el contenido no coincide con la firma | "La nota no coincide con su firma. Contacta al administrador." |
| `EXPORT_DEMO_BLOCKED` | consulta de demostración | "Esta es una consulta de demostración y no puede exportarse." |
| `EXPORT_ALREADY_EXISTS` | ya hay trabajo (409) | (no se muestra: la UI adopta el estado devuelto) |
| `EXPORT_NOT_FOUND` | id inexistente o ajeno | "No encontramos esa exportación." |
| `EXPORT_INVALID_TRANSITION` | retry/cancel desde estado no permitido | "Esta exportación ya no admite esa acción. Recarga la página." |
| `EXPORT_NOT_CONFIGURED` | falta workflow/config de la organización | "La exportación automática no está configurada. Contacta al administrador." |

## 31. Contrato conceptual Graph ↔ Operations

`RECOMENDACIÓN` + `DEPENDENCIA DE OPERATIONS` (los puntos marcados los cierra ese equipo en F0).

**Invariantes:**

1. **Pull siempre.** Graph nunca inicia conexión hacia la máquina del médico. Ningún puerto
   entrante. (Es el modelo que el sistema ya usa para todo, §6.4.)
2. **Un trabajo, un ejecutor:** el claim es atómico; el `result` solo lo acepta el `claimed_by`
   vigente con lease válido.
3. **El progreso es opcional; el resultado es obligatorio.** La telemetría puede perderse sin
   consecuencia; el `result` debe reintentarse hasta recibir ack. Repetir un `result` terminal
   devuelve ack sin re-transicionar.
4. **Graph decide QUÉ, el ejecutor decide CÓMO** (costura ya declarada sagrada en el repo): Graph
   entrega el plan; el ejecutor no interpreta la nota ni mapea campos por su cuenta.
5. **PHI solo en la respuesta del claim.** Nada de contenido clínico en telemetría ni en
   `error_code`.

**Qué recibe el ejecutor en el claim:**

```
{
  export:  { id, workflow_id, attempts, lease_expires_at },
  payload: { note[], resumen, codigos[], firma{por,fecha,hash},
             patient_ref, rendered_text, context },
  plan:    { steps[...], variables{...}, ... }   // ya sustituido (o ausente si Plan B, §22-A4)
}
```

**Qué reporta:**

```
{ outcome: 'ok' | 'needs_doctor' | 'error',
  folio?: string,                    // evidencia de guardado en el HIS
  unresolved_fields?: string[],      // LABELS, nunca valores
  error_code?: string, detail?: string }   // tipados, sin PHI
```

**Puntos abiertos que cierra Operations en F0** (`DEPENDENCIA DE OPERATIONS`):

| # | Decisión | Impacto si no se cierra |
|---|---|---|
| D1 | ¿El plan se resuelve server-side en el claim (default) o lo pide el cliente? | Cambia la forma de la respuesta del claim |
| D2 | Qué constituye **"guardado confirmado"** en cada transacción SAP (diálogo, folio en status bar) | Sin esto, `completed` no es verificable → riesgo de falso éxito |
| D3 | Formato y disponibilidad del `folio` | Solo afecta la UI (campo opcional) |
| D4 | Intervalo del poll del claim (propuesta: 20-30 s) | Rate-limit por IP en hospitales con NAT (§46-R4) |
| D5 | Identidad del ejecutor en `claimed_by` (hoy email registrado) | Auditoría y futuro enrolamiento |
| D6 | ¿El ejecutor lee la pantalla antes de escribir en un reintento? | Riesgo de duplicar dentro del formulario (§27.3) |
| D7 | Workflow SAP objetivo enseñado, con `valueMode` explícitos post-PR#10 | Sin él no hay nada que ejecutar (§18-I2) |
| D8 | Cola local durable en el cliente para reintentar el `result` | Trabajos huérfanos si se pierde la red al final |

## 32. Contratos conceptuales para deep links / acciones nativas

`RECOMENDACIÓN` — contrato versionado (v1), lista **cerrada**:

| Acción | URL | Params permitidos | Semántica prometida |
|---|---|---|---|
| Abrir consulta | `/app/consultas/<uuid>` | — | Muestra el detalle (o login→redirect) |
| Abrir consulta en modo adenda | `/app/consultas/<uuid>?adenda=1` | `adenda=1` | Enfoca el formulario de adenda |
| Nueva consulta | `/app/consultas/nueva` | `paciente=<uuid>`, `appointment=<uuid>` | Preselecciona si el recurso existe y es accesible; si no, no preselecciona (sin error) |
| Consulta activa | `/app/consultas/en-vivo` | `encounter=<uuid>` (obligatorio), `paciente`, `appointment`, `record=1` | Abre la pantalla de grabación; `record=1` = "listo para grabar", **arranca solo si el permiso de micrófono ya estaba concedido** |
| Estado de exportación | `/app/consultas/<uuid>` | — | El panel de exportación vive en el detalle (no hace falta ruta nueva) |

**Reglas invariantes:** solo UUIDs/ids opacos — **nunca** nombre, documento, diagnóstico ni texto
clínico en la URL (regla ya vigente en el repo); sesión requerida (sin sesión → login con `next`);
la autorización la sigue aplicando RLS — un deep link a un recurso ajeno no lo revela; ningún deep
link ejecuta mutaciones clínicas (firmar/aprobar/exportar **jamás** por URL); `record` se consume
una vez y se limpia de la URL.

**Acción nativa opcional (fase posterior, §23-N2):** `open_miracle({screen, id, record?})` — el
ejecutor construye la URL desde este contrato; el cerebro no fabrica URLs. `DEPENDENCIA DE
OPERATIONS`.

**Command bridge (no ahora, §23-N3):** si algún día se construye, el comando conceptual sería
`{kind:'command', type:'open_consultation'|'prepare_new_consultation', params:{ids}, expires_at,
requires_confirmation}` sobre la misma tabla — con TTL de 30-60 s y confirmación del médico para
todo lo que no sea navegación pura.

## 33. Estrategia de idempotencia

Cuatro capas, de la más fuerte a la más débil:

1. **Base de datos (la que de verdad garantiza):** `UNIQUE(consultation_id)` en
   `graph_note_exports`. Dos requests concurrentes → una fila. El segundo recibe `409` con el
   estado del existente.
2. **Reintentar reutiliza la fila, nunca crea otra.** El historial de intentos vive en `attempts`
   + `audit_events`, no en filas duplicadas. Consecuencia deliberada: **como máximo una
   exportación por consulta en toda su vida**, que es exactamente la semántica de negocio.
3. **Claim atómico:** `FOR UPDATE SKIP LOCKED` dentro de la RPC — dos ejecutores no pueden tomar el
   mismo trabajo (hoy hay un solo dispositivo, pero la primitiva correcta desde el día 1 evita una
   clase entera de bugs futuros).
4. **`result` terminal idempotente:** repetir el mismo `result` devuelve ack sin re-transicionar ni
   re-marcar la consulta. Necesario porque el cliente **debe** reintentar el `result` hasta el ack.

**Lo que la idempotencia NO cubre** (honestidad): si el ejecutor escribió parcialmente en SAP y el
lease venció, el reintento puede duplicar **dentro del formulario del HIS**. Eso no lo resuelve la
base de datos: lo resuelve el ejecutor leyendo la pantalla antes de escribir (§31-D6) o el workflow
partiendo de pantalla limpia. Es una `DEPENDENCIA DE OPERATIONS` explícita, no un detalle olvidado.

## 34. Estrategia de reintentos

| Tipo | Quién | Política |
|---|---|---|
| **Automático por lease vencido** | Graph (dentro del siguiente claim) | Hasta `attempts = 3`; luego `failed` con `error_code='max_attempts'`. Sin backoff: el lease de 10 min ya es el intervalo |
| **Manual del médico** | Notes → `POST /:id/retry` | Solo desde `failed | needs_doctor | cancelled`. Re-verifica que la consulta siga `aprobada`. Audita cada reintento |
| **Del `result` (cliente → Graph)** | Ejecutor | **Obligatorio** hasta recibir ack; requiere cola local durable (§31-D8) |
| **De la creación (Notes → Graph)** | Notes | Seguro por el `409` idempotente; sin reintento automático (un fallo se muestra al médico) |
| **Del plan LLM en el claim** | Graph | **Sin reintento silencioso.** Un fallo de resolución es `needs_doctor` con los labels, no un retry ciego — reintentar una resolución que ya dijo "falta el documento" daría el mismo resultado |

**Sin barrido por cron:** la expiración de leases se evalúa **perezosamente dentro de cada claim**
(condición en la RPC). Un trabajo abandonado sin ejecutores activos simplemente espera — no hay
nada que "limpiar" mientras nadie pregunte. Menos piezas móviles, cero infraestructura de
scheduling. `DECISIÓN CONDICIONADA`: si algún día se quiere que un trabajo abandonado pase a
`failed` sin que nadie haga claim (para alertar al médico), se añade un Vercel Cron — no antes de
que ese caso duela.

## 35. Manejo de errores

**Taxonomía de `error_code` (tipada, sin PHI):**

| Código | Origen | Estado resultante | Acción del médico |
|---|---|---|---|
| `unresolved_fields` | claim (resolver) | `needs_doctor` | Ver labels; completar en SAP o reintentar |
| `no_llm_configured` | claim (resolver sin `GRAPH_LLM_*`) | `failed` | Avisar al administrador |
| `workflow_not_found` / `workflow_no_steps` | claim | `failed` | Administrador: enseñar el workflow |
| `max_attempts` | Graph (lease) | `failed` | Reintentar manualmente o exportar a mano |
| `sap_error` | ejecutor | `failed` | Reintentar; ver detalle en el panel |
| `sap_not_available` | ejecutor | `failed` | Encender/abrir SAP y reintentar |
| `patient_not_resolved` | ejecutor | `needs_doctor` | Identificar el paciente (§18-I7) |
| `save_not_confirmed` | ejecutor | `failed` | **Verificar en SAP antes de reintentar** (riesgo de duplicado) |
| `cancelled_by_user` | Notes | `cancelled` | — |

**Principios:**
- **Ningún error se presenta como éxito.** El toast al crear dice "enviada", no "exportada"; solo
  `completed` produce el chip "Exportada".
- **`needs_doctor` no es un fallo del sistema**: es el sistema pidiendo información que no tenía.
  Se muestra con acción concreta, no como error rojo.
- **Fallos de la resolución dinámica se prefieren a adivinar**: el propio `DynamicValueResolver`
  ya lo hace explícito (*"crear al paciente equivocado es peor que fallar"*) — este diseño hereda
  esa doctrina.
- **Logs:** ruta + estado + `error_code` + `export_id`. Nunca cuerpo, nota, transcripción, nombre
  ni documento (regla vigente en `lib/api/clinical.ts` y en las rutas servidor de Notes).
- **Errores de Graph hacia Notes:** envelope estable `{error:{code,message}}` que el cliente ya
  normaliza.

## 36. Recuperación después de recarga o desconexión

| Escenario | Comportamiento diseñado |
|---|---|
| **Recarga del navegador** | SELECT inicial del trabajo al montar el detalle → estado correcto; Realtime aplica deltas desde ahí. Nada en memoria (§27.5) |
| **Pérdida del canal Realtime** | Fallback a polling 10 s; al recuperar, el SELECT reconcilia. El estado real siempre está en BD |
| **Segunda pestaña / segundo dispositivo** | Ambos leen la misma fila; ambos ven lo mismo |
| **Cierre del navegador durante la exportación** | Irrelevante: el trabajo vive en Graph; al volver, el médico ve el estado final |
| **PC del médico apagado** | El trabajo espera en `pending` indefinidamente (hasta `expires_at` si se decide añadirlo — hoy sin caducidad: una nota firmada debe registrarse aunque sea al día siguiente). La UI avisa a los 5 min |
| **Graph/U.exe cerrado** | Igual: el trabajo espera |
| **Ejecutor muere a mitad** | Lease vence → re-reclamable (§27.3) |
| **Red cae al reportar el `result`** | El ejecutor reintenta hasta el ack (cola local durable, §31-D8). Mientras, el trabajo sigue `claimed` con lease vivo |
| **Redeploy de Graph a mitad** | Sin efecto: no hay estado en memoria; la función es stateless |
| **Timeout de 60 s en el claim** | El ejecutor no recibe respuesta → reintenta el claim. El trabajo quedó `claimed` con lease → el mismo ejecutor lo re-reclama al vencer, o se reporta con el `export_id` que ya conoce. `RECOMENDACIÓN`: que el claim devuelva el trabajo **antes** de resolver el plan si la resolución se acerca al techo (`DECISIÓN CONDICIONADA` D1) |

## 37. Autorización y confirmaciones del usuario

**Quién puede disparar la exportación automática** (`RECOMENDACIÓN`, confirmar §19-P4):

| Rol | Crear exportación | Reintentar | Cancelar | Marcar manual | Razón |
|---|---|---|---|---|---|
| `medico` (dueño) | **Sí** | Sí | Sí | Sí | Es su nota firmada |
| `admin` / `supervisor` | Sí (org) | Sí | Sí | Sí | Ya pueden actualizar consultas de su org |
| `secretaria` | **No** (propuesta) | No | No | **Sí** (su función actual, RPC existente) | Hoy `canExport` no filtra rol; disparar una automatización clínica es más que "avisar que ya la subí". **Confirmar con el equipo** |
| `superadmin` | Solo lectura/soporte | — | — | — | Evitar acciones clínicas desde plataforma |

**Confirmaciones explícitas requeridas:**
1. **"Marcar como exportada (manual)"** → diálogo que dice *"Esto NO envía nada a SAP. Úsalo solo
   si ya registraste la nota manualmente."* Deshabilitado si hay trabajo `pending|claimed`.
2. **Reintentar tras `save_not_confirmed`** → aviso *"Verifica en SAP que la nota no quedó
   registrada antes de reintentar"* (riesgo de duplicado, §33).
3. **Exportar** en sí **no** necesita segunda confirmación: el acto deliberado ya fue la firma, y
   el botón solo existe con la nota firmada.
4. `RECOMENDACIÓN` — Ninguna acción de Operations (Flujo B) puede firmar, aprobar ni exportar sin
   un gesto del médico en la UI. Los deep links solo navegan.

**Autorización en el backend, no en la UI:** Graph re-verifica propiedad y organización en cada
endpoint (`req.clinicalUser` + lectura de `consultations`), y la RLS de lectura del trabajo espeja
las políticas de `consultations`. La desaparición del botón nunca es la barrera.

## 38. Responsabilidades por repositorio

| Responsabilidad | Miracle Notes | Graph | U-Windows-App (Operations) |
|---|---|---|---|
| Generar/editar/revisar la nota | **Dueño** (UI) | Motor (LLM) | — |
| **Firmar** (acto clínico + hash) | **Dueño** | — | — |
| Disparar la exportación | **Dueño** (botón) | — | — |
| **Validar** que se puede exportar | 1ª barrera (UI) | **Dueño** (autoritativa) | — |
| Resolver el contenido firmado y renderizarlo | — | **Dueño** | — |
| Cola, estados, idempotencia, lease | — | **Dueño exclusivo** | — |
| Entregar el trabajo | — | Responde al claim | **Reclama (pull)** |
| Decidir **QUÉ** valor va en cada campo | — | **Dueño** (plan + resolver) | Aporta inventario de campos si aplica |
| Decidir **CÓMO** escribirlo en SAP | — | — | **Dueño** |
| Verificar el guardado (folio) | — | Persiste | **Dueño** |
| Reportar resultado con ack | — | Recibe + `ack` | **Dueño** (reintenta hasta ack) |
| Marcar `aprobada → exportada` | — | **Dueño** (RPC acotada) | — |
| Mostrar estado al médico | **Dueño** | Expone lectura | — |
| Reintentar / cancelar (UI + reglas) | **Dueño** (UI) | **Dueño** (reglas) | — |
| Auditoría clínica | Lee | **Escribe** (`audit_events`) | — |
| Contrato de deep links | **Dueño** (documento) | — | Consume (`open_url`) |
| Observabilidad / motor `export` | — | **Dueño** (panel) | Emite telemetría |

## 39. Archivos y módulos probablemente involucrados

`INFERENCIA` (rutas exactas se fijan al implementar):

**Miracle Notes**
- `app/app/providers.tsx` — reemplazo del cuerpo de `exportNote` (~:821-869) + rama manual
  renombrada; `useExportStatus` puede vivir aquí o en un hook aparte.
- `app/app/consultas/[id]/page.tsx` — botón primario (:494, :595), botón secundario "manual",
  panel/badge de estado del trabajo.
- `lib/api/clinical.ts` — 4 funciones nuevas + tipos + códigos en `CLINICAL_ERROR_MESSAGES`.
- `lib/mock/types.ts` (o donde vivan los tipos de UI) — tipo del estado de exportación.
- `components/app/StatusBadge.tsx` / `NotificationsBell.tsx` — badge y conteo de "pendientes de
  registrar" (opcional, F4+).
- `docs/` — contrato de deep links v1 (Flujo B) y referencia al contrato de exportación.
- `tests/` — vector del hash + mapeo de estados a UI (vitest ya configurado).

**Graph**
- `supabase/migrations/<fecha>_note_exports.sql` — tabla + índices + RLS + 2 RPC.
- `src/application/use-cases/OperationsExportService.js` (nuevo) — crear/leer/retry/cancel,
  snapshot, `rendered_text`, verificación de hash, orquestación del claim/result.
- `web/api/registerClinicalRoutes.js` — 4 rutas nuevas (o un `registerExportRoutes.js` montado en
  el mismo carril).
- `web/api/registerOperationsRoutes.js` (nuevo) — claim/result bajo `/api/v1/operations`.
- `web/server.js` — wiring del servicio y de las rutas (+ límite de tasa propio si hace falta).
- `src/domain/windowsEngines.js` — una entrada `export` para que aparezca en el panel.
- `scripts/simulate-operations-executor.js` (nuevo) — ejecutor de referencia.
- `scripts/verify-note-export.js` (nuevo) — verificación offline del ciclo (estilo `verify-*`).
- `docs/note-export-contract.md` (nuevo) — el contrato versionado que ambos repos referencian.

**U-Windows-App** (`DEPENDENCIA DE OPERATIONS`): claim loop, ejecución del plan (contrato PR #8 ya
espejado), verificación de guardado, reporte con reintento, cola local durable.

## 40. Dependencias del equipo de Operations

Bloqueantes para F4 (no para F0-F3, que es el objetivo de la demo):

1. **D7/§18-I2 — Workflow SAP de "registrar nota" enseñado**, con `valueMode` explícitos donde el
   valor deba venir de la nota (post-PR#10, y **re-grabado** si es anterior al clasificador).
2. **D2 — Definición operativa de "guardado confirmado"** por transacción (qué señal de SAP
   significa éxito, y de dónde sale el folio).
3. **D1 — Decisión sobre quién resuelve el plan** (server-side por defecto).
4. **D6/D8 — Comportamiento en reintento** (leer antes de escribir) y **cola local durable** para
   el `result`.
5. **D5 — Identidad del ejecutor** y, para producción, el **enrolamiento per-install**
   (`DECISIÓN CONDICIONADA` §22-A8).
6. **§18-I1 — Acceso al repo U-Windows-App** para el equipo de integración.
7. **§18-I5 — Validación de red hospitalaria** (HTTPS saliente + poll de 20-30 s sin proxy hostil).
8. **Ambiente de calidad de SAP** disponible para los ensayos (el runbook ya lo asume).

**Nada de lo anterior bloquea F1-F3.** Esa es la propiedad más valiosa del diseño.

## 41. Plan de implementación por fases

**F0 — Congelar el contrato (días, sin código)**
Esquema de `graph_note_exports`; nombres definitivos de los 6 endpoints; **vector de prueba del
hash** (payload fijo + hash esperado, acordado entre `actions.ts` y Graph); forma exacta de
`payload` y `result`; definición de `ok` (D2); decisión D1; taxonomía de `error_code`; contrato de
deep links v1. Salida: `docs/note-export-contract.md` referenciado por los dos repos.
*Coordinar el merge de PR #7 (tooling) antes de abrir ramas largas.*

**F1 — Graph (sin dependencias externas)**
Migración (tabla + índices + RLS + RPC `graph_claim_next_note_export` + RPC `graph_mark_exported`);
`OperationsExportService`; 4 rutas clinical + 2 rutas operations; resolución del plan en el claim;
`simulate-operations-executor.js`; `verify-note-export.js` en `npm test`; entrada `export` en
`windowsEngines.js`.

**F2 — Miracle Notes (en paralelo con F1, tras F0)**
4 funciones en `lib/api/clinical.ts`; reemplazo del cuerpo de `exportNote` + toast honesto; hook de
estado (SELECT + Realtime + fallback poll); panel/badge de estados en el detalle; botón "Marcar
exportada (manual)" con confirmación y gateado; policy SELECT + publication de Realtime
(coordinado con F1); tests del vector de hash y del mapeo de estados.

**F3 — Demo E2E sin SAP (hito)**
Flujo completo contra el ejecutor simulado, cubriendo los criterios de §45. Es la demo oficial
recomendada (§19-P8).

**F4 — Operations / SAP en calidad** (`DEPENDENCIA DE OPERATIONS`, §40)
Claim loop en C#; ejecución del plan; verificación de guardado; reporte con reintento; workflow SAP
enseñado; ensayos contra el ambiente de calidad; QA de resolución con `verify-live-plan.js`.

**F5 — Hardening (`DECISIÓN CONDICIONADA`)**
Enrolamiento per-install (bloquea rollout con PHI real); purga automatizada del payload; límite de
tasa por dispositivo; endurecimiento opcional de la columna `payload`; motor `export` en el
marcador del panel; campana "pendientes de registrar".

**F6 — Flujo B opcional:** `open_miracle` (N2) y, solo si aparece necesidad real, command bridge
(N3) sobre `kind='command'`.

## 42. Trabajo que puede hacerse en paralelo

```
F0 contrato ──┬──► F1 Graph (backend + simulador) ──┐
              │                                      ├──► F3 demo E2E ──► F4 Operations/SAP
              └──► F2 Notes (UI + estado)  ──────────┘                      (paralelo a F5)
                   [prueba contra simulador de F1]
              └──► Flujo B: documento de deep links (independiente, cualquier momento)
              └──► Operations: workflow SAP + definición de "ok" (independiente, feed a F0/F4)
```

- **Notes no espera a Graph** más allá de F0: el contrato basta para desarrollar contra un mock, y
  el simulador de F1 cierra el ciclo.
- **Graph no espera a Operations**: el simulador es el ejecutor de referencia.
- **Operations no espera a nadie** para enseñar el workflow SAP ni para definir "guardado
  confirmado" — de hecho conviene que empiece por ahí, porque es lo que más tarda.
- **El documento de deep links** no depende de nada.

## 43. Estrategia para probar sin SAP terminado

(Diseño en §22-A7.) Resumen de por qué funciona: el contrato claim/result convierte "el ejecutor"
en una **pieza reemplazable**. Tres ejecutores válidos por el mismo contrato:

1. **Simulador Node** (F1) — demo E2E, pruebas de UI, pruebas de concurrencia y de lease.
2. **U-Windows-App** (F4) — el real.
3. **Conector API del HIS** — si §19-P1 resulta afirmativa, entra por el mismo contrato sin tocar
   Notes ni la tabla.

Complemento (no sustituto): `verify-live-plan.js` + `miracle-his-simulator` para QA de **calidad de
sustitución** en dry-run. Limitación explícita: no valida ejecución del cliente Windows sobre web
(el Aligner aún no alinea web).

## 44. Estrategia de pruebas

**Unitarias / offline (sin red, estilo `verify-*` de Graph y vitest en Notes)**

| Qué | Dónde | Por qué |
|---|---|---|
| **Vector del hash** (payload fijo → hash esperado) en ambos repos | Notes + Graph | Riesgo nº 1 (§46-R1). Debe fallar el build si divergen |
| Máquina de estados: toda transición legal permitida, toda ilegal rechazada | Graph | §28 es el contrato |
| Render de `rendered_text` desde `note` firmado (orden, títulos, secciones vacías) | Graph | Reproducibilidad |
| Validaciones de creación (no firmada, demo, hash malo, ajena) | Graph | 2ª barrera autoritativa |
| **Saneador de PHI**: un `result`/telemetría con contenido clínico se rechaza o redacta | Graph | §46-R3 |
| Mapeo estado→UI (incluido `needs_doctor` ≠ éxito, `partial` no exporta) | Notes | §46-R6 |
| `buildClinicalRequest` con las rutas nuevas | Notes | Patrón ya testeado |

**Integración (Postgres real)**

| Escenario | Resultado esperado |
|---|---|
| Crear el mismo export 5× en paralelo | 1 fila; 4× `409` con el mismo id |
| Dos claims concurrentes | Exactamente uno recibe el trabajo (`SKIP LOCKED`) |
| Lease vencido | Re-reclamable con `attempts+1`; a los 3 → `failed` |
| `result` duplicado | Ack sin re-transicionar ni re-exportar |
| `result` de un ejecutor sin lease/ajeno | Rechazado |
| `ok` sobre consulta `aprobada` | `exportada` + `audit_events`; **el trigger no protesta** |
| `needs_doctor`/`failed` | La consulta **sigue** `aprobada` |
| Retry desde `completed` | Rechazado (terminal absoluto) |
| Export de consulta de otro médico | 404/403 sin filtrar existencia |

**End-to-end (con simulador)** — los 9 criterios de §45.

**Seguridad/privacidad** — barrido de un ciclo completo: ningún log/telemetría/panel contiene nota,
transcripción, nombre ni documento; `payload` solo viaja en el claim autenticado; purga deja el
trabajo auditable con `payload=null`.

**Resiliencia** — claim a través de proxy con buffering; corte de red al reportar `result`; recarga
a mitad; escenario NAT con varios ejecutores simulados vs rate-limit; nota de 30 secciones contra el
límite de 16 MB.

**Herramientas:** Notes ya tiene vitest + CI (lint/typecheck/test/build); Graph usa scripts
`verify-*` en `npm test`. `RECOMENDACIÓN`: seguir cada estilo, sin introducir frameworks nuevos.

## 45. Criterios de aceptación

**Demo E2E (F3), con ejecutor simulado:**

1. Firmar → "Exportar a HC" → el trabajo aparece `pending` y la UI dice "Enviando…" (**no**
   "exportada"); la consulta sigue `aprobada`.
2. El simulador reclama → la UI pasa a "El asistente está registrando…" **sin recargar**.
3. `result ok` → la consulta pasa a `exportada`, se registra `audit_events` con el `export_id`, la
   UI muestra "Exportada" (+ folio si vino).
4. **Recargar a mitad de vuelo** muestra el estado correcto (derivado de BD).
5. `result needs_doctor` → consulta sigue `aprobada`; la UI lista los labels faltantes; Reintentar
   funciona y vuelve a `pending`.
6. **Doble clic / dos pestañas** no crean un segundo trabajo (`409`, mismo estado).
7. Consulta de **demostración** rechazada al crear, con mensaje claro.
8. Nota cuyo contenido **no coincide con la firma** rechazada (`hash_mismatch`), sin crear trabajo.
9. **Ningún log, evento ni pantalla de admin** contiene contenido clínico del ciclo completo.

**Aceptación de F4 (con SAP de calidad):** una nota firmada real queda registrada en el HIS con
folio, `completed` solo tras verificar el guardado, y un caso con paciente no resoluble termina en
`needs_doctor` **sin haber escrito nada**.

## 46. Riesgos técnicos y operativos

| # | Riesgo | Sev. | Mitigación |
|---|---|---|---|
| **R1** | **Divergencia de serialización del hash** entre `actions.ts` y Graph (orden de claves, unicode) → todo export rechazado o, peor, aceptado con contenido distinto | **Alta** | Vector de prueba compartido en F0, testeado en ambos repos; el test falla el build |
| **R2** | **Falso éxito**: la UI dice exportada sin registro real | **Alta** | `exportada` solo por `graph_mark_exported` tras `result ok` con ack; toast "enviada"; `needs_doctor`/`failed` nunca exportan |
| **R3** | **PHI en logs/telemetría/panel admin** | **Alta** | `payload` solo en el claim; eventos y `error_code` tipados; labels sí/valores no; test de barrido; purga a 72 h |
| **R4** | **Rate-limit 120/min por IP** con hospital tras NAT (poll del ejecutor + tráfico del navegador) | Media-Alta | Poll de 20-30 s (≈2-3 req/min); límite propio por dispositivo en `/api/v1/operations`; medir en el escenario NAT |
| **R5** | **Escritura duplicada dentro de SAP** en un reintento tras lease vencido | Media-Alta | Ejecutor lee antes de escribir (D6); aviso explícito al reintentar tras `save_not_confirmed`; `folio` como evidencia |
| **R6** | **Confianza excesiva del médico** en una automatización que falla en silencio | Media-Alta | Estados honestos y visibles; `needs_doctor` con acción concreta; nunca presentar parcial como éxito |
| **R7** | **Realtime no habilitado** el día de la demo (publication/policy) | Media | Fallback de polling 10 s desde el día 1; checklist de F2 |
| **R8** | **Graph cambia bajo nuestros pies** (3 PRs hoy en el área) | Media | Acoplarse solo a superficies estables; contrato versionado; rebasar sobre el main del día; PR #7 mergeado antes de F1 |
| **R9** | **SAP no está listo** y la demo se planificó con SAP real | Media | Demo oficial = simulador (§19-P8); F4 desacoplada |
| **R10** | **Notas históricas sin `firma.hash`** o sin encounter | Media | `computed_at_export`; la exportación lee `consultations` (siempre existe), encounter opcional |
| **R11** | **`discharge` esperado en el HIS y ausente del firmado** (§8) | Media | Resolver §19-P6 en F0; si se necesita, promoverlo al espejo antes de firmar (cambio en Notes) |
| **R12** | **Paciente no identificable** en SAP (2 pacientes reales vs 93 consultas) | Media | `needs_doctor` con `patient_not_resolved` como camino esperado, no excepción; §19-P7 |
| **R13** | **Trabajo huérfano** si el `result` se pierde y el ejecutor no reintenta | Media | Cola local durable (D8); lease + re-claim como red |
| **R14** | **API key compartida descompilable** → reclamar trabajos y leer PHI | **Alta en producción**, aceptable en QA | Enrolamiento per-install antes del rollout real (§22-A8); no bloquea la demo |
| **R15** | **Timeout de 60 s** si el resolver LLM tarda en el claim | Baja-Media | Medido hoy en vivo sin problema; D1 permite mover la resolución al cliente; §18-I8 |
| **R16** | **Documentación engañosa** (`CONTEXTO.md` describe Graph como repo viejo) lleva a construir en el sitio equivocado | Media | Corregirlo antes de repartir tareas (§19-P11). Coste: minutos |

## 47. Decisiones que debe confirmar el equipo

| # | Decisión | Propuesta de este documento | Quién |
|---|---|---|---|
| 1 | Fuente de verdad de la exportación | `consultations` firmado + verificación de hash | Producto + Graph |
| 2 | ¿Adendas se exportan en MVP? | No; procedimiento manual documentado | Clínica |
| 3 | ¿`discharge` debe llegar al HIS? | Resolver antes de F1 (hoy no está en el firmado) | Clínica + Hospital |
| 4 | ¿Puede la secretaria disparar la exportación automática? | No; conserva "marcar manual" | Producto |
| 5 | ¿Se conserva el marcado manual? | Sí, explícito y gateado | Producto |
| 6 | ¿Demo oficial con simulador o con SAP de calidad? | Simulador | Dirección |
| 7 | Retención del `payload` PHI | Purga a 72 h del terminal | Legal + Seguridad |
| 8 | ¿Evidencia visual (capturas) del registro? | No en MVP (sería PHI) | Legal |
| 9 | Rol de `expires_at` en el trabajo | Sin caducidad en MVP (una nota firmada debe registrarse) | Producto |
| 10 | Resolución del plan: server-side o cliente | Server-side (D1) | Graph + Operations |
| 11 | Enrolamiento per-install: ¿cuándo? | Antes del rollout con PHI real, no antes de la demo | Seguridad |
| 12 | ¿Se corrige `CONTEXTO.md`? | Sí, antes de repartir tareas | Equipo web |
| 13 | Dueño de `public.runs` | Confirmar y no reutilizar | Infra |
| 14 | Flujo B ahora: ¿solo contrato de deep links? | Sí; `open_miracle` y bridge después | Producto |

---

## Respuestas directas

### 1. ¿Qué repositorios deben modificarse?

**Los dos, más el del cliente en una fase posterior.** **Graph**: 1 migración (tabla + 2 RPC),
1 servicio, 6 rutas nuevas (4 en el carril clínico, 2 en `/api/v1/operations`), 1 script simulador,
1 entrada en el catálogo de motores. **Miracle Notes**: 4 funciones en `lib/api/clinical.ts`, el
cuerpo de `exportNote`, un hook de estado y el panel/badge en el detalle. **U-Windows-App**
(Operations): claim loop, ejecución y reporte — F4, sin bloquear nada anterior. Ninguna migración va
en el repo de Notes: la tabla es de Graph y sigue su convención `graph_`.

### 2. ¿Cuál es la fuente de verdad de la nota exportada?

**El contenido firmado de `consultations`**: la tupla `{note, resumen, codigos}` que
`signConsultationNote` hashea y que el trigger de inmutabilidad congela. Graph la lee con
service-role y **re-verifica el hash** antes de crear el trabajo. `clinical_encounters.note_json`
queda degradado a borrador interno y **no se exporta**: puede estar viejo, porque las ediciones
manuales del médico en el detalle solo escriben en `consultations`.

### 3. ¿Dónde debe vivir la coordinación de exportación?

**En Graph, sobre una tabla nueva `graph_note_exports` del Supabase que ya comparten los dos
repos.** No en memoria de proceso (Vercel es serverless), no en `/tmp`, no en el token de sesión del
agente, no en Neo4j, no en una cola externa, y no en `public.runs` (no pertenece a ningún repo
conocido). Graph es el único escritor; Notes solo lee.

### 4. ¿Cómo debe integrarse Operations?

**Pull puro, con dos endpoints bajo `/api/v1/operations`**: `claim` (atómico, con lease de 10 min,
devuelve payload + **plan ya sustituido** por el `DynamicValueResolver`) y `result` (con ack
obligatorio). Es el mismo modelo que el sistema ya usa para todo — el cliente Windows nunca recibe
conexiones entrantes. Y como el contrato define al ejecutor, **cualquier proceso que lo hable es un
ejecutor válido**: el simulador hoy, el C# mañana, un conector API del HIS si aparece.

### 5. ¿Qué mecanismo recomiendas para actualizar el estado en Miracle Notes?

**Supabase Realtime como primario, polling de 10 s como fallback, y un SELECT inicial al montar.**
Realtime porque Notes ya tiene `supabase-js`, la tabla vive en el mismo proyecto y la policy de
lectura por médico aplica al canal: cero trabajo en Vercel, cero SSE nuevo. El fallback cubre el
caso "olvidamos habilitar la publication" y las redes hostiles. Todo el estado se deriva de la base
de datos, así que sobrevive a recargas, pestañas y dispositivos.

### 6. ¿Qué puede construirse ya sin esperar a SAP?

**Absolutamente todo el backend y todo el frontend, más la demo completa.** Con el ejecutor simulado
(un script Node que habla claim/result) se demuestra el flujo entero: firmar → exportar → estado en
vivo → `Exportada`. La única cosa que no se puede demostrar sin SAP es la escritura física en el HIS
— y para eso ya existe el dry-run `verify-live-plan.js`, que valida la calidad de la sustitución de
valores sin ejecutar nada.

### 7. ¿Qué depende obligatoriamente del equipo de Operations?

Ocho cosas, todas de F4: el workflow SAP de "registrar nota" enseñado con `valueMode` explícitos; la
**definición operativa de "guardado confirmado"** (qué señal de SAP significa éxito y de dónde sale
el folio); la decisión de si el plan se resuelve en el servidor o lo pide el cliente; el claim loop
en C#; la cola local durable para reintentar el `result`; leer la pantalla antes de reescribir en un
reintento; el acceso al repo U-Windows-App; y la validación de la red del hospital. **Ninguna de
las ocho bloquea F1–F3.**

### 8. ¿Cómo evitar duplicados y falsos éxitos?

**Duplicados:** índice `UNIQUE(consultation_id)` — dos clics producen un trabajo y un `409` con el
estado del existente; reintentar reutiliza la fila, nunca crea otra; el claim es atómico
(`SKIP LOCKED`); el `result` terminal es idempotente. **Falsos éxitos:** `estado='exportada'` solo
lo produce `graph_mark_exported` tras un `result ok` con ack; el toast al pulsar dice "Exportación
enviada", nunca "exportada"; `needs_doctor` y `failed` dejan la consulta en `aprobada`. Eso cierra
directamente los huecos F9/C2 que el propio repo ya tenía documentados.

### 9. ¿Conviene implementar ahora interacción nativa con Miracle Notes?

**Como construcción, no. Como contrato, sí.** Construirla ahora distraería del único entregable con
demanda real; documentar los deep links que ya existen cuesta horas, no toca código y simplifica
todo lo que venga después. Además, Operations ya tiene `open_url` en su catálogo: con el contrato
escrito, el Flujo B funciona hoy sin implementar nada.

### 10. ¿Qué parte concreta de esa interacción construirías ahora?

**Solo el documento de contrato de deep links v1**: la lista cerrada de cinco URLs con sus
parámetros permitidos, las reglas invariantes (solo UUIDs opacos, nunca PHI, sesión requerida,
ningún deep link ejecuta mutaciones clínicas) y la promesa honesta sobre `record=1` — "deja la
pantalla lista para grabar; el micrófono arranca solo si el permiso ya estaba concedido". Cero
código en Notes, salvo quizá aceptar `plantilla=` en nueva consulta si un caso real lo pide.

### 11. ¿Qué parte dejarías para después?

La systemTool `open_miracle({screen, id})` (útil solo si el uso real muestra que el cerebro se
equivoca armando URLs), el command bridge, el export de adendas, el enrolamiento per-install, la
purga automatizada y el motor `export` en el marcador del panel.

### 12. ¿Deep links son suficientes inicialmente?

**Sí.** Cubren abrir una consulta, abrirla en modo adenda, preparar una nueva con paciente y cita, y
llevar al médico a la pantalla de grabación — que es todo lo que los casos actuales piden. Lo que no
cubren (traer una pestaña al frente, ejecutar mutaciones) tampoco lo pide nadie hoy, y parte de eso
es imposible por restricciones del navegador.

### 13. ¿Hace falta un command bridge en esta fase?

**No.** Notes no tiene canal de entrada (su service worker es pass-through sin push y no hay
Realtime en producción), no hay garantía de pestaña abierta ni de foco, y ningún caso de la demo lo
necesita. Construirlo ahora daría fiabilidad teatral: un comando enviado a una pestaña que no existe
se pierde en silencio.

### 14. ¿Cómo debería relacionarse ese bridge con la exportación?

**Reutilizándola, cuando llegue.** Comparten la tabla (la columna `kind` está en el esquema desde el
día 1, a costo cero), el canal Realtime hacia Notes, el patrón claim/ack y la disciplina de PHI y
auditoría. Difieren en TTL (30-60 s frente a horas: un comando viejo jamás debe ejecutarse), en
reintentos (un comando no se reintenta, se re-emite) y en destinatario. La regla de no-confusión:
un comando nunca transiciona estados clínicos y una exportación nunca navega la UI.

### 15. ¿Qué riesgos podrían impedir demostrar el flujo completo?

Cinco, en orden de probabilidad: **(1)** que el hash que recomputa Graph no coincida con el de
`actions.ts` por una diferencia de serialización — se mata en F0 con un vector de prueba compartido;
**(2)** Realtime sin publication/policy el día de la demo — mitigado por el fallback de polling
desde el primer día; **(3)** notas históricas sin `firma.hash` — resuelto con `computed_at_export`;
**(4)** que la demo se haya prometido con SAP real, cuando el propio repo dice que la ejecución
física está pendiente — por eso la demo oficial debe ser con simulador; **(5)** el poll del ejecutor
chocando con el límite de 120 req/min por IP en un hospital tras NAT — irrelevante con 20-30 s de
intervalo, pero hay que medirlo.

### 16. ¿Cuál es el orden recomendado de implementación?

**F0** congelar el contrato (esquema, endpoints, vector del hash, definición de "guardado
confirmado") → **F1** Graph: tabla, RPCs, rutas y simulador → **F2** Notes en paralelo: exportNote,
hook de estado, UI y marcado manual gateado → **F3** demo E2E con simulador (**el hito**) → **F4**
Operations: claim loop en C#, workflow SAP y ensayos en el ambiente de calidad → **F5** hardening
(enrolamiento per-install antes de cualquier rollout con pacientes reales). El Flujo B (documento de
deep links) puede ir en cualquier momento, es independiente.

---

## Anexo — Índice de evidencia

Rutas relativas a la raíz de cada repo. Notes `main@35e32e3`; Graph clon local `main@09653db` con
delta remoto a `bc484ac` indicado como **[remoto]**.

### Miracle Notes — `joseph1356k/Pagina-web-clientes-final`

| Ruta | Línea(s) | Símbolo | Qué demuestra |
|---|---|---|---|
| `app/app/consultas/[id]/page.tsx` | 494-498, 595-597 | botón + `exportNote(c.id)` | El botón "Exportar a HC" existe, en desktop y móvil; único callsite |
| `app/app/consultas/[id]/page.tsx` | 166-170 | `canEdit`, `canExport` | `canExport = !demo && estado==='aprobada'`, sin filtro de rol y con el comentario que lo justifica |
| `app/app/consultas/[id]/page.tsx` | 499-503 | chip | Con `exportada` el botón desaparece y queda un chip informativo |
| `app/app/consultas/[id]/page.tsx` | 206-253 | `aiEdit` | Único camino del detalle que escribe en Graph antes del espejo |
| `app/app/consultas/[id]/page.tsx` | 541-548 | `HistoriaTab onSectionChange` | La edición manual llama `updateNote`, no a Graph |
| `app/app/consultas/[id]/page.tsx` | 112-132, 568-585 | adendas, `?adenda=1` | Adendas solo con nota firmada; deep link de enfoque |
| `app/app/providers.tsx` | 821-869 | `exportNote` | **El comportamiento real actual**: RPC secretaria o UPDATE directo, toast de éxito inmediato, cero Graph |
| `app/app/providers.tsx` | 310-346, 422-452 | `persist`, `mutate` | UPDATE directo a `consultations` con reintentos; reenvía note/resumen/codigos/firma |
| `app/app/providers.tsx` | 596-608 | `upsertConsultation` | Se niega a espejar sobre nota firmada |
| `app/app/providers.tsx` | 871-877 | `markReviewed` | `borrador → revisada` es opcional y local |
| `app/app/providers.tsx` | 916-929 | `updateNote` | **Las ediciones manuales van solo a `consultations`** (divergencia con `note_json`) |
| `app/app/providers.tsx` | 126-131 | `CONSULTATIONS_CAP` | Carga acotada al montar (300/500) |
| `app/app/consultas/actions.ts` | 20-96 | `signConsultationNote` | Firma: validación, chequeo anti-demo, **hash SHA-256 de `{note,resumen,codigos}`**, CAS por estado, auditoría |
| `app/app/consultas/nueva/page.tsx` | 47-52, 90-130, 246-249 | searchParams, `linkAppointment` | Deep links reales: solo `paciente` y `appointment`; salida con `record=1`; validación anti-homónimos |
| `app/app/consultas/en-vivo/page.tsx` | 97-103, 131-146 | searchParams, limpieza de `record` | `encounter` obligatorio; `record` se consume una vez "para no reencender el micrófono" |
| `app/app/consultas/en-vivo/page.tsx` | 389-437 | `guardarNota` | En la consulta activa **Graph va primero** y el espejo después |
| `components/app/DictationPanel.tsx` | 58-64 | `autoStart` | El autostart corre desde `useEffect`, una sola vez |
| `components/app/QuickConsultationLauncher.tsx` | 114-136 | navegación | Crea encounter y navega con `record=1` |
| `components/app/AgendaHoy.tsx` | 341, 370 | enlaces | "Reanudar" navega **sin** `record` deliberadamente |
| `components/app/CommandPalette.tsx` | 9-15, 48-113 | `Item`, `go` | Solo navegación por `href`; sin acciones de dominio |
| `lib/clinical/encounter-to-consultation.ts` | 10-12, 42-50, 91-114 | regla de identidad, `noteJsonToSections` | Mismo uuid 1:1; el espejo conserva keys y **descarta `discharge`** |
| `lib/api/clinical.ts` | 1-13, 415-438, 444-508 | reglas, `buildClinicalRequest` | Cliente único, Bearer del médico, errores normalizados, logging sin PHI |
| `lib/api/guard.ts` | 13-72 | `requireApiUser`, `rateLimit` | Guardas reutilizables, doble barrera, fail-open |
| `app/api/stt/session/route.ts` | 7-50 | ruta servidor | Patrón Notes→Graph `/api/v1` con `X-API-Key` server-only |
| `app/api/clinical/note-from-photo/route.ts` | 206-240 | ruta servidor | Igual + `AbortSignal.timeout(55s)` y degradación a `{connected:false}` |
| `public/sw.js` | 1-24 | service worker | Pass-through deliberado: **sin push, sin cache** → no hay canal de retorno |
| `components/app/NotificationsBell.tsx` | 25-29 | conteo | Cómputo local sobre el store; no es tiempo real |
| `lib/mock/types.ts` | 7-12, 114-120 | `ConsultationStatus` | El estado `exportada` ya existe con su etiqueta |
| `supabase/migrations/20260628000000_multi_tenant_organizations.sql` | 126-154 | `consultations` | Esquema, `organization_id`, `firma`, políticas RLS de UPDATE |
| `supabase/migrations/20260721000000_consultation_immutability_and_addenda.sql` | 12-13, 28-53 | trigger | Congela el contenido; **única transición permitida `aprobada → exportada`** |
| `supabase/migrations/20260723010000_secretary_mark_exported.sql` | todo | RPC | Molde de RPC acotada; *"YA subió una nota aprobada al sistema propio del hospital"* |
| `supabase/migrations/20260722010000_secretaria_role.sql` | 43-57 | policy | La secretaria solo amplía SELECT → de ahí la necesidad de la RPC |
| `DIAGNOSTICO.md` | 60, 115 | F9, C2 | El propio repo documenta la exportación falsa como hueco conocido |
| `CONTEXTO.md` | 82, 88 | tabla de repos | Proyecto Supabase compartido; **y la descripción errónea de Graph** (§19-P11) |
| `.github/workflows/ci.yml` | todo | CI | lint + typecheck + vitest + build |

### Graph — `joseph1356k/Graph`

| Ruta | Línea(s) | Símbolo | Qué demuestra |
|---|---|---|---|
| `vercel.json` | 7-12 | `functions` | Una sola función serverless, `maxDuration: 60` |
| `web/server.js` | 97, 307-309 | `trust proxy`, `apiLimiter` | Rate-limit 120/min **por IP** sobre todo `/api` |
| `web/server.js` | 367-435 | montaje de middlewares | Los tres carriles de auth, aislados a propósito |
| `web/server.js` | 100-105 | `resolveGeneratedRoot` | `/tmp` en Vercel = almacenamiento efímero |
| `web/server.js` | 443-534 | `callMiracleRuntime` | Patrón de token interno `X-Graph-Internal-Token` |
| `web/api/requireClinicalAuth.js` | 80-138 | `verifySupabaseToken` | JWT del médico verificado offline por JWKS → `req.clinicalUser` |
| `web/api/requireAuth.js` | 345-395 | `requireApiKey` | `/api/v1` con **API key estática compartida** desde env |
| `web/api/registerClinicalRoutes.js` | 22-28, 141-281 | `resolveDoctorId`, rutas | Verificación de propiedad en el backend; sitio de las rutas nuevas |
| `web/api/registerWindowsPanelRoutes.js` | 14-23, 80-153 | constantes, SSE | Patrón SSE resuelto bajo Vercel: tope 50 s, `bye`, `X-Accel-Buffering` |
| `web/public/windows-live.js` | 22, 1233-1330 | cliente del stream | `fetch`+`getReader`, backoff, **fallback a polling** |
| `web/api/registerPublicApiRoutes.js` | 266-313, 590-609 | autofill, plan | `autofill/match` y `POST /workflows/:id/plan` con `variables` |
| `web/api/registerWorkflowRoutes.js` | 94, 113-172 | plan, `note-field-matches` | `{noteContent, fields[]} → {matches[{stepOrder,value,confidence}]}` |
| `web/api/registerMcpRoutes.js` | 24-38, 89-119, 151 | MCP | JSON-RPC stateless; `tools/call` **devuelve el plan**; superficie por headers |
| `web/api/registerMcpRoutes.js` | **[remoto]** 100-110 | `tools/call` | El `context` ahora viaja **como variable** → activa la sustitución |
| `web/api/registerWindowsTelemetryRoutes.js` | 1-7 | comentario | *"La telemetría NUNCA debe tumbar al agente"* → best-effort por diseño |
| `src/domain/agent/mcpCatalog.js` | 11, 20-34, 42-146 | catálogo | 22 herramientas base; **`open_url(url)`** en :102-104 y `launch_app` en :44-46 |
| `src/domain/agent/learning.js` | 51 | `workflowToMcp` | Los workflows se declaran con un único arg **`context`** |
| `src/infrastructure/conscious-brain/prompt.js` | 54-59 | reglas | Preferencia workflow > `launch_app` > computer-use; terminal prohibida |
| `src/application/use-cases/AgentTurnService.js` | 1-23 | cabecera | **El cliente conduce el bucle**; contrato espejo "sagrado" con `Protocol.cs` |
| `src/application/use-cases/WorkflowExecutor.js` | 11-33 | `isExecutableStep` | Filtro de pasos ejecutables; error si no queda ninguno |
| `src/application/use-cases/WorkflowExecutor.js` | **[remoto]** 64-132 | `applyDynamicValues` | **Sustitución dinámica**: sin context intacto; dynamic sin resolver **falla listando labels**; `bindTo` comparte; selects por `selectedValue` |
| `src/application/use-cases/DynamicValueResolver.js` | **[remoto]** 1-117 | clase | Umbral 0.7; prohibido inventar; `formatExample` solo da formato; sin LLM → error explícito |
| `src/application/use-cases/NoteFieldMatcher.js` | 19-28, 44-59 | `match` | Campos aportados por el cliente; umbral `confidence ≥ 0.75` |
| `src/application/use-cases/ClinicalEncounterService.js` | ~35-45, ~123-135 | snapshot, `saveEditedNote` | `template_snapshot` con `snapshot_at`; `status='completed'` |
| `src/domain/entities/Step.js` | 62-65 | `valueMode`, `bindTo` | `fixed|dynamic|flexible`, default `fixed` |
| `src/domain/entities/Step.js` | **[remoto]** | `nodeKey/nodePath/nodeAction` | Contrato de paso de árbol SAP (PR #8), espejado con el cliente C# |
| `src/domain/windowsEngines.js` | 30-106, 140-272 | catálogo, `engineForEvent` | Motor `sapgui` declarado; añadir un motor = una entrada; veredicto derivado |
| `src/infrastructure/SupabaseRestClient.js` | 1-60 | cliente | Service-role sobre PostgREST → **puede leer `consultations`** |
| `supabase/migrations/20260710042652_clinical_note_engine.sql` | sección 2 | `clinical_encounters` | `patient_id text`, `template_snapshot`, **sin `organization_id`** |
| `supabase/migrations/20260722120000_windows_live_users_and_events.sql` | 1-20, 38-75 | cabecera, esquema | *"El cliente Windows habla SOLO con el backend Graph"*; identidad = email sin contraseña; `detail jsonb` libre |
| `supabase/migrations/20260719120000_android_telemetry_and_client_config.sql` | 33-80 | `graph_app_users`, `graph_prompts` | Molde más cercano a la cola (device_id PK, status, timestamps) + RPC `security definer` |
| `supabase/migrations/20260726120000_studio_engine_lab.sql` | 20-64 | `graph_studio_progress` | Patrón **RLS activado sin políticas** (solo service-role) |
| `docs/VALORES-DINAMICOS.md` | **[remoto]** todo | runbook | Reglas de la sustitución, dry-run `verify-live-plan.js`, **evidencia de verificación en vivo**, "ambiente de calidad" |
| `docs/AGENTE-WORKFLOWS-CONTEXTO.md` | 9-11, 23-33 | visión, repos | *"Graph decide QUÉ, la superficie decide CÓMO"*; deploy; auth `/api/v1` |
| `docs/AGENTE-WORKFLOWS-CONTEXTO.md` | 113-132 | estado real | `dynamic`+`bindTo` pendientes **(obsoleto tras PR #9/#10)**; *"Falta probar grabación/ejecución real de workflows SAP"* |
| `web/public/windows-lab.js` | 136, 264 | copy del panel | *"Falta ejercitar la grabación real de SAP"*; *"Hoy solo alinea apps nativas: SAP y web todavía no"* |
| `web/public/studio-docs/distribucion-app-conectada.md` | 16-34, 52-58 | distribución | Key **horneada en el `.exe`**, *"una sola, compartida… descompilable"* |
| `web/public/studio-docs/autenticacion-interna-plan.md` | todo | plan | Enrolamiento per-install **diseñado, decidido, no implementado** |
| `ARQUITECTURA_Y_PLAN.md` | 22-27 | análisis | *"Sin el aprendizaje de workflows, el autofill no funciona"* |

### Delta remoto de Graph y PRs (API de GitHub)

| Referencia | Qué demuestra |
|---|---|
| PR #9 `feature/dynamic-values` → `341fe28`, merged 2026-07-26 20:19 UTC | `DynamicValueResolver` (117 líneas nuevas) + `applyDynamicValues` (73 en `WorkflowExecutor`) + `verify-dynamic-values.js` (8 casos) + wiring en `server.js`; MCP pasa `context` como variable |
| PR #10 `feature/explicit-value-modes` → `ed7b3cc`, merged 20:32 | "El que autora manda": `addStep` persiste modos explícitos; **fix** de `updateFullWorkflow/copyWorkflow` que descartaban la clasificación; arneses `e2e-dynamic-live.js`, `verify-live-plan.js` |
| PR #8 `feature/tree-node-steps` → `678bfe8`, merged 19:58 | `nodeKey/nodePath/nodeAction` de punta a punta; *"'Órdenes Clínicas' aparece 17 veces en el árbol real del hospital"*; cita el repo **U-Windows-App** |
| PR #7 `best-practices` (**abierto**) | CLAUDE.md, ESLint, typecheck, hooks y CI para Graph — coordinar antes de F1 |
| `bc484ac`, 20:34 | `docs/VALORES-DINAMICOS.md` con la evidencia de verificación en vivo |

### Infraestructura verificada por MCP (no por lectura de código)

| Verificación | Resultado |
|---|---|
| Supabase `list_projects` | **Un solo proyecto**: `miracle-app` / `zyvfamlhlmztliexvmej` / PG 17.6.1.127 / `ACTIVE_HEALTHY` |
| Supabase `list_tables` (`public`) | 28 tablas, todas con RLS. `consultations` 93 · `clinical_encounters` 115 · `clinical_templates` 157 · `patients` **2** · `graph_windows_users` **1** · `graph_windows_events` 43 · `consultation_addenda` 1 · **`runs` 3 (sin dueño conocido)**. **Ninguna tabla de trabajos/exportaciones** |
| Vercel `get_project` (Notes) | `miracle-web`, nextjs, Node 24.x, producción READY, `itsmiracleai.com.co` |
| Vercel `get_project` (Graph) | `graph`, Node 24.x, producción READY, `graph-eight-pied.vercel.app` |
| Vercel `list_projects` | Incluye **`miracle-his-simulator`** y `landing-descargas`; `u-windows-backend` con último deployment en `ERROR` y `target: null` (muerto) |
| `git rev-parse` (ambos repos) | Notes local == `origin/main` (`35e32e3`); Graph local `09653db` **detrás** de `origin/main` remoto (`bc484ac`) |
| `mcp__github__list_commits` / `list_pull_requests` | Los 4 PRs de la tabla anterior; Notes sin PRs nuevos relevantes |

---

## Revisión final del documento

Autocrítica pedida por el encargo. Se revisó el planning buscando:

- **Suposiciones no verificadas** → todas etiquetadas `INFERENCIA` o `PREGUNTA ABIERTA`. Las dos
  más relevantes: que el mismo uuid encounter/consulta se cumple en todos los flujos (§11 — y por
  eso el diseño lee de `consultations`, que siempre existe), y que el cliente C# vive en
  U-Windows-App (§18-I1).
- **Contradicciones** → se corrigieron cinco hallazgos del análisis previo (§16), incluida la
  limitación central que quedó obsoleta el mismo día.
- **Acoplamientos innecesarios** → Notes no conoce SAP, selectores ni workflows; envía solo un id.
  Operations no conoce Supabase ni el dominio clínico; recibe payload + plan. Graph no navega la UI.
- **Duplicación de datos o estados** → se elimina una fuente de verdad (`note_json` sale de la
  ecuación) en vez de sincronizar dos. No se añaden estados a la máquina clínica: el trabajo tiene
  los suyos y la consulta conserva los cinco que ya tenía.
- **Puntos únicos de fallo** → Graph es único coordinador (aceptado: ya lo es para todo el módulo
  clínico); el LLM del resolver está en el camino del claim (mitigado: falla explícito a
  `needs_doctor`, y D1 permite moverlo al cliente); Realtime tiene fallback.
- **Trabajos que pueden perderse** → cubierto por lease + re-claim + `result` con ack reintentado +
  estado en BD. El hueco residual conocido y declarado: si el ejecutor no implementa cola local
  durable (D8), un corte de red al final deja el trabajo `claimed` hasta que venza el lease.
- **Estados imposibles** → la matriz de §28 enumera quién puede mover cada transición; `completed`
  es terminal absoluto; no existe camino que marque `exportada` sin un `result ok`.
- **Comandos ejecutables tarde o en la sesión incorrecta** → no se construyen comandos en esta
  fase; el diseño futuro los acota con TTL de 30-60 s verificado **en la RPC**, no en la aplicación.
- **Acciones que deberían exigir confirmación** → marcado manual (con texto explícito de que no
  envía nada a SAP) y reintento tras `save_not_confirmed`. Exportar no la necesita: la firma ya fue
  el acto deliberado.
- **Responsabilidades que pertenecen al equipo SAP/Windows** → aisladas en §31 (D1-D8), §38 y §40,
  y ninguna bloquea F1-F3.
