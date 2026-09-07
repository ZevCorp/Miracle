"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  Copy,
  Mic,
  Plus,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import type { NoteSection } from "@/lib/mock";
import { HoverHint } from "@/components/ui/HoverHint";
import { SnippetPopup } from "@/components/app/SnippetPopup";
import { SnippetEditorDialog } from "@/components/app/SnippetEditorDialog";
import type { Snippet } from "@/lib/clinical/snippets";
import {
  appendSnippetText,
  insertSnippetText,
  snippetToListItems,
} from "@/lib/clinical/insert-text";
import { slashQueryAt, type SlashToken } from "@/lib/clinical/slash-trigger";
import {
  firstPlaceholderIn,
  nextPlaceholderAfter,
} from "@/lib/clinical/placeholders";

export function NoteSectionView({
  section,
  editable = false,
  onChange,
}: {
  section: NoteSection;
  editable?: boolean;
  onChange?: (next: Partial<NoteSection>) => void;
}) {
  const [open, setOpen] = useState(!section.colapsadaPorDefecto);
  const [editing, setEditing] = useState(false);
  const [texto, setTexto] = useState(section.texto ?? "");
  const [items, setItems] = useState<string[]>(section.items ?? []);

  const esLista = section.kind === "lista";
  // Contenido de la sección en texto plano, para copiar solo esta sección.
  const contenido = esLista
    ? (section.items ?? []).map((i) => i.trim()).filter(Boolean).join("\n")
    : (section.texto ?? "").trim();

  const [savedHint, setSavedHint] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);

  // --- Atajos ---
  const [slash, setSlash] = useState<SlashToken | null>(null);
  // Un ref no re-renderiza, y el icono del botón depende de si hay selección.
  const [haySeleccion, setHaySeleccion] = useState(false);
  const [saveAsSnippet, setSaveAsSnippet] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // El clic en el popup saca el foco del campo: la posición del cursor se
  // guarda antes, mientras el textarea todavía la reporta bien.
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const dismissedSlashRef = useRef<number | null>(null);

  const [listening, setListening] = useState(false);
  const dictSupported = useSyncExternalStore(
    () => () => undefined,
    () =>
      typeof window !== "undefined" &&
      Boolean(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition,
      ),
    () => false,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Deja el cursor al final de lo insertado.
  //
  // Se hace aquí y no en un requestAnimationFrame: los frames no corren si la
  // pestaña está en segundo plano, y entonces el cursor se quedaría al
  // principio sin que nada avisara. Este efecto corre después del commit, o
  // sea después del autoFocus del textarea recién montado, que es justo lo que
  // había que ganarle.
  useEffect(() => {
    const pending = pendingSelectionRef.current;
    if (!pending || !editing) return;
    const node = textareaRef.current;
    if (!node) return;
    pendingSelectionRef.current = null;
    node.focus();
    node.setSelectionRange(pending.start, pending.end);
    selectionRef.current = { start: pending.start, end: pending.end };
  }, [texto, editing]);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* noop */
      }
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  function stopDictado() {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  }

  function toggleDictado() {
    if (listening) {
      stopDictado();
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "es-CO";
    rec.continuous = true;
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let add = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) add += e.results[i][0].transcript;
      }
      if (add.trim()) {
        setSavedHint(false);
        setTexto((t) => (t ? `${t} ${add.trim()}` : add.trim()));
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  // Autoguardado: si hay cambios sin guardar, se persisten solos tras una
  // breve pausa al escribir (así no se pierden si se cierra el editor).
  useEffect(() => {
    if (!editing) return;
    const limpios = items.map((i) => i.trim()).filter(Boolean);
    const cambiado = esLista
      ? JSON.stringify(limpios) !== JSON.stringify(section.items ?? [])
      : texto.trim() !== (section.texto ?? "").trim();
    if (!cambiado) return;
    const h = setTimeout(() => {
      onChangeRef.current?.(esLista ? { items: limpios } : { texto: texto.trim() });
      setSavedHint(true);
    }, 1200);
    return () => clearTimeout(h);
  }, [editing, texto, items, esLista, section.items, section.texto]);

  function copyContent() {
    if (!contenido) return;
    void navigator.clipboard
      ?.writeText(contenido)
      .then(() => {
        setCopied(true);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {
        /* portapapeles no disponible: sin acción */
      });
  }

  function startEdit() {
    setTexto(section.texto ?? "");
    setItems(section.items ?? []);
    setSavedHint(false);
    setEditing(true);
    setOpen(true);
  }

  // --- Atajos -------------------------------------------------------------

  function rememberSelection(node: HTMLTextAreaElement) {
    selectionRef.current = { start: node.selectionStart, end: node.selectionEnd };
    setHaySeleccion(node.selectionEnd > node.selectionStart);
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
   * Inserta texto en la sección. Suma siempre, nunca reemplaza lo escrito.
   *
   * En las secciones de lista cada línea del atajo entra como un punto (sin su
   * viñeta: la lista ya pinta la suya) y no aplica ni el cursor ni la "/", que
   * son cosas del textarea.
   */
  function insertText(text: string, range?: { start: number; end: number }) {
    if (esLista) {
      const nuevos = snippetToListItems(text);
      if (!nuevos.length) return;
      setSavedHint(false);
      setItems((list) => [...(editing ? list : section.items ?? []), ...nuevos]);
      if (!editing) {
        setTexto(section.texto ?? "");
        setEditing(true);
        setOpen(true);
      }
      return;
    }

    const base = editing ? texto : section.texto ?? "";
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
    // Si el atajo trae huecos ("[dosis]", "___"), el cursor cae en el primero.
    const hueco = firstPlaceholderIn(result.next, result.selStart, result.selEnd);
    pendingSelectionRef.current = hueco ?? {
      start: result.selEnd,
      end: result.selEnd,
    };
    setSavedHint(false);
    setTexto(result.next);
    if (!editing) {
      setItems(section.items ?? []);
      setEditing(true);
      setOpen(true);
    }
  }

  /**
   * Tab salta al siguiente hueco por rellenar. Sin huecos, Tab hace lo de
   * siempre y sale del campo; Shift+Tab nunca se toca.
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

  function pickFromSlash(snippet: Snippet) {
    const token = slash;
    setSlash(null);
    dismissedSlashRef.current = null;
    if (!token) return;
    const caret = textareaRef.current?.selectionStart ?? texto.length;
    insertText(snippet.content, { start: token.start, end: caret });
  }

  /**
   * El botón de atajos ESCRIBE la "/" en vez de abrir un panel aparte: un solo
   * mecanismo que aprender, y el botón es lo que lo enseña.
   */
  function abrirAtajos() {
    const node = textareaRef.current;
    if (editing && node && !esLista) {
      const at = selectionRef.current?.start ?? node.value.length;
      const next = `${node.value.slice(0, at)}/${node.value.slice(at)}`;
      pendingSelectionRef.current = { start: at + 1, end: at + 1 };
      dismissedSlashRef.current = null;
      setSavedHint(false);
      setTexto(next);
      setSlash({ query: "", start: at });
      node.focus();
      return;
    }
    // En lectura (o en una sección de lista, que no tiene textarea): se abre el
    // campo con la "/" al final y la lista sale sola.
    const base = editing ? texto : section.texto ?? "";
    const next = base ? `${base}\n/` : "/";
    pendingSelectionRef.current = { start: next.length, end: next.length };
    dismissedSlashRef.current = null;
    setTexto(next);
    setSlash({ query: "", start: next.length - 1 });
    setEditing(true);
    setOpen(true);
  }

  /** Guardar como atajo lo que el médico acaba de escribir y seleccionar. */
  function guardarSeleccion() {
    const seleccion = selectionRef.current;
    if (!seleccion) return;
    const contenido = texto.slice(seleccion.start, seleccion.end).trim();
    if (!contenido) return;
    setSaveAsSnippet({ title: "", content: contenido });
  }

  // Un control, dos significados: con texto seleccionado guarda esa selección
  // como atajo; sin selección, abre la lista.
  const snippetButton = (
    <HoverHint
      label={
        haySeleccion
          ? "Guardar lo seleccionado como atajo"
          : "Insertar un atajo — o escribe / en el texto"
      }
    >
      <button
        type="button"
        // Sin esto el textarea pierde el foco al pulsar y con él la selección.
        onMouseDown={(event) => event.preventDefault()}
        onClick={haySeleccion ? guardarSeleccion : abrirAtajos}
        aria-label={
          haySeleccion
            ? `Guardar la selección de ${section.titulo} como atajo`
            : `Insertar atajo en ${section.titulo}`
        }
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-ice-soft hover:text-accent"
      >
        {haySeleccion ? <BookmarkPlus size={14} /> : <Zap size={14} />}{" "}
        <span className="hidden sm:inline">{haySeleccion ? "Guardar" : "Atajo"}</span>
      </button>
    </HoverHint>
  );

  function cancel() {
    stopDictado();
    setEditing(false);
  }

  function save() {
    stopDictado();
    if (esLista) {
      const limpios = items.map((i) => i.trim()).filter(Boolean);
      onChange?.({ items: limpios });
    } else {
      onChange?.({ texto: texto.trim() });
    }
    setEditing(false);
  }

  return (
    <div id={`nota-${section.id}`} className="scroll-mt-24 border-b border-doc-line-soft py-4 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            size={18}
            className={`shrink-0 text-muted transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          />
          <h3 className="doc-label">
            {section.titulo}
          </h3>
        </button>

        {!editing ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={copyContent}
              disabled={!contenido}
              aria-label={`Copiar ${section.titulo}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                copied ? "text-success" : "text-muted hover:bg-ice-soft hover:text-accent"
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copied ? "Copiado" : "Copiar"}</span>
            </button>
            {editable ? snippetButton : null}
          </div>
        ) : null}
      </div>

      {open ? (
        <div className="mt-2 pl-0 sm:pl-6">
          {/* ----- Modo edición ----- */}
          {editing ? (
            <div>
              {esLista ? (
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <input
                        value={item}
                        onChange={(e) => {
                          setSavedHint(false);
                          setItems((list) =>
                            list.map((v, j) => (j === i ? e.target.value : v)),
                          );
                        }}
                        className="clinical-control min-w-0 flex-1 px-3 text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSavedHint(false);
                          setItems((list) => list.filter((_, j) => j !== i));
                        }}
                        aria-label="Quitar"
                        className="text-muted hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setSavedHint(false);
                      setItems((list) => [...list, ""]);
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                  >
                    <Plus size={14} /> Agregar punto
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={texto}
                    onChange={(e) => {
                      setSavedHint(false);
                      setTexto(e.target.value);
                      rememberSelection(e.target);
                      refreshSlash(e.target);
                    }}
                    onSelect={(e) => {
                      rememberSelection(e.currentTarget);
                      refreshSlash(e.currentTarget);
                    }}
                    onKeyDown={onTextareaKeyDown}
                    onBlur={(e) => rememberSelection(e.currentTarget)}
                    rows={Math.max(3, Math.ceil(texto.length / 70))}
                    className="clinical-control w-full resize-y px-3 py-2 text-sm leading-relaxed outline-none"
                    autoFocus
                  />
                  {slash ? (
                    <SnippetPopup
                      sectionTitle={section.titulo}
                      query={slash.query}
                      textareaRef={textareaRef}
                      caretIndex={slash.start}
                      onPick={pickFromSlash}
                      onClose={() => {
                        dismissedSlashRef.current = slash.start;
                        setSlash(null);
                      }}
                    />
                  ) : null}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={save}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover"
                >
                  <Check size={15} /> Guardar
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  className="clinical-secondary px-4"
                >
                  <X size={15} /> Cancelar
                </button>
                {savedHint ? (
                  <span className="text-xs font-medium text-success">
                    Guardado
                  </span>
                ) : null}
                {snippetButton}
                {!esLista && dictSupported ? (
                  <button
                    type="button"
                    onClick={toggleDictado}
                    className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                      listening
                        ? "border-danger/40 bg-danger/10 text-danger"
                        : "border-line text-deep hover:border-mist"
                    }`}
                  >
                    <Mic size={15} /> {listening ? "Detener" : "Dictar"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            /* ----- Modo lectura ----- */
            /* Click directo sobre el texto entra a edición: el médico toca lo
               que quiere corregir. No hay botón "Editar"; el propio bloque es
               el control, alcanzable con teclado y lector de pantalla. */
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
                  ? "-mx-2 rounded-[10px] px-2 py-1 transition-colors hover:bg-ice-soft"
                  : undefined
              }
              title={editable ? "Toca para editar esta sección" : undefined}
            >
              {esLista && section.items ? (
                section.items.length ? (
                  <ul className="doc-body space-y-1.5">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-doc-muted">Sin elementos.</p>
                )
              ) : (
                <p className="doc-body whitespace-pre-wrap">
                  {section.texto?.trim() ? (
                    section.texto
                  ) : (
                    <span className="font-sans text-sm text-doc-muted">Sin contenido.</span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}

      {saveAsSnippet ? (
        <SnippetEditorDialog
          initial={{ ...saveAsSnippet, category: section.titulo }}
          categories={[section.titulo]}
          onClose={() => setSaveAsSnippet(null)}
          onSaved={() => setSaveAsSnippet(null)}
        />
      ) : null}
    </div>
  );
}
