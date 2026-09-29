import { UserRound } from "lucide-react";

/** Iniciales de un nombre: "José Manuel Ríos" → "JM". */
export function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0] ?? "")
    .join("")
    .toUpperCase();
}

const TAMANOS = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
} as const;

/**
 * Círculo con las iniciales del paciente. Cuando no hay nombre muestra una
 * silueta en gris: así un paciente sin identificar se distingue de un vistazo
 * en una lista, sin tener que leer el texto.
 */
export function Avatar({
  name,
  size = "md",
  className = "",
}: {
  name?: string | null;
  size?: keyof typeof TAMANOS;
  className?: string;
}) {
  const limpio = name?.trim();
  const base = `inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${TAMANOS[size]} ${className}`;

  if (!limpio) {
    return (
      <span aria-hidden className={`${base} bg-ice text-muted`}>
        <UserRound size={size === "sm" ? 15 : 18} />
      </span>
    );
  }

  return (
    <span aria-hidden className={`${base} bg-night text-white`}>
      {iniciales(limpio)}
    </span>
  );
}
