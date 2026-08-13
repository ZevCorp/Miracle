# Graph Report - Pagina-web-clientes-final  (2026-08-12)

## Corpus Check
- 355 files · ~361,116 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2017 nodes · 4082 edges · 192 communities (147 shown, 45 thin omitted)
- Extraction: 98% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4f22adf5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- site.ts
- login/actions.ts
- note-review.ts
- TemplateBuilderPanel.tsx
- Voice Dictation & STT
- reportError
- devDependencies
- consultas/[id]/page.tsx
- types.ts
- dashboard/page.tsx
- (marketing)/page.tsx
- en-vivo/page.tsx
- AppShell.tsx
- actividad/page.tsx
- redact.ts
- TypeScript Build Config
- TemplateCatalog.tsx
- clinical.ts
- auditoria/page.tsx
- AgendaHoy.tsx
- contacto/page.tsx
- Loading Skeleton States
- metrics.ts
- precios/page.tsx
- superadmin/actions.ts
- salud/page.tsx
- note-export.test.ts
- formatFechaRelativa
- app/app/providers.tsx — store de contexto en el cliente
- Discharge Plan Editor Panel
- rango.ts
- Graphify Setup Guide
- reportes/export/route.ts
- app/consultas/page.tsx
- Modelo ClinicalEncounter (template_snapshot congelado)
- superadmin/page.tsx
- consultation-text.ts
- Alternativa A — cola en Postgres + long-poll con claim/lease
- mock/index.ts
- autenticacion-interna-plan.md — enrolamiento per-install (planificado)
- tabla clinical_encounters (Graph)
- app/api/generate-note/route.ts — generación de nota
- RPC claim_next_job — FOR UPDATE SKIP LOCKED + lease
- 20260621041058_auth_profiles_and_roles.sql
- Note Export Job Design
- MedicalChat.tsx
- Superadmin Activity Schema
- public.hospital_dashboard
- Web App Architecture Overview
- Product Strategy & Compliance
- Clinical HTTP API Client
- Multi-tenant Data Model & Audit
- Platform Diagnostics & Store
- auth/server.ts
- Multi-tenant Organizations Migration
- Superadmin Activity Feed
- Superadmin Destructive Operations
- Clinical API Integration Architecture
- Header.tsx
- Las 7 prioridades reales de la auditoría
- Frontend Stack, Auth and CI
- dev-session.mjs
- Windows Agent Operations API
- Auth Roles and Access Control
- Tablas public: organizations, profiles, patients, consultations, audit_events, clinical_templates
- mantenimiento/page.tsx
- Consultation Immutability and Addenda
- Dark Theme Contrast Tests
- 20260625204215_add_custom_clinical_templates.sql
- Clinical AI Endpoints
- Agent Links Schema
- tabla consultations (Notes)
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
- Supabase (Postgres + GoTrue + PostgREST + RLS)
- encounter-to-consultation.ts
- validate-template-migrations.mjs
- providers.tsx
- createClient
- ClinicalNoteJson (note_json: sections, discharge, warnings)
- 20260808140000_protect_org_owner.sql
- organizaciones/[id]/page.tsx
- DailyTrend.tsx
- motion
- dependencies
- app/layout.tsx
- nueva/page.tsx
- signature-hash.test.ts
- Endpoints de plantillas (GET/POST/PUT/DELETE /templates)
- 20260808150000_reconciliar_owner_al_mover.sql
- Grabación existente: STT session + consultation_type audio_upload
- public.organizations
- 20260811100000_billing_accounts.sql
- Billing — B2C (Stripe) y B2B (institucional)
- 20260811130000_org_memberships.sql
- scripts
- 20260811120000_personal_org_medico.sql
- package.json
- public.user_template_preferences
- @types/react-dom

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 79 edges
2. `getCurrentProfile()` - 40 edges
3. `formatFechaRelativa()` - 40 edges
4. `reportError()` - 30 edges
5. `useStore()` - 27 edges
6. `ConsultaActivaInner()` - 21 edges
7. `Card()` - 21 edges
8. `createClient()` - 21 edges
9. `resolverRango()` - 20 edges
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

