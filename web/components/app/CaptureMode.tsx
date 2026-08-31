"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Mic, Pause, Square } from "lucide-react";
import {
  ConsultationSpine,
  type SpineSection,
} from "@/components/app/ConsultationSpine";
import { DraftField } from "@/components/app/SectionDraftsPanel";
import type { SectionDrafts } from "@/lib/clinical/section-drafts";
import type { SaveState } from "@/lib/clinical/use-section-drafts";

/**
 * MODO CAPTURA — la pantalla mientras se graba.
 *
 * Durante la consulta el médico mira al paciente, no al monitor. Lo poco que
 * mira lo mira de reojo y a un metro, y solo quiere saber tres cosas: que
 * sigue grabando, cuánto lleva, y que lo último que se dijo sí se oyó. Esta
 * capa muestra exactamente eso —tiempo enorme, última frase legible de lejos,
 * un latido— y esconde todo lo demás.
 *
 * No graba nada por sí misma: es una VISTA sobre la grabación que corre en
 * DictationPanel (que sigue montado debajo, junto con el autosave y los
 * borradores por sección). Pausar aquí delega en el panel real; al pausar, la
 * captura deja de estar abierta y esta capa se retira sola.
 *
 * LA ESPINA SE ESCRIBE. A la izquierda está el mapa de la plantilla, y sus
 * secciones no son solo un medidor: se pulsan y se escribe dentro sin salir de
 * la captura ni detener el micrófono. Antes había que irse a la pantalla
 * completa para anotar algo que no se dijo en voz alta —una sospecha, una
 * dosis— y ese viaje, con el paciente delante, no lo hace nadie.
 *
 * Mientras se escribe, el reloj enorme cede el sitio al campo, pero el estado
 * de grabación NO desaparece: se queda arriba del campo en pequeño. La única
 * pregunta que esta pantalla no puede dejar sin responder nunca es "¿sigue
 * grabando?".
 */
