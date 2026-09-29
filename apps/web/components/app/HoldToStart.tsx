"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Un control que se MANTIENE pulsado, como el obturador de una cámara o el
 * botón de un walkie-talkie: presionar llena un anillo alrededor del contenido
 * y, al completarse (600 ms), dispara la acción. Soltar antes ejecuta la
 * alternativa (onTap) — así el hold nunca es la única vía: clic corto y Enter
 * hacen lo seguro, mantener hace lo directo.
 *
 * Existe porque arrancar una grabación clínica no debería ser un clic
 * accidental: el medio segundo de intención es el costo justo para una acción
 * que enciende un micrófono.
 *
 * El teclado NO vive aquí a propósito: quién puede usar Espacio y cuándo son
 * reglas del contexto (el dashboard con sus guards), no de este control. El
 * padre llama press()/release() por ref.
 */

export interface HoldToStartHandle {
  /** Inicia el llenado (p. ej. al presionar Espacio en el padre). */
  press: () => void;
  /** Suelta: si el anillo no se llenó, cancela y dispara onTap. */
  release: () => void;
}

const RADIO = 48;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

export const HoldToStart = forwardRef<
  HoldToStartHandle,
  {
    onComplete: () => void;
    onTap: () => void;
    duration?: number;
    disabled?: boolean;
    /** aria-label del botón; el hold se explica en el texto visible del padre. */
    label: string;
    children: ReactNode;
  }
>(function HoldToStart(
  { onComplete, onTap, duration = 600, disabled = false, label, children },
  ref,
) {
  const [progreso, setProgreso] = useState(0);
  const rafRef = useRef(0);
  const inicioRef = useRef<number | null>(null);
  const completadoRef = useRef(false);
  const quietoRef = useRef(false);

  useEffect(() => {
    quietoRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  const parar = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    inicioRef.current = null;
    setProgreso(0);
  }, []);

  const press = useCallback(() => {
    if (disabled || inicioRef.current !== null) return;
    completadoRef.current = false;
    inicioRef.current = performance.now();

    function tick(t: number) {
      if (inicioRef.current === null) return;
      const bruto = (t - inicioRef.current) / duration;
      // Con reduced-motion el anillo no fluye: salta 0 → ½ → 1. El hold dura
      // exactamente lo mismo; solo se apaga la animación continua.
      const p = quietoRef.current
        ? bruto >= 1
          ? 1
          : bruto >= 0.5
            ? 0.5
            : 0
        : Math.min(1, bruto);
      setProgreso(p);
      if (bruto >= 1) {
        completadoRef.current = true;
        parar();
        onComplete();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [disabled, duration, onComplete, parar]);

  const release = useCallback(() => {
    const estabaEnCurso = inicioRef.current !== null;
    parar();
    if (estabaEnCurso && !completadoRef.current) onTap();
  }, [parar, onTap]);

  useImperativeHandle(ref, () => ({ press, release }), [press, release]);

  useEffect(() => () => parar(), [parar]);

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        // Sin la captura, arrastrar el puntero fuera del botón dejaba el hold
        // pegado esperando un pointerup que ya no iba a llegar aquí.
        e.currentTarget.setPointerCapture(e.pointerId);
        press();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={(e) => {
        // Enter = la vía segura. Espacio lo maneja el padre con sus guards.
        if (e.key === "Enter") {
          e.preventDefault();
          onTap();
        }
      }}
      className="group relative inline-flex touch-none select-none items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed"
    >
      {/* El anillo de intención. */}
      <svg
        aria-hidden
        viewBox="0 0 104 104"
        className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
      >
        <circle
          cx="52"
          cy="52"
          r={RADIO}
          fill="none"
          stroke="var(--color-line-strong)"
          strokeWidth="2"
          opacity={progreso > 0 ? 0.6 : 0.35}
        />
        <circle
          cx="52"
          cy="52"
          r={RADIO}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUNFERENCIA}
          strokeDashoffset={CIRCUNFERENCIA * (1 - progreso)}
          className="hold-ring"
        />
      </svg>
      {children}
    </button>
  );
});
