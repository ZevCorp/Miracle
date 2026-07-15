"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Copy,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import {
  archiveClinicalTemplate,
  createClinicalTemplateDraftFromExample,
  friendlyClinicalMessage,
  getClinicalTemplates,
  sortedTemplateSections,
  type ClinicalTemplate,
  type CreateClinicalTemplatePayload,
} from "@/lib/api/clinical";
import { specialtyDisplayName } from "@/lib/clinical/medical-areas";
import {
  TemplateBuilderPanel,
  type BuilderMode,
} from "@/components/app/TemplateBuilderPanel";

type ScopeFilter = "todas" | "mias" | "institucionales";
type CreationMode = "choice" | "example" | null;

interface BuilderState {
  mode: BuilderMode;
  baseTemplate?: ClinicalTemplate;
  initialDraft?: CreateClinicalTemplatePayload;
}

export function TemplateCatalog({
  initialSpecialtyCode,
}: {
  initialSpecialtyCode?: string | null;
}) {
  const [templates, setTemplates] = useState<ClinicalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ScopeFilter>("todas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [builder, setBuilder] = useState<BuilderState | null>(null);
  const [creation, setCreation] = useState<CreationMode>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getClinicalTemplates()
      .then((result) => {
        if (cancelled) return;
        setTemplates(result);
        setError(null);
      })
      .catch((loadError) => {
        if (!cancelled) setError(friendlyClinicalMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es");
    return templates
      .filter((template) => {
        if (filter === "mias" && template.scope !== "personal") return false;
        if (filter === "institucionales" && template.scope === "personal")
          return false;
        return (
          !term ||
          `${template.name} ${template.specialty} ${template.description ?? ""}`
            .toLocaleLowerCase("es")
            .includes(term)
        );
      })
      .sort((a, b) => {
        const score = (template: ClinicalTemplate) =>
          (template.scope === "personal" ? 1 : 0) +
          (template.is_default ? -2 : 0);
        return score(a) - score(b) || a.name.localeCompare(b.name, "es");
      });
  }, [filter, query, templates]);

  const selected =
    visible.find((template) => template.id === selectedId) ??
    visible[0] ??
    null;
  const specialty =
    initialSpecialtyCode || selected?.specialty || "medicina-general";
  const personalTotal = templates.filter(
    (template) => template.scope === "personal",
  ).length;

  function reload() {
    setReloadKey((value) => value + 1);
  }
  function saved(template: ClinicalTemplate, action: "created" | "updated") {
    setBuilder(null);
    setCreation(null);
    setSelectedId(template.id);
    setFeedback(
      action === "created"
        ? "Plantilla guardada y lista para usar."
        : "Cambios guardados.",
    );
    reload();
  }
  async function archive(template: ClinicalTemplate) {
    if (
      !window.confirm(
        `¿Archivar «${template.name}»? Ya no aparecerá al iniciar consultas.`,
      )
    )
      return;
    setArchivingId(template.id);
    try {
      await archiveClinicalTemplate(template.id);
      setFeedback("Plantilla archivada.");
      setSelectedId(null);
      reload();
    } catch (archiveError) {
      setFeedback(friendlyClinicalMessage(archiveError));
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <div className="app-page max-w-7xl">
      <header className="border-b border-line pb-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="app-page-kicker text-accent">
              Biblioteca clínica
            </p>
            <h1 className="app-page-title mt-1">
              Plantillas de nota
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Elige una estructura para la consulta o crea una propia.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreation("choice")}
            className="clinical-primary min-h-12 w-full px-5 sm:w-auto"
          >
            <Plus size={17} /> Crear plantilla
          </button>
        </div>
        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="font-semibold text-deep">{templates.length}</span>{" "}
            plantillas activas <span className="text-line">·</span>{" "}
            <span className="font-semibold text-deep">{personalTotal}</span>{" "}
            personales
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="clinical-control flex items-center gap-2 px-3">
              <Search size={16} className="text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar plantilla"
                aria-label="Buscar plantilla"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none sm:w-64"
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
            <div className="grid grid-cols-3 rounded-[10px] border border-line bg-surface p-1">
              {(
                [
                  ["todas", "Todas"],
                  ["mias", "Mis plantillas"],
                  ["institucionales", "Institucionales"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`min-h-10 rounded-[8px] px-1.5 py-1.5 text-[12px] font-semibold sm:px-3 ${filter === id ? "bg-accent text-white" : "text-ink-soft hover:bg-ice-soft"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {feedback ? (
        <p
          role="status"
          className="mt-4 rounded-lg border border-success/25 bg-mint-soft px-4 py-3 text-sm text-success"
        >
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          No se pudieron cargar las plantillas. {error}
        </p>
      ) : null}
      {loading ? (
        <div className="mt-8 flex justify-center rounded-xl border border-line bg-surface p-14 text-sm text-muted">
          <Loader2 size={18} className="mr-2 animate-spin text-accent" />{" "}
          Cargando biblioteca clínica…
        </div>
      ) : null}
      {!loading && !error ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(330px,.8fr)]">
          <section aria-label="Plantillas disponibles" className="space-y-3">
            {visible.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                active={template.id === selected?.id}
                onSelect={() => setSelectedId(template.id)}
              />
            ))}
            {visible.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
                <p className="font-semibold text-deep">
                  No hay plantillas que coincidan
                </p>
                <p className="mt-1 text-sm text-muted">
                  Cambia la búsqueda o crea una nueva estructura clínica.
                </p>
              </div>
            ) : null}
          </section>
          {selected ? (
            <div className="hidden lg:block">
              <TemplatePreview
                template={selected}
                archiving={archivingId === selected.id}
                onBase={() => setBuilder({ mode: "base", baseTemplate: selected })}
                onEdit={() => setBuilder({ mode: "edit", baseTemplate: selected })}
                onArchive={() => void archive(selected)}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedId && selected ? (
        <div className="fixed inset-0 z-50 flex items-end bg-overlay lg:hidden">
          <button type="button" aria-label="Cerrar vista previa" onClick={() => setSelectedId(null)} className="absolute inset-0" />
          <div className="mobile-bottom-sheet relative max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-3 shadow-[var(--shadow-xl)]">
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Cerrar vista previa" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line text-muted"><X size={18} /></button>
            </div>
            <TemplatePreview
              template={selected}
              archiving={archivingId === selected.id}
              onBase={() => setBuilder({ mode: "base", baseTemplate: selected })}
              onEdit={() => setBuilder({ mode: "edit", baseTemplate: selected })}
              onArchive={() => void archive(selected)}
            />
          </div>
        </div>
      ) : null}

      {creation === "choice" ? (
        <CreationChoice
          onClose={() => setCreation(null)}
          onManual={() => {
            setCreation(null);
            setBuilder({ mode: "scratch" });
          }}
          onExample={() => setCreation("example")}
        />
      ) : null}
      {creation === "example" ? (
        <ExampleDialog
          specialty={specialty}
          onClose={() => setCreation(null)}
          onDraft={(draft) => {
            setCreation(null);
            setBuilder({ mode: "scratch", initialDraft: draft });
          }}
        />
      ) : null}
      {builder ? (
        <TemplateBuilderPanel
          mode={builder.mode}
          baseTemplate={builder.baseTemplate}
          initialDraft={builder.initialDraft}
          initialSpecialtyCode={specialty}
          onClose={() => setBuilder(null)}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}

function TemplateRow({
  template,
  active,
  onSelect,
}: {
  template: ClinicalTemplate;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex w-full items-center gap-4 rounded-[14px] border p-4 text-left transition-colors ${active ? "border-accent bg-accent-soft/25" : "border-line bg-surface hover:border-mist hover:bg-ice-soft/40"}`}
    >
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${active ? "bg-accent text-white" : "bg-ice text-accent"}`}
      >
        <FileText size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-deep">
            {template.name}
          </span>
          {template.is_default ? (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[12px] font-semibold text-accent">
              Sugerida
            </span>
          ) : null}
          {template.scope === "personal" ? (
            <span className="rounded-full bg-mint-soft px-2 py-0.5 text-[12px] font-semibold text-success">
              Personal
            </span>
          ) : null}
        </span>
        <span className="mt-1 block truncate text-[13px] text-muted">
          {specialtyDisplayName(template.specialty)} ·{" "}
          {template.description ||
            `${template.sections.length} secciones clínicas`}
        </span>
      </span>
      <span className="hidden text-right text-xs text-muted sm:block">
        <strong className="block text-sm text-deep">
          {template.sections.length}
        </strong>
        secciones
      </span>
    </button>
  );
}

function TemplatePreview({
  template,
  archiving,
  onBase,
  onEdit,
  onArchive,
}: {
  template: ClinicalTemplate;
  archiving: boolean;
  onBase: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const personal = template.scope === "personal";
  return (
    <aside className="h-fit rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-xs)] lg:sticky lg:top-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ice text-accent">
          <Stethoscope size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted">
            Vista de la nota
          </p>
          <h2 className="mt-1 text-lg font-semibold text-deep">
            {template.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {template.description || specialtyDisplayName(template.specialty)}
          </p>
        </div>
      </div>
      <div className="mt-5 border-l border-line pl-4">
        {sortedTemplateSections(template.sections).map((section, index) => (
          <div key={section.key} className="relative pb-3 last:pb-0">
            <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" />
            <p className="text-sm font-medium text-deep">
              {String(index + 1).padStart(2, "0")} · {section.label}
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              {section.required ? "Obligatoria" : "Opcional"}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 border-l-2 border-accent bg-accent-soft/20 px-3 py-2.5">
        <p className="text-[13px] font-semibold text-accent-ink">
          Cierre clínico universal
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Incluye plan, recomendaciones y signos de alarma.
        </p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onBase}
          className="clinical-primary"
        >
          <Copy size={15} /> Usar como base
        </button>
        {personal ? (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="clinical-secondary"
            >
              <Pencil size={15} /> Editar
            </button>
            <button
              type="button"
              onClick={onArchive}
              disabled={archiving}
              className="clinical-secondary border-danger/35 text-danger hover:bg-danger-soft"
            >
              <Archive size={15} /> {archiving ? "Archivando…" : "Archivar"}
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}

function CreationChoice({
  onClose,
  onManual,
  onExample,
}: {
  onClose: () => void;
  onManual: () => void;
  onExample: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-overlay p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Crear plantilla"
        className="mobile-bottom-sheet relative w-full max-w-xl rounded-t-3xl border border-b-0 border-line bg-surface p-5 shadow-[var(--shadow-xl)] sm:rounded-2xl sm:border-b sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          title="Cerrar"
          className="absolute right-4 top-4 rounded-lg p-2 text-muted hover:bg-ice-soft"
        >
          <X size={18} />
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          Nueva plantilla
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-deep">
          ¿Cómo quieres empezar?
        </h2>
        <p className="mt-2 text-sm text-muted">
          Elige una base clara; siempre podrás revisar y cambiar cada sección.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onManual}
            className="rounded-xl border border-line p-4 text-left hover:border-accent hover:bg-ice-soft"
          >
            <FileText size={20} className="text-accent" />
            <p className="mt-4 font-semibold text-deep">Estructura clínica</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Empieza con secciones recomendadas y personalízalas.
            </p>
          </button>
          <button
            type="button"
            onClick={onExample}
            className="rounded-xl border border-accent/25 bg-accent-soft/20 p-4 text-left hover:border-accent"
          >
            <Sparkles size={20} className="text-accent" />
            <p className="mt-4 font-semibold text-deep">
              Desde una nota ejemplo
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Miracle propone un borrador que tú revisas antes de guardar.
            </p>
          </button>
        </div>
      </section>
    </div>
  );
}

function ExampleDialog({
  specialty,
  onClose,
  onDraft,
}: {
  specialty: string;
  onClose: () => void;
  onDraft: (draft: CreateClinicalTemplatePayload) => void;
}) {
  const [example, setExample] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function createDraft() {
    if (!example.trim() || !consent) return;
    setLoading(true);
    setError(null);
    try {
      const proposal = await createClinicalTemplateDraftFromExample({
        specialty,
        example_text: example,
      });
      onDraft(proposal.template);
    } catch (draftError) {
      setError(friendlyClinicalMessage(draftError));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-overlay p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Crear borrador desde ejemplo"
        className="relative flex h-dvh max-h-dvh w-full max-w-2xl flex-col overflow-hidden bg-surface shadow-[var(--shadow-xl)] sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl sm:border sm:border-line"
      >
        <header className="app-mobile-header border-b border-line px-4 py-4 sm:h-auto sm:px-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar"
            className="absolute right-4 top-4 rounded-lg p-2 text-muted hover:bg-ice-soft"
          >
            <X size={18} />
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            Borrador asistido
          </p>
          <h2 className="mt-1 text-xl font-semibold text-deep">
            Convierte un ejemplo en estructura
          </h2>
          <p className="mt-1 pr-8 text-sm text-muted">
            La nota se usa solo para proponer secciones y no se guarda.
          </p>
        </header>
        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-3 text-sm text-warning-ink">
            <strong>Antes de continuar:</strong> elimina nombres, documentos,
            teléfonos, fechas de nacimiento y cualquier identificador del
            paciente.
          </div>
          <label className="mt-4 block text-sm font-semibold text-deep">
            Nota de referencia
            <textarea
              value={example}
              onChange={(event) => setExample(event.target.value)}
              rows={10}
              maxLength={12000}
              placeholder="Pega una nota anonimizada. Miracle propondrá una estructura, no una nota clínica."
              className="mt-2 w-full resize-y rounded-xl border border-line bg-field px-3.5 py-3 text-sm leading-relaxed outline-none focus:border-accent"
            />
          </label>
          <label className="mt-4 flex items-start gap-3 text-sm text-deep">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <span>
              Confirmo que retiré identificadores del paciente y entiendo que el
              texto no se guardará.
            </span>
          </label>
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-deep"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void createDraft()}
            disabled={!example.trim() || !consent || loading}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Sparkles size={15} />
            )}{" "}
            Crear borrador
          </button>
        </footer>
      </section>
    </div>
  );
}
