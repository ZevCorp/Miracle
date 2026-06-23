import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { CTA as CTA_LINKS, whatsappLink } from "@/lib/site";

type CTAProps = {
  title?: string;
  subtitle?: string;
};

/** Banda de cierre institucional, reutilizable al final de cada página. */
export function CTASection({
  title = "Probemos Miracle en su institución",
  subtitle = "Diseñe un piloto medible en un servicio, con un grupo pequeño de médicos y métricas antes y después. Sin cambiar el sistema que ya usa.",
}: CTAProps) {
  return (
    <section className="py-16 md:py-24">
      <Container>
        <div className="overflow-hidden rounded-xl bg-deep px-6 py-14 text-center shadow-[var(--shadow-xl)] md:px-16 md:py-20">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold text-white md:text-4xl">
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-mist">
            {subtitle}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              href={whatsappLink(
                "Hola, somos una institución de salud y queremos conocer un piloto de Miracle.",
              )}
              variant="onDark"
              size="lg"
            >
              {CTA_LINKS.primary.label}
            </Button>
            <Button href="/contacto" variant="onDarkGhost" size="lg">
              Hablar con el equipo
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
