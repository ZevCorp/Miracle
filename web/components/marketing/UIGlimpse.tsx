/**
 * Fragmento mínimo de UI (no el mockup recargado): una sola tarjeta elegante
 * que muestra la codificación sugerida con confianza. Usada una vez.
 */
export function UIGlimpse({ className = "" }: { className?: string }) {
  return (
    <div
      className={`w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-lg)] ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Codificación sugerida
        </span>
        <span className="rounded-full bg-warning-soft px-2.5 py-1 text-[0.7rem] font-semibold text-warning">
          Para revisión
        </span>
      </div>

      <div className="mt-5 space-y-4">
        <CodeRow sistema="CIE-10" code="J45.9" desc="Asma, no especificada" conf={88} />
        <CodeRow sistema="CUPS" code="890201" desc="Consulta especializada" conf={94} />
      </div>

      <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-muted">
        Miracle sugiere; el médico revisa y aprueba. La IA no decide.
      </p>
    </div>
  );
}

function CodeRow({
  sistema,
  code,
  desc,
  conf,
}: {
  sistema: string;
  code: string;
  desc: string;
  conf: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span
          className={`rounded-md px-2 py-1 text-xs font-semibold ${
            sistema === "CIE-10"
              ? "bg-accent-soft text-accent-ink"
              : "bg-mint-soft text-success"
          }`}
        >
          {sistema}
        </span>
        <span className="font-mono text-sm font-semibold text-deep">{code}</span>
        <span className="truncate text-sm text-ink-soft">{desc}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ice">
          <span
            className="block h-full rounded-full bg-success"
            style={{ width: `${conf}%` }}
          />
        </span>
        <span className="w-9 text-right text-xs font-medium text-muted">
          {conf}%
        </span>
      </div>
    </div>
  );
}
