"use client";

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Copy,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  createSnippet,
  deleteSnippet,
  filterSnippets,
  groupSnippetsByCategory,
  SNIPPET_LIMITS,
  type Snippet,
} from "@/lib/clinical/snippets";
import { createClient } from "@/lib/supabase/client";
import { SnippetEditorDialog } from "@/components/app/SnippetEditorDialog";
import { SnippetImportDialog } from "./SnippetImportDialog";
import { useSnippets } from "@/components/app/SnippetsProvider";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { HoverHint } from "@/components/ui/HoverHint";

type EditorState = { id?: string; initial?: Partial<Snippet> } | null;

/**
 * El catálogo son ~69 KB de texto clínico. Cargándolo de forma estática viajaba
 * en el bundle de /app/plantillas para todo el que abriera la pantalla, aunque
 * se quedara en la pestaña de Plantillas y no viera nunca la biblioteca. Mismo
 * criterio que mammoth en file-to-text: lo que pesa se carga cuando se usa.
 */
const MiracleLibrary = lazy(() =>
  import("./MiracleLibrary").then((m) => ({ default: m.MiracleLibrary })),
);

/**
 * Gestión de los atajos del médico. Vive como pestaña de /app/plantillas: son
 * dos cosas distintas (la plantilla es el esqueleto de la nota, el atajo es
 * texto que se inserta dentro) pero el médico las busca en el mismo sitio,
 * "mis textos guardados".
 *
 * Aquí se ADMINISTRA; en la nota se USA. Son dos trabajos distintos y por eso
 * esta pantalla puede permitirse mostrar el contenido, agrupar y ofrecer
 * acciones, mientras que la lista que sale al escribir "/" es una sola línea
 * por atajo.
 */
