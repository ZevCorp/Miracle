import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";

/** Encabezado reutilizable para las subpáginas del sitio público. */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-line py-16 md:py-24">
      <Container>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1 className="mt-4 max-w-3xl text-[clamp(2.25rem,4.5vw,3.25rem)] font-semibold leading-[1.04] tracking-tight text-deep">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
            {subtitle}
          </p>
        ) : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </Container>
    </section>
  );
}
