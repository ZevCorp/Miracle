"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, FileUp, Loader2, Upload, X } from "lucide-react";
import {
  createClinicalTemplateDraftFromExample,
  friendlyClinicalMessage,
  type CreateClinicalTemplatePayload,
} from "@/lib/api/clinical";
import { extractTextFromFile, filenameToTitle } from "@/lib/clinical/file-to-text";
import {
  classifyImportFile,
  mergeTextSources,
  proposalToDraft,
  sanitizeTemplateProposal,
  validateImportBatch,
  MAX_IMAGE_NOTES_CHARS,
  MAX_IMPORT_IMAGES,
  MAX_PASTED_EXAMPLE_CHARS,
  TEMPLATE_IMAGE_CHARS,
  TEMPLATE_IMAGE_MAX_EDGE,
  type ImportItem,
} from "@/lib/clinical/template-import";
import { fileToDataUrl } from "@/lib/images/compress";

type Phase = "elegir" | "leyendo" | "estructurando";

let counter = 0;
function nextTempId(): string {
  counter += 1;
  return `import-${counter}`;
}

/**
 * "Trae tu plantilla": el médico suelta lo que tenga y Miracle arma la
 * estructura.
 *
 * UNA sola zona lo acepta todo —fotos del formulario en papel, un .docx, texto
 * pegado, mezclado— en vez de pedirle que elija primero qué tipo de archivo
 * trae. Las páginas de un mismo formulario van juntas en una sola llamada de
 * visión, así que fotografiar las dos caras no cuesta el doble ni parte la
 * plantilla en dos.
 *
 * De la foto se extraen solo los RÓTULOS de las secciones: aunque venga una nota
 * diligenciada, del otro lado sale una estructura, nunca los datos del paciente.
 * Nada se guarda hasta que el médico revisa el borrador en el constructor.
 */
