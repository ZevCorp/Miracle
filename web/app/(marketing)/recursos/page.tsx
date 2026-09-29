import type { Metadata } from "next";
import { BookOpen, FileText, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CTASection } from "@/components/marketing/CTA";

export const metadata: Metadata = {
  title: "Recursos",
  description:
    "Materiales sobre documentación clínica con IA, diseño de pilotos y enfoque de seguridad para instituciones de salud.",
};

const resources = [
  {
    icon: <BookOpen size={20} />,
    title: "Guía: documentación clínica con IA",
    text: "Cómo introducir asistencia de IA en la documentación sin perder el control médico.",
  },
  {
    icon: <FileText size={20} />,
    title: "Cómo diseñar un piloto hospitalario",
    text: "Métricas, alcance y pasos para evaluar una herramienta clínica con evidencia.",
  },
  {
    icon: <ShieldCheck size={20} />,
    title: "Marco de seguridad y privacidad",
    text: "Principios de revisión humana, trazabilidad y protección de datos.",
  },
];

export default function RecursosPage() {
  return (
    <>
      <PageHero
        eyebrow="Recursos"
        title="Material para decidir con criterio."
        subtitle="Contenido pensado para direcciones médicas, calidad y transformación digital."
      />

      <Section>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((r) => (
            <Card key={r.title} className="flex h-full flex-col">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-md bg-accent-soft text-accent">
                {r.icon}
              </div>
              <div className="mb-2">
                <Badge tone="neutral">Próximamente</Badge>
              </div>
              <h3 className="text-lg font-semibold text-deep">{r.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {r.text}
              </p>
            </Card>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted">
          ¿Necesita un material específico para presentar a su comité? Escríbanos
          y lo preparamos.
        </p>
      </Section>

      <CTASection
        title="¿Quiere una presentación para su comité?"
        subtitle="Preparamos el material adaptado a su institución y a su audiencia interna."
      />
    </>
  );
}
