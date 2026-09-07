"use client";

import type { LucideIcon } from "lucide-react";

export interface SegmentedOption {
  id: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

/**
 * EL grupo de opciones excluyentes de la app: riel hundido + pulgar elevado
 * (clases .seg / .seg-item de globals.css). Reemplaza los cuatro patrones que
 * convivían: chips rounded-[9px], segmented sólido azul, Tabs suaves y el
 * segmented blanco de "Iniciar consulta".
 *
 * No confundir con los chips de ESTADO de consultas/notas: esos filtran por
 * un estado semántico con su propio color (STATUS_CHIP_ACTIVE) y no migran.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  fullWidth = false,
  className = "",
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  /** Ocupa el ancho disponible repartiendo las opciones por igual. */
  fullWidth?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`seg ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {options.map((option) => {
        const active = option.id === value;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            className={`seg-item min-w-0 ${fullWidth ? "flex-1" : ""}`}
          >
            {Icon ? <Icon size={15} className="shrink-0" aria-hidden /> : null}
            <span className="truncate">{option.label}</span>
            {typeof option.count === "number" ? (
              <span
                className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${
                  active ? "bg-accent/15 text-accent-ink" : "bg-ice text-muted"
                }`}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