export function TemplateImportDialog({
  specialty,
  onClose,
  onDraft,
  onManual,
}: {
  specialty: string;
  onClose: () => void;
  onDraft: (draft: CreateClinicalTemplatePayload, origin: "example" | "image") => void;
  /** Degradación: sin IA disponible, se arma a mano. */
  onManual: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("elegir");
  const [items, setItems] = useState<ImportItem[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sinIa, setSinIa] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const busy = phase !== "elegir";
  const imagenes = items.filter((item) => item.kind === "image" && !item.error);

  const addFiles = useCallback(async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setError(null);
    setSinIa(false);
    setPhase("leyendo");
    try {
      const leidos: ImportItem[] = [];
      for (const file of files) {
        const clasificado = classifyImportFile(file);
        if ("error" in clasificado) {
          leidos.push({
            tempId: nextTempId(),
            kind: "document",
            name: file.name,
            payload: "",
            error: clasificado.error,
          });
          continue;
        }
        try {
          const payload =
            clasificado.kind === "image"
              ? await fileToDataUrl(file, {
                  maxChars: TEMPLATE_IMAGE_CHARS,
                  maxEdge: TEMPLATE_IMAGE_MAX_EDGE,
                })
              : await extractTextFromFile(file);
          leidos.push({
            tempId: nextTempId(),
            kind: clasificado.kind,
            name: file.name,
            payload,
            ...(payload.trim() ? {} : { error: "El archivo no tiene texto." }),
          });
        } catch (readError) {
          leidos.push({
            tempId: nextTempId(),
            kind: clasificado.kind,
            name: file.name,
            payload: "",
            error:
              readError instanceof Error
                ? readError.message
                : "No se pudo leer el archivo.",
          });
        }
      }
      setItems((current) => [...current, ...leidos]);
    } finally {
      setPhase("elegir");
    }
  }, []);

  // Escape solo cuando no hay trabajo a medias: perder cuatro fotos ya leídas
  // por un tecleo es peor que tener que pulsar Cancelar.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  // Pegar con Ctrl+V: es como llega una captura de pantalla del sistema viejo.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (busy) return;
      const archivos = event.clipboardData?.files;
      if (archivos && archivos.length) {
        event.preventDefault();
        void addFiles(archivos);
        return;
      }
      // Sin esta guarda, el listener global le robaría el pegado al textarea.
      if (event.target instanceof HTMLTextAreaElement) return;
      const texto = event.clipboardData?.getData("text") ?? "";
      if (texto.trim()) {
        event.preventDefault();
        setPastedText((current) =>
          (current ? `${current}\n\n${texto}` : texto).slice(
            0,
            MAX_PASTED_EXAMPLE_CHARS,
          ),
        );
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles, busy]);

  // Un archivo soltado FUERA de la zona hace que el navegador navegue a él y se
  // pierda todo lo que ya se había cargado. Mientras el diálogo esté abierto,
  // ningún soltar navega.
  useEffect(() => {
    function swallow(event: DragEvent) {
      event.preventDefault();
    }
    window.addEventListener("dragover", swallow);
    window.addEventListener("drop", swallow);
    return () => {
      window.removeEventListener("dragover", swallow);
      window.removeEventListener("drop", swallow);
    };
  }, []);

  function removeItem(tempId: string) {
    setItems((current) => current.filter((item) => item.tempId !== tempId));
    setError(null);
  }

  async function build() {
    if (busy) return;
    const invalid = validateImportBatch(items, pastedText);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSinIa(false);
    setPhase("estructurando");
    const texto = mergeTextSources(items, pastedText);
    try {
      if (imagenes.length) {
        const res = await fetch("/api/clinical/template-from-image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            images: imagenes.map((item) => item.payload),
            specialty,
            ...(texto ? { notes: texto.slice(0, MAX_IMAGE_NOTES_CHARS) } : {}),
          }),
        });
        // Si el body pasa del límite de la plataforma, la respuesta ni siquiera
        // llega a nuestro código: vuelve un HTML que res.json() no puede leer.
        const contentType = res.headers.get("content-type") ?? "";
        if (res.status === 413 || !contentType.includes("application/json")) {
          setError(
            "Las fotos pesan demasiado. Quita una o tómalas con menos resolución.",
          );
          return;
        }
        const data = (await res.json()) as {
          connected?: boolean;
          template?: unknown;
          error?: string;
        };
        if (data.connected === false) {
          setSinIa(true);
          return;
        }
        if (!res.ok || !data.template) {
          setError(
            res.status === 422
              ? "No reconocimos secciones en la foto. Prueba con más luz, o pega el texto."
              : "No pudimos leer la foto. Inténtalo de nuevo en un momento.",
          );
          return;
        }
        const proposal = sanitizeTemplateProposal(data.template, {
          fallbackName: filenameToTitle(imagenes[0].name),
        });
        if (!proposal) {
          setError(
            "No reconocimos secciones en la foto. Prueba con más luz, o pega el texto.",
          );
          return;
        }
        onDraft(proposalToDraft(proposal, specialty), "image");
        return;
      }

      // Sin fotos: el camino de texto que ya existía, intacto.
      const proposal = await createClinicalTemplateDraftFromExample({
        specialty,
        example_text: texto,
      });
      onDraft(proposal.template, "example");
    } catch (buildError) {
      setError(friendlyClinicalMessage(buildError));
    } finally {
      setPhase("elegir");
    }
  }

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
        aria-label="Trae tu plantilla"
        className="mobile-bottom-sheet relative flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-3xl border border-b-0 border-line bg-surface shadow-[var(--shadow-xl)] sm:max-h-[88dvh] sm:rounded-[24px] sm:border-b"
      >
        <header className="border-b border-line px-5 py-4 pr-14 sm:px-6">
          <h2 className="font-display text-xl font-semibold text-deep">
            Trae tu plantilla
          </h2>
          <p className="mt-1 text-sm text-muted">
            Como la tengas: foto del papel, Word o texto pegado.
          </p>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar"
            title="Cerrar"
            className="absolute right-4 top-4 rounded-lg p-2 text-muted hover:bg-ice-soft disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>

        {phase === "estructurando" ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
            <Loader2 size={26} className="animate-spin text-accent" />
            <p className="mt-4 font-medium text-deep">
              {imagenes.length
                ? imagenes.length === 1
                  ? "Leyendo tu foto…"
                  : `Leyendo tus ${imagenes.length} fotos…`
                : "Armando la estructura…"}
            </p>
            <p className="mt-1 text-sm text-muted">
              Nada se guarda todavía: al terminar podrás revisarlo todo.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".txt,.md,.markdown,.docx,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                void addFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />
            {/* Input aparte: `capture` en el mismo que elige archivos fuerza la
                cámara en Android y mata el selector. */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                void addFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />

            <div
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void addFiles(event.dataTransfer.files);
              }}
              className={`rounded-xl border border-dashed px-5 py-8 text-center transition-colors ${
                dragging
                  ? "border-accent bg-accent-soft/40"
                  : "border-line bg-pearl/60"
              }`}
            >
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-ice text-accent">
                <Upload size={20} />
              </span>
              <p className="mt-3 font-semibold text-deep">
                Arrástrala aquí, o pégala con Ctrl+V
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="clinical-secondary px-4"
                >
                  <FileUp size={15} /> Elegir archivo
                </button>
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  disabled={busy}
                  className="clinical-secondary px-4"
                >
                  <Camera size={15} /> Tomar foto
                </button>
              </div>
              <p className="mt-3 text-xs text-muted">
                Fotos, Word (.docx) o texto · hasta {MAX_IMPORT_IMAGES} páginas
              </p>
            </div>

            {phase === "leyendo" ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                <Loader2 size={14} className="animate-spin text-accent" /> Leyendo
                lo que soltaste…
              </p>
            ) : null}

            {items.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {items.map((item) => (
                  <li
                    key={item.tempId}
                    className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] ${
                      item.error
                        ? "border-danger/35 bg-danger/5 text-danger"
                        : "border-line bg-surface text-deep"
                    }`}
                  >
                    <span className="truncate font-medium">{item.name}</span>
                    {item.error ? (
                      <span className="shrink-0 text-[12px]">{item.error}</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeItem(item.tempId)}
                      aria-label={`Quitar ${item.name}`}
                      title="Quitar"
                      className="shrink-0 rounded-full p-0.5 text-muted hover:bg-ice-soft hover:text-deep"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs font-medium text-muted">
                o pega el texto
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <textarea
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
              rows={5}
              maxLength={MAX_PASTED_EXAMPLE_CHARS}
              placeholder="Pega aquí la plantilla o una nota que ya uses. Miracle propondrá una estructura, no una nota clínica."
              className="mt-3 w-full resize-y rounded-xl border border-line bg-field px-3.5 py-3 text-sm leading-relaxed outline-none focus:border-accent"
            />

            <p className="mt-4 text-xs leading-relaxed text-muted">
              Miracle lee solo los títulos de las secciones, no lo que esté
              escrito en ellas. El archivo no se guarda.
            </p>

            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            ) : null}

            {sinIa ? (
              <div className="mt-4 rounded-lg border border-line bg-pearl px-3.5 py-3">
                <p className="text-sm text-deep">
                  La lectura automática no está disponible ahora mismo.
                </p>
                <button
                  type="button"
                  onClick={onManual}
                  className="mt-2 text-sm font-semibold text-accent hover:underline"
                >
                  Armarla a mano
                </button>
              </div>
            ) : null}
          </div>
        )}

        <footer className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-deep disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void build()}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Upload size={15} />
            )}{" "}
            Armar plantilla
          </button>
        </footer>
      </section>
    </div>
  );
}
