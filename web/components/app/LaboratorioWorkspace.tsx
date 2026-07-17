"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  TriangleAlert,
  UserRound,
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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIME_OK = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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
 * Reduce la foto a un JPEG de lado máximo ~2200px para bajar peso sin perder legibilidad de
 * la escritura. Si el navegador no puede, cae al data URL original.
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
          const maxDim = 2200;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          if (scale >= 1) {
            resolve(original);
            return;
          }
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(original);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } catch {
          resolve(original);
        }
      };
      img.onerror = () => resolve(original);
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

  const [patientName, setPatientName] = useState("");
  const [patientDocument, setPatientDocument] = useState("");
  const [linkedPatientId, setLinkedPatientId] = useState<string | null>(null);
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setTemplatesLoading(true);
      setTemplatesError(null);
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("clinical_templates")
        .select("id, name, description, sections")
        .eq("specialty_code", "bacteriologia")
        .eq("scope", "institutional")
        .eq("status", "active")
        .order("name");
      if (ignore) return;
      if (err) {
        setTemplates([]);
        setTemplatesError("No se pudieron cargar las plantillas de laboratorio.");
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

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

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
    if (file.size > MAX_IMAGE_BYTES * 2) {
      // Deja margen: la compresión reduce, pero un archivo enorme igual se rechaza.
      setError("La imagen es demasiado pesada. Toma la foto de nuevo o usa una más liviana.");
      return;
    }
    void fileToDataUrl(file).then((dataUrl) => {
      setImage(dataUrl);
      lastRun.current = null;
    });
  }

  async function analyze() {
    if (!selectedTemplate || !image || analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/clinical/note-from-photo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image, templateId: selectedTemplate.id }),
      });
      const data = (await res.json()) as {
        connected?: boolean;
        sections?: FilledSection[];
        warnings?: string[];
        error?: string;
      };

      if (!res.ok) {
        setError(
          data.error === "anthropic" || data.error === "parse"
            ? "La IA no pudo leer la foto. Reintenta con una imagen más nítida o rellena manualmente."
            : res.status === 413
              ? "La imagen supera 5 MB. Toma la foto de nuevo con menos resolución."
              : "No se pudo procesar la foto. Reintenta o rellena manualmente.",
        );
        return;
      }

      if (data.connected === false) {
        // Sin IA configurada: se rellena manualmente sobre las casillas de la plantilla.
        startManual();
        showToast("La IA no está disponible ahora. Rellena las casillas manualmente.", "warning");
        return;
      }

      lastRun.current = { image, templateId: selectedTemplate.id };
      setSections(
        (data.sections ?? []).map((section) => ({
          key: section.key,
          label: section.label,
          content: section.content ?? "",
        })),
      );
      setWarnings(data.warnings ?? []);
      setAiConnected(true);
      setSavedId(null);
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
    setAiConnected(false);
    setSavedId(null);
    setStep("review");
  }

  function updateSection(key: string, content: string) {
    setSections((list) =>
      list.map((section) => (section.key === key ? { ...section, content } : section)),
    );
    setSavedId(null);
  }

  function resetToSetup() {
    setStep("setup");
    setSections([]);
    setWarnings([]);
    setAiConnected(null);
    setSavedId(null);
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
    const motivo = (patientName.trim() || selectedTemplate?.name || "Informe de laboratorio").slice(0, 140);
    return {
      id: savedId ?? crypto.randomUUID(),
      pacienteId: linkedPatientId ?? "",
      medicoId: "",
      servicio: "Laboratorio",
      especialidad: professional.specialtyName ?? "Bacteriología",
      tipo: "laboratorio",
      estado: "borrador",
      fecha: new Date().toISOString(),
      duracionMin: 0,
      plantilla: selectedTemplate?.name ?? "Informe de laboratorio",
      motivo,
      note,
      transcript: [],
      resumen: firstFilled ? `${firstFilled.label}: ${firstFilled.content.trim().slice(0, 160)}` : "",
      codigos: [],
      auditoria: [],
    };
  }

  function save() {
    if (saving) return;
    setSaving(true);
    try {
      const consultation = buildConsultation();
      upsertConsultation(consultation);
      setSavedId(consultation.id);
      showToast("Nota de laboratorio guardada en el historial.", "success");
    } finally {
      setSaving(false);
    }
  }

  function download() {
    const ok = downloadLabReport({
      reportTitle: selectedTemplate?.name ?? "Informe de laboratorio",
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

  const canAnalyze = Boolean(selectedTemplate && image) && !analyzing;

  return (
    <div className="app-page max-w-4xl pb-24 sm:pb-8">
      <AppPageHeader
        kicker="Laboratorio · Bacteriología"
        title="Nota desde foto de la hoja"
        description="Toma una foto de tu hoja de trabajo y Miracle la vuelca en la plantilla. Revisa las casillas y descarga el informe para tu HIS."
        action={
          <span className="inline-flex items-center gap-2 rounded-[9px] border border-accent/25 bg-accent-soft/45 px-3 py-2 text-sm font-medium text-accent-ink">
            <Microscope size={15} /> Solo bacteriología
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
                No hay plantillas de laboratorio disponibles.
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
              accept="image/jpeg,image/png,image/webp,image/gif"
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
                <span className="text-xs text-muted">JPG, PNG o WebP · hasta 5 MB</span>
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
                {selectedTemplate?.name ?? "Informe de laboratorio"}
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
            {savedId ? (
              <span className="mr-auto hidden items-center gap-1.5 text-sm font-medium text-mint-ink sm:inline-flex">
                <Check size={15} /> Guardada en el historial
              </span>
            ) : null}
            <button type="button" onClick={save} disabled={saving} className="clinical-secondary min-h-11 px-4">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {savedId ? "Guardar cambios" : "Guardar en historial"}
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
