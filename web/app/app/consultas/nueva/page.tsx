"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  Check,
  ChevronDown,
  FileAudio,
  Loader2,
  Mic,
  Monitor,
  Upload,
  UserRound,
  Video,
} from "lucide-react";
import { useStore } from "@/app/app/providers";
import { ClinicalTemplatePicker } from "@/components/app/ClinicalTemplatePicker";
import { AppPageHeader } from "@/components/app/AppPage";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { SearchField } from "@/components/ui/SearchField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { ConsultationType } from "@/lib/mock";
import { buildRedactor } from "@/lib/privacy/redact";
import { createClient } from "@/lib/supabase/client";
import {
  createClinicalEncounter,
  friendlyClinicalMessage,
  generateClinicalNote,
  getClinicalTemplates,
  saveClinicalTranscript,
  toBackendConsultationType,
  type ClinicalTemplate,
} from "@/lib/api/clinical";
import {
  getTemplatePreferences,
  pickPreselectedTemplate,
  pinnedTemplateIds,
  readLastTemplateId,
  rememberTemplateId,
  type TemplatePreference,
} from "@/lib/clinical/template-preferences";
import { useUserPreferences } from "@/lib/preferences/client";
import {
  transcribeAudioFile,
  validateAudioUpload,
} from "@/lib/stt/transcribe-audio-file";

const modalities: { id: Exclude<ConsultationType, "audio">; label: string; icon: typeof Monitor }[] = [
  { id: "presencial", label: "Presencial", icon: Monitor },
  { id: "telemedicina", label: "Telemedicina", icon: Video },
];

function NuevaConsultaForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { patients, getPatient } = useStore();
  const appointmentId = sp.get("appointment")?.trim() ?? "";
  // Preselección por id (UUID opaco). El nombre del paciente ya no viaja en
  // la URL: quedaría en el historial del navegador y en logs de acceso.
  const preselectedPatientId = sp.get("paciente")?.trim() ?? "";

  const { preferences: userPreferences } = useUserPreferences();
  const [patientQuery, setPatientQuery] = useState("");
  const [patientId, setPatientId] = useState<string | null | undefined>(undefined);
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);
  const [tipo, setTipo] = useState<Exclude<ConsultationType, "audio">>("presencial");
  const [templates, setTemplates] = useState<ClinicalTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [profileSpecialtyCode, setProfileSpecialtyCode] = useState<string | null>(null);
  // La memoria de "última usada" se guarda por médico, así que hace falta su id
  // aquí también: hasta ahora solo el acceso rápido la leía y la escribía.
  const [userId, setUserId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<TemplatePreference[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCanRetry, setUploadCanRetry] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "transcribing" | "creating" | "saving" | "generating" | "error"
  >("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const uploadRecoveryRef = useRef<{
    fileKey: string;
    transcript?: string;
    encounterId?: string;
    transcriptSaved?: boolean;
  } | null>(null);

  // Datos del paciente de la cita, resueltos por id desde la agenda (la URL
  // solo trae el id de la cita). `patient_id` es el vínculo VERIFICADO; si es
  // null, solo hay un nombre que puede coincidir con homónimos.
  const [appointmentName, setAppointmentName] = useState("");
  const [appointmentDocumento, setAppointmentDocumento] = useState("");
  const [appointmentLinkedId, setAppointmentLinkedId] = useState<string | null>(null);
  // El médico ya resolvió (confirmó o rechazó) el match por nombre.
  const [nameMatchResolved, setNameMatchResolved] = useState(false);

  useEffect(() => {
    if (!appointmentId) return;
    let ignore = false;

    async function loadAppointment() {
      const supabase = createClient();
      const { data } = await supabase
        .from("appointments")
        .select("paciente_nombre, paciente_documento, patient_id")
        .eq("id", appointmentId)
        .maybeSingle();
      if (ignore) return;
      const nombre = data?.paciente_nombre?.trim();
      if (nombre) {
        setAppointmentName(nombre);
        setPatientQuery((prev) => prev || nombre);
      }
      setAppointmentDocumento(data?.paciente_documento?.trim() ?? "");
      setAppointmentLinkedId(data?.patient_id ?? null);
    }

    void loadAppointment();
    return () => {
      ignore = true;
    };
  }, [appointmentId]);

  const preselectedPatient = getPatient(preselectedPatientId || null);

  // Candidato por nombre EXACTO cuando la cita no tiene patient_id verificado.
  // No se preselecciona en silencio: con homónimos (frecuentes en Colombia)
  // podría abrir la historia clínica de otra persona.
  const nameMatchCandidate = useMemo(() => {
    if (appointmentLinkedId || !appointmentName) return null;
    return (
      patients.find(
        (patient) =>
          patient.nombre.trim().toLocaleLowerCase() ===
          appointmentName.toLocaleLowerCase(),
      ) ?? null
    );
  }, [appointmentLinkedId, appointmentName, patients]);

  const effectivePatientId =
    patientId !== undefined
      ? patientId
      : (preselectedPatient?.id ?? appointmentLinkedId);
  const selectedPatient = getPatient(effectivePatientId);

  // Persiste el vínculo cita↔paciente para no volver a preguntar por nombre.
  async function writeAppointmentPatient(pid: string) {
    if (!appointmentId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("appointments")
      .update({ patient_id: pid })
      .eq("id", appointmentId);
    if (error) console.error("[agenda] set appointment patient", error.message);
    else setAppointmentLinkedId(pid);
  }

  // Se pregunta solo si hay candidato por nombre, no hay paciente efectivo ya
  // elegido, y el médico aún no lo resolvió.
  const showNameMatchPrompt =
    !!nameMatchCandidate &&
    !effectivePatientId &&
    patientId === undefined &&
    !nameMatchResolved;

  useEffect(() => {
    let ignore = false;

    async function loadTemplateContext() {
      setTemplatesLoading(true);
      setTemplatesError(null);
      const supabase = createClient();
      const profilePromise = (async () => {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) return null;
        setUserId(uid);
        const { data: profile } = await supabase
          .from("profiles")
          .select("specialty_code")
          .eq("id", uid)
          .maybeSingle();
        return profile?.specialty_code ?? null;
      })();

      try {
        const [list, specialtyCode, prefs] = await Promise.all([
          getClinicalTemplates(),
          profilePromise.catch(() => null),
          // Sin preferencias solo se pierde el pin; nunca bloquea el formulario.
          getTemplatePreferences(supabase).catch(
            () => [] as TemplatePreference[],
          ),
        ]);
        if (ignore) return;
        setTemplates(list);
        setProfileSpecialtyCode(specialtyCode);
        setPreferences(prefs);
      } catch (error) {
        if (!ignore) {
          setTemplates([]);
          setTemplatesError(friendlyClinicalMessage(error));
        }
      } finally {
        if (!ignore) setTemplatesLoading(false);
      }
    }

    void loadTemplateContext();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => () => uploadAbortRef.current?.abort(), []);

  // Todas las plantillas activas quedan disponibles: el selector agrupa las de la
  // especialidad del médico arriba y deja el resto a un clic.
  const availableTemplates = useMemo(
    () => templates.filter((template) => template.status !== "archived"),
    [templates],
  );

  const pinnedIds = useMemo(() => pinnedTemplateIds(preferences), [preferences]);

  // Preselección: la decide el médico en Configuración (su pin, la última que
  // usó, o ninguna). La lógica vive en lib/clinical/template-preferences.
  //
  // `lastUsedId` faltaba aquí: esta pantalla ignoraba la memoria de "última
  // usada" —y tampoco la escribía al arrancar—, así que esa señal solo
  // funcionaba entrando por el acceso rápido. Con el modo ya elegible, media
  // preferencia funcionando según por dónde entres no es una opción.
  const effectiveTemplateId = availableTemplates.some(
    (template) => template.id === selectedTemplateId,
  )
    ? selectedTemplateId
    : pickPreselectedTemplate({
        templates: availableTemplates,
        preferences,
        lastUsedId: readLastTemplateId(userId),
        specialtyCode: profileSpecialtyCode,
        mode: userPreferences.templateStartMode,
      });

  const matchingPatients = useMemo(() => {
    const query = patientQuery.trim().toLocaleLowerCase();
    if (!query) return patients.slice(0, 6);
    return patients
      .filter(
        (patient) =>
          patient.nombre.toLocaleLowerCase().includes(query) ||
          patient.documento.toLocaleLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [patientQuery, patients]);

  async function startRecording() {
    if (!effectiveTemplateId || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createClinicalEncounter({
        patient_id: effectivePatientId,
        consultation_type: toBackendConsultationType(tipo),
        template_id: effectiveTemplateId,
      });

      rememberTemplateId(userId, effectiveTemplateId);
      await linkAppointment(result.encounter_id);

      const params = new URLSearchParams({ encounter: result.encounter_id, record: "1" });
      if (effectivePatientId) params.set("paciente", effectivePatientId);
      if (appointmentId) params.set("appointment", appointmentId);
      router.push(`/app/consultas/en-vivo?${params.toString()}`);
    } catch (error) {
      setCreateError(friendlyClinicalMessage(error));
      setCreating(false);
    }
  }

  async function linkAppointment(encounterId: string) {
    if (!appointmentId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("appointments")
      .update({
        estado: "en_curso",
        clinical_encounter_id: encounterId,
        consultation_started_at: new Date().toISOString(),
        // Escribe el vínculo verificado cuando existe; nunca null sobre uno ya
        // establecido (el update omite la clave si no hay paciente).
        ...(effectivePatientId ? { patient_id: effectivePatientId } : {}),
      })
      .eq("id", appointmentId);
    if (error) console.error("[agenda] link encounter", error.message);
  }

  function selectAudioFile(file: File | null) {
    uploadAbortRef.current?.abort();
    uploadRecoveryRef.current = null;
    setUploadProgress(0);
    setUploadCanRetry(false);
    setUploadError(null);
    setUploadStatus("idle");
    if (!file) {
      setAudioFile(null);
      return;
    }
    const validationError = validateAudioUpload(file);
    if (validationError) {
      setAudioFile(null);
      setUploadError(validationError);
      setUploadStatus("error");
      if (audioInputRef.current) audioInputRef.current.value = "";
      return;
    }
    setAudioFile(file);
  }

  async function processAudioUpload() {
    if (!audioFile || !effectiveTemplateId || uploadStatus === "transcribing") return;
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setUploadError(null);

    const fileKey = `${audioFile.name}:${audioFile.size}:${audioFile.lastModified}`;
    const recovery = uploadRecoveryRef.current?.fileKey === fileKey
      ? uploadRecoveryRef.current
      : { fileKey };
    uploadRecoveryRef.current = recovery;

    try {
      let transcript = recovery.transcript;
      if (!transcript) {
        setUploadStatus("transcribing");
        const raw = await transcribeAudioFile(audioFile, {
          signal: controller.signal,
          onProgress: setUploadProgress,
        });
        // De-identificación antes de cachear y enviar: el backend (y el LLM)
        // solo ven [PACIENTE]/[DOCUMENTO]. La nota se rehidrata al abrirse en
        // la consulta activa. Ver lib/privacy/redact.ts.
        transcript = buildRedactor(
          selectedPatient
            ? {
                nombre: selectedPatient.nombre,
                documento: selectedPatient.documento,
              }
            : null,
        ).redact(raw);
        recovery.transcript = transcript;
        setUploadCanRetry(true);
      }

      let encounterId = recovery.encounterId;
      if (!encounterId) {
        setUploadStatus("creating");
        const result = await createClinicalEncounter({
          patient_id: effectivePatientId,
          consultation_type: "audio_upload",
          template_id: effectiveTemplateId,
        });
        encounterId = result.encounter_id;
        recovery.encounterId = encounterId;
        await linkAppointment(encounterId);
      }

      if (!recovery.transcriptSaved) {
        setUploadStatus("saving");
        await saveClinicalTranscript(encounterId, transcript);
        recovery.transcriptSaved = true;
      }

      setUploadStatus("generating");
      await generateClinicalNote(encounterId);
      router.push(`/app/consultas/en-vivo?encounter=${encodeURIComponent(encounterId)}`);
    } catch (error) {
      if (controller.signal.aborted) return;
      setUploadStatus("error");
      setUploadError(
        error instanceof Error ? error.message : friendlyClinicalMessage(error),
      );
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
    }
  }

  const uploadBusy = ["transcribing", "creating", "saving", "generating"].includes(uploadStatus);
  const canStart = Boolean(effectiveTemplateId) && !creating && !uploadBusy;

  return (
    <div className="app-page max-w-4xl pb-4 sm:pb-8">
      <AppPageHeader
        title="Iniciar consulta"
        description="Confirma la plantilla y comienza a grabar. El paciente es opcional."
        action={
          appointmentName ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-soft/45 px-3 py-2 text-sm font-medium text-accent-ink">
              <CalendarClock size={15} /> {appointmentName}
            </div>
          ) : null
        }
      />

      <main className="clinical-panel overflow-hidden">
        <section className="border-b border-line px-5 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Nota clínica</p>
              <h2 className="mt-1 text-lg font-semibold text-deep">Plantilla para esta consulta</h2>
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ice text-accent"><Check size={16} /></span>
          </div>
          {templatesLoading ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted"><Loader2 size={15} className="animate-spin text-accent" /> Cargando plantillas…</p>
          ) : templatesError ? (
            <AlertBanner tone="danger" className="mt-4">No se pudieron cargar las plantillas. {templatesError}</AlertBanner>
          ) : availableTemplates.length ? (
            <div className="mt-4"><ClinicalTemplatePicker templates={availableTemplates} specialtyCode={profileSpecialtyCode} value={effectiveTemplateId} onChange={setSelectedTemplateId} disabled={creating} pinnedTemplateIds={pinnedIds} /></div>
          ) : (
            <p className="mt-4 rounded-lg bg-pearl px-3 py-2.5 text-sm text-muted">No hay plantillas disponibles. Crea una antes de iniciar la consulta.</p>
          )}
        </section>

        <section className="border-b border-line px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Contexto</p>
              <h2 className="mt-1 text-base font-semibold text-deep">Modalidad de atención</h2>
            </div>
            <SegmentedControl
              ariaLabel="Modalidad de atención"
              options={modalities.map((modality) => ({
                id: modality.id,
                label: modality.label,
                icon: modality.icon,
              }))}
              value={tipo}
              onChange={(id) => setTipo(id as typeof tipo)}
              fullWidth
              className="sm:w-auto"
            />
          </div>

          {showNameMatchPrompt && nameMatchCandidate ? (
            <div className="mt-5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3.5">
              <p className="text-sm font-semibold text-deep">
                La cita dice «{appointmentName}». ¿Es este paciente?
              </p>
              <p className="mt-1 text-sm text-muted">
                {nameMatchCandidate.nombre}
                {nameMatchCandidate.documento && nameMatchCandidate.documento !== "Por registrar"
                  ? ` — ${nameMatchCandidate.documento}`
                  : ""}
                {appointmentDocumento ? ` · Cita: ${appointmentDocumento}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted">
                Confírmalo para evitar abrir la historia de un homónimo.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPatientId(nameMatchCandidate.id);
                    setPatientQuery(nameMatchCandidate.nombre);
                    setNameMatchResolved(true);
                    void writeAppointmentPatient(nameMatchCandidate.id);
                  }}
                  className="clinical-primary min-h-11 px-4"
                >
                  <Check size={15} /> Sí, asociar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNameMatchResolved(true);
                    setPatientPickerOpen(true);
                  }}
                  className="clinical-secondary min-h-11 px-4"
                >
                  No, elegir otro
                </button>
              </div>
            </div>
          ) : null}

          <div className="relative mt-5 rounded-xl border border-dashed border-line bg-pearl/70 px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ice text-accent"><UserRound size={17} /></span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-deep">{(selectedPatient?.nombre ?? appointmentName) || "Paciente sin asociar"}</p>
                   <p className="text-[13px] text-muted">{selectedPatient ? "Asociado a esta consulta" : "Opcional"}</p>
                </div>
              </div>
              <button type="button" onClick={() => setPatientPickerOpen((open) => !open)} className="clinical-tertiary min-h-10 px-3">
                {selectedPatient ? "Cambiar" : "Asociar paciente"} <ChevronDown size={15} />
              </button>
            </div>
            {patientPickerOpen ? (
              <div className="mt-4 border-t border-line pt-4">
                <SearchField
                  value={patientQuery}
                  onChange={setPatientQuery}
                  placeholder="Buscar por nombre o documento"
                  ariaLabel="Buscar paciente"
                />
                <ul className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-line bg-surface p-1">
                  {matchingPatients.length ? matchingPatients.map((patient) => (
                    <li key={patient.id}><button type="button" onClick={() => { setPatientId(patient.id); setPatientQuery(patient.nombre); setPatientPickerOpen(false); }} className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left hover:bg-ice-soft"><span><span className="block text-sm font-medium text-deep">{patient.nombre}</span><span className="block text-xs text-muted">{patient.documento || "Datos por completar"}</span></span>{patient.id === effectivePatientId ? <Check size={15} className="text-accent" /> : null}</button></li>
                  )) : <li className="px-3 py-2.5 text-sm text-muted">No hay coincidencias. Podrás crear el paciente dentro de la consulta.</li>}
                </ul>
                {selectedPatient ? <button type="button" onClick={() => { setPatientId(null); setPatientPickerOpen(false); }} className="mt-2 text-sm font-semibold text-muted hover:text-deep">Continuar sin paciente asociado</button> : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="border-b border-line px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Usar otra fuente</p>
              <h2 className="mt-1 text-base font-semibold text-deep">Procesar una grabación existente</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">El audio se transcribe con la plantilla elegida y no se guarda en Miracle Web.</p>
            </div>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/webm,audio/ogg,.mp3,.m4a,.wav,.webm,.ogg"
              className="sr-only"
              onChange={(event) => selectAudioFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="clinical-secondary min-h-11 shrink-0 px-4"
              onClick={() => audioInputRef.current?.click()}
              disabled={creating || uploadBusy}
            >
              <Upload size={17} /> {audioFile ? "Cambiar archivo" : "Subir grabación"}
            </button>
          </div>

          {audioFile ? (
            <div className="mt-4 rounded-xl border border-line bg-pearl/70 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ice text-accent"><FileAudio size={19} /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-deep">{audioFile.name}</p>
                    <p className="text-xs text-muted">{(audioFile.size / 1024 / 1024).toFixed(1)} MB · MP3, M4A, WAV, WebM u OGG</p>
                  </div>
                </div>
                <button type="button" onClick={() => void processAudioUpload()} disabled={uploadBusy || !effectiveTemplateId} className="clinical-primary min-h-11 shrink-0 px-4">
                  {uploadBusy ? <><Loader2 size={17} className="animate-spin" /> Procesando {uploadProgress ? `${uploadProgress}%` : "…"}</> : <><FileAudio size={17} /> Transcribir y generar nota</>}
                </button>
              </div>
              {uploadBusy ? <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Progreso de la grabación" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress}><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${uploadProgress}%` }} /></div> : null}
            </div>
          ) : null}
          {uploadError ? <AlertBanner tone="danger" className="mt-3">{uploadError} {uploadCanRetry ? "Puedes reintentar sin volver a transcribir el archivo." : ""}</AlertBanner> : null}
        </section>

        <section className="glass-bar mobile-bottom-sheet sticky bottom-0 z-20 rounded-b-[16px] border-t border-[var(--glass-edge)] px-4 py-4 sm:static sm:bg-accent-soft/25 sm:px-7 sm:py-5 sm:shadow-none sm:backdrop-blur-none sm:[background:var(--color-accent-soft)]/25">
          {createError ? <AlertBanner tone="danger" className="mb-4">No se pudo iniciar la consulta. {createError}</AlertBanner> : null}
          <div className="flex justify-end">
             <button type="button" onClick={() => void startRecording()} disabled={!canStart} className="clinical-primary min-h-12 w-full px-6 py-3 sm:w-auto">
              {creating ? <><Loader2 size={18} className="animate-spin" /> Preparando grabación…</> : <><Mic size={18} /> Iniciar y grabar</>}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function NuevaConsultaPage() {
  return <Suspense fallback={null}><NuevaConsultaForm /></Suspense>;
}
