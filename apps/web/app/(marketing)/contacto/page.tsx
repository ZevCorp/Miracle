import type { Metadata } from "next";
import { Mail, MessageCircle } from "lucide-react";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { ContactForm } from "@/components/marketing/ContactForm";
import { SITE, WHATSAPP_BASE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Hable con el equipo de Miracle sobre un piloto en su institución de salud.",
};

export default function ContactoPage() {
  return (
    <>
      <PageHero
        eyebrow="Contacto"
        title="Hablemos de su institución."
        subtitle="Cuéntenos su contexto y diseñamos juntos un piloto enfocado en el servicio de mayor impacto."
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <ContactForm />
          </Card>
          <div className="space-y-4">
            <Card>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-mint-soft text-success">
                  <MessageCircle size={20} />
                </span>
                <div>
                  <h3 className="font-semibold text-deep">WhatsApp</h3>
                  <a
                    href={WHATSAPP_BASE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:underline"
                  >
                    Escribir al equipo
                  </a>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft text-accent">
                  <Mail size={20} />
                </span>
                <div>
                  <h3 className="font-semibold text-deep">Correo</h3>
                  <a
                    href={`mailto:${SITE.email}`}
                    className="text-sm text-accent hover:underline"
                  >
                    {SITE.email}
                  </a>
                </div>
              </div>
            </Card>
            <p className="text-sm leading-relaxed text-muted">
              Atendemos a instituciones de salud en Colombia. Respondemos para
              coordinar una primera conversación y, si hay encaje, un piloto
              medible.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
