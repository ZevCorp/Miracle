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
  completitud,
  esDeHoy,
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
  const { consultations } = useStore();

  // Métricas calculadas desde las consultas REALES de la organización (RLS),
  // excluyendo las de demostración. Reflejan la actividad reciente cargada
  // (la carga del store está acotada), no cifras inventadas.
  const reales = useMemo(
    () => consultations.filter((c) => !isDemoConsultation(c)),
    [consultations],
  );

  const notasGeneradas = reales.length;
  const medicosActivos = useMemo(
    () => new Set(reales.map((c) => c.medicoId).filter(Boolean)).size,
    [reales],
  );
  const pacientesAtendidos = useMemo(
    () => new Set(reales.map((c) => c.pacienteId).filter(Boolean)).size,
    [reales],
  );
  const completitudProm = useMemo(() => {
    if (!reales.length) return 0;
    const suma = reales.reduce((acc, c) => acc + completitud(c), 0);
    return Math.round(suma / reales.length);
  }, [reales]);

  const porSemana = useMemo(() => weeklyCounts(reales), [reales]);
  const porServicio = useMemo(() => countByService(reales), [reales]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-deep">Panel institucional</h1>
        <span className="rounded-full bg-mint-soft px-3 py-1 text-xs font-semibold text-success">
          Datos de tu institución
        </span>
      </div>
      <p className="text-sm text-muted">
        Actividad y calidad documental de tu organización, sobre las consultas
        recientes registradas.
      </p>

      {notasGeneradas === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-line bg-surface p-8 text-center">
          <p className="font-semibold text-deep">Aún no hay consultas registradas</p>
          <p className="mt-1 text-sm text-muted">
            Cuando el equipo genere notas, aquí verás la actividad de la
            institución.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard value={String(notasGeneradas)} label="Notas registradas" hint="Consultas recientes" />
            <MetricCard value={String(medicosActivos)} label="Médicos con actividad" hint="Generaron notas" />
            <MetricCard value={String(pacientesAtendidos)} label="Pacientes atendidos" hint="Identificados" />
            <MetricCard value={`${completitudProm}%`} label="Completitud documental" hint="Promedio de la organización" />
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <Card>
              <h2 className="mb-4 text-base font-semibold text-deep">
                Notas por semana
              </h2>
              <MiniLine points={porSemana} height={90} />
            </Card>
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-deep">Por servicio</h2>
                <BarChart3 size={18} className="text-muted" />
              </div>
              {porServicio.length ? (
                <BarList data={porServicio} />
              ) : (
                <p className="text-sm text-muted">Sin servicios registrados aún.</p>
              )}
            </Card>
          </div>
        </>
      )}

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

/** Histograma de notas de las últimas `weeks` semanas, de más antigua a más reciente. */
function weeklyCounts(
  consultas: Consultation[],
  weeks = 6,
): { label: string; value: number }[] {
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const buckets = Array.from({ length: weeks }, () => 0);
  for (const c of consultas) {
    const t = new Date(c.fecha).getTime();
    if (Number.isNaN(t)) continue;
    const ago = Math.floor((now - t) / WEEK);
    if (ago >= 0 && ago < weeks) buckets[weeks - 1 - ago] += 1;
  }
  return buckets.map((value, i) => ({
    label: i === weeks - 1 ? "Esta sem." : `-${weeks - 1 - i}`,
    value,
  }));
}

/** Conteo de consultas por servicio, top 6, de mayor a menor. */
function countByService(
  consultas: Consultation[],
): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const c of consultas) {
    const key = c.servicio?.trim() || "Sin servicio";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));
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
