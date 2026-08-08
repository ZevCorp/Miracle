# Graph Report - Pagina-web-clientes-final  (2026-08-08)

## Corpus Check
- 316 files · ~247,174 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1771 nodes · 3496 edges · 165 communities (121 shown, 44 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 59 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a7917cd6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- export/route.ts
- AppShell.tsx
- vital-concepts.ts
- TemplateBuilderPanel.tsx
- useDictation.ts
- note-from-photo/route.ts
- Project Dependencies
- consultas/[id]/page.tsx
- types.ts
- superadmin/page.tsx
- (marketing)/page.tsx
- en-vivo/page.tsx
- providers.tsx
- versiones.ts
- PHI Redaction Utilities
- TypeScript Config
- nueva/page.tsx
- clinical.ts
- auditoria/page.tsx
- actividad/page.tsx
- CTA.tsx
- Loading Skeletons
- supabase/server.ts
- piloto/page.tsx
- createClient
- salud/page.tsx
- note-export.test.ts
- formatFechaRelativa
- Supabase (Postgres + GoTrue + PostgREST + RLS)
- Plan & Discharge Editor
- dashboard/page.tsx
- Graphify en el equipo
- site.ts
- LaboratorioWorkspace.tsx
- Clinical Encounter Data Model
- como-funciona/page.tsx
- consultation-text.ts
- Alternativa A — cola en Postgres + long-poll con claim/lease
- mock/index.ts
- Windows Device Enrollment
- tabla clinical_encounters (Graph)
- AI Proxy Routes & Observability
- RPC claim_next_job — FOR UPDATE SKIP LOCKED + lease
- Auth Profiles & Roles Migration
- Note Export Queue Design
- AgendaHoy.tsx
- Superadmin Activity Migration
- public.hospital_dashboard
- Web Architecture Overview
- Product Strategy & Compliance
- Clinical HTTP Client
- Audit Trail & Data Model
- Platform Diagnosis Findings
- Workflow Agent & MCP Plans
- Multi-Tenant Organizations Migration
- Superadmin Activity RPC
- Superadmin Destructive Ops RPC
- Integration Analysis & Export Funnel
- Header.tsx
- Audit Priorities & Legal Gaps
- Stack, CI & Environment Config
- Dev Session Script
- Windows Operations Client
- Auth Gating & Role Security
- Multi-Tenant Schema & RLS
- Windows Automation Surfaces
- Consultation Immutability & Addenda
- Dark Theme Contrast Tests
- Clinical Templates Migration
- AI Endpoints & Code Catalog
- Agent Links Migration
- Metrics Aggregation
- Superadmin Overview RPC
- Superadmin Nav Counts RPC
- Pathology Templates & Deploy Trap
- Sentry Instrumentation
- Dynamic Value Matching
- Brand Image Placeholders
- Superadmin & Membership Migration
- Create Org Member RPC
- Appointments Agenda Migration
- Consultation Audit Stats
- Data Retention & Deletion Policy
- Demo Flag Escalation Guard
- Role Escalation Guard
- Consultation Rotulo Sync
- Agent Link Per Doctor
- Agent Link Empty Push Guard
- CI Pipeline & Completeness Rule
- Steps Component
- API Rate Limiting & Guards
- Secretary Export Access
- Custom Access Token Hook
- Pagination Aggregates
- Consultation Status Counts
- Rate Limits Migration
- Secretary Role Migration
- Agent Rules & CLAUDE.md
- Architecture & README Docs
- Google OAuth Login
- ESLint Configuration
- Client Instrumentation Setup
- MCP Server Config
- Next.js Configuration
- Deep Link Tool Catalog
- PostCSS Configuration
- CIE-10 / CUPS Code Catalog
- Browser Speech Dictation
- Command Palette
- Review Notifications Bell
- Status Badge Component
- API Auth and Rate Limiting
- Appointments Table
- User Profiles Table
- User Profiles Table
- Organizations Table
- User Profiles Table
- User Profiles Table
- Consultations Table
- User Profiles Table
- Consultations Table
- User Profiles Table
- User Profiles Table
- Organizations Table
- User Profiles Table
- dashboard.ts
- EncounterNote.tsx
- encounter-to-consultation.ts
- clinical-api.test.ts
- note-review.ts
- EncounterAuditPanel.tsx
- transcribe-audio-file.ts
- note-review.test.ts
- app/consultas/page.tsx
- ConfiguracionForm.tsx
- TrendChart.tsx
- DailyTrend.tsx
- codes.ts
- public.profiles

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 70 edges
2. `formatFechaRelativa()` - 38 edges
3. `getCurrentProfile()` - 32 edges
4. `useStore()` - 32 edges
5. `Card()` - 21 edges
6. `reportError()` - 21 edges
7. `ConsultaActivaInner()` - 20 edges
8. `requireRole()` - 19 edges
9. `Badge()` - 17 edges
10. `clinicalRequest()` - 17 edges

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

## Communities (165 total, 44 thin omitted)

### Community 0 - "export/route.ts"
Cohesion: 0.10
Nodes (39): CABECERAS, dynamic, GET(), SuperadminActividadPage(), SuperadminResumenPage(), ETIQUETA_CORTA, cargarOpciones(), ClienteServidor (+31 more)

### Community 1 - "AppShell.tsx"
Cohesion: 0.06
Nodes (47): AppLayout(), metadata, appUrl(), configured(), loginErrorUrl(), requestPasswordReset(), safeNext(), signInWithGoogle() (+39 more)

### Community 2 - "vital-concepts.ts"
Cohesion: 0.20
Nodes (14): AgentPairPanel(), around(), BLOOD_PRESSURE, ConceptKey, ConceptMap, conceptsRevision(), ConceptValue, extractConcepts() (+6 more)

### Community 3 - "TemplateBuilderPanel.tsx"
Cohesion: 0.05
Nodes (61): BuilderState, CreationMode, ScopeFilter, TemplatePreview(), TemplateRow(), completeClinicalOnboarding(), OnboardingState, ClinicalOnboardingForm() (+53 more)

### Community 4 - "useDictation.ts"
Cohesion: 0.07
Nodes (26): DictationPanel(), mmss(), STATUS_TEXT, BARS, Waveform(), MiracleDeepgramDictation, createDictation, DictationHandle (+18 more)

### Community 5 - "note-from-photo/route.ts"
Cohesion: 0.06
Nodes (48): GET(), runtime, alignSections(), FilledSection, maxDuration, MEDIA_TYPES, parseTemplateSections(), POST() (+40 more)

### Community 6 - "Project Dependencies"
Cohesion: 0.04
Nodes (47): eslint, eslint-config-next, lucide-react, motion, next, dependencies, lucide-react, motion (+39 more)

### Community 7 - "consultas/[id]/page.tsx"
Cohesion: 0.11
Nodes (9): COMBINING_MARKS_RE, CodeSuggestion(), BADGE_TONE, NoteExportButton(), NoteExportStatus(), NoteSectionView(), TabItem, Tabs() (+1 more)

### Community 8 - "types.ts"
Cohesion: 0.12
Nodes (13): Timeline(), DEMO_AUDIT_ACCION, DEMO_MOTIVO, doctors, ESPECIALIDADES, patients, AuditEvent, CodeSystem (+5 more)

### Community 9 - "superadmin/page.tsx"
Cohesion: 0.16
Nodes (10): DashboardOrgs, OrganizacionesPage(), Dashboard, Kpi, nf, Sparkline(), StatTile(), Badge() (+2 more)

### Community 10 - "(marketing)/page.tsx"
Cohesion: 0.10
Nodes (17): BrandSphere(), FAQ(), FAQItem, Figure(), FigureProps, Impact, ImpactStats(), items (+9 more)

### Community 11 - "en-vivo/page.tsx"
Cohesion: 0.08
Nodes (17): FlowPhase, PHASE_LABEL, ReviewView, STATUS_LABEL, TYPE_LABEL, Failure, MedicalChat(), Msg (+9 more)

### Community 12 - "providers.tsx"
Cohesion: 0.15
Nodes (15): ConsultationAddendum, MiracleProvider(), NewPatientInput, rowToConsultation(), rowToPatient(), StoreContext, StoreValue, Toast (+7 more)

### Community 13 - "versiones.ts"
Cohesion: 0.44
Nodes (7): SuperadminSaludPage(), estaDesactualizada(), ESTADO_DISPOSITIVO, estadoDispositivo, partes(), versionEsAnterior(), versionMasReciente()

### Community 14 - "PHI Redaction Utilities"
Cohesion: 0.11
Nodes (20): ACCENT_CLASSES, buildDocumentoRegex(), buildNombreRegex(), buildRedactor(), COLLAPSE_PACIENTE, escapeRegExp(), EXCLUDED_NOTE_KEYS, NAME_PARTICLES (+12 more)

### Community 15 - "TypeScript Config"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 16 - "nueva/page.tsx"
Cohesion: 0.19
Nodes (16): modalities, NuevaConsultaForm(), TemplateCatalog(), ClinicalTemplatePicker(), lastTemplateKey(), readLastTemplateId(), rememberTemplateId(), ClinicalTemplate (+8 more)

### Community 17 - "clinical.ts"
Cohesion: 0.08
Nodes (25): AssistantChatMessage, AssistantChatPayload, AssistantChatResult, AssistantScreenContext, BackendConsultationType, ClinicalRequestOptions, CreateClinicalEncounterPayload, CreateEncounterResult (+17 more)

### Community 18 - "auditoria/page.tsx"
Cohesion: 0.15
Nodes (22): AuditoriaPage(), EventoRow, nombreDe(), RevisarRow, Stats, AuditFindingList(), AuditSeverityBadge(), SEVERITY_STYLE (+14 more)

### Community 19 - "actividad/page.tsx"
Cohesion: 0.11
Nodes (23): ESTADOS, NotasPage(), patientName(), Row, PacienteDetallePage(), Params, ConsultaRow, ESTADOS (+15 more)

### Community 20 - "CTA.tsx"
Cohesion: 0.15
Nodes (13): metadata, metadata, resources, metadata, CTAProps, CTASection(), FeatureCard(), PageHero() (+5 more)

### Community 21 - "Loading Skeletons"
Cohesion: 0.18
Nodes (5): SkeletonCard(), SkeletonChips(), SkeletonTable(), SkeletonTileRow(), SkeletonTitulo()

### Community 22 - "supabase/server.ts"
Cohesion: 0.10
Nodes (26): AuditoriaLayout(), ConfiguracionLayout(), ConfiguracionPage(), OrgRow, NuevaConsultaLayout(), metadata, ReportesPage(), ADMIN_ASSIGNABLE (+18 more)

### Community 23 - "piloto/page.tsx"
Cohesion: 0.11
Nodes (18): annotations, DemoPage(), metadata, measures, metadata, phases, PilotoPage(), ContactForm() (+10 more)

### Community 24 - "createClient"
Cohesion: 0.12
Nodes (31): signConsultationNote(), SignNoteResult, PlantillasPage(), updateUserRole(), GET(), safeNext(), AccionCritica, archiveOrganization() (+23 more)

### Community 25 - "salud/page.tsx"
Cohesion: 0.11
Nodes (21): Encabezado(), SuperadminAnaliticaPage(), SuperadminOrganizacionDetallePage(), DashboardSalud, ESTADO_WEB_LABEL, EXPORT_STATUS_LABEL, Alerta, AlertPanel() (+13 more)

### Community 26 - "note-export.test.ts"
Cohesion: 0.20
Nodes (14): cancelNoteExport(), ClinicalApiError, createNoteExport(), getNoteExport(), isNoteExportRetryable(), isNoteExportTerminal(), NoteExport, NoteExportStatus (+6 more)

### Community 27 - "formatFechaRelativa"
Cohesion: 0.22
Nodes (18): AutoRefresh(), fijarPreferencia(), leerEnServidor(), leerPreferencia(), oyentes, suscribir(), DeviceTable(), claveDiaZona() (+10 more)

### Community 28 - "Supabase (Postgres + GoTrue + PostgREST + RLS)"
Cohesion: 0.13
Nodes (19): app/auth/callback/route.ts — exchangeCodeForSession + safeNext, lib/auth/roles.ts — política de autorización pura, lib/auth/server.ts, canAccessPath, Evaluación Clean Architecture (14/28, 50 %), RPC create_org_member (SECURITY DEFINER), app/app/consultas/en-vivo/page.tsx — consulta en vivo (simulada), getCurrentProfile / requireRole (+11 more)

### Community 29 - "Plan & Discharge Editor"
Cohesion: 0.12
Nodes (11): ListKind, medicationLine(), PlanDischargePanel(), SpeechRecognitionConstructor, SpeechRecognitionEventLike, SpeechRecognitionLike, SpeechRecognitionResultLike, ClinicalAlarmSign (+3 more)

### Community 30 - "dashboard/page.tsx"
Cohesion: 0.16
Nodes (15): AdminView(), countByService(), DashboardPage(), MedicoView(), recentPatients(), weeklyCounts(), useStore(), BarList() (+7 more)

### Community 31 - "Graphify en el equipo"
Cohesion: 0.11
Nodes (18): 1. Instalar uv, 2. Instalar graphify, 3. Registrar la skill y los hooks, 4. Traer el grafo, Actualizar el grafo a mano, Camino entre dos partes del sistema, Comandos útiles, Encontrar los archivos más conectados (los críticos) (+10 more)

### Community 32 - "site.ts"
Cohesion: 0.15
Nodes (11): display, metadata, mono, sans, viewport, metadata, allRoles, appNav (+3 more)

### Community 33 - "LaboratorioWorkspace.tsx"
Cohesion: 0.15
Nodes (13): FilledSection, MIME_OK, ProfessionalInfo, TemplateRow, TemplateSectionMeta, ZONA_CLINICA, Consultation, buildLabReportHtml() (+5 more)

### Community 34 - "Clinical Encounter Data Model"
Cohesion: 0.15
Nodes (17): Grabación existente: STT session + consultation_type audio_upload, Catálogo de 147 plantillas institucionales / 49 especialidades, Cierre clínico universal: discharge, plan, alarm_signs, private_notes, Modelo ClinicalEncounter (template_snapshot congelado), Modelo ClinicalTemplate (secciones normalizadas), Contrato API Clínica /api/clinical/* (copia local del backend Graph), POST /encounters/:id/generate-note (LLM, rate limit reforzado), Endpoints de plantillas (GET/POST/PUT/DELETE /templates) (+9 more)

### Community 36 - "consultation-text.ts"
Cohesion: 0.18
Nodes (16): Bloque, bloquesDeConsulta(), buildConsultationHtml(), buildConsultationPlainText(), ConsultationTextAddendum, ConsultationTextInput, ConsultationTextPatient, copyRichTextWithFallback() (+8 more)

### Community 37 - "Alternativa A — cola en Postgres + long-poll con claim/lease"
Cohesion: 0.13
Nodes (16): Alternativa A — cola en Postgres + long-poll con claim/lease, Alternativa C — híbrida: cola + push + Realtime para ver, POST /api/v1/autofill/match, POST /api/v1/operations/jobs/claim (long-poll ~40 s), ClinicalNoteJson (note_json: sections, discharge, warnings), ensureClinicalDischarge — normalización de discharge, Fase 3 — escritura real en SAP/HIS y fallos parciales, Fase 6 — tiempo real (Alternativa C) (+8 more)

### Community 38 - "mock/index.ts"
Cohesion: 0.14
Nodes (15): AuditoriaTab(), CodificacionTab(), ConsultaDetallePage(), SupervisorView(), ReportesView(), consultations, MOCK_TODAY, acceptedCodes() (+7 more)

### Community 39 - "Windows Device Enrollment"
Cohesion: 0.16
Nodes (14): Alternativa B — tiempo real puro (Realtime / WebSocket), autenticacion-interna-plan.md — enrolamiento per-install (planificado), ConfiguracionForm — slot vacío HIS/HCE, distribucion-app-conectada.md — key embebida compartida y descompilable, POST /api/v1/operations/enroll, Fase 1 — identidad de dispositivo, tabla graph_windows_devices (device_id, token_hash, revoked), tabla graph_windows_users (identidad = email) (+6 more)

### Community 40 - "tabla clinical_encounters (Graph)"
Cohesion: 0.19
Nodes (14): buildTemplateSnapshot — congela la plantilla con snapshot_at, ClinicalEncounterService, tabla clinical_encounters (Graph), tabla consultations (Notes), deriveMotivo, encounterToConsultation — puente 1:1 por mismo id, private.enforce_consultation_immutability (trigger), noteJsonToSections — aplana sections (+6 more)

### Community 41 - "AI Proxy Routes & Observability"
Cohesion: 0.18
Nodes (13): Anthropic Messages API, app/api/chat/route.ts — proxy de chat clínico, app/api/generate-note/route.ts — generación de nota, lib/observability.ts — reportError (Sentry inerte), proxy.ts — middleware de autenticación (Next.js modificado), R1 — endpoints de IA sin autenticación, R8 — PHI transportada al LLM de terceros, Despliegue en Vercel (serverless + edge + CDN) (+5 more)

### Community 42 - "RPC claim_next_job — FOR UPDATE SKIP LOCKED + lease"
Cohesion: 0.18
Nodes (13): audit_events — canal de auditoría append-only, RPC claim_next_job — FOR UPDATE SKIP LOCKED + lease, RPC expire_stale_leases — barrido perezoso, Fase 2 — la cola y el camino feliz (MVP), graph_prompts (Android) — molde de estados running/ok/error/cancelled, idempotency_key = sha256(consultation_id + firma.hash + attempt_group), POST /api/v1/operations/jobs/:id/result (terminal, con ack), Máquina de estados del trabajo (pending…needs_doctor) (+5 more)

### Community 43 - "Auth Profiles & Roles Migration"
Cohesion: 0.18
Nodes (10): private.handle_new_user, private.prevent_last_admin_removal, private.set_profile_updated_at, on_auth_user_created, on_profile_role_change, on_profile_updated, private.current_app_role(), private.prevent_last_admin_removal() (+2 more)

### Community 44 - "Note Export Queue Design"
Cohesion: 0.20
Nodes (12): Rate-limit 120/min por IP y riesgo NAT hospitalario, Patrón SSE 50 s + bye (registerWindowsPanelRoutes), Alternativa A — Trabajo persistente + pull (elegida), Alternativa C — Sin tabla nueva (descartada), Command bridge (N3, pospuesto), RPC graph_claim_next_note_export, graph_note_exports — tabla de trabajos (nueva), Idempotencia por UNIQUE(consultation_id) (+4 more)

### Community 45 - "AgendaHoy.tsx"
Cohesion: 0.28
Nodes (12): AgendaHoy(), FilaRevision, ImportarFotoModal(), sortCitas(), Appointment, appointmentImportFingerprint(), AppointmentStatus, normalizeHora() (+4 more)

### Community 46 - "Superadmin Activity Migration"
Cohesion: 0.17
Nodes (11): public.graph_note_exports, public.superadmin_activity(), auth.users, public.audit_events, public.clinical_encounters, public.consultations, public.organizations, public.profiles (+3 more)

### Community 47 - "public.hospital_dashboard"
Cohesion: 0.12
Nodes (14): actual, kpis, por_estado, por_medico, por_servicio, previo, rango, roster (+6 more)

### Community 48 - "Web Architecture Overview"
Cohesion: 0.20
Nodes (11): Capas: navegador → useStore → Supabase / Anthropic, Flujo de una consulta: nueva → en-vivo → nota → aprobar/firmar/exportar, IA vía rutas server /api/chat y /api/generate-note con fallback, El store app/app/providers.tsx, único puente a Supabase, D13 · lib/dates.ts fija America/Bogota, D5 · El store como único puente a Supabase, D6 · IA agnóstica del modelo vía rutas server con fallback, B · Integridad: escrituras fire-and-forget y optimismo sin rollback (+3 more)

### Community 49 - "Product Strategy & Compliance"
Cohesion: 0.20
Nodes (11): D7 · El HIS lo maneja Milagro, no la web, Habeas Data: Ley 1581/2012 y datos sensibles de salud, PRD v0 · Miracle como plataforma de inteligencia clínica-operativa, Reglas de claims: la IA asiste, el médico decide, Índice de documentación de Miracle web, Roadmap 6 · Cumplimiento legal Colombia antes de pacientes reales, Benchmark Telepatía: qué copiar y qué no, Categoría propia: inteligencia clínica-operativa para Colombia (+3 more)

### Community 50 - "Clinical HTTP Client"
Cohesion: 0.18
Nodes (11): Miracle Operations — Análisis de Integración, apiBaseUrl() — NEXT_PUBLIC_API_BASE_URL, buildClinicalRequest (función pura), ClinicalApiError / CLINICAL_ERROR_MESSAGES, clinicalRequest<T>() — ejecución y normalización de errores, getAccessToken() — access_token de la sesión Supabase, encounterService.getOwnedEncounter — verificación de propiedad, lib/api/clinical.ts — cliente HTTP clínico único (+3 more)

### Community 51 - "Audit Trail & Data Model"
Cohesion: 0.22
Nodes (10): Tabla audit_events (append-only), Tabla consultations, Modelo multi-tenant por organización (RLS), clinical_encounters (Graph) — note_json, encounter-to-consultation — espejo 1:1, private.enforce_consultation_immutability, RPC graph_mark_exported, R1 — Divergencia de serialización del hash (+2 more)

### Community 52 - "Platform Diagnosis Findings"
Cohesion: 0.24
Nodes (10): useStore — app/app/providers.tsx, Supabase miracle-app (zyvfamlhlmztliexvmej), DIAGNÓSTICO de plataforma (2026-07-06), C2 — Toast afirma exportación que no ocurrió, F1 — Consulta en vivo simulada firmable, F2/P1 — Store bloquea la plataforma al cargar, F9 — 'Exportar a HC' es un placebo, I1 — No hay recuperación de contraseña (+2 more)

### Community 53 - "Workflow Agent & MCP Plans"
Cohesion: 0.20
Nodes (10): AgentTurnService.handleTurn — turno stateless, costura sagrada, assembleTools — catálogo MCP por superficie, CONTEXTO.md — describe mal a Graph ('repo viejo/aparte'), Fase 0 — desbloquear y validar el riesgo caro (PoC SAP), Neo4jWorkflowRepository, windows-client/src/Domain/Protocol.cs — contrato espejo, registerMcpRoutes.js — POST /api/v1/mcp (devuelve el PLAN), R7 — la escritura en SAP no está probada (+2 more)

### Community 54 - "Multi-Tenant Organizations Migration"
Cohesion: 0.36
Nodes (8): private.current_app_role(), private.current_org(), public.audit_events, public.consultations, public.organizations, public.patients, auth.users, public.profiles

### Community 55 - "Superadmin Activity RPC"
Cohesion: 0.20
Nodes (9): public.superadmin_activity(), auth.users, public.audit_events, public.clinical_encounters, public.consultations, public.profiles, usuarios, usuarios_calc (+1 more)

### Community 57 - "Integration Analysis & Export Funnel"
Cohesion: 0.25
Nodes (9): Graph = una función serverless (maxDuration 60 s), Análisis técnico de integración (previo), No existe cola de trabajos en ningún repo, u-windows-backend muerto (deployment ERROR), exportNote() — embudo de exportación, lib/api/clinical.ts — cliente clínico único, registerClinicalRoutes.js (carril /api/clinical), requireAccountAuth (Provider Studio) (+1 more)

### Community 58 - "Header.tsx"
Cohesion: 0.22
Nodes (8): BrandMark(), BrandMarkProps, Logo(), LogoProps, Footer(), legalNav, Header(), marketingNav

### Community 59 - "Audit Priorities & Legal Gaps"
Cohesion: 0.22
Nodes (9): DIAGNOSTICO.pdf (archivo vacío), D · Cumplimiento legal: sin consentimiento, sin retención, F · Features maqueta: configuración no guarda, captura simulada, subir audio inerte, G · UX / accesibilidad: contraseña visible, errores no mostrados, H · Deuda de esquema: migraciones no reproducibles, Las 7 prioridades reales de la auditoría, Dos consentimientos: acto médico y tratamiento/grabación de datos, Transferencia internacional: Supabase en us-east-1 (+1 more)

### Community 60 - "Stack, CI & Environment Config"
Cohesion: 0.22
Nodes (9): Autenticación Bearer con access token de Supabase (JWKS offline), E · Calidad: cero tests, sin CI/CD, sin observabilidad, Stack: Next.js App Router + TypeScript + Tailwind v4, deploy Vercel, Roadmap 7 · Observabilidad, backups, tests y CI, Variables NEXT_PUBLIC_SUPABASE_* y NEXT_PUBLIC_SITE_URL, Configuración de Google OAuth y redirect URLs, Job CI build-and-test (lint, typecheck, test, build), Variables dummy de Supabase para el build de CI (+1 more)

### Community 61 - "Dev Session Script"
Cohesion: 0.22
Nodes (5): envLocal, password, salida, supabase, supabaseUrl

### Community 62 - "Windows Operations Client"
Cohesion: 0.25
Nodes (8): windows-app sin remoto GitHub (límite del análisis), AgentTurnService — bucle pull del cliente, Alternativa B — Goal al agente (descartada), R14 — API key compartida descompilable, registerOperationsRoutes.js (nuevo, /api/v1/operations), requireApiKey (X-API-Key /api/v1), simulate-operations-executor.js (ejecutor de referencia), U-Windows-App (cliente C# / U.exe)

### Community 63 - "Auth Gating & Role Security"
Cohesion: 0.25
Nodes (8): Auth Supabase y gating por rol (canAccessPath, requireRole), Middleware proxy.ts (no cubre /api/*), D2 · Roles médico / supervisor / admin y su visibilidad, A · Seguridad / abuso: /api/* sin auth ni rate-limit, PHI en logs, Bug create_org_member: tokens GoTrue en NULL impiden el login, Roadmap 4 · B2B real: superadmin y alta de médicos (hecho), Migración 20260621041058_auth_profiles_and_roles.sql, Roles medico / supervisor / admin en public.profiles

### Community 64 - "Multi-Tenant Schema & RLS"
Cohesion: 0.29
Nodes (8): Modelo multi-tenant por organización, RLS por organización con helpers en schema private, Tablas public: organizations, profiles, patients, consultations, audit_events, clinical_templates, D1 · Todos pertenecen a una organización, D3 · Nota, códigos y transcripción como JSONB, D4 · Auditoría en tabla aparte append-only, C · Rendimiento: 4 índices FK faltantes y cargas sin paginación, Correcciones: falsos positivos descartados contra la base viva

### Community 65 - "Windows Automation Surfaces"
Cohesion: 0.29
Nodes (8): LogBus.cs — bus de logs local en memoria, outcomeForEvent (ok|error|skipped|null), POST /api/v1/workflows/:id/prepend-alignment — idempotencia bien hecha, SapGuiSurface — SAP GUI Scripting, selectores sap:, SurfaceLocator — sapgui://SID/TCODE, uia://, web://, src/domain/windowsEngines.js — catálogo de motores, POST /api/v1/workflows/:id/plan (acepta variables), WorkflowPlayer.cs — pide plan, alinea, ejecuta y aprende

### Community 66 - "Consultation Immutability & Addenda"
Cohesion: 0.25
Nodes (6): private.enforce_consultation_immutability, consultations_immutability, public.consultation_addenda, auth.users, public.consultations, public.organizations

### Community 67 - "Dark Theme Contrast Tests"
Cohesion: 0.32
Nodes (7): contrast(), css, cssBlock(), dark, light, luminance(), variablesFrom()

### Community 68 - "Clinical Templates Migration"
Cohesion: 0.29
Nodes (5): auth, private.set_updated_at, on_clinical_templates_updated, public.clinical_templates, auth.users

### Community 69 - "AI Endpoints & Code Catalog"
Cohesion: 0.33
Nodes (7): /api/chat — chatbot clínico, /api/generate-note, lib/clinical/codes.ts — catálogo CIE-10/CUPS, Milagro (extensión Chrome B2B), Miracle (web) — scribe clínico, S1 — APIs de IA sin autenticación, R16 — CONTEXTO.md describe Graph erróneamente

### Community 70 - "Agent Links Migration"
Cohesion: 0.33
Nodes (4): public.agent_links, public.agent_values_for_code(), auth.users, public.organizations

### Community 71 - "Metrics Aggregation"
Cohesion: 0.33
Nodes (5): adoptionByService, managementKpis, qualityByService, timeBeforeAfter, weeklyNotes

### Community 72 - "Superadmin Overview RPC"
Cohesion: 0.33
Nodes (5): public.superadmin_overview(), public.consultations, public.organizations, public.patients, public.profiles

### Community 73 - "Superadmin Nav Counts RPC"
Cohesion: 0.33
Nodes (5): public.superadmin_nav_counts(), public.clinical_encounters, public.consultations, public.organizations, public.profiles

### Community 74 - "Pathology Templates & Deploy Trap"
Cohesion: 0.40
Nodes (5): Patología bloqueada: falta ANTHROPIC_API_KEY, Trampa de despliegue: .vercel/project.json apunta a miracle-web-testing, Ruta app/api/clinical/note-from-photo/route.ts (una sola llamada IA por foto), Plantillas de patología en producción (specialty_code = patologia), Roadmap 2 · Encender la IA y construir el recomendador de diagnósticos

### Community 76 - "Dynamic Value Matching"
Cohesion: 0.40
Nodes (5): DynamicValueResolver (umbral 0.7), NoteFieldMatcher (confidence ≥ 0.75), Step (valueMode/bindTo/nodeKey/nodePath), verify-live-plan.js — dry-run del plan, WorkflowExecutor.applyDynamicValues

### Community 77 - "Brand Image Placeholders"
Cohesion: 0.40
Nodes (5): Logo Miracle: orbe azul con degradado radial sobre cuadro redondeado, Placeholder vertical oscuro "Foto de médico" (impacto 1), Placeholder vertical azul brillante "Foto de médico" (impacto 2), Placeholder vertical azul oscuro "Foto de médico" (impacto 3), Placeholder vertical azul medio "Foto de médico" (impacto 4)

### Community 78 - "Superadmin & Membership Migration"
Cohesion: 0.50
Nodes (3): private.is_superadmin(), private.prevent_last_admin_removal(), public.profiles

### Community 79 - "Create Org Member RPC"
Cohesion: 0.40
Nodes (4): public.create_org_member(), auth.users, public.organizations, public.profiles

### Community 80 - "Appointments Agenda Migration"
Cohesion: 0.40
Nodes (4): public.appointments, auth.users, public.organizations, public.patients

### Community 81 - "Consultation Audit Stats"
Cohesion: 0.50
Nodes (3): c, public.consultation_audit_stats(), public.consultations

### Community 82 - "Data Retention & Deletion Policy"
Cohesion: 0.67
Nodes (4): D11 · Dar de baja no es borrar (archivado y FK en CASCADE), D12 · La contraseña se verifica en la base con private.verify_own_password, D9 · Nada de datos clínicos en el navegador, Historia clínica: Res. 1995/1999, conservación 15 años

### Community 88 - "CI Pipeline & Completeness Rule"
Cohesion: 0.67
Nodes (3): .github/workflows/ci.yml — lint, typecheck, test, build, completitud() / ripsChecklist(), consultation_audit_stats — regla de completitud duplicada en SQL

### Community 90 - "API Rate Limiting & Guards"
Cohesion: 0.67
Nodes (3): rateLimit — doble barrera memoria + Postgres, fail-open, requireApiUser (lib/api/guard.ts), app/api/stt/session/route.ts — servidor Notes → Graph con MIRACLE_API_KEY

### Community 149 - "dashboard.ts"
Cohesion: 0.17
Nodes (12): AdoptionFooterLink(), AdoptionTable(), TONO, ClienteRpc, DASHBOARD_VACIO, estadoAdopcion, ETIQUETA_ADOPCION, etiquetaEstado() (+4 more)

### Community 150 - "EncounterNote.tsx"
Cohesion: 0.16
Nodes (10): EditableBlock(), EncounterNote(), NoteReviewPanel(), rowsForText(), SpeechRecognitionConstructor, SpeechRecognitionEventLike, SpeechRecognitionLike, SpeechRecognitionResultLike (+2 more)

### Community 151 - "encounter-to-consultation.ts"
Cohesion: 0.36
Nodes (11): ClinicalEncounter, ClinicalNoteJson, deriveMotivo(), encounterToConsultation(), EncounterToConsultationInput, noteJsonToSections(), specialtyDisplayName(), toStoreConsultationType() (+3 more)

### Community 152 - "clinical-api.test.ts"
Cohesion: 0.14
Nodes (19): ConsultaActivaInner(), useTranscriptAutosave(), ExampleDialog(), apiBaseUrl(), buildClinicalRequest(), clinicalRequest(), createClinicalTemplateDraftFromExample(), emptyClinicalDischarge() (+11 more)

### Community 153 - "note-review.ts"
Cohesion: 0.24
Nodes (14): AuditFinding, emptyReview(), esInformeDeMuestra(), joinLabels(), normalizeDischarge(), NoteReview, pareceDato(), pluralize() (+6 more)

### Community 154 - "EncounterAuditPanel.tsx"
Cohesion: 0.27
Nodes (7): CONCEPT_LABEL, COVERAGE_STYLE, EncounterAuditPanel(), fecha(), auditSeverityPenalty(), noteReviewLabel(), noteReviewScore()

### Community 155 - "transcribe-audio-file.ts"
Cohesion: 0.42
Nodes (7): ACCEPTED_AUDIO_TYPES, delay(), fetchStreamSession(), isSonioxSession(), MAX_AUDIO_UPLOAD_BYTES, transcribeAudioFile(), validateAudioUpload()

### Community 156 - "note-review.test.ts"
Cohesion: 0.31
Nodes (6): EncounterTemplateSnapshot, NoteReviewInput, notaCompleta(), plantilla(), revisar(), TRANSCRIPCION_LARGA

### Community 157 - "app/consultas/page.tsx"
Cohesion: 0.15
Nodes (14): ConsultasFilters(), DoctorOption, AccessRow, ConsultasPage(), ESTADOS, patientName(), Row, PacientesSearch() (+6 more)

### Community 158 - "ConfiguracionForm.tsx"
Cohesion: 0.32
Nodes (3): back(), updateOrgSettings(), ConfiguracionForm()

### Community 160 - "TrendChart.tsx"
Cohesion: 0.47
Nodes (5): formatDia(), niceTicks(), PAD, Punto, TrendChart()

### Community 161 - "DailyTrend.tsx"
Cohesion: 0.60
Nodes (4): DailyTrend(), formatDia(), niceTicks(), PAD

### Community 162 - "codes.ts"
Cohesion: 0.60
Nodes (3): CatalogCode, CODE_CATALOG, searchCodes()

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
- **421 isolated node(s):** `runtime`, `maxDuration`, `MEDIA_TYPES`, `TemplateSection`, `FilledSection` (+416 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

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
- **Why does `createClient()` connect `createClient` to `export/route.ts`, `AppShell.tsx`, `TemplateBuilderPanel.tsx`, `note-from-photo/route.ts`, `superadmin/page.tsx`, `versiones.ts`, `auditoria/page.tsx`, `actividad/page.tsx`, `supabase/server.ts`, `salud/page.tsx`, `app/consultas/page.tsx`, `ConfiguracionForm.tsx`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `useStore()` connect `dashboard/page.tsx` to `AppShell.tsx`, `LaboratorioWorkspace.tsx`, `note-from-photo/route.ts`, `mock/index.ts`, `consultas/[id]/page.tsx`, `en-vivo/page.tsx`, `providers.tsx`, `AgendaHoy.tsx`, `nueva/page.tsx`, `actividad/page.tsx`, `clinical-api.test.ts`, `ConfiguracionForm.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._