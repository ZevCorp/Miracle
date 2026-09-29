"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  CheckCircle2,
  ChevronDown,
  GripVertical,
  Info,
  Loader2,
  Lock,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  createClinicalTemplate,
  friendlyClinicalMessage,
  updateClinicalTemplate,
  type ClinicalTemplate,
  type CreateClinicalTemplatePayload,
} from "@/lib/api/clinical";
import {
  buildTemplatePayload,
  createBlock,
  isPatientIdentityBlock,
  MAX_DESCRIPTION_LENGTH,
  MAX_INSTRUCTION_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_NAME_LENGTH,
  moveBlock,
  removeBlock,
  starterBlocksForSpecialty,
  templateToBlocks,
  templateToDraftBlocks,
  updateBlock,
  validateBlocks,
  type SectionBlock,
} from "@/lib/clinical/template-builder";
import {
  medicalAreasWithSpecialties,
  resolveSpecialtyCode,
  specialtyDisplayName,
} from "@/lib/clinical/medical-areas";

export type BuilderMode = "scratch" | "base" | "edit";
/** De dónde salió el borrador, para explicar qué revisar. */
export type DraftOrigin = "example" | "image";

const fieldClass =
  "mt-1.5 w-full rounded-md border border-line bg-field px-3.5 py-2.5 text-sm text-deep outline-none transition-colors focus:border-accent";

const MODE_TITLE: Record<BuilderMode, string> = {
  scratch: "Nueva plantilla",
  base: "Personalizar plantilla",
  edit: "Editar plantilla",
};

const COMMON_SECTIONS = [
  "Motivo de consulta", "Enfermedad actual", "Antecedentes relevantes",
  "Examen físico dirigido", "Impresión diagnóstica", "Resultados relevantes",
];

