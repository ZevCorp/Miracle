"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TYPE_LABEL } from "@/lib/mock";
import { formatFechaRelativa } from "@/lib/dates";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge, STATUS_BAR } from "./StatusBadge";
import type { CardConsultation } from "./ConsultationCard";

/** Ancho fijo: la altura es lo único que hay que medir para colocar el globo. */
const ANCHO = 340;
/** Aire entre la tarjeta y el globo. */
const SEPARACION = 12;
/** Margen mínimo contra el borde de la ventana. */
const MARGEN = 8;

type Posicion = { left: number; top: number; origin: string };

function acotar(valor: number, min: number, max: number) {
  return Math.min(Math.max(valor, min), Math.max(min, max));
}

/**
 * Coloca el globo al lado de la tarjeta: primero a la derecha, si no cabe a la
 * izquierda, y si tampoco (pantallas estrechas) arriba o abajo. Sin esto, las
 * tarjetas de la última columna abrirían el globo fuera de la pantalla.
 */
function ubicar(ancla: DOMRect, alto: number): Posicion {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const cabeDerecha = ancla.right + SEPARACION + ANCHO + MARGEN <= vw;
  const cabeIzquierda = ancla.left - SEPARACION - ANCHO >= MARGEN;

  if (cabeDerecha || cabeIzquierda) {
    const left = cabeDerecha
      ? ancla.right + SEPARACION
      : ancla.left - SEPARACION - ANCHO;
    // Centrado con la tarjeta, sin salirse por arriba ni por abajo.
    const top = acotar(
      ancla.top + ancla.height / 2 - alto / 2,
      MARGEN,
      vh - alto - MARGEN,
    );
    return { left, top, origin: cabeDerecha ? "left center" : "right center" };
  }

  const left = acotar(ancla.left, MARGEN, vw - ANCHO - MARGEN);
  const cabeAbajo = ancla.bottom + SEPARACION + alto + MARGEN <= vh;
  return cabeAbajo
    ? { left, top: ancla.bottom + SEPARACION, origin: "top center" }
    : {
        left,
        top: Math.max(MARGEN, ancla.top - SEPARACION - alto),
        origin: "bottom center",
      };
}

function Etiqueta({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
      {children}
    </p>
  );
}

/**
 * Vista rápida de una consulta: aparece al dejar el cursor sobre la tarjeta y
 * desaparece al retirarlo. Es solo de lectura (`pointer-events-none` +
 * `aria-hidden`): no intercepta el clic de la tarjeta —que sigue navegando al
 * detalle— y por eso el cierre al salir el mouse nunca se queda "pegado".
 * Va en un portal sobre `body` para escapar del grid y del encabezado sticky.
 */
export function ConsultationCardPreview({
  consultation,
  patientName,
  documento,
  rotulo,
  anchorRect,
}: {
  consultation: CardConsultation;
  patientName?: string;
  documento?: string;
  rotulo?: string;
  anchorRect: DOMRect;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Posicion | null>(null);

  // Se mide antes de pintar: el globo nace oculto en (0,0), se calcula su sitio
  // con la altura real y solo entonces aparece. Sin salto visible.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos(ubicar(anchorRect, el.offsetHeight));
  }, [anchorRect]);

  const resumen = consultation.resumen?.trim();
  const servicio = consultation.servicio?.trim();

  return createPortal(
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "fixed",
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: ANCHO,
        transformOrigin: pos?.origin ?? "center",
        visibility: pos ? undefined : "hidden",
      }}
      className={`pointer-events-none z-[70] overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-lg)] ${
        pos ? "preview-in" : ""
      }`}
    >
      {/* Franja del color del estado: se reconoce en qué punto del flujo está
          la consulta antes de leer una sola palabra. */}
      <div className={`h-1 w-full ${STATUS_BAR[consultation.estado]}`} />

      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Avatar name={patientName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-deep">
              {patientName ?? "Paciente sin identificar"}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-muted">
              {documento ? `${documento} · ` : ""}
              {consultation.especialidad} · {TYPE_LABEL[consultation.tipo]}
              {servicio ? ` · ${servicio}` : ""}
            </p>
            {rotulo ? (
              <span className="mt-1.5 inline-block rounded-md bg-ice px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-ink">
                Rótulo {rotulo}
              </span>
            ) : null}
          </div>
          <StatusBadge estado={consultation.estado} />
        </div>

        <div>
          <Etiqueta>Motivo</Etiqueta>
          <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-ink-soft">
            {consultation.motivo || "Sin motivo registrado."}
          </p>
        </div>

        {resumen ? (
          <div>
            <Etiqueta>Resumen clínico</Etiqueta>
            <p className="mt-1 line-clamp-5 text-sm leading-relaxed text-ink-soft">
              {resumen}
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5 text-[12px] text-muted">
          <span>
            {formatFechaRelativa(consultation.fecha)}
            {consultation.duracionMin
              ? ` · ${consultation.duracionMin} min`
              : ""}
          </span>
          <span className="font-semibold text-accent">Clic para abrir →</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
