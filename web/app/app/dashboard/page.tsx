"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileSignature,
  FileText,
  Mic,
  Stethoscope,
  Users,
} from "lucide-react";
import { useStore } from "@/app/app/providers";
import {
  completitud,
  type Consultation,
  type Patient,
} from "@/lib/mock";
import { esDeHoy } from "@/lib/dates";
import { isDemoConsultation } from "@/lib/demo";
import { createClient } from "@/lib/supabase/client";
import {
  comparacion,
  comparacionPorcentaje,
  DASHBOARD_VACIO,
  etiquetaEstado,
  fetchHospitalDashboard,
  type HospitalDashboard,
} from "@/lib/hospital/dashboard";
import { etiquetaPeriodoAnterior, resolverRango } from "@/lib/superadmin/rango";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/marketing/MetricCard";
import { AgendaHoy } from "@/components/app/AgendaHoy";
import { ConsultationCard } from "@/components/app/ConsultationCard";
import { BarList } from "@/components/app/Charts";
import { DailyTrend } from "@/components/app/DailyTrend";
import { AdoptionTable, AdoptionFooterLink } from "@/components/app/AdoptionTable";
import { StatTile } from "@/components/superadmin/charts/StatTile";
import { RangePicker } from "@/components/superadmin/RangePicker";
import {
  AppPage,
  AppPageHeader,
  ClinicalSectionHeader,
} from "@/components/app/AppPage";

export default function DashboardPage() {
  const router = useRouter();
  const { consultations, role, isDemo, loading } = useStore();
  const searchParams = useSearchParams();

  // La cuenta demo siempre abre en el panel del médico, que es lo que se
  // muestra al vender. Ya no hace falta corregirlo aquí: el store recibe
  // `uiRole` desde el layout, que para la demo ya es "medico".
  const viewRole = role;

  // La secretaría no tiene un panel propio: su única sección es "Consultas".
  // Se saca de aquí apenas se conoce el rol, antes de armar ninguna métrica.
  useEffect(() => {
    if (role === "secretaria") router.replace("/app/consultas");
  }, [role, router]);

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

  if (loading || role === "secretaria") return <DashboardSkeleton />;

  // El proxy rebota aquí a quien abre una sección que su rol no alcanza
  // (proxy.ts) con ?error=forbidden. Hasta ahora ese parámetro solo tenía
  // mensaje en /login, así que el usuario aterrizaba en el panel sin ninguna
  // explicación de por qué se le movió la pantalla.
  const rebotado = searchParams.get("error") === "forbidden";

  return (
    <>
      {rebotado ? <ForbiddenNotice /> : null}
      {viewRole === "admin" ? (
        <AdminView />
      ) : viewRole === "supervisor" ? (
        <SupervisorView consultations={reales} pendientes={pendientes} />
      ) : (
        <MedicoView hoy={hoy} pendientes={pendientes} consultations={reales} />
      )}
    </>
  );
}

