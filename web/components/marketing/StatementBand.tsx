import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { BrandSphere } from "@/components/brand/BrandSphere";

/** Banda oscura full-bleed para un momento "statement" (premium, alto contraste). */
export function StatementBand({
  eyebrow,
  title,
  children,
  sphere = true,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  sphere?: boolean;
}) {
  return (
    <section className="relative overflow-hidden bg-deep py-24 text-white md:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-40 -top-32 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute -left-32 bottom-[-6rem] h-80 w-80 rounded-full bg-mint/10 blur-[110px]" />
      </div>
      <Container className="relative">
        <div className="grid items-center gap-14 lg:grid-cols-[1.25fr_1fr]">
          <div>
            {eyebrow ? (
              <span className="text-sm font-semibold uppercase tracking-[0.14em] text-mint">
                {eyebrow}
              </span>
            ) : null}
            <h2 className="mt-4 text-4xl font-semibold leading-[1.05] text-white md:text-5xl">
              {title}
            </h2>
            {children ? (
              <div className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
                {children}
              </div>
            ) : null}
          </div>
          {sphere ? (
            <div className="flex justify-center lg:justify-end">
              <BrandSphere size={320} className="drop-shadow-2xl" />
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
