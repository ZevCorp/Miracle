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
  cifras,
  atendidasHoy,
  enAgenda,
  porFirmar,
  esperaMaxIso,
}: {
  /** null hasta el montaje: el reloj no puede renderizarse en el servidor sin
   *  desincronizar la hidratación. */
  ahora: Date | null;
  /**
   * Si los números ya son ciertos. El HUD se pinta antes de que lleguen las
   * consultas y la agenda (la hora y el orbe no las necesitan), y mientras
   * tanto decir "0 atendidas · nada por firmar" sería afirmar algo falso.
   */
  cifras: "cargando" | "fallo" | "listas";
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
  const resumen =
    cifras === "listas"
      ? partes.join(" · ")
      : cifras === "fallo"
        ? "No se pudieron leer tus consultas de hoy."
        : null;

  return (
    /* La hora ABRE la fila, no la cierra. La esquina de arriba a la derecha ya
       no es del contenido: ahí flota fija la cápsula de estado. Con el reloj
       allí quedaban 15 px de aire y al primer scroll se metía bajo el vidrio.
       De paso se lee mejor de izquierda a derecha: la hora, el día, cómo va. */
    <header className="flex items-center gap-4 sm:gap-5">
      {/* suppressHydrationWarning no hace falta: antes del montaje se pinta el
          guion y el servidor pinta lo mismo. */}
      <span
        aria-label="Hora actual"
        className="data shrink-0 text-[2.4rem] font-medium leading-none tracking-[-0.04em] text-deep"
      >
        {ahora ? FORMATO_RELOJ.format(ahora) : "--:--"}
      </span>
      <span aria-hidden className="h-9 w-px shrink-0 bg-line" />
      <div className="min-w-0">
        <p className="doc-label">{ahora ? fechaLarga(ahora) : " "}</p>
        {resumen ? (
          <p className="mt-1 text-[0.95rem] leading-relaxed text-muted">{resumen}</p>
        ) : (
          <p className="mt-1 text-[0.95rem] leading-relaxed" aria-busy="true">
            <span className="sr-only">Cargando tu jornada</span>
            <span
              aria-hidden
              className="inline-block h-[0.95rem] w-56 max-w-full animate-pulse rounded bg-ice-soft align-middle"
            />
          </p>
        )}
      </div>
    </header>
  );
}
