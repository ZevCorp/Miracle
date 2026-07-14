"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, Info, Pencil, X } from "lucide-react";
import type { ClinicalNoteJson, ClinicalNoteSection } from "@/lib/api/clinical";

/**
 * Editor de la nota clínica estructurada (note_json del backend).
 *
 * Reglas del contrato:
 * - Se renderizan EXACTAMENTE las secciones recibidas, en el orden recibido.
 * - `label` es el título, `content` el contenido editable.
 * - Al editar solo cambia `content`; key/label/confidence/evidence se preservan
 *   (eso lo garantiza updateNoteSectionContent en lib/api/clinical).
 * - Nada de parsear markdown ni inventar/eliminar secciones.
 */
export function EncounterNote({
  note,
  editable,
  onChangeSection,
  onChangeSummary,
}: {
  note: ClinicalNoteJson;
  editable: boolean;
  onChangeSection: (key: string, content: string) => void;
  onChangeSummary: (summary: string) => void;
}) {
  const missingLabels = note.missing_required_sections
    .map(
      (key) => note.sections.find((section) => section.key === key)?.label ?? key,
    )
    .filter(Boolean);

  return (
    <div>
      <div className="mb-4 flex items-start gap-2 rounded-md border border-accent/20 bg-accent-soft/50 px-3.5 py-2.5 text-sm text-accent-ink">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>
          Contenido generado con IA a partir de la transcripción. Verifique cada
          sección; la nota requiere revisión y aprobación médica.
        </span>
      </div>

      {note.warnings.length ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-warning/40 bg-warning-soft px-3.5 py-2.5 text-sm text-warning"
        >
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={15} /> Avisos de la generación
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {note.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {missingLabels.length ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-warning/40 bg-warning-soft px-3.5 py-2.5 text-sm text-warning"
        >
          <span className="font-semibold">Secciones obligatorias sin información: </span>
          {missingLabels.join(", ")}. Complétalas antes de cerrar la nota.
        </div>
      ) : null}

      <div className="rounded-lg border border-line bg-surface px-5 py-2">
        <SummaryBlock
          summary={note.summary}
          editable={editable}
          onChange={onChangeSummary}
        />
        {note.sections.map((section) => (
          <SectionBlock
            key={section.key}
            section={section}
            editable={editable}
            onChange={(content) => onChangeSection(section.key, content)}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryBlock({
  summary,
  editable,
  onChange,
}: {
  summary: string;
  editable: boolean;
  onChange: (summary: string) => void;
}) {
  return (
    <EditableBlock
      title="Resumen"
      content={summary}
      editable={editable}
      onChange={onChange}
    />
  );
}

function SectionBlock({
  section,
  editable,
  onChange,
}: {
  section: ClinicalNoteSection;
  editable: boolean;
  onChange: (content: string) => void;
}) {
  return (
    <EditableBlock
      title={section.label}
      content={section.content}
      editable={editable}
      onChange={onChange}
    />
  );
}

function EditableBlock({
  title,
  content,
  editable,
  onChange,
}: {
  title: string;
  content: string;
  editable: boolean;
  onChange: (content: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);

  function startEdit() {
    setDraft(content);
    setEditing(true);
    setOpen(true);
  }

  function confirm() {
    onChange(draft.trim());
    setEditing(false);
  }

  return (
    <div className="border-b border-line py-4 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            size={18}
            className={`shrink-0 text-muted transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <h3 className="font-display text-base font-semibold text-deep">{title}</h3>
        </button>

        {editable && !editing ? (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-ice-soft hover:text-accent"
          >
            <Pencil size={13} /> Editar
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-2 pl-6 text-[0.95rem] leading-relaxed text-ink">
          {editing ? (
            <div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.max(3, Math.ceil(draft.length / 70))}
                className="w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent"
                autoFocus
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={confirm}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover"
                >
                  <Check size={15} /> Aplicar
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-sm font-medium text-deep hover:border-mist"
                >
                  <X size={15} /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">
              {content.trim() ? (
                content
              ) : (
                <span className="text-muted">Sin contenido.</span>
              )}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
