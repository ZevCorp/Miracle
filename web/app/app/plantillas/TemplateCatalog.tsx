"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Copy,
  FileText,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Stethoscope,
} from "lucide-react";
import { clinicalSpecialties } from "@/lib/clinical/specialties";
import {
  archiveClinicalTemplate,
  createClinicalTemplate,
  friendlyClinicalMessage,
  getClinicalTemplates,
  normalizeSpecialtyCode,
  parseTemplateSectionsInput,
  sortedTemplateSections,
  type ClinicalTemplate,
} from "@/lib/api/clinical";
import { Badge } from "@/components/ui/Badge";

const defaultSections = [
  "Identificación",
  "Motivo de consulta",
  "Enfermedad actual",
  "Antecedentes relevantes",
  "Examen físico dirigido",
  "Impresión diagnóstica",
  "Plan y recomendaciones",
].join("\n");

const fieldClass =
  "mt-1.5 w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-deep outline-none transition-colors focus:border-accent";

/** Nombre legible de una especialidad del backend (llega en snake_case). */
function specialtyLabel(specialty: string): string {
  const normalized = normalizeSpecialtyCode(specialty);
  const match = clinicalSpecialties.find(
    (item) => normalizeSpecialtyCode(item.code) === normalized,
  );
  return match?.name ?? specialty.replace(/_/g, " ");
}

