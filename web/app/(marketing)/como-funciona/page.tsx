import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/ui/Section";
import { StepFlow } from "@/components/marketing/StepFlow";
import { CTASection } from "@/components/marketing/CTA";

export const metadata: Metadata = {
  title: "Cómo funciona",
  description:
    "El flujo de Miracle dentro de la consulta: escucha o dictado, estructura de la nota, codificación sugerida y revisión médica antes de exportar.",
};

export default function ComoFuncionaPage() {
  return (
    <>
      <PageHero
        eyebrow="Cómo funciona"
        title="Dentro del flujo del médico, no encima de él."
        subtitle="Miracle acompaña la consulta y entrega documentación lista para revisar. El médico mantiene el control en cada paso."
      />

      <Section>
        <StepFlow
          steps={[
            {
              title: "El médico atiende",
              text: "La consulta ocurre con normalidad y con consentimiento del paciente.",
            },
            {
              title: "Escucha o dictado",
              text: "Miracle captura la conversación o recibe el dictado de forma segura.",
            },
            {
              title: "Estructura la nota",
              text: "Organiza la información en una nota clínica clara y consistente.",
            },
            {
              title: "Sugiere códigos",
              text: "Propone CIE-10 y CUPS con un nivel de confianza visible.",
            },
            {
              title: "Revisa y exporta",
              text: "El médico aprueba y lleva la nota a la historia clínica.",
            },
          ]}
        />
      </Section>

      <Section tone="surface">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold text-deep">
            Lo que ve el médico
          </h2>
        </div>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2">
          <Detail title="Transcripción a la vista">
            El texto de la consulta se puede revisar y editar, con identificación
            de quién habla.
          </Detail>
          <Detail title="Nota estructurada">
            Formato SOAP o evolución, con campos editables y lenguaje clínico.
          </Detail>
          <Detail title="Codificación sugerida">
            CIE-10 y CUPS propuestos con su nivel de confianza, para revisión.
          </Detail>
          <Detail title="Estado y trazabilidad">
            Borrador, revisado, aprobado y exportado — siempre con responsable.
          </Detail>
        </ul>
      </Section>

      <CTASection
        title="Veámoslo con un caso de su servicio"
        subtitle="Le mostramos el flujo completo aplicado a una especialidad o servicio de su institución."
      />
    </>
  );
}

function Detail({ title, children }: { title: string; children: string }) {
  return (
    <li className="border-l-2 border-accent pl-4">
      <h3 className="font-semibold text-deep">{title}</h3>
      <p className="mt-1 text-ink-soft">{children}</p>
    </li>
  );
}
