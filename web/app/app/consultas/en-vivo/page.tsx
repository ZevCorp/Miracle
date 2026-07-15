"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCopy,
  Download,
  Ellipsis,
  FileText,
  History,
  LayoutTemplate,
  LockKeyhole,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { useStore } from "@/app/app/providers";
import { PatientHeader } from "@/components/app/PatientHeader";
import { EncounterNote } from "@/components/app/EncounterNote";
import { DictationPanel } from "@/components/app/DictationPanel";
import { MedicalChat } from "@/components/app/MedicalChat";
import { PlanDischargePanel } from "@/components/app/PlanDischargePanel";
import { ClinicalTemplatePicker } from "@/components/app/ClinicalTemplatePicker";
import { encounterToConsultation } from "@/lib/clinical/encounter-to-consultation";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/lib/mock";
import {
  adjustNoteWithAssistant,
  ensureClinicalDischarge,
  friendlyClinicalMessage,
  generateClinicalNote,
  getClinicalEncounter,
  getClinicalTemplates,
  regenerateClinicalEncounterWithTemplate,
  savePrivateEncounterNotes,
  saveClinicalTranscript,
  saveEditedClinicalNote,
  updateClinicalEncounterPatient,
  updateNoteSectionContent,
  CLINICAL_ERROR_MESSAGES,
  MAX_TRANSCRIPT_LENGTH,
  type ClinicalEncounter,
  type ClinicalDischarge,
  type ClinicalNoteJson,
  type ClinicalTemplate,
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
  | "saving_private"
  | "regenerating"
  | "adjusting";

type ReviewView = "summary" | "note" | "plan" | "transcript" | "private" | "audit";

const PHASE_LABEL: Record<Exclude<FlowPhase, "idle" | "saving_private">, string> = {
  saving_transcript: "Guardando la transcripción",
  generating: "Generando la nota clínica",
  saving_note: "Guardando la nota revisada",
  regenerating: "Creando una nueva revisión",
  adjusting: "Aplicando el ajuste solicitado",
};

function ConsultaActivaInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const encounterId = sp.get("encounter");
  const pacienteId = sp.get("paciente") ?? "";
  const appointmentId = sp.get("appointment") ?? "";
  const startRecordingOnArrival = sp.get("record") === "1";
  const { patients, addPatient, getPatient, upsertConsultation, showToast } = useStore();
  const [associatedPatientId, setAssociatedPatientId] = useState(pacienteId || null);
  const [patientAssociationOpen, setPatientAssociationOpen] = useState(false);
  const patient = getPatient(associatedPatientId);

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
  const [finishAfterRecording, setFinishAfterRecording] = useState(false);
  const [reviewView, setReviewView] = useState<ReviewView>("summary");
  const [voiceEditingSection, setVoiceEditingSection] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [templates, setTemplates] = useState<ClinicalTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateLoading, setTemplateLoading] = useState(false);

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
        if (data.patient_id) setAssociatedPatientId(data.patient_id);
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

  async function associatePatient(nextPatientId: string | null) {
    if (!encounterId) return;
    try {
      const updated = await updateClinicalEncounterPatient(encounterId, nextPatientId);
      setEncounter(updated);
      setAssociatedPatientId(updated.patient_id);
      setPatientAssociationOpen(false);
      showToast(nextPatientId ? "Paciente asociado a la consulta." : "Consulta sin paciente asociado.", "success");
    } catch (error) {
      setFlowError(friendlyClinicalMessage(error));
    }
  }

  async function createAndAssociatePatient(input: { nombre: string; documento?: string; edad?: number; sexo?: "F" | "M" }) {
    const created = addPatient(input);
    await associatePatient(created.id);
  }

  async function completeLinkedAppointment() {
    if (!appointmentId || !encounterId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("appointments")
      .update({ estado: "atendida" })
      .eq("id", appointmentId)
      .eq("clinical_encounter_id", encounterId);
    if (error) console.error("[agenda] complete encounter", error.message);
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
      // La transcripción sigue visible junto al resumen: permite revisarla y
      // copiarla incluso después de terminar la grabación.
      setShowTranscriptPanel(true);
      setReviewView("summary");
    } catch (error) {
      setFlowError(friendlyClinicalMessage(error));
    } finally {
      setPhase("idle");
    }
  }

  // El motor puede emitir el último segmento durante stop(). Esperamos una
  // fracción de segundo para incluirlo antes de guardar y generar el resumen.
  useEffect(() => {
    if (
      !finishAfterRecording ||
      dictando ||
      busy ||
      !transcriptDraft.trim()
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      setFinishAfterRecording(false);
      void generarNota();
    }, 350);
    return () => window.clearTimeout(timer);
    // `generarNota` usa el estado vigente de este render; incluirlo como
    // dependencia recrearía el temporizador en cada edición de la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishAfterRecording, dictando, busy, transcriptDraft]);

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
      void completeLinkedAppointment();
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

  function editarEgreso(discharge: ClinicalDischarge) {
    setNote((prev) => (prev ? { ...prev, discharge } : prev));
    setNoteDirty(true);
    setNoteSaved(false);
  }

  // Cada segmento final de la dictación se agrega al texto acumulado.
  // setState funcional: inmune a renders concurrentes durante la grabación.
  const appendFinal = (text: string) =>
    setTranscriptDraft((prev) =>
      prev.trim() ? `${prev.replace(/\s+$/, "")} ${text}` : text,
    );

  function copyToClipboard(text: string, label: string) {
    if (!text.trim()) return;
    void navigator.clipboard
      .writeText(text)
      .then(() => showToast(`${label} copiado al portapapeles.`, "success"))
      .catch(() => showToast(`No se pudo copiar ${label.toLowerCase()}.`, "warning"));
  }

  function noteAsPlainText(noteJson: ClinicalNoteJson) {
    const discharge = ensureClinicalDischarge(noteJson.discharge);
    const plan = [
      ...discharge.plan.medications.map((item) =>
        [item.name, item.dose, item.route, item.frequency, item.duration, item.instructions]
          .filter(Boolean)
          .join(" · "),
      ),
      ...discharge.plan.non_pharmacological.map((item) => item.text),
      ...discharge.plan.follow_up.map((item) => item.text),
    ].filter(Boolean);
    return [
      `Resumen\n${noteJson.summary}`,
      ...noteJson.sections.map((section) => `${section.label}\n${section.content}`),
      `Plan terapéutico\n${plan.join("\n") || "Sin información documentada."}`,
      `Recomendaciones\n${discharge.recommendations.map((item) => item.text).join("\n") || "Sin información documentada."}`,
      `Signos de alarma\n${discharge.alarm_signs.map((item) => item.text).join("\n") || "Sin información documentada."}`,
    ].join("\n\n");
  }

  async function guardarNotasPrivadas(content: string) {
    if (!encounterId) return;
    setPhase("saving_private");
    try {
      const result = await savePrivateEncounterNotes(encounterId, content);
      setEncounter((current) =>
        current ? { ...current, private_notes: result.private_notes } : current,
      );
    } catch (error) {
      showToast(friendlyClinicalMessage(error), "warning");
    } finally {
      setPhase("idle");
    }
  }

  function descargarTextoPlano() {
    if (!note) return;
    const blob = new Blob([noteAsPlainText(note)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `miracle-nota-${encounterId ?? "consulta"}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Texto clínico preparado para descargar.", "success");
  }

  function descargarPdf() {
    if (!note) return;
    const safe = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />");
    const sections = noteAsPlainText(note).split("\n\n").map((block) => {
      const [title, ...content] = block.split("\n");
      return `<section><h2>${safe(title)}</h2><p>${safe(content.join("\n"))}</p></section>`;
    }).join("");
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) {
      showToast("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo de nuevo.", "warning");
      return;
    }
    popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Nota clínica Miracle</title><style>body{font-family:Arial,sans-serif;color:#14233d;margin:36px;line-height:1.55}h1{font-size:22px;margin:0 0 6px}h2{font-size:15px;margin:24px 0 6px;border-top:1px solid #dbe4f2;padding-top:16px}p{margin:0;font-size:12px}.meta{color:#546782;font-size:11px}@media print{body{margin:22px}}</style></head><body><h1>Nota clínica · Miracle</h1><p class="meta">${safe(snapshot?.name ?? "Plantilla clínica")} · ${safe(tipoLabel ?? "Consulta")}</p>${sections}</body></html>`);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 250);
  }

  async function abrirRegeneracion() {
    setActionsOpen(false);
    setRegenerateOpen(true);
    if (templates.length) return;
    setTemplateLoading(true);
    try {
      const loaded = await getClinicalTemplates({ specialty: snapshot?.specialty });
      setTemplates(loaded);
      setSelectedTemplateId(loaded.find((item) => item.id !== snapshot?.template_id)?.id ?? "");
    } catch (error) {
      setFlowError(friendlyClinicalMessage(error));
    } finally {
      setTemplateLoading(false);
    }
  }

  async function regenerarConPlantilla() {
    if (!encounterId || !selectedTemplateId || busy) return;
    if (!window.confirm("Se creará una nueva revisión con la misma transcripción. La nota original se conservará en auditoría.")) return;
    setPhase("regenerating");
    setFlowError(null);
    try {
      const result = await regenerateClinicalEncounterWithTemplate(encounterId, selectedTemplateId);
      router.push(`/app/consultas/en-vivo?encounter=${encodeURIComponent(result.encounter.id)}`);
    } catch (error) {
      setFlowError(friendlyClinicalMessage(error));
    } finally {
      setPhase("idle");
    }
  }

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

  async function applyVoiceInstruction(sectionTitle: string, instruction: string) {
    if (!encounterId || !note || busy) return;
    if (noteDirty) {
      const confirmed = window.confirm(
        "El cambio por voz se calcula sobre la última nota guardada y puede reemplazar ediciones sin guardar. ¿Continuar?",
      );
      if (!confirmed) return;
    }
    setPhase("adjusting");
    setFlowError(null);
    setAiExplanation(null);
    setVoiceEditingSection(sectionTitle);
    try {
      const result = await adjustNoteWithAssistant({
        encounter_id: encounterId,
        instruction: `En la sección "${sectionTitle}", aplica esta instrucción dictada por el médico: "${instruction}". Modifica únicamente lo necesario para cumplirla y conserva el resto de la nota.`,
      });
      setNote(result.proposed_note_json);
      setNoteDirty(true);
      setNoteSaved(false);
      setAiExplanation(result.explanation?.trim() || "Cambio dictado aplicado.");
    } catch (error) {
      setFlowError(friendlyClinicalMessage(error));
    } finally {
      setVoiceEditingSection(null);
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
  const currentReviewView: ReviewView = note ? reviewView : "transcript";

  return (
    <div className="app-page max-w-5xl pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="app-page-heading">
          <p className="app-page-kicker">Captura clínica</p>
          <h1 className="app-page-title">Consulta activa</h1>
          <p className="mt-1 text-sm text-muted">
            {tipoLabel} · Plantilla: {snapshot?.name ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${completed ? "bg-mint-soft text-success" : "bg-accent-soft text-accent-ink"}`}>
            {completed ? <CheckCircle2 size={15} /> : <FileText size={15} />}
            {STATUS_LABEL[status] ?? status}
          </span>
          {note ? <div className="relative">
            <button type="button" onClick={() => setActionsOpen((open) => !open)} aria-expanded={actionsOpen} aria-label="Abrir acciones de la nota" title="Abrir descargas y opciones de regeneración" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted hover:border-mist hover:text-deep"><Ellipsis size={18} /></button>
            {actionsOpen ? <div role="menu" className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lg)]">
              <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); descargarPdf(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-deep hover:bg-ice-soft"><FileText size={16} className="text-accent" /> Descargar PDF clínico</button>
              <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); descargarTextoPlano(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-deep hover:bg-ice-soft"><Download size={16} className="text-accent" /> Descargar texto plano</button>
              <div className="my-1 border-t border-line" />
              <button type="button" role="menuitem" onClick={() => void abrirRegeneracion()} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-deep hover:bg-ice-soft"><LayoutTemplate size={16} className="text-accent" /> Cambiar plantilla y regenerar</button>
            </div> : null}
          </div> : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setPatientAssociationOpen(true)}
        className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl border border-line bg-surface px-3.5 text-left md:hidden"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ice text-accent"><UserPlus size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-deep">{patient?.nombre ?? "Paciente sin identificar"}</span>
          <span className="block text-[13px] text-muted">{patient ? "Toca para cambiar" : "Asociar o crear paciente"}</span>
        </span>
        <ArrowRight size={16} className="shrink-0 text-muted" />
      </button>

      {flowError ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{flowError}</span>
        </div>
      ) : null}

      {phase !== "idle" && phase !== "saving_private" ? (
        <div role="status" aria-live="polite" className="mt-3 flex items-center gap-3 rounded-xl border border-accent/25 bg-accent-soft/45 px-4 py-3 text-sm font-semibold text-accent-ink">
          <Loader2 size={17} className="shrink-0 animate-spin" />
          <span>{PHASE_LABEL[phase]}… Mantén esta pantalla abierta.</span>
        </div>
      ) : null}

      {note ? (
        <ReviewNavigation
          active={currentReviewView}
          onChange={(next) => {
            if (next === "transcript") setShowTranscriptPanel(true);
            setReviewView(next);
          }}
        />
      ) : null}

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {/* Captura de la consulta: grabación con transcripción en vivo,
              con edición/pegado manual como alternativa siempre disponible. */}
          {currentReviewView === "transcript" && showTranscriptPanel ? (
            <div className="rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-xs)] sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold text-deep">
                    Transcripción en vivo
                  </h2>
                </div>
                {dictando ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-danger" /> Grabando
                  </span>
                ) : null}
              </div>
              {!completed ? (
                <>
                  <DictationPanel
                    disabled={busy}
                    onAppendFinal={appendFinal}
                    onActiveChange={setDictando}
                    autoStart={startRecordingOnArrival && !completed}
                    onRecordingStopped={() => setFinishAfterRecording(true)}
                    finishLabel="Finalizar y generar nota"
                  />
                  <p className="mt-2 text-xs text-muted">
                    También puedes escribir o pegar la transcripción manualmente.
                  </p>
                </>
              ) : null}

              <label className="mt-4 block text-[12px] font-semibold uppercase tracking-wide text-muted">
                Transcripción de la consulta
                <textarea
                  value={transcriptDraft}
                  onChange={(e) => setTranscriptDraft(e.target.value)}
                  disabled={completed || busy}
                  readOnly={dictando}
                  rows={10}
                  placeholder="Paciente consulta por…"
                  className="mt-2 w-full resize-y rounded-md border border-line bg-field px-3.5 py-2.5 text-sm font-normal normal-case tracking-normal leading-relaxed text-ink outline-none transition-colors focus:border-accent disabled:cursor-not-allowed read-only:bg-pearl"
                />
              </label>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
                <span>
                  {completed
                    ? "La consulta está completada; la transcripción ya no se puede modificar."
                    : "Puedes corregir el texto antes de generar la nota."}
                </span>
                <span className="flex items-center gap-2">
                  {transcriptDraft.trim().length.toLocaleString("es-CO")} caracteres
                  <button
                    type="button"
                    onClick={() => copyToClipboard(transcriptDraft, "Transcripción")}
                    disabled={!transcriptDraft.trim()}
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 font-semibold text-deep hover:border-mist disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ClipboardCopy size={12} /> Copiar
                  </button>
                </span>
              </div>

              {!completed ? (
                <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                  <button
                    type="button"
                    onClick={() => void generarNota()}
                    disabled={busy || dictando || !transcriptDraft.trim()}
                    title={dictando ? "Detén la grabación antes de generar la nota" : undefined}
                    className="clinical-primary min-h-12 w-full px-5 py-2.5 sm:w-auto"
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
                      onClick={() => {
                        setShowTranscriptPanel(false);
                        setReviewView("note");
                      }}
                      className="min-h-12 w-full rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-deep hover:border-mist sm:w-auto sm:rounded-full"
                    >
                      Volver a la nota
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {!note && encounterId ? (
            <PrivateEncounterNotes key={encounterId} initialNotes={encounter?.private_notes ?? ""} saving={phase === "saving_private"} onSave={guardarNotasPrivadas} />
          ) : null}

          {note && currentReviewView === "summary" ? (
            <ReviewSummary
              note={note}
              onCopy={() => copyToClipboard(note.summary, "Resumen")}
              onOpenFullNote={() => setReviewView("note")}
            />
          ) : null}

          {note && currentReviewView === "plan" ? (
            <PlanDischargePanel
              discharge={ensureClinicalDischarge(note.discharge)}
              editable={!busy}
              onChange={editarEgreso}
              onCopy={copyToClipboard}
            />
          ) : null}

          {note && currentReviewView === "private" && encounterId ? (
            <PrivateEncounterNotes key={encounterId} initialNotes={encounter?.private_notes ?? ""} saving={phase === "saving_private"} onSave={guardarNotasPrivadas} />
          ) : null}

          {note && currentReviewView === "audit" ? (
            <AuditPanel encounter={encounter} onOpenEncounter={(id) => router.push(`/app/consultas/en-vivo?encounter=${encodeURIComponent(id)}`)} />
          ) : null}

          {/* Nota clínica estructurada */}
          {note && currentReviewView === "note" ? (
            <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-semibold text-deep">
                    Nota clínica
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                  {!completed ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowTranscriptPanel(true);
                        setReviewView("transcript");
                      }}
                      disabled={busy}
                      className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-deep hover:border-mist disabled:opacity-60"
                    >
                      Editar transcripción
                    </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => copyToClipboard(note.summary, "Resumen")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-sm font-semibold text-deep hover:border-mist"
                    >
                      <ClipboardCopy size={14} /> Copiar resumen
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(noteAsPlainText(note), "Nota clínica")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-sm font-semibold text-deep hover:border-mist"
                    >
                      <ClipboardCopy size={14} /> Copiar nota
                    </button>
                    <button
                    type="button"
                    onClick={() => void guardarNota()}
                    disabled={busy}
                    className="hidden items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
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
                onVoiceInstruction={applyVoiceInstruction}
                voiceProcessingSection={voiceEditingSection}
              />

              <div className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-30 rounded-2xl border border-line bg-surface/95 p-2.5 shadow-[var(--shadow-xl)] backdrop-blur-xl sm:hidden">
                {noteSaved && !noteDirty ? (
                  <button type="button" onClick={() => router.push(`/app/consultas/${encounterId}`)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white">
                    Ver consulta y firmar <ArrowRight size={16} />
                  </button>
                ) : (
                  <button type="button" onClick={() => void guardarNota()} disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60">
                    {phase === "saving_note" ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {phase === "saving_note" ? "Guardando nota…" : noteDirty ? "Guardar cambios" : "Guardar nota"}
                  </button>
                )}
              </div>

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

        {/* El asistente permanece disponible durante toda la consulta. */}
        <aside className="h-fit space-y-4 xl:sticky xl:top-20 xl:self-start">
          <MedicalChat embedded />
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
            <button
              type="button"
              onClick={() => setPatientAssociationOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-accent/25 bg-accent-soft/45 px-3 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-soft"
            >
              <UserPlus size={15} />
              {patient ? "Cambiar paciente" : "Asociar o crear paciente"}
            </button>
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

      {patientAssociationOpen ? (
        <PatientAssociationDialog
          patients={patients}
          selectedPatientId={associatedPatientId}
          onClose={() => setPatientAssociationOpen(false)}
          onSelect={associatePatient}
          onCreate={createAndAssociatePatient}
        />
      ) : null}

      {regenerateOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay p-0 backdrop-blur-[1px] sm:items-center sm:p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="regenerate-title" className="mobile-bottom-sheet w-full max-w-lg rounded-t-3xl border border-b-0 border-line bg-surface p-4 shadow-[var(--shadow-lg)] sm:rounded-2xl sm:border-b sm:p-6">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><LayoutTemplate size={19} /></span>
              <div><h2 id="regenerate-title" className="font-display text-lg font-semibold text-deep">Cambiar plantilla y regenerar</h2><p className="mt-1 text-sm leading-relaxed text-muted">Se reutilizará la transcripción. Miracle creará una nueva revisión enlazada y conservará esta nota en auditoría.</p></div>
            </div>
            <div className="mt-5 text-sm font-semibold text-deep">Nueva plantilla
              {!templateLoading && templates.length ? <ClinicalTemplatePicker templates={templates.filter((template) => template.id !== snapshot?.template_id)} value={selectedTemplateId} onChange={setSelectedTemplateId} disabled={busy} /> : null}
            </div>
            {templateLoading ? <p className="mt-3 flex items-center gap-2 text-xs text-muted"><Loader2 size={14} className="animate-spin" /> Cargando plantillas disponibles…</p> : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setRegenerateOpen(false)} disabled={busy} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-deep hover:border-mist disabled:opacity-60">Cancelar</button><button type="button" onClick={() => void regenerarConPlantilla()} disabled={!selectedTemplateId || busy || templateLoading} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">{phase === "regenerating" ? <Loader2 size={15} className="animate-spin" /> : <LayoutTemplate size={15} />} Crear revisión</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PatientAssociationDialog({
  patients,
  selectedPatientId,
  onClose,
  onSelect,
  onCreate,
}: {
  patients: Patient[];
  selectedPatientId: string | null;
  onClose: () => void;
  onSelect: (patientId: string | null) => Promise<void>;
  onCreate: (input: { nombre: string; documento?: string; edad?: number; sexo?: "F" | "M" }) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"F" | "M" | "">("");
  const [saving, setSaving] = useState(false);

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return patients.slice(0, 7);
    return patients.filter((patient) =>
      patient.nombre.toLocaleLowerCase().includes(normalized) || patient.documento.toLocaleLowerCase().includes(normalized),
    ).slice(0, 7);
  }, [patients, query]);

  async function selectPatient(patientId: string | null) {
    setSaving(true);
    await onSelect(patientId);
    setSaving(false);
  }

  async function createPatient() {
    const parsedAge = Number.parseInt(age, 10);
    if (!name.trim()) return;
    setSaving(true);
    await onCreate({
      nombre: name.trim(),
      documento: document.trim() || undefined,
      edad: Number.isFinite(parsedAge) ? parsedAge : undefined,
      sexo: sex || undefined,
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay p-0 backdrop-blur-[1px] sm:items-center sm:p-4">
      <button type="button" tabIndex={-1} aria-label="Cerrar asociación de paciente" onClick={onClose} className="absolute inset-0 cursor-default" />
      <section role="dialog" aria-modal="true" aria-labelledby="patient-association-title" className="mobile-bottom-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border border-b-0 border-line bg-surface shadow-[var(--shadow-lg)] sm:rounded-2xl sm:border-b">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><UserRound size={18} /></span><div><h2 id="patient-association-title" className="text-lg font-semibold text-deep">Asociar paciente</h2><p className="mt-0.5 text-sm text-muted">Puedes continuar sin identificarlo.</p></div></div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-md p-1 text-muted hover:bg-ice-soft hover:text-deep"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 focus-within:border-accent"><Search size={16} className="text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o documento" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" /></div>
          <ul className="mt-3 overflow-hidden rounded-xl border border-line">
            {matches.length ? matches.map((patient) => <li key={patient.id} className="border-b border-line last:border-b-0"><button type="button" disabled={saving} onClick={() => void selectPatient(patient.id)} className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-ice-soft disabled:opacity-60"><span><span className="block text-sm font-semibold text-deep">{patient.nombre}</span><span className="block text-xs text-muted">{patient.documento || "Datos por completar"}</span></span>{patient.id === selectedPatientId ? <CheckCircle2 size={17} className="text-success" /> : null}</button></li>) : <li className="px-3.5 py-3 text-sm text-muted">No hay pacientes coincidentes.</li>}
          </ul>
          <button type="button" onClick={() => setCreating((value) => !value)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"><UserPlus size={16} /> {creating ? "Ocultar creación" : "Crear paciente ahora"}</button>
          {creating ? <div className="mt-3 grid gap-3 rounded-xl border border-dashed border-accent/35 bg-ice-soft p-4 sm:grid-cols-2"><label className="text-sm font-medium text-deep sm:col-span-2">Nombre completo<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line bg-field px-3 py-2 text-sm outline-none focus:border-accent" /></label><label className="text-sm font-medium text-deep">Documento<input value={document} onChange={(event) => setDocument(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line bg-field px-3 py-2 text-sm outline-none focus:border-accent" /></label><label className="text-sm font-medium text-deep">Edad<input value={age} onChange={(event) => setAge(event.target.value)} inputMode="numeric" className="mt-1.5 w-full rounded-lg border border-line bg-field px-3 py-2 text-sm outline-none focus:border-accent" /></label><label className="text-sm font-medium text-deep">Sexo<select value={sex} onChange={(event) => setSex(event.target.value as "F" | "M" | "")} className="mt-1.5 w-full rounded-lg border border-line bg-field px-3 py-2 text-sm outline-none focus:border-accent"><option value="">Sin registrar</option><option value="F">Femenino</option><option value="M">Masculino</option></select></label><div className="flex items-end justify-end"><button type="button" disabled={!name.trim() || saving} onClick={() => void createPatient()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Crear y asociar</button></div></div> : null}
        </div>
        <div className="flex justify-between gap-3 border-t border-line px-5 py-3"><button type="button" disabled={saving} onClick={() => void selectPatient(null)} className="text-sm font-semibold text-muted hover:text-deep">Continuar sin paciente</button><button type="button" onClick={onClose} className="rounded-lg border border-line px-3.5 py-2 text-sm font-semibold text-deep hover:border-mist">Cancelar</button></div>
      </section>
    </div>
  );
}

function ReviewNavigation({
  active,
  onChange,
}: {
  active: ReviewView;
  onChange: (view: ReviewView) => void;
}) {
  const items: { id: ReviewView; label: string; helper: string }[] = [
    { id: "summary", label: "Resumen", helper: "Lectura rápida" },
    { id: "note", label: "Nota clínica", helper: "Revisar y editar" },
    { id: "plan", label: "Plan y egreso", helper: "Indicaciones de salida" },
    { id: "transcript", label: "Transcripción", helper: "Fuente original" },
    { id: "private", label: "Notas privadas", helper: "Solo para ti" },
    { id: "audit", label: "Auditoría", helper: "Versiones y origen" },
  ];

  return (
    <nav aria-label="Vistas de la consulta" className="mt-4 rounded-lg border border-line bg-surface p-1.5 shadow-[var(--shadow-xs)] sm:mt-5">
      <div className="grid grid-cols-2 gap-1 sm:flex">
        {items.map((item) => {
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-current={selected ? "page" : undefined}
              className={`min-w-0 rounded-md px-3 py-2 text-left transition-colors sm:px-4 ${
                selected
                  ? "bg-night text-white shadow-sm"
                  : "text-ink-soft hover:bg-ice-soft hover:text-deep"
              }`}
            >
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className={`hidden text-[12px] sm:block ${selected ? "text-sidebar-muted" : "text-muted"}`}>
                {item.helper}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ReviewSummary({
  note,
  onCopy,
  onOpenFullNote,
}: {
  note: ClinicalNoteJson;
  onCopy: () => void;
  onOpenFullNote: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-xs)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-accent-soft/40 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-ink">
            Cierre de consulta
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-deep">Resumen clínico</h2>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-surface px-3.5 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-soft"
        >
          <ClipboardCopy size={14} /> Copiar
        </button>
      </div>
      <div className="px-5 py-5">
        <p className="whitespace-pre-wrap text-[1.02rem] leading-relaxed text-ink">
          {note.summary.trim() || "La nota no contiene un resumen todavía."}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-xs text-muted">
            {note.sections.length} secciones estructuradas para revisar antes de guardar.
          </span>
          <button
            type="button"
            onClick={onOpenFullNote}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Revisar nota completa <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </section>
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

function AuditPanel({ encounter, onOpenEncounter }: { encounter: ClinicalEncounter | null; onOpenEncounter: (id: string) => void }) {
  const created = encounter?.created_at ? new Date(encounter.created_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : "Fecha no disponible";
  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow-xs)] sm:p-6">
      <div className="flex items-start gap-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ice text-accent"><History size={18} /></span><div><h2 className="font-display text-lg font-semibold text-deep">Auditoría de la consulta</h2><p className="mt-0.5 text-sm text-muted">Trazabilidad de la fuente clínica y sus revisiones.</p></div></div>
      <ol className="mt-6 border-l border-line pl-5">
        <li className="relative pb-5"><span className="absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-surface bg-accent" /><p className="text-sm font-semibold text-deep">Revisión actual</p><p className="mt-1 text-sm text-muted">Creada {created}. Usa el snapshot de plantilla que figura en esta consulta.</p></li>
        {encounter?.supersedes_encounter_id ? <li className="relative"><span className="absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-surface bg-mist" /><p className="text-sm font-semibold text-deep">Reemplaza una revisión anterior</p><button type="button" onClick={() => onOpenEncounter(encounter.supersedes_encounter_id!)} className="mt-1 text-sm font-semibold text-accent hover:underline">Abrir versión anterior</button></li> : null}
        {encounter?.replaced_by_encounter_id ? <li className="relative"><span className="absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-surface bg-mint" /><p className="text-sm font-semibold text-deep">Existe una revisión posterior</p><button type="button" onClick={() => onOpenEncounter(encounter.replaced_by_encounter_id!)} className="mt-1 text-sm font-semibold text-accent hover:underline">Abrir versión nueva</button></li> : null}
      </ol>
    </section>
  );
}

/** Notas del médico: persistidas por encounter y excluidas de prompts y descargas. */
function PrivateEncounterNotes({ initialNotes, saving, onSave }: { initialNotes: string; saving: boolean; onSave: (content: string) => Promise<void> }) {
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    if (notes === initialNotes) return;
    const timer = window.setTimeout(() => { void onSave(notes); }, 650);
    return () => window.clearTimeout(timer);
  }, [initialNotes, notes, onSave]);

  function copyNotes() {
    if (!notes.trim()) return;
    void navigator.clipboard.writeText(notes);
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-[var(--shadow-xs)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-ice text-accent">
            <LockKeyhole size={15} />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-deep">Notas privadas</h2>
            <p className="mt-0.5 text-xs text-muted">
              Para datos que no quieres decir en voz alta. No se envían al asistente.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={copyNotes}
          disabled={!notes.trim()}
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-deep hover:border-mist disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ClipboardCopy size={13} /> Copiar
        </button>
      </div>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={4}
        placeholder="Escribe aquí observaciones privadas de la cita..."
        aria-label="Notas privadas de la consulta"
        className="mt-4 w-full resize-y rounded-md border border-line bg-field px-3.5 py-3 text-sm leading-relaxed outline-none transition-colors focus:border-accent"
      />
      <p className="mt-2 text-xs text-muted">{saving ? "Guardando de forma privada…" : "Se guardan de forma privada en esta consulta. No se envían al asistente ni se incluyen en descargas."}</p>
    </section>
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
