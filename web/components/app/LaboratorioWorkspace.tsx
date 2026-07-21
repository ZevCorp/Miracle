"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  Microscope,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  TriangleAlert,
  UserRound,
  Wand2,
  X,
} from "lucide-react";
import { useStore } from "@/app/app/providers";
import { AppPageHeader } from "@/components/app/AppPage";
import { createClient } from "@/lib/supabase/client";
import { downloadLabReport } from "@/lib/pdf/lab-report";
import type { Consultation, NoteSection } from "@/lib/mock";

interface TemplateSectionMeta {
  key: string;
  label: string;
  order: number;
}
interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  sections: TemplateSectionMeta[];
}
interface FilledSection {
  key: string;
  label: string;
  content: string;
}
interface ProfessionalInfo {
  name: string;
  specialtyName: string | null;
  registration: string | null;
  city: string | null;
}

// Rechazo temprano del archivo fuente (antes de recomprimir). Una foto de más
// de 15 MB casi nunca es legible y no vale la pena procesarla.
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
// Tope del data URL que se envía: ~4.2 MB de caracteres base64 ≈ 3.15 MB
// binarios. El body JSON queda por debajo del límite de 4.5 MB de Vercel.
const MAX_DATAURL_CHARS = 4_200_000;
// OpenAI vía Graph no procesa GIF animado y toda la copy dice JPG/PNG/WebP.
const MIME_OK = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Valor centinela: la IA diseña su propia plantilla a partir de la foto. */
const DYNAMIC_ID = "__dynamic__";

/** Parsea el jsonb `sections` de una plantilla a metadatos ordenados. */
function parseSections(value: unknown): TemplateSectionMeta[] {
  if (!Array.isArray(value)) return [];
  const out: TemplateSectionMeta[] = [];
  value.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return;
    const section = raw as Record<string, unknown>;
    const key = String(section.key ?? "").trim();
    if (!key) return;
    out.push({
      key,
      label: String(section.label ?? key).trim() || key,
      order: typeof section.order === "number" ? section.order : index + 1,
    });
  });
  return out.sort((a, b) => a.order - b.order);
}