export function AtajosManager({
  specialtyCode,
}: {
  specialtyCode?: string | null;
}) {
  const confirm = useConfirm();
  const { snippets, loading, error, ensureLoaded, reload, add, replace, remove } =
    useSnippets();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  const visible = useMemo(() => filterSnippets(snippets, { query }), [snippets, query]);
  const grupos = useMemo(() => groupSnippetsByCategory(visible), [visible]);

  function saved(snippet: Snippet, editing: boolean) {
    if (editing) replace(snippet);
    else add(snippet);
    setEditor(null);
    setFeedback(editing ? "Atajo actualizado." : "Atajo guardado y listo para usar.");
  }

  async function eliminar(snippet: Snippet) {
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
      remove(snippet.id);
      setFeedback("Atajo eliminado.");
    } catch {
      setFeedback("No se pudo eliminar el atajo. Intenta de nuevo.");
    } finally {
      setDeletingId(null);
    }
  }

  /**
   * Duplicar es la forma natural de partir de un atajo de Miracle y hacerlo
   * tuyo sin perder el original.
   */
  async function duplicar(snippet: Snippet) {
    setDuplicatingId(snippet.id);
    try {
      const copia = await createSnippet(createClient(), {
        title: `${snippet.title} (copia)`.slice(0, SNIPPET_LIMITS.title),
        content: snippet.content,
        category: snippet.category,
      });
      add(copia);
      setEditor({ id: copia.id, initial: copia });
      setFeedback("Copia creada. Ajústala como quieras.");
    } catch {
      setFeedback("No se pudo duplicar el atajo. Intenta de nuevo.");
    } finally {
      setDuplicatingId(null);
    }
  }

  const atTope = snippets.length >= SNIPPET_LIMITS.perUser;
  const filtrando = query.trim().length > 0;

  return (
    <div>
      <header className="border-b border-line pb-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="app-page-title">Mis atajos</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Los bloques de texto que repites en cada consulta. Se insertan en
              cualquier sección de la nota escribiendo{" "}
              <kbd className="rounded border border-line bg-field px-1 font-mono text-xs">
                /
              </kbd>{" "}
              seguido de lo que buscas.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => setImporting(true)}
              disabled={atTope}
              className="clinical-secondary min-h-12 w-full px-5 sm:w-auto"
            >
              <FileUp size={17} /> Importar desde archivos
            </button>
            <button
              type="button"
              onClick={() => setEditor({})}
              disabled={atTope}
              title={
                atTope ? `Llegaste al máximo de ${SNIPPET_LIMITS.perUser} atajos.` : undefined
              }
              className="clinical-primary min-h-12 w-full px-5 sm:w-auto"
            >
              <Plus size={17} /> Crear atajo
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* El contador decía siempre el total, aunque hubiera un filtro puesto:
              "12 atajos guardados" con dos en pantalla. Ahora dice la verdad. */}
          <div className="text-sm text-muted">
            {filtrando ? (
              <>
                <span className="font-semibold text-deep tabular-nums">
                  {visible.length}
                </span>{" "}
                de <span className="tabular-nums">{snippets.length}</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-deep tabular-nums">
                  {snippets.length}
                </span>{" "}
                {snippets.length === 1 ? "atajo guardado" : "atajos guardados"}
              </>
            )}
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
        <>
          {/* Sin nada guardado, la biblioteca ES la pantalla. Con atajos, queda
              como una sección más, siempre disponible. */}
          <div className="mt-6">
            <Suspense
              fallback={
                <div className="h-40 rounded-[14px] border border-line bg-surface" />
              }
            >
              <MiracleLibrary
                specialtyCode={specialtyCode}
                snippets={snippets}
                destacada={snippets.length === 0}
                onInstalled={async (mensaje) => {
                  // createSnippets no devuelve las filas y hacen falta los ids
                  // para poder editarlas.
                  await reload();
                  setFeedback(mensaje);
                }}
              />
            </Suspense>
          </div>

          {snippets.length === 0 ? null : visible.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
              Ningún atajo coincide con esa búsqueda.
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              {grupos.map((grupo) => (
                <section key={grupo.category || "sin-seccion"}>
                  <h2 className="flex items-baseline gap-2 text-sm font-semibold text-deep">
                    {grupo.category || "Sin sección"}
                    <span className="text-xs font-normal text-muted tabular-nums">
                      {grupo.snippets.length}
                    </span>
                  </h2>
                  <ul className="mt-2 space-y-2">
                    {grupo.snippets.map((snippet) => (
                      <SnippetRow
                        key={snippet.id}
                        snippet={snippet}
                        expandido={abierto === snippet.id}
                        eliminando={deletingId === snippet.id}
                        duplicando={duplicatingId === snippet.id}
                        onToggle={() =>
                          setAbierto((id) => (id === snippet.id ? null : snippet.id))
                        }
                        onEdit={() => setEditor({ id: snippet.id, initial: snippet })}
                        onDuplicate={() => void duplicar(snippet)}
                        onDelete={() => void eliminar(snippet)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      ) : null}

      {editor ? (
        <SnippetEditorDialog
          id={editor.id}
          initial={editor.initial}
          categories={grupos.map((g) => g.category).filter(Boolean)}
          onClose={() => setEditor(null)}
          onSaved={(snippet) => saved(snippet, Boolean(editor.id))}
        />
      ) : null}
      {importing ? (
        <SnippetImportDialog
          existingCategories={grupos.map((g) => g.category).filter(Boolean)}
          existingCount={snippets.length}
          onClose={() => setImporting(false)}
          onSaved={async (count) => {
            setImporting(false);
            try {
              await reload();
              setFeedback(`Se guardaron ${count} atajos.`);
            } catch {
              setFeedback("Se guardaron, pero no se pudo refrescar la lista.");
            }
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Una fila. El contenido completo se despliega aquí mismo: antes solo había dos
 * líneas recortadas y la única forma de leer un atajo entero era abrir el
 * editor, o sea entrar en modo edición para algo que era solo mirar.
 */
function SnippetRow({
  snippet,
  expandido,
  eliminando,
  duplicando,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  snippet: Snippet;
  expandido: boolean;
  eliminando: boolean;
  duplicando: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-xl border border-line bg-surface shadow-[var(--shadow-xs)]">
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expandido}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <ChevronDown
            size={15}
            className={`mt-0.5 shrink-0 text-muted transition-transform ${
              expandido ? "" : "-rotate-90"
            }`}
          />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-deep">{snippet.title}</span>
            {expandido ? null : (
              <span className="mt-0.5 block truncate text-[13px] text-muted">
                {snippet.content.replace(/\s+/g, " ")}
              </span>
            )}
          </span>
        </button>
        {/* Iconos y no botones con texto: son tres acciones por fila y con
            cincuenta filas el texto repetido es todo lo que se ve. */}
        <div className="flex shrink-0 items-center gap-0.5">
          <HoverHint label="Editar">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Editar ${snippet.title}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-ice-soft hover:text-accent"
            >
              <Pencil size={14} />
            </button>
          </HoverHint>
          <HoverHint label="Duplicar">
            <button
              type="button"
              onClick={onDuplicate}
              disabled={duplicando}
              aria-label={`Duplicar ${snippet.title}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-ice-soft hover:text-accent disabled:opacity-40"
            >
              {duplicando ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </HoverHint>
          <HoverHint label="Eliminar">
            <button
              type="button"
              onClick={onDelete}
              disabled={eliminando}
              aria-label={`Eliminar ${snippet.title}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-40"
            >
              {eliminando ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
            </button>
          </HoverHint>
        </div>
      </div>
      {expandido ? (
        <p className="whitespace-pre-wrap border-t border-line px-3 py-3 pl-[34px] text-[13px] leading-relaxed text-ink">
          {snippet.content}
        </p>
      ) : null}
    </li>
  );
}