## Communities (192 total, 45 thin omitted)

### Community 0 - "site.ts"
Cohesion: 0.13
Nodes (19): signOut(), icons, BeforeInstallPromptEvent, InstallAppButton(), icons, isActive(), MobileBottomNavigation(), primaryHrefs (+11 more)

### Community 1 - "login/actions.ts"
Cohesion: 0.11
Nodes (19): appUrl(), configured(), loginErrorUrl(), requestPasswordReset(), safeNext(), signInWithGoogle(), signInWithPassword(), messages (+11 more)

### Community 2 - "note-review.ts"
Cohesion: 0.06
Nodes (50): AgentPairPanel(), CONCEPT_LABEL, COVERAGE_STYLE, EncounterAuditPanel(), fecha(), EditableBlock(), EncounterNote(), NoteReviewPanel() (+42 more)

### Community 3 - "TemplateBuilderPanel.tsx"
Cohesion: 0.06
Nodes (53): TemplateRow(), completeClinicalOnboarding(), OnboardingState, ClinicalOnboardingForm(), initialState, COMMON_SECTIONS, MODE_SUBTITLE, MODE_TITLE (+45 more)

### Community 4 - "Voice Dictation & STT"
Cohesion: 0.06
Nodes (33): DictationPanel(), mmss(), STATUS_TEXT, BARS, Waveform(), MiracleDeepgramDictation, createDictation, DictationHandle (+25 more)

### Community 5 - "reportError"
Cohesion: 0.06
Nodes (68): GET(), runtime, POST(), runtime, subscriptionIdFrom(), alignSections(), FilledSection, maxDuration (+60 more)

### Community 6 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+9 more)

### Community 7 - "consultas/[id]/page.tsx"
Cohesion: 0.11
Nodes (10): COMBINING_MARKS_RE, CodeSuggestion(), NoteSectionView(), TabItem, Tabs(), CatalogCode, CODE_CATALOG, searchCodes() (+2 more)

### Community 8 - "types.ts"
Cohesion: 0.10
Nodes (19): CardConsultation, ConsultationCard(), rotuloDe(), StatusBadge(), AppRole, DEMO_MOTIVO, statusTone(), doctors (+11 more)

### Community 9 - "dashboard/page.tsx"
Cohesion: 0.11
Nodes (13): MedicoView(), recentPatients(), SupervisorView(), BarList(), Donut(), FeatureCard(), MetricCard(), Alerta (+5 more)

### Community 10 - "(marketing)/page.tsx"
Cohesion: 0.10
Nodes (15): Figure(), FigureProps, Impact, ImpactStats(), items, phases, PilotoTeaser(), StepFlow() (+7 more)

### Community 11 - "en-vivo/page.tsx"
Cohesion: 0.08
Nodes (24): ConsultaActivaInner(), FlowPhase, PHASE_LABEL, ReviewView, STATUS_LABEL, TYPE_LABEL, useTranscriptAutosave(), PatientHeader() (+16 more)

### Community 12 - "AppShell.tsx"
Cohesion: 0.20
Nodes (14): DashboardPage(), useStore(), AppShell(), initials(), AppSidebar(), CommandPalette(), Item, NotificationsBell() (+6 more)

### Community 13 - "actividad/page.tsx"
Cohesion: 0.28
Nodes (15): CABECERAS, dynamic, GET(), Params, SuperadminActividadPage(), cargarOpciones(), ClienteServidor, construirConsulta() (+7 more)

### Community 14 - "redact.ts"
Cohesion: 0.11
Nodes (20): ACCENT_CLASSES, buildDocumentoRegex(), buildNombreRegex(), buildRedactor(), COLLAPSE_PACIENTE, escapeRegExp(), EXCLUDED_NOTE_KEYS, NAME_PARTICLES (+12 more)

