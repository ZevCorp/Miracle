import type { Metadata } from "next";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CTASection } from "@/components/marketing/CTA";
import { CTA, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Piloto hospitalario",
  description:
    "Un piloto medible de Miracle: un servicio, un grupo pequeño de médicos y métricas de antes y después para decidir con evidencia propia.",
};

const measures = [
  {
    title: "Tiempo de documentación",
    text: "Cuánto tiempo toma dejar la nota lista, antes y después.",
  },
  {
    title: "Adopción y uso real",
    text: "Qué tanto y cómo lo usan los médicos en su día a día.",
  },
  {
    title: "Calidad de las notas",
    text: "Completitud y consistencia de la documentación generada.",
  },
  {
    title: "Feedback del equipo",
    text: "La percepción del personal médico sobre el flujo.",
  },
  {
    title: "Impacto operativo",
    text: "Señales tempranas sobre reprocesos y carga administrativa.",
  },
  {
    title: "Codificación",
    text: "Consistencia de CIE-10 y CUPS sugeridos frente a la revisión.",
  },
];

const phases = [
  {
    n: "Semana 1",
    title: "Alistamiento",
    text: "Definimos el servicio, el grupo de médicos y las métricas base. Configuramos plantillas y consentimiento.",
  },
  {
    n: "Semanas 2–5",
    title: "Operación del piloto",
    text: "Uso real en consulta con acompañamiento. Recogemos datos de tiempo, adopción y calidad.",
  },
  {
    n: "Semana 6",
    title: "Resultados",
    text: "Comparamos antes y después, recogemos feedback y presentamos hallazgos a la dirección.",
  },
];

export default function PilotoPage() {
  return (
    <>
      <PageHero
        eyebrow="Piloto hospitalario"
        title="Una decisión basada en evidencia de su propia institución."
        subtitle="No pedimos un acto de fe. Diseñamos un piloto acotado y medible para que la dirección decida con datos reales."
      >
        <Button
          href={whatsappLink(
            "Hola, queremos diseñar un piloto de Miracle en nuestra institución.",
          )}
          variant="primary"
          size="lg"
        >
          {CTA.primary.label} <ArrowRight size={18} />
        </Button>
      </PageHero>

      <Section>
        <h2 className="text-3xl font-semibold text-deep">Qué medimos</h2>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">
          Acordamos las métricas al inicio para evaluar el piloto con criterios
          claros.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {measures.map((m) => (
            <Card key={m.title} className="h-full">
              <CheckCircle2 className="text-success" size={22} />
              <h3 className="mt-3 text-base font-semibold text-deep">
                {m.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {m.text}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="surface">
        <h2 className="text-3xl font-semibold text-deep">Cómo se ve un piloto</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {phases.map((p) => (
            <Card key={p.n} className="h-full">
              <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                {p.n}
              </span>
              <h3 className="mt-2 text-lg font-semibold text-deep">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {p.text}
              </p>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">
          Los tiempos son una referencia y se ajustan al contexto de cada
          institución.
        </p>
      </Section>

      <CTASection />
    </>
  );
}
