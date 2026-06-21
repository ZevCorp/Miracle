"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Clock,
  FileText,
  Plus,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useStore } from "@/app/app/providers";
import {
  adoptionByService,
  completitud,
  esDeHoy,
  managementKpis,
  ROLE_LABEL,
  weeklyNotes,
  type Consultation,
} from "@/lib/mock";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/marketing/MetricCard";
import { Badge } from "@/components/ui/Badge";
import { ConsultationCard } from "@/components/app/ConsultationCard";
import { BarList, MiniLine } from "@/components/app/Charts";

export default function DashboardPage() {
  const { consultations, role } = useStore();

  const hoy = consultations.filter((c) => esDeHoy(c.fecha));
  const pendientes = consultations.filter(
    (c) => c.estado === "borrador" || c.estado === "revisada",
  );
  const aprobadas = consultations.filter(
    (c) => c.estado === "aprobada" || c.estado === "exportada",
  );
  const tasaAprob = consultations.length
    ? Math.round((aprobadas.length / consultations.length) * 100)
    : 0;
  const horasAhorradas = Math.round((consultations.length * 6) / 60 * 10) / 10;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge tone="neutral" className="mb-2">
            Vista de {ROLE_LABEL[role]}
          </Badge>
          <h1 className="text-2xl font-semibold text-deep">
            {role === "gerencia"
              ? "Panel institucional"
              : role === "auditor"
                ? "Auditoría de documentación"
                : "Buenos días, Dra. Rincón"}
          </h1>
          <p className="text-sm text-muted">
            {hoy.length} consultas hoy · {pendientes.length} notas pendientes
          </p>
        </div>
        {role === "medico" ? (
          <Link
            href="/app/consultas/nueva"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            <Plus size={16} /> Nueva consulta
          </Link>
        ) : null}
      </div>

      {role === "gerencia" ? (
        <GerenciaView />
      ) : (
        <>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard value={String(hoy.length)} label="Consultas hoy" hint="Atendidas y en curso" />
            <MetricCard value={String(pendientes.length)} label="Notas pendientes" hint="Por revisar o aprobar" />
            <MetricCard value={`~${horasAhorradas} h`} label="Tiempo estimado ahorrado" hint="Estimación ilustrativa" />
            <MetricCard value={`${tasaAprob}%`} label="Notas aprobadas" hint="Del total registrado" />
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-deep">
                  {role === "auditor" ? "Cola de revisión" : "Notas pendientes"}
                </h2>
                <FileText size={18} className="text-muted" />
              </div>
              {pendientes.length ? (
                <div className="space-y-3">
                  {pendientes.slice(0, 4).map((c) => (
                    <ConsultationCard key={c.id} consultation={c} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No hay notas pendientes.</p>
              )}
              <Link
                href="/app/consultas"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                Ver todas las consultas <ArrowRight size={14} />
              </Link>
            </Card>

            <div className="space-y-5">
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-deep">Resumen</h2>
                  <TrendingUp size={18} className="text-muted" />
                </div>
                <div className="space-y-3">
                  <Row icon={<FileText size={16} />} label="Notas registradas" value={String(consultations.length)} />
                  <Row icon={<ShieldCheck size={16} />} label="Aprobadas / exportadas" value={String(aprobadas.length)} />
                  <Row icon={<Clock size={16} />} label="Tiempo ahorrado (est.)" value={`~${horasAhorradas} h`} />
                </div>
              </Card>
              {role === "auditor" ? <AuditorMini consultations={consultations} /> : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-ice-soft text-accent">
        {icon}
      </span>
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="ml-auto text-sm font-semibold text-deep">{value}</span>
    </div>
  );
}

function AuditorMini({ consultations }: { consultations: Consultation[] }) {
  const prom = consultations.length
    ? Math.round(
        consultations.reduce((acc, c) => acc + completitud(c), 0) /
          consultations.length,
      )
    : 0;
  return (
    <Card>
      <h2 className="text-base font-semibold text-deep">Completitud promedio</h2>
      <div className="mt-2 font-display text-3xl font-bold text-deep">{prom}%</div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ice">
        <div className="h-full rounded-full bg-success" style={{ width: `${prom}%` }} />
      </div>
      <Link
        href="/app/auditoria"
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
      >
        Ir a auditoría <ArrowRight size={14} />
      </Link>
    </Card>
  );
}

function GerenciaView() {
  const k = managementKpis;
  return (
    <>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard value={String(k.notasGeneradas)} label="Notas generadas" hint="Últimas 6 semanas" />
        <MetricCard value={`${k.medicosActivos}/${k.medicosTotales}`} label="Médicos activos" hint="Adopción del equipo" />
        <MetricCard value={`~${k.tiempoAhorradoHoras} h`} label="Tiempo ahorrado (est.)" hint="Acumulado ilustrativo" />
        <MetricCard value={`${Math.round(k.completitudPromedio * 100)}%`} label="Completitud documental" hint="Promedio institucional" />
      </div>
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-base font-semibold text-deep">
            Notas generadas por semana
          </h2>
          <MiniLine points={weeklyNotes.map((w) => ({ label: w.semana, value: w.notas }))} height={90} />
        </Card>
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-deep">Adopción por servicio</h2>
            <BarChart3 size={18} className="text-muted" />
          </div>
          <BarList data={adoptionByService.map((a) => ({ label: a.servicio, value: a.notas }))} />
        </Card>
      </div>
      <Link
        href="/app/reportes"
        className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
      >
        Ver reportes completos <ArrowRight size={14} />
      </Link>
    </>
  );
}