### Community 15 - "TypeScript Build Config"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 16 - "TemplateCatalog.tsx"
Cohesion: 0.14
Nodes (16): BuilderState, CreationMode, ExampleDialog(), ScopeFilter, TemplatePreview(), ClinicalTemplatePicker(), NO_PINS, BuilderMode (+8 more)

### Community 17 - "clinical.ts"
Cohesion: 0.07
Nodes (30): apiBaseUrl(), AssistantChatMessage, AssistantChatPayload, AssistantChatResult, AssistantScreenContext, BackendConsultationType, buildClinicalRequest(), clinicalRequest() (+22 more)

### Community 18 - "auditoria/page.tsx"
Cohesion: 0.14
Nodes (23): AuditoriaPage(), EventoRow, nombreDe(), RevisarRow, Stats, AuditFindingList(), AuditSeverityBadge(), SEVERITY_STYLE (+15 more)

### Community 19 - "AgendaHoy.tsx"
Cohesion: 0.29
Nodes (12): AgendaHoy(), FilaRevision, ImportarFotoModal(), sortCitas(), ClinicalSectionHeader(), Appointment, appointmentImportFingerprint(), AppointmentStatus (+4 more)

### Community 20 - "contacto/page.tsx"
Cohesion: 0.13
Nodes (11): metadata, metadata, metadata, metadata, resources, metadata, PageHero(), SecurityBadge() (+3 more)

### Community 21 - "Loading Skeleton States"
Cohesion: 0.18
Nodes (5): SkeletonCard(), SkeletonChips(), SkeletonTable(), SkeletonTileRow(), SkeletonTitulo()

### Community 22 - "metrics.ts"
Cohesion: 0.33
Nodes (5): adoptionByService, managementKpis, qualityByService, timeBeforeAfter, weeklyNotes

### Community 23 - "precios/page.tsx"
Cohesion: 0.11
Nodes (23): annotations, DemoPage(), metadata, measures, metadata, phases, PilotoPage(), faqItems (+15 more)

### Community 24 - "superadmin/actions.ts"
Cohesion: 0.17
Nodes (26): AccionCritica, archiveOrganization(), assignUserToOrg(), back(), baseOrg(), changeOrgMemberRole(), createDoctorAccount(), createOrganization() (+18 more)

### Community 25 - "salud/page.tsx"
Cohesion: 0.17
Nodes (15): DashboardSalud, ESTADO_WEB_LABEL, EXPORT_STATUS_LABEL, SuperadminSaludPage(), DeviceRow, ActivityUser, ENCOUNTER_PIPELINE_ORDER, ENCOUNTER_STATUS_LABEL (+7 more)

### Community 26 - "note-export.test.ts"
Cohesion: 0.15
Nodes (18): BADGE_TONE, NoteExportButton(), NoteExportStatus(), cancelNoteExport(), ClinicalApiError, createNoteExport(), getNoteExport(), isNoteExportRetryable() (+10 more)

### Community 27 - "formatFechaRelativa"
Cohesion: 0.21
Nodes (16): PacienteDetallePage(), Encabezado(), SuperadminResumenPage(), Timeline(), DeviceTable(), claveDiaZona(), esDeHoy(), formatFechaHora() (+8 more)

### Community 28 - "app/app/providers.tsx — store de contexto en el cliente"
Cohesion: 0.21
Nodes (12): lib/auth/roles.ts — política de autorización pura, lib/auth/server.ts, Evaluación Clean Architecture (14/28, 50 %), app/app/consultas/en-vivo/page.tsx — consulta en vivo (simulada), getCurrentProfile / requireRole, lib/mock/types.ts — Consultation, Patient, ClinicalCode, app/app/providers.tsx — store de contexto en el cliente, rowToConsultation / rowToPatient — mappers DTO (+4 more)

