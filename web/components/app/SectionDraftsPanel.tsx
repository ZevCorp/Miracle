"use client";

/**
 * Las secciones de la plantilla, escribibles mientras la consulta va corriendo.
 *
 * PARA QUÉ: hay cosas que el médico quiere en la nota y no dice en voz alta
 * —una sospecha, una decisión, un plan a medio pensar—. Aquí las escribe en la
 * sección a la que pertenecen y, al generar, entran como material de esa
 * sección (ver lib/clinical/section-drafts.ts).
 *
 * DECISIONES DE UI, Y POR QUÉ:
 *
 *   TODO CERRADO AL EMPEZAR. Esto se usa con un paciente delante. Doce cajas de
 *   texto abiertas debajo de la transcripción serían una pared: se abre la que
 *   se necesita y se cierra sola nunca —queda abierta si el médico vuelve—.
 *
 *   SE VE DE UN VISTAZO CUÁL TIENE ALGO. Cada sección cerrada enseña la primera
 *   línea de lo escrito. Sin eso habría que abrir doce para saber dónde se
 *   anotó qué.
 *
 *   ESCRIBIR NO TOCA LA GRABACIÓN. El estado vive en su propio hook, así que
 *   teclear aquí no re-renderiza el dictado ni interrumpe el WebSocket.
 *
 *   NADA DE ATAJOS DE TECLADO PROPIOS. La pantalla ya usa "/" para los atajos
 *   de texto y Escape para varias cosas; añadir más sería pelear con el médico.
 *
 *   Y LOS ATAJOS DE TEXTO SÍ VIVEN AQUÍ. Este comentario decía desde el
 *   principio que "la pantalla ya usa /", pero el panel no lo tenía cableado:
 *   los atajos solo existían en el editor de la nota, o sea después de generar,
 *   o sea cuando el paciente ya se fue. Es justo aquí donde más falta hacen.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, NotebookPen } from "lucide-react";
import type { ClinicalTemplateSection } from "@/lib/api/clinical";
import { sortedTemplateSections } from "@/lib/api/clinical";
import type { SectionDrafts } from "@/lib/clinical/section-drafts";
import { countSectionDrafts } from "@/lib/clinical/section-drafts";
import type { SaveState } from "@/lib/clinical/use-section-drafts";
import { SnippetPopup } from "@/components/app/SnippetPopup";
import { slashQueryAt, type SlashToken } from "@/lib/clinical/slash-trigger";
import { insertSnippetText } from "@/lib/clinical/insert-text";
import {
  firstPlaceholderIn,
  nextPlaceholderAfter,
} from "@/lib/clinical/placeholders";
import type { Snippet } from "@/lib/clinical/snippets";

/** Lo que se enseña de una sección cerrada: una línea, sin cortar palabras. */
function resumen(texto: string): string {
  const plano = texto.replace(/\s+/g, " ").trim();
  return plano.length > 90 ? `${plano.slice(0, 89)}…` : plano;
}

