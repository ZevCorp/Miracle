import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";

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
    <section className="border-b border-line py-14 md:py-20">
      <Container>
        {eyebrow ? (
          <Badge tone="accent" className="mb-4">
            {eyebrow}
          </Badge>
        ) : null}
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-deep md:text-5xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
            {subtitle}
          </p>
        ) : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </Container>
    </section>
  );
}
