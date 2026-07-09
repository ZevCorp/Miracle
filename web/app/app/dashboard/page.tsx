"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  FileText,
  Mic,
} from "lucide-react";
import { useStore } from "@/app/app/providers";
import {
  adoptionByService,
  completitud,
  esDeHoy,
  managementKpis,
  weeklyNotes,
  type Consultation,
  type Patient,
} from "@/lib/mock";
import { isDemoConsultation } from "@/lib/demo";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/marketing/MetricCard";
import { AgendaHoy } from "@/components/app/AgendaHoy";
import { ConsultationCard } from "@/components/app/ConsultationCard";
import { BarList, MiniLine } from "@/components/app/Charts";

export default function DashboardPage() {
  const { consultations, role, loading } = useStore();

  // Las consultas de demostración no cuentan para el trabajo real del día
  // ni para la cola de firma.
  const reales = useMemo(
    () => consultations.filter((c) => !isDemoConsultation(c)),
    [consultations],
  );
  const hoy = useMemo(() => reales.filter((c) => esDeHoy(c.fecha)), [reales]);
  const pendientes = useMemo(
    () => reales.filter((c) => c.estado === "borrador" || c.estado === "revisada"),
    [reales],
  );

  if (loading) return <DashboardSkeleton />;

  if (role === "admin") return <AdminView />;
  if (role === "supervisor")
    return <SupervisorView consultations={reales} pendientes={pendientes} />;
  return <MedicoView hoy={hoy} pendientes={pendientes} consultations={reales} />;
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl" aria-busy="true" aria-label="Cargando el panel">
      <div className="h-32 animate-pulse rounded-xl bg-ice" />
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="h-64 animate-pulse rounded-lg bg-ice-soft" />
        <div className="space-y-5">
          <div className="h-40 animate-pulse rounded-lg bg-ice-soft" />
          <div className="h-40 animate-pulse rounded-lg bg-ice-soft" />
        </div>
      </div>
    </div>
  );
}

/* ============================ MÉDICO (limpio) ============================ */

function MedicoView({
  hoy,
  pendientes,
  consultations,
}: {
  hoy: Consultation[];
  pendientes: Consultation[];
  consultations: Consultation[];
}) {
  const { getPatient } = useStore();
  const recientes = useMemo(
    () => recentPatients(consultations, 4, getPatient),
    [consultations, getPatient],
  );
  const [citasHoy, setCitasHoy] = useState(0);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Acción principal */}
      <section className="overflow-hidden rounded-xl bg-night p-6 text-white md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white md:text-3xl">
              Tu consulta, sin el papeleo.
            </h1>
            <p className="mt-1.5 text-mist">
              {citasHoy > 0
                ? `Tienes ${citasHoy} ${citasHoy === 1 ? "cita agendada" : "citas agendadas"} hoy`
                : hoy.length > 0
                  ? `Tienes ${hoy.length} ${hoy.length === 1 ? "consulta" : "consultas"} hoy`
                  : "Aún no tienes consultas hoy"}
              {pendientes.length > 0
                ? ` · ${pendientes.length} por revisar`
                : ""}
              .
            </p>
          </div>
          <Link
            href="/app/consultas/nueva"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-surface px-6 py-3.5 text-sm font-semibold text-deep transition-colors hover:bg-ice"
          >
            <Mic size={18} /> Iniciar consulta
          </Link>
        </div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Por revisar y firmar */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-deep">
              Por revisar y firmar
            </h2>
            <FileText size={18} className="text-muted" />
          </div>
          {pendientes.length ? (
            <div className="space-y-3">
              {/* Las más antiguas primero: lo que lleva más tiempo esperando firma. */}
              {[...pendientes]
                .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
                .slice(0, 5)
                .map((c) => (
                  <ConsultationCard key={c.id} consultation={c} />
                ))}
              {pendientes.length > 5 ? (
                <Link
                  href="/app/consultas?estado=borrador"
                  className="block rounded-md border border-dashed border-line px-4 py-2.5 text-center text-sm font-medium text-accent hover:border-mist hover:bg-ice-soft"
                >
                  Ver las {pendientes.length - 5} restantes
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
                <CheckCircle2 size={24} />
              </span>
              <p className="font-medium text-deep">Estás al día</p>
              <p className="text-sm text-muted">No tienes notas pendientes por firmar.</p>
            </div>
          )}
        </Card>

        {/* Lateral: agenda de hoy + pacientes */}
        <div className="space-y-5">
          <AgendaHoy onCountChange={setCitasHoy} />

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-deep">Pacientes recientes</h2>
              <Link href="/app/pacientes" className="text-sm font-medium text-accent hover:underline">
                Ver todos
              </Link>
            </div>
            <ul className="space-y-1">
              {recientes.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/app/pacientes/${p.id}`}
                    className="flex items-center gap-3 rounded-md px-1 py-2 hover:bg-ice-soft"
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-night text-xs font-semibold text-white">
                      {p.nombre.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-deep">
                      {p.nombre}
                    </span>
                    <ChevronRight size={16} className="text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ============================ SUPERVISOR ============================ */

function SupervisorView({
  consultations,
  pendientes,
}: {
  consultations: Consultation[];
  pendientes: Consultation[];
}) {
  const promedio = consultations.length
    ? Math.round(
        consultations.reduce((acc, c) => acc + completitud(c), 0) /
          consultations.length,
      )
    : 0;
  const conDx = consultations.filter(
    (c) => c.codigos.some((k) => k.sistema === "CIE-10" && k.estado === "aceptado"),
  ).length;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-deep">
        Supervisión de documentación
      </h1>
      <p className="text-sm text-muted">{pendientes.length} notas por revisar</p>

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        <MetricCard value={String(pendientes.length)} label="Por revisar" hint="Borrador o revisada" />
        <MetricCard value={`${promedio}%`} label="Completitud promedio" hint="Sobre campos de RIPS" />
        <MetricCard value={`${conDx}/${consultations.length}`} label="Con diagnóstico" hint="CIE-10 aceptado" />
      </div>

      <Card className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-deep">Cola de revisión</h2>
          <Link href="/app/auditoria" className="text-sm font-medium text-accent hover:underline">
            Ir a auditoría
          </Link>
        </div>
        {pendientes.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {pendientes.map((c) => (
              <ConsultationCard key={c.id} consultation={c} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No hay notas pendientes de revisión.</p>
        )}
      </Card>
    </div>
  );
}

/* ============================ ADMIN ============================ */

function AdminView() {
  const k = managementKpis;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-deep">Panel institucional</h1>
        <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">
          Datos de demostración
        </span>
      </div>
      <p className="text-sm text-muted">
        Adopción, tiempo y calidad documental. Las cifras de este panel son
        ilustrativas; se conectarán a los datos reales de tu institución.
      </p>

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
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/app/reportes" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
          Ver reportes completos <ArrowRight size={14} />
        </Link>
        <Link href="/app/usuarios" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
          Gestionar usuarios <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function recentPatients(
  consultations: Consultation[],
  n: number,
  getPatient: (id: string | null | undefined) => Patient | undefined,
) {
  const sorted = [...consultations].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const seen = new Set<string>();
  const out: Patient[] = [];
  for (const c of sorted) {
    if (seen.has(c.pacienteId)) continue;
    seen.add(c.pacienteId);
    const p = getPatient(c.pacienteId);
    if (p) out.push(p);
    if (out.length >= n) break;
  }
  return out;
}
