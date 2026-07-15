"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ChevronDown,
  Copy,
  FileText,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Stethoscope,
  X,
} from "lucide-react";
import {
  archiveClinicalTemplate,
  friendlyClinicalMessage,
  getClinicalTemplates,
  type ClinicalTemplate,
} from "@/lib/api/clinical";
import {
  getAreaForSpecialty,
  medicalAreas,
  medicalAreasWithSpecialties,
  normalizeSpecialtyKey,
  specialtyDisplayName,
} from "@/lib/clinical/medical-areas";
import { orderedSections } from "@/lib/clinical/template-builder";
import {
  TemplateBuilderPanel,
  type BuilderMode,
} from "@/components/app/TemplateBuilderPanel";
import { Badge } from "@/components/ui/Badge";

type ScopeFilter = "todas" | "institucionales" | "mias";

const FILTERS: { id: ScopeFilter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "institucionales", label: "Institucionales" },
  { id: "mias", label: "Mías" },
];

interface BuilderState {
  mode: BuilderMode;
  baseTemplate?: ClinicalTemplate;
  specialtyCode: string;
}

export function TemplateCatalog({
  initialSpecialtyCode,
}: {
  initialSpecialtyCode?: string | null;
}) {
  // Especialidad inicial: la del perfil, si es válida.
  const defaultArea = medicalAreas[0].code;
  const initialArea =
    (initialSpecialtyCode &&
      getAreaForSpecialty(initialSpecialtyCode)?.code) ||
    defaultArea;

  const [allTemplates, setAllTemplates] = useState<ClinicalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [expandedArea, setExpandedArea] = useState<string>(initialArea);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(
    initialSpecialtyCode ?? null,
  );
  const [filter, setFilter] = useState<ScopeFilter>("todas");
  const [query, setQuery] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const [builder, setBuilder] = useState<BuilderState | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // Una sola carga del catálogo completo (institucionales + mis personales).
  // Con esto la navegación por área/especialidad y la búsqueda son instantáneas
  // y los contadores por scope salen de la fuente oficial (el backend), sin
  // recalcular nada dudoso en el cliente. Se recarga tras crear/editar/archivar.
  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const list = await getClinicalTemplates();
        if (ignore) return;
        setAllTemplates(list);
        setLoadError(null);
      } catch (error) {
        if (ignore) return;
        setAllTemplates([]);
        setLoadError(friendlyClinicalMessage(error));
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  function reload() {
    setLoading(true);
    setLoadError(null);
    setReloadKey((key) => key + 1);
  }

  // Índice specialty_key → plantillas (activas; el backend no lista archivadas).
  const templatesBySpecialty = useMemo(() => {
    const map = new Map<string, ClinicalTemplate[]>();
    for (const template of allTemplates) {
      const key = normalizeSpecialtyKey(template.specialty);
      const list = map.get(key) ?? [];
      list.push(template);
      map.set(key, list);
    }
    return map;
  }, [allTemplates]);

  const personalTotal = useMemo(
    () => allTemplates.filter((t) => t.scope === "personal").length,
    [allTemplates],
  );
  const institutionalTotal = useMemo(
    () => allTemplates.filter((t) => t.scope !== "personal").length,
    [allTemplates],
  );

  const areasWithSpecialties = useMemo(() => medicalAreasWithSpecialties(), []);

  // Plantillas de la especialidad seleccionada, aplicando el filtro de scope.
  const specialtyTemplates = useMemo(() => {
    if (!selectedSpecialty) return [];
    const list = templatesBySpecialty.get(normalizeSpecialtyKey(selectedSpecialty)) ?? [];
    const scoped = list.filter((t) => {
      if (filter === "institucionales") return t.scope !== "personal";
      if (filter === "mias") return t.scope === "personal";
      return true;
    });
    // Institucionales primero (is_default arriba), luego personales.
    return [...scoped].sort((a, b) => {
      const scopeRank = (t: ClinicalTemplate) => (t.scope === "personal" ? 1 : 0);
      if (scopeRank(a) !== scopeRank(b)) return scopeRank(a) - scopeRank(b);
      if (Boolean(b.is_default) !== Boolean(a.is_default)) {
        return Number(Boolean(b.is_default)) - Number(Boolean(a.is_default));
      }
      return a.name.localeCompare(b.name, "es");
    });
  }, [selectedSpecialty, templatesBySpecialty, filter]);

  // Búsqueda global (por nombre de plantilla o de especialidad).
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return allTemplates
      .filter((t) => {
        const specialtyName =
          specialtyDisplayName(t.specialty).toLowerCase() +
          " " +
          t.specialty.replace(/_/g, " ").toLowerCase();
        return t.name.toLowerCase().includes(q) || specialtyName.includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [query, allTemplates]);

  const visibleTemplates = searchResults ?? specialtyTemplates;

  const selectedTemplate =
    visibleTemplates.find((t) => t.id === selectedTemplateId) ??
    visibleTemplates[0] ??
    null;

  function pickSpecialty(code: string) {
    setSelectedSpecialty(code);
    setSelectedTemplateId(null);
    setQuery("");
    const area = getAreaForSpecialty(code);
    if (area) setExpandedArea(area.code);
  }

  function openBuilder(state: BuilderState) {
    setBuilder(state);
  }

  function handleSaved(
    template: ClinicalTemplate,
    action: "created" | "updated",
  ) {
    setBuilder(null);
    setFeedback(action === "created" ? "Plantilla creada." : "Cambios guardados.");
    // Enfoca la especialidad de la plantilla y la deja seleccionada tras recargar.
    const area = getAreaForSpecialty(template.specialty);
    if (area) setExpandedArea(area.code);
    const specialtyMatch = matchSpecialtyCode(template.specialty);
    if (specialtyMatch) setSelectedSpecialty(specialtyMatch);
    setFilter("todas");
    setQuery("");
    setSelectedTemplateId(template.id);
    reload();
  }

  async function handleArchive(template: ClinicalTemplate) {
    if (archivingId) return;
    if (
      !window.confirm(
        `¿Archivar la plantilla «${template.name}»? Dejará de aparecer al iniciar consultas.`,
      )
    ) {
      return;
    }
    setArchivingId(template.id);
    setFeedback(null);
    try {
      await archiveClinicalTemplate(template.id);
      setFeedback("Plantilla archivada.");
      setSelectedTemplateId(null);
      reload();
    } catch (error) {
      setFeedback(friendlyClinicalMessage(error));
    } finally {
      setArchivingId(null);
    }
  }

  const builderSpecialty =
    matchSpecialtyCode(selectedSpecialty ?? "") ??
    (initialSpecialtyCode && matchSpecialtyCode(initialSpecialtyCode)) ??
    "medicina-general";

  return (
    <div className="mx-auto max-w-6xl">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Catálogo por áreas médicas
          </span>
          <h1 className="mt-1 text-2xl font-semibold text-deep">Plantillas clínicas</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Explora las estructuras institucionales por área y especialidad, o
            crea las tuyas. Las plantillas personales quedan guardadas en tu
            cuenta.
          </p>
        </div>
        <div className="flex gap-2">
          <Metric label="Áreas" value={String(medicalAreas.length)} />
          <Metric label="Institucionales" value={loading ? "…" : String(institutionalTotal)} />
          <Metric label="Mis plantillas" value={loading ? "…" : String(personalTotal)} />
        </div>
      </div>

      {feedback ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-success/30 bg-mint-soft px-3 py-2 text-sm text-success"
        >
          {feedback}
        </p>
      ) : null}

      {/* Barra: búsqueda + nueva plantilla */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 focus-within:border-accent sm:max-w-md">
          <Search size={16} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar plantilla o especialidad…"
            aria-label="Buscar plantilla o especialidad"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
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
        <button
          type="button"
          onClick={() =>
            openBuilder({ mode: "scratch", specialtyCode: builderSpecialty })
          }
          className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          <Plus size={16} /> Nueva plantilla
        </button>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <span>No se pudieron cargar las plantillas. {loadError}</span>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-full border border-danger/40 px-3.5 py-1.5 text-sm font-semibold text-danger hover:bg-danger/10"
          >
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-line bg-surface p-10 text-sm text-muted">
          <Loader2 size={18} className="animate-spin text-accent" /> Cargando catálogo…
        </div>
      ) : null}

      {!loading && !loadError ? (
        // Flexbox con utilidades núcleo, NO grid con valor arbitrario con comas
        // (lg:grid-cols-[minmax(0,240px)_1fr] colapsaba la columna a 0 en prod).
        <div className="mt-5 flex flex-col gap-5 lg:flex-row">
          {/* Navegación por áreas (maestro) */}
          <nav
            aria-label="Áreas y especialidades"
            className="h-fit rounded-lg border border-line bg-surface p-2 shadow-[var(--shadow-sm)] lg:sticky lg:top-4 lg:w-60 lg:shrink-0"
          >
            {areasWithSpecialties.map(({ area, specialties }) => {
              const open = expandedArea === area.code;
              const AreaIcon = area.icon;
              const areaPersonal = specialties.reduce(
                (sum, s) =>
                  sum +
                  (templatesBySpecialty
                    .get(normalizeSpecialtyKey(s.code))
                    ?.filter((t) => t.scope === "personal").length ?? 0),
                0,
              );
              return (
                <div key={area.code}>
                  <button
                    type="button"
                    onClick={() => setExpandedArea(open ? "" : area.code)}
                    aria-expanded={open}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-semibold transition-colors ${
                      open ? "bg-ice-soft text-deep" : "text-ink-soft hover:bg-ice-soft"
                    }`}
                  >
                    <AreaIcon size={16} className="shrink-0 text-accent" />
                    <span className="min-w-0 flex-1 truncate">{area.name}</span>
                    {areaPersonal > 0 ? (
                      <span className="rounded-full bg-success-soft px-1.5 text-[10px] font-bold text-success">
                        {areaPersonal}
                      </span>
                    ) : null}
                    <ChevronDown
                      size={15}
                      className={`shrink-0 text-muted transition-transform ${open ? "" : "-rotate-90"}`}
                    />
                  </button>
                  {open ? (
                    <ul className="mb-1 mt-0.5 space-y-0.5 pl-2">
                      {specialties.map((specialty) => {
                        const active =
                          !query &&
                          normalizeSpecialtyKey(specialty.code) ===
                            normalizeSpecialtyKey(selectedSpecialty ?? "");
                        const mine =
                          templatesBySpecialty
                            .get(normalizeSpecialtyKey(specialty.code))
                            ?.filter((t) => t.scope === "personal").length ?? 0;
                        return (
                          <li key={specialty.code}>
                            <button
                              type="button"
                              onClick={() => pickSpecialty(specialty.code)}
                              className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                                active
                                  ? "bg-accent-soft font-semibold text-accent-ink"
                                  : "text-ink-soft hover:bg-ice-soft"
                              }`}
                            >
                              <span className="min-w-0 flex-1 truncate">{specialty.name}</span>
                              {mine > 0 ? (
                                <span className="shrink-0 text-[10px] font-bold text-success">
                                  {mine}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </nav>

          {/* Detalle (plantillas) */}
          <div className="min-w-0 flex-1">
            {/* Cabecera de contexto + filtros */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                {query ? (
                  <h2 className="text-lg font-semibold text-deep">
                    {visibleTemplates.length} resultado
                    {visibleTemplates.length === 1 ? "" : "s"} para «{query}»
                  </h2>
                ) : selectedSpecialty ? (
                  <div>
                    <h2 className="text-lg font-semibold text-deep">
                      {specialtyDisplayName(selectedSpecialty)}
                    </h2>
                    <p className="text-xs text-muted">
                      {getAreaForSpecialty(selectedSpecialty)?.name}
                    </p>
                  </div>
                ) : (
                  <h2 className="text-lg font-semibold text-deep">
                    Elige una especialidad
                  </h2>
                )}
              </div>

              {!query && selectedSpecialty ? (
                <div className="inline-flex rounded-full border border-line bg-surface p-0.5">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                        filter === f.id
                          ? "bg-accent text-white"
                          : "text-ink-soft hover:text-deep"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Estado vacío / lista + preview */}
            {!selectedSpecialty && !query ? (
              <EmptyPanel
                title="Selecciona una especialidad"
                body="Explora un área médica a la izquierda y elige una especialidad para ver sus plantillas."
              />
            ) : visibleTemplates.length === 0 ? (
              <EmptyPanel
                title={
                  query
                    ? "Sin resultados"
                    : filter === "mias"
                      ? "No tienes plantillas personales aquí"
                      : "Sin plantillas"
                }
                body={
                  query
                    ? "Prueba con otro nombre de plantilla o especialidad."
                    : filter === "mias"
                      ? "Crea una desde cero o parte de una institucional con «Usar como base»."
                      : "Aún no hay plantillas para esta especialidad."
                }
              />
            ) : (
              <div className="mt-4 grid gap-5 lg:grid-cols-[1.05fr_1fr]">
                <section className="space-y-2.5">
                  {visibleTemplates.map((template) => (
                    <TemplateChoice
                      key={template.id}
                      template={template}
                      active={template.id === selectedTemplate?.id}
                      showSpecialty={Boolean(query)}
                      onSelect={() => setSelectedTemplateId(template.id)}
                    />
                  ))}
                </section>

                {selectedTemplate ? (
                  <TemplateDetail
                    template={selectedTemplate}
                    archiving={archivingId === selectedTemplate.id}
                    onUseAsBase={() =>
                      openBuilder({
                        mode: "base",
                        baseTemplate: selectedTemplate,
                        specialtyCode: builderSpecialty,
                      })
                    }
                    onEdit={() =>
                      openBuilder({
                        mode: "edit",
                        baseTemplate: selectedTemplate,
                        specialtyCode: builderSpecialty,
                      })
                    }
                    onArchive={() => void handleArchive(selectedTemplate)}
                  />
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {builder ? (
        <TemplateBuilderPanel
          mode={builder.mode}
          baseTemplate={builder.baseTemplate}
          initialSpecialtyCode={builder.specialtyCode}
          onClose={() => setBuilder(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Subcomponentes                                                      */
/* ------------------------------------------------------------------ */

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

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-line bg-surface p-8 text-center">
      <p className="font-semibold text-deep">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}

function TemplateChoice({
  template,
  active,
  showSpecialty,
  onSelect,
}: {
  template: ClinicalTemplate;
  active: boolean;
  showSpecialty: boolean;
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
          {sectionCount} secciones
          {showSpecialty ? ` · ${specialtyDisplayName(template.specialty)}` : ""}
        </span>
      </span>
      <Layers3 size={18} className="shrink-0 text-muted" />
    </button>
  );
}

function TemplateDetail({
  template,
  archiving,
  onUseAsBase,
  onEdit,
  onArchive,
}: {
  template: ClinicalTemplate;
  archiving: boolean;
  onUseAsBase: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const sections = orderedSections(template.sections);
  const isPersonal = template.scope === "personal";
  return (
    <aside className="h-fit rounded-lg border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Vista previa
            </span>
            {isPersonal ? (
              <Badge tone="success">Mía</Badge>
            ) : (
              <Badge tone="neutral">Institucional</Badge>
            )}
          </div>
          <h2 className="mt-1 text-lg font-semibold text-deep">{template.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {template.description || specialtyDisplayName(template.specialty)}
          </p>
        </div>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ice text-accent">
          <Stethoscope size={19} />
        </span>
      </div>

      <div className="mt-5 space-y-2">
        {sections.map((section) => (
          <div
            key={section.key}
            className="flex items-center gap-3 rounded-md border border-line bg-pearl px-3 py-2.5 text-sm text-ink-soft"
          >
            <span className="text-xs font-semibold text-muted">
              {String(section.order).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1 truncate">{section.label}</span>
            {section.required ? (
              <span className="shrink-0 text-[10px] font-bold uppercase text-accent">
                Obligatoria
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onUseAsBase}
          className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-deep hover:border-mist"
        >
          <Copy size={15} /> Usar como base
        </button>
        {isPersonal ? (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-deep hover:border-mist"
            >
              <Pencil size={15} /> Editar
            </button>
            <button
              type="button"
              onClick={onArchive}
              disabled={archiving}
              className="inline-flex items-center gap-2 rounded-full border border-danger/30 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Archive size={15} /> {archiving ? "Archivando…" : "Archivar"}
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers de presentación                                             */
/* ------------------------------------------------------------------ */

/** Devuelve el code (con guiones) de specialties.ts que corresponde al backend. */
function matchSpecialtyCode(specialtyCode: string): string | null {
  if (!specialtyCode) return null;
  const target = normalizeSpecialtyKey(specialtyCode);
  for (const area of medicalAreas) {
    const found = area.specialtyCodes.find(
      (code) => normalizeSpecialtyKey(code) === target,
    );
    if (found) return found;
  }
  return null;
}
