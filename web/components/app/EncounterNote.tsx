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
  Zap,
} from "lucide-react";
import type { ClinicalNoteJson, ClinicalNoteSection } from "@/lib/api/clinical";
import {
  noteReviewLabel,
  splitReviewFindings,
  type NoteReview,
} from "@/lib/clinical/note-review";
import { AuditFindingList } from "@/components/app/AuditFindings";
import { HoverHint } from "@/components/ui/HoverHint";
import { SnippetPopup } from "@/components/app/SnippetPopup";
import { SnippetEditorDialog } from "@/components/app/SnippetEditorDialog";
import type { Snippet } from "@/lib/clinical/snippets";
import { appendSnippetText, insertSnippetText } from "@/lib/clinical/insert-text";
import { slashQueryAt, type SlashToken } from "@/lib/clinical/slash-trigger";
import { filenameToTitle } from "@/lib/clinical/file-to-text";
import {
  firstPlaceholderIn,
  nextPlaceholderAfter,
} from "@/lib/clinical/placeholders";

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
/**
 * A qué escribe el micrófono. Lleva `key` además del rótulo porque el dictado
 * literal se escribe en la sección, y `onChangeSection` va por key. El resumen
 * no es una sección de la plantilla: viaja con key vacía.
 */
export interface VoiceTarget {
  key: string;
  label: string;
}

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
  onVoiceInstruction?: (section: VoiceTarget, dictado: string) => void;
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
  const [verSugerencias, setVerSugerencias] = useState(false);

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
  const { principales, plegados } = splitReviewFindings(review);

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
        <AuditFindingList hallazgos={principales} />

        {/* Lo secundario queda a un clic: un aviso con muchas líneas se deja
            de leer entero, y entonces también se pierde lo importante. */}
        {plegados.length > 0 ? (
          verSugerencias ? (
            <div className="mt-2 border-t border-line pt-2">
              <AuditFindingList hallazgos={plegados} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setVerSugerencias(true)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <ChevronDown size={13} />
              Ver {plegados.length}{" "}
              {plegados.length === 1 ? "observación" : "observaciones"} más
            </button>
          )
        ) : null}
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
  onVoiceInstruction?: (section: VoiceTarget, dictado: string) => void;
  voiceProcessing: boolean;
}) {
  return (
    <EditableBlock
      target={{ key: "", label: "Resumen" }}
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
  onVoiceInstruction?: (section: VoiceTarget, dictado: string) => void;
  voiceProcessing: boolean;
}) {
  return (
    <EditableBlock
      target={{ key: section.key, label: section.label }}
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
  target,
  title,
  content,
  editable,
  onChange,
  onVoiceInstruction,
  voiceProcessing,
}: {
  target: VoiceTarget;
  title: string;
  content: string;
  editable: boolean;
  onChange: (content: string) => void;
  onVoiceInstruction?: (section: VoiceTarget, dictado: string) => void;
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

  // --- Atajos -------------------------------------------------------------
  const [snippetPanel, setSnippetPanel] = useState(false);
  const [slash, setSlash] = useState<SlashToken | null>(null);
  const [saveAsSnippet, setSaveAsSnippet] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // El clic en el popup saca el foco del textarea, y con él selectionStart deja
  // de ser fiable: la posición se guarda mientras el campo aún la tiene.
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  // Token de "/" que el médico descartó con Escape, para no reabrirle la lista
  // encima mientras sigue escribiendo esa misma palabra.
  const dismissedSlashRef = useRef<number | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Coloca el cursor donde quedó el texto insertado.
  //
  // Se hace aquí y no en un requestAnimationFrame: los frames no corren con la
  // pestaña en segundo plano y el cursor se quedaría al principio sin aviso.
  // Este efecto corre después del commit — o sea, después del autoFocus del
  // textarea recién montado, que es a quien había que ganarle.
  useEffect(() => {
    const pending = pendingSelectionRef.current;
    if (!pending || !editing) return;
    const node = textareaRef.current;
    if (!node) return;
    pendingSelectionRef.current = null;
    node.focus();
    node.setSelectionRange(pending.start, pending.end);
    selectionRef.current = { start: pending.start, end: pending.end };
  }, [draft, editing]);

  function rememberSelection(node: HTMLTextAreaElement) {
    selectionRef.current = { start: node.selectionStart, end: node.selectionEnd };
  }

  function refreshSlash(node: HTMLTextAreaElement) {
    const token = slashQueryAt(node.value, node.selectionStart);
    if (!token) {
      dismissedSlashRef.current = null;
      setSlash(null);
      return;
    }
    setSlash(dismissedSlashRef.current === token.start ? null : token);
  }

  /**
   * Inserta texto en la sección. Suma siempre: en edición entra donde está el
   * cursor (o reemplaza lo que haya seleccionado, que es lo que una selección
   * significa); en lectura se añade al final y el campo se abre para editar.
   *
   * El cambio va SOLO por setDraft: persistirlo aquí además, llamando a
   * onChange, competiría con el autoguardado de 1200 ms y escribiría dos veces.
   */
  function insertText(text: string, range?: { start: number; end: number }) {
    const base = editing ? draft : content;
    const result = range
      ? insertSnippetText(base, range.start, range.end, text)
      : editing
        ? insertSnippetText(
            base,
            selectionRef.current?.start ?? base.length,
            selectionRef.current?.end ?? base.length,
            text,
          )
        : appendSnippetText(base, text);
    // Si el atajo trae huecos ("[dosis]", "___"), el cursor cae en el primero
    // en vez de al final: es lo único que el médico tiene que escribir.
    const hueco = firstPlaceholderIn(result.next, result.selStart, result.selEnd);
    pendingSelectionRef.current = hueco ?? {
      start: result.selEnd,
      end: result.selEnd,
    };
    setSavedHint(false);
    setDraft(result.next);
    if (!editing) {
      setEditing(true);
      setOpen(true);
    }
  }

  /**
   * Tab salta al siguiente hueco por rellenar. Cuando ya no quedan, Tab vuelve
   * a hacer lo de siempre (salir del campo), así que nadie queda atrapado; y
   * Shift+Tab nunca se toca, que es la salida hacia atrás de quien navega con
   * teclado.
   */
  function onTextareaKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab" || event.shiftKey) return;
    const node = event.currentTarget;
    const hueco = nextPlaceholderAfter(node.value, node.selectionEnd);
    if (!hueco) return;
    event.preventDefault();
    node.setSelectionRange(hueco.start, hueco.end);
    selectionRef.current = { start: hueco.start, end: hueco.end };
  }

  function pickFromPanel(snippet: Snippet) {
    setSnippetPanel(false);
    insertText(snippet.content);
  }

  function pickFromSlash(snippet: Snippet) {
    const token = slash;
    setSlash(null);
    dismissedSlashRef.current = null;
    if (!token) return;
    const caret = textareaRef.current?.selectionStart ?? draft.length;
    insertText(snippet.content, { start: token.start, end: caret });
  }

  function insertFileText(text: string, file: File) {
    setSnippetPanel(false);
    insertText(text);
    // Se ofrece guardarlo: si ese texto lo va a volver a usar, mejor que quede
    // en la biblioteca que volver a buscar el archivo cada vez.
    setSaveAsSnippet({ title: filenameToTitle(file.name), content: text });
  }

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

  /**
   * Confirma YA lo que haya escrito, sin esperar la pausa de 1200 ms.
   *
   * Sin esto, escribir y pulsar "Guardar nota" enseguida dejaba el último
   * cambio en el limbo: el guardado se llevaba la versión vieja y, al vencer
   * el temporizador, la nota volvía a marcarse "sin guardar". El médico veía
   * que su primer clic no había servido — y peor, se había guardado una nota
   * desactualizada.
   */
  function confirmarCambio() {
    const trimmed = draft.trim();
    if (trimmed === content.trim()) return;
    onChangeRef.current(trimmed);
    setSavedHint(true);
  }

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
      if (instruction) onVoiceInstruction(target, instruction);
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
          {editable ? (
            <div className="relative">
              <HoverHint label="Insertar un atajo — o escribe / en el texto">
                <button
                  type="button"
                  onClick={() => setSnippetPanel((value) => !value)}
                  aria-label={`Insertar atajo en ${title}`}
                  aria-expanded={snippetPanel}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                    snippetPanel
                      ? "bg-accent-soft text-accent"
                      : "text-muted hover:bg-ice-soft hover:text-accent"
                  }`}
                >
                  <Zap size={14} />
                </button>
              </HoverHint>
              {snippetPanel ? (
                <SnippetPopup
                  mode="panel"
                  sectionTitle={title}
                  onPick={pickFromPanel}
                  onPickFileText={insertFileText}
                  onClose={() => setSnippetPanel(false)}
                />
              ) : null}
            </div>
          ) : null}
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
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => {
                    setSavedHint(false);
                    setDraft(e.target.value);
                    rememberSelection(e.target);
                    refreshSlash(e.target);
                  }}
                  onSelect={(e) => {
                    rememberSelection(e.currentTarget);
                    refreshSlash(e.currentTarget);
                  }}
                  onKeyDown={onTextareaKeyDown}
                  // Al salir del campo (p. ej. al ir a pulsar "Guardar nota") el
                  // cambio se confirma de una vez, sin esperar la pausa.
                  onBlur={(e) => {
                    rememberSelection(e.currentTarget);
                    confirmarCambio();
                  }}
                  rows={rowsForText(draft)}
                  className="w-full resize-y rounded-md border border-line bg-field px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent"
                  autoFocus
                />
                {slash ? (
                  <SnippetPopup
                    mode="inline"
                    sectionTitle={title}
                    query={slash.query}
                    onPick={pickFromSlash}
                    onClose={() => {
                      dismissedSlashRef.current = slash.start;
                      setSlash(null);
                    }}
                  />
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {savedHint ? (
                  <span className="text-xs font-medium text-success">Guardado</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    confirmarCambio();
                    setEditing(false);
                  }}
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

      {saveAsSnippet ? (
        <SnippetEditorDialog
          initial={{ ...saveAsSnippet, category: title }}
          categories={[title]}
          onClose={() => setSaveAsSnippet(null)}
          onSaved={() => setSaveAsSnippet(null)}
        />
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
