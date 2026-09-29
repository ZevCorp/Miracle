import Link from "next/link";
import { ArrowRight } from "lucide-react";

const phases = [
  { n: "Semana 1", title: "Alistamiento" },
  { n: "Semanas 2–5", title: "Operación real" },
  { n: "Semana 6", title: "Resultados" },
];

/**
 * Banda de confianza basada en el método del piloto (no en cifras de resultado
 * que todavía no tenemos). Ver también /piloto para el detalle completo.
 */
export function PilotoTeaser() {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <span className="eyebrow">Cómo se prueba</span>
      <h2 className="mt-4 text-3xl font-semibold text-deep md:text-[2.6rem]">
        Decida con evidencia, no con promesas.
      </h2>
      <p className="mt-5 text-lg leading-relaxed text-ink-soft">
        No pedimos un acto de fe. Diseñamos un piloto acotado y medible — un
        servicio, un grupo pequeño de médicos y métricas de antes y después —
        para que la dirección decida con datos de su propia institución.
      </p>

      <ol className="mt-10 grid gap-5 sm:grid-cols-3">
        {phases.map((p) => (
          <li
            key={p.n}
            className="rounded-lg border border-line bg-surface/85 p-5 text-left shadow-[var(--shadow-sm)] backdrop-blur-sm"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">
              {p.n}
            </span>
            <h3 className="mt-1.5 text-base font-semibold text-deep">
              {p.title}
            </h3>
          </li>
        ))}
      </ol>

      <Link
        href="/piloto"
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
      >
        Ver cómo se diseña un piloto <ArrowRight size={15} />
      </Link>
    </div>
  );
}
