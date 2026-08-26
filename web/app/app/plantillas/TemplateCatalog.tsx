"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Copy,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  StarOff,
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
import { searchList } from "@/lib/clinical/search";
import {
  clearTemplatePreference,
  getTemplatePreferences,
  pinnedTemplateIds,
  setTemplatePreference,
  type TemplatePreference,
} from "@/lib/clinical/template-preferences";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ui/ConfirmDialog";
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
  embedded = false,
}: {
  initialSpecialtyCode?: string | null;
  /** Dentro de las pestañas de /app/plantillas: el contenedor ya pone el
   *  ancho y el padding de página, así que aquí no se repiten. */
  embedded?: boolean;
}) {
  const confirm = useConfirm();
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
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<TemplatePreference[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Las preferencias no bloquean el catálogo: si fallan, solo se pierde el
    // badge "Tu sugerida".
    void Promise.all([
      getClinicalTemplates(),
      getTemplatePreferences(createClient()).catch(
        () => [] as TemplatePreference[],
      ),
    ])
      .then(([result, prefs]) => {
        if (cancelled) return;
        setTemplates(result);
        setPreferences(prefs);
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

  const pinned = useMemo(() => pinnedTemplateIds(preferences), [preferences]);

  const visible = useMemo(() => {
    const porAlcance = templates.filter((template) => {
      if (filter === "mias" && template.scope !== "personal") return false;
      if (filter === "institucionales" && template.scope === "personal") return false;
      return true;
    });
    // Misma búsqueda tolerante que el selector de "Iniciar consulta": tildes y
    // errores de tecleo no pueden dejar el catálogo en blanco.
    return searchList(
      porAlcance,
      query,
      (template) =>
        `${template.name} ${template.specialty} ${specialtyDisplayName(template.specialty)} ${template.description ?? ""}`,
    )
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
  async function togglePin(template: ClinicalTemplate) {
    const supabase = createClient();
    setPinningId(template.id);
    try {
      if (pinned.has(template.id)) {
        await clearTemplatePreference(supabase, template.specialty);
        setFeedback("Ya no es tu sugerida.");
      } else {
        await setTemplatePreference(supabase, {
          specialtyCode: template.specialty,
          templateId: template.id,
        });
        setFeedback(
          "Fijada como tu sugerida: aparecerá preseleccionada al iniciar consultas.",
        );
      }
      setPreferences(await getTemplatePreferences(supabase));
    } catch (pinError) {
      setFeedback(friendlyClinicalMessage(pinError));
    } finally {
      setPinningId(null);
    }
  }
  async function archive(template: ClinicalTemplate) {
    const ok = await confirm({
      titulo: `¿Archivar «${template.name}»?`,
      descripcion: "Dejará de aparecer al iniciar una consulta. Las notas ya escritas con ella no cambian.",
      confirmLabel: "Archivar",
      tono: "peligro",
    });
    if (!ok) return;
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
    <div className={embedded ? undefined : "app-page max-w-[1440px]"}>
      <header className="border-b border-line pb-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="app-page-title">
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
        /* Una sola columna a todo el ancho. La vista de la nota vivía aquí al
           lado, en un panel fijo de 420 px que le comía a la lista casi la
           mitad de la pantalla y dejaba cada plantilla con el nombre y la
           descripción cortados. Ahora el detalle se abre en un diálogo. */
        <section aria-label="Plantillas disponibles" className="mt-6 space-y-2.5">
          {visible.map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              pinned={pinned.has(template.id)}
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
      ) : null}

      {selectedId && selected ? (
        <TemplateDialog
          template={selected}
          archiving={archivingId === selected.id}
          pinned={pinned.has(selected.id)}
          pinning={pinningId === selected.id}
          onClose={() => setSelectedId(null)}
          onTogglePin={() => void togglePin(selected)}
          onBase={() => setBuilder({ mode: "base", baseTemplate: selected })}
          onEdit={() => setBuilder({ mode: "edit", baseTemplate: selected })}
          onArchive={() => void archive(selected)}
        />
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
  pinned,
  onSelect,
}: {
  template: ClinicalTemplate;
  pinned: boolean;
  onSelect: () => void;
}) {
  return (
    /* Sin el cuadro del icono: era el mismo dibujo en las 204 filas, así que no
       distinguía una plantilla de otra y solo empujaba el texto hacia dentro.
       Lo que sí identifica a cada una —nombre, especialidad, cuántas secciones
       tiene y para qué sirve— es lo que queda. */
    <button
      type="button"
      onClick={onSelect}
      aria-haspopup="dialog"
      className="group flex w-full flex-col gap-1 rounded-[14px] border border-line bg-surface p-4 text-left transition-colors hover:border-accent/40 hover:bg-ice-soft/40"
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[15px] font-semibold leading-tight text-deep">
          {template.name}
        </span>
        {pinned ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[12px] font-semibold text-warning-ink">
            <Star size={11} /> Tu sugerida
          </span>
        ) : template.is_default ? (
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
      {/* La especialidad y el número de secciones son el dato que se compara
          entre plantillas, así que van juntos y sin recortar; la descripción
          va debajo y es la única que cede espacio. */}
      <span className="text-[13px] font-medium text-ink-soft">
        {specialtyDisplayName(template.specialty)} ·{" "}
        <span className="tabular-nums">{template.sections.length}</span>{" "}
        {template.sections.length === 1 ? "sección" : "secciones"}
      </span>
      {template.description ? (
        <span className="line-clamp-1 text-[13px] text-muted">
          {template.description}
        </span>
      ) : null}
    </button>
  );
}

/**
 * El detalle de la plantilla, en diálogo.
 *
 * Vivía como panel fijo al lado de la lista, ocupando 420 px de ancho de forma
 * permanente: apretaba las tarjetas hasta cortarles el nombre y la descripción
 * y, aun así, solo servía cuando había una plantilla seleccionada. Como diálogo
 * aparece cuando se pide, y con sitio de sobra para leer las secciones.
 *
 * Hoja inferior en móvil y ventana centrada desde `sm`, que es el patrón que ya
 * siguen los otros diálogos de esta pantalla. Antes esto eran dos renders
 * distintos del mismo panel —uno para móvil y otro para escritorio— que había
 * que mantener en paralelo.
 */
function TemplateDialog({
  template,
  archiving,
  pinned,
  pinning,
  onClose,
  onTogglePin,
  onBase,
  onEdit,
  onArchive,
}: {
  template: ClinicalTemplate;
  archiving: boolean;
  pinned: boolean;
  pinning: boolean;
  onClose: () => void;
  onTogglePin: () => void;
  onBase: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const personal = template.scope === "personal";
  const dialogRef = useRef<HTMLElement>(null);

  // Misma accesibilidad que el resto de diálogos: foco al abrir y Escape cierra.
  useEffect(() => {
    dialogRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-overlay backdrop-blur-[2px] sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0"
      />
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={template.name}
        /* Ancho de lectura cómodo y alto acotado: el cuerpo se desplaza solo,
           así una plantilla de 13 secciones no empuja los botones fuera de la
           pantalla. */
        className="mobile-bottom-sheet relative flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-t-3xl border border-b-0 border-line bg-surface shadow-[var(--shadow-xl)] outline-none sm:max-h-[85vh] sm:rounded-2xl sm:border-b"
      >
        <header className="border-b border-line p-5 pr-14">
          <h2 className="font-display text-xl font-semibold leading-tight text-deep">
            {template.name}
          </h2>
          <p className="mt-1 text-[13px] font-medium text-ink-soft">
            {specialtyDisplayName(template.specialty)} ·{" "}
            <span className="tabular-nums">{template.sections.length}</span>{" "}
            {template.sections.length === 1 ? "sección" : "secciones"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar"
            className="absolute right-4 top-4 rounded-lg p-2 text-muted hover:bg-ice-soft"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {template.description ? (
            <p className="text-sm leading-relaxed text-muted">
              {template.description}
            </p>
          ) : null}
          <div
            className={`border-l border-line pl-3 ${template.description ? "mt-5" : ""}`}
          >
            {sortedTemplateSections(template.sections).map((section, index) => (
              <div
                key={section.key}
                className="relative flex min-h-8 items-start justify-between gap-3 pb-2 last:pb-0"
              >
                <span className="absolute -left-[18px] top-2 h-2 w-2 rounded-full border-2 border-surface bg-accent" />
                <p className="min-w-0 text-sm font-medium leading-5 text-deep">
                  {String(index + 1).padStart(2, "0")} · {section.label}
                </p>
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${section.required ? "bg-accent-soft text-accent-ink" : "bg-ice-soft text-muted"}`}
                >
                  {section.required ? "Obligatoria" : "Opcional"}
                </span>
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
        </div>

        {/* Las acciones se quedan fijas abajo: con el cuerpo desplazándose, un
            pie que se va con el scroll obliga a bajar hasta el final para
            fijar una sugerida. */}
        <footer className="flex flex-wrap gap-2 border-t border-line p-5">
          <button type="button" onClick={onBase} className="clinical-primary">
            <Copy size={15} /> Usar como base
          </button>
          <button
            type="button"
            onClick={onTogglePin}
            disabled={pinning}
            title="Tu sugerida aparece preseleccionada al iniciar una consulta"
            className="clinical-secondary"
          >
            {pinned ? <StarOff size={15} /> : <Star size={15} />}{" "}
            {pinning
              ? "Guardando…"
              : pinned
                ? "Quitar mi sugerida"
                : "Fijar como mi sugerida"}
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
        </footer>
      </section>
    </div>
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