export function TemplateBuilderPanel({
  mode,
  baseTemplate,
  initialSpecialtyCode,
  initialDraft,
  draftOrigin,
  onClose,
  onSaved,
}: {
  mode: BuilderMode;
  /** Plantilla origen: en "base" se duplica; en "edit" se actualiza. */
  baseTemplate?: ClinicalTemplate;
  initialSpecialtyCode: string;
  initialDraft?: CreateClinicalTemplatePayload;
  draftOrigin?: DraftOrigin;
  onClose: () => void;
  onSaved: (template: ClinicalTemplate, action: "created" | "updated") => void;
}) {
  const confirm = useConfirm();
  // La especialidad inicial sale de la plantilla origen o del perfil, y se
  // resuelve al code canónico de specialties.ts. Sin esto, un `medicina_general`
  // del backend no casaría con ninguna <option> y el selector mostraría una
  // especialidad mientras el estado guarda otra.
  const resolvedSpecialty = useMemo(
    () => resolveSpecialtyCode(baseTemplate?.specialty ?? initialSpecialtyCode),
    [baseTemplate, initialSpecialtyCode],
  );

  const [name, setName] = useState(() => {
    if (initialDraft) return initialDraft.name;
    if (mode === "base" && baseTemplate) return `${baseTemplate.name} (personal)`;
    if (mode === "edit" && baseTemplate) return baseTemplate.name;
    return "";
  });
  const [specialtyCode, setSpecialtyCode] = useState(resolvedSpecialty);
  const [specialtyOpen, setSpecialtyOpen] = useState(false);
  const [description, setDescription] = useState(
    initialDraft?.description ?? baseTemplate?.description ?? "",
  );
  // La descripción es opcional y casi nunca se llena: ocupa una fila entera por
  // encima de las secciones, que es el trabajo real. Se despliega si ya trae algo.
  const [showDescription, setShowDescription] = useState(
    (initialDraft?.description ?? baseTemplate?.description ?? "").trim().length > 0,
  );
  const [initialBlocks] = useState<SectionBlock[]>(() => {
    if (initialDraft) return initialDraft.sections.map((section) => createBlock({
      label: typeof section === "string" ? section : section.label,
      required: typeof section === "string" ? false : section.required === true,
      instruction: typeof section === "string" ? "" : section.instruction ?? "",
    }));
    if (mode === "edit" && baseTemplate) return templateToBlocks(baseTemplate);
    if (mode === "base" && baseTemplate) return templateToDraftBlocks(baseTemplate);
    return starterBlocksForSpecialty(resolvedSpecialty);
  });
  const [blocks, setBlocks] = useState<SectionBlock[]>(initialBlocks);

  // Qué secciones llegaron del archivo del médico. Vive FUERA de SectionBlock a
  // propósito: es una marca de procedencia, solo de UI, y así no puede colarse
  // en el payload ni quedarse pegada a lo que él añada después.
  const draftUids = useMemo(
    () => new Set(initialDraft ? initialBlocks.map((block) => block.uid) : []),
    [initialDraft, initialBlocks],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateUids, setDuplicateUids] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);

  const areasConEspecialidades = useMemo(() => medicalAreasWithSpecialties(), []);

  // Cerrar con Escape (respetando el aviso de cambios sin guardar).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") void attemptClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  async function attemptClose() {
    if (dirty) {
      const ok = await confirm({
        titulo: "Tienes cambios sin guardar",
        descripcion: "Si cierras ahora, se pierden los cambios de esta plantilla.",
        confirmLabel: "Cerrar sin guardar",
        tono: "peligro",
      });
      if (!ok) return;
    }
    onClose();
  }

  function setBlocksDirty(next: SectionBlock[]) {
    setBlocks(next);
    markDirty();
  }

  function addSection(label = "") {
    setBlocksDirty([...blocks, createBlock({ label })]);
    setSectionMenuOpen(false);
  }

  async function handleSubmit() {
    if (saving) return;
    const trimmedName = name.trim();
    if (trimmedName.length < 3 || trimmedName.length > MAX_NAME_LENGTH) {
      setError(`El nombre debe tener entre 3 y ${MAX_NAME_LENGTH} caracteres.`);
      return;
    }
    if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      setError(`La descripción no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres.`);
      return;
    }
    const validation = validateBlocks(blocks);
    if (!validation.ok) {
      setError(validation.message ?? "Revisa las secciones.");
      setDuplicateUids(validation.duplicateUids);
      return;
    }
    setDuplicateUids([]);

    const payload = buildTemplatePayload({
      name: trimmedName,
      specialtyCode,
      description,
      blocks,
    });

    setSaving(true);
    setError(null);
    try {
      if (mode === "edit" && baseTemplate) {
        const updated = await updateClinicalTemplate(baseTemplate.id, payload);
        setDirty(false);
        onSaved(updated, "updated");
      } else {
        const created = await createClinicalTemplate(payload);
        setDirty(false);
        onSaved(created, "created");
      }
    } catch (submitError) {
      setError(friendlyClinicalMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => void attemptClose()}
        className="absolute inset-0 bg-overlay backdrop-blur-[1px]"
      />

      {/* Panel. Ancho de lectura: a 6xl los campos quedaban de más de 1500 px
          para escribir un nombre de plantilla. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={MODE_TITLE[mode]}
        className="relative flex h-dvh max-h-dvh w-full max-w-3xl flex-col overflow-hidden bg-surface shadow-[var(--shadow-xl)] sm:h-auto sm:max-h-[90dvh] sm:rounded-[24px] sm:border sm:border-line"
      >
        {/* Header */}
        <div className="app-mobile-header flex items-center justify-between gap-3 border-b border-line px-4 py-4 sm:h-auto sm:px-7">
          <h2 className="text-xl font-semibold text-deep">{MODE_TITLE[mode]}</h2>
          <button
            type="button"
            onClick={() => void attemptClose()}
            aria-label="Cerrar"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-ice-soft hover:text-deep"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body (scroll) */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {error ? (
            <p
              role="alert"
              className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}

          {initialDraft ? (
            <p className="mb-4 flex items-start gap-2 rounded-lg border border-accent/25 bg-accent-soft/35 px-3 py-2.5 text-sm text-accent-ink">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              {draftOrigin === "image"
                ? "Leímos la estructura de tu archivo. Revisa cada sección antes de guardar."
                : "Borrador creado desde tu ejemplo. Revísalo antes de guardarlo."}
            </p>
          ) : null}

          <label className="block text-sm font-medium text-deep">
            Nombre de la plantilla
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                markDirty();
              }}
              className={fieldClass}
              placeholder="Ej. Control de hipertensión"
              maxLength={MAX_NAME_LENGTH}
            />
          </label>

          {/* Especialidad: casi siempre es la del médico, así que se muestra
              resuelta y solo se convierte en campo si la quiere cambiar. */}
          <div className="mt-4">
            <p className="text-sm font-medium text-deep">Especialidad</p>
            {specialtyOpen ? (
              <select
                value={specialtyCode}
                onChange={(e) => {
                  setSpecialtyCode(e.target.value);
                  markDirty();
                }}
                autoFocus
                aria-label="Especialidad"
                className={fieldClass}
              >
                {areasConEspecialidades.map(({ area, specialties }) => (
                  <optgroup key={area.code} label={area.name}>
                    {specialties.map((specialty) => (
                      <option key={specialty.code} value={specialty.code}>
                        {specialty.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-deep">
                  {specialtyDisplayName(specialtyCode)}
                </span>
                <span aria-hidden className="text-muted">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => setSpecialtyOpen(true)}
                  className="font-medium text-accent hover:underline"
                >
                  Cambiar
                </button>
              </p>
            )}
          </div>

          {showDescription ? (
            <label className="mt-4 block text-sm font-medium text-deep">
              Descripción corta{" "}
              <span className="font-normal text-muted">(opcional)</span>
              <input
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  markDirty();
                }}
                autoFocus
                className={fieldClass}
                placeholder="Para qué tipo de atención usarla"
                maxLength={MAX_DESCRIPTION_LENGTH}
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={() => setShowDescription(true)}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              <Plus size={14} /> Añadir descripción
            </button>
          )}

          {/* Secciones */}
          <div className="mt-6">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
              Secciones de la nota
            </h3>
            <p className="mt-1 text-xs text-muted">
              Arrastra para reordenar.
            </p>

            <div className="mt-3 space-y-2.5 border-l border-line pl-3 sm:pl-5">
              {blocks.map((block, index) => (
                <SectionCard
                  key={block.uid}
                  block={block}
                  index={index}
                  total={blocks.length}
                  duplicate={duplicateUids.includes(block.uid)}
                  fromFile={draftUids.has(block.uid)}
                  onChange={(patch) => setBlocksDirty(updateBlock(blocks, block.uid, patch))}
                  onRemove={() => setBlocksDirty(removeBlock(blocks, block.uid))}
                  onMove={(to) => setBlocksDirty(moveBlock(blocks, index, to))}
                />
              ))}
            </div>

            <div className="relative mt-3">
              <button type="button" onClick={() => setSectionMenuOpen((value) => !value)} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-accent/50 bg-accent-soft/30 px-4 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-soft"><Plus size={16} /> Añadir una sección</button>
              {sectionMenuOpen ? <div className="absolute z-10 mt-2 w-full rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-lg)]"><p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted">Secciones frecuentes</p><div className="grid gap-1 sm:grid-cols-2">{COMMON_SECTIONS.map((label) => <button key={label} type="button" onClick={() => addSection(label)} className="rounded-lg px-3 py-2 text-left text-sm text-deep hover:bg-ice-soft">{label}</button>)}<button type="button" onClick={() => addSection()} className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-accent hover:bg-accent-soft">+ Sección personalizada</button></div></div> : null}
            </div>

            {/* El cierre clínico va aquí abajo porque es donde va en la nota: al
                final. Arriba, como tarjeta de tres columnas, ocupaba media
                pantalla para decir algo que el médico no puede cambiar. */}
            <div
              aria-disabled="true"
              className="mt-2.5 flex items-start gap-2.5 rounded-lg border border-dashed border-line bg-pearl px-3.5 py-3"
            >
              <Lock size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden />
              <p className="text-[13px] leading-relaxed text-muted">
                <span className="font-semibold text-ink-soft">Cierre clínico</span>{" "}
                · Toda nota termina con plan, recomendaciones y signos de alarma.
                Se añade solo.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mobile-bottom-sheet grid grid-cols-2 gap-2 border-t border-line bg-surface px-4 py-3 sm:flex sm:items-center sm:justify-end sm:px-7 sm:py-4">
          <button
            type="button"
            onClick={() => void attemptClose()}
            className="clinical-secondary px-5"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="clinical-primary px-5"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Guardando plantilla...
              </>
            ) : (
              <>
                <Save size={16} /> {mode === "edit" ? "Guardar cambios" : "Guardar plantilla"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  block,
  index,
  total,
  duplicate,
  fromFile,
  onChange,
  onRemove,
  onMove,
}: {
  block: SectionBlock;
  index: number;
  total: number;
  duplicate: boolean;
  /** Vino del archivo que subió el médico: se marca para que sepa qué revisar. */
  fromFile: boolean;
  onChange: (patch: Partial<Omit<SectionBlock, "uid">>) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
}) {
  const [showInstruction, setShowInstruction] = useState(
    block.instruction.trim().length > 0,
  );
  const dragOverRef = useRef(false);
  // La identificación del paciente la lleva toda plantilla: si no existe la
  // casilla, la nota no tiene dónde traer el nombre y la consulta termina como
  // "Paciente sin identificar". Se puede reordenar y afinar su instrucción,
  // pero no borrar ni renombrar (su nombre es lo que la app usa para leerla).
  const identidad = isPatientIdentityBlock(block);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(index));
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        dragOverRef.current = true;
      }}
      onDrop={(e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData("text/plain"));
        if (Number.isInteger(from)) onMove(index);
        dragOverRef.current = false;
      }}
      className={`rounded-lg border bg-surface p-3 shadow-[var(--shadow-sm)] transition-colors ${
        duplicate ? "border-danger/50 ring-1 ring-danger/20" : "border-line"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex flex-col items-center gap-1 pt-1.5">
          <span
            className="cursor-grab text-muted active:cursor-grabbing"
            aria-hidden
            title="Arrastra para reordenar"
          >
            <GripVertical size={16} />
          </span>
          <span className="text-[12px] font-semibold text-muted">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <input
            value={block.label}
            onChange={(e) => onChange({ label: e.target.value })}
            readOnly={identidad}
            placeholder="Nombre de la sección (ej. Motivo de consulta)"
            maxLength={MAX_LABEL_LENGTH}
            aria-label={`Nombre de la sección ${index + 1}`}
            className={`w-full rounded-md border border-line px-3 py-2 text-sm font-medium text-deep outline-none focus:border-accent ${
              identidad ? "cursor-default bg-ice-soft" : "bg-field"
            }`}
          />
          {identidad ? (
            <p className="mt-1.5 flex items-center gap-1 text-[12px] text-muted">
              <Info size={11} /> Toda plantilla la incluye: es de donde salen el
              nombre y el documento del paciente en tus consultas.
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-deep">
              <input
                type="checkbox"
                checked={block.required}
                onChange={(e) => onChange({ required: e.target.checked })}
                className="h-3.5 w-3.5 accent-accent"
              />
              Obligatoria
            </label>
            <button
              type="button"
              onClick={() => setShowInstruction((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              <ChevronDown
                size={13}
                className={`transition-transform ${showInstruction ? "" : "-rotate-90"}`}
              />
              ¿Qué debe incluir?
            </button>
            {fromFile && !identidad ? (
              <span className="rounded-full bg-ice px-2 py-0.5 text-[11px] font-medium text-muted">
                De tu archivo
              </span>
            ) : null}
          </div>

          {showInstruction ? (
            <div className="mt-2">
              <textarea
                value={block.instruction}
                onChange={(e) => onChange({ instruction: e.target.value })}
                rows={2}
                maxLength={MAX_INSTRUCTION_LENGTH}
                placeholder="Opcional: qué debe contener esta sección. Ej. «Resume el motivo del control y los cambios desde la última consulta.»"
                className="w-full resize-y rounded-md border border-line bg-field px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-accent"
              />
              <p className="mt-1 flex items-center gap-1 text-[12px] text-muted">
                <Info size={11} /> Guía para que Miracle redacte mejor esta
                sección. No es visible para el paciente.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onMove(index - 1)}
            disabled={index === 0}
            aria-label="Subir sección"
            title="Subir sección"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-ice-soft hover:text-deep disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronDown size={14} className="rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index + 1)}
            disabled={index === total - 1}
            aria-label="Bajar sección"
            title="Bajar sección"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-ice-soft hover:text-deep disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={identidad}
            aria-label="Eliminar sección"
            title={
              identidad
                ? "La identificación del paciente va en todas las plantillas"
                : "Eliminar sección"
            }
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
