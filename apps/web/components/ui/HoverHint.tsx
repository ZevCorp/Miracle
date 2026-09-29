import type { ReactNode } from "react";

/** Pista breve para íconos y acciones menos evidentes. */
export function HoverHint({
  label,
  children,
  side = "bottom",
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  const position =
    side === "top"
      ? "bottom-full mb-2 translate-y-1"
      : "top-full mt-2 -translate-y-1";

  return (
    <span className="group relative inline-flex shrink-0">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 w-max max-w-56 -translate-x-1/2 rounded-md bg-night px-2.5 py-1.5 text-center text-xs font-medium leading-snug text-white opacity-0 shadow-[var(--shadow-md)] transition duration-150 ${position} group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100`}
      >
        {label}
      </span>
    </span>
  );
}
