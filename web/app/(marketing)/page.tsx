import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Clock,
  Eye,
  FileText,
  FileWarning,
  Layers,
  ListChecks,
  Lock,
  Sparkles,
  Stethoscope,
  UserCheck,
} from "lucide-react";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { SecurityBadge } from "@/components/marketing/SecurityBadge";
import { Steps } from "@/components/marketing/Steps";
import { ProductMockup } from "@/components/marketing/ProductMockup";
import { CTASection } from "@/components/marketing/CTA";
import { CTA, whatsappLink } from "@/lib/site";

export default function HomePage() {
  return (
    <>
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden pt-14 pb-8 md:pt-20">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
            <div>
              <Badge tone="accent" className="mb-5">
                <Sparkles size={13} /> Inteligencia clínica-operativa
              </Badge>
              <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-deep md:text-[3.25rem]">
                Inteligencia clínica-operativa para hospitales colombianos.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
                Convierta cada consulta en una historia clínica estructurada,
                codificada y auditable — con revisión médica y sin cambiar el
                sistema que su institución ya usa.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button href={CTA.primary.href} variant="primary" size="lg">
                  {CTA.primary.label} <ArrowRight size={18} />
                </Button>
                <Button href={CTA.secondary.href} variant="secondary" size="lg">
                  {CTA.secondary.label}
                </Button>
              </div>
              <p className="mt-5 flex items-center gap-2 text-sm text-muted">
                <UserCheck size={16} className="text-success" />
                El médico siempre revisa y aprueba. Control humano en cada nota.
              </p>
            </div>
            <div className="lg:pl-4">
              <ProductMockup />
            </div>
          </div>
        </Container>
      </section>

      {/* ===== Franja de contexto ===== */}
      <Container>
        <p className="border-y border-line py-5 text-center text-sm font-medium text-muted">
          Diseñado para el flujo real de hospitales, clínicas e IPS en Colombia
          — CIE-10, CUPS y preparación para RIPS.
        </p>
      </Container>

      {/* ===== PROBLEMA ===== */}
      <Section id="problema">
        <div className="max-w-2xl">
          <Badge tone="neutral" className="mb-4">
            El problema
          </Badge>
          <h2 className="text-3xl font-semibold text-deep md:text-4xl">
            La documentación consume el tiempo clínico.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            El personal médico dedica buena parte de la jornada a escribir, no a
            atender. Y la institución asume el costo de una documentación
            incompleta o inconsistente.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <ProblemCard
            icon={<Clock size={20} />}
            title="Médicos saturados"
            text="Tiempo frente al computador que se resta a la atención del paciente y aumenta el desgaste."
          />
          <ProblemCard
            icon={<FileWarning size={20} />}
            title="Historias incompletas"
            text="Notas apresuradas o con campos faltantes que debilitan la calidad del registro clínico."
          />
          <ProblemCard
            icon={<Layers size={20} />}
            title="Codificación inconsistente"
            text="CIE-10 y CUPS aplicados de forma dispar, con criterios distintos entre profesionales."
          />
          <ProblemCard
            icon={<AlertTriangle size={20} />}
            title="Riesgo de glosas"
            text="Documentación que no soporta la facturación genera devoluciones y reprocesos."
          />
          <ProblemCard
            icon={<Eye size={20} />}
            title="Auditoría difícil"
            text="Sin trazabilidad clara, revisar y validar la calidad documental es lento y costoso."
          />
          <ProblemCard
            icon={<Activity size={20} />}
            title="Poca visibilidad"
            text="La gerencia carece de métricas confiables sobre carga, adopción y calidad documental."
          />
        </div>
      </Section>

      {/* ===== SOLUCIÓN ===== */}
      <Section id="solucion" tone="surface">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <Badge tone="accent" className="mb-4">
              La solución
            </Badge>
            <h2 className="text-3xl font-semibold text-deep md:text-4xl">
              Una capa de inteligencia clínica sobre su flujo actual.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">
              Miracle escucha o recibe el dictado de la consulta y la convierte
              en documentación lista para revisar — estructurada, codificada y
              trazable.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Escucha la consulta o recibe dictado médico.",
                "Estructura la información en una nota clínica clara.",
                "Sugiere códigos CIE-10 y CUPS para revisión.",
                "Prepara información útil para RIPS.",
                "Permite la revisión y aprobación del médico.",
                "Deja trazabilidad de quién generó y revisó cada nota.",
                "Se adapta al sistema que la institución ya usa.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <ListChecks
                    size={18}
                    className="mt-0.5 shrink-0 text-success"
                  />
                  <span className="text-ink-soft">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <Card className="p-2 sm:p-3">
            <ProductMockup />
          </Card>
        </div>
      </Section>

      {/* ===== CÓMO FUNCIONA ===== */}
      <Section id="como-funciona">
        <div className="max-w-2xl">
          <Badge tone="neutral" className="mb-4">
            Cómo funciona
          </Badge>
          <h2 className="text-3xl font-semibold text-deep md:text-4xl">
            Cinco pasos dentro del flujo del médico.
          </h2>
        </div>
        <div className="mt-10">
          <Steps
            steps={[
              {
                title: "El médico atiende",
                text: "La consulta ocurre con normalidad, con consentimiento del paciente.",
              },
              {
                title: "Miracle escucha o recibe dictado",
                text: "Captura la conversación o el dictado de forma segura.",
              },
              {
                title: "Estructura la nota",
                text: "Organiza la información en una nota clínica clara y completa.",
              },
              {
                title: "Sugiere códigos y campos clave",
                text: "Propone CIE-10 y CUPS con un nivel de confianza visible.",
              },
              {
                title: "El médico revisa y exporta",
                text: "Aprueba la nota y la lleva a la historia clínica.",
              },
            ]}
          />
        </div>
        <div className="mt-8">
          <Button href="/como-funciona" variant="ghost">
            Ver el flujo en detalle <ArrowRight size={16} />
          </Button>
        </div>
      </Section>

      {/* ===== BENEFICIOS MÉDICOS ===== */}
      <Section id="beneficios-medicos" tone="surface">
        <div className="max-w-2xl">
          <Badge tone="mint" className="mb-4">
            Para el médico
          </Badge>
          <h2 className="text-3xl font-semibold text-deep md:text-4xl">
            Menos carga administrativa. Más tiempo clínico.
          </h2>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={<Clock size={20} />} title="Menos tiempo documentando">
            La nota llega casi lista; el médico revisa en lugar de escribir
            desde cero.
          </FeatureCard>
          <FeatureCard icon={<FileText size={20} />} title="Notas más completas">
            Estructura consistente que ayuda a no dejar campos clave por fuera.
          </FeatureCard>
          <FeatureCard icon={<Stethoscope size={20} />} title="Flujo más natural">
            Diseñado para acompañar la consulta, no para interrumpirla.
          </FeatureCard>
          <FeatureCard icon={<Layers size={20} />} title="Codificación asistida">
            CIE-10 y CUPS sugeridos para agilizar, siempre bajo criterio médico.
          </FeatureCard>
          <FeatureCard icon={<UserCheck size={20} />} title="Control humano">
            El médico revisa y aprueba cada nota antes de exportarla.
          </FeatureCard>
          <FeatureCard icon={<Sparkles size={20} />} title="Menos desgaste">
            Pensado para reducir la fatiga asociada al registro clínico.
          </FeatureCard>
        </div>
      </Section>

      {/* ===== BENEFICIOS GERENCIA ===== */}
      <Section id="beneficios-gerencia">
        <div className="max-w-2xl">
          <Badge tone="accent" className="mb-4">
            Para la gerencia y la calidad
          </Badge>
          <h2 className="text-3xl font-semibold text-deep md:text-4xl">
            Calidad documental y control operativo.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Una base documental más sólida y visible — diseñada para fortalecer
            la auditoría y reducir reprocesos.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={<ClipboardCheck size={20} />} title="Mayor calidad documental">
            Notas estructuradas y consistentes en toda la institución.
          </FeatureCard>
          <FeatureCard icon={<Eye size={20} />} title="Trazabilidad y auditoría">
            Registro de quién generó, revisó y aprobó cada nota, con estados.
          </FeatureCard>
          <FeatureCard icon={<BarChart3 size={20} />} title="Métricas de uso">
            Visibilidad de adopción y carga documental por servicio y médico.
          </FeatureCard>
          <FeatureCard icon={<Layers size={20} />} title="Codificación consistente">
            CIE-10 y CUPS con criterios homogéneos, listos para revisión.
          </FeatureCard>
          <FeatureCard icon={<FileText size={20} />} title="Preparación para auditoría">
            Documentación pensada para sostener procesos de calidad y revisión.
          </FeatureCard>
          <FeatureCard icon={<Activity size={20} />} title="Piloto medible">
            Métricas de antes y después para decidir con evidencia propia.
          </FeatureCard>
        </div>
      </Section>

      {/* ===== DIFERENCIAL COLOMBIA ===== */}
      <Section id="diferencial" tone="deep" contained={false}>
        <Container>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-mint">
                Diseñado para Colombia
              </span>
              <h2 className="mt-4 text-3xl font-semibold text-white md:text-4xl">
                Pensado para la norma y el flujo real de la IPS.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-mist">
                La diferencia no es solo escribir notas: es encajar en el
                proceso administrativo y normativo colombiano.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DiffCard title="CIE-10" text="Diagnósticos sugeridos para revisión médica." />
              <DiffCard title="CUPS" text="Procedimientos sugeridos según la consulta." />
              <DiffCard title="RIPS" text="Preparación de información útil para el reporte." />
              <DiffCard title="Formatos internos" text="Adaptable a las plantillas propias del hospital." />
              <DiffCard
                title="Sin migrar de sistema"
                text="Trabaja sobre lo que la institución ya usa."
                wide
              />
            </div>
          </div>
        </Container>
      </Section>

      {/* ===== SEGURIDAD ===== */}
      <Section id="seguridad" tone="surface">
        <div className="max-w-2xl">
          <Badge tone="mint" className="mb-4">
            Seguridad y privacidad
          </Badge>
          <h2 className="text-3xl font-semibold text-deep md:text-4xl">
            Confianza por diseño.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Principios que guían el producto desde su base. La protección de
            datos y el cumplimiento normativo son dirección de diseño, no una
            promesa de certificación.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <SecurityBadge icon={<UserCheck size={18} />} title="Revisión humana obligatoria">
            Ninguna nota se considera definitiva sin la aprobación del médico.
          </SecurityBadge>
          <SecurityBadge icon={<ClipboardCheck size={18} />} title="Consentimiento">
            El uso se enmarca en el consentimiento del paciente.
          </SecurityBadge>
          <SecurityBadge icon={<Eye size={18} />} title="Trazabilidad">
            Registro de generación, revisión y aprobación de cada nota.
          </SecurityBadge>
          <SecurityBadge icon={<Lock size={18} />} title="Roles y permisos">
            Acceso diferenciado para médico, auditoría y administración.
          </SecurityBadge>
        </div>
        <div className="mt-8">
          <Button href="/seguridad" variant="ghost">
            Ver enfoque de seguridad <ArrowRight size={16} />
          </Button>
        </div>
      </Section>

      {/* ===== CASOS DE USO ===== */}
      <Section id="casos">
        <div className="max-w-2xl">
          <Badge tone="neutral" className="mb-4">
            Casos de uso
          </Badge>
          <h2 className="text-3xl font-semibold text-deep md:text-4xl">
            Para distintos servicios del hospital.
          </h2>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={<Stethoscope size={20} />} title="Consulta externa">
            Documentación estructurada por especialidad, lista para revisar y
            exportar.
          </FeatureCard>
          <FeatureCard icon={<Activity size={20} />} title="Urgencias">
            Resumen y evolución ágiles para atención de alto volumen.
          </FeatureCard>
          <FeatureCard icon={<FileText size={20} />} title="Hospitalización">
            Evoluciones consistentes a lo largo de la estancia del paciente.
          </FeatureCard>
          <FeatureCard icon={<Eye size={20} />} title="Auditoría médica">
            Revisión de completitud y codificación con trazabilidad.
          </FeatureCard>
          <FeatureCard icon={<BarChart3 size={20} />} title="Gerencia y calidad">
            Métricas de adopción, carga documental e impacto operativo.
          </FeatureCard>
          <FeatureCard icon={<Layers size={20} />} title="Coordinación clínica">
            Plantillas y formatos homogéneos entre equipos.
          </FeatureCard>
        </div>
        <div className="mt-8">
          <Button href="/casos-de-uso" variant="ghost">
            Ver casos de uso <ArrowRight size={16} />
          </Button>
        </div>
      </Section>

      {/* ===== PILOTO ===== */}
      <Section id="piloto" tone="surface">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <Badge tone="accent" className="mb-4">
              Piloto hospitalario
            </Badge>
            <h2 className="text-3xl font-semibold text-deep md:text-4xl">
              Pruébelo con evidencia propia.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">
              Diseñamos un piloto en un servicio específico, con un grupo
              pequeño de médicos y métricas de antes y después. Una decisión
              basada en datos de su propia institución.
            </p>
            <div className="mt-7">
              <Button
                href={whatsappLink(
                  "Hola, queremos explorar un piloto de Miracle en nuestra institución.",
                )}
                variant="primary"
                size="lg"
              >
                {CTA.primary.label} <ArrowRight size={18} />
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              "Un servicio específico",
              "Un grupo pequeño de médicos",
              "Tiempo de documentación",
              "Adopción y uso real",
              "Calidad de las notas",
              "Feedback del equipo médico",
            ].map((item) => (
              <Card key={item} className="p-4">
                <p className="text-sm font-medium text-deep">{item}</p>
              </Card>
            ))}
          </div>
        </div>
      </Section>

      {/* ===== CTA FINAL ===== */}
      <CTASection />
    </>
  );
}

function ProblemCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Card className="h-full">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-danger-soft text-danger">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-deep">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{text}</p>
    </Card>
  );
}

function DiffCard({
  title,
  text,
  wide = false,
}: {
  title: string;
  text: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-white/10 bg-white/5 p-5 ${
        wide ? "sm:col-span-2" : ""
      }`}
    >
      <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-mist">{text}</p>
    </div>
  );
}