### Community 29 - "Discharge Plan Editor Panel"
Cohesion: 0.12
Nodes (11): ListKind, medicationLine(), PlanDischargePanel(), SpeechRecognitionConstructor, SpeechRecognitionEventLike, SpeechRecognitionLike, SpeechRecognitionResultLike, ClinicalAlarmSign (+3 more)

### Community 30 - "rango.ts"
Cohesion: 0.23
Nodes (15): ETIQUETA_CORTA, RangePicker(), claveDeMs(), ClavePreset, ClaveRango, construir(), ddmmaaaa(), diasEntre() (+7 more)

### Community 31 - "Graphify Setup Guide"
Cohesion: 0.11
Nodes (18): 1. Instalar uv, 2. Instalar graphify, 3. Registrar la skill y los hooks, 4. Traer el grafo, Actualizar el grafo a mano, Camino entre dos partes del sistema, Comandos útiles, Encontrar los archivos más conectados (los críticos) (+10 more)

### Community 32 - "reportes/export/route.ts"
Cohesion: 0.23
Nodes (13): CABECERAS, dynamic, GET(), ETIQUETA_ADOPCION, cabecerasCsv(), celda(), neutralizarFormula(), nombreArchivoCsv() (+5 more)

### Community 33 - "app/consultas/page.tsx"
Cohesion: 0.05
Nodes (49): back(), texto(), updateOrgSettings(), ConfiguracionForm(), ConfiguracionPage(), metadata, ConsultasFilters(), DoctorOption (+41 more)

