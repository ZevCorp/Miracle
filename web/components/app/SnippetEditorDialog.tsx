"use client";

import { useEffect, useId, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  createSnippet,
  SNIPPET_LIMITS,
  updateSnippet,
  validateSnippetDraft,
  type Snippet,
  type SnippetDraft,
} from "@/lib/clinical/snippets";
import { createClient } from "@/lib/supabase/client";

/**
 * Crear o editar un atajo. Vive en components/app/ y no en la página de
 * plantillas porque lo abren dos sitios: el gestor de atajos y el editor de la
 * nota (al insertar un texto desde un archivo, para ofrecer guardarlo).
 *
 * Sin `id` crea; con `id` actualiza.
 */
export function SnippetEditorDialog({
  id,
  initial,
  categories,
  onClose,
  onSaved,
}: {
  id?: string;
  initial?: Partial<SnippetDraft>;
  /** Categorías ya usadas, para sugerirlas en vez de inventar una nueva. */
  categories: readonly string[];
  onClose: () => void;
  onSaved: (snippet: Snippet) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listId = useId();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  async function save() {
    const draft: SnippetDraft = { title, content, category };
    const invalid = validateSnippetDraft(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const saved = id
        ? await updateSnippet(supabase, id, draft)
        : await createSnippet(supabase, draft);
      onSaved(saved);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el atajo. Intenta de nuevo.",
      );
      setSaving(false);
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
        aria-label={id ? "Editar atajo" : "Nuevo atajo"}
        className="mobile-bottom-sheet relative w-full max-w-xl rounded-t-3xl border border-b-0 border-line bg-surface p-5 shadow-[var(--shadow-xl)] sm:rounded-[24px] sm:border-b sm:p-6"
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
          {id ? "Editar atajo" : "Nuevo atajo"}
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-deep">
          {id ? "Ajusta tu texto" : "Guarda un texto que repites"}
        </h2>

        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
            <label className="block">
              <span className="text-sm font-semibold text-deep">Título</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={SNIPPET_LIMITS.title}
                placeholder="Ej. Gastritis crónica"
                className="clinical-control mt-1.5 w-full px-3"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-deep">Categoría</span>
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                maxLength={SNIPPET_LIMITS.category}
                list={listId}
                placeholder="Ej. Diagnóstico"
                className="clinical-control mt-1.5 w-full px-3"
              />
              <datalist id={listId}>
                {categories.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-deep">Texto</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={SNIPPET_LIMITS.content}
              rows={9}
              placeholder={"Escribe el texto tal como quieres que aparezca en la nota.\n\nSe respetan los saltos de línea y las viñetas."}
              className="mt-1.5 w-full resize-y rounded-md border border-line bg-field px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent"
            />
            <span className="mt-1 block text-xs text-muted">
              {content.length.toLocaleString("es-CO")} de{" "}
              {SNIPPET_LIMITS.content.toLocaleString("es-CO")} caracteres. Texto
              plano: se conservan saltos de línea y viñetas, no negrilla ni tablas.
            </span>
          </label>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="clinical-secondary px-5"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="clinical-primary px-5"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? "Guardando…" : "Guardar atajo"}
          </button>
        </div>
      </section>
    </div>
  );
}
