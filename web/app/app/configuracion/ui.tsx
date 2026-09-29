"use client";

// Piezas compartidas por las cinco secciones de Configuración.
//
// Viven aquí y no en components/ui porque solo las usa esta pantalla: son la
// gramática de "un ajuste" (título, explicación de una línea, control a la
// derecha), no componentes de propósito general. Si algún día otra pantalla las
// necesita, subirlas es un `git mv`; adelantarse sería inventar una abstracción
// para un solo consumidor.

import type { ReactNode } from "react";
import { Check } from "lucide-react";

export const inputClass =
  "w-full rounded-md border border-line bg-field px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent disabled:bg-disabled disabled:text-disabled-ink";

/** Bloque de ajustes con su título y, si hace falta, una línea que lo explique. */
export function SettingCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-xs)] sm:p-6">
      <h2 className="font-display text-base font-semibold text-deep">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      <div className="mt-4">{children}</div>
      {footer ? <div className="mt-4 border-t border-line pt-4">{footer}</div> : null}
    </section>
  );
}

/** Una fila: qué es a la izquierda, el control a la derecha. */
export function SettingRow({
  title,
  desc,
  children,
  first = false,
}: {
  title: string;
  desc?: ReactNode;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 ${
        first ? "" : "mt-4 border-t border-line pt-4"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-deep">{title}</div>
        {desc ? <div className="mt-0.5 text-xs leading-relaxed text-muted">{desc}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-deep">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-accent" : "bg-mist"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export interface Opcion<T extends string> {
  value: T;
  label: string;
  desc?: string;
}

/**
 * Elección entre pocas alternativas excluyentes, en tarjetas apiladas.
 *
 * Es un radiogroup de verdad (roles ARIA + flechas), no una fila de botones:
 * son decisiones que el médico toma una vez y necesita LEER —cada opción trae
 * su consecuencia escrita debajo—, y un `<select>` esconde justo eso.
 */
export function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  columns = 1,
}: {
  label: string;
  value: T;
  options: readonly Opcion<T>[];
  onChange: (v: T) => void;
  disabled?: boolean;
  columns?: 1 | 3;
}) {
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const teclas = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"];
    if (!teclas.includes(e.key)) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const paso = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
    const siguiente = options[(i + paso + options.length) % options.length];
    if (siguiente) onChange(siguiente.value);
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={columns === 3 ? "grid gap-2 sm:grid-cols-3" : "space-y-2"}
    >
      {options.map((option) => {
        const activa = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={activa}
            // Solo la opción activa entra en el orden de tabulación: dentro del
            // grupo se navega con las flechas, que es como se espera de un
            // radiogroup y evita que estas tarjetas se coman cinco tabuladores.
            tabIndex={activa ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors disabled:opacity-60 ${
              activa
                ? "border-accent bg-accent-soft"
                : "border-line bg-surface hover:border-mist"
            }`}
          >
            <span
              aria-hidden
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                activa ? "border-accent bg-accent text-white" : "border-mist"
              }`}
            >
              {activa ? <Check size={10} strokeWidth={3.5} /> : null}
            </span>
            <span className="min-w-0">
              <span
                className={`block text-sm font-semibold ${activa ? "text-accent-ink" : "text-deep"}`}
              >
                {option.label}
              </span>
              {option.desc ? (
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                  {option.desc}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
