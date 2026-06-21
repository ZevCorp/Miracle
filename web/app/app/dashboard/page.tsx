"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
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
  formatFechaRelativa,
  managementKpis,
  patientById,
  weeklyNotes,
  type Consultation,
} from "@/lib/mock";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/marketing/MetricCard";
import { ConsultationCard } from "@/components/app/ConsultationCard";
import { StatusBadge } from "@/components/app/StatusBadge";
import { BarList, MiniLine } from "@/components/app/Charts";

export default function DashboardPage() {
  const { consultations, role } = useStore();

  const hoy = consultations.filter((c) => esDeHoy(c.fecha));
  const pendientes = consultations.filter(
    (c) => c.estado === "borrador" || c.estado === "revisada",
  );

  if (role === "admin") return <AdminView />;
  if (role === "supervisor")
    return <SupervisorView consultations={consultations} pendientes={pendientes} />;
  return <MedicoView hoy={hoy} pendientes={pendientes} consultations={consultations} />;
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
  const recientes = recentPatients(consultations, 4);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Acción principal */}
      <section className="overflow-hidden rounded-xl bg-deep p-6 text-white md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white md:text-3xl">
              ¿Listo para atender?
            </h1>
            <p className="mt-1.5 text-mist">
              {hoy.length > 0
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
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-deep transition-colors hover:bg-ice"
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
              {pendientes.map((c) => (
                <ConsultationCard key={c.id} consultation={c} />
              ))}
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

        {/* Lateral: hoy + pacientes */}
        <div className="space-y-5">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-deep">Consultas de hoy</h2>
              <CalendarDays size={18} className="text-muted" />
            </div>
            {hoy.length ? (
              <ul className="divide-y divide-line">
                {hoy.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/app/consultas/${c.id}`}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-deep">
                          {patientById(c.pacienteId)?.nombre}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {formatFechaRelativa(c.fecha)}
                        </span>
                      </span>
                      <StatusBadge estado={c.estado} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-sm text-muted">Sin consultas registradas hoy.</p>
            )}
          </Card>

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
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-deep text-xs font-semibold text-white">
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
      <h1 className="text-2xl font-semibold text-deep">Panel institucional</h1>
      <p className="text-sm text-muted">Adopción, tiempo y calidad documental.</p>

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

function recentPatients(consultations: Consultation[], n: number) {
  const sorted = [...consultations].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const seen = new Set<string>();
  const out = [];
  for (const c of sorted) {
    if (seen.has(c.pacienteId)) continue;
    seen.add(c.pacienteId);
    const p = patientById(c.pacienteId);
    if (p) out.push(p);
    if (out.length >= n) break;
  }
  return out;
}