export function SectionDraftsPanel({
  sections,
  drafts,
  onChange,
  saveState,
  loading = false,
  disabled = false,
}: {
  sections: ClinicalTemplateSection[] | undefined;
  drafts: SectionDrafts;
  onChange: (sectionKey: string, content: string) => void;
  saveState: SaveState;
  loading?: boolean;
  disabled?: boolean;
}) {
  const ordenadas = sortedTemplateSections(sections);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  // Sin plantilla no hay nada que ofrecer. No se pinta una caja vacía.
  if (!ordenadas.length) return null;

  const conTexto = countSectionDrafts(drafts);

  function alternar(key: string) {
    setAbiertas((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(key)) siguiente.delete(key);
      else siguiente.add(key);
      return siguiente;
    });
  }

  return (
    <section
      aria-label="Notas por sección"
      className="mt-4 rounded-[14px] border border-line bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <NotebookPen size={16} className="shrink-0 text-accent" />
          <h3 className="text-sm font-semibold text-deep">Notas por sección</h3>
          {conTexto > 0 ? (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[12px] font-semibold text-accent">
              {conTexto} con nota
            </span>
          ) : null}
        </div>
        <p aria-live="polite" className="text-[12px] text-muted">
          {loading
            ? "Cargando…"
            : saveState === "saving"
              ? "Guardando…"
              : saveState === "error"
                ? // No se dice "no se guardó" a secas: lo escrito sigue en el
                  // navegador, así que la frase tiene que quitar el susto.
                  "Sin conexión con el servidor. Lo escrito no se pierde; se reintenta solo."
                : saveState === "saved"
                  ? "Guardado"
                  : "Se suma a la nota al generarla"}
        </p>
      </div>

      <p className="px-4 pt-3 text-[13px] leading-relaxed text-muted">
        Lo que escribas aquí entra a la nota aunque no lo hayas dicho en voz
        alta, redactado dentro de su sección.
      </p>

      <ul className="divide-y divide-line px-1.5 py-1.5">
        {ordenadas.map((section) => {
          const valor = drafts[section.key] ?? "";
          const tiene = Boolean(valor.trim());
          const abierta = abiertas.has(section.key);
          const idPanel = `draft-${section.key}`;
          return (
            <li key={section.key}>
              <button
                type="button"
                onClick={() => alternar(section.key)}
                aria-expanded={abierta}
                aria-controls={idPanel}
                className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left hover:bg-ice-soft/60"
              >
                <ChevronDown
                  size={15}
                  className={`mt-0.5 shrink-0 text-muted transition-transform ${abierta ? "" : "-rotate-90"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-deep">
                      {section.label}
                    </span>
                    {tiene ? (
                      <span
                        aria-label="Esta sección tiene nota"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                      />
                    ) : null}
                  </span>
                  {/* Cerrada y con texto: se ve qué hay sin tener que abrirla. */}
                  {!abierta && tiene ? (
                    <span className="mt-0.5 block truncate text-[13px] text-muted">
                      {resumen(valor)}
                    </span>
                  ) : null}
                </span>
              </button>
              {abierta ? (
                <div id={idPanel} className="px-2.5 pb-3 pl-[30px]">
                  <DraftField
                    label={section.label}
                    value={valor}
                    disabled={disabled}
                    onChange={(next) => onChange(section.key, next)}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {saveState === "saving" ? (
        <span className="sr-only">
          <Loader2 size={12} /> Guardando notas por sección
        </span>
      ) : null}
    </section>
  );
}

/**
 * Un campo de sección, con los atajos de texto cableados.
 *
 * Es DONDE MÁS FALTA HACEN y donde no estaban: aquí el médico escribe con el
 * paciente delante, mientras la consulta corre. Los atajos solo existían después
 * de generar la nota, o sea cuando el paciente ya se fue.
 *
 * Cada sección abierta lleva su propio estado: dos campos abiertos a la vez no
 * pueden compartir ni el token de la "/" ni el cursor pendiente.
 */
function DraftField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  const [slash, setSlash] = useState<SlashToken | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  // Token que el médico descartó con Escape, para no reabrirle la lista encima
  // mientras sigue escribiendo esa misma palabra.
  const dismissedSlashRef = useRef<number | null>(null);

  // El valor lo controla el padre, así que el cursor se coloca después del
  // commit: antes, el texto insertado todavía no está en el campo.
  useEffect(() => {
    const pending = pendingSelectionRef.current;
    if (!pending) return;
    const node = textareaRef.current;
    if (!node) return;
    pendingSelectionRef.current = null;
    node.focus();
    node.setSelectionRange(pending.start, pending.end);
    selectionRef.current = { start: pending.start, end: pending.end };
  }, [value]);

  function refresh(node: HTMLTextAreaElement) {
    selectionRef.current = { start: node.selectionStart, end: node.selectionEnd };
    const token = slashQueryAt(node.value, node.selectionStart);
    if (!token) {
      dismissedSlashRef.current = null;
      setSlash(null);
      return;
    }
    setSlash(dismissedSlashRef.current === token.start ? null : token);
  }

  function pick(snippet: Snippet) {
    const token = slash;
    setSlash(null);
    dismissedSlashRef.current = null;
    if (!token) return;
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const result = insertSnippetText(value, token.start, caret, snippet.content);
    // Si el atajo trae huecos, el cursor cae en el primero.
    const hueco = firstPlaceholderIn(result.next, result.selStart, result.selEnd);
    pendingSelectionRef.current = hueco ?? { start: result.selEnd, end: result.selEnd };
    onChange(result.next);
  }

  /** Tab salta al siguiente hueco; sin huecos, Tab hace lo de siempre. */
  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab" || event.shiftKey) return;
    const node = event.currentTarget;
    const hueco = nextPlaceholderAfter(node.value, node.selectionEnd);
    if (!hueco) return;
    event.preventDefault();
    node.setSelectionRange(hueco.start, hueco.end);
    selectionRef.current = { start: hueco.start, end: hueco.end };
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          refresh(event.target);
        }}
        onSelect={(event) => refresh(event.currentTarget)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        rows={3}
        placeholder={`Lo que quieras dejar en «${label}»… o escribe / para un atajo`}
        className="w-full resize-y rounded-lg border border-line bg-field px-3 py-2 text-sm leading-relaxed text-deep outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
      />
      {slash ? (
        <SnippetPopup
          sectionTitle={label}
          query={slash.query}
          textareaRef={textareaRef}
          caretIndex={slash.start}
          onPick={pick}
          onClose={() => {
            dismissedSlashRef.current = slash.start;
            setSlash(null);
          }}
        />
      ) : null}
    </div>
  );
}
