"use client";

import { Search, X } from "lucide-react";

/**
 * EL buscador de la app. Había tres variantes (clinical-control, bg-surface,
 * bg-pearl) con alturas y radios distintos, y solo algunas tenían botón de
 * limpiar. Este es el único: hundido (hereda el neu-in de .clinical-control),
 * lupa a la izquierda y limpiar a la derecha cuando hay texto.
 *
 * Controlado a propósito: el debounce, la URL o el filtro en memoria son
 * decisiones de cada pantalla, no de este campo.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  autoFocus = false,
  clearable = true,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** Si no se pasa, el placeholder hace de etiqueta accesible. */
  ariaLabel?: string;
  autoFocus?: boolean;
  clearable?: boolean;
  className?: string;
}) {
  return (
    <div className={`clinical-control flex items-center gap-2 px-3 ${className}`}>
      <Search size={16} className="shrink-0 text-muted" aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        autoFocus={autoFocus}
        type="search"
        // El X propio ya limpia; el nativo de WebKit duplicaría el control.
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
      />
      {clearable && value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          className="shrink-0 rounded-full p-1 text-muted transition-colors hover:bg-ice-soft hover:text-deep"
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}
