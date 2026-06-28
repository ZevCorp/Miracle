import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Clock,
  Eye,
  Layers,
  Lock,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { BrandSphere } from "@/components/brand/BrandSphere";
import { StepFlow } from "@/components/marketing/StepFlow";
import { UIGlimpse } from "@/components/marketing/UIGlimpse";
import { StatementBand } from "@/components/marketing/StatementBand";
import { CTASection } from "@/components/marketing/CTA";
import { CTA } from "@/lib/site";

export default function HomePage() {
  return (
    <>
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden pt-16 pb-20 text-center md:pt-24 md:pb-28">
        <Container>
          <div className="rise mx-auto flex max-w-3xl flex-col items-center">
            <BrandSphere size={116} className="mb-8" />
            <span className="eyebrow">Inteligencia clínica-operativa</span>
            <h1 className="mt-4 text-[clamp(2.5rem,6vw,4.25rem)] font-semibold leading-[1.02] tracking-tight text-deep">
              La consulta se atiende.
              <br />
              Miracle la documenta.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              Convierta cada consulta en una historia clínica estructurada,
              codificada y auditable — sin cambiar el sistema que ya usa.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Button href={CTA.primary.href} variant="primary" size="lg">
                {CTA.primary.label} <ArrowRight size={18} />
              </Button>
              <Button href={CTA.secondary.href} variant="secondary" size="lg">
                {CTA.secondary.label}
              </Button>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-muted">
              <UserCheck size={16} className="text-success" />
              El médico siempre revisa y aprueba.
            </p>
          </div>
        </Container>
      </section>

      {/* ===== TRUST STRIP ===== */}
      <Container>
        <div className="flex flex-col items-center gap-4 border-y border-line py-8 text-center">
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
        </div>
      </Container>

      {/* ===== PROBLEMA (conciso: 3) ===== */}
      <section className="py-20 md:py-28">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">El problema</span>
            <h2 className="mt-4 text-3xl font-semibold text-deep md:text-[2.6rem]">
              La documentación consume el tiempo clínico.
            </h2>
          </div>
          <div className="mx-auto mt-14 grid max-w-4xl gap-x-10 gap-y-10 sm:grid-cols-3">
            <Pain
              icon={<Clock size={22} />}
              title="Médicos saturados"
              text="Horas frente al computador que se restan al paciente."
            />
            <Pain
              icon={<Layers size={22} />}
              title="Codificación dispar"
              text="CIE-10 y CUPS aplicados con criterios distintos."
            />
            <Pain
              icon={<Eye size={22} />}
              title="Glosas y reprocesos"
              text="Documentación que no soporta la facturación."
            />
          </div>
        </Container>
      </section>

      {/* ===== CÓMO FUNCIONA ===== */}
      <section className="border-y border-line bg-surface/60 py-20 md:py-28">
        <Container>
          <div className="max-w-2xl">
            <span className="eyebrow">Cómo funciona</span>
            <h2 className="mt-4 text-3xl font-semibold text-deep md:text-[2.6rem]">
              Cuatro pasos, dentro del flujo del médico.
            </h2>
          </div>
          <div className="mt-14">
            <StepFlow
              steps={[
                {
                  title: "Escucha o dictado",
                  text: "Miracle captura la consulta de forma segura, con consentimiento.",
                },
                {
                  title: "Estructura la nota",
                  text: "Organiza la información en una nota clínica clara y completa.",
                },
                {
                  title: "Sugiere códigos",
                  text: "Propone CIE-10 y CUPS con su nivel de confianza.",
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
            <div className="max-w-lg">
              <span className="eyebrow">El producto</span>
              <h2 className="mt-4 text-3xl font-semibold text-deep md:text-[2.6rem]">
                El médico revisa, no transcribe.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-ink-soft">
                La nota llega lista para revisar, con los códigos sugeridos y su
                nivel de confianza. El criterio siempre es del médico.
              </p>
              <Link
                href="/demo"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
              >
                Ver la demo <ArrowRight size={15} />
              </Link>
            </div>
            <div className="flex justify-center lg:justify-end">
              <UIGlimpse />
            </div>
          </div>
        </Container>
      </section>

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
          <div className="grid gap-10 md:grid-cols-2">
            <BenefitCol
              eyebrow="Para el médico"
              title="Menos carga. Más tiempo clínico."
              items={[
                "La nota llega casi lista para revisar.",
                "Codificación CIE-10 y CUPS asistida.",
                "Un flujo que acompaña, no interrumpe.",
              ]}
            />
            <BenefitCol
              eyebrow="Para la gerencia"
              title="Calidad documental y control."
              items={[
                "Trazabilidad y estados de cada nota.",
                "Documentación consistente, lista para auditoría.",
                "Un piloto medible para decidir con datos.",
              ]}
            />
          </div>
        </Container>
      </section>

      {/* ===== SEGURIDAD (fila de íconos) ===== */}
      <section className="border-y border-line bg-surface/60 py-20 md:py-28">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Confianza por diseño</span>
            <h2 className="mt-4 text-3xl font-semibold text-deep md:text-[2.6rem]">
              Pensado para datos sensibles.
            </h2>
          </div>
          <div className="mx-auto mt-14 grid max-w-4xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <Principle icon={<UserCheck size={20} />} title="Revisión humana">
              Toda nota requiere aprobación médica.
            </Principle>
            <Principle icon={<Eye size={20} />} title="Trazabilidad">
              Quién generó, revisó y aprobó cada nota.
            </Principle>
            <Principle icon={<Lock size={20} />} title="Roles y permisos">
              Acceso diferenciado por responsabilidad.
            </Principle>
            <Principle icon={<ShieldCheck size={20} />} title="Datos protegidos">
              No entrenamos modelos con sus datos.
            </Principle>
          </div>
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
    <div className="text-center sm:text-left">
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-ice text-accent sm:mx-0">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-deep">{title}</h3>
      <p className="mt-1.5 text-[0.97rem] leading-relaxed text-ink-soft">{text}</p>
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
