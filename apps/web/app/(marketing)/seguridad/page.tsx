import type { Metadata } from "next";
import {
  ClipboardCheck,
  Eye,
  Lock,
  ServerCog,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/ui/Section";
import { SecurityBadge } from "@/components/marketing/SecurityBadge";
import { CTASection } from "@/components/marketing/CTA";

export const metadata: Metadata = {
  title: "Seguridad y privacidad",
  description:
    "Principios de seguridad de Miracle: revisión humana, consentimiento, trazabilidad, roles y permisos, y protección de datos como dirección de diseño.",
};

export default function SeguridadPage() {
  return (
    <>
      <PageHero
        eyebrow="Seguridad y privacidad"
        title="Confianza por diseño, no por promesa."
        subtitle="Estos son los principios que guían el producto. Describimos dirección de diseño y prácticas previstas; no afirmamos certificaciones que no tengamos."
      />

      <Section>
        <div className="grid gap-4 md:grid-cols-2">
          <SecurityBadge icon={<UserCheck size={18} />} title="Revisión humana obligatoria">
            La documentación generada siempre requiere la revisión y aprobación
            del médico. La IA asiste; no decide.
          </SecurityBadge>
          <SecurityBadge icon={<ClipboardCheck size={18} />} title="Consentimiento">
            El uso se enmarca en el consentimiento del paciente, según la
            práctica de cada institución.
          </SecurityBadge>
          <SecurityBadge icon={<Eye size={18} />} title="Trazabilidad">
            Registro de quién generó, revisó y aprobó cada nota, con estados y
            marcas de tiempo.
          </SecurityBadge>
          <SecurityBadge icon={<Lock size={18} />} title="Roles y permisos">
            Acceso diferenciado para médico, auditoría y administración, según
            la responsabilidad de cada rol.
          </SecurityBadge>
          <SecurityBadge icon={<ShieldCheck size={18} />} title="Cifrado como principio">
            La protección de la información en tránsito y en reposo es parte de
            la base del diseño del producto.
          </SecurityBadge>
          <SecurityBadge icon={<ServerCog size={18} />} title="Datos del hospital">
            Como principio de diseño, los datos de la institución no se usan para
            entrenar modelos de terceros.
          </SecurityBadge>
        </div>
      </Section>

      <Section tone="surface">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold text-deep">
            Cumplimiento como dirección de producto
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Miracle se diseña teniendo presente la normativa colombiana de
            protección de datos personales y las exigencias de documentación
            clínica del sector. El detalle de garantías y acuerdos se define con
            cada institución durante el piloto.
          </p>
        </div>
      </Section>

      <CTASection
        title="Revisemos seguridad con su área de TI y calidad"
        subtitle="Coordinamos una sesión con los equipos responsables para revisar el enfoque en su contexto."
      />
    </>
  );
}