/** Aviso del rebote por permisos. Va sobre el panel, no lo reemplaza. */
function ForbiddenNotice() {
  return (
    <div className="app-page pb-0">
      <div
        role="status"
        className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning"
      >
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <span>
          Tu cuenta no tiene permiso para abrir esa sección, así que te trajimos
          a tu panel.
        </span>
      </div>
    </div>
  );
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
  const { getPatient, orgKind, loadError, retryLoad } = useStore();
  // El rótulo es propio de una institución; ante orgKind desconocido se asume
  // institución, igual que en visibleAppNav (lib/site.ts).
  const muestraRotulo = (orgKind ?? "institution") === "institution";
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
                    showRotulo={muestraRotulo}
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
          ) : loadError ? (
            /* Sin esto, un fallo de lectura se celebraba como "Estás al día" —
               justo la respuesta contraria a la verdad. */
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning">
                <AlertTriangle size={24} />
              </span>
              <p className="font-medium text-deep">No se pudieron cargar tus notas</p>
              <p className="text-sm text-muted">
                No sabemos si tienes pendientes: no fue posible leerlas.
              </p>
              <button type="button" onClick={retryLoad} className="clinical-secondary mt-1">
                Reintentar
              </button>
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
  const { orgKind } = useStore();
  const muestraRotulo = (orgKind ?? "institution") === "institution";
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
              <ConsultationCard key={c.id} consultation={c} showRotulo={muestraRotulo} />
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
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  // El periodo vive en la URL (?rango=7|30|90|365 o ?rango=custom&desde&hasta),
  // igual que en la consola de plataforma: así el enlace se puede compartir y
  // sobrevive a un refresco. Una URL inválida cae al rango por defecto.
  const rango = useMemo(
    () =>
      resolverRango({
        rango: searchParams.get("rango") ?? undefined,
        desde: searchParams.get("desde") ?? undefined,
        hasta: searchParams.get("hasta") ?? undefined,
      }),
    [searchParams],
  );

  // El resultado se guarda junto a la ventana que lo produjo. Así "cargando" no
  // es una bandera aparte que haya que recordar bajar, sino simplemente que lo
  // que hay en memoria no corresponde al rango pedido — y de paso se evita
  // mostrar las cifras del periodo anterior mientras llega el nuevo.
  const clave = `${rango.desde}:${rango.hasta}`;
  const [cargado, setCargado] = useState<{
    clave: string;
    data: HospitalDashboard;
    error: string | null;
  } | null>(null);

  // Las cifras se calculan en la base (RPC hospital_dashboard), no sobre el
  // store: el store está capado a 300 consultas y por encima de ese número los
  // totales del panel se congelaban sin avisar.
  useEffect(() => {
    let vigente = true;
    void fetchHospitalDashboard(supabase, rango).then((res) => {
      if (!vigente) return;
      setCargado({ clave, data: res.data, error: res.error });
    });
    return () => {
      vigente = false;
    };
  }, [supabase, rango, clave]);

  const alDia = cargado?.clave === clave;
  const cargando = !alDia;
  const data = alDia ? cargado.data : DASHBOARD_VACIO;
  const error = alDia ? cargado.error : null;

  const { kpis } = data;
  const spark = data.serie_diaria.map((d) => d.consultas);
  const previo = etiquetaPeriodoAnterior(rango);
  const sinHistorico = !cargando && kpis.total_historico.value === 0;

  return (
    <AppPage>
      <AppPageHeader
        kicker="Institución"
        title="Actividad clínica"
        description={
          sinHistorico
            ? "Volumen y calidad documental de tu institución."
            : `${kpis.total_historico.value.toLocaleString("es-CO")} notas en total · ${rango.etiqueta.toLowerCase()} en pantalla`
        }
        action={<RangePicker basePath="/app/dashboard" rango={rango} />}
      />

      {error ? (
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>No fue posible calcular las métricas: {error}</span>
        </div>
      ) : null}

      {sinHistorico ? (
        <div className="mt-6 rounded-lg border border-dashed border-line bg-surface p-8 text-center">
          <p className="font-semibold text-deep">Aún no hay consultas registradas</p>
          <p className="mt-1 text-sm text-muted">
            Cuando el equipo genere notas, aquí verás la actividad de la
            institución.
          </p>
          <Link
            href="/app/usuarios"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
          >
            Registrar profesionales <ArrowRight size={14} />
          </Link>
        </div>
      ) : cargando ? (
        <AdminSkeleton />
      ) : (
        <>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Notas del periodo"
              value={kpis.consultas.value.toLocaleString("es-CO")}
              spark={spark}
              icon={ClipboardList}
              {...comparacion(kpis.consultas, previo)}
            />
            <StatTile
              label="Profesionales activos"
              value={kpis.medicos_activos.value}
              icon={Stethoscope}
              {...comparacion(kpis.medicos_activos, previo)}
              footnote={`de ${data.por_medico.length} registrados`}
            />
            <StatTile
              label="Pacientes atendidos"
              value={kpis.pacientes.value.toLocaleString("es-CO")}
              icon={Users}
              {...comparacion(kpis.pacientes, previo)}
            />
            <StatTile
              label="Completitud documental"
              value={kpis.completitud.value}
              suffix="%"
              icon={FileSignature}
              {...comparacionPorcentaje(kpis.completitud)}
            />
          </div>

          {/* La cola de firma no es una tarjeta más: es lo único de esta
              pantalla sobre lo que se puede actuar hoy, y se mide sobre todo el
              histórico (una nota sin firmar de hace tres meses sigue pendiente
              aunque el rango sea de 7 días). */}
          {kpis.por_firmar.value > 0 ? (
            <Link
              href="/app/auditoria"
              className="mt-5 flex items-center justify-between gap-4 rounded-[14px] border border-warning/40 bg-warning-soft px-5 py-4 hover:border-warning"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="mt-0.5 shrink-0 text-warning" />
                <div>
                  <p className="font-semibold text-deep">
                    {kpis.por_firmar.value}{" "}
                    {kpis.por_firmar.value === 1
                      ? "nota sin firmar"
                      : "notas sin firmar"}
                  </p>
                  <p className="text-sm text-muted">
                    Pendientes en toda la institución, de cualquier fecha.
                  </p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-accent">
                Revisar <ArrowRight size={14} />
              </span>
            </Link>
          ) : null}

          <Card className="mt-8">
            <ClinicalSectionHeader title={`Notas por día · ${rango.etiqueta}`} />
            <DailyTrend data={data.serie_diaria} periodo={rango.etiqueta.toLowerCase()} />
          </Card>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-deep">Por servicio</h2>
                <BarChart3 size={18} className="text-muted" />
              </div>
              <BarList
                data={data.por_servicio.map((s) => ({
                  label: s.servicio,
                  value: s.value,
                }))}
              />
              {data.por_servicio.length === 0 ? (
                <p className="text-sm text-muted">Sin servicios registrados aún.</p>
              ) : null}
            </Card>

            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-deep">Estado documental</h2>
                <FileText size={18} className="text-muted" />
              </div>
              <BarList
                data={data.por_estado.map((e) => ({
                  label: etiquetaEstado(e.estado),
                  value: e.value,
                }))}
              />
              {data.por_estado.length === 0 ? (
                <p className="text-sm text-muted">Sin notas en este periodo.</p>
              ) : null}
            </Card>
          </div>

          <Card className="mt-5">
            <ClinicalSectionHeader title="Adopción por profesional" />
            <AdoptionTable
              medicos={data.por_medico}
              max={6}
              hrefDe={(m) => `/app/consultas?medico=${m.medico_id}`}
            />
            <AdoptionFooterLink href="/app/reportes" />
          </Card>
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-4">
        <Link href="/app/reportes" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
          Ver reportes completos <ArrowRight size={14} />
        </Link>
        <Link href="/app/usuarios" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
          Gestionar usuarios <ArrowRight size={14} />
        </Link>
        <Link href="/app/configuracion" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
          Configuración institucional <ArrowRight size={14} />
        </Link>
      </div>
    </AppPage>
  );
}

/** Esqueleto del panel institucional mientras la RPC responde. */
function AdminSkeleton() {
  return (
    <div aria-busy="true" aria-label="Calculando métricas">
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[116px] animate-pulse rounded-[14px] bg-ice-soft" />
        ))}
      </div>
      <div className="mt-8 h-64 animate-pulse rounded-[14px] bg-ice-soft" />
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="h-52 animate-pulse rounded-[14px] bg-ice-soft" />
        <div className="h-52 animate-pulse rounded-[14px] bg-ice-soft" />
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
