import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { ProductMockup } from "@/components/marketing/ProductMockup";
import { CTASection } from "@/components/marketing/CTA";
import { CTA, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Demo",
  description:
    "Vista del producto Miracle: transcripción, nota clínica estructurada, codificación CIE-10/CUPS sugerida y revisión médica antes de exportar.",
};

const annotations = [
  {
    title: "Transcripción en vivo",
    text: "La conversación se transcribe y puede revisarse, con identificación de hablante.",
  },
  {
    title: "Nota estructurada",
    text: "Formato SOAP con campos editables; el médico ajusta lo que necesite.",
  },
  {
    title: "Codificación sugerida",
    text: "CIE-10 y CUPS propuestos con su nivel de confianza, para revisión.",
  },
  {
    title: "Estado de revisión",
    text: "Borrador, revisado, aprobado y exportado — siempre con responsable.",
  },
];

export default function DemoPage() {
  return (
    <>
      <PageHero
        eyebrow="Demo"
        title="Así se ve la pantalla clínica."
        subtitle="Una representación del producto con datos de ejemplo. La demo en vivo se coordina con su equipo sobre un caso real de su servicio."
      >
        <Button
          href={whatsappLink(
            "Hola, queremos agendar una demo en vivo de Miracle.",
          )}
          variant="primary"
          size="lg"
        >
          Agendar demo en vivo <ArrowRight size={18} />
        </Button>
      </PageHero>

      <Section>
        <ProductMockup />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {annotations.map((a) => (
            <div key={a.title} className="border-l-2 border-accent pl-4">
              <h3 className="font-semibold text-deep">{a.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                {a.text}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted">
          Nota: las pantallas usan datos de ejemplo. No se muestran datos reales
          de pacientes.
        </p>
      </Section>

      <CTASection
        title="Veámoslo con un caso de su servicio"
        subtitle="La demo más útil es sobre su propio flujo. Coordinemos una sesión con su equipo."
      />
    </>
  );
}
