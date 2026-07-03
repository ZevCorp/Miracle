import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Eye,
  HeartPulse,
  Lock,
  Monitor,
  Moon,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { BrandSphere } from "@/components/brand/BrandSphere";
import { StepFlow } from "@/components/marketing/StepFlow";
import { UIGlimpse } from "@/components/marketing/UIGlimpse";
import { StatementBand } from "@/components/marketing/StatementBand";
import { Figure } from "@/components/marketing/Figure";
import { ImpactStats } from "@/components/marketing/ImpactStats";
import { PilotoTeaser } from "@/components/marketing/PilotoTeaser";
import { FAQ } from "@/components/marketing/FAQ";
import { CTASection } from "@/components/marketing/CTA";
import { CTA } from "@/lib/site";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";

export default function HomePage() {
  return (
    <>
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden pt-16 pb-20 text-center md:pt-24 md:pb-28">
        <Container>
          <RevealGroup className="mx-auto flex max-w-3xl flex-col items-center">
            <RevealItem>
              <BrandSphere size={116} className="float mb-8" />
            </RevealItem>
            <RevealItem>
              <span className="eyebrow">Menos pantalla, más medicina</span>
            </RevealItem>
            <RevealItem>
              <h1 className="mt-4 text-[clamp(2.5rem,6vw,4.25rem)] font-semibold leading-[1.02] tracking-tight text-deep">
                Mire al paciente.
                <br />
                Miracle se encarga del resto.
              </h1>
            </RevealItem>
            <RevealItem>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
                Mientras usted atiende, Miracle escucha y arma la nota clínica —
                estructurada y codificada. El computador deja de robarle tiempo a
                la consulta, sin cambiar el sistema que ya usa.
              </p>
            </RevealItem>
            <RevealItem>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Button href={CTA.primary.href} variant="primary" size="lg">
                  {CTA.primary.label} <ArrowRight size={18} />
                </Button>
                <Button href={CTA.secondary.href} variant="secondary" size="lg">
                  {CTA.secondary.label}
                </Button>
              </div>
            </RevealItem>
            <RevealItem>
              <p className="mt-6 flex items-center gap-2 text-sm text-muted">
                <UserCheck size={16} className="text-success" />
                El médico siempre revisa y aprueba.
              </p>
            </RevealItem>
          </RevealGroup>
        </Container>
      </section>

      {/* ===== TRUST STRIP ===== */}
      <Container>
        <Reveal className="flex flex-col items-center gap-4 border-y border-line py-8 text-center">
          <p className="text-sm font-medium text-muted">
            Diseñado para el flujo real de hospitales, clínicas e IPS en Colombia.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {["CIE-10", "CUPS", "RIPS", "Auditoría", "Revisión médica"].map(
              (chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink-soft"
                >
                  {chip}
                </span>
              ),
            )}
          </div>
        </Reveal>
      </Container>

      {/* ===== PROBLEMA (contraste con foto "antes") ===== */}
      <section className="py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal className="order-2 lg:order-1">
              <span className="eyebrow">El problema</span>
              <h2 className="mt-4 text-3xl font-semibold text-deep md:text-[2.6rem]">
                El computador se metió entre usted y el paciente.
              </h2>
              <div className="mt-8 space-y-6">
                <Pain
                  icon={<Monitor size={22} />}
                  title="La pantalla, no los ojos"
                  text="El médico teclea mientras el paciente habla."
                />
                <Pain
                  icon={<Moon size={22} />}
                  title="El trabajo se lleva a casa"
                  text="Notas y pendientes que invaden las noches."
                />
                <Pain
                  icon={<HeartPulse size={22} />}
                  title="Menos medicina por consulta"
                  text="El tiempo administrativo le gana al clínico."
                />
              </div>
            </Reveal>
            <Reveal className="order-1 lg:order-2" delay={0.1}>
              <Figure
                src="/images/consulta-antes.jpg"
                alt="Médico frente al computador, de espaldas al paciente durante la consulta."
                aspect="3 / 2"
                priority
              />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* ===== CÓMO FUNCIONA ===== */}
      <section className="border-y border-line bg-surface/60 py-20 md:py-28">
        <Container>
          <Reveal className="max-w-2xl">
            <span className="eyebrow">Cómo funciona</span>
            <h2 className="mt-4 text-3xl font-semibold text-deep md:text-[2.6rem]">
              Usted solo atiende. Del resto se encarga Miracle.
            </h2>
          </Reveal>
          <div className="mt-14">
            <StepFlow
              steps={[
                {
                  title: "Usted atiende",
                  text: "Mira y escucha al paciente; Miracle capta la consulta en segundo plano, con consentimiento.",
                },
                {
                  title: "Estructura la nota",
                  text: "Sin que usted teclee, organiza la información en una nota clínica clara y completa.",
                },
                {
                  title: "Sugiere códigos",
                  text: "Propone CIE-10 y CUPS con su nivel de confianza, listos para revisar.",
                },
                {
                  title: "Revisa y exporta",
                  text: "El médico aprueba y lleva la nota a la historia clínica.",
                },
              ]}
            />
          </div>
        </Container>
      </section>

      {/* ===== PRODUCTO (split + UIGlimpse) ===== */}
      <section className="py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal className="max-w-lg">
              <span className="eyebrow">El producto</span>
              <h2 className="mt-4 text-3xl font-semibold text-deep md:text-[2.6rem]">
                El médico revisa, no transcribe.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-ink-soft">
                Durante la consulta usted no toca el teclado. Al final, la nota
                llega lista para revisar, con los códigos sugeridos y su nivel de
                confianza. El criterio siempre es del médico.
              </p>
              <Link
                href="/demo"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
              >
                Ver la demo <ArrowRight size={15} />
              </Link>
            </Reveal>
            <Reveal className="flex justify-center lg:justify-end" delay={0.1}>
              <UIGlimpse />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* ===== MOMENTO EMOCIONAL (banda oscura con foto "ahora") ===== */}
      <StatementBand
        eyebrow="La consulta, de vuelta"
        title={
          <>
            Devuélvale la
            <br />
            atención al paciente.
          </>
        }
        media={
          <Figure
            src="/images/consulta-ahora.jpg"
            alt="Médico frente al paciente, atento y sin el computador de por medio."
            aspect="4 / 3"
            className="w-full max-w-md"
          />
        }
      >
        Miracle se ocupa del computador para que la consulta vuelva a ser una
        conversación. El médico mira, escucha y decide; el papeleo deja de ser su
        segundo trabajo.
      </StatementBand>

      {/* ===== DIFERENCIAL COLOMBIA (banda oscura) ===== */}
      <StatementBand
        eyebrow="Hecho para Colombia"
        title={
          <>
            No solo escribe notas.
            <br />
            Encaja en la norma.
          </>
        }
      >
        CIE-10, CUPS y preparación para RIPS, con trazabilidad y auditoría — sobre
        el sistema que su institución ya usa. Ese es el trabajo que de verdad
        cuesta, y el que Miracle resuelve.
      </StatementBand>

      {/* ===== BENEFICIOS (2 columnas) ===== */}
      <section className="py-20 md:py-28">
        <Container>
          <RevealGroup className="grid gap-10 md:grid-cols-2">
            <RevealItem>
              <BenefitCol
                eyebrow="Para el médico"
                title="Menos carga. Más tiempo clínico."
                items={[
                  "La nota llega casi lista para revisar.",
                  "Codificación CIE-10 y CUPS asistida.",
                  "Un flujo que acompaña, no interrumpe.",
                ]}
              />
            </RevealItem>
            <RevealItem>
              <BenefitCol
                eyebrow="Para la gerencia"
                title="Equipos que rinden sin quemarse."
                items={[
                  "Menos carga administrativa, menos desgaste del equipo.",
                  "Documentación consistente, lista para auditoría.",
                  "Trazabilidad y estados de cada nota.",
                ]}
              />
            </RevealItem>
          </RevealGroup>
        </Container>
      </section>

      {/* ===== SEGURIDAD (fila de íconos) ===== */}
      <section className="border-y border-line bg-surface/60 py-20 md:py-28">
        <Container>
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Confianza por diseño</span>
            <h2 className="mt-4 text-3xl font-semibold text-deep md:text-[2.6rem]">
              Pensado para datos sensibles.
            </h2>
          </Reveal>
          <RevealGroup className="mx-auto mt-14 grid max-w-4xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <RevealItem>
              <Principle icon={<UserCheck size={20} />} title="Revisión humana">
                Toda nota requiere aprobación médica.
              </Principle>
            </RevealItem>
            <RevealItem>
              <Principle icon={<Eye size={20} />} title="Trazabilidad">
                Quién generó, revisó y aprobó cada nota.
              </Principle>
            </RevealItem>
            <RevealItem>
              <Principle icon={<Lock size={20} />} title="Roles y permisos">
                Acceso diferenciado por responsabilidad.
              </Principle>
            </RevealItem>
            <RevealItem>
              <Principle icon={<ShieldCheck size={20} />} title="Datos protegidos">
                No entrenamos modelos con sus datos.
              </Principle>
            </RevealItem>
          </RevealGroup>
          <div className="mt-10 text-center">
            <Link
              href="/seguridad"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
            >
              Ver enfoque de seguridad <ArrowRight size={15} />
            </Link>
          </div>
        </Container>
      </section>

      {/* ===== IMPACTO (tarjetas con foto de médico) ===== */}
      <section className="py-20 md:py-28">
        <Container>
          <ImpactStats />
        </Container>
      </section>

      {/* ===== PILOTO (evidencia propia, no promesas) ===== */}
      <section className="border-y border-line bg-surface/60 py-20 md:py-28">
        <Container>
          <Reveal>
            <PilotoTeaser />
          </Reveal>
        </Container>
      </section>

      {/* ===== PREGUNTAS FRECUENTES ===== */}
      <section className="py-20 md:py-28">
        <Container>
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Preguntas frecuentes</span>
            <h2 className="mt-4 text-3xl font-semibold text-deep md:text-[2.6rem]">
              Antes de que pregunte, respondamos.
            </h2>
          </Reveal>
          <Reveal className="mt-14" delay={0.1}>
            <FAQ
              items={[
                {
                  question: "¿La IA decide el diagnóstico o el código?",
                  answer:
                    "No. La IA sugiere; el médico revisa, edita y aprueba cada nota antes de firmarla. El criterio clínico siempre es suyo.",
                },
                {
                  question:
                    "¿Tenemos que cambiar de sistema (HIS) para usar Miracle?",
                  answer:
                    "No. Miracle está pensado para funcionar junto al sistema que su institución ya usa, sin migrar la historia clínica actual.",
                },
                {
                  question: "¿Qué pasa con los datos de nuestros pacientes?",
                  answer:
                    "La protección de datos es un principio de diseño: revisión humana, trazabilidad de cada nota, roles y permisos diferenciados, y los datos de su institución no se usan para entrenar modelos de terceros.",
                },
                {
                  question: "¿Hay que comprometerse de una vez?",
                  answer:
                    "No. Se empieza con un piloto acotado: un servicio, un grupo pequeño de médicos y métricas de antes y después definidas desde el inicio, para decidir con evidencia propia.",
                },
                {
                  question:
                    "¿Qué pasa si el médico no está de acuerdo con lo que sugiere la IA?",
                  answer:
                    "Lo edita o lo descarta. La nota no queda firmada hasta que el médico la aprueba; nada se envía a la historia clínica sin su revisión.",
                },
              ]}
            />
          </Reveal>
        </Container>
      </section>

      {/* ===== CIERRE ===== */}
      <CTASection />
    </>
  );
}

/* ---------- piezas locales ---------- */

function Pain({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ice text-accent">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-deep">{title}</h3>
        <p className="mt-1 text-[0.97rem] leading-relaxed text-ink-soft">
          {text}
        </p>
      </div>
    </div>
  );
}

function BenefitCol({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-8 shadow-[var(--shadow-sm)]">
      <span className="eyebrow">{eyebrow}</span>
      <h3 className="mt-3 text-2xl font-semibold text-deep">{title}</h3>
      <ul className="mt-6 space-y-3.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <ClipboardCheck size={18} className="mt-0.5 shrink-0 text-success" />
            <span className="text-ink-soft">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Principle({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-mint-soft text-success">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-deep">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}
