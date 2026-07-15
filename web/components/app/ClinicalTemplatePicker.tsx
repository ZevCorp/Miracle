"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, FileText, Search, X } from "lucide-react";
import {
  sortedTemplateSections,
  type ClinicalTemplate,
} from "@/lib/api/clinical";

export function ClinicalTemplatePicker({
  templates,
  value,
  onChange,
  disabled = false,
  label = "Plantilla de nota",
}: {
  templates: ClinicalTemplate[];
  value: string;
  onChange: (templateId: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected =
    templates.find((template) => template.id === value) ?? templates[0];
  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es");
    if (!term) return templates;
    return templates.filter((template) =>
      `${template.name} ${template.specialty} ${template.description ?? ""}`
        .toLocaleLowerCase("es")
        .includes(term),
    );
  }, [query, templates]);

  if (!selected) return null;
  const sections = sortedTemplateSections(selected.sections).slice(0, 4);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3.5 text-left shadow-[var(--shadow-xs)] transition hover:border-accent/50 hover:bg-ice-soft focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ice text-accent">
          <FileText size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-deep">
              {selected.name}
            </span>
            {selected.scope === "personal" ? (
              <span className="rounded-full bg-mint-soft px-2 py-0.5 text-xs font-semibold text-success">
                Mía
              </span>
            ) : (
              <span className="rounded-full bg-ice px-2 py-0.5 text-xs font-semibold text-accent-ink">
                Institucional
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {selected.description || selected.specialty.replace(/_/g, " ")} ·{" "}
            {selected.sections.length} secciones
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
          Cambiar <ChevronDown size={15} />
        </span>
      </button>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sections.map((section) => (
          <span
            key={section.key}
            className="rounded-full border border-line bg-pearl px-2 py-1 text-xs text-ink-soft"
          >
            {section.label}
          </span>
        ))}
        {selected.sections.length > sections.length ? (
          <span className="px-1 py-1 text-xs text-muted">
            +{selected.sections.length - sections.length}
          </span>
        ) : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-overlay p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
          <button
            type="button"
            aria-label="Cerrar selector de plantilla"
            onClick={() => setOpen(false)}
            className="absolute inset-0"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="relative flex h-dvh max-h-dvh w-full max-w-2xl flex-col overflow-hidden bg-surface shadow-[var(--shadow-xl)] sm:h-auto sm:max-h-[min(720px,calc(100dvh-2rem))] sm:rounded-2xl sm:border sm:border-line"
          >
            <header className="app-mobile-header flex items-start justify-between gap-4 border-b border-line px-4 py-4 sm:h-auto sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                  Antes de iniciar
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold text-deep">
                  Elige la estructura de la nota
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Todas las plantillas activas están disponibles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                title="Cerrar selector"
                className="rounded-lg p-2 text-muted hover:bg-ice-soft hover:text-deep"
              >
                <X size={18} />
              </button>
            </header>
            <div className="border-b border-line px-5 py-3 sm:px-6">
              <div className="flex items-center gap-2 rounded-lg border border-line bg-pearl px-3 py-2 focus-within:border-accent">
                <Search size={16} className="text-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nombre o especialidad"
                  className="min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Limpiar búsqueda"
                    className="text-muted hover:text-deep"
                  >
                    <X size={15} />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="space-y-2">
                {results.map((template) => {
                  const active = template.id === selected.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        onChange(template.id);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition ${active ? "border-accent bg-accent-soft/35" : "border-line hover:border-mist hover:bg-pearl"}`}
                    >
                      <span
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-accent text-white" : "bg-ice text-accent"}`}
                      >
                        <FileText size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-deep">
                            {template.name}
                          </span>
                          {template.is_default ? (
                            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                              Sugerida
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {template.specialty.replace(/_/g, " ")} ·{" "}
                          {template.sections.length} secciones ·{" "}
                          {template.scope === "personal"
                            ? "Personal"
                            : "Institucional"}
                        </span>
                      </span>
                      {active ? (
                        <Check size={18} className="shrink-0 text-accent" />
                      ) : null}
                    </button>
                  );
                })}
                {results.length === 0 ? (
                  <p className="p-8 text-center text-sm text-muted">
                    No encontramos una plantilla con esa búsqueda.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
