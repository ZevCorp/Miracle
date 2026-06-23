"use client";

import { useMemo, useState } from "react";
import { FileText, Layers3, Stethoscope } from "lucide-react";
import { clinicalSpecialties } from "@/lib/clinical/specialties";
import { CLINICAL_TEMPLATE_COUNT } from "@/lib/clinical/template-catalog";
import { templates as catalogTemplates, type Template } from "@/lib/mock";
import { Badge } from "@/components/ui/Badge";

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
  const templates = useMemo(
    () => catalogTemplates.filter((template) => template.especialidadCode === specialtyCode),
    [specialtyCode],
  );
  const [selectedId, setSelectedId] = useState(`${defaultSpecialty}-inicial`);
  const selected = templates.find((template) => template.id === selectedId) ?? templates[0];
  const specialty = clinicalSpecialties.find((item) => item.code === specialtyCode);

  function changeSpecialty(code: string) {
    setSpecialtyCode(code);
    setSelectedId(`${code}-inicial`);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Catálogo institucional
          </span>
          <h1 className="mt-1 text-2xl font-semibold text-deep">Plantillas clínicas</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Tres estructuras iniciales por cada especialidad clínica, quirúrgica, diagnóstica, de salud mental y odontología.
          </p>
        </div>
        <div className="flex gap-2">
          <Metric label="Especialidades" value={String(clinicalSpecialties.length)} />
          <Metric label="Plantillas" value={String(CLINICAL_TEMPLATE_COUNT)} />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-line bg-white p-4 shadow-[var(--shadow-sm)]">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-deep sm:max-w-md">
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
      </div>

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
              <p className="mt-1 text-sm text-muted">{specialty?.name}</p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-ice text-accent">
              <Stethoscope size={19} />
            </span>
          </div>
          <div className="mt-5 space-y-2">
            {selected?.secciones.map((section, index) => (
              <div
                key={section}
                className="flex items-center gap-3 rounded-md border border-line bg-pearl px-3 py-2.5 text-sm text-ink-soft"
              >
                <span className="text-xs font-semibold text-muted">{String(index + 1).padStart(2, "0")}</span>
                {section}
              </div>
            ))}
          </div>
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
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-deep">{template.nombre}</span>
          {template.predeterminada ? <Badge tone="accent">Predeterminada</Badge> : null}
        </span>
        <span className="mt-1 block text-xs text-muted">
          {template.secciones.length} secciones · lista para personalizar
        </span>
      </span>
      <Layers3 size={18} className="shrink-0 text-muted" />
    </button>
  );
}
