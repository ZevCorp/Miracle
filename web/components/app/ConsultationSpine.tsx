"use client";

import { useCallback, useEffect, useMemo } from "react";

/**
 * LA ESPINA — el riel de secciones de la consulta.
 *
 * Hace tres cosas con un solo dibujo, y por eso vale la pena que exista:
 *
 *   1. Índice: cada estación es una sección de la plantilla, en su orden, y se
 *      pulsa para saltar a ella.
 *   2. Medidor: hueca = sección vacía, sólida = escrita, media = propuesta por
 *      la IA y sin revisar. El riel se llena hasta la última escrita, así que
 *      mientras el médico habla la línea sube sola.
 *   3. Latido: durante la grabación es lo único que se mueve en pantalla.
 *
 * NO va numerada. Las secciones de una nota no son una secuencia obligatoria
 * —se puede escribir el plan antes que el examen físico— y un 01/02/03
 * afirmaría un orden que no existe.
 */

export type SpineState = "empty" | "filled" | "pending";

export interface SpineSection {
  id: string;
  titulo: string;
  state: SpineState;
}

export function ConsultationSpine({
  sections,
  activeId,
  onSelect,
  compact = false,
  className = "",
  label = "Secciones de la nota",
}: {
  sections: SpineSection[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  /** Solo puntos, con el rótulo como pista al apuntar. */
  compact?: boolean;
  className?: string;
  label?: string;
}) {
  // El riel se llena hasta la ÚLTIMA sección con contenido, no hasta la
  // cuenta de secciones llenas: si el médico escribe el plan primero, la línea
  // debe llegar hasta el plan, que es donde va la nota de verdad.
  const progress = useMemo(() => {
    if (sections.length < 2) return sections.some((s) => s.state !== "empty") ? 1 : 0;
    let last = -1;
    sections.forEach((s, i) => {
      if (s.state !== "empty") last = i;
    });
    if (last < 0) return 0;
    return last / (sections.length - 1);
  }, [sections]);

  if (!sections.length) return null;

  return (
    <nav
      aria-label={label}
      data-compact={compact ? "true" : undefined}
      className={`spine ${className}`}
      style={{ "--spine-progress": progress } as React.CSSProperties}
    >
      <ol className="spine-list">
        {sections.map((section) => {
          const active = section.id === activeId;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onSelect?.(section.id)}
                aria-current={active ? "true" : undefined}
                title={compact ? undefined : section.titulo}
                className="station"
                data-state={section.state}
              >
                <span aria-hidden className="station-dot" />
                <span className="station-label">{section.titulo}</span>
                {/* El estado se dice también con palabras: el punto solo no
                    sirve para quien no distingue relleno de contorno. */}
                <span className="sr-only">
                  {section.state === "filled"
                    ? " · escrita"
                    : section.state === "pending"
                      ? " · propuesta sin revisar"
                      : " · vacía"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * J / K (o ↑ ↓ con Alt) para recorrer las estaciones sin soltar el teclado.
 *
 * Se ignora mientras el foco está en un campo: en una nota clínica la tecla
 * "j" es una letra mucho más a menudo que un atajo.
 */
export function useSpineKeyboard({
  sections,
  activeId,
  onSelect,
  enabled = true,
}: {
  sections: SpineSection[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  enabled?: boolean;
}) {
  const mover = useCallback(
    (delta: number) => {
      if (!sections.length) return;
      const actual = sections.findIndex((s) => s.id === activeId);
      const siguiente = Math.min(
        sections.length - 1,
        Math.max(0, (actual < 0 ? -1 : actual) + delta),
      );
      onSelect?.(sections[siguiente].id);
    },
    [sections, activeId, onSelect],
  );

  useEffect(() => {
    if (!enabled) return;
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      if (event.key === "j" || event.key === "J") {
        event.preventDefault();
        mover(1);
      } else if (event.key === "k" || event.key === "K") {
        event.preventDefault();
        mover(-1);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled, mover]);
}

/** Estado de una sección para la espina, a partir de su contenido. */
export function spineStateOf(section: {
  texto?: string | null;
  items?: string[] | null;
}): SpineState {
  const texto = (section.texto ?? "").trim();
  const items = (section.items ?? []).map((i) => i.trim()).filter(Boolean);
  return texto || items.length ? "filled" : "empty";
}
