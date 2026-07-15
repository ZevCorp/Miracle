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
import {
  AppPage,
  AppPageHeader,
  ClinicalSectionHeader,
} from "@/components/app/AppPage";

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
    <div className="app-page" aria-busy="true" aria-label="Cargando el panel">
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
    <AppPage>
      {/* Acción principal */}
      <section className="clinical-panel border-l-[3px] border-l-accent p-5 sm:p-6 md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="app-page-kicker">Jornada clínica</p>
            <h1 className="app-page-title">
              Tu día en Miracle
            </h1>
            <p className="mt-2 text-[0.95rem] text-muted">
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
            className="clinical-primary min-h-12 px-5"
          >
            <Mic size={18} /> Iniciar consulta
          </Link>
        </div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Por revisar y firmar */}
        <Card className="shadow-none">
          <ClinicalSectionHeader
            title="Por revisar y firmar"
            action={<FileText size={18} className="text-muted" />}
          />
          {pendientes.length ? (
            <div className="mt-1 divide-y divide-line">
              {/* Las más antiguas primero: lo que lleva más tiempo esperando firma. */}
              {[...pendientes]
                .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
                .slice(0, 5)
                .map((c) => (
                  <ConsultationCard
                    key={c.id}
                    consultation={c}
                    presentation="row"
                  />
                ))}
              {pendientes.length > 5 ? (
                <Link
                  href="/app/consultas?estado=borrador"
                  className="mt-3 block rounded-[10px] border border-dashed border-line px-4 py-2.5 text-center text-sm font-semibold text-accent hover:border-mist hover:bg-ice-soft"
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

          <Card className="shadow-none">
            <ClinicalSectionHeader
              title="Pacientes recientes"
              action={
                <Link
                  href="/app/pacientes"
                  className="text-sm font-semibold text-accent hover:underline"
                >
                  Ver todos
                </Link>
              }
            />
            <ul className="space-y-1">
              {recientes.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/app/pacientes/${p.id}`}
                    className="flex min-h-12 items-center gap-3 rounded-[10px] px-1 py-2 hover:bg-ice-soft"
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
    </AppPage>
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
    <AppPage>
      <AppPageHeader
        kicker="Supervisión"
        title="Documentación clínica"
        description={`${pendientes.length} notas por revisar`}
      />

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
    </AppPage>
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
    <AppPage>
      <AppPageHeader
        kicker="Institución"
        title="Actividad clínica"
        description="Volumen y calidad documental de las consultas recientes."
      />

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
    </AppPage>
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
