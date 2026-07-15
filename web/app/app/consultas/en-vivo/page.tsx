"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/app/app/providers";
import { PatientHeader } from "@/components/app/PatientHeader";
import { EncounterNote } from "@/components/app/EncounterNote";
import { DictationPanel } from "@/components/app/DictationPanel";
import { encounterToConsultation } from "@/lib/clinical/encounter-to-consultation";
import {
  adjustNoteWithAssistant,
  friendlyClinicalMessage,
  generateClinicalNote,
  getClinicalEncounter,
  saveClinicalTranscript,
  saveEditedClinicalNote,
  updateNoteSectionContent,
  CLINICAL_ERROR_MESSAGES,
  MAX_TRANSCRIPT_LENGTH,
  type ClinicalEncounter,
  type ClinicalNoteJson,
} from "@/lib/api/clinical";

const STATUS_LABEL: Record<string, string> = {
  created: "Creada",
  transcript_ready: "Transcripción lista",
  note_generating: "Generando nota",
  note_generated: "Nota generada",
  completed: "Completada",
  failed: "Con error",
};

const TYPE_LABEL: Record<string, string> = {
  presencial: "Presencial",
  telemedicina: "Telemedicina",
  audio_upload: "Audio cargado",
};

type FlowPhase =
  | "idle"
  | "saving_transcript"
  | "generating"
  | "saving_note"
  | "adjusting";

function ConsultaActivaInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const encounterId = sp.get("encounter");
  const pacienteId = sp.get("paciente") ?? "";
  const { getPatient, upsertConsultation } = useStore();
  const patient = getPatient(pacienteId);

  // La consulta activa SIEMPRE trabaja sobre un encounter real del backend.
  // Sin encounter_id no hay nada que capturar: el flujo nace en Nueva consulta.
  useEffect(() => {
    if (!encounterId) router.replace("/app/consultas/nueva");
  }, [encounterId, router]);

  const [encounter, setEncounter] = useState<ClinicalEncounter | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const [transcriptDraft, setTranscriptDraft] = useState("");
  // Última transcripción confirmada por el backend (para detectar cambios).
  const [savedTranscript, setSavedTranscript] = useState("");
  // true mientras la grabación con transcripción en vivo está activa.
  const [dictando, setDictando] = useState(false);

  const [note, setNote] = useState<ClinicalNoteJson | null>(null);
  const [noteDirty, setNoteDirty] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [showTranscriptPanel, setShowTranscriptPanel] = useState(true);

  const [phase, setPhase] = useState<FlowPhase>("idle");
  const [flowError, setFlowError] = useState<string | null>(null);

  // Ajuste de nota con IA (barra "Pídale a Miracle…").
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  const status = encounter?.status ?? "created";
  const completed = status === "completed";
  const busy = phase !== "idle";

  // Re-dispara la carga del encounter (botón Reintentar).
  const [reloadKey, setReloadKey] = useState(0);

  // El estado "cargando" lo enciende quien dispara la carga (montaje inicial o
  // Reintentar); aquí solo se resuelve el resultado. `ignore` descarta
  // respuestas viejas si cambia el encounter mientras responde el backend.
  useEffect(() => {
    if (!encounterId) return;
    let ignore = false;

    async function load() {
      try {
        const data = await getClinicalEncounter(encounterId!);
        if (ignore) return;
        setEncounter(data);
        setTranscriptDraft(data.transcript ?? "");
        setSavedTranscript(data.transcript ?? "");
        setNote(data.note_json ?? null);
        setNoteDirty(false);
        setNoteSaved(data.status === "completed");
        setShowTranscriptPanel(!data.note_json);
        setLoadState("ready");
      } catch (error) {
        if (ignore) return;
        setLoadError(friendlyClinicalMessage(error));
        setLoadState("error");
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, [encounterId, reloadKey]);

  function retryLoad() {
    setLoadState("loading");
    setLoadError(null);
    setReloadKey((key) => key + 1);
  }

  // Aviso del navegador si hay transcripción o edición de nota sin guardar,
  // o una grabación en curso.
  const hasUnsaved =
    noteDirty || dictando || transcriptDraft.trim() !== savedTranscript.trim();
  useEffect(() => {
    if (!hasUnsaved) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsaved]);

  function applyStatus(nextStatus: string) {
    setEncounter((prev) => (prev ? { ...prev, status: nextStatus } : prev));
  }

  /** Paso 1 + 2 del flujo: guardar transcripción y pedir la nota al backend. */
  async function generarNota() {
    if (!encounterId || busy) return;
    const text = transcriptDraft.trim();
    if (!text) {
      setFlowError(CLINICAL_ERROR_MESSAGES.TRANSCRIPT_REQUIRED);
      return;
    }
    if (text.length > MAX_TRANSCRIPT_LENGTH) {
      setFlowError(CLINICAL_ERROR_MESSAGES.TRANSCRIPT_TOO_LONG);
      return;
    }
    if (note && noteDirty) {
      const confirmed = window.confirm(
        "Regenerar la nota reemplaza las ediciones que no hayas guardado. ¿Continuar?",
      );
      if (!confirmed) return;
    }

    setFlowError(null);
    try {
      if (text !== savedTranscript.trim()) {
        setPhase("saving_transcript");
        const saved = await saveClinicalTranscript(encounterId, text);
        setSavedTranscript(text);
        applyStatus(saved.status);
      }
      setPhase("generating");
      const generated = await generateClinicalNote(encounterId);
      setNote(generated.note_json);
      setNoteDirty(false);
      setNoteSaved(false);
      applyStatus(generated.status);
      setShowTranscriptPanel(false);
    } catch (error) {
      setFlowError(friendlyClinicalMessage(error));
    } finally {
      setPhase("idle");
    }
  }

  /** Paso final: guardar la nota revisada (deja el encounter en "completed"). */
  async function guardarNota() {
    if (!encounterId || !note || busy) return;
    setPhase("saving_note");
    setFlowError(null);
    try {
      const result = await saveEditedClinicalNote(encounterId, note);
      setNote(result.note_json);
      setNoteDirty(false);
      setNoteSaved(true);
      setAiExplanation(null);
      applyStatus(result.status);

      // Puente: espeja la consulta en el historial local (tabla `consultations`)
      // para que aparezca en la lista, el detalle del paciente, y pueda
      // firmarse/exportarse. Idempotente: re-guardar actualiza la misma fila.
      if (encounter) {
        upsertConsultation(
          encounterToConsultation({
            encounter: {
              id: encounterId,
              consultation_type: encounter.consultation_type,
              template_snapshot: encounter.template_snapshot,
              created_at: encounter.created_at,
            },
            note: result.note_json,
            patient,
            now: new Date().toISOString(),
          }),
        );
      }
    } catch (error) {
      setFlowError(friendlyClinicalMessage(error));
    } finally {
      setPhase("idle");
    }
  }

  function editarSeccion(key: string, content: string) {
    setNote((prev) => (prev ? updateNoteSectionContent(prev, key, content) : prev));
    setNoteDirty(true);
    setNoteSaved(false);
  }

  function editarResumen(summary: string) {
    setNote((prev) => (prev ? { ...prev, summary } : prev));
    setNoteDirty(true);
    setNoteSaved(false);
  }

  // Cada segmento final de la dictación se agrega al texto acumulado.
  // setState funcional: inmune a renders concurrentes durante la grabación.
  const appendFinal = (text: string) =>
    setTranscriptDraft((prev) =>
      prev.trim() ? `${prev.replace(/\s+$/, "")} ${text}` : text,
    );

  /**
   * Ajuste de la nota con IA. El backend calcula la propuesta sobre la ÚLTIMA
   * nota guardada del encounter y NO la persiste: aquí se aplica al estado
   * local marcándola como "cambios sin guardar" para que el médico revise y
   * guarde con el flujo normal.
   */
  async function pedirAjuste() {
    const instruction = aiInstruction.trim();
    if (!encounterId || !note || busy || !instruction) return;
    if (noteDirty) {
      const confirmed = window.confirm(
        "El ajuste se calcula sobre la última nota guardada y reemplazará tus cambios sin guardar. ¿Continuar?",
      );
      if (!confirmed) return;
    }
    setPhase("adjusting");
    setFlowError(null);
    setAiExplanation(null);
    try {
      const result = await adjustNoteWithAssistant({
        encounter_id: encounterId,
        instruction,
      });
      setNote(result.proposed_note_json);
      setNoteDirty(true);
      setNoteSaved(false);
      setAiInstruction("");
      setAiExplanation(result.explanation?.trim() || "Ajuste aplicado.");
    } catch (error) {
      setFlowError(friendlyClinicalMessage(error));
    } finally {
      setPhase("idle");
    }
  }

  if (!encounterId) return null;

  if (loadState === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <Loader2 size={36} className="animate-spin text-accent" />
        <p className="mt-4 text-sm text-muted">Cargando la consulta…</p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="mx-auto max-w-xl">
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-5 py-4 text-sm text-danger"
        >
          <p className="font-semibold">No pudimos cargar esta consulta.</p>
          <p className="mt-1">{loadError}</p>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={retryLoad}
            className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-deep hover:border-mist"
          >
            <RefreshCw size={15} /> Reintentar
          </button>
          <button
            type="button"
            onClick={() => router.push("/app/consultas/nueva")}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Iniciar una consulta nueva
          </button>
        </div>
      </div>
    );
  }

  const snapshot = encounter?.template_snapshot;
  const tipoLabel =
    TYPE_LABEL[encounter?.consultation_type ?? ""] ?? encounter?.consultation_type;
  const generateLabel = note ? "Regenerar nota" : "Generar nota clínica";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-deep">Consulta activa</h1>
          <p className="mt-1 text-sm text-muted">
            {tipoLabel} · Plantilla: {snapshot?.name ?? "—"}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${
            completed
              ? "bg-mint-soft text-success"
              : "bg-accent-soft text-accent-ink"
          }`}
        >
          {completed ? <CheckCircle2 size={15} /> : <FileText size={15} />}
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>

      {flowError ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{flowError}</span>
        </div>
      ) : null}

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          {/* Captura de la consulta: grabación con transcripción en vivo,
              con edición/pegado manual como alternativa siempre disponible. */}
          {showTranscriptPanel ? (
            <div className="rounded-lg border border-line bg-surface p-6">
              {!completed ? (
                <>
                  <DictationPanel
                    disabled={busy}
                    onAppendFinal={appendFinal}
                    onActiveChange={setDictando}
                  />
                  <p className="mt-2 text-xs text-muted">
                    También puedes escribir o pegar la transcripción manualmente.
                  </p>
                </>
              ) : null}

              <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted">
                Transcripción de la consulta
                <textarea
                  value={transcriptDraft}
                  onChange={(e) => setTranscriptDraft(e.target.value)}
                  disabled={completed || busy}
                  readOnly={dictando}
                  rows={10}
                  placeholder="Paciente consulta por…"
                  className="mt-2 w-full resize-y rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm font-normal normal-case tracking-normal leading-relaxed text-ink outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-pearl"
                />
              </label>
              <div className="mt-1 flex items-center justify-between text-xs text-muted">
                <span>
                  {completed
                    ? "La consulta está completada; la transcripción ya no se puede modificar."
                    : "La transcripción queda guardada en la consulta para trazabilidad."}
                </span>
                <span>{transcriptDraft.trim().length.toLocaleString("es-CO")} caracteres</span>
              </div>

              {!completed ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void generarNota()}
                    disabled={busy || dictando || !transcriptDraft.trim()}
                    title={dictando ? "Detén la grabación antes de generar la nota" : undefined}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {phase === "saving_transcript" ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Guardando
                        transcripción…
                      </>
                    ) : phase === "generating" ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Generando nota
                        clínica…
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} /> {generateLabel}
                      </>
                    )}
                  </button>
                  {note ? (
                    <button
                      type="button"
                      onClick={() => setShowTranscriptPanel(false)}
                      className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-deep hover:border-mist"
                    >
                      Volver a la nota
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Nota clínica estructurada */}
          {note ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold text-deep">
                  Nota clínica
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {!completed && !showTranscriptPanel ? (
                    <button
                      type="button"
                      onClick={() => setShowTranscriptPanel(true)}
                      disabled={busy}
                      className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-deep hover:border-mist disabled:opacity-60"
                    >
                      Editar transcripción
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void guardarNota()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {phase === "saving_note" ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Guardando nota…
                      </>
                    ) : (
                      <>
                        <Save size={15} /> Guardar nota
                      </>
                    )}
                  </button>
                </div>
              </div>

              {noteSaved && !noteDirty ? (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-3 py-1.5 text-xs font-semibold text-success">
                    <CheckCircle2 size={13} /> Nota guardada en tu historial.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push(`/app/consultas/${encounterId}`)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-deep hover:border-mist"
                  >
                    Ver consulta y firmar <ArrowRight size={13} />
                  </button>
                </div>
              ) : noteDirty ? (
                <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1.5 text-xs font-semibold text-warning">
                  Cambios sin guardar
                </p>
              ) : (
                <p className="mb-3 text-xs text-muted">
                  Revisa y edita las secciones; al guardar, la consulta queda
                  completada.
                </p>
              )}

              <EncounterNote
                note={note}
                editable={!busy}
                onChangeSection={editarSeccion}
                onChangeSummary={editarResumen}
              />

              {/* Ajuste de la nota con IA: la propuesta se aplica localmente y
                  el médico la revisa y guarda (nunca se persiste sola). */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void pedirAjuste();
                }}
                className="mt-3 flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 shadow-[var(--shadow-sm)]"
              >
                <Sparkles size={16} className="shrink-0 text-accent" />
                <input
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  placeholder="Pídale a Miracle un ajuste de la nota…"
                  aria-label="Instrucción de ajuste para la IA"
                  disabled={busy}
                  maxLength={2000}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={busy || !aiInstruction.trim()}
                  aria-label="Pedir ajuste a la IA"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {phase === "adjusting" ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                </button>
              </form>

              {aiExplanation ? (
                <div
                  role="status"
                  className="mt-2 flex items-start gap-2 rounded-md border border-accent/20 bg-accent-soft/50 px-3.5 py-2.5 text-sm text-accent-ink"
                >
                  <Sparkles size={15} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>Propuesta de la IA aplicada — revisa y guarda.</strong>{" "}
                    {aiExplanation}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {!note && !showTranscriptPanel ? (
            <div className="rounded-lg border border-line bg-surface p-6 text-sm text-muted">
              Aún no hay nota generada para esta consulta.
            </div>
          ) : null}
        </div>

        {/* Contexto de la consulta */}
        <aside className="h-fit space-y-4">
          <div className="rounded-lg border border-line bg-surface p-5">
            {patient ? (
              <PatientHeader patient={patient} />
            ) : (
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ice font-semibold text-muted">
                  ?
                </span>
                <div className="text-sm font-semibold text-deep">
                  Paciente sin identificar
                </div>
              </div>
            )}
            {patient ? (
              <dl className="mt-4 space-y-3 text-sm">
                <ClinicalRow label="Antecedentes" values={patient.antecedentes} />
                <ClinicalRow label="Alergias" values={patient.alergias} />
                <ClinicalRow label="Medicamentos" values={patient.medicamentos} />
              </dl>
            ) : null}
          </div>

          <div className="rounded-lg border border-line bg-surface p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Plantilla
            </div>
            <div className="mt-1 font-medium text-deep">{snapshot?.name ?? "—"}</div>
            {snapshot?.sections?.length ? (
              <p className="mt-1 text-xs text-muted">
                {snapshot.sections.length} secciones · congelada al iniciar la
                consulta
              </p>
            ) : null}
          </div>

          <p className="flex items-start gap-2 px-1 text-xs text-muted">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />
            La nota se genera en el servidor clínico de Miracle con la plantilla
            congelada de esta consulta.
          </p>
        </aside>
      </div>
    </div>
  );
}

function ClinicalRow({ label, values }: { label: string; values?: string[] }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-ink-soft">
        {values && values.length ? values.join(", ") : "—"}
      </dd>
    </div>
  );
}

export default function EnVivoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 size={32} className="animate-spin text-accent" />
        </div>
      }
    >
      <ConsultaActivaInner />
    </Suspense>
  );
}
