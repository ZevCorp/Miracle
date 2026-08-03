// Cliente centralizado del API clínico (backend/motor Miracle).
//
// Contrato: docs/backend-clinical-api-contract.md
// Flujo:    Supabase → Backend Miracle → este cliente → UI
//
// Reglas:
// - Todas las llamadas clínicas pasan por aquí (nada de fetch sueltos en
//   componentes) y llevan `Authorization: Bearer <token Supabase del usuario>`.
// - El frontend NUNCA habla directo con Supabase para clinical_templates /
//   clinical_encounters, y NUNCA usa la service-role key.
// - Los errores del backend ({ error: { code, message } }) se normalizan a
//   ClinicalApiError con mensaje amigable para la UI.
// - No se imprimen transcripciones ni notas (PHI) en consola.

import { createClient } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ */
/* Modelos del contrato                                                */
/* ------------------------------------------------------------------ */

export interface ClinicalTemplateSection {
  key: string;
  label: string;
  order: number;
  required?: boolean;
  instruction?: string;
}

export interface ClinicalTemplate {
  id: string;
  name: string;
  /** Siempre llega normalizada con guion_bajo (ej. "medicina_general"). */
  specialty: string;
  description?: string | null;
  owner_user_id?: string | null;
  scope?: "institutional" | "personal";
  is_default?: boolean;
  status?: "active" | "archived";
  sections_count?: number;
  sections: ClinicalTemplateSection[];
  created_at?: string;
  updated_at?: string;
}

export interface ClinicalNoteSection {
  key: string;
  label: string;
  /** Campo principal del contenido. Nunca usar value/text/body. */
  content: string;
  confidence?: number;
  evidence?: string;
}

export interface ClinicalDischargeItem {
  text: string;
  evidence?: string;
}

export interface ClinicalMedicationPlanItem {
  name: string;
  dose?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  evidence?: string;
}

export interface ClinicalAlarmSign extends ClinicalDischargeItem {
  urgency?: "emergency" | "priority" | "monitor";
}

/** Universal clinical close, present for every generated note regardless of template. */
export interface ClinicalDischarge {
  plan: {
    medications: ClinicalMedicationPlanItem[];
    non_pharmacological: ClinicalDischargeItem[];
    follow_up: ClinicalDischargeItem[];
  };
  recommendations: ClinicalDischargeItem[];
  alarm_signs: ClinicalAlarmSign[];
}

export interface ClinicalNoteJson {
  summary: string;
  sections: ClinicalNoteSection[];
  /** Older notes may not have this until re-saved; use ensureClinicalDischarge in UI. */
  discharge?: ClinicalDischarge;
  warnings: string[];
  missing_required_sections: string[];
}

// Alias con los nombres del contrato, por si se prefieren en imports.
export type NoteJson = ClinicalNoteJson;
export type NoteSection = ClinicalNoteSection;

/** Snapshot de plantilla congelado al crear el encounter. */
export interface EncounterTemplateSnapshot {
  template_id: string;
  name: string;
  specialty: string;
  description?: string | null;
  scope?: string;
  is_default?: boolean;
  sections: ClinicalTemplateSection[];
  snapshot_at?: string;
}

export type BackendConsultationType =
  | "presencial"
  | "telemedicina"
  | "audio_upload";

