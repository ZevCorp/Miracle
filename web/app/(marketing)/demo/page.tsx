import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { UIGlimpse } from "@/components/marketing/UIGlimpse";
import { CTASection } from "@/components/marketing/CTA";
import { whatsappLink } from "@/lib/site";

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
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="max-w-lg">
            <span className="eyebrow">El producto</span>
            <h2 className="mt-4 text-3xl font-semibold text-deep">
              Qué hace Miracle en la consulta
            </h2>
            <ul className="mt-7 space-y-5">
              {annotations.map((a) => (
                <li key={a.title} className="border-l-2 border-accent pl-4">
                  <h3 className="font-semibold text-deep">{a.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    {a.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center lg:justify-end">
            <UIGlimpse />
          </div>
        </div>
      </Section>

      <CTASection
        title="Veámoslo con un caso de su servicio"
        subtitle="La demo más útil es sobre su propio flujo. Coordinemos una sesión con su equipo."
      />
    </>
  );
}