### Community 34 - "Modelo ClinicalEncounter (template_snapshot congelado)"
Cohesion: 0.36
Nodes (8): Cierre clínico universal: discharge, plan, alarm_signs, private_notes, Modelo ClinicalEncounter (template_snapshot congelado), Modelo ClinicalTemplate (secciones normalizadas), Contrato API Clínica /api/clinical/* (copia local del backend Graph), POST /encounters/:id/generate-note (LLM, rate limit reforzado), Envelope de errores y tabla de códigos (TEMPLATE_NOT_FOUND, LLM_NOT_CONFIGURED…), Modelo NoteJson (secciones exactas del snapshot + confidence), Suite verify-clinical-workflow.js (Supabase y LLM fake)

### Community 35 - "superadmin/page.tsx"
Cohesion: 0.14
Nodes (15): Dashboard, Kpi, nf, AutoRefresh(), fijarPreferencia(), leerEnServidor(), leerPreferencia(), oyentes (+7 more)

### Community 36 - "consultation-text.ts"
Cohesion: 0.20
Nodes (14): Bloque, bloquesDeConsulta(), buildConsultationHtml(), buildConsultationPlainText(), ConsultationTextAddendum, ConsultationTextInput, ConsultationTextPatient, escHtml() (+6 more)

### Community 37 - "Alternativa A — cola en Postgres + long-poll con claim/lease"
Cohesion: 0.25
Nodes (9): Alternativa A — cola en Postgres + long-poll con claim/lease, Alternativa C — híbrida: cola + push + Realtime para ver, Fase 6 — tiempo real (Alternativa C), app/api/clinical/note-from-photo/route.ts — degradación {connected:false}, Recomendación principal — construir A con Fase 1 como prerrequisito, registerWindowsPanelRoutes.js — SSE con STREAM_MAX_MS=50000, SupabaseRestClient — PostgREST con service-role, vercel.json maxDuration 60 s — techo del long-poll y del SSE (+1 more)

### Community 38 - "mock/index.ts"
Cohesion: 0.15
Nodes (14): AuditoriaTab(), CodificacionTab(), ConsultaDetallePage(), consultations, MOCK_TODAY, acceptedCodes(), completitud(), formatFechaRelativa() (+6 more)

### Community 39 - "autenticacion-interna-plan.md — enrolamiento per-install (planificado)"
Cohesion: 0.06
Nodes (37): AgentTurnService.handleTurn — turno stateless, costura sagrada, Alternativa B — tiempo real puro (Realtime / WebSocket), assembleTools — catálogo MCP por superficie, autenticacion-interna-plan.md — enrolamiento per-install (planificado), ConfiguracionForm — slot vacío HIS/HCE, CONTEXTO.md — describe mal a Graph ('repo viejo/aparte'), distribucion-app-conectada.md — key embebida compartida y descompilable, engineForEvent (+29 more)

### Community 40 - "tabla clinical_encounters (Graph)"
Cohesion: 0.32
Nodes (8): buildTemplateSnapshot — congela la plantilla con snapshot_at, ClinicalEncounterService, tabla clinical_encounters (Graph), ClinicalNoteValidationService.validateEditedNote, §7.2 — clinical_encounters no tiene organization_id, §7.3 — patient_id inconsistente entre las dos tablas, saveEditedNote → status 'completed' (Momento A), template_snapshot — copia congelada de la plantilla

### Community 41 - "app/api/generate-note/route.ts — generación de nota"
Cohesion: 0.29
Nodes (8): Anthropic Messages API, app/api/chat/route.ts — proxy de chat clínico, app/api/generate-note/route.ts — generación de nota, lib/observability.ts — reportError (Sentry inerte), proxy.ts — middleware de autenticación (Next.js modificado), R1 — endpoints de IA sin autenticación, R8 — PHI transportada al LLM de terceros, Despliegue en Vercel (serverless + edge + CDN)

### Community 42 - "RPC claim_next_job — FOR UPDATE SKIP LOCKED + lease"
Cohesion: 0.28
Nodes (9): RPC claim_next_job — FOR UPDATE SKIP LOCKED + lease, RPC expire_stale_leases — barrido perezoso, Fase 2 — la cola y el camino feliz (MVP), graph_prompts (Android) — molde de estados running/ok/error/cancelled, idempotency_key = sha256(consultation_id + firma.hash + attempt_group), lease_expires_at + attempts — recuperación tras caída, miracle-his-simulator — banco de pruebas end-to-end, operations_jobs — la cola (propuesta) (+1 more)

### Community 43 - "20260621041058_auth_profiles_and_roles.sql"
Cohesion: 0.18
Nodes (10): private.handle_new_user, private.set_profile_updated_at, on_auth_user_created, on_profile_role_change, on_profile_updated, private.current_app_role(), private.prevent_last_admin_removal(), public.profiles (+2 more)

### Community 44 - "Note Export Job Design"
Cohesion: 0.20
Nodes (12): Rate-limit 120/min por IP y riesgo NAT hospitalario, Patrón SSE 50 s + bye (registerWindowsPanelRoutes), Alternativa A — Trabajo persistente + pull (elegida), Alternativa C — Sin tabla nueva (descartada), Command bridge (N3, pospuesto), RPC graph_claim_next_note_export, graph_note_exports — tabla de trabajos (nueva), Idempotencia por UNIQUE(consultation_id) (+4 more)

### Community 45 - "MedicalChat.tsx"
Cohesion: 0.15
Nodes (10): Failure, MedicalChat(), Msg, RETRYABLE_CODES, SUGERENCIAS, adjustNoteWithAssistant(), CLINICAL_ERROR_MESSAGES, sendAssistantChat() (+2 more)

### Community 46 - "Superadmin Activity Schema"
Cohesion: 0.17
Nodes (11): public.graph_note_exports, public.superadmin_activity(), auth.users, public.audit_events, public.clinical_encounters, public.consultations, public.organizations, public.profiles (+3 more)

### Community 47 - "public.hospital_dashboard"
Cohesion: 0.12
Nodes (15): actual, kpis, por_estado, por_medico, por_servicio, por_tipo, previo, rango (+7 more)

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

### Community 53 - "auth/server.ts"
Cohesion: 0.08
Nodes (31): AuditoriaLayout(), ConfiguracionLayout(), NuevaConsultaLayout(), initials(), metadata, SuperadminLayout(), BillingBanner(), fechaCorta() (+23 more)

### Community 54 - "Multi-tenant Organizations Migration"
Cohesion: 0.36
Nodes (8): private.current_app_role(), private.current_org(), public.audit_events, public.consultations, public.organizations, public.patients, auth.users, public.profiles

### Community 55 - "Superadmin Activity Feed"
Cohesion: 0.20
Nodes (9): public.superadmin_activity(), auth.users, public.audit_events, public.clinical_encounters, public.consultations, public.profiles, usuarios, usuarios_calc (+1 more)

### Community 57 - "Clinical API Integration Architecture"
Cohesion: 0.25
Nodes (9): Graph = una función serverless (maxDuration 60 s), Análisis técnico de integración (previo), No existe cola de trabajos en ningún repo, u-windows-backend muerto (deployment ERROR), exportNote() — embudo de exportación, lib/api/clinical.ts — cliente clínico único, registerClinicalRoutes.js (carril /api/clinical), requireAccountAuth (Provider Studio) (+1 more)

### Community 58 - "Header.tsx"
Cohesion: 0.14
Nodes (12): metadata, BrandMark(), BrandMarkProps, Logo(), LogoProps, Footer(), legalNav, Header() (+4 more)

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

### Community 65 - "mantenimiento/page.tsx"
Cohesion: 0.12
Nodes (15): ConsultaRow, ESTADOS, OneOrMany, SuperadminConsultasPage(), uno(), OrgFila, UsuarioFila, DashboardOrgs (+7 more)

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

### Community 71 - "tabla consultations (Notes)"
Cohesion: 0.22
Nodes (10): audit_events — canal de auditoría append-only, tabla consultations (Notes), deriveMotivo, encounterToConsultation — puente 1:1 por mismo id, private.enforce_consultation_immutability (trigger), POST /api/v1/operations/jobs/:id/result (terminal, con ack), Máquina de estados del trabajo (pending…needs_doctor), RPC marcar_exportada(consultation_id, job_id) (+2 more)

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

### Community 150 - "Supabase (Postgres + GoTrue + PostgREST + RLS)"
Cohesion: 0.29
Nodes (7): app/auth/callback/route.ts — exchangeCodeForSession + safeNext, canAccessPath, RPC create_org_member (SECURITY DEFINER), trigger handle_new_user — provisión de org personal, R2 — deriva migraciones ↔ base viva (private.is_admin), Supabase (Postgres + GoTrue + PostgREST + RLS), lib/supabase/proxy.ts — updateSession

### Community 151 - "encounter-to-consultation.ts"
Cohesion: 0.32
Nodes (12): NewPatientInput, ClinicalEncounter, ClinicalNoteJson, deriveMotivo(), encounterToConsultation(), EncounterToConsultationInput, noteJsonToSections(), specialtyDisplayName() (+4 more)

### Community 152 - "validate-template-migrations.mjs"
Cohesion: 0.11
Nodes (14): errors, expectedInserts, factoryIdToSpecialty, files, inventory, INVENTORY_PATH, MIGRATIONS_DIR, missingInserts (+6 more)

### Community 153 - "providers.tsx"
Cohesion: 0.16
Nodes (15): AppLayout(), metadata, ConsultationAddendum, MiracleProvider(), rowToConsultation(), rowToPatient(), StoreContext, StoreValue (+7 more)

### Community 154 - "createClient"
Cohesion: 0.16
Nodes (17): signConsultationNote(), SignNoteResult, LaboratorioPage(), PlantillasPage(), back(), updateUserRole(), ProfileRow, roleTone (+9 more)

### Community 155 - "ClinicalNoteJson (note_json: sections, discharge, warnings)"
Cohesion: 0.29
Nodes (7): POST /api/v1/autofill/match, POST /api/v1/operations/jobs/claim (long-poll ~40 s), ClinicalNoteJson (note_json: sections, discharge, warnings), ensureClinicalDischarge — normalización de discharge, Fase 3 — escritura real en SAP/HIS y fallos parciales, NoteFieldMatcher — nota → campos, umbral 0.75, NoteFieldMatchingPolicy — prompt del matcher

### Community 156 - "20260808140000_protect_org_owner.sql"
Cohesion: 0.13
Nodes (11): private.protect_org_owner, private.protect_org_owner_column, prevent_last_admin_removal, private.sync_org_owner(), protect_org_owner, protect_org_owner_column, private.prevent_last_admin_removal, private.sync_org_owner (+3 more)

### Community 157 - "organizaciones/[id]/page.tsx"
Cohesion: 0.16
Nodes (20): SuperadminAnaliticaPage(), ConsultaRow, DashboardOrg, SuperadminOrganizacionDetallePage(), OrgRow, SuperadminUsuariosPage(), BarItem, BarList() (+12 more)

### Community 160 - "DailyTrend.tsx"
Cohesion: 0.60
Nodes (4): DailyTrend(), formatDia(), niceTicks(), PAD

### Community 164 - "dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, next, dependencies, lucide-react, next, react, react-dom, @sentry/nextjs (+9 more)

### Community 165 - "app/layout.tsx"
Cohesion: 0.29
Nodes (5): display, metadata, mono, sans, viewport

### Community 170 - "nueva/page.tsx"
Cohesion: 0.18
Nodes (19): modalities, NuevaConsultaForm(), TemplateCatalog(), lastTemplateKey(), readLastTemplateId(), rememberTemplateId(), ClinicalTemplate, createClinicalEncounter() (+11 more)

### Community 172 - "signature-hash.test.ts"
Cohesion: 0.50
Nodes (6): canonicalSignaturePayload(), computeSignatureHash(), signatureHashMatches(), SignedConsultationContent, cases, VectorCase

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

### Community 181 - "Billing — B2C (Stripe) y B2B (institucional)"
Cohesion: 0.11
Nodes (17): Billing — B2C (Stripe) y B2B (institucional), Bloque 1 · En Stripe (navegador, ~10 min), Bloque 2 · En Supabase (2 min), Bloque 3 · En tu computador, para probar (~15 min), Bloque 4 · En producción (Vercel), Ciclo de vida B2C, El precio, Flujo Stripe (+9 more)

### Community 182 - "20260811130000_org_memberships.sql"
Cohesion: 0.20
Nodes (8): private.prevent_foreign_org_change, on_org_memberships_updated, prevent_foreign_org_change, public.org_memberships, public.switch_active_organization(), private.set_updated_at, public.organizations, public.profiles

### Community 186 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, start, test, test:watch, typecheck

### Community 189 - "20260811120000_personal_org_medico.sql"
Cohesion: 0.29
Nodes (4): private.prevent_last_admin_removal(), private.protect_org_owner(), public.organizations, public.profiles

### Community 192 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 193 - "public.user_template_preferences"
Cohesion: 0.50
Nodes (3): public.clinical_templates, public.user_template_preferences, auth.users

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
- **470 isolated node(s):** `La idea en una frase`, `Modos de cuenta`, `Ciclo de vida B2C`, `Flujo Stripe`, `Bloque 1 · En Stripe (navegador, ~10 min)` (+465 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **45 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

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
- **Why does `createClient()` connect `createClient` to `reportes/export/route.ts`, `app/consultas/page.tsx`, `login/actions.ts`, `site.ts`, `TemplateBuilderPanel.tsx`, `reportError`, `mantenimiento/page.tsx`, `superadmin/page.tsx`, `actividad/page.tsx`, `auditoria/page.tsx`, `ReportesView.tsx`, `auth/server.ts`, `superadmin/actions.ts`, `salud/page.tsx`, `formatFechaRelativa`, `organizaciones/[id]/page.tsx`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `base()` connect `consultation-text.ts` to `public.hospital_dashboard`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._