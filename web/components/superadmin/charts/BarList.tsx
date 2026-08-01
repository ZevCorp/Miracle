import type { ReactNode } from "react";

/**
 * Lista de barras horizontales: la forma correcta para comparar magnitud entre
 * categorías de nombre largo (organizaciones, especialidades, estados).
 *
 * Horizontal y no una dona/pie a propósito: "Hospital General de Medellín" no
 * cabe en la porción de un círculo, y comparar ángulos es más difícil que
 * comparar longitudes. Una sola serie ⇒ un solo tono y sin caja de leyenda: el
 * título ya dice qué se está midiendo.
 */

export type BarItem = {
  label: string;
  value: number;
  /** Texto a la derecha del valor (ej. "· 3 médicos"). */
  hint?: string;
  /** Sobrescribe el tono de la fila; para estados semánticos (fallidas). */
  color?: string;
  href?: string;
};

export function BarList({
  items,
  emptyLabel = "Sin datos.",
  formatValue = (v: number) => v.toLocaleString("es-CO"),
  max: maxProp,
  trailing,
}: {
  items: BarItem[];
  emptyLabel?: string;
  formatValue?: (value: number) => string;
  max?: number;
  /** Contenido extra al final de cada fila (ej. una sparkline). */
  trailing?: (item: BarItem, index: number) => ReactNode;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{emptyLabel}</p>;
  }

  const max = Math.max(1, maxProp ?? Math.max(...items.map((i) => i.value)));

  return (
    <ul className="space-y-3">
      {items.map((item, index) => {
        const pct = Math.round((item.value / max) * 100);
        return (
          <li key={`${item.label}-${index}`} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-deep" title={item.label}>
                {item.label}
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                {item.hint ? <span className="text-xs text-muted">{item.hint}</span> : null}
                <span className="text-sm font-semibold text-deep">{formatValue(item.value)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Pista de 8px con extremo redondeado de 4px en el dato. */}
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-chart-grid)]">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.max(pct, item.value > 0 ? 2 : 0)}%`,
                    background: item.color ?? "var(--color-serie-1)",
                  }}
                />
              </div>
              {trailing ? trailing(item, index) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
