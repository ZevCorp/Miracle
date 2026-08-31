"use client";

import { ZONA_CLINICA, etiquetaEspera } from "@/lib/dates";

/**
 * El HUD del turno: la cabina de la jornada. Fecha, la hora VIVA en grande y
 * una sola línea con los números que importan hoy. Sin tarjetas de métricas:
 * un vistazo, no un tablero.
 */

const FORMATO_RELOJ = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA_CLINICA,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function fechaLarga(d: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA_CLINICA,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function TurnoHUD({
  ahora,
  atendidasHoy,
  enAgenda,
  porFirmar,
  esperaMaxIso,
}: {
  /** null hasta el montaje: el reloj no puede renderizarse en el servidor sin
   *  desincronizar la hidratación. */
  ahora: Date | null;
  atendidasHoy: number;
  enAgenda: number;
  porFirmar: number;
  esperaMaxIso: string | null;
}) {
  const partes: string[] = [];
  partes.push(
    atendidasHoy === 1 ? "1 atendida" : `${atendidasHoy} atendidas`,
  );
  partes.push(enAgenda === 1 ? "1 en agenda" : `${enAgenda} en agenda`);
  partes.push(
    porFirmar === 0
      ? "nada por firmar"
      : `${porFirmar} por firmar${
          esperaMaxIso ? ` · la más antigua ${etiquetaEspera(esperaMaxIso)}` : ""
        }`,
  );

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <p className="doc-label">{ahora ? fechaLarga(ahora) : " "}</p>
        <p className="mt-1 text-[0.95rem] leading-relaxed text-muted">
          {partes.join(" · ")}
        </p>
      </div>
      {/* La hora del turno. suppressHydrationWarning no hace falta: antes del
          montaje se pinta el guion y el servidor pinta lo mismo. */}
      <span
        aria-label="Hora actual"
        className="data text-[2.4rem] font-medium leading-none tracking-[-0.04em] text-deep"
      >
        {ahora ? FORMATO_RELOJ.format(ahora) : "--:--"}
      </span>
    </header>
  );
}
