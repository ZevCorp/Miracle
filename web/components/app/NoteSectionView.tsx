"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronDown, Mic, Pencil, Plus, Trash2, X } from "lucide-react";
import type { NoteSection } from "@/lib/mock";

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

  const [savedHint, setSavedHint] = useState(false);
  const onChangeRef = useRef(onChange);

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

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* noop */
      }
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

  function startEdit() {
    setTexto(section.texto ?? "");
    setItems(section.items ?? []);
    setSavedHint(false);
    setEditing(true);
    setOpen(true);
  }

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
            className={`shrink-0 text-muted transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          />
          <h3 className="font-display text-base font-semibold text-deep">
            {section.titulo}
          </h3>
        </button>

        {editable && !editing ? (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-ice-soft hover:text-accent"
          >
            <Pencil size={14} /> <span className="hidden sm:inline">Editar</span>
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-2 pl-0 text-[0.95rem] leading-relaxed text-ink sm:pl-6">
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
                        className="min-w-0 flex-1 rounded-md border border-line bg-field px-3 py-1.5 text-sm outline-none focus:border-accent"
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
                <textarea
                  value={texto}
                  onChange={(e) => {
                    setSavedHint(false);
                    setTexto(e.target.value);
                  }}
                  rows={Math.max(3, Math.ceil(texto.length / 70))}
                  className="w-full resize-y rounded-md border border-line bg-field px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent"
                  autoFocus
                />
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
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-sm font-medium text-deep hover:border-mist"
                >
                  <X size={15} /> Cancelar
                </button>
                {savedHint ? (
                  <span className="text-xs font-medium text-success">
                    Guardado
                  </span>
                ) : null}
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
            <>
              {esLista && section.items ? (
                section.items.length ? (
                  <ul className="space-y-1.5">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">Sin elementos.</p>
                )
              ) : (
                <p className="whitespace-pre-wrap">
                  {section.texto?.trim() ? (
                    section.texto
                  ) : (
                    <span className="text-muted">Sin contenido.</span>
                  )}
                </p>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
