"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  Info,
  Mic,
  X,
} from "lucide-react";
import type { ClinicalNoteJson, ClinicalNoteSection } from "@/lib/api/clinical";
import { noteReviewLabel, type NoteReview } from "@/lib/clinical/note-review";
import { AuditFindingList } from "@/components/app/AuditFindings";

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
  review,
  editable,
  onChangeSection,
  onChangeSummary,
  onVoiceInstruction,
  voiceProcessingSection,
}: {
  note: ClinicalNoteJson;
  /**
   * Revisión determinista de la nota (lib/clinical/note-review.ts). Obligatoria
   * a propósito: antes este bloque se alimentaba solo de `note.warnings` y
   * `note.missing_required_sections`, que el backend emite de forma
   * intermitente, y el aviso aparecía a ratos. La revisión ya integra ambos.
   */
  review: NoteReview;
  editable: boolean;
  onChangeSection: (key: string, content: string) => void;
  onChangeSummary: (summary: string) => void;
  /** Instrucción hablada para modificar una sección con el asistente clínico. */
  onVoiceInstruction?: (sectionTitle: string, instruction: string) => void;
  voiceProcessingSection?: string | null;
}) {
  return (
    <div>
      <div className="mb-4 flex items-start gap-2 rounded-md border border-accent/20 bg-accent-soft/50 px-3.5 py-2.5 text-sm text-accent-ink">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>
          Contenido generado con IA a partir de la transcripción. Verifique cada
          sección; la nota requiere revisión y aprobación médica.
        </span>
      </div>

      <NoteReviewPanel review={review} />

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

/**
 * El recordatorio para el médico: qué falta, qué está incompleto y qué conviene
 * reforzar antes de guardar. Se pinta SIEMPRE que haya nota — cuando no hay nada
 * que señalar dice justo eso. Esa es la diferencia con la versión anterior: un
 * aviso que solo aparece a veces no se lee como "hoy está bien", se lee como
 * "está roto", y se termina ignorando.
 *
 * El color sigue a la severidad peor: rojo si algo es crítico, ámbar para lo
 * demás, verde cuando no hay observaciones.
 */
function NoteReviewPanel({ review }: { review: NoteReview }) {
  if (review.hallazgos.length === 0) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md border border-success/30 bg-success-soft px-3.5 py-2.5 text-sm text-success">
        <CheckCircle2 size={16} className="shrink-0" />
        <span>
          Revisión de la nota: sin observaciones. Está completa y consistente.
        </span>
      </div>
    );
  }

  const critico = review.criticos > 0;

  return (
    <section
      role="alert"
      aria-label="Revisión de la nota"
      className={`mb-4 rounded-md border px-3.5 py-3 ${
        critico
          ? "border-danger/40 bg-danger-soft"
          : "border-warning/40 bg-warning-soft"
      }`}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          size={16}
          className={`mt-0.5 shrink-0 ${critico ? "text-danger" : "text-warning"}`}
        />
        <div className="min-w-0">
          <p
            className={`text-sm font-semibold ${
              critico ? "text-danger" : "text-warning"
            }`}
          >
            Antes de guardar — {noteReviewLabel(review)}
          </p>
          <p
            className={`mt-0.5 text-xs leading-relaxed ${
              critico ? "text-danger/85" : "text-warning/85"
            }`}
          >
            Esto es lo que quedó pendiente o se puede mejorar de la consulta.
          </p>
        </div>
      </div>

      {/* Sobre fondo propio: los chips de severidad de AuditFindingList pierden
          contraste si se pintan directamente sobre el ámbar. */}
      <div className="mt-3 rounded-md border border-line bg-surface px-3 py-3">
        <AuditFindingList hallazgos={review.hallazgos} />
      </div>
    </section>
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
