# Graph Report - Pagina-web-clientes-final  (2026-08-24)

## Corpus Check
- 400 files · ~417,503 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2435 nodes · 4868 edges · 219 communities (169 shown, 50 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f57485e6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- piloto/page.tsx
- login/actions.ts
- dashboard/page.tsx
- TemplateBuilderPanel.tsx
- useDictation.ts
- reportError
- devDependencies
- actividad/page.tsx
- snippets.ts
- types.ts
- (marketing)/page.tsx
- en-vivo/page.tsx
- EncounterNote.tsx
- oficina.js
- redact.ts
- TypeScript Build Config
- mantenimiento/page.tsx
- clinical.ts
- motion
- search.ts
- Button.tsx
- Skeletons.tsx
- face-geometry.js
- mock/index.ts
- getCurrentProfile
- formatFechaRelativa
- LaboratorioWorkspace.tsx
- dates.ts
- Supabase (Postgres + GoTrue + PostgREST + RLS)
- PlanDischargePanel.tsx
- superadmin/page.tsx
- Graphify Setup Guide
- AppShell.tsx
- UnsavedChangesProvider.tsx
- Modelo ClinicalEncounter (template_snapshot congelado)
- note-review.ts
- SnippetImportDialog.tsx
- Alternativa A — cola en Postgres + long-poll con claim/lease
- entitlements.ts
- autenticacion-interna-plan.md — enrolamiento per-install (planificado)
- tabla clinical_encounters (Graph)
- app/api/generate-note/route.ts — generación de nota
- RPC claim_next_job — FOR UPDATE SKIP LOCKED + lease
- 20260621041058_auth_profiles_and_roles.sql
- Note Export Job Design
- file-to-text.ts
- Superadmin Activity Schema
- public.hospital_dashboard
- Web App Architecture Overview
- Product Strategy & Compliance
- Clinical HTTP API Client
- Multi-tenant Data Model & Audit
- Platform Diagnostics & Store
- superadmin/layout.tsx
- Multi-tenant Organizations Migration
- Superadmin Activity Feed
- Superadmin Destructive Operations
- Clinical API Integration Architecture
- auth/server.ts
- Las 7 prioridades reales de la auditoría
- Frontend Stack, Auth and CI
- dev-session.mjs
- Windows Agent Operations API
- Auth Roles and Access Control
- Tablas public: organizations, profiles, patients, consultations, audit_events, clinical_templates
- ConsultationCard.tsx
- Consultation Immutability and Addenda
- Dark Theme Contrast Tests
- 20260625204215_add_custom_clinical_templates.sql
- Clinical AI Endpoints
- Agent Links Schema
- consultation-text.ts
- Superadmin Overview RPC
- Superadmin Nav Counts RPC
- Pathology AI and Deployment Fixes
- Sentry Error Instrumentation
- Dynamic Value Binding
- Landing Page Visual Assets
- Superadmin and Membership Migration
- Org Member Creation RPC
- Appointments Agenda Schema
- Consultation Audit Stats View
- Clinical Data Compliance Rules
- Demo Flag Escalation Guard
- Role Escalation Guard
- Consultation Rotulo Sync
- Agent Link Value Push
- Agent Link Empty Push Filter
- CI and Completeness Rules
- Steps UI Component
- API Rate Limiting and Guards
- Secretary Export Access
- Custom Access Token Hook
- Consultation Count Aggregates
- Consultation Status Counts
- API Rate Limiting
- Secretary Role Access
- Next.js Agent Rules
- Project Architecture Docs
- Login Authentication Actions
- ESLint Configuration
- Client Instrumentation Hooks
- MCP Server Config
- Next.js Build Config
- Deep Link MCP Catalog
- PostCSS Tailwind Config
- Clinical Code Catalog
- Browser Voice Dictation
- Command Palette UI
- Review Notifications Bell
- Status Badge Component
- API Auth And Rate Limiting
- Appointments Table
- User Profiles Table
- User Profiles Table
- Organizations Table
- User Profiles Table
- User Profiles Table
- Medical Consultations Table
- User Profiles Table
- Medical Consultations Table
- User Profiles Table
- User Profiles Table
- Organizations Table
- User Profiles Table
- ReportesView.tsx
- patient-identity.ts
- providers.tsx
- validate-template-migrations.mjs
- signature-hash.test.ts
- onboarding/actions.ts
- 20260808140000_protect_org_owner.sql
- salud/page.tsx
- Workflow / Step / WorkflowBranch (Neo4j)
- public.consultations
- Header.tsx
- dependencies
- site.ts
- canAccessPath
- org.ts
- TemplateCatalog.tsx
- pintarPantalla
- Endpoints de plantillas (GET/POST/PUT/DELETE /templates)
- 20260808150000_reconciliar_owner_al_mover.sql
- Grabación existente: STT session + consultation_type audio_upload
- public.organizations
- 20260811100000_billing_accounts.sql
- Billing — B2C (pasarela por decidir) y B2B (institucional)
- 20260811130000_org_memberships.sql
- scripts
- 20260811120000_personal_org_medico.sql
- src/domain/windowsEngines.js — catálogo de motores
- package.json
- public.user_template_preferences
- createClient
- como-funciona/page.tsx
- 20260813120000_user_snippets.sql
- stripe
- vitest
- demo.ts
- supabase/server.ts
- public.superadmin_ai_usage
- precios/page.tsx
- metrics.ts
- procedural.js
- consultas/[id]/page.tsx
- contacto/page.tsx
- CommandPalette.tsx
- DailyTrend.tsx
- public.create_org_member
- rango.ts
- MedicalChat.tsx
- FaceTexture
- pbr.js
- atril
- matResplandor

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 81 edges
2. `formatFechaRelativa()` - 44 edges
3. `getCurrentProfile()` - 41 edges
4. `reportError()` - 34 edges
5. `useStore()` - 28 edges
6. `createClient()` - 27 edges
7. `ConsultaActivaInner()` - 22 edges
8. `Card()` - 22 edges
9. `resolverRango()` - 22 edges
10. `requireRole()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `DIAGNOSTICO.pdf (archivo vacío)` --semantically_similar_to--> `Las 7 prioridades reales de la auditoría`  [AMBIGUOUS] [semantically similar]
  DIAGNOSTICO.pdf → docs/diagnostico.md
- `upsertConsultation — protege la nota firmada` --semantically_similar_to--> `app/app/providers.tsx — store de contexto en el cliente`  [INFERRED] [semantically similar]
  MIRACLE_OPERATIONS_INTEGRATION_ANALYSIS.md → architecture-infrastructure.md
- `Placeholder gris azulado "Foto: el antes" — médico frente a la pantalla` --references--> `PRD v0 · Miracle como plataforma de inteligencia clínica-operativa`  [AMBIGUOUS]
  public/images/consulta-antes.jpg → docs/prd-miracle-v0.md
- `Estado por Supabase Realtime + fallback polling` --semantically_similar_to--> `Patrón SSE 50 s + bye (registerWindowsPanelRoutes)`  [INFERRED] [semantically similar]
  MIRACLE_NOTES_GRAPH_OPERATIONS_PLANNING.md → MIRACLE_OPERATIONS_INTEGRATION_ANALYSIS.md
- `lib/api/clinical.ts — cliente HTTP clínico único` --conceptually_related_to--> `app/api/generate-note/route.ts — generación de nota`  [AMBIGUOUS]
  MIRACLE_OPERATIONS_INTEGRATION_ANALYSIS.md → architecture-infrastructure.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Flujo de generación de nota clínica en el backend (plantilla → encounter → transcript → nota)** — docs_backend_clinical_api_contract_clinical_template, docs_backend_clinical_api_contract_clinical_encounter, docs_backend_clinical_api_contract_endpoint_transcript, docs_backend_clinical_api_contract_endpoint_generate_note, docs_backend_clinical_api_contract_note_json, docs_backend_clinical_api_contract_estados_encounter [EXTRACTED 0.95]
- **Aislamiento multi-tenant: modelo, RLS, store y decisiones que lo sostienen** — docs_arquitectura_multi_tenant, docs_arquitectura_rls, docs_arquitectura_tablas, docs_arquitectura_store_providers, docs_decisiones_d1_multi_tenant, docs_decisiones_d2_roles [INFERRED 0.85]
- **Bloqueo pre-producción: consentimiento, retención y transferencia internacional** — docs_diagnostico_d_legal, docs_legal_colombia_consentimientos, docs_legal_colombia_historia_clinica, docs_legal_colombia_transferencia, docs_decisiones_d9_nada_en_navegador, docs_roadmap_legal [INFERRED 0.85]
- **Flujo de exportación de la nota firmada (firma → trabajo → claim → exportada)** — planning_sign_consultation_note, planning_export_note, planning_register_clinical_routes, planning_graph_note_exports, planning_graph_claim_next_note_export, planning_simulate_operations_executor, planning_graph_mark_exported, contexto_consultations [EXTRACTED 0.90]
- **Tres carriles de autenticación aislados de Graph** — planning_require_clinical_auth, planning_require_api_key, planning_require_account_auth [EXTRACTED 0.95]
- **Huecos de honestidad del producto (simulación y falsos éxitos)** — diagnostico_f1_consulta_simulada, diagnostico_f9_exportar_placebo, diagnostico_c2_toast_falso, planning_export_note [EXTRACTED 0.85]
- **Cola Operations: tablas, RPC atómica y lease** — miracle_operations_integration_analysis_operations_devices, miracle_operations_integration_analysis_operations_jobs, miracle_operations_integration_analysis_operations_job_events, miracle_operations_integration_analysis_claim_next_job, miracle_operations_integration_analysis_expire_stale_leases, miracle_operations_integration_analysis_idempotency_key, miracle_operations_integration_analysis_job_state_machine [EXTRACTED 0.90]
- **Flujo firma → inmutabilidad → exportada** — miracle_operations_integration_analysis_sign_consultation_note, miracle_operations_integration_analysis_enforce_consultation_immutability, miracle_operations_integration_analysis_secretary_mark_exported, miracle_operations_integration_analysis_marcar_exportada_rpc, miracle_operations_integration_analysis_consultation_status, miracle_operations_integration_analysis_consultations [EXTRACTED 0.90]
- **Ejecución Windows → SAP: superficie, plan, mapeo y valores dinámicos** — miracle_operations_integration_analysis_workflow_player, miracle_operations_integration_analysis_sap_gui_surface, miracle_operations_integration_analysis_surface_locator, miracle_operations_integration_analysis_workflow_plan_endpoint, miracle_operations_integration_analysis_note_field_matcher, miracle_operations_integration_analysis_value_mode [INFERRED 0.80]

## Communities (219 total, 50 thin omitted)

### Community 0 - "piloto/page.tsx"
Cohesion: 0.18
Nodes (12): annotations, DemoPage(), metadata, measures, metadata, phases, PilotoPage(), CTAProps (+4 more)

### Community 1 - "login/actions.ts"
Cohesion: 0.11
Nodes (18): appUrl(), configured(), loginErrorUrl(), requestPasswordReset(), safeNext(), signInWithGoogle(), signInWithPassword(), messages (+10 more)

### Community 2 - "dashboard/page.tsx"
Cohesion: 0.14
Nodes (12): EventoRow, RevisarRow, Stats, MedicoView(), recentPatients(), AppPage(), AppPageHeader(), ClinicalSectionHeader() (+4 more)

### Community 3 - "TemplateBuilderPanel.tsx"
Cohesion: 0.09
Nodes (42): COMMON_SECTIONS, MODE_SUBTITLE, MODE_TITLE, TemplateBuilderPanel(), ClinicalTemplateSection, ClinicalTemplateSectionInput, createClinicalTemplate(), updateClinicalTemplate() (+34 more)

### Community 4 - "useDictation.ts"
Cohesion: 0.06
Nodes (33): DictationPanel(), mmss(), STATUS_TEXT, BARS, Waveform(), MiracleDeepgramDictation, createDictation, DictationHandle (+25 more)

### Community 5 - "reportError"
Cohesion: 0.05
Nodes (81): GET(), runtime, POST(), runtime, subscriptionIdFrom(), alignSections(), FilledSection, maxDuration (+73 more)

### Community 6 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+9 more)

### Community 7 - "actividad/page.tsx"
Cohesion: 0.15
Nodes (27): CABECERAS, dynamic, GET(), CABECERAS, dynamic, GET(), Params, SuperadminActividadPage() (+19 more)

### Community 8 - "snippets.ts"
Cohesion: 0.15
Nodes (23): AtajosManager(), EditorState, SnippetEditorDialog(), SnippetPopup(), SnippetPopupMode, SNIPPET_FILE_ACCEPT, categoriesFrom(), clampSnippetDraft() (+15 more)

### Community 9 - "types.ts"
Cohesion: 0.09
Nodes (17): StoreValue, RoleSwitcher(), CLINICAL_TEMPLATE_COUNT, clinicalTemplateCatalog, OrgSettings, doctors, ESPECIALIDADES, patients (+9 more)

### Community 10 - "(marketing)/page.tsx"
Cohesion: 0.12
Nodes (15): Figure(), FigureProps, Impact, ImpactStats(), items, phases, PilotoTeaser(), StatementBand() (+7 more)

### Community 11 - "en-vivo/page.tsx"
Cohesion: 0.08
Nodes (24): ConsultaActivaInner(), FlowPhase, PHASE_LABEL, ReviewView, STATUS_LABEL, TYPE_LABEL, useTranscriptAutosave(), PatientHeader() (+16 more)

### Community 12 - "EncounterNote.tsx"
Cohesion: 0.14
Nodes (20): EditableBlock(), EncounterNote(), rowsForText(), SpeechRecognitionConstructor, SpeechRecognitionEventLike, SpeechRecognitionLike, SpeechRecognitionResultLike, ClinicalNoteSection (+12 more)

### Community 13 - "oficina.js"
Cohesion: 0.01
Nodes (147): afuera, aguja1, aguja2, aroReloj, asaTaza, asiento, atril1, atril2 (+139 more)

### Community 14 - "redact.ts"
Cohesion: 0.11
Nodes (20): ACCENT_CLASSES, buildDocumentoRegex(), buildNombreRegex(), buildRedactor(), COLLAPSE_PACIENTE, escapeRegExp(), EXCLUDED_NOTE_KEYS, NAME_PARTICLES (+12 more)

### Community 15 - "TypeScript Build Config"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 16 - "mantenimiento/page.tsx"
Cohesion: 0.17
Nodes (8): OrgFila, UsuarioFila, DashboardOrgs, EmptyState(), DangerZoneDialog(), FilterBar(), FilterSelect, FlashBanner()

### Community 17 - "clinical.ts"
Cohesion: 0.06
Nodes (45): apiBaseUrl(), archiveClinicalTemplate(), ASSISTANT_TIMEOUT_MS, AssistantChatMessage, AssistantChatPayload, AssistantChatResult, AssistantScreenContext, BackendConsultationType (+37 more)

### Community 19 - "search.ts"
Cohesion: 0.41
Nodes (10): categoryMatchesSection(), DIACRITICS, editDistance(), fuzzyWordMatch(), matchesQuery(), normalizeForSearch(), searchList(), tolerancia() (+2 more)

### Community 20 - "Button.tsx"
Cohesion: 0.18
Nodes (9): PacienteDetallePage(), ContactForm(), roles, Button(), ButtonProps, Size, sizes, Variant (+1 more)

### Community 21 - "Skeletons.tsx"
Cohesion: 0.17
Nodes (5): SkeletonCard(), SkeletonChips(), SkeletonTable(), SkeletonTileRow(), SkeletonTitulo()

### Community 22 - "face-geometry.js"
Cohesion: 0.08
Nodes (14): dentro, montar(), el(), Face, brow(), R, squirclePath(), squirclePoints() (+6 more)

### Community 23 - "mock/index.ts"
Cohesion: 0.16
Nodes (13): CodificacionTab(), SupervisorView(), consultations, MOCK_TODAY, acceptedCodes(), completitud(), formatFechaRelativa(), formatHora() (+5 more)

### Community 24 - "getCurrentProfile"
Cohesion: 0.15
Nodes (29): LaboratorioPage(), PlantillasPage(), PlantillasTabs(), AccionCritica, archiveOrganization(), assignUserToOrg(), back(), baseOrg() (+21 more)

### Community 25 - "formatFechaRelativa"
Cohesion: 0.13
Nodes (26): UsuariosPage(), Encabezado(), SuperadminAnaliticaPage(), MantenimientoPage(), ConsultaRow, DashboardOrg, SuperadminOrganizacionDetallePage(), OrganizacionesPage() (+18 more)

### Community 26 - "LaboratorioWorkspace.tsx"
Cohesion: 0.15
Nodes (13): FilledSection, LaboratorioWorkspace(), MIME_OK, ProfessionalInfo, TemplateRow, TemplateSectionMeta, ZONA_CLINICA, buildLabReportHtml() (+5 more)

### Community 27 - "dates.ts"
Cohesion: 0.22
Nodes (16): AutoRefresh(), fijarPreferencia(), leerEnServidor(), leerPreferencia(), oyentes, suscribir(), claveDiaZona(), esDeHoy() (+8 more)

### Community 28 - "Supabase (Postgres + GoTrue + PostgREST + RLS)"
Cohesion: 0.13
Nodes (19): app/auth/callback/route.ts — exchangeCodeForSession + safeNext, lib/auth/roles.ts — política de autorización pura, lib/auth/server.ts, canAccessPath, Evaluación Clean Architecture (14/28, 50 %), RPC create_org_member (SECURITY DEFINER), app/app/consultas/en-vivo/page.tsx — consulta en vivo (simulada), getCurrentProfile / requireRole (+11 more)

### Community 29 - "PlanDischargePanel.tsx"
Cohesion: 0.12
Nodes (11): ListKind, medicationLine(), PlanDischargePanel(), SpeechRecognitionConstructor, SpeechRecognitionEventLike, SpeechRecognitionLike, SpeechRecognitionResultLike, ClinicalAlarmSign (+3 more)

### Community 30 - "superadmin/page.tsx"
Cohesion: 0.18
Nodes (10): Dashboard, Kpi, nf, Sparkline(), StatTile(), formatDia(), niceTicks(), PAD (+2 more)

### Community 31 - "Graphify Setup Guide"
Cohesion: 0.11
Nodes (18): 1. Instalar uv, 2. Instalar graphify, 3. Registrar la skill y los hooks, 4. Traer el grafo, Actualizar el grafo a mano, Camino entre dos partes del sistema, Comandos útiles, Encontrar los archivos más conectados (los críticos) (+10 more)

### Community 32 - "AppShell.tsx"
Cohesion: 0.24
Nodes (12): ConsultaDetallePage(), DashboardPage(), useStore(), AppShell(), initials(), BillingBanner(), fechaCorta(), NotificationsBell() (+4 more)

### Community 33 - "UnsavedChangesProvider.tsx"
Cohesion: 0.15
Nodes (12): AppLayout(), metadata, GuardState, UnsavedChangesContext, UnsavedChangesProvider(), UnsavedChangesValue, useUnsavedChangesGuard(), ConfirmContext (+4 more)

### Community 34 - "Modelo ClinicalEncounter (template_snapshot congelado)"
Cohesion: 0.36
Nodes (8): Cierre clínico universal: discharge, plan, alarm_signs, private_notes, Modelo ClinicalEncounter (template_snapshot congelado), Modelo ClinicalTemplate (secciones normalizadas), Contrato API Clínica /api/clinical/* (copia local del backend Graph), POST /encounters/:id/generate-note (LLM, rate limit reforzado), Envelope de errores y tabla de códigos (TEMPLATE_NOT_FOUND, LLM_NOT_CONFIGURED…), Modelo NoteJson (secciones exactas del snapshot + confidence), Suite verify-clinical-workflow.js (Supabase y LLM fake)

### Community 35 - "note-review.ts"
Cohesion: 0.05
Nodes (64): AuditoriaPage(), nombreDe(), AgentPairPanel(), AuditFindingList(), AuditSeverityBadge(), SEVERITY_STYLE, CONCEPT_LABEL, COVERAGE_STYLE (+56 more)

### Community 36 - "SnippetImportDialog.tsx"
Cohesion: 0.27
Nodes (10): Phase, SnippetImportDialog(), MAX_IMPORT_FILES, applySuggestions(), CATEGORIZE_CHUNK, CATEGORIZE_TEXT_CHARS, chunk(), ImportRow (+2 more)

### Community 37 - "Alternativa A — cola en Postgres + long-poll con claim/lease"
Cohesion: 0.13
Nodes (16): Alternativa A — cola en Postgres + long-poll con claim/lease, Alternativa C — híbrida: cola + push + Realtime para ver, POST /api/v1/autofill/match, POST /api/v1/operations/jobs/claim (long-poll ~40 s), ClinicalNoteJson (note_json: sections, discharge, warnings), ensureClinicalDischarge — normalización de discharge, Fase 3 — escritura real en SAP/HIS y fallos parciales, Fase 6 — tiempo real (Alternativa C) (+8 more)

### Community 38 - "entitlements.ts"
Cohesion: 0.23
Nodes (9): accessOf(), BillingAccountRow, BillingMode, BillingStatus, deriveAccess(), GRACE_DAYS, StripeStatus, AHORA (+1 more)

### Community 39 - "autenticacion-interna-plan.md — enrolamiento per-install (planificado)"
Cohesion: 0.16
Nodes (14): Alternativa B — tiempo real puro (Realtime / WebSocket), autenticacion-interna-plan.md — enrolamiento per-install (planificado), ConfiguracionForm — slot vacío HIS/HCE, distribucion-app-conectada.md — key embebida compartida y descompilable, POST /api/v1/operations/enroll, Fase 1 — identidad de dispositivo, tabla graph_windows_devices (device_id, token_hash, revoked), tabla graph_windows_users (identidad = email) (+6 more)

### Community 40 - "tabla clinical_encounters (Graph)"
Cohesion: 0.19
Nodes (14): buildTemplateSnapshot — congela la plantilla con snapshot_at, ClinicalEncounterService, tabla clinical_encounters (Graph), tabla consultations (Notes), deriveMotivo, encounterToConsultation — puente 1:1 por mismo id, private.enforce_consultation_immutability (trigger), noteJsonToSections — aplana sections (+6 more)

### Community 41 - "app/api/generate-note/route.ts — generación de nota"
Cohesion: 0.18
Nodes (13): Anthropic Messages API, app/api/chat/route.ts — proxy de chat clínico, app/api/generate-note/route.ts — generación de nota, lib/observability.ts — reportError (Sentry inerte), proxy.ts — middleware de autenticación (Next.js modificado), R1 — endpoints de IA sin autenticación, R8 — PHI transportada al LLM de terceros, Despliegue en Vercel (serverless + edge + CDN) (+5 more)

### Community 42 - "RPC claim_next_job — FOR UPDATE SKIP LOCKED + lease"
Cohesion: 0.18
Nodes (13): audit_events — canal de auditoría append-only, RPC claim_next_job — FOR UPDATE SKIP LOCKED + lease, RPC expire_stale_leases — barrido perezoso, Fase 2 — la cola y el camino feliz (MVP), graph_prompts (Android) — molde de estados running/ok/error/cancelled, idempotency_key = sha256(consultation_id + firma.hash + attempt_group), POST /api/v1/operations/jobs/:id/result (terminal, con ack), Máquina de estados del trabajo (pending…needs_doctor) (+5 more)

### Community 43 - "20260621041058_auth_profiles_and_roles.sql"
Cohesion: 0.18
Nodes (10): private.handle_new_user, private.set_profile_updated_at, on_auth_user_created, on_profile_role_change, on_profile_updated, private.current_app_role(), private.prevent_last_admin_removal(), public.profiles (+2 more)

### Community 44 - "Note Export Job Design"
Cohesion: 0.20
Nodes (12): Rate-limit 120/min por IP y riesgo NAT hospitalario, Patrón SSE 50 s + bye (registerWindowsPanelRoutes), Alternativa A — Trabajo persistente + pull (elegida), Alternativa C — Sin tabla nueva (descartada), Command bridge (N3, pospuesto), RPC graph_claim_next_note_export, graph_note_exports — tabla de trabajos (nueva), Idempotencia por UNIQUE(consultation_id) (+4 more)

### Community 45 - "file-to-text.ts"
Cohesion: 0.29
Nodes (11): ACCEPTED_TYPES, decodeEntities(), extractTextFromFile(), filenameToTitle(), htmlToSnippetText(), isDocx(), MammothLike, MAX_SNIPPET_FILE_BYTES (+3 more)

### Community 46 - "Superadmin Activity Schema"
Cohesion: 0.17
Nodes (11): public.graph_note_exports, public.superadmin_activity(), auth.users, public.audit_events, public.clinical_encounters, public.consultations, public.organizations, public.profiles (+3 more)

### Community 47 - "public.hospital_dashboard"
Cohesion: 0.12
Nodes (15): kpis, por_estado, por_medico, por_servicio, por_tipo, rango, roster, serie (+7 more)

### Community 48 - "Web App Architecture Overview"
Cohesion: 0.20
Nodes (11): Capas: navegador → useStore → Supabase / Anthropic, Flujo de una consulta: nueva → en-vivo → nota → aprobar/firmar/exportar, IA vía rutas server /api/chat y /api/generate-note con fallback, El store app/app/providers.tsx, único puente a Supabase, D13 · lib/dates.ts fija America/Bogota, D5 · El store como único puente a Supabase, D6 · IA agnóstica del modelo vía rutas server con fallback, B · Integridad: escrituras fire-and-forget y optimismo sin rollback (+3 more)

### Community 49 - "Product Strategy & Compliance"
Cohesion: 0.20
Nodes (11): D7 · El HIS lo maneja Milagro, no la web, Habeas Data: Ley 1581/2012 y datos sensibles de salud, PRD v0 · Miracle como plataforma de inteligencia clínica-operativa, Reglas de claims: la IA asiste, el médico decide, Índice de documentación de Miracle web, Roadmap 6 · Cumplimiento legal Colombia antes de pacientes reales, Benchmark Telepatía: qué copiar y qué no, Categoría propia: inteligencia clínica-operativa para Colombia (+3 more)

### Community 50 - "Clinical HTTP API Client"
Cohesion: 0.18
Nodes (11): Miracle Operations — Análisis de Integración, apiBaseUrl() — NEXT_PUBLIC_API_BASE_URL, buildClinicalRequest (función pura), ClinicalApiError / CLINICAL_ERROR_MESSAGES, clinicalRequest<T>() — ejecución y normalización de errores, getAccessToken() — access_token de la sesión Supabase, encounterService.getOwnedEncounter — verificación de propiedad, lib/api/clinical.ts — cliente HTTP clínico único (+3 more)

### Community 51 - "Multi-tenant Data Model & Audit"
Cohesion: 0.22
Nodes (10): Tabla audit_events (append-only), Tabla consultations, Modelo multi-tenant por organización (RLS), clinical_encounters (Graph) — note_json, encounter-to-consultation — espejo 1:1, private.enforce_consultation_immutability, RPC graph_mark_exported, R1 — Divergencia de serialización del hash (+2 more)

### Community 52 - "Platform Diagnostics & Store"
Cohesion: 0.24
Nodes (10): useStore — app/app/providers.tsx, Supabase miracle-app (zyvfamlhlmztliexvmej), DIAGNÓSTICO de plataforma (2026-07-06), C2 — Toast afirma exportación que no ocurrió, F1 — Consulta en vivo simulada firmable, F2/P1 — Store bloquea la plataforma al cargar, F9 — 'Exportar a HC' es un placebo, I1 — No hay recuperación de contraseña (+2 more)

### Community 53 - "superadmin/layout.tsx"
Cohesion: 0.20
Nodes (13): signOut(), initials(), metadata, SuperadminLayout(), alternar(), escribiendo(), SidebarToggle(), usarAtajo() (+5 more)

### Community 54 - "Multi-tenant Organizations Migration"
Cohesion: 0.36
Nodes (8): private.current_app_role(), private.current_org(), public.audit_events, public.consultations, public.organizations, public.patients, auth.users, public.profiles

### Community 55 - "Superadmin Activity Feed"
Cohesion: 0.20
Nodes (9): public.superadmin_activity(), auth.users, public.audit_events, public.clinical_encounters, public.consultations, public.profiles, usuarios, usuarios_calc (+1 more)

### Community 57 - "Clinical API Integration Architecture"
Cohesion: 0.25
Nodes (9): Graph = una función serverless (maxDuration 60 s), Análisis técnico de integración (previo), No existe cola de trabajos en ningún repo, u-windows-backend muerto (deployment ERROR), exportNote() — embudo de exportación, lib/api/clinical.ts — cliente clínico único, registerClinicalRoutes.js (carril /api/clinical), requireAccountAuth (Provider Studio) (+1 more)

### Community 58 - "auth/server.ts"
Cohesion: 0.15
Nodes (16): AuditoriaLayout(), ConfiguracionLayout(), ConfiguracionPage(), metadata, NuevaConsultaLayout(), back(), updateUserRole(), ProfileRow (+8 more)

### Community 59 - "Las 7 prioridades reales de la auditoría"
Cohesion: 0.25
Nodes (8): DIAGNOSTICO.pdf (archivo vacío), C · Rendimiento: 4 índices FK faltantes y cargas sin paginación, D · Cumplimiento legal: sin consentimiento, sin retención, G · UX / accesibilidad: contraseña visible, errores no mostrados, H · Deuda de esquema: migraciones no reproducibles, Las 7 prioridades reales de la auditoría, Dos consentimientos: acto médico y tratamiento/grabación de datos, Transferencia internacional: Supabase en us-east-1

### Community 60 - "Frontend Stack, Auth and CI"
Cohesion: 0.22
Nodes (9): Autenticación Bearer con access token de Supabase (JWKS offline), E · Calidad: cero tests, sin CI/CD, sin observabilidad, Stack: Next.js App Router + TypeScript + Tailwind v4, deploy Vercel, Roadmap 7 · Observabilidad, backups, tests y CI, Variables NEXT_PUBLIC_SUPABASE_* y NEXT_PUBLIC_SITE_URL, Configuración de Google OAuth y redirect URLs, Job CI build-and-test (lint, typecheck, test, build), Variables dummy de Supabase para el build de CI (+1 more)

### Community 61 - "dev-session.mjs"
Cohesion: 0.12
Nodes (9): alias, argumentos, CUENTAS, envLocal, password, posicional, salida, supabase (+1 more)

### Community 62 - "Windows Agent Operations API"
Cohesion: 0.25
Nodes (8): windows-app sin remoto GitHub (límite del análisis), AgentTurnService — bucle pull del cliente, Alternativa B — Goal al agente (descartada), R14 — API key compartida descompilable, registerOperationsRoutes.js (nuevo, /api/v1/operations), requireApiKey (X-API-Key /api/v1), simulate-operations-executor.js (ejecutor de referencia), U-Windows-App (cliente C# / U.exe)

### Community 63 - "Auth Roles and Access Control"
Cohesion: 0.25
Nodes (8): Auth Supabase y gating por rol (canAccessPath, requireRole), Middleware proxy.ts (no cubre /api/*), D2 · Roles médico / supervisor / admin y su visibilidad, A · Seguridad / abuso: /api/* sin auth ni rate-limit, PHI en logs, Bug create_org_member: tokens GoTrue en NULL impiden el login, Roadmap 4 · B2B real: superadmin y alta de médicos (hecho), Migración 20260621041058_auth_profiles_and_roles.sql, Roles medico / supervisor / admin en public.profiles

### Community 64 - "Tablas public: organizations, profiles, patients, consultations, audit_events, clinical_templates"
Cohesion: 0.33
Nodes (7): Modelo multi-tenant por organización, RLS por organización con helpers en schema private, Tablas public: organizations, profiles, patients, consultations, audit_events, clinical_templates, D1 · Todos pertenecen a una organización, D3 · Nota, códigos y transcripción como JSONB, D4 · Auditoría en tabla aparte append-only, Correcciones: falsos positivos descartados contra la base viva

### Community 65 - "ConsultationCard.tsx"
Cohesion: 0.21
Nodes (12): CardConsultation, ConsultationCard(), rotuloDe(), acotar(), ConsultationCardPreview(), Posicion, ubicar(), STATUS_BAR (+4 more)

### Community 66 - "Consultation Immutability and Addenda"
Cohesion: 0.25
Nodes (6): private.enforce_consultation_immutability, consultations_immutability, public.consultation_addenda, auth.users, public.consultations, public.organizations

### Community 67 - "Dark Theme Contrast Tests"
Cohesion: 0.32
Nodes (7): contrast(), css, cssBlock(), dark, light, luminance(), variablesFrom()

### Community 68 - "20260625204215_add_custom_clinical_templates.sql"
Cohesion: 0.29
Nodes (5): auth, on_clinical_templates_updated, public.clinical_templates, auth.users, private.set_updated_at

### Community 69 - "Clinical AI Endpoints"
Cohesion: 0.33
Nodes (7): /api/chat — chatbot clínico, /api/generate-note, lib/clinical/codes.ts — catálogo CIE-10/CUPS, Milagro (extensión Chrome B2B), Miracle (web) — scribe clínico, S1 — APIs de IA sin autenticación, R16 — CONTEXTO.md describe Graph erróneamente

### Community 70 - "Agent Links Schema"
Cohesion: 0.33
Nodes (4): public.agent_links, public.agent_values_for_code(), auth.users, public.organizations

### Community 71 - "consultation-text.ts"
Cohesion: 0.16
Nodes (16): CodeSuggestion(), Bloque, bloquesDeConsulta(), buildConsultationHtml(), buildConsultationPlainText(), ConsultationTextAddendum, ConsultationTextInput, ConsultationTextPatient (+8 more)

### Community 72 - "Superadmin Overview RPC"
Cohesion: 0.33
Nodes (5): public.superadmin_overview(), public.consultations, public.organizations, public.patients, public.profiles

### Community 73 - "Superadmin Nav Counts RPC"
Cohesion: 0.33
Nodes (5): public.superadmin_nav_counts(), public.clinical_encounters, public.consultations, public.organizations, public.profiles

### Community 74 - "Pathology AI and Deployment Fixes"
Cohesion: 0.40
Nodes (5): Patología bloqueada: falta ANTHROPIC_API_KEY, Trampa de despliegue: .vercel/project.json apunta a miracle-web-testing, Ruta app/api/clinical/note-from-photo/route.ts (una sola llamada IA por foto), Plantillas de patología en producción (specialty_code = patologia), Roadmap 2 · Encender la IA y construir el recomendador de diagnósticos

### Community 76 - "Dynamic Value Binding"
Cohesion: 0.40
Nodes (5): DynamicValueResolver (umbral 0.7), NoteFieldMatcher (confidence ≥ 0.75), Step (valueMode/bindTo/nodeKey/nodePath), verify-live-plan.js — dry-run del plan, WorkflowExecutor.applyDynamicValues

### Community 77 - "Landing Page Visual Assets"
Cohesion: 0.40
Nodes (5): Logo Miracle: orbe azul con degradado radial sobre cuadro redondeado, Placeholder vertical oscuro "Foto de médico" (impacto 1), Placeholder vertical azul brillante "Foto de médico" (impacto 2), Placeholder vertical azul oscuro "Foto de médico" (impacto 3), Placeholder vertical azul medio "Foto de médico" (impacto 4)

### Community 78 - "Superadmin and Membership Migration"
Cohesion: 0.50
Nodes (3): private.is_superadmin(), private.prevent_last_admin_removal(), public.profiles

### Community 79 - "Org Member Creation RPC"
Cohesion: 0.40
Nodes (4): public.create_org_member(), auth.users, public.organizations, public.profiles

### Community 80 - "Appointments Agenda Schema"
Cohesion: 0.40
Nodes (4): public.appointments, auth.users, public.organizations, public.patients

### Community 81 - "Consultation Audit Stats View"
Cohesion: 0.50
Nodes (3): c, public.consultation_audit_stats(), public.consultations

### Community 82 - "Clinical Data Compliance Rules"
Cohesion: 0.67
Nodes (4): D11 · Dar de baja no es borrar (archivado y FK en CASCADE), D12 · La contraseña se verifica en la base con private.verify_own_password, D9 · Nada de datos clínicos en el navegador, Historia clínica: Res. 1995/1999, conservación 15 años

### Community 88 - "CI and Completeness Rules"
Cohesion: 0.67
Nodes (3): .github/workflows/ci.yml — lint, typecheck, test, build, completitud() / ripsChecklist(), consultation_audit_stats — regla de completitud duplicada en SQL

### Community 90 - "API Rate Limiting and Guards"
Cohesion: 0.67
Nodes (3): rateLimit — doble barrera memoria + Postgres, fail-open, requireApiUser (lib/api/guard.ts), app/api/stt/session/route.ts — servidor Notes → Graph con MIRACLE_API_KEY

### Community 149 - "ReportesView.tsx"
Cohesion: 0.16
Nodes (22): AdminView(), metadata, ReportesPage(), AdoptionFooterLink(), AdoptionTable(), TONO, ReportesView(), ClienteRpc (+14 more)

### Community 150 - "patient-identity.ts"
Cohesion: 0.26
Nodes (12): buscarSeccion(), documentoEnProsa(), esSeccionDeIdentidad(), extractPatientIdentity(), limpiarDocumento(), limpiarNombre(), NO_ES_NOMBRE, nombreDeSeccion() (+4 more)

### Community 151 - "providers.tsx"
Cohesion: 0.14
Nodes (23): ConsultationAddendum, DURACION_MS, MiracleProvider(), NewPatientInput, rowToConsultation(), rowToPatient(), StoreContext, Toast (+15 more)

### Community 152 - "validate-template-migrations.mjs"
Cohesion: 0.10
Nodes (16): errors, expectedInserts, factoryIdToSpecialty, files, inventory, INVENTORY_PATH, laterFiles, MIGRATIONS_DIR (+8 more)

### Community 153 - "signature-hash.test.ts"
Cohesion: 0.50
Nodes (6): canonicalSignaturePayload(), computeSignatureHash(), signatureHashMatches(), SignedConsultationContent, cases, VectorCase

### Community 154 - "onboarding/actions.ts"
Cohesion: 0.36
Nodes (6): completeClinicalOnboarding(), OnboardingState, ClinicalOnboardingForm(), initialState, OnboardingPage(), getClinicalSpecialty()

### Community 156 - "20260808140000_protect_org_owner.sql"
Cohesion: 0.13
Nodes (11): private.protect_org_owner, private.protect_org_owner_column, prevent_last_admin_removal, private.sync_org_owner(), protect_org_owner, protect_org_owner_column, private.prevent_last_admin_removal, private.sync_org_owner (+3 more)

### Community 157 - "salud/page.tsx"
Cohesion: 0.14
Nodes (19): DashboardSalud, ESTADO_WEB_LABEL, EXPORT_STATUS_LABEL, SuperadminSaludPage(), Alerta, AlertPanel(), ESTILO, ORDEN (+11 more)

### Community 160 - "Workflow / Step / WorkflowBranch (Neo4j)"
Cohesion: 0.20
Nodes (10): AgentTurnService.handleTurn — turno stateless, costura sagrada, assembleTools — catálogo MCP por superficie, CONTEXTO.md — describe mal a Graph ('repo viejo/aparte'), Fase 0 — desbloquear y validar el riesgo caro (PoC SAP), Neo4jWorkflowRepository, windows-client/src/Domain/Protocol.cs — contrato espejo, registerMcpRoutes.js — POST /api/v1/mcp (devuelve el PLAN), R7 — la escritura en SAP no está probada (+2 more)

### Community 162 - "Header.tsx"
Cohesion: 0.18
Nodes (9): metadata, BrandMark(), BrandMarkProps, Logo(), LogoProps, Footer(), legalNav, Header() (+1 more)

### Community 164 - "dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, mammoth, next, dependencies, lucide-react, mammoth, next, react (+9 more)

### Community 165 - "site.ts"
Cohesion: 0.16
Nodes (11): display, metadata, mono, sans, viewport, allRoles, appNav, AppNavGroup (+3 more)

### Community 166 - "canAccessPath"
Cohesion: 0.33
Nodes (7): canAccessPath(), DEMO_SECTIONS, isDemoSection(), redirectWithSession(), updateSession(), config, proxy()

### Community 168 - "org.ts"
Cohesion: 0.15
Nodes (15): back(), texto(), updateOrgSettings(), ConfiguracionForm(), letterheadLines(), limpiar(), ORG_SETTINGS_VACIOS, OrgSettingsRow (+7 more)

### Community 170 - "TemplateCatalog.tsx"
Cohesion: 0.10
Nodes (36): modalities, NuevaConsultaForm(), BuilderState, CreationMode, ExampleDialog(), ScopeFilter, TemplateCatalog(), TemplatePreview() (+28 more)

### Community 172 - "pintarPantalla"
Cohesion: 0.17
Nodes (12): aplicarEmpalme(), caraBlink(), caraMirada(), easeEmpalme, estadoCampo(), fovParaAspect(), frame(), muestrearRiel() (+4 more)

### Community 175 - "Endpoints de plantillas (GET/POST/PUT/DELETE /templates)"
Cohesion: 0.40
Nodes (6): Catálogo de 147 plantillas institucionales / 49 especialidades, Endpoints de plantillas (GET/POST/PUT/DELETE /templates), specialty_code: guiones vs guion_bajo (normalización), Clasificación de 49 especialidades en 9 áreas médicas, Opción A · tabla clinical_specialties + GET /api/clinical/specialties, Endpoint futuro POST /api/clinical/templates/suggest (creación asistida)

### Community 176 - "20260808150000_reconciliar_owner_al_mover.sql"
Cohesion: 0.33
Nodes (4): private.reconciliar_owner(), private.sync_org_owner, public.profiles, sync_org_owner

### Community 177 - "Grabación existente: STT session + consultation_type audio_upload"
Cohesion: 0.40
Nodes (5): Grabación existente: STT session + consultation_type audio_upload, POST /encounters/:id/transcript (límite 200 000 caracteres), Máquina de estados del encounter (created → completed / failed), F · Features maqueta: configuración no guarda, captura simulada, subir audio inerte, Roadmap 3 · Audio real (MediaRecorder + Deepgram/Whisper)

### Community 179 - "20260811100000_billing_accounts.sql"
Cohesion: 0.17
Nodes (7): private.ensure_billing_account, ensure_billing_account, on_billing_accounts_updated, public.billing_accounts, public.billing_events, private.set_updated_at, public.organizations

### Community 181 - "Billing — B2C (pasarela por decidir) y B2B (institucional)"
Cohesion: 0.11
Nodes (17): Billing — B2C (pasarela por decidir) y B2B (institucional), Bloque 1 · En Stripe (navegador, ~10 min), Bloque 2 · En Supabase (2 min), Bloque 3 · En tu computador, para probar (~15 min), Bloque 4 · En producción (Vercel), Ciclo de vida B2C, El precio, Flujo Stripe (+9 more)

### Community 182 - "20260811130000_org_memberships.sql"
Cohesion: 0.20
Nodes (8): private.prevent_foreign_org_change, on_org_memberships_updated, prevent_foreign_org_change, public.org_memberships, public.switch_active_organization(), private.set_updated_at, public.organizations, public.profiles

### Community 186 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, start, test, test:watch, typecheck

### Community 189 - "20260811120000_personal_org_medico.sql"
Cohesion: 0.29
Nodes (4): private.prevent_last_admin_removal(), private.protect_org_owner(), public.organizations, public.profiles

### Community 191 - "src/domain/windowsEngines.js — catálogo de motores"
Cohesion: 0.29
Nodes (8): LogBus.cs — bus de logs local en memoria, outcomeForEvent (ok|error|skipped|null), POST /api/v1/workflows/:id/prepend-alignment — idempotencia bien hecha, SapGuiSurface — SAP GUI Scripting, selectores sap:, SurfaceLocator — sapgui://SID/TCODE, uia://, web://, src/domain/windowsEngines.js — catálogo de motores, POST /api/v1/workflows/:id/plan (acepta variables), WorkflowPlayer.cs — pide plan, alinea, ejecuta y aprende

### Community 192 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 193 - "public.user_template_preferences"
Cohesion: 0.50
Nodes (3): public.clinical_templates, public.user_template_preferences, auth.users

### Community 194 - "createClient"
Cohesion: 0.36
Nodes (6): signConsultationNote(), SignNoteResult, PacientesPage(), GET(), safeNext(), createClient()

### Community 197 - "20260813120000_user_snippets.sql"
Cohesion: 0.40
Nodes (4): on_user_snippets_updated, public.user_snippets, auth.users, private.set_updated_at

### Community 200 - "demo.ts"
Cohesion: 0.29
Nodes (5): Timeline(), DEMO_AUDIT_ACCION, DEMO_MOTIVO, AuditEvent, SpeakerTurn

### Community 201 - "supabase/server.ts"
Cohesion: 0.09
Nodes (27): ConsultasFilters(), DoctorOption, AccessRow, ConsultasPage(), ESTADOS, patientName(), Row, ESTADOS (+19 more)

### Community 202 - "public.superadmin_ai_usage"
Cohesion: 0.25
Nodes (7): public.ai_usage_events, public.superadmin_ai_usage(), actual, previo, public.organizations, public.profiles, tot

### Community 203 - "precios/page.tsx"
Cohesion: 0.24
Nodes (9): faqItems, metadata, PreciosPage(), PlanCard(), FAQ(), FAQItem, PLAN, precioDisplay() (+1 more)

### Community 204 - "metrics.ts"
Cohesion: 0.33
Nodes (5): adoptionByService, managementKpis, qualityByService, timeBeforeAfter, weeklyNotes

### Community 205 - "procedural.js"
Cohesion: 0.31
Nodes (9): lerp(), makeContactShadow(), makeDustAlpha(), makeGlassSmudge(), makeLeafAlpha(), makeRoughnessMap(), makeTerrazzoMap(), makeWoodMap() (+1 more)

### Community 206 - "consultas/[id]/page.tsx"
Cohesion: 0.10
Nodes (12): AuditoriaTab(), COMBINING_MARKS_RE, BADGE_TONE, NoteExportButton(), NoteExportStatus(), NoteSectionView(), TabItem, Tabs() (+4 more)

### Community 207 - "contacto/page.tsx"
Cohesion: 0.14
Nodes (11): metadata, metadata, metadata, resources, metadata, FeatureCard(), PageHero(), SecurityBadge() (+3 more)

### Community 208 - "CommandPalette.tsx"
Cohesion: 0.15
Nodes (17): AppSidebar(), CommandPalette(), Grupo, Item, BeforeInstallPromptEvent, InstallAppButton(), icons, isActive() (+9 more)

### Community 209 - "DailyTrend.tsx"
Cohesion: 0.60
Nodes (4): DailyTrend(), formatDia(), niceTicks(), PAD

### Community 210 - "public.create_org_member"
Cohesion: 0.40
Nodes (4): public.create_org_member(), auth.users, public.organizations, public.profiles

### Community 212 - "rango.ts"
Cohesion: 0.15
Nodes (23): SuperadminConsumoPage(), SuperadminResumenPage(), ETIQUETA_CORTA, RangePicker(), ConsumoIa, ETIQUETA_FEATURE, formatTokens(), formatUsd() (+15 more)

### Community 213 - "MedicalChat.tsx"
Cohesion: 0.15
Nodes (10): Failure, MedicalChat(), Msg, RETRYABLE_CODES, SUGERENCIAS, adjustNoteWithAssistant(), CLINICAL_ERROR_MESSAGES, sendAssistantChat() (+2 more)

### Community 217 - "pbr.js"
Cohesion: 0.67
Nodes (3): aplicarPBR(), cargadorTex, tex()

### Community 218 - "atril"
Cohesion: 0.67
Nodes (3): atril(), caja(), std()

## Ambiguous Edges - Review These
- `U-Windows-App (cliente C# / U.exe)` → `windows-app sin remoto GitHub (límite del análisis)`  [AMBIGUOUS]
  MIRACLE_NOTES_GRAPH_OPERATIONS_PLANNING.md · relation: conceptually_related_to
- `lib/api/clinical.ts — cliente HTTP clínico único` → `app/api/generate-note/route.ts — generación de nota`  [AMBIGUOUS]
  MIRACLE_OPERATIONS_INTEGRATION_ANALYSIS.md · relation: conceptually_related_to
- `DIAGNOSTICO.pdf (archivo vacío)` → `Las 7 prioridades reales de la auditoría`  [AMBIGUOUS]
  DIAGNOSTICO.pdf · relation: semantically_similar_to
- `Capas: navegador → useStore → Supabase / Anthropic` → `D13 · lib/dates.ts fija America/Bogota`  [AMBIGUOUS]
  docs/decisiones.md · relation: conceptually_related_to
- `PRD v0 · Miracle como plataforma de inteligencia clínica-operativa` → `Placeholder gris azulado "Foto: el antes" — médico frente a la pantalla`  [AMBIGUOUS]
  public/images/consulta-antes.jpg · relation: references

## Knowledge Gaps
- **649 isolated node(s):** `supabase`, `metadata`, `metadata`, `metadata`, `metadata` (+644 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `U-Windows-App (cliente C# / U.exe)` and `windows-app sin remoto GitHub (límite del análisis)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `lib/api/clinical.ts — cliente HTTP clínico único` and `app/api/generate-note/route.ts — generación de nota`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `DIAGNOSTICO.pdf (archivo vacío)` and `Las 7 prioridades reales de la auditoría`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `Capas: navegador → useStore → Supabase / Anthropic` and `D13 · lib/dates.ts fija America/Bogota`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `PRD v0 · Miracle como plataforma de inteligencia clínica-operativa` and `Placeholder gris azulado "Foto: el antes" — médico frente a la pantalla`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `createClient()` connect `createClient` to `login/actions.ts`, `dashboard/page.tsx`, `note-review.ts`, `reportError`, `actividad/page.tsx`, `org.ts`, `supabase/server.ts`, `onboarding/actions.ts`, `mantenimiento/page.tsx`, `rango.ts`, `ReportesView.tsx`, `superadmin/layout.tsx`, `getCurrentProfile`, `formatFechaRelativa`, `auth/server.ts`, `salud/page.tsx`, `superadmin/page.tsx`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `createClient()` connect `TemplateCatalog.tsx` to `login/actions.ts`, `dashboard/page.tsx`, `note-review.ts`, `SnippetImportDialog.tsx`, `reportError`, `snippets.ts`, `en-vivo/page.tsx`, `clinical.ts`, `ReportesView.tsx`, `providers.tsx`, `LaboratorioWorkspace.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._