export function TemplateCatalog({
  initialSpecialtyCode,
}: {
  initialSpecialtyCode?: string | null;
}) {
  const defaultSpecialty = clinicalSpecialties.some(
    (specialty) => specialty.code === initialSpecialtyCode,
  )
    ? initialSpecialtyCode!
    : "medicina-general";

  const [specialtyCode, setSpecialtyCode] = useState(defaultSpecialty);
  const [templates, setTemplates] = useState<ClinicalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftSpecialtyCode, setDraftSpecialtyCode] = useState(defaultSpecialty);
  const [draftSections, setDraftSections] = useState(defaultSections);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [archivingId, setArchivingId] = useState<string | null>(null);

  // Re-dispara la carga sin cambiar de especialidad (Reintentar, post-crear…).
  const [reloadKey, setReloadKey] = useState(0);

  // El estado "cargando" lo enciende quien dispara la carga (montaje inicial,
  // cambio de especialidad o Reintentar); aquí solo se resuelve el resultado.
  // `ignore` descarta respuestas viejas si el médico cambia rápido de filtro.
  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        // El backend filtra institucionales + personales por especialidad y ya
        // las ordena (is_default desc, name asc). Acepta el slug con guiones.
        const list = await getClinicalTemplates({ specialty: specialtyCode });
        if (ignore) return;
        setTemplates(list);
        setLoadError(null);
      } catch (error) {
        if (ignore) return;
        setTemplates([]);
        setLoadError(friendlyClinicalMessage(error));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, [specialtyCode, reloadKey]);

  function retryLoad() {
    setLoading(true);
    setLoadError(null);
    setReloadKey((key) => key + 1);
  }

  // Selección derivada: si el id elegido ya no está en la lista, cae a la primera.
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];
  const specialty = clinicalSpecialties.find((item) => item.code === specialtyCode);
  const institutionalCount = templates.filter((t) => t.scope === "institutional").length;
  const personalCount = templates.filter((t) => t.scope === "personal").length;
  const selectedSections = sortedTemplateSections(selected?.sections);

  const sectionsPreview = useMemo(
    () => parseTemplateSectionsInput(draftSections),
    [draftSections],
  );

  function changeSpecialty(code: string) {
    setSpecialtyCode(code);
    setDraftSpecialtyCode(code);
    setSelectedId(null);
    setLoading(true);
    setLoadError(null);
  }

  function startFromTemplate(template: ClinicalTemplate) {
    setBuilderOpen(true);
    setFormError(null);
    setDraftName(`${template.name} personalizada`);
    setDraftDescription(template.description ?? "");
    const code = clinicalSpecialties.find(
      (item) => normalizeSpecialtyCode(item.code) === normalizeSpecialtyCode(template.specialty),
    )?.code;
    setDraftSpecialtyCode(code ?? specialtyCode);
    setDraftSections(
      sortedTemplateSections(template.sections)
        .map((section) => section.label)
        .join("\n"),
    );
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const name = draftName.trim();
    const description = draftDescription.trim();
    const sections = parseTemplateSectionsInput(draftSections);

    if (name.length < 3 || name.length > 120) {
      setFormError("El nombre debe tener entre 3 y 120 caracteres.");
      return;
    }
    if (description.length > 400) {
      setFormError("La descripción no puede superar 400 caracteres.");
      return;
    }
    if (sections.length < 2) {
      setFormError("Agrega mínimo 2 secciones, una por línea.");
      return;
    }
    if (sections.length > 30) {
      setFormError("Máximo 30 secciones por plantilla.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setFeedback(null);
    try {
      const created = await createClinicalTemplate({
        name,
        specialty: draftSpecialtyCode,
        description: description || undefined,
        sections,
      });
      setFeedback("Plantilla guardada.");
      setBuilderOpen(false);
      setDraftName("");
      setDraftDescription("");
      setDraftSections(defaultSections);
      // Selecciona la recién creada; la lista se refresca desde el backend.
      setSelectedId(created.id);
      // Si la creó en otra especialidad, cambia el filtro para que se vea.
      const createdCode = clinicalSpecialties.find(
        (item) =>
          normalizeSpecialtyCode(item.code) === normalizeSpecialtyCode(created.specialty),
      )?.code;
      if (createdCode && createdCode !== specialtyCode) {
        setSpecialtyCode(createdCode);
        setLoading(true);
      } else {
        setReloadKey((key) => key + 1);
      }
    } catch (error) {
      setFormError(friendlyClinicalMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(template: ClinicalTemplate) {
    if (archivingId) return;
    setArchivingId(template.id);
    setFeedback(null);
    try {
      await archiveClinicalTemplate(template.id);
      setFeedback("Plantilla archivada.");
      setReloadKey((key) => key + 1);
    } catch (error) {
      setFeedback(friendlyClinicalMessage(error));
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Catálogo y plantillas personales
          </span>
          <h1 className="mt-1 text-2xl font-semibold text-deep">Plantillas clínicas</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Usa las estructuras institucionales como base o crea tus propias plantillas
            por especialidad. Las plantillas personales quedan guardadas en tu cuenta.
          </p>
        </div>
        <div className="flex gap-2">
          <Metric label="Especialidades" value={String(clinicalSpecialties.length)} />
          <Metric label="Institucionales" value={loading ? "…" : String(institutionalCount)} />
          <Metric label="Mías" value={loading ? "…" : String(personalCount)} />
        </div>
      </div>

      <section className="mt-6 rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-deep lg:max-w-md">
            Especialidad o servicio
            <select
              value={specialtyCode}
              onChange={(event) => changeSpecialty(event.target.value)}
              className="rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm font-normal outline-none transition-colors focus:border-accent"
            >
              {clinicalSpecialties.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name} · {item.group}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setBuilderOpen((open) => !open);
              setDraftSpecialtyCode(specialtyCode);
              setFormError(null);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <Plus size={16} /> Nueva plantilla
          </button>
        </div>

        {feedback ? (
          <p
            role="status"
            className="mt-4 rounded-md border border-success/30 bg-mint-soft px-3 py-2 text-sm text-success"
          >
            {feedback}
          </p>
        ) : null}

        {builderOpen ? (
          <form onSubmit={handleCreate} className="mt-5 rounded-lg border border-line bg-pearl p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-4">
                {formError ? (
                  <p
                    role="alert"
                    className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
                  >
                    {formError}
                  </p>
                ) : null}

                <label className="block text-sm font-medium text-deep">
                  Nombre de la plantilla
                  <input
                    name="name"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    className={fieldClass}
                    placeholder="Ej. Control de hipertensión"
                    maxLength={120}
                    required
                  />
                </label>

                <label className="block text-sm font-medium text-deep">
                  Especialidad
                  <select
                    name="specialtyCode"
                    value={draftSpecialtyCode}
                    onChange={(event) => setDraftSpecialtyCode(event.target.value)}
                    className={fieldClass}
                  >
                    {clinicalSpecialties.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name} · {item.group}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-deep">
                  Descripción corta <span className="font-normal text-muted">(opcional)</span>
                  <input
                    name="description"
                    value={draftDescription}
                    onChange={(event) => setDraftDescription(event.target.value)}
                    className={fieldClass}
                    placeholder="Para qué tipo de atención usarla"
                    maxLength={400}
                  />
                </label>

                <label className="block text-sm font-medium text-deep">
                  Secciones de la nota
                  <textarea
                    name="sections"
                    value={draftSections}
                    onChange={(event) => setDraftSections(event.target.value)}
                    className={`${fieldClass} min-h-48 resize-y`}
                    placeholder="Una sección por línea"
                    required
                  />
                  <span className="mt-1 block text-xs font-normal text-muted">
                    Escribe una sección por línea. Mínimo 2, máximo 30.
                  </span>
                </label>
              </div>

              <aside className="rounded-lg border border-line bg-surface p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Vista previa rápida
                </div>
                <h2 className="mt-1 font-semibold text-deep">
                  {draftName || "Nueva plantilla"}
                </h2>
                <div className="mt-4 space-y-2">
                  {sectionsPreview.length ? (
                    sectionsPreview.map((section, index) => (
                      <div
                        key={`${section}-${index}`}
                        className="flex items-center gap-3 rounded-md border border-line bg-pearl px-3 py-2 text-sm text-ink-soft"
                      >
                        <span className="text-xs font-semibold text-muted">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {section}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted">Agrega secciones para ver la estructura.</p>
                  )}
                </div>
              </aside>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBuilderOpen(false)}
                className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-deep hover:border-mist"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={16} /> {saving ? "Guardando plantilla..." : "Guardar plantilla"}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {loadError ? (
        <div
          role="alert"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={retryLoad}
            className="inline-flex items-center gap-1.5 rounded-full border border-danger/40 px-3.5 py-1.5 text-sm font-semibold text-danger hover:bg-danger/10"
          >
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-line bg-surface p-10 text-sm text-muted">
          <Loader2 size={18} className="animate-spin text-accent" /> Cargando plantillas...
        </div>
      ) : null}

      {!loading && !loadError && templates.length === 0 ? (
        <p className="mt-5 rounded-lg border border-line bg-surface p-6 text-sm text-muted">
          No hay plantillas para esta especialidad. Crea la primera con «Nueva plantilla».
        </p>
      ) : null}

      {!loading && templates.length > 0 ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <section className="space-y-3">
            {templates.map((template) => (
              <TemplateChoice
                key={template.id}
                template={template}
                active={template.id === selected?.id}
                onSelect={() => setSelectedId(template.id)}
              />
            ))}
          </section>

          <aside className="h-fit rounded-lg border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Vista previa
                </div>
                <h2 className="mt-1 text-lg font-semibold text-deep">{selected?.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {selected?.description || specialty?.name}
                </p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-ice text-accent">
                <Stethoscope size={19} />
              </span>
            </div>
            <div className="mt-5 space-y-2">
              {selectedSections.map((section) => (
                <div
                  key={section.key}
                  className="flex items-center gap-3 rounded-md border border-line bg-pearl px-3 py-2.5 text-sm text-ink-soft"
                >
                  <span className="text-xs font-semibold text-muted">
                    {String(section.order).padStart(2, "0")}
                  </span>
                  {section.label}
                </div>
              ))}
            </div>

            {selected ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => startFromTemplate(selected)}
                  className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-deep hover:border-mist"
                >
                  <Copy size={15} /> Usar como base
                </button>

                {selected.scope === "personal" ? (
                  <button
                    type="button"
                    onClick={() => void handleArchive(selected)}
                    disabled={archivingId === selected.id}
                    className="inline-flex items-center gap-2 rounded-full border border-danger/30 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Archive size={15} />
                    {archivingId === selected.id ? "Archivando..." : "Archivar"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-surface px-3.5 py-2 text-right shadow-[var(--shadow-sm)]">
      <div className="text-lg font-semibold leading-none text-deep">{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
    </div>
  );
}

function TemplateChoice({
  template,
  active,
  onSelect,
}: {
  template: ClinicalTemplate;
  active: boolean;
  onSelect: () => void;
}) {
  const sectionCount = template.sections_count ?? template.sections.length;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg border bg-surface p-4 text-left shadow-[var(--shadow-sm)] transition-colors ${
        active ? "border-accent ring-1 ring-accent/25" : "border-line hover:border-mist"
      }`}
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ice text-accent">
        <FileText size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-deep">{template.name}</span>
          {template.is_default ? <Badge tone="accent">Predeterminada</Badge> : null}
          {template.scope === "personal" ? <Badge tone="success">Mía</Badge> : null}
        </span>
        <span className="mt-1 block text-xs text-muted">
          {sectionCount} secciones · {specialtyLabel(template.specialty)}
        </span>
      </span>
      <Layers3 size={18} className="shrink-0 text-muted" />
    </button>
  );
}
