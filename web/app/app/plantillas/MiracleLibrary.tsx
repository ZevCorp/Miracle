"use client";

import { useMemo, useState } from "react";
import { Check, Download, Library, Loader2, X } from "lucide-react";
import {
  catalogDrafts,
  packsForSpecialty,
  type SnippetPack,
} from "@/lib/clinical/snippet-catalog";
import {
  createSnippets,
  normalizeForSearch,
  SNIPPET_LIMITS,
  type Snippet,
} from "@/lib/clinical/snippets";
import { createClient } from "@/lib/supabase/client";

/**
 * La biblioteca que Miracle ofrece, instalable por paquetes.
 *
 * ES UNA SEMILLA, NO UNA SUSCRIPCIÓN. El médico elige qué añadir y, desde ese
 * momento, esas filas son suyas: se editan y se borran como cualquier otra. La
 * app no vuelve a tocarlas nunca. Por eso instalar dos veces no duplica ni
 * pisa: solo entran los títulos que todavía no tiene.
 *
 * NO ES UNA PANTALLA DE BIENVENIDA DE UNA SOLA VEZ. Queda siempre disponible en
 * el gestor porque un médico general que empieza a cubrir pediatría tiene que
 * poder añadir ese paquete seis meses después. Un paso de alta se lo habría
 * perdido para siempre — y además no haría falta ninguna columna nueva para
 * recordar si ya se le ofreció: si no tiene atajos, se muestra en grande.
 */
export function MiracleLibrary({
  specialtyCode,
  snippets,
  onInstalled,
  destacada,
}: {
  specialtyCode?: string | null;
  /** Lo que ya tiene, para no ofrecer de nuevo lo instalado. */
  snippets: Snippet[];
  onInstalled: (mensaje: string) => Promise<void> | void;
  /** Sin atajos todavía: la biblioteca es la pantalla, no una nota al pie. */
  destacada: boolean;
}) {
  const [instalando, setInstalando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viendo, setViendo] = useState<SnippetPack | null>(null);

  const packs = useMemo(() => packsForSpecialty(specialtyCode), [specialtyCode]);
  const titulosActuales = useMemo(
    () => new Set(snippets.map((s) => normalizeForSearch(s.title))),
    [snippets],
  );

  /** Cuántos de este paquete le faltan. Cero = ya lo tiene entero. */
  function pendientes(pack: SnippetPack): number {
    return pack.snippets.filter(
      (s) => !titulosActuales.has(normalizeForSearch(s.title)),
    ).length;
  }

  async function instalar(pack: SnippetPack) {
    const drafts = catalogDrafts([pack.id]).filter(
      (d) => !titulosActuales.has(normalizeForSearch(d.title)),
    );
    if (!drafts.length) return;

    // El tope no está en la base (ver la migración de user_snippets): esta es la
    // primera función que puede insertar decenas de filas de golpe, así que
    // comprueba el espacio antes en vez de fallar a mitad.
    const espacio = SNIPPET_LIMITS.perUser - snippets.length;
    if (espacio <= 0) {
      setError(`Llegaste al máximo de ${SNIPPET_LIMITS.perUser} atajos.`);
      return;
    }
    const entran = drafts.slice(0, espacio);

    setInstalando(pack.id);
    setError(null);
    try {
      const guardados = await createSnippets(createClient(), entran);
      const recortado = entran.length < drafts.length;
      await onInstalled(
        recortado
          ? `Se añadieron ${guardados} atajos; el resto no cupo por el máximo de ${SNIPPET_LIMITS.perUser}.`
          : `Se añadieron ${guardados} atajos. Ya son tuyos: puedes editarlos o borrarlos.`,
      );
    } catch (installError) {
      setError(
        installError instanceof Error
          ? installError.message
          : "No se pudieron añadir los atajos. Intenta de nuevo.",
      );
    } finally {
      setInstalando(null);
    }
  }

  return (
    <section
      aria-label="Biblioteca de Miracle"
      className={`rounded-[14px] border bg-surface p-5 ${
        destacada ? "border-accent/30 bg-accent-soft/15" : "border-line"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ice text-accent">
          <Library size={16} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-deep">
            {destacada ? "Empieza con los atajos de Miracle" : "Biblioteca de Miracle"}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Bloques clínicos listos para usar. Al añadirlos son tuyos: los
            editas, los reorganizas y los borras como cualquier atajo que
            escribas tú.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {packs.map((pack) => {
          const faltan = pendientes(pack);
          const completo = faltan === 0;
          return (
            <div
              key={pack.id}
              className="flex flex-col rounded-xl border border-line bg-surface p-4"
            >
              <p className="font-semibold text-deep">{pack.name}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                {pack.description}
              </p>
              <p className="mt-2 text-[13px] font-medium text-ink-soft">
                <span className="tabular-nums">{pack.snippets.length}</span>{" "}
                {pack.snippets.length === 1 ? "atajo" : "atajos"}
                {completo ? null : faltan < pack.snippets.length ? (
                  <span className="text-muted">
                    {" "}
                    · te faltan <span className="tabular-nums">{faltan}</span>
                  </span>
                ) : null}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViendo(pack)}
                  className="text-sm font-medium text-accent hover:underline"
                >
                  Ver los textos
                </button>
                <span aria-hidden className="text-line">
                  ·
                </span>
                {completo ? (
                  <span className="inline-flex items-center gap-1 text-sm text-success">
                    <Check size={14} /> Ya lo tienes
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void instalar(pack)}
                    disabled={instalando !== null}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline disabled:opacity-50"
                  >
                    {instalando === pack.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                    Añadir {faltan}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {viendo ? (
        <PackPreview pack={viendo} onClose={() => setViendo(null)} />
      ) : null}
    </section>
  );
}

/** Lo que se va a instalar, agrupado por sección, antes de decidir. */
function PackPreview({ pack, onClose }: { pack: SnippetPack; onClose: () => void }) {
  const porSeccion = useMemo(() => {
    const mapa = new Map<string, typeof pack.snippets>();
    for (const snippet of pack.snippets) {
      mapa.set(snippet.category, [...(mapa.get(snippet.category) ?? []), snippet]);
    }
    return [...mapa.entries()];
  }, [pack]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-overlay p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Atajos de ${pack.name}`}
        className="mobile-bottom-sheet relative flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-3xl border border-b-0 border-line bg-surface shadow-[var(--shadow-xl)] sm:max-h-[85vh] sm:rounded-[24px] sm:border-b"
      >
        <header className="border-b border-line p-5 pr-14">
          <h2 className="font-display text-xl font-semibold text-deep">{pack.name}</h2>
          <p className="mt-1 text-[13px] text-muted">
            <span className="tabular-nums">{pack.snippets.length}</span> atajos,
            agrupados por la sección de la nota donde aparecen primero.
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-4 top-4 rounded-lg p-2 text-muted hover:bg-ice-soft"
          >
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {porSeccion.map(([seccion, lista]) => (
            <div key={seccion} className="mb-5 last:mb-0">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {seccion}
              </h3>
              <ul className="mt-2 space-y-2">
                {lista.map((snippet) => (
                  <li
                    key={snippet.title}
                    className="rounded-lg border border-line bg-pearl/50 p-3"
                  >
                    <p className="text-sm font-medium text-deep">{snippet.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
                      {snippet.content}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