export interface ClinicalEncounter {
  id: string;
  patient_id: string | null;
  doctor_id?: string;
  consultation_type: BackendConsultationType | string;
  template_id: string;
  template_snapshot?: EncounterTemplateSnapshot;
  status:
    | "created"
    | "transcript_ready"
    | "note_generating"
    | "note_generated"
    | "completed"
    | "failed"
    | string;
  transcript?: string;
  note_json?: ClinicalNoteJson | null;
  /** Visible only to the owning doctor; excluded from AI prompts and exports by default. */
  private_notes?: string;
  supersedes_encounter_id?: string | null;
  replaced_by_encounter_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Sección enviada al crear/editar plantilla. El backend acepta strings
 * ("Motivo de consulta") u objetos. `key` es opcional: al editar una sección
 * existente se envía para PRESERVARLA; en secciones nuevas se omite y el backend
 * la genera desde el label.
 */
export interface ClinicalTemplateSectionInput {
  key?: string;
  label: string;
  order?: number;
  required?: boolean;
  instruction?: string;
}

export type CreateTemplateSectionInput = string | ClinicalTemplateSectionInput;

export interface CreateClinicalTemplatePayload {
  name: string;
  specialty: string;
  description?: string;
  sections: CreateTemplateSectionInput[];
}

export type UpdateClinicalTemplatePayload = Partial<CreateClinicalTemplatePayload>;

export interface CreateClinicalEncounterPayload {
  patient_id: string | null;
  consultation_type: BackendConsultationType;
  template_id: string;
}

export interface CreateEncounterResult {
  encounter_id: string;
  status: string;
  template: EncounterTemplateSnapshot;
}

export interface SaveTranscriptResult {
  encounter_id: string;
  status: string;
  transcript_length: number;
}

export interface GenerateNoteResult {
  encounter_id: string;
  status: string;
  note_json: ClinicalNoteJson;
}

export interface SaveNoteResult {
  encounter_id: string;
  status: string;
  note_json: ClinicalNoteJson;
}

/** Propuesta efímera de IA: se revisa en el constructor antes de guardarse. */
export interface TemplateDraftProposal {
  template: CreateClinicalTemplatePayload;
  requires_physician_review: boolean;
  source_persisted: false;
}

export interface SavePrivateNotesResult {
  encounter_id: string;
  private_notes: string;
  updated_at?: string;
}

export interface RegenerateWithTemplateResult {
  source_encounter_id: string;
  encounter: ClinicalEncounter;
}

/** Límite del backend (413 TRANSCRIPT_TOO_LONG por encima de esto). */
export const MAX_TRANSCRIPT_LENGTH = 200_000;

/* ------------------------------------------------------------------ */
/* Errores normalizados                                                */
/* ------------------------------------------------------------------ */

/** Mensajes amigables por código de error del backend. Sin JSON crudo ni stacks. */
export const CLINICAL_ERROR_MESSAGES: Record<string, string> = {
  TEMPLATE_NOT_FOUND:
    "No encontramos la plantilla seleccionada. Recarga la página e inténtalo de nuevo.",
  TEMPLATE_INVALID: "Revisa la plantilla. Necesita nombre y secciones válidas.",
  ENCOUNTER_NOT_FOUND: "No encontramos esta consulta. Vuelve a iniciarla.",
  TRANSCRIPT_REQUIRED:
    "La transcripción está vacía. Graba o escribe la consulta antes de generar la nota.",
  TRANSCRIPT_TOO_LONG:
    "La transcripción es demasiado larga. Divide la consulta o intenta resumirla.",
  LLM_NOT_CONFIGURED:
    "La generación de notas no está configurada en el servidor.",
  NOTE_GENERATION_FAILED: "No pudimos generar la nota clínica. Intenta de nuevo.",
  NOTE_JSON_INVALID:
    "La nota generada tuvo un formato inválido. Intenta regenerarla.",
  // Errores del asistente clínico (chat, ajuste de nota, sugerencias).
  ASSISTANT_FAILED:
    "El asistente no pudo responder en este momento. Intenta de nuevo en unos segundos.",
  ASSISTANT_INVALID:
    "Revisa el mensaje: está vacío o es demasiado largo.",
  UNAUTHORIZED: "Tu sesión expiró. Vuelve a iniciar sesión.",
  ENCOUNTER_INVALID: "La consulta tiene datos incompletos o inválidos.",
  ENCOUNTER_COMPLETED:
    "Esta consulta ya está completada; la transcripción no se puede modificar.",
  SUPABASE_NOT_CONFIGURED:
    "El servidor clínico no está configurado. Contacta al administrador.",
  RATE_LIMITED: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
  // Exportación a historia clínica (graph_note_exports en Graph).
  CONSULTATION_NOT_FOUND: "No encontramos esta consulta. Recarga la página.",
  CONSULTATION_NOT_APPROVED:
    "La nota tiene que estar aprobada y firmada antes de exportarla.",
  CONSULTATION_NOT_SIGNED: "Esta nota no tiene una firma válida.",
  CONSULTATION_ALREADY_EXPORTED:
    "Esta consulta ya está exportada a la historia clínica.",
  CONSULTATION_IS_DEMO:
    "Esta es una consulta de demostración y no puede exportarse a la historia clínica.",
  SIGNATURE_HASH_MISMATCH:
    "El contenido de la nota no coincide con su firma, así que no se puede exportar. Revísala y vuelve a firmarla.",
  EXPORT_FORBIDDEN: "No tienes permiso para exportar esta nota.",
  EXPORT_NOT_FOUND: "No encontramos esta exportación. Recarga la página.",
  EXPORT_ALREADY_EXISTS: "Ya hay una exportación en curso para esta consulta.",
  EXPORT_NOT_RETRYABLE:
    "Esta exportación no se puede reintentar en su estado actual.",
  EXPORT_NOT_CANCELLABLE:
    "La exportación ya está en curso: no se puede cancelar.",
  EXPORT_INVALID: "La solicitud de exportación no es válida.",
  WORKFLOW_NOT_CONFIGURED:
    "La automatización de historia clínica no está configurada. Contacta al administrador.",
  // Vinculación de equipos (Operations) — graph_device_doctor_links en Graph.
  PAIRING_CODE_INVALID:
    "El código no es válido o ya venció. Pídele al equipo uno nuevo (duran 10 minutos).",
  DOCTOR_WITHOUT_ORGANIZATION:
    "Tu perfil no tiene organización asignada; pídele al administrador que la configure antes de vincular un equipo.",
  LINK_NOT_FOUND: "Ese vínculo ya no existe. Recarga la página.",
  NETWORK_ERROR:
    "No pudimos conectar con el servidor clínico. Revisa tu conexión e inténtalo de nuevo.",
  API_NOT_CONFIGURED:
    "Falta configurar la URL del backend clínico (NEXT_PUBLIC_API_BASE_URL).",
  INTERNAL_ERROR: "Ocurrió un error inesperado. Intenta de nuevo.",
};

export class ClinicalApiError extends Error {
  /** Código estable del backend (o sintético: NETWORK_ERROR, API_NOT_CONFIGURED…). */
  readonly code: string;
  /** HTTP status (0 si nunca hubo respuesta). */
  readonly status: number;
  /** Mensaje apto para mostrar al médico. */
  readonly friendlyMessage: string;

