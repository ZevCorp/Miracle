import type { LucideIcon } from "lucide-react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Sparkline } from "./Sparkline";

/**
 * Tarjeta KPI: valor + variación + microtendencia.
 *
 * Es la forma correcta para un número de titular — no una gráfica de una sola
 * barra. La variación va con icono ADEMÁS del color: verde/rojo solos no se
 * leen con daltonismo, y la flecha ya dice la dirección.
 *
 * "Más" no siempre es bueno: `invertido` sirve para métricas donde subir es
 * malo (fallos), así que el tono se decide por el significado, no por el signo.
 */
export function StatTile({
  label,
  value,
  suffix,
  deltaPct,
  previousLabel,
  spark,
  icon: Icon,
  footnote,
  footnoteTone,
  invertido = false,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  deltaPct?: number | null;
  previousLabel?: string;
  spark?: number[];
  icon?: LucideIcon;
  footnote?: string;
  /** Tiñe la nota al pie cuando lo que cuenta es un problema ("3 fallidas de
      120"). El número grande se queda neutro: es el pie el que da la mala
      noticia, y así no se confunde con la flecha de tendencia. */
  footnoteTone?: "warning";
  invertido?: boolean;
}) {
  const sinCambio = deltaPct === 0;
  const subio = typeof deltaPct === "number" && deltaPct > 0;
  const bueno = invertido ? !subio : subio;
  const footnoteClass = footnoteTone === "warning" ? "text-warning" : "text-muted";

  const TrendIcon = sinCambio ? Minus : subio ? TrendingUp : TrendingDown;
  const trendClass = sinCambio
    ? "text-muted"
    : bueno
      ? "text-success"
      : "text-warning";

  return (
    <div className="rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-xs)]">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm text-muted">{label}</span>
        {Icon ? (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ice text-accent">
            <Icon size={16} />
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="font-display text-[28px] font-semibold leading-none text-deep">{value}</span>
            {suffix ? <span className="text-sm text-muted">{suffix}</span> : null}
          </div>

          {typeof deltaPct === "number" ? (
            <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${trendClass}`}>
              <TrendIcon size={14} />
              <span>
                {sinCambio ? "sin cambio" : `${Math.abs(deltaPct)}%`}
                {previousLabel ? <span className="text-muted"> {previousLabel}</span> : null}
              </span>
            </div>
          ) : footnote ? (
            <div className={`mt-2 text-xs ${footnoteClass}`}>{footnote}</div>
          ) : null}
        </div>

        {/* La microtendencia se oculta en móvil: al lado del número no cabe sin
            empujar la tarjeta fuera del viewport, y es información secundaria. */}
        {spark && spark.length > 1 ? (
          <div className="hidden shrink-0 sm:block">
            <Sparkline values={spark} label={`Tendencia de ${label}`} />
          </div>
        ) : null}
      </div>

      {typeof deltaPct === "number" && footnote ? (
        <div className={`mt-2 text-xs ${footnoteClass}`}>{footnote}</div>
      ) : null}
    </div>
  );
}