/**
 * Reduce la foto a un JPEG que quepa bajo MAX_DATAURL_CHARS (el límite real de
 * body de Vercel), recomprimiendo por PESO, no solo por dimensión: baja la
 * calidad y, si aún no alcanza, reescala hasta lograrlo. Lanza si no se puede.
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const original = String(reader.result ?? "");
      const img = new Image();
      img.onload = () => {
        try {
          // Si el original ya cabe y es un formato liviano, no lo re-procesa.
          if (original.length <= MAX_DATAURL_CHARS && file.type === "image/jpeg") {
            resolve(original);
            return;
          }
          let width = img.width;
          let height = img.height;
          const firstScale = Math.min(1, 2200 / Math.max(width, height));
          width = Math.round(width * firstScale);
          height = Math.round(height * firstScale);

          const encode = (w: number, h: number, quality: number): string | null => {
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) return null;
            ctx.drawImage(img, 0, 0, w, h);
            return canvas.toDataURL("image/jpeg", quality);
          };

          const qualities = [0.85, 0.7, 0.55];
          for (let iteration = 0; iteration < 6; iteration += 1) {
            for (const quality of qualities) {
              const out = encode(width, height, quality);
              if (out && out.length <= MAX_DATAURL_CHARS) {
                resolve(out);
                return;
              }
            }
            // Ninguna calidad bastó a este tamaño: reduce dimensiones y repite.
            width = Math.round(width * 0.8);
            height = Math.round(height * 0.8);
            if (width < 400 || height < 400) break;
          }
          reject(
            new Error(
              "La imagen no se pudo reducir lo suficiente. Toma la foto con menos resolución.",
            ),
          );
        } catch {
          reject(new Error("No se pudo procesar la imagen."));
        }
      };
      img.onerror = () => reject(new Error("No se pudo abrir la imagen."));
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}

export function LaboratorioWorkspace({
  professional,
  organizationName,
}: {
  professional: ProfessionalInfo;
  organizationName: string | null;
}) {
  const { patients, getPatient, upsertConsultation, showToast } = useStore();

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Evita repetir la llamada de IA si la foto y la plantilla no cambiaron.
  const lastRun = useRef<{ image: string; templateId: string } | null>(null);

  const [step, setStep] = useState<"setup" | "review">("setup");
  const [sections, setSections] = useState<FilledSection[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);
  // Título efectivo del informe: en dinámico lo pone la IA; con plantilla fija
  // es el nombre de la plantilla. Se usa en la revisión, el guardado y el PDF.
  const [reportTitle, setReportTitle] = useState<string | null>(null);

  const [patientName, setPatientName] = useState("");
  const [patientDocument, setPatientDocument] = useState("");
  const [linkedPatientId, setLinkedPatientId] = useState<string | null>(null);
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Id ESTABLE del informe: sobrevive a las ediciones para que "Guardar cambios"
  // actualice la misma fila (antes se regeneraba y duplicaba el informe).
  const reportIdRef = useRef<string>(crypto.randomUUID());
  // Fecha del primer guardado: un documento clínico no cambia de fecha al
  // corregir un typo.
  const savedFechaRef = useRef<string | null>(null);

  // Reinicia la identidad del informe al empezar uno nuevo (nueva foto / manual).
  const resetReportIdentity = useCallback(() => {
    reportIdRef.current = crypto.randomUUID();
    savedFechaRef.current = null;
    setSaved(false);
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setTemplatesLoading(true);
      setTemplatesError(null);
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("clinical_templates")
        .select("id, name, description, sections")
        .eq("specialty_code", "patologia")
        .eq("scope", "institutional")
        .eq("status", "active")
        // La predeterminada primero → queda preseleccionada y de primera en la lista.
        .order("is_default", { ascending: false })
        .order("name");
      if (ignore) return;
      if (err) {
        setTemplates([]);
        setTemplatesError("No se pudieron cargar las plantillas de patología.");
      } else {
        const rows: TemplateRow[] = (data ?? []).map((row) => ({
          id: row.id as string,
          name: row.name as string,
          description: (row.description as string | null) ?? null,
          sections: parseSections(row.sections),
        }));
        setTemplates(rows);
        setSelectedTemplateId((current) => current || rows[0]?.id || "");
      }
      setTemplatesLoading(false);
    }
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  const dynamicSelected = selectedTemplateId === DYNAMIC_ID;

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  /** Nombre a mostrar para el informe en curso (dinámico o de plantilla). */
  const activeTitle = reportTitle ?? selectedTemplate?.name ?? "Informe de patología";

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

  function pickFile(file: File | null) {
    setError(null);
    if (!file) return;
    if (!MIME_OK.has(file.type)) {
      setError("Formato no soportado. Usa JPG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError("Selecciona una imagen de menos de 15 MB.");
      return;
    }
    void fileToDataUrl(file)
      .then((dataUrl) => {
        setImage(dataUrl);
        lastRun.current = null;
      })
      .catch((e: unknown) => {
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo procesar la imagen. Intenta con otra foto.",
        );
      });
  }

  async function analyze() {
    if ((!selectedTemplate && !dynamicSelected) || !image || analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/clinical/note-from-photo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          dynamicSelected ? { image, dynamic: true } : { image, templateId: selectedTemplate!.id },
        ),
      });

      // La plataforma (Vercel) puede cortar el request con un 413/504 en HTML,
      // no en el JSON de la ruta: detectarlo evita el engañoso "revisa tu
      // conexión" y el crash de res.json() sobre un cuerpo no-JSON.
      const contentType = res.headers.get("content-type") ?? "";
      if (res.status === 413 || !contentType.includes("application/json")) {
        setError(
          "La imagen es demasiado pesada o el servicio no está disponible. Intenta con una foto más liviana.",
        );
        return;
      }

      let data: {
        connected?: boolean;
        template?: { name?: string };
        sections?: FilledSection[];
        warnings?: string[];
        error?: string;
      };
      try {
        data = await res.json();
      } catch {
        setError(
          "La imagen es demasiado pesada o el servicio no está disponible. Intenta con una foto más liviana.",
        );
        return;
      }

      if (!res.ok) {
        setError(
          data.error === "upstream" || data.error === "parse"
            ? "La IA no pudo leer la foto. Reintenta con una imagen más nítida o rellena manualmente."
            : "No se pudo procesar la foto. Reintenta o rellena manualmente.",
        );
        return;
      }

      if (data.connected === false) {
        if (dynamicSelected) {
          // La plantilla dinámica necesita la IA activa: no hay estructura fija que rellenar.
          setError(
            "La plantilla dinámica necesita la IA. No está disponible ahora: elige una plantilla fija para rellenar a mano.",
          );
          return;
        }
        // Sin IA configurada: se rellena manualmente sobre las casillas de la plantilla.
        startManual();
        showToast("La IA no está disponible ahora. Rellena las casillas manualmente.", "warning");
        return;
      }

      lastRun.current = { image, templateId: dynamicSelected ? DYNAMIC_ID : selectedTemplate!.id };
      setSections(
        (data.sections ?? []).map((section) => ({
          key: section.key,
          label: section.label,
          content: section.content ?? "",
        })),
      );
      setWarnings(data.warnings ?? []);
      setReportTitle(data.template?.name ?? selectedTemplate?.name ?? null);
      setAiConnected(true);
      resetReportIdentity();
      setStep("review");
    } catch {
      setError("No se pudo conectar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setAnalyzing(false);
    }
  }

  function startManual() {
    if (!selectedTemplate) return;
    setSections(
      selectedTemplate.sections.map((section) => ({
        key: section.key,
        label: section.label,
        content: "",
      })),
    );
    setWarnings([]);
    setReportTitle(selectedTemplate.name);
    setAiConnected(false);
    resetReportIdentity();
    setStep("review");
  }

  function updateSection(key: string, content: string) {
    // Solo cambia el contenido: el id del informe permanece estable, así
    // "Guardar cambios" actualiza la misma fila en vez de crear una nueva.
    setSections((list) =>
      list.map((section) => (section.key === key ? { ...section, content } : section)),
    );
  }

  function resetToSetup() {
    setStep("setup");
    setSections([]);
    setWarnings([]);
    setReportTitle(null);
    setAiConnected(null);
    resetReportIdentity();
  }

  function selectPatient(id: string) {
    const patient = getPatient(id);
    if (!patient) return;
    setLinkedPatientId(id);
    setPatientName(patient.nombre);
    setPatientDocument(patient.documento ?? "");
    setPatientPickerOpen(false);
  }

  function buildConsultation(): Consultation {
    const note: NoteSection[] = sections.map((section) => ({
      id: section.key,
      titulo: section.label,
      kind: "texto",
      texto: section.content,
    }));
    const firstFilled = sections.find((section) => section.content.trim());
    const motivo = (patientName.trim() || activeTitle).slice(0, 140);
    return {
      id: reportIdRef.current,
      pacienteId: linkedPatientId ?? "",
      medicoId: "",
      servicio: "Patología",
      especialidad: professional.specialtyName ?? "Patología",
      tipo: "laboratorio",
      estado: "borrador",
      fecha: savedFechaRef.current ?? new Date().toISOString(),
      duracionMin: 0,
      plantilla: activeTitle,
      motivo,
      note,
      transcript: [],
      resumen: firstFilled ? `${firstFilled.label}: ${firstFilled.content.trim().slice(0, 160)}` : "",
      codigos: [],
      auditoria: [],
    };
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const consultation = buildConsultation();
      // Se espera la confirmación de Supabase antes de declarar el guardado:
      // el toast de éxito no debe aparecer sobre una escritura que falló.
      const { ok } = await upsertConsultation(consultation);
      if (!ok) return; // el store ya avisó del fallo.
      savedFechaRef.current ??= consultation.fecha;
      setSaved(true);
      showToast("Informe de patología guardado en el historial.", "success");
    } finally {
      setSaving(false);
    }
  }

  function download() {
    const ok = downloadLabReport({
      reportTitle: activeTitle,
      dateISO: new Date().toISOString(),
      professional: {
        name: professional.name,
        specialtyName: professional.specialtyName,
        registration: professional.registration,
        city: professional.city,
      },
      patient: {
        nombre: patientName.trim() || null,
        documento: patientDocument.trim() || null,
        edad: linkedPatientId ? (getPatient(linkedPatientId)?.edad ?? null) : null,
        sexo: linkedPatientId ? (getPatient(linkedPatientId)?.sexo ?? null) : null,
      },
      organizationName,
      sections: sections.map((section) => ({ label: section.label, content: section.content })),
    });
    if (!ok) {
      showToast("Permite las ventanas emergentes para descargar el PDF.", "warning");
    }
  }

  const canAnalyze = Boolean((selectedTemplate || dynamicSelected) && image) && !analyzing;

  return (
    <div className="app-page max-w-4xl pb-24 sm:pb-8">
      <AppPageHeader
        kicker="Patología"
        title="Informe desde foto de la hoja"
        description="Toma una foto de tu hoja de trabajo y Miracle la vuelca en la plantilla. Revisa las casillas y descarga el informe para tu HIS."
        action={
          <span className="inline-flex items-center gap-2 rounded-[9px] border border-accent/25 bg-accent-soft/45 px-3 py-2 text-sm font-medium text-accent-ink">
            <Microscope size={15} /> Solo patología
          </span>
        }
      />

      {step === "setup" ? (
        <main className="rounded-[14px] border border-line bg-surface shadow-[var(--shadow-xs)]">
          {/* Plantilla */}
          <section className="border-b border-line px-5 py-5 sm:px-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Paso 1</p>
            <h2 className="mt-1 text-lg font-semibold text-deep">Elige la plantilla del informe</h2>
            {templatesLoading ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                <Loader2 size={15} className="animate-spin text-accent" /> Cargando plantillas…
              </p>
            ) : templatesError ? (
              <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
                {templatesError}
              </p>
            ) : templates.length ? (
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSelectedTemplateId(DYNAMIC_ID)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    dynamicSelected
                      ? "border-accent bg-accent text-white shadow-[var(--shadow-xs)] ring-2 ring-accent/25"
                      : "border-accent/50 bg-accent-soft/60 hover:border-accent hover:bg-accent-soft"
                  }`}
                  aria-pressed={dynamicSelected}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                        dynamicSelected ? "text-white" : "text-accent-ink"
                      }`}
                    >
                      <Wand2 size={15} /> Plantilla dinámica
                    </span>
                    {dynamicSelected ? (
                      <Check size={16} className="text-white" />
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                        <Sparkles size={11} /> IA
                      </span>
                    )}
                  </span>
                  <span
                    className={`mt-1 block text-xs leading-relaxed ${
                      dynamicSelected ? "text-white/85" : "text-muted"
                    }`}
                  >
                    La IA crea una plantilla a la medida de tu hoja desde la foto y la rellena. Úsala cuando ninguna de las anteriores encaje.
                  </span>
                  <span
                    className={`mt-2 block text-[11px] font-medium uppercase tracking-wide ${
                      dynamicSelected ? "text-white/80" : "text-accent"
                    }`}
                  >
                    Se genera desde la foto
                  </span>
                </button>
                {templates.map((template) => {
                  const active = template.id === selectedTemplateId;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        active
                          ? "border-accent bg-ice-soft ring-1 ring-accent/20"
                          : "border-line hover:border-mist"
                      }`}
                      aria-pressed={active}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-deep">{template.name}</span>
                        {active ? <Check size={16} className="text-accent" /> : null}
                      </span>
                      {template.description ? (
                        <span className="mt-1 block text-xs leading-relaxed text-muted">
                          {template.description}
                        </span>
                      ) : null}
                      <span className="mt-2 block text-[11px] font-medium uppercase tracking-wide text-muted">
                        {template.sections.length} casillas
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-pearl px-3 py-2.5 text-sm text-muted">
                No hay plantillas de patología disponibles.
              </p>
            )}
          </section>

          {/* Paciente (opcional) */}
          <section className="border-b border-line px-5 py-5 sm:px-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Paso 2</p>
            <h2 className="mt-1 text-base font-semibold text-deep">Paciente o muestra <span className="font-normal text-muted">· opcional</span></h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-deep">Nombre / identificación de la muestra</span>
                <input
                  value={patientName}
                  onChange={(event) => {
                    setPatientName(event.target.value);
                    setLinkedPatientId(null);
                  }}
                  placeholder="Ej. Ana Ruiz o Muestra 20260716-04"
                  className="w-full rounded-md border border-line bg-field px-3 py-2 text-sm text-deep outline-none focus:border-accent"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-deep">Documento</span>
                <input
                  value={patientDocument}
                  onChange={(event) => setPatientDocument(event.target.value)}
                  placeholder="Opcional"
                  className="w-full rounded-md border border-line bg-field px-3 py-2 text-sm text-deep outline-none focus:border-accent"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => setPatientPickerOpen((open) => !open)}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-hover"
            >
              <UserRound size={15} /> Asociar paciente registrado <ChevronDown size={14} />
            </button>
            {patientPickerOpen ? (
              <div className="mt-3 rounded-xl border border-line bg-pearl/60 p-3">
                <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 focus-within:border-accent">
                  <Search size={16} className="text-muted" />
                  <input
                    value={patientQuery}
                    onChange={(event) => setPatientQuery(event.target.value)}
                    placeholder="Buscar por nombre o documento"
                    aria-label="Buscar paciente"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
                  />
                  {patientQuery ? (
                    <button type="button" onClick={() => setPatientQuery("")} aria-label="Limpiar" className="text-muted hover:text-deep">
                      <X size={15} />
                    </button>
                  ) : null}
                </div>
                <ul className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-line bg-surface p-1">
                  {matchingPatients.length ? (
                    matchingPatients.map((patient) => (
                      <li key={patient.id}>
                        <button
                          type="button"
                          onClick={() => selectPatient(patient.id)}
                          className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left hover:bg-ice-soft"
                        >
                          <span>
                            <span className="block text-sm font-medium text-deep">{patient.nombre}</span>
                            <span className="block text-xs text-muted">{patient.documento || "Sin documento"}</span>
                          </span>
                          {patient.id === linkedPatientId ? <Check size={15} className="text-accent" /> : null}
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2.5 text-sm text-muted">Sin coincidencias.</li>
                  )}
                </ul>
              </div>
            ) : null}
          </section>

          {/* Foto */}
          <section className="px-5 py-5 sm:px-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Paso 3</p>
            <h2 className="mt-1 text-base font-semibold text-deep">Foto de la hoja de trabajo</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              La imagen se procesa para leer la escritura y no se guarda en Miracle. Solo se guarda el texto que revises.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
            />

            {image ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-line bg-pearl/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Vista previa de la hoja" className="max-h-72 w-full object-contain" />
                <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2.5">
                  <span className="inline-flex items-center gap-2 text-sm text-muted">
                    <Camera size={15} className="text-accent" /> Foto lista
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm font-semibold text-accent hover:text-accent-hover"
                  >
                    Cambiar foto
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-pearl/60 px-4 py-8 text-center transition-colors hover:border-accent hover:bg-ice-soft"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ice text-accent">
                  <Camera size={20} />
                </span>
                <span className="text-sm font-semibold text-deep">Tomar o subir foto</span>
                <span className="text-xs text-muted">JPG, PNG o WebP · hasta 15 MB</span>
              </button>
            )}

            {error ? (
              <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={startManual}
                disabled={!selectedTemplate}
                className="clinical-secondary min-h-11 px-4"
              >
                <FileText size={16} /> Rellenar sin foto
              </button>
              <button
                type="button"
                onClick={() => void analyze()}
                disabled={!canAnalyze}
                className="clinical-primary min-h-11 px-5"
              >
                {analyzing ? (
                  <>
                    <Loader2 size={17} className="animate-spin" /> Leyendo la hoja…
                  </>
                ) : (
                  <>
                    <Microscope size={17} /> Generar nota
                  </>
                )}
              </button>
            </div>
          </section>
        </main>
      ) : (
        <main className="rounded-[14px] border border-line bg-surface shadow-[var(--shadow-xs)]">
          <section className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                {aiConnected ? "Revisa y corrige las casillas" : "Rellena las casillas"}
              </p>
              <h2 className="mt-0.5 truncate text-lg font-semibold text-deep">
                {activeTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={resetToSetup}
              className="inline-flex items-center gap-1.5 self-start rounded-lg px-2.5 py-2 text-sm font-semibold text-muted hover:bg-ice-soft hover:text-deep"
            >
              <RefreshCw size={15} /> Otra foto
            </button>
          </section>

          {aiConnected === false ? (
            <p className="border-b border-line bg-warning-soft/60 px-5 py-3 text-sm text-warning sm:px-7">
              La IA no está disponible: escribe el contenido de cada casilla a partir de tu hoja.
            </p>
          ) : null}

          {warnings.length ? (
            <div className="border-b border-line bg-warning-soft/40 px-5 py-3 sm:px-7">
              <p className="flex items-center gap-2 text-sm font-semibold text-warning">
                <TriangleAlert size={15} /> Verifica estos puntos
              </p>
              <ul className="mt-1 list-disc pl-6 text-sm text-warning">
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="divide-y divide-line">
            {sections.map((section) => (
              <div key={section.key} className="px-5 py-4 sm:px-7">
                <label className="block">
                  <span className="text-sm font-semibold text-deep">{section.label}</span>
                  <textarea
                    value={section.content}
                    onChange={(event) => updateSection(section.key, event.target.value)}
                    rows={Math.min(10, Math.max(2, Math.ceil((section.content.length || 1) / 70) + 1))}
                    placeholder="Sin información — escribe o deja vacío"
                    className="mt-1.5 w-full resize-y rounded-md border border-line bg-field px-3 py-2 text-sm leading-relaxed text-deep outline-none focus:border-accent"
                  />
                </label>
              </div>
            ))}
          </div>

          <section className="mobile-bottom-sheet sticky bottom-0 z-20 flex flex-col gap-2 rounded-b-[14px] border-t border-line bg-surface px-4 py-4 shadow-[0_-10px_24px_rgb(8_17_31/0.08)] sm:static sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:bg-accent-soft/25 sm:px-7 sm:shadow-none">
            {saved ? (
              <span className="mr-auto hidden items-center gap-1.5 text-sm font-medium text-mint-ink sm:inline-flex">
                <Check size={15} /> Guardada en el historial
              </span>
            ) : null}
            <button type="button" onClick={() => void save()} disabled={saving} className="clinical-secondary min-h-11 px-4">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saved ? "Guardar cambios" : "Guardar en historial"}
            </button>
            <button type="button" onClick={download} className="clinical-primary min-h-11 px-5">
              <Download size={16} /> Descargar informe (PDF)
            </button>
          </section>
        </main>
      )}
    </div>
  );
}
