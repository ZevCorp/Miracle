import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { BrandSphere } from "@/components/brand/BrandSphere";
import { Reveal } from "@/components/motion/Reveal";

/** Banda oscura full-bleed para un momento "statement" (premium, alto contraste). */
export function StatementBand({
  eyebrow,
  title,
  children,
  sphere = true,
  media,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  /** Muestra la esfera de marca como visual (por defecto). Se ignora si se pasa `media`. */
  sphere?: boolean;
  /** Visual a la derecha en lugar de la esfera (p. ej. una foto). */
  media?: ReactNode;
}) {
  const visual = media ?? (sphere ? <BrandSphere size={320} className="float drop-shadow-2xl" /> : null);
  return (
    <section className="relative overflow-hidden bg-deep py-24 text-white md:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-40 -top-32 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute -left-32 bottom-[-6rem] h-80 w-80 rounded-full bg-mint/10 blur-[110px]" />
      </div>
      <Container className="relative">
        <div className="grid items-center gap-14 lg:grid-cols-[1.25fr_1fr]">
          <Reveal>
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
          </Reveal>
          {visual ? (
            <Reveal className="flex justify-center lg:justify-end" delay={0.1}>
              {visual}
            </Reveal>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
