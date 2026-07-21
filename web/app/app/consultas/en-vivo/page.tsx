"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useUnsavedChangesGuard } from "@/components/app/UnsavedChangesProvider";
import { PatientHeader } from "@/components/app/PatientHeader";
import { EncounterNote } from "@/components/app/EncounterNote";
import { DictationPanel } from "@/components/app/DictationPanel";
import { MedicalChat } from "@/components/app/MedicalChat";
import { PlanDischargePanel } from "@/components/app/PlanDischargePanel";
import { ClinicalTemplatePicker } from "@/components/app/ClinicalTemplatePicker";
import { encounterToConsultation } from "@/lib/clinical/encounter-to-consultation";
import { buildRedactor } from "@/lib/privacy/redact";
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
  // `record=1` se captura UNA sola vez al montar y luego se limpia de la URL:
  // si quedara, cada remontaje del panel (p. ej. volver a la pestaña
  // Transcripción) reencendería el micrófono sin gesto del médico.
  const [autoStartOnArrival] = useState(() => sp.get("record") === "1");
  const {
    patients,
    addPatientAsync,
    getPatient,
    getConsultation,
    upsertConsultation,
    showToast,
  } = useStore();
  const [associatedPatientId, setAssociatedPatientId] = useState(pacienteId || null);
  const [patientAssociationOpen, setPatientAssociationOpen] = useState(false);
  const patient = getPatient(associatedPatientId);

  // De-identificación: tapa nombre/documento del paciente registrado antes de
  // que el texto salga hacia el backend (y el LLM) y los restaura al mostrar
  // la nota. Ver lib/privacy/redact.ts.
  const redactor = useMemo(
    () =>
      buildRedactor(
        patient
          ? { nombre: patient.nombre, documento: patient.documento }
          : null,
      ),
    [patient],
  );

  // La consulta activa SIEMPRE trabaja sobre un encounter real del backend.
  // Sin encounter_id no hay nada que capturar: el flujo nace en Nueva consulta.
  useEffect(() => {
    if (!encounterId) router.replace("/app/consultas/nueva");
  }, [encounterId, router]);

  // Limpia `record` de la URL preservando `encounter`, `paciente` y
  // `appointment`. El flag ya quedó capturado en autoStartOnArrival.
  useEffect(() => {
    if (sp.get("record") !== "1") return;
    const params = new URLSearchParams(sp.toString());
    params.delete("record");
    router.replace(`/app/consultas/en-vivo?${params.toString()}`, {
      scroll: false,
    });
    // Solo al montar: re-ejecutarlo en cada cambio de sp sería redundante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const [recoveredDraft, setRecoveredDraft] = useState(false);
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

  // Espejo local ya firmado → la nota es inmutable (el trigger de la BD lo
  // refuerza). La captura no puede pisarla: las correcciones van como adenda.
  const mirrorConsultation = encounterId ? getConsultation(encounterId) : undefined;
  const signedMirror =
    !!mirrorConsultation &&
    (mirrorConsultation.estado === "aprobada" ||
      mirrorConsultation.estado === "exportada");

  // El estado `note` vive en formato "de cable" (con [PACIENTE]/[DOCUMENTO],
  // tal como lo maneja el backend); el médico siempre ve y edita la versión
  // rehidratada. Al guardar, redactNote vuelve a tapar lo que haya escrito.
  const displayNote = useMemo(
    () => (note ? redactor.rehydrateNote(note) : note),
    [note, redactor],
  );

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
        // Hay transcripción guardada pero aún no hay nota: es un borrador que
        // sobrevivió a un cierre/recarga. Avisar para que el médico lo sepa.
        setRecoveredDraft(Boolean(data.transcript?.trim()) && !data.note_json);
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

  // Si el paciente se asocia (o cambia) después de dictar, re-tapa la
  // transcripción ya acumulada en pantalla. Ajuste de estado durante el
  // render: https://react.dev/learn/you-might-not-need-an-effect
  const [lastRedactor, setLastRedactor] = useState(redactor);
  if (lastRedactor !== redactor) {
    setLastRedactor(redactor);
    setTranscriptDraft((prev) => redactor.redact(prev));
  }

  function retryLoad() {
    setLoadState("loading");
    setLoadError(null);
    setReloadKey((key) => key + 1);
  }

  // Cambios sin guardar: transcripción/nota editadas o grabación en curso. El
  // guard central (UnsavedChangesProvider) cubre recarga, cierre, atrás/adelante
  // y los clics de navegación del shell; no hace falta un beforeunload propio.
  const hasUnsaved =
    noteDirty || dictando || transcriptDraft.trim() !== savedTranscript.trim();
  useUnsavedChangesGuard(
    hasUnsaved,
    dictando
      ? "Hay una grabación en curso. Si sales ahora, la transcripción no guardada se perderá. ¿Salir de todas formas?"
      : "Tienes cambios sin guardar en esta consulta. ¿Salir de todas formas?",
  );

  function applyStatus(nextStatus: string) {
    setEncounter((prev) => (prev ? { ...prev, status: nextStatus } : prev));
  }

  // Autosave del borrador de transcripción: cada pausa de 2.5 s (o máximo 10 s
  // de dictado continuo) persiste el texto al backend. Si el navegador muere o
  // el médico navega, el borrador sobrevive y se recupera al reabrir.
  const autosave = useTranscriptAutosave({
    encounterId,
    transcriptDraft,
    savedTranscript,
    suspended: busy || completed || signedMirror || loadState !== "ready",
    onSaved: (text) => setSavedTranscript(text),
  });

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
    // Se espera la confirmación del insert: asociar un paciente cuyo registro
    // falló dejaría el encounter apuntando a un id inexistente.
    const { ok, patient: created } = await addPatientAsync(input);
    if (!ok) return;
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
    // Defensa en profundidad: además del dictado (ya redactado segmento a
    // segmento), el texto pegado o escrito a mano se redacta aquí, justo
    // antes de salir hacia el backend.
    const text = redactor.redact(transcriptDraft.trim());
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
    // La pantalla refleja exactamente lo que se envió (con placeholders).
    if (text !== transcriptDraft) setTranscriptDraft(text);
    try {
      if (text !== savedTranscript.trim()) {
        setPhase("saving_transcript");
        const saved = await saveClinicalTranscript(encounterId, text);
        setSavedTranscript(text);
        applyStatus(saved.status);
      }
      setPhase("generating");
      const generated = await generateClinicalNote(encounterId);
      // La IA solo vio [PACIENTE]/[DOCUMENTO]; la vista (displayNote) muestra
      // la nota rehidratada con los datos reales.
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
    if (!finishAfterRecording || dictando || busy) return;
    if (!transcriptDraft.trim()) {
      // Sin voz captada: se apaga el flag YA. Si quedara encendido, el primer
      // carácter que el médico escribiera a mano dispararía la generación.
      setFinishAfterRecording(false);
      setFlowError(
        "No se captó audio en la grabación. Puedes escribir o pegar la transcripción manualmente.",
      );
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
    // La nota firmada es inmutable: el banner ya ofrece "Ver detalle" y
    // "Crear adenda"; aquí solo se corta el guardado por si algo lo invoca.
    if (signedMirror) return;
    setPhase("saving_note");
    setFlowError(null);
    try {
      // Hacia el backend viaja la versión redactada; el eco se rehidrata para
      // que el médico y el espejo local conserven el nombre real.
      const result = await saveEditedClinicalNote(
        encounterId,
        redactor.redactNote(note),
      );
      const rehydratedNote = redactor.rehydrateNote(result.note_json);
      setNote(result.note_json);
      setNoteDirty(false);
      setNoteSaved(true);
      setAiExplanation(null);
      applyStatus(result.status);

      // Puente: espeja la consulta en el historial local (tabla `consultations`)
      // para que aparezca en la lista, el detalle del paciente, y pueda
      // firmarse/exportarse. Idempotente: re-guardar actualiza la misma fila.
      if (encounter) {
        await upsertConsultation(
          encounterToConsultation({
            encounter: {
              id: encounterId,
              consultation_type: encounter.consultation_type,
              template_snapshot: encounter.template_snapshot,
              created_at: encounter.created_at,
            },
            // Historia clínica local: nota con datos reales, transcripción
            // redactada (transcriptDraft ya viene con placeholders).
            note: rehydratedNote,
            patient,
            transcript: transcriptDraft,
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
    setTranscriptDraft((prev) => {
      // Cada segmento se redacta al llegar: el nombre nunca queda visible en
      // el contexto acumulado ni viaja después al backend.
      const clean = redactor.redact(text);
      return prev.trim() ? `${prev.replace(/\s+$/, "")} ${clean}` : clean;
    });

  // Respaldo para entornos donde la API moderna del portapapeles no está
  // disponible (equipos de hospital con políticas de TI restrictivas,
  // navegadores antiguos): mecanismo clásico de seleccionar + copiar. Sin
  // esto, `navigator.clipboard` indefinido rompía el botón en silencio (sin
  // aviso ni error visible).
  function copyTextFallback(text: string): boolean {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }

  function copyToClipboard(text: string, label: string) {
    if (!text.trim()) return;
    const attempt = navigator.clipboard?.writeText
      ? navigator.clipboard.writeText(text).then(
          () => true,
          () => copyTextFallback(text),
        )
      : Promise.resolve(copyTextFallback(text));
    void attempt.then((ok) => {
      showToast(
        ok ? `${label} copiado al portapapeles.` : `No se pudo copiar ${label.toLowerCase()}.`,
        ok ? "success" : "warning",
      );
    });
  }

  /**
   * Secciones de la nota en el mismo orden y contenido que ven el "PDF
   * clínico" y el texto plano: una sola fuente de verdad para que copiar y
   * descargar coincidan siempre. Devolver {título, contenido} ya separados
   * (en vez de un texto plano que luego se re-parte por líneas en blanco)
   * evita que un salto de línea DENTRO de una sección (p. ej. una
   * descripción con varios párrafos) se confunda con el inicio de una
   * sección nueva y aparezca como un encabezado en negrilla espurio.
   */
  function noteSections(noteJson: ClinicalNoteJson): { title: string; content: string }[] {
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
      { title: "Resumen", content: noteJson.summary.trim() || "Sin información documentada." },
      ...noteJson.sections.map((section) => ({
        title: section.label,
        content: section.content.trim() || "Sin información documentada.",
      })),
      { title: "Plan terapéutico", content: plan.join("\n") || "Sin información documentada." },
      {
        title: "Recomendaciones",
        content:
          discharge.recommendations.map((item) => item.text).join("\n") ||
          "Sin información documentada.",
      },
      {
        title: "Signos de alarma",
        content:
          discharge.alarm_signs.map((item) => item.text).join("\n") ||
          "Sin información documentada.",
      },
    ];
  }

  function noteAsPlainText(noteJson: ClinicalNoteJson) {
    return noteSections(noteJson)
      .map((section) => `${section.title}\n${section.content}`)
      .join("\n\n");
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
    if (!displayNote) return;
    const blob = new Blob([noteAsPlainText(displayNote)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `miracle-nota-${encounterId ?? "consulta"}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Texto clínico preparado para descargar.", "success");
  }

  function descargarPdf() {
    if (!displayNote) return;
    const safe = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />");
    // Se arma cada sección desde los datos estructurados (noteSections), no
    // partiendo un texto plano por líneas en blanco: así un párrafo con un
    // salto de línea interno (frecuente en descripciones largas) nunca se
    // confunde con el inicio de otra sección ni aparece como un encabezado
    // en negrilla que no debería estarlo.
    const sections = noteSections(displayNote)
      .map(
        (section) =>
          `<section><h2>${safe(section.title)}</h2><p>${safe(section.content)}</p></section>`,
      )
      .join("");
    // Sin `noopener`/`noreferrer`: con esos flags window.open devuelve null y
    // deja un about:blank en blanco (el document.write no corre). Escribimos
    // nuestro propio HTML, así que no hacen falta.
    const popup = window.open("", "_blank", "width=900,height=1000");
    if (!popup) {
      showToast("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo de nuevo.", "warning");
      return;
    }
    // No se dispara la impresión sola al abrir: el médico revisa el
    // documento primero y decide cuándo imprimir o guardar como PDF con el
    // botón de la barra superior (o Ctrl/Cmd+P). El botón se oculta al
    // imprimir para que no salga en el documento final.
    popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Nota clínica Miracle</title><style>
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;color:#14233d;margin:0;line-height:1.55}
      .toolbar{position:sticky;top:0;display:flex;justify-content:flex-end;gap:8px;padding:12px 36px;background:#f1f5f9;border-bottom:1px solid #dbe4f2}
      .toolbar button{border:none;background:#0c1424;color:#fff;font:inherit;font-size:13px;font-weight:600;padding:8px 16px;border-radius:999px;cursor:pointer}
      .doc{margin:36px}
      h1{font-size:20px;font-weight:700;margin:0 0 6px}
      h2{font-size:13px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;margin:20px 0 6px;border-top:1px solid #dbe4f2;padding-top:14px;color:#14233d}
      p{margin:0;font-size:13px;font-weight:400}
      .meta{color:#546782;font-size:12px;font-weight:400}
      @media print{.toolbar{display:none}.doc{margin:18mm}}
    </style></head><body>
      <div class="toolbar"><button type="button" id="print-btn">Imprimir / Guardar como PDF</button></div>
      <div class="doc">
        <h1>Nota clínica · Miracle</h1>
        <p class="meta">${safe(snapshot?.name ?? "Plantilla clínica")} · ${safe(tipoLabel ?? "Consulta")}</p>
        ${sections}
      </div>
      <script>document.getElementById("print-btn").addEventListener("click", function () { window.print(); });</script>
    </body></html>`);
    popup.document.close();
    popup.focus();
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
        // Si el médico escribe el nombre en la instrucción, también se tapa.
        instruction: redactor.redact(instruction),
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
        instruction: `En la sección "${sectionTitle}", aplica esta instrucción dictada por el médico: "${redactor.redact(instruction)}". Modifica únicamente lo necesario para cumplirla y conserva el resto de la nota.`,
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

      {signedMirror ? (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-success/30 bg-mint-soft px-4 py-3"
        >
          <LockKeyhole size={18} className="shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-deep">
              Esta nota ya fue firmada y es inmutable.
            </p>
            <p className="text-[13px] text-muted">
              Las correcciones se registran como adendas, sin modificar el
              documento original.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push(`/app/consultas/${encounterId}`)}
              className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-deep hover:border-mist"
            >
              Ver detalle
            </button>
            <button
              type="button"
              onClick={() => router.push(`/app/consultas/${encounterId}?adenda=1`)}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              Crear adenda
            </button>
          </div>
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
                <div className="flex flex-wrap items-center gap-2">
                  {redactor.hasIdentity ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-xs font-semibold text-success">
                      <ShieldCheck size={13} className="shrink-0" />
                      Datos del paciente protegidos antes de enviar a la IA
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1.5 text-xs font-semibold text-warning">
                      <ShieldCheck size={13} className="shrink-0" />
                      Sin paciente asociado: solo se ocultan números de documento
                    </span>
                  )}
                  {dictando ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-danger" /> Grabando
                    </span>
                  ) : null}
                </div>
              </div>
              {recoveredDraft && !completed ? (
                <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-accent/25 bg-accent-soft/45 px-3.5 py-2.5 text-sm text-accent-ink">
                  <span>
                    Se recuperó el borrador de transcripción guardado de esta
                    consulta.
                  </span>
                  <button
                    type="button"
                    onClick={() => setRecoveredDraft(false)}
                    aria-label="Descartar aviso de borrador recuperado"
                    className="shrink-0 rounded-full p-0.5 hover:bg-accent-soft"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : null}
              {!completed ? (
                <>
                  <DictationPanel
                    disabled={busy || signedMirror}
                    onAppendFinal={appendFinal}
                    onActiveChange={setDictando}
                    autoStart={autoStartOnArrival && !completed && !signedMirror}
                    onRecordingStopped={() => setFinishAfterRecording(true)}
                    finishLabel="Finalizar y generar nota"
                  />
                  <p className="mt-2 text-xs text-muted">
                    También puedes escribir o pegar la transcripción manualmente.
                    Antes de enviarla a la IA, el nombre del paciente se
                    reemplaza por [PACIENTE] y su documento por [DOCUMENTO].
                  </p>
                </>
              ) : null}

              <label className="mt-4 block text-[12px] font-semibold uppercase tracking-wide text-muted">
                Transcripción de la consulta
                <textarea
                  value={transcriptDraft}
                  onChange={(e) => setTranscriptDraft(e.target.value)}
                  onBlur={() => setTranscriptDraft((prev) => redactor.redact(prev))}
                  disabled={completed || busy}
                  readOnly={dictando}
                  rows={10}
                  placeholder="Paciente consulta por…"
                  className="mt-2 w-full resize-y rounded-md border border-line bg-field px-3.5 py-2.5 text-sm font-normal normal-case tracking-normal leading-relaxed text-ink outline-none transition-colors focus:border-accent disabled:cursor-not-allowed read-only:bg-pearl"
                />
              </label>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
                <span>
                  {completed ? (
                    "La consulta está completada; la transcripción ya no se puede modificar."
                  ) : autosave.state === "saving" ? (
                    "Guardando borrador…"
                  ) : autosave.state === "error" ? (
                    <span className="text-warning">
                      No se pudo guardar el borrador. Se reintentará al seguir
                      dictando o escribiendo.
                    </span>
                  ) : autosave.at ? (
                    `Borrador guardado · ${new Date(autosave.at).toLocaleTimeString(
                      "es-CO",
                      { hour: "2-digit", minute: "2-digit" },
                    )}`
                  ) : (
                    "Puedes corregir el texto antes de generar la nota."
                  )}
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

          {displayNote && currentReviewView === "summary" ? (
            <ReviewSummary
              note={displayNote}
              onCopy={() => copyToClipboard(displayNote.summary, "Resumen")}
              onOpenFullNote={() => setReviewView("note")}
            />
          ) : null}

          {displayNote && currentReviewView === "plan" ? (
            <PlanDischargePanel
              discharge={ensureClinicalDischarge(displayNote.discharge)}
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
          {displayNote && currentReviewView === "note" ? (
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
                      onClick={() => copyToClipboard(displayNote.summary, "Resumen")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-sm font-semibold text-deep hover:border-mist"
                    >
                      <ClipboardCopy size={14} /> Copiar resumen
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(noteAsPlainText(displayNote), "Nota clínica")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-sm font-semibold text-deep hover:border-mist"
                    >
                      <ClipboardCopy size={14} /> Copiar nota
                    </button>
                    <button
                    type="button"
                    onClick={() => void guardarNota()}
                    disabled={busy || signedMirror}
                    title={signedMirror ? "La nota firmada es inmutable; usa una adenda" : undefined}
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
                note={displayNote}
                editable={!busy && !signedMirror}
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
                  <button type="button" onClick={() => void guardarNota()} disabled={busy || signedMirror} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60">
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

const AUTOSAVE_DEBOUNCE_MS = 2_500;
const AUTOSAVE_MAX_WAIT_MS = 10_000;

/**
 * Autosave del borrador de transcripción. Debounce de 2.5 s tras el último
 * cambio, con garantía de guardado cada 10 s durante dictado continuo (los
 * segmentos llegan tan seguido que un debounce puro nunca dispararía).
 * Errores no bloquean: el siguiente cambio de texto reintenta solo.
 */
function useTranscriptAutosave({
  encounterId,
  transcriptDraft,
  savedTranscript,
  suspended,
  onSaved,
}: {
  encounterId: string | null;
  transcriptDraft: string;
  savedTranscript: string;
  suspended: boolean;
  onSaved: (text: string) => void;
}): { state: "idle" | "saving" | "saved" | "error"; at: number | null } {
  const [autosave, setAutosave] = useState<{
    state: "idle" | "saving" | "saved" | "error";
    at: number | null;
  }>({ state: "idle", at: null });
  const inFlightRef = useRef(false);
  // Momento del primer cambio sin guardar: ancla del tope de 10 s.
  const dirtySinceRef = useRef<number | null>(null);
  // Valores vigentes para que el timer no capture closures viejos.
  const latest = useRef({ encounterId, transcriptDraft, savedTranscript, suspended, onSaved });
  latest.current = { encounterId, transcriptDraft, savedTranscript, suspended, onSaved };

  const flush = useCallback(async () => {
    const cur = latest.current;
    if (!cur.encounterId || cur.suspended || inFlightRef.current) return;
    const text = cur.transcriptDraft.trim();
    // Un borrador vacío o demasiado largo no se autoguarda (generarNota ya
    // valida el tope con mensaje propio).
    if (!text || text === cur.savedTranscript.trim()) return;
    if (text.length > MAX_TRANSCRIPT_LENGTH) return;
    inFlightRef.current = true;
    setAutosave((s) => ({ ...s, state: "saving" }));
    try {
      await saveClinicalTranscript(cur.encounterId, text);
      cur.onSaved(text);
      dirtySinceRef.current = null;
      setAutosave({ state: "saved", at: Date.now() });
    } catch {
      setAutosave((s) => ({ state: "error", at: s.at }));
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (suspended) return;
    const dirty =
      transcriptDraft.trim() !== savedTranscript.trim() && transcriptDraft.trim();
    if (!dirty) {
      dirtySinceRef.current = null;
      return;
    }
    if (dirtySinceRef.current === null) dirtySinceRef.current = Date.now();
    const elapsed = Date.now() - dirtySinceRef.current;
    const delay =
      elapsed >= AUTOSAVE_MAX_WAIT_MS
        ? 0
        : Math.min(AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MAX_WAIT_MS - elapsed);
    const timer = window.setTimeout(() => void flush(), delay);
    return () => window.clearTimeout(timer);
  }, [transcriptDraft, savedTranscript, suspended, flush]);

  return autosave;
}

function EnVivoRouter() {
  const sp = useSearchParams();
  const encounterId = sp.get("encounter");
  // La key remonta la captura completa al cambiar de encounter: ningún estado
  // (nota, transcripción, paciente) puede filtrarse de una consulta a otra.
  return <ConsultaActivaInner key={encounterId ?? "sin-encounter"} />;
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
      <EnVivoRouter />
    </Suspense>
  );
}
