"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, FileUp, Loader2, Sparkles, X } from "lucide-react";
import {
  extractTextFromFile,
  filenameToTitle,
  MAX_IMPORT_FILES,
  SNIPPET_FILE_ACCEPT,
  validateSnippetFile,
} from "@/lib/clinical/file-to-text";
import {
  applySuggestions,
  CATEGORIZE_CHUNK,
  CATEGORIZE_TEXT_CHARS,
  chunk,
  rowsToSave,
  type ImportRow,
  type SnippetSuggestion,
} from "@/lib/clinical/snippet-import";
import { createSnippets, SNIPPET_LIMITS } from "@/lib/clinical/snippets";
import { createClient } from "@/lib/supabase/client";

type Phase = "elegir" | "leyendo" | "sugiriendo" | "revisar" | "guardando";

/**
 * Importar de golpe los archivos de texto que el médico ya tiene.
 *
 * Tres pasos: leer los archivos (en el navegador), pedirle a la IA un título y
 * una categoría para cada uno, y REVISAR. Nada se guarda antes de la revisión,
 * y si la IA no responde la importación continúa igual con el nombre del
 * archivo como título.
 */
export function SnippetImportDialog({
  existingCategories,
  existingCount,
  onClose,
  onSaved,
}: {
  existingCategories: readonly string[];
  existingCount: number;
  onClose: () => void;
  onSaved: (saved: number) => void;
}) {
  const [phase, setPhase] = useState<Phase>("elegir");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const busy = phase === "leyendo" || phase === "sugiriendo" || phase === "guardando";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  async function onFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setError(null);
    setAviso(null);

    if (files.length > MAX_IMPORT_FILES) {
      setError(
        `Son ${files.length} archivos y el máximo por importación es ${MAX_IMPORT_FILES}. Hazlo en varias tandas.`,
      );
      return;
    }
    const espacio = SNIPPET_LIMITS.perUser - existingCount;
    if (files.length > espacio) {
      setError(
        `Solo te caben ${espacio} atajos más (el máximo es ${SNIPPET_LIMITS.perUser}).`,
      );
      return;
    }

    // 1. Leer. Un archivo ilegible no detiene los demás: queda marcado.
    setPhase("leyendo");
    setProgress({ done: 0, total: files.length });
    const leidos: ImportRow[] = [];
    for (const [index, file] of files.entries()) {
      const base: ImportRow = {
        tempId: `f${index}`,
        filename: file.name,
        title: filenameToTitle(file.name),
        category: "",
        content: "",
        include: true,
      };
      const invalid = validateSnippetFile(file);
      if (invalid) {
        leidos.push({ ...base, error: invalid, include: false });
      } else {
        try {
          const text = await extractTextFromFile(file);
          leidos.push(
            text.trim()
              ? { ...base, content: text }
              : { ...base, error: "Sin texto que guardar.", include: false },
          );
        } catch (readError) {
          leidos.push({
            ...base,
            error:
              readError instanceof Error ? readError.message : "No se pudo leer.",
            include: false,
          });
        }
      }
      setProgress({ done: index + 1, total: files.length });
    }
    setRows(leidos);

    // 2. Sugerencias de la IA, en tandas. Cualquier fallo solo cuesta las
    //    sugerencias de esa tanda.
    const conTexto = leidos.filter((row) => !row.error);
    if (!conTexto.length) {
      setPhase("revisar");
      return;
    }

    setPhase("sugiriendo");
    setProgress({ done: 0, total: conTexto.length });
    let sinIA = false;
    let hechos = 0;
    let acumuladas: SnippetSuggestion[] = [];

    for (const tanda of chunk(conTexto, CATEGORIZE_CHUNK)) {
      try {
        const response = await fetch("/api/snippets/categorize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: tanda.map((row) => ({
              id: row.tempId,
              filename: row.filename,
              text: row.content.slice(0, CATEGORIZE_TEXT_CHARS),
            })),
            categorias_frecuentes: existingCategories,
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          connected?: boolean;
          atajos?: SnippetSuggestion[];
        } | null;
        if (!response.ok || !payload?.connected || !Array.isArray(payload.atajos)) {
          sinIA = true;
        } else {
          acumuladas = [...acumuladas, ...payload.atajos];
        }
      } catch {
        sinIA = true;
      }
      hechos += tanda.length;
      setProgress({ done: hechos, total: conTexto.length });
    }

    setRows((current) => applySuggestions(current, acumuladas));
    if (sinIA) {
      setAviso(
        "No se pudieron obtener todas las sugerencias. Revisa los títulos y las categorías que falten; el resto de la importación funciona igual.",
      );
    }
    setPhase("revisar");
  }

  function edit(tempId: string, patch: Partial<ImportRow>) {
    setRows((current) =>
      current.map((row) => (row.tempId === tempId ? { ...row, ...patch } : row)),
    );
  }

  async function save() {
    const drafts = rowsToSave(rows);
    if (!drafts.length) {
      setError("No hay ningún atajo marcado para guardar.");
      return;
    }
    setPhase("guardando");
    setError(null);
    try {
      const saved = await createSnippets(createClient(), drafts);
      onSaved(saved);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudieron guardar los atajos.",
      );
      setPhase("revisar");
    }
  }

  const marcados = rowsToSave(rows).length;
  const conError = rows.filter((row) => row.error).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-overlay p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={busy ? undefined : onClose}
        className="absolute inset-0"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Importar atajos desde archivos"
        className="mobile-bottom-sheet relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-3xl border border-b-0 border-line bg-surface p-5 shadow-[var(--shadow-xl)] sm:max-h-[85vh] sm:rounded-[24px] sm:border-b sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Cerrar"
          className="absolute right-4 top-4 rounded-lg p-2 text-muted hover:bg-ice-soft disabled:opacity-40"
        >
          <X size={18} />
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          Importar atajos
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-deep">
          Trae los textos que ya tienes
        </h2>

        {phase === "elegir" ? (
          <div className="mt-5">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={SNIPPET_FILE_ACCEPT}
              className="hidden"
              onChange={(event) => {
                void onFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center rounded-xl border border-dashed border-line px-6 py-10 text-center hover:border-accent hover:bg-ice-soft"
            >
              <FileUp size={26} className="text-accent" />
              <span className="mt-3 font-semibold text-deep">
                Elegir archivos de tu computador
              </span>
              <span className="mt-1 max-w-md text-sm leading-relaxed text-muted">
                Word (.docx), .txt o .md. Puedes seleccionar varios de una vez
                (hasta {MAX_IMPORT_FILES}).
              </span>
            </button>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Los archivos se leen aquí, en tu navegador, y no se suben ni se
              guardan en Miracle. Para proponerte un título y una categoría se
              envía el principio de cada texto a la IA. No importes documentos
              con datos de pacientes.
            </p>
          </div>
        ) : null}

        {phase === "leyendo" || phase === "sugiriendo" ? (
          <div className="mt-8 flex flex-col items-center py-10 text-center">
            <Loader2 size={24} className="animate-spin text-accent" />
            <p className="mt-4 font-medium text-deep">
              {phase === "leyendo"
                ? `Leyendo ${progress.done} de ${progress.total}…`
                : `Proponiendo títulos y categorías… ${progress.done} de ${progress.total}`}
            </p>
            {phase === "sugiriendo" ? (
              <p className="mt-1 text-sm text-muted">
                Nada se guarda todavía: al terminar podrás revisarlo todo.
              </p>
            ) : null}
          </div>
        ) : null}

        {phase === "revisar" || phase === "guardando" ? (
          <>
            <p className="mt-2 text-sm text-muted">
              Revisa antes de guardar. Puedes corregir el título, cambiar la
              categoría o desmarcar lo que no quieras.
            </p>
            {aviso ? (
              <p
                role="status"
                className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning"
              >
                <Sparkles size={15} className="mt-0.5 shrink-0" />
                {aviso}
              </p>
            ) : null}
            {conError ? (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-ice-soft px-3 py-2 text-sm text-ink-soft">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
                {conError} {conError === 1 ? "archivo no se pudo leer" : "archivos no se pudieron leer"} y no se guardarán.
              </p>
            ) : null}

            <datalist id={listId}>
              {existingCategories.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>

            <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {rows.map((row) => (
                <li
                  key={row.tempId}
                  className={`rounded-xl border p-3 ${
                    row.error ? "border-line bg-ice-soft/60" : "border-line bg-surface"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={row.include}
                      disabled={Boolean(row.error)}
                      onChange={(event) =>
                        edit(row.tempId, { include: event.target.checked })
                      }
                      aria-label={`Guardar ${row.filename}`}
                      className="mt-2.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
                    />
                    <div className="min-w-0 flex-1">
                      {row.error ? (
                        <>
                          <p className="truncate text-sm font-medium text-deep">
                            {row.filename}
                          </p>
                          <p className="mt-0.5 text-xs text-danger">{row.error}</p>
                        </>
                      ) : (
                        <>
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)]">
                            <input
                              value={row.title}
                              onChange={(event) =>
                                edit(row.tempId, { title: event.target.value })
                              }
                              maxLength={SNIPPET_LIMITS.title}
                              aria-label={`Título de ${row.filename}`}
                              className="clinical-control w-full px-3"
                            />
                            <input
                              value={row.category}
                              onChange={(event) =>
                                edit(row.tempId, { category: event.target.value })
                              }
                              maxLength={SNIPPET_LIMITS.category}
                              list={listId}
                              placeholder="Categoría"
                              aria-label={`Categoría de ${row.filename}`}
                              className="clinical-control w-full px-3"
                            />
                          </div>
                          <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-muted">
                            {row.content}
                          </p>
                          <p className="mt-1 truncate text-[11px] text-muted">
                            {row.filename}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}

        {phase === "revisar" || phase === "guardando" ? (
          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted">
              {marcados} de {rows.length} se guardarán
            </span>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="clinical-secondary px-5"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy || !marcados}
                className="clinical-primary px-5"
              >
                {phase === "guardando" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : null}
                {phase === "guardando"
                  ? "Guardando…"
                  : `Guardar ${marcados} ${marcados === 1 ? "atajo" : "atajos"}`}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