  constructor(code: string, status: number, message?: string) {
    const friendly =
      CLINICAL_ERROR_MESSAGES[code] ?? CLINICAL_ERROR_MESSAGES.INTERNAL_ERROR;
    super(message || friendly);
    this.name = "ClinicalApiError";
    this.code = code;
    this.status = status;
    this.friendlyMessage = friendly;
  }
}

/** Mensaje amigable para cualquier error capturado en la UI. */
export function friendlyClinicalMessage(error: unknown): string {
  if (error instanceof ClinicalApiError) return error.friendlyMessage;
  return CLINICAL_ERROR_MESSAGES.INTERNAL_ERROR;
}

/**
 * Normaliza el cuerpo de error del backend a { code, message }.
 * Acepta el envelope estable { error: { code, message } } y el formato legacy
 * del middleware de auth ({ error: "..." }, típico en 401).
 */
export function parseClinicalErrorPayload(
  status: number,
  payload: unknown,
): { code: string; message: string } {
  if (payload && typeof payload === "object") {
    const err = (payload as { error?: unknown }).error;
    if (err && typeof err === "object") {
      const code = String((err as { code?: unknown }).code ?? "").trim();
      const message = String((err as { message?: unknown }).message ?? "").trim();
      if (code) return { code, message };
    }
    if (typeof err === "string" && err.trim()) {
      // Formato legacy (middleware de auth): { error: "mensaje" }.
      if (status === 401 || status === 403) {
        return { code: "UNAUTHORIZED", message: err };
      }
      return { code: statusFallbackCode(status), message: err };
    }
  }
  return { code: statusFallbackCode(status), message: "" };
}

function statusFallbackCode(status: number): string {
  if (status === 401 || status === 403) return "UNAUTHORIZED";
  if (status === 429) return "RATE_LIMITED";
  return "INTERNAL_ERROR";
}

/* ------------------------------------------------------------------ */
/* Helpers puros (testeables)                                          */
/* ------------------------------------------------------------------ */

/**
 * Normaliza un código de especialidad al formato del backend (snake_case,
 * sin acentos): "medicina-general" → "medicina_general". El backend acepta
 * ambos, pero para COMPARAR localmente hay que usar la misma forma.
 */
export function normalizeSpecialtyCode(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

/**
 * Convierte el textarea "una sección por línea" en el array limpio que espera
 * POST /api/clinical/templates (strings; el backend genera key/order/instruction).
 */
export function parseTemplateSectionsInput(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Mapea el tipo de consulta de la UI al valor del contrato. */
export function toBackendConsultationType(
  tipo: string,
): BackendConsultationType {
  if (tipo === "telemedicina") return "telemedicina";
  if (tipo === "audio" || tipo === "audio_upload") return "audio_upload";
  return "presencial";
}

/** Secciones de plantilla ordenadas por `order` (sin mutar la original). */
export function sortedTemplateSections(
  sections: ClinicalTemplateSection[] | undefined,
): ClinicalTemplateSection[] {
  return [...(sections ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Edita el `content` de una sección de la nota preservando key, label,
 * confidence y evidence (regla del contrato para PUT /note).
 */
export function updateNoteSectionContent(
  note: ClinicalNoteJson,
  key: string,
  content: string,
): ClinicalNoteJson {
  return {
    ...note,
    sections: note.sections.map((section) =>
      section.key === key ? { ...section, content } : section,
    ),
  };
}

export function emptyClinicalDischarge(): ClinicalDischarge {
  return {
    plan: { medications: [], non_pharmacological: [], follow_up: [] },
    recommendations: [],
    alarm_signs: [],
  };
}

/** Makes old notes renderable while the backend backfills the universal close on save. */
export function ensureClinicalDischarge(
  discharge?: ClinicalDischarge | null,
): ClinicalDischarge {
  const empty = emptyClinicalDischarge();
  return {
    plan: {
      medications: Array.isArray(discharge?.plan?.medications)
        ? discharge!.plan.medications
        : empty.plan.medications,
      non_pharmacological: Array.isArray(discharge?.plan?.non_pharmacological)
        ? discharge!.plan.non_pharmacological
        : empty.plan.non_pharmacological,
      follow_up: Array.isArray(discharge?.plan?.follow_up)
        ? discharge!.plan.follow_up
        : empty.plan.follow_up,
    },
    recommendations: Array.isArray(discharge?.recommendations)
      ? discharge!.recommendations
      : empty.recommendations,
    alarm_signs: Array.isArray(discharge?.alarm_signs)
      ? discharge!.alarm_signs
      : empty.alarm_signs,
  };
}

export interface ClinicalRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | undefined>;
}

/** Construye URL + RequestInit del contrato. Puro: testeable sin red ni sesión. */
export function buildClinicalRequest(
  baseUrl: string,
  path: string,
  token: string,
  options: ClinicalRequestOptions = {},
): { url: string; init: RequestInit } {
  const base = baseUrl.replace(/\/+$/, "");
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== "") search.set(key, value);
  }
  const qs = search.toString();
  const url = `${base}${path}${qs ? `?${qs}` : ""}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const init: RequestInit = { method: options.method ?? "GET", headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  return { url, init };
}

/* ------------------------------------------------------------------ */
/* Configuración y sesión                                              */
/* ------------------------------------------------------------------ */

function apiBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base || !base.trim()) {
    throw new ClinicalApiError("API_NOT_CONFIGURED", 0);
  }
  return base.trim();
}

async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) {
    throw new ClinicalApiError("UNAUTHORIZED", 401);
  }
  return token;
}

/* ------------------------------------------------------------------ */
/* Núcleo de requests                                                  */
/* ------------------------------------------------------------------ */

async function clinicalRequest<T>(
  path: string,
  options: ClinicalRequestOptions = {},
): Promise<T> {
  const base = apiBaseUrl();
  const token = await getAccessToken();
  const { url, init } = buildClinicalRequest(base, path, token, options);

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    // Error de red/CORS: nunca hubo respuesta del backend.
    throw new ClinicalApiError("NETWORK_ERROR", 0);
  }

  // Respuestas sin JSON (proxies, 502 en texto plano…) no deben romper la UI.
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const { code, message } = parseClinicalErrorPayload(response.status, payload);
    // ENCOUNTER_INVALID con 409 = transcript sobre encounter completado.
    const effectiveCode =
      code === "ENCOUNTER_INVALID" && response.status === 409
        ? "ENCOUNTER_COMPLETED"
        : code;
    // Log sin PHI: solo ruta, status y código.
    console.error(`[clinical-api] ${init.method} ${path} → ${response.status} ${effectiveCode}`);
    throw new ClinicalApiError(effectiveCode, response.status, message);
  }

  if (payload === null) {
    console.error(`[clinical-api] ${init.method} ${path} → respuesta sin JSON`);
    throw new ClinicalApiError("INTERNAL_ERROR", response.status);
  }

  return payload as T;
}

/* ------------------------------------------------------------------ */
/* Plantillas                                                          */
/* ------------------------------------------------------------------ */

export async function getClinicalTemplates(params?: {
  specialty?: string;
}): Promise<ClinicalTemplate[]> {
  const data = await clinicalRequest<{ templates: ClinicalTemplate[] }>(
    "/api/clinical/templates",
    { query: { specialty: params?.specialty } },
  );
  return data.templates ?? [];
}

export async function getClinicalTemplate(
  templateId: string,
): Promise<ClinicalTemplate> {
  const data = await clinicalRequest<{ template: ClinicalTemplate }>(
    `/api/clinical/templates/${encodeURIComponent(templateId)}`,
  );
  return data.template;
}

export async function createClinicalTemplate(
  payload: CreateClinicalTemplatePayload,
): Promise<ClinicalTemplate> {
  const data = await clinicalRequest<{ template: ClinicalTemplate }>(
    "/api/clinical/templates",
    { method: "POST", body: payload },
  );
  return data.template;
}

export async function updateClinicalTemplate(
  templateId: string,
  payload: UpdateClinicalTemplatePayload,
): Promise<ClinicalTemplate> {
  const data = await clinicalRequest<{ template: ClinicalTemplate }>(
    `/api/clinical/templates/${encodeURIComponent(templateId)}`,
    { method: "PUT", body: payload },
  );
  return data.template;
}

/** DELETE = archivado (soft delete): la plantilla pasa a status "archived". */
export async function archiveClinicalTemplate(templateId: string): Promise<void> {
  await clinicalRequest<{ template: ClinicalTemplate }>(
    `/api/clinical/templates/${encodeURIComponent(templateId)}`,
    { method: "DELETE" },
  );
}

/* ------------------------------------------------------------------ */
/* Encounters                                                          */
/* ------------------------------------------------------------------ */

export async function createClinicalEncounter(
  payload: CreateClinicalEncounterPayload,
): Promise<CreateEncounterResult> {
  return clinicalRequest<CreateEncounterResult>("/api/clinical/encounters", {
    method: "POST",
    body: payload,
  });
}

export async function getClinicalEncounter(
  encounterId: string,
): Promise<ClinicalEncounter> {
  const data = await clinicalRequest<{ encounter: ClinicalEncounter }>(
    `/api/clinical/encounters/${encodeURIComponent(encounterId)}`,
  );
  return data.encounter;
}

export async function saveClinicalTranscript(
  encounterId: string,
  transcript: string,
): Promise<SaveTranscriptResult> {
  return clinicalRequest<SaveTranscriptResult>(
    `/api/clinical/encounters/${encodeURIComponent(encounterId)}/transcript`,
    { method: "POST", body: { transcript } },
  );
}

export async function generateClinicalNote(
  encounterId: string,
): Promise<GenerateNoteResult> {
  return clinicalRequest<GenerateNoteResult>(
    `/api/clinical/encounters/${encodeURIComponent(encounterId)}/generate-note`,
    { method: "POST" },
  );
}

export async function saveEditedClinicalNote(
  encounterId: string,
  noteJson: ClinicalNoteJson,
): Promise<SaveNoteResult> {
  return clinicalRequest<SaveNoteResult>(
    `/api/clinical/encounters/${encodeURIComponent(encounterId)}/note`,
    { method: "PUT", body: { note_json: noteJson } },
  );
}

/** Asocia o retira un paciente sin modificar la transcripción ni la plantilla. */
export async function updateClinicalEncounterPatient(
  encounterId: string,
  patientId: string | null,
): Promise<ClinicalEncounter> {
  const data = await clinicalRequest<{ encounter: ClinicalEncounter }>(
    `/api/clinical/encounters/${encodeURIComponent(encounterId)}/patient`,
    { method: "PATCH", body: { patient_id: patientId } },
  );
  return data.encounter;
}

export async function createClinicalTemplateDraftFromExample(payload: {
  specialty: string;
  example_text: string;
}): Promise<TemplateDraftProposal> {
  return clinicalRequest<TemplateDraftProposal>(
    "/api/clinical/templates/draft-from-example",
    { method: "POST", body: payload },
  );
}

export async function savePrivateEncounterNotes(
  encounterId: string,
  content: string,
): Promise<SavePrivateNotesResult> {
  return clinicalRequest<SavePrivateNotesResult>(
    `/api/clinical/encounters/${encodeURIComponent(encounterId)}/private-notes`,
    { method: "PUT", body: { content } },
  );
}

export async function regenerateClinicalEncounterWithTemplate(
  encounterId: string,
  templateId: string,
): Promise<RegenerateWithTemplateResult> {
  return clinicalRequest<RegenerateWithTemplateResult>(
    `/api/clinical/encounters/${encodeURIComponent(encounterId)}/regenerate-with-template`,
    { method: "POST", body: { template_id: templateId } },
  );
}

/* ------------------------------------------------------------------ */
/* Asistente clínico (chat contextual y ajuste de nota con IA)         */
/* ------------------------------------------------------------------ */

export interface AssistantChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Contexto de pantalla que el backend acepta (whitelist del contrato). */
export interface AssistantScreenContext {
  route?: string;
  page?: string;
  visible_panel?: string;
  selected_section_key?: string;
  selected_section_label?: string;
  visible_text?: string;
  user_intent_surface?: string;
}

export interface AssistantChatPayload {
  /** Pregunta o instrucción del médico (máx. 8000 caracteres). */
  message: string;
  /** Turnos previos; el backend usa los últimos 12. */
  history?: AssistantChatMessage[];
  /** Si se envía, el backend suma transcript/nota del encounter al contexto. */
  encounter_id?: string;
  specialty?: string;
  screen_context?: AssistantScreenContext;
}

export interface AssistantChatResult {
  answer: string;
  mode: string;
  specialty?: string;
  used_context?: {
    encounter?: boolean;
    transcript?: boolean;
    note_json?: boolean;
    screen_context?: boolean;
  };
  safety_notice?: string;
  suggested_actions?: unknown[];
}

export async function sendAssistantChat(
  payload: AssistantChatPayload,
): Promise<AssistantChatResult> {
  return clinicalRequest<AssistantChatResult>("/api/clinical/assistant/chat", {
    method: "POST",
    body: payload,
  });
}

export interface NoteAdjustmentPayload {
  encounter_id: string;
  /** Instrucción libre del médico (máx. 2000). Requiere nota ya generada. */
  instruction: string;
  /** Limita el ajuste a una sección concreta. */
  section_key?: string;
}

export interface NoteAdjustmentResult {
  /** Nota propuesta. NO se persiste sola: guardar con saveEditedClinicalNote. */
  proposed_note_json: ClinicalNoteJson;
  changed_sections: string[];
  explanation: string;
  requires_physician_review: boolean;
}

export async function adjustNoteWithAssistant(
  payload: NoteAdjustmentPayload,
): Promise<NoteAdjustmentResult> {
  return clinicalRequest<NoteAdjustmentResult>(
    "/api/clinical/assistant/note-adjustment",
    { method: "POST", body: payload },
  );
}

/* ------------------------------------------------------------------ */
/* Exportación a historia clínica                                      */
/* ------------------------------------------------------------------ */
//
// Flujo real (nada de esto marca la consulta como exportada por sí solo):
//   1. El médico firma y pulsa "Exportar a HC" → createNoteExport().
//   2. Graph valida (aprobada + firmada + hash re-verificado), congela un
//      snapshot y encola el trabajo en estado `pending`.
//   3. Un ejecutor de Operations lo reclama (`claimed`) y lo escribe en el HIS.
//   4. Solo cuando el ejecutor confirma éxito el trabajo pasa a `completed` y
//      la consulta pasa de `aprobada` a `exportada`.
//
// Por eso la UI NUNCA debe decir "exportada" al enviar la solicitud: el estado
// se lee del servidor (getNoteExport) y sobrevive a recargas.

/** Estados del trabajo de exportación. Son los del contrato de Graph. */
export type NoteExportStatus =
  | "pending"
  | "claimed"
  | "completed"
  | "needs_doctor"
  | "failed"
  | "cancelled";

export interface NoteExportResultSummary {
  outcome: "ok" | "needs_doctor" | "error" | null;
  /** Folio devuelto por el HIS cuando la escritura se confirmó. */
  folio: string | null;
  /** Etiquetas de campos que quedaron sin llenar (no son PHI). */
  unresolved_fields: string[];
  detail_code: string | null;
}

export interface NoteExportAttempt {
  event: string;
  at?: string;
  attempt?: number;
  outcome?: string;
  status?: string;
  error_code?: string | null;
  folio?: string | null;
  from_status?: string;
  claimed_by?: string;
}

/** Vista del trabajo que expone Graph. Nunca incluye el contenido clínico. */
export interface NoteExport {
  id: string;
  consultation_id: string;
  status: NoteExportStatus;
  attempts: number;
  workflow_id: string;
  error_code: string | null;
  hash_source: "firma" | "computed_at_export";
  result_summary: NoteExportResultSummary | null;
  claimed_by: string | null;
  lease_expires_at: string | null;
  created_at: string | null;
  claimed_at: string | null;
  finished_at: string | null;
  updated_at: string | null;
  attempt_history: NoteExportAttempt[];
}

export interface NoteExportState {
  export: NoteExport | null;
  /** Estado de negocio de la consulta según el servidor ('aprobada'|'exportada'…). */
  consultation_estado: string;
}

/** `true` cuando el trabajo ya terminó y no cambiará solo (deja de hacer polling). */
export function isNoteExportTerminal(status: NoteExportStatus | null | undefined): boolean {
  return status === "completed" || status === "failed"
    || status === "needs_doctor" || status === "cancelled";
}

/** `true` cuando el médico puede volver a intentarlo. */
export function isNoteExportRetryable(status: NoteExportStatus | null | undefined): boolean {
  return status === "failed" || status === "needs_doctor" || status === "cancelled";
}

/**
 * Pide la exportación. Devuelve el trabajo en `pending`: NO significa que la
 * nota esté en la historia clínica.
 *
 * Idempotente: si ya existía un trabajo para la consulta, Graph responde 409 y
 * aquí se recupera ese mismo trabajo con `duplicate: true` en vez de propagar un
 * error. Eso es lo que hace inofensivos el doble clic, dos pestañas abiertas y
 * los reintentos de red.
 */
export async function createNoteExport(
  consultationId: string,
): Promise<{ export: NoteExport; duplicate: boolean }> {
  try {
    const data = await clinicalRequest<{ export: NoteExport }>("/api/clinical/exports", {
      method: "POST",
      body: { consultation_id: consultationId },
    });
    return { export: data.export, duplicate: false };
  } catch (error) {
    if (error instanceof ClinicalApiError && error.code === "EXPORT_ALREADY_EXISTS") {
      // Ya había trabajo: adoptamos su estado actual, no creamos otro.
      const current = await getNoteExport(consultationId);
      if (current.export) return { export: current.export, duplicate: true };
    }
    throw error;
  }
}

/** Estado actual del trabajo. Es la fuente de verdad tras recargar la página. */
export async function getNoteExport(consultationId: string): Promise<NoteExportState> {
  return clinicalRequest<NoteExportState>("/api/clinical/exports", {
    query: { consultation_id: consultationId },
  });
}

/** Reencola la MISMA exportación. Solo desde failed | needs_doctor | cancelled. */
export async function retryNoteExport(
  exportId: string,
): Promise<{ export: NoteExport; idempotent: boolean }> {
  return clinicalRequest<{ export: NoteExport; idempotent: boolean }>(
    `/api/clinical/exports/${encodeURIComponent(exportId)}/retry`,
    { method: "POST" },
  );
}

/** Cancela una exportación que todavía nadie tomó. */
export async function cancelNoteExport(
  exportId: string,
): Promise<{ export: NoteExport; idempotent: boolean }> {
  return clinicalRequest<{ export: NoteExport; idempotent: boolean }>(
    `/api/clinical/exports/${encodeURIComponent(exportId)}/cancel`,
    { method: "POST" },
  );
}

/* ------------------------------------------------------------------ */
/* Equipos vinculados (Operations)                                     */
/* ------------------------------------------------------------------ */
// El equipo Windows muestra un código de 8 caracteres en su pantalla; el médico
// lo canjea aquí con SU sesión. Desde entonces ese equipo puede trabajarle las
// consultas por API (crear, dictar, generar nota) — nunca firmar ni exportar.
// Las tablas viven en Graph (service-role): por eso esto va por el API clínico
// y no por una RPC de Supabase.

export interface LinkedDevice {
  link_id: string;
  device_id: string;
  label: string;
  approved_at: string;
  last_seen: string | null;
}

/** Canjea el código que muestra el equipo. Un solo uso; vence a los 10 minutos. */
export async function claimDevicePairing(code: string): Promise<{
  link_id: string;
  device: { device_id: string; label: string };
}> {
  return clinicalRequest("/api/clinical/devices/claim-pairing", {
    method: "POST",
    body: { code: code.trim().toUpperCase() },
  });
}

/** Los equipos vinculados del médico actual. */
export async function getLinkedDevices(): Promise<LinkedDevice[]> {
  const data = await clinicalRequest<{ devices: LinkedDevice[] }>(
    "/api/clinical/devices",
  );
  return data.devices ?? [];
}

/** Desvincula un equipo. Su credencial sigue viva; lo que muere es poder actuar a tu nombre. */
export async function revokeDeviceLink(linkId: string): Promise<void> {
  await clinicalRequest(`/api/clinical/devices/${encodeURIComponent(linkId)}/revoke`, {
    method: "POST",
  });
}