export function CaptureMode({
  elapsedSec,
  partialText,
  sections,
  drafts,
  onDraftChange,
  draftsSaveState = "idle",
  draftsDisabled = false,
  onPause,
  onFinish,
  onExit,
  finishLabel = "Finalizar y generar nota",
}: {
  elapsedSec: number;
  /** Última frase provisional del reconocimiento (aún sin confirmar). */
  partialText: string;
  sections: SpineSection[];
  /** Lo escrito por sección, por clave de sección de la plantilla. */
  drafts?: SectionDrafts;
  onDraftChange?: (sectionKey: string, content: string) => void;
  draftsSaveState?: SaveState;
  draftsDisabled?: boolean;
  onPause: () => void;
  /** Cierra el micrófono y dispara la generación (ya confirmado aquí). */
  onFinish: () => void;
  /** Vuelve a la pantalla completa SIN detener la grabación. */
  onExit: () => void;
  finishLabel?: string;
}) {
  const [confirmFinish, setConfirmFinish] = useState(false);
  // Sección abierta para escribir. null = la vista de vistazo de siempre.
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const escribible = Boolean(onDraftChange);
  // Se DERIVA de las secciones vigentes, no se sincroniza con un efecto: si la
  // sección abierta desapareciera (cambio de plantilla), esto queda en null y
  // la vista vuelve sola al vistazo, sin un render de más ni un campo colgando
  // de una clave que ya no existe.
  const editando = editandoId
    ? (sections.find((s) => s.id === editandoId) ?? null)
    : null;

  // La capa es de pantalla completa: debajo no debe hacer scroll el fondo.
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Escribiendo, Escape cierra el campo y deja la captura en pie: salir de
      // toda la pantalla por querer cerrar un campo sería un salto brusco.
      // (La lista de atajos de "/" se adelanta: escucha en fase de captura
      // sobre window y para la propagación, así que aquí ni llega.)
      if (editandoId) {
        setEditandoId(null);
        return;
      }
      onExit();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onExit, editandoId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Consulta en grabación"
      className="capture"
    >
      {/* Barra superior mínima: estado + salida. */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <span className="inline-flex items-center gap-2.5 text-sm font-semibold text-deep">
          <span className="live-dot" aria-hidden />
          Grabando
        </span>
        <button
          type="button"
          onClick={onExit}
          className="clinical-secondary min-h-10 px-4 text-[13px]"
          title="Vuelve a la pantalla completa; la grabación continúa"
        >
          <ChevronDown size={15} /> Ver la pantalla completa
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5">
        <div className="grid w-full max-w-4xl items-center gap-8 py-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* La espina: el mapa de la plantilla llenándose en vivo, y la puerta
              para escribir en cada sección. */}
          <div className="hidden lg:block">
            {sections.length ? (
              <>
                <p className="doc-label mb-1.5">Secciones</p>
                <ConsultationSpine
                  sections={sections}
                  activeId={editandoId}
                  onSelect={
                    escribible
                      ? (id) => setEditandoId((previo) => (previo === id ? null : id))
                      : undefined
                  }
                />
                {escribible ? (
                  <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
                    Pulsa una para escribir en ella.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          {editando && onDraftChange ? (
            <div className="text-left">
              {/* El reloj se encoge, pero no se va: es la respuesta a la única
                  pregunta que esta pantalla no puede dejar en el aire. */}
              <p className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-deep">
                <span className="live-dot" aria-hidden />
                Grabando
                <span className="data font-medium text-muted">
                  {mmss(elapsedSec)}
                </span>
              </p>

              <div className="clinical-panel p-4" data-light>
                <div className="flex items-start justify-between gap-3 border-b border-line pb-2.5">
                  <div className="min-w-0">
                    <p className="doc-label">Escribiendo en</p>
                    <p className="mt-0.5 truncate text-[15px] font-semibold text-deep">
                      {editando.titulo}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditandoId(null)}
                    className="clinical-secondary min-h-9 shrink-0 px-3 text-[13px]"
                  >
                    <Check size={14} /> Listo
                  </button>
                </div>

                <div className="mt-3">
                  <DraftField
                    label={editando.titulo}
                    value={drafts?.[editando.id] ?? ""}
                    disabled={draftsDisabled}
                    onChange={(next) => onDraftChange(editando.id, next)}
                  />
                </div>

                <p aria-live="polite" className="mt-2 text-[12px] text-muted">
                  {draftsSaveState === "saving"
                    ? "Guardando…"
                    : draftsSaveState === "error"
                      ? "Sin conexión con el servidor. Lo escrito no se pierde; se reintenta solo."
                      : draftsSaveState === "saved"
                        ? "Guardado · entra a la nota al generarla"
                        : "Entra a la nota al generarla, dentro de esta sección"}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center lg:text-left">
              <p className="capture-time" aria-label="Tiempo de grabación">
                {mmss(elapsedSec)}
              </p>
              {/* Lo último escuchado: la única prueba a distancia de que el
                  sistema oye. aria-live off a propósito: cambia cada segundo y
                  leerlo en voz alta sería insoportable. */}
              <p className="capture-caption mx-auto mt-5 max-w-2xl lg:mx-0">
                {partialText ? (
                  <span className="italic">“{partialText}”</span>
                ) : (
                  <span className="text-muted">Escuchando…</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Controles: dos acciones grandes, alcanzables sin mirar. */}
      <div className="px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:px-6">
        {confirmFinish ? (
          <div className="mx-auto max-w-xl rounded-[16px] border border-danger/25 bg-danger-soft p-4 text-center">
            <p className="text-sm font-semibold text-deep">
              ¿Finalizar la consulta y generar la nota?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Se cerrará el micrófono y se procesará todo lo transcrito.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmFinish(false)}
                className="clinical-secondary min-h-12"
              >
                Seguir grabando
              </button>
              <button
                type="button"
                onClick={onFinish}
                className="clinical-danger min-h-12"
              >
                Sí, finalizar
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-xl flex-col justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onPause}
              className="clinical-secondary min-h-14 flex-1 border-warning/35 bg-warning-soft text-base text-warning-ink"
            >
              <Pause size={19} /> Pausar
            </button>
            <button
              type="button"
              onClick={() => setConfirmFinish(true)}
              className="clinical-secondary min-h-14 flex-1 border-danger/35 text-base text-danger hover:bg-danger-soft"
            >
              <Square size={17} /> {finishLabel}
            </button>
          </div>
        )}
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
          <Mic size={12} aria-hidden />
          {escribible && sections.length ? (
            <>
              {/* Por debajo de lg la espina no se pinta, así que ahí la vía
                  sigue siendo la pantalla completa. No se promete lo que no
                  hay. */}
              <span className="hidden lg:inline">
                Pulsa una sección para escribir en ella; la grabación no se
                detiene.
              </span>
              <span className="lg:hidden">
                Puedes seguir escribiendo en las secciones desde la pantalla
                completa; la grabación no se detiene.
              </span>
            </>
          ) : (
            <span>
              Puedes seguir escribiendo en las secciones desde la pantalla
              completa; la grabación no se detiene.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function mmss(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
