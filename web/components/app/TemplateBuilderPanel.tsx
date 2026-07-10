"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  GripVertical,
  Info,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  createClinicalTemplate,
  friendlyClinicalMessage,
  updateClinicalTemplate,
  type ClinicalTemplate,
} from "@/lib/api/clinical";
import {
  buildTemplatePayload,
  createBlock,
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
  medicalAreas,
  getAreaForSpecialty,
  specialtiesForArea,
} from "@/lib/clinical/medical-areas";

export type BuilderMode = "scratch" | "base" | "edit";

const fieldClass =
  "mt-1.5 w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-deep outline-none transition-colors focus:border-accent";

const MODE_TITLE: Record<BuilderMode, string> = {
  scratch: "Nueva plantilla",
  base: "Personalizar plantilla",
  edit: "Editar plantilla",
};

const MODE_SUBTITLE: Record<BuilderMode, string> = {
  scratch: "Arma la estructura de tu nota, sección por sección.",
  base: "Copia una plantilla institucional y ajústala como tuya.",
  edit: "Cambia las secciones de tu plantilla personal.",
};

export function TemplateBuilderPanel({
  mode,
  baseTemplate,
  initialSpecialtyCode,
  onClose,
  onSaved,
}: {
  mode: BuilderMode;
  /** Plantilla origen: en "base" se duplica; en "edit" se actualiza. */
  baseTemplate?: ClinicalTemplate;
  initialSpecialtyCode: string;
  onClose: () => void;
  onSaved: (template: ClinicalTemplate, action: "created" | "updated") => void;
}) {
  const resolvedSpecialty = useMemo(() => {
    // La especialidad inicial sale de la plantilla origen o del filtro actual;
    // se resuelve a un code con guiones (el de specialties.ts) para los selects.
    if (baseTemplate) {
      const area = getAreaForSpecialty(baseTemplate.specialty);
      const match = area
        ? specialtiesForArea(area.code).find(
            (specialty) =>
              specialty.code.replace(/-/g, "_") ===
              baseTemplate.specialty.replace(/-/g, "_"),
          )
        : undefined;
      if (match) return match.code;
    }
    return initialSpecialtyCode;
  }, [baseTemplate, initialSpecialtyCode]);

  const initialArea =
    getAreaForSpecialty(resolvedSpecialty)?.code ?? medicalAreas[0].code;

  const [name, setName] = useState(() => {
    if (mode === "base" && baseTemplate) return `${baseTemplate.name} (personal)`;
    if (mode === "edit" && baseTemplate) return baseTemplate.name;
    return "";
  });
  const [areaCode, setAreaCode] = useState(initialArea);
  const [specialtyCode, setSpecialtyCode] = useState(resolvedSpecialty);
  const [description, setDescription] = useState(
    baseTemplate?.description ?? "",
  );
  const [blocks, setBlocks] = useState<SectionBlock[]>(() => {
    if (mode === "edit" && baseTemplate) return templateToBlocks(baseTemplate);
    if (mode === "base" && baseTemplate) return templateToDraftBlocks(baseTemplate);
    return starterBlocksForSpecialty(resolvedSpecialty);
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateUids, setDuplicateUids] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  const specialtiesInArea = useMemo(
    () => specialtiesForArea(areaCode),
    [areaCode],
  );

  // Cerrar con Escape (respetando el aviso de cambios sin guardar).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") attemptClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  function attemptClose() {
    if (
      dirty &&
      !window.confirm("Tienes cambios sin guardar. ¿Cerrar de todos modos?")
    ) {
      return;
    }
    onClose();
  }

  function changeArea(nextArea: string) {
    setAreaCode(nextArea);
    const first = specialtiesForArea(nextArea)[0];
    if (first) setSpecialtyCode(first.code);
    markDirty();
  }

  function setBlocksDirty(next: SectionBlock[]) {
    setBlocks(next);
    markDirty();
  }

  function addSection() {
    setBlocksDirty([...blocks, createBlock()]);
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

  const filledCount = blocks.filter((b) => b.label.trim().length > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={attemptClose}
        className="absolute inset-0 bg-night/30 backdrop-blur-[1px]"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={MODE_TITLE[mode]}
        className="relative flex h-full w-full max-w-2xl flex-col bg-surface shadow-[var(--shadow-lg)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-deep">{MODE_TITLE[mode]}</h2>
            <p className="mt-0.5 text-sm text-muted">{MODE_SUBTITLE[mode]}</p>
          </div>
          <button
            type="button"
            onClick={attemptClose}
            aria-label="Cerrar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-ice-soft hover:text-deep"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body (scroll) */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <p
              role="alert"
              className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
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

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-deep">
              Área médica
              <select
                value={areaCode}
                onChange={(e) => changeArea(e.target.value)}
                className={fieldClass}
              >
                {medicalAreas.map((area) => (
                  <option key={area.code} value={area.code}>
                    {area.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-deep">
              Especialidad
              <select
                value={specialtyCode}
                onChange={(e) => {
                  setSpecialtyCode(e.target.value);
                  markDirty();
                }}
                className={fieldClass}
              >
                {specialtiesInArea.map((specialty) => (
                  <option key={specialty.code} value={specialty.code}>
                    {specialty.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 block text-sm font-medium text-deep">
            Descripción corta{" "}
            <span className="font-normal text-muted">(opcional)</span>
            <input
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                markDirty();
              }}
              className={fieldClass}
              placeholder="Para qué tipo de atención usarla"
              maxLength={MAX_DESCRIPTION_LENGTH}
            />
          </label>

          {/* Secciones */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
                Secciones de la nota
              </h3>
              <span className="text-xs text-muted">{filledCount} con nombre</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Arrastra para reordenar. El sistema numera y estructura cada
              sección por ti.
            </p>

            <div className="mt-3 space-y-2.5">
              {blocks.map((block, index) => (
                <SectionCard
                  key={block.uid}
                  block={block}
                  index={index}
                  total={blocks.length}
                  duplicate={duplicateUids.includes(block.uid)}
                  onChange={(patch) => setBlocksDirty(updateBlock(blocks, block.uid, patch))}
                  onRemove={() => setBlocksDirty(removeBlock(blocks, block.uid))}
                  onMove={(to) => setBlocksDirty(moveBlock(blocks, index, to))}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={addSection}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-accent/50 bg-accent-soft/30 px-4 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-soft"
            >
              <Plus size={16} /> Agregar sección
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={attemptClose}
            className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-deep hover:border-mist"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
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
  onChange,
  onRemove,
  onMove,
}: {
  block: SectionBlock;
  index: number;
  total: number;
  duplicate: boolean;
  onChange: (patch: Partial<Omit<SectionBlock, "uid">>) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
}) {
  const [showInstruction, setShowInstruction] = useState(
    block.instruction.trim().length > 0,
  );
  const dragOverRef = useRef(false);

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
          <span className="text-[11px] font-semibold text-muted">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <input
            value={block.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Nombre de la sección (ej. Motivo de consulta)"
            maxLength={MAX_LABEL_LENGTH}
            aria-label={`Nombre de la sección ${index + 1}`}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-deep outline-none focus:border-accent"
          />

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
          </div>

          {showInstruction ? (
            <div className="mt-2">
              <textarea
                value={block.instruction}
                onChange={(e) => onChange({ instruction: e.target.value })}
                rows={2}
                maxLength={MAX_INSTRUCTION_LENGTH}
                placeholder="Opcional: qué debe contener esta sección. Ej. «Resume el motivo del control y los cambios desde la última consulta.»"
                className="w-full resize-y rounded-md border border-line bg-pearl px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-accent"
              />
              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
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
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-ice-soft hover:text-deep disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronDown size={14} className="rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index + 1)}
            disabled={index === total - 1}
            aria-label="Bajar sección"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-ice-soft hover:text-deep disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Eliminar sección"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Chip informativo para la opción de creación asistida (aún no disponible). */
export function AssistedHint() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted">
      <Sparkles size={13} className="text-accent" />
      Creación asistida por IA: próximamente.
    </p>
  );
}
