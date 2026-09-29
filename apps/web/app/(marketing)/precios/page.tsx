import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHero } from "@/components/marketing/PageHero";
import { FAQ } from "@/components/marketing/FAQ";
import { CTASection } from "@/components/marketing/CTA";
import { PLAN, TRIAL_DIAS, precioDisplay } from "@/lib/billing/plans";
import { whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Precios",
  description: `Miracle Notes para médicos independientes con ${TRIAL_DIAS} días de prueba gratis, y acuerdos institucionales para hospitales, clínicas e IPS.`,
};

const faqItems = [
  {
    question: "¿Necesito tarjeta para empezar la prueba?",
    answer: `No. Creas tu cuenta y usas el producto completo durante ${TRIAL_DIAS} días. Solo pedimos un método de pago cuando decides suscribirte.`,
  },
  {
    question: "¿Qué pasa con mis notas si dejo de pagar?",
    answer:
      "Tu historia clínica queda guardada e intacta: nada se borra. El acceso se pausa hasta que reactives la suscripción, y al volver encuentras todo exactamente como lo dejaste.",
  },
  {
    question: "¿Puedo cancelar cuando quiera?",
    answer:
      "Sí. Desde tu página de suscripción abres el portal de pagos y cancelas en dos clics. Conservas el acceso hasta el final del período ya pagado.",
  },
  {
    question: "¿Cómo se paga?",
    answer:
      "Con tarjeta, en una página segura de Stripe. Miracle nunca ve ni almacena los datos de tu tarjeta.",
  },
  {
    question: "Trabajo en una clínica que ya usa Miracle, ¿debo pagar?",
    answer:
      "No. Si tu institución tiene acuerdo con Miracle, tu acceso lo cubre ella. La cuenta personal es para tu práctica independiente.",
  },
];

export default function PreciosPage() {
  return (
    <>
      <PageHero
        eyebrow="Precios"
        title="Empieza gratis. Paga solo si te quedas."
        subtitle="Para el médico independiente, una suscripción simple. Para hospitales, clínicas e IPS, un acuerdo a la medida de la institución."
      />

      <section className="py-14 md:py-20">
        <Container>
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            {/* B2C — médico independiente */}
            <div className="flex flex-col rounded-[14px] border-2 border-accent bg-surface p-7 shadow-[var(--shadow-lg)]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-deep">{PLAN.nombre}</h2>
                <Badge tone="accent">{TRIAL_DIAS} días gratis</Badge>
              </div>
              <p className="mt-1 text-sm text-ink-soft">Para el médico independiente.</p>
              <p className="mt-5 text-2xl font-semibold tracking-tight text-deep">
                {precioDisplay()}
              </p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {PLAN.incluye.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-ink-soft">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <Button href="/registro" variant="primary" size="lg" className="w-full">
                  Empezar prueba gratuita
                </Button>
                <p className="mt-2.5 text-center text-xs text-muted">
                  Sin tarjeta. Cancela cuando quieras.
                </p>
              </div>
            </div>

            {/* B2B — institución */}
            <div className="flex flex-col rounded-[14px] border border-line bg-surface p-7">
              <h2 className="text-xl font-semibold text-deep">Institucional</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Para hospitales, clínicas e IPS.
              </p>
              <p className="mt-5 text-2xl font-semibold tracking-tight text-deep">
                Acuerdo a la medida
              </p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {[
                  "Todo lo de Miracle Notes, para cada médico del servicio",
                  "Panel de administración: usuarios, roles y configuración",
                  "Auditoría y reportes de adopción para la dirección",
                  "Piloto medible antes de comprometerse",
                  "La institución paga; sus médicos solo usan",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-ink-soft">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-deep" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <Button
                  href={whatsappLink(
                    "Hola, somos una institución de salud y queremos conocer los planes de Miracle.",
                  )}
                  variant="secondary"
                  size="lg"
                  className="w-full"
                >
                  Hablar con el equipo
                </Button>
                <p className="mt-2.5 text-center text-xs text-muted">
                  Respuesta el mismo día hábil.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-t border-line py-14 md:py-20">
        <Container>
          <h2 className="mb-8 text-center text-2xl font-semibold text-deep md:text-3xl">
            Preguntas frecuentes
          </h2>
          <FAQ items={faqItems} />
        </Container>
      </section>

      <CTASection />
    </>
  );
}
