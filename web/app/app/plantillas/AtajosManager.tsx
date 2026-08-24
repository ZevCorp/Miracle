"use client";

import { useEffect, useMemo, useState } from "react";
import { FileUp, Loader2, Pencil, Plus, Search, Trash2, X, Zap } from "lucide-react";
import {
  categoriesFrom,
  deleteSnippet,
  filterSnippets,
  getSnippets,
  SNIPPET_LIMITS,
  type Snippet,
} from "@/lib/clinical/snippets";
import { createClient } from "@/lib/supabase/client";
import { SnippetEditorDialog } from "@/components/app/SnippetEditorDialog";
import { SnippetImportDialog } from "./SnippetImportDialog";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type EditorState = { id?: string; initial?: Partial<Snippet> } | null;

/**
 * Gestión de los atajos del médico. Vive como pestaña de /app/plantillas: son
 * dos cosas distintas (la plantilla es el esqueleto de la nota, el atajo es
 * texto que se inserta dentro) pero el médico las busca en el mismo sitio,
 * "mis textos guardados".
 */
export function AtajosManager() {
  const confirm = useConfirm();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSnippets(createClient())
      .then((result) => {
        if (cancelled) return;
        setSnippets(result);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar tus atajos.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => categoriesFrom(snippets), [snippets]);
  const visible = useMemo(
    () => filterSnippets(snippets, { query, category }),
    [snippets, query, category],
  );

  function saved(snippet: Snippet, editing: boolean) {
    setSnippets((list) =>
      editing
        ? list.map((item) => (item.id === snippet.id ? snippet : item))
        : [snippet, ...list],
    );
    setEditor(null);
    setFeedback(editing ? "Atajo actualizado." : "Atajo guardado y listo para usar.");
  }

  async function remove(snippet: Snippet) {
    const ok = await confirm({
      titulo: `¿Eliminar «${snippet.title}»?`,
      descripcion: "El atajo desaparece de tu biblioteca. No se puede deshacer.",
      confirmLabel: "Eliminar",
      tono: "peligro",
    });
    if (!ok) return;
    setDeletingId(snippet.id);
    try {
      await deleteSnippet(createClient(), snippet.id);
      setSnippets((list) => list.filter((item) => item.id !== snippet.id));
      setFeedback("Atajo eliminado.");
    } catch {
      setFeedback("No se pudo eliminar el atajo. Intenta de nuevo.");
    } finally {
      setDeletingId(null);
    }
  }

  const atTopeDeAtajos = snippets.length >= SNIPPET_LIMITS.perUser;

  return (
    <div>
      <header className="border-b border-line pb-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="app-page-kicker text-accent">Biblioteca clínica</p>
            <h1 className="app-page-title mt-1">Mis atajos</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Los textos que repites en cada consulta. Se insertan en cualquier
              sección de la nota con el botón{" "}
              <Zap size={13} className="inline align-[-1px] text-accent" /> o
              escribiendo <kbd className="rounded border border-line bg-field px-1 font-mono text-xs">/</kbd>{" "}
              seguido de lo que buscas.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => setImporting(true)}
              disabled={atTopeDeAtajos}
              className="clinical-secondary min-h-12 w-full px-5 sm:w-auto"
            >
              <FileUp size={17} /> Importar desde archivos
            </button>
            <button
              type="button"
              onClick={() => setEditor({})}
              disabled={atTopeDeAtajos}
              title={
                atTopeDeAtajos
                  ? `Llegaste al máximo de ${SNIPPET_LIMITS.perUser} atajos.`
                  : undefined
              }
              className="clinical-primary min-h-12 w-full px-5 sm:w-auto"
            >
              <Plus size={17} /> Crear atajo
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-muted">
            <span className="font-semibold text-deep">{snippets.length}</span>{" "}
            {snippets.length === 1 ? "atajo guardado" : "atajos guardados"}
          </div>
          <div className="clinical-control flex items-center gap-2 px-3">
            <Search size={16} className="text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar atajo"
              aria-label="Buscar atajo"
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
        </div>

        {categories.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <CategoryChip
              label="Todas"
              active={category === null}
              onClick={() => setCategory(null)}
            />
            {categories.map((option) => (
              <CategoryChip
                key={option}
                label={option}
                active={category === option}
                onClick={() => setCategory(category === option ? null : option)}
              />
            ))}
          </div>
        ) : null}
      </header>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Los atajos son privados: nadie más de tu institución los ve. No guardes
        datos de pacientes en ellos.
      </p>

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
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-8 flex justify-center rounded-xl border border-line bg-surface p-14 text-sm text-muted">
          <Loader2 size={18} className="mr-2 animate-spin text-accent" /> Cargando
          tus atajos…
        </div>
      ) : null}

      {!loading && !error ? (
        snippets.length === 0 ? (
          <EmptyLibrary onCreate={() => setEditor({})} />
        ) : visible.length === 0 ? (
          <p className="mt-8 rounded-xl border border-line bg-surface p-10 text-center text-sm text-muted">
            Ningún atajo coincide con esa búsqueda.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {visible.map((snippet) => (
              <li
                key={snippet.id}
                className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-deep">{snippet.title}</p>
                    {snippet.category ? (
                      <span className="mt-1 inline-block rounded-full bg-ice px-2 py-0.5 text-xs font-medium text-ink-soft">
                        {snippet.category}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditor({ id: snippet.id, initial: snippet })}
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-ice-soft hover:text-accent"
                    >
                      <Pencil size={14} /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(snippet)}
                      disabled={deletingId === snippet.id}
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                    >
                      <Trash2 size={14} />{" "}
                      {deletingId === snippet.id ? "Eliminando…" : "Eliminar"}
                    </button>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {snippet.content}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {editor ? (
        <SnippetEditorDialog
          id={editor.id}
          initial={editor.initial}
          categories={categories}
          onClose={() => setEditor(null)}
          onSaved={(snippet) => saved(snippet, Boolean(editor.id))}
        />
      ) : null}

      {importing ? (
        <SnippetImportDialog
          existingCategories={categories}
          existingCount={snippets.length}
          onClose={() => setImporting(false)}
          onSaved={(count) => {
            setImporting(false);
            setFeedback(
              `${count} ${count === 1 ? "atajo importado" : "atajos importados"}.`,
            );
            // Se recargan del servidor: la importación no devuelve las filas
            // creadas y hacen falta sus ids para editar o eliminar.
            void getSnippets(createClient())
              .then(setSnippets)
              .catch(() => setError("Se guardaron, pero no se pudo refrescar la lista."));
          }}
        />
      ) : null}
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        active
          ? "border-accent bg-accent-soft text-accent-ink"
          : "border-line bg-surface text-ink-soft hover:border-mist hover:text-deep"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyLibrary({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-8 rounded-xl border border-line bg-surface p-10 text-center">
      <Zap size={26} className="mx-auto text-accent" />
      <p className="mt-4 font-display text-lg font-semibold text-deep">
        Aún no tienes atajos
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        Guarda una vez el texto de un diagnóstico o un plan que escribes siempre,
        y a partir de ahí lo insertas en la nota en dos teclas.
      </p>
      <button type="button" onClick={onCreate} className="clinical-primary mt-5 px-5">
        <Plus size={17} /> Crear mi primer atajo
      </button>
    </div>
  );
}
