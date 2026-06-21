import type { ReactNode } from "react";
import { Container } from "./Container";

type SectionProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  /** Superficie de fondo opcional para alternar ritmo visual. */
  tone?: "transparent" | "surface" | "deep";
  /** Si es false, no envuelve en Container (para layouts a medida). */
  contained?: boolean;
};

const toneClasses: Record<NonNullable<SectionProps["tone"]>, string> = {
  transparent: "",
  surface: "bg-white/70 border-y border-line backdrop-blur-sm",
  deep: "bg-deep text-white",
};

export function Section({
  id,
  children,
  className = "",
  tone = "transparent",
  contained = true,
}: SectionProps) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 py-16 md:py-24 ${toneClasses[tone]} ${className}`}
    >
      {contained ? <Container>{children}</Container> : children}
    </section>
  );
}
