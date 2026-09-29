import type { Metadata } from "next";
import {
  Activity,
  BarChart3,
  Eye,
  FileText,
  Layers,
  Stethoscope,
} from "lucide-react";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/ui/Section";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { CTASection } from "@/components/marketing/CTA";

export const metadata: Metadata = {
  title: "Casos de uso",
  description:
    "Cómo Miracle apoya distintos servicios: consulta externa, urgencias, hospitalización, auditoría médica y gerencia/calidad.",
};

export default function CasosDeUsoPage() {
  return (
    <>
      <PageHero
        eyebrow="Casos de uso"
        title="Un mismo motor, distintos servicios."
        subtitle="Miracle se adapta al ritmo y las necesidades de cada área del hospital."
      />

      <Section>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={<Stethoscope size={20} />} title="Consulta externa">
            Documentación estructurada por especialidad, lista para revisar y
            exportar a la historia clínica.
          </FeatureCard>
          <FeatureCard icon={<Activity size={20} />} title="Urgencias">
            Resumen, evolución y plan de forma ágil para atención de alto
            volumen.
          </FeatureCard>
          <FeatureCard icon={<FileText size={20} />} title="Hospitalización">
            Evoluciones consistentes a lo largo de la estancia del paciente.
          </FeatureCard>
          <FeatureCard icon={<Eye size={20} />} title="Auditoría médica">
            Revisión de completitud y codificación con trazabilidad y estados.
          </FeatureCard>
          <FeatureCard icon={<BarChart3 size={20} />} title="Gerencia y calidad">
            Métricas de adopción, carga documental e impacto operativo por
            servicio.
          </FeatureCard>
          <FeatureCard icon={<Layers size={20} />} title="Coordinación clínica">
            Plantillas y formatos homogéneos entre equipos y especialidades.
          </FeatureCard>
        </div>
      </Section>

      <CTASection
        title="¿Cuál es el servicio con más carga documental?"
        subtitle="Empecemos por ahí. Diseñamos un piloto enfocado en el área de mayor impacto."
      />
    </>
  );
}
