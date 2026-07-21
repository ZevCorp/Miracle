"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ClipboardCopy,
  Info,
  Mic,
  X,
} from "lucide-react";
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
  onVoiceInstruction,
  voiceProcessingSection,
}: {
  note: ClinicalNoteJson;
  editable: boolean;
  onChangeSection: (key: string, content: string) => void;
  onChangeSummary: (summary: string) => void;
  /** Instrucción hablada para modificar una sección con el asistente clínico. */
  onVoiceInstruction?: (sectionTitle: string, instruction: string) => void;
  voiceProcessingSection?: string | null;
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

      <div className="rounded-lg border border-line bg-surface px-3 py-2 sm:px-5">
        <SummaryBlock
          summary={note.summary}
          editable={editable}
          onChange={onChangeSummary}
          onVoiceInstruction={onVoiceInstruction}
          voiceProcessing={voiceProcessingSection === "Resumen"}
        />
        {note.sections.map((section) => (
          <SectionBlock
            key={section.key}
            section={section}
            editable={editable}
            onChange={(content) => onChangeSection(section.key, content)}
            onVoiceInstruction={onVoiceInstruction}
            voiceProcessing={voiceProcessingSection === section.label}
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
  onVoiceInstruction,
  voiceProcessing,
}: {
  summary: string;
  editable: boolean;
  onChange: (summary: string) => void;
  onVoiceInstruction?: (sectionTitle: string, instruction: string) => void;
  voiceProcessing: boolean;
}) {
  return (
    <EditableBlock
      title="Resumen"
      content={summary}
      editable={editable}
      onChange={onChange}
      onVoiceInstruction={onVoiceInstruction}
      voiceProcessing={voiceProcessing}
    />
  );
}

function SectionBlock({
  section,
  editable,
  onChange,
  onVoiceInstruction,
  voiceProcessing,
}: {
  section: ClinicalNoteSection;
  editable: boolean;
  onChange: (content: string) => void;
  onVoiceInstruction?: (sectionTitle: string, instruction: string) => void;
  voiceProcessing: boolean;
}) {
  return (
    <EditableBlock
      title={section.label}
      content={section.content}
      editable={editable}
      onChange={onChange}
      onVoiceInstruction={onVoiceInstruction}
      voiceProcessing={voiceProcessing}
    />
  );
}

// Filas iniciales del textarea de una sección: arranca más alto que un input
// normal y crece con el contenido (saltos de línea reales o ajuste estimado
// por ancho) hasta un techo generoso; pasado ese punto, resize-y permite
// seguir agrandándolo a mano.
const MIN_SECTION_ROWS = 6;
const MAX_SECTION_ROWS = 22;

function rowsForText(text: string): number {
  const lineBreaks = text.split("\n").length;
  const wrapped = Math.ceil(text.length / 60);
  return Math.min(MAX_SECTION_ROWS, Math.max(MIN_SECTION_ROWS, lineBreaks, wrapped));
}

function EditableBlock({
  title,
  content,
  editable,
  onChange,
  onVoiceInstruction,
  voiceProcessing,
}: {
  title: string;
  content: string;
  editable: boolean;
  onChange: (content: string) => void;
  onVoiceInstruction?: (sectionTitle: string, instruction: string) => void;
  voiceProcessing: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Autoguardado: el cambio se persiste solo tras una breve pausa al
  // escribir, sin depender de que el médico confirme nada (igual que en la
  // nota ya firmada).
  useEffect(() => {
    if (!editing) return;
    const trimmed = draft.trim();
    if (trimmed === content.trim()) return;
    const h = setTimeout(() => {
      onChangeRef.current(trimmed);
      setSavedHint(true);
    }, 1200);
    return () => clearTimeout(h);
  }, [editing, draft, content]);

  function startEdit() {
    setDraft(content);
    setSavedHint(false);
    setEditing(true);
    setOpen(true);
  }

  function copy() {
    if (!content.trim()) return;
    void navigator.clipboard.writeText(content).catch(() => {
      setVoiceError("No se pudo copiar este campo.");
    });
  }

  function dictateChange() {
    const Recognition = getSpeechRecognition();
    if (!Recognition || !onVoiceInstruction) {
      setVoiceError("El dictado no está disponible en este navegador.");
      return;
    }
    setVoiceError(null);
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "es-CO";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const instruction = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (instruction) onVoiceInstruction(title, instruction);
    };
    recognition.onerror = () => {
      setVoiceError("No pudimos entender el cambio. Intenta dictarlo de nuevo.");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    setListening(true);
    recognition.start();
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

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={copy}
            disabled={!content.trim()}
            aria-label={`Copiar ${title}`}
            title="Copiar campo"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-ice-soft hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ClipboardCopy size={14} />
          </button>
          {editable && onVoiceInstruction ? (
            <button
              type="button"
              onClick={dictateChange}
              disabled={listening || voiceProcessing}
              aria-label={`Dictar cambio para ${title}`}
              title="Dictar un cambio"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                listening ? "bg-danger-soft text-danger" : "text-muted hover:bg-ice-soft hover:text-accent"
              }`}
            >
              <Mic size={14} className={listening || voiceProcessing ? "animate-pulse" : ""} />
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="mt-2 pl-0 text-[0.95rem] leading-relaxed text-ink sm:pl-6">
          {editing ? (
            <div>
              <textarea
                value={draft}
                onChange={(e) => {
                  setSavedHint(false);
                  setDraft(e.target.value);
                }}
                rows={rowsForText(draft)}
                className="w-full resize-y rounded-md border border-line bg-field px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent"
                autoFocus
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {savedHint ? (
                  <span className="text-xs font-medium text-success">Guardado</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-sm font-medium text-deep hover:border-mist"
                >
                  <X size={15} /> Cerrar
                </button>
              </div>
            </div>
          ) : (
            // Único punto de entrada a edición: tocar el texto (sin botón
            // "Editar" aparte, ya no aporta nada). Accesible por teclado
            // (role=button + Enter/Espacio) para quien no usa mouse/touch.
            <div
              role={editable ? "button" : undefined}
              tabIndex={editable ? 0 : undefined}
              onClick={editable ? startEdit : undefined}
              onKeyDown={
                editable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        startEdit();
                      }
                    }
                  : undefined
              }
              className={
                editable
                  ? "-mx-2 rounded-md px-2 py-1 transition-colors hover:bg-ice-soft"
                  : undefined
              }
              title={editable ? "Toca para editar esta sección" : undefined}
            >
              <p className="whitespace-pre-wrap">
                {content.trim() ? (
                  content
                ) : (
                  <span className="text-muted">Sin contenido.</span>
                )}
              </p>
            </div>
          )}
          {listening ? (
            <p className="mt-2 text-xs font-medium text-danger">
              Escuchando el cambio para {title}...
            </p>
          ) : null}
          {voiceProcessing ? (
            <p className="mt-2 text-xs font-medium text-accent">
              Aplicando el cambio dictado...
            </p>
          ) : null}
          {voiceError ? <p role="alert" className="mt-2 text-xs text-danger">{voiceError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

type SpeechRecognitionResultLike = { 0?: { transcript?: string } };
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const browserWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}
