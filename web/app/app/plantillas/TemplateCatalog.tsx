"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, FileText, Layers3, Plus, Save, Stethoscope, Trash2 } from "lucide-react";
import { clinicalSpecialties } from "@/lib/clinical/specialties";
import { CLINICAL_TEMPLATE_COUNT } from "@/lib/clinical/template-catalog";
import { templates as catalogTemplates, type Template } from "@/lib/mock";
import { Badge } from "@/components/ui/Badge";
import {
  createCustomTemplate,
  deleteCustomTemplate,
  type TemplateFormState,
} from "./actions";

const initialFormState: TemplateFormState = {};
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
  "mt-1.5 w-full rounded-md border border-line bg-white px-3.5 py-2.5 text-sm text-deep outline-none transition-colors focus:border-accent";

export function TemplateCatalog({
  initialSpecialtyCode,
  customTemplates = [],
}: {
  initialSpecialtyCode?: string | null;
  customTemplates?: Template[];
}) {
  const router = useRouter();
  const defaultSpecialty = clinicalSpecialties.some(
    (specialty) => specialty.code === initialSpecialtyCode,
  )
    ? initialSpecialtyCode!
    : "medicina-general";

  const [specialtyCode, setSpecialtyCode] = useState(defaultSpecialty);
  const [selectedId, setSelectedId] = useState(`${defaultSpecialty}-inicial`);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftSpecialtyCode, setDraftSpecialtyCode] = useState(defaultSpecialty);
  const [draftSections, setDraftSections] = useState(defaultSections);
  const [state, formAction, pending] = useActionState(
    createCustomTemplate,
    initialFormState,
  );

  const allTemplates = useMemo(
    () => [...customTemplates, ...catalogTemplates],
    [customTemplates],
  );

  const templates = useMemo(
    () => allTemplates.filter((template) => template.especialidadCode === specialtyCode),
    [allTemplates, specialtyCode],
  );

  const selected = templates.find((template) => template.id === selectedId) ?? templates[0];
  const specialty = clinicalSpecialties.find((item) => item.code === specialtyCode);
  const personalCount = customTemplates.length;
  const sectionsPreview = useMemo(
    () =>
      draftSections
        .split(/\r?\n/)
        .map((section) => section.trim())
        .filter(Boolean),
    [draftSections],
  );

  useEffect(() => {
    if (state.status !== "success") return;
    router.refresh();
  }, [router, state.status]);

  function changeSpecialty(code: string) {
    setSpecialtyCode(code);
    setDraftSpecialtyCode(code);
    setSelectedId(`${code}-inicial`);
  }

  function startFromTemplate(template: Template) {
    setBuilderOpen(true);
    setDraftName(`${template.nombre} personalizada`);
    setDraftDescription(template.descripcion ?? "");
    setDraftSpecialtyCode(template.especialidadCode ?? specialtyCode);
    setDraftSections(template.secciones.join("\n"));
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
          <Metric label="Institucionales" value={String(CLINICAL_TEMPLATE_COUNT)} />
          <Metric label="Mías" value={String(personalCount)} />
        </div>
      </div>

      <section className="mt-6 rounded-lg border border-line bg-white p-4 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-deep lg:max-w-md">
            Especialidad o servicio
            <select
              value={specialtyCode}
              onChange={(event) => changeSpecialty(event.target.value)}
              className="rounded-md border border-line bg-white px-3.5 py-2.5 text-sm font-normal outline-none transition-colors focus:border-accent"
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
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <Plus size={16} /> Nueva plantilla
          </button>
        </div>

        {builderOpen ? (
          <form action={formAction} className="mt-5 rounded-lg border border-line bg-pearl p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-4">
                {state.message ? (
                  <p
                    role="status"
                    className={`rounded-md border px-3 py-2 text-sm ${
                      state.status === "success"
                        ? "border-success/30 bg-mint-soft text-success"
                        : "border-danger/30 bg-danger/10 text-danger"
                    }`}
                  >
                    {state.message}
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

              <aside className="rounded-lg border border-line bg-white p-4">
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
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={16} /> {pending ? "Guardando..." : "Guardar plantilla"}
              </button>
            </div>
          </form>
        ) : null}
      </section>

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

        <aside className="h-fit rounded-lg border border-line bg-white p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Vista previa</div>
              <h2 className="mt-1 text-lg font-semibold text-deep">{selected?.nombre}</h2>
              <p className="mt-1 text-sm text-muted">{selected?.descripcion || specialty?.name}</p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-ice text-accent">
              <Stethoscope size={19} />
            </span>
          </div>
          <div className="mt-5 space-y-2">
            {selected?.secciones.map((section, index) => (
              <div
                key={`${section}-${index}`}
                className="flex items-center gap-3 rounded-md border border-line bg-pearl px-3 py-2.5 text-sm text-ink-soft"
              >
                <span className="text-xs font-semibold text-muted">{String(index + 1).padStart(2, "0")}</span>
                {section}
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

              {selected.source === "personal" ? (
                <form action={deleteCustomTemplate}>
                  <input type="hidden" name="id" value={selected.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-full border border-danger/30 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/10"
                  >
                    <Trash2 size={15} /> Eliminar
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white px-3.5 py-2 text-right shadow-[var(--shadow-sm)]">
      <div className="text-lg font-semibold leading-none text-deep">{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

function TemplateChoice({
  template,
  active,
  onSelect,
}: {
  template: Template;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg border bg-white p-4 text-left shadow-[var(--shadow-sm)] transition-colors ${
        active ? "border-accent ring-1 ring-accent/25" : "border-line hover:border-mist"
      }`}
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ice text-accent">
        <FileText size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-deep">{template.nombre}</span>
          {template.predeterminada ? <Badge tone="accent">Predeterminada</Badge> : null}
          {template.source === "personal" ? <Badge tone="success">Mía</Badge> : null}
        </span>
        <span className="mt-1 block text-xs text-muted">
          {template.secciones.length} secciones · {template.especialidad}
        </span>
      </span>
      <Layers3 size={18} className="shrink-0 text-muted" />
    </button>
  );
}
