"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  PenLine,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileSignature,
  FileText,
  Stethoscope,
  Users,
} from "lucide-react";
import { useStore } from "@/app/app/providers";
import {
  completitud,
  type Consultation,
  type NoteSection,
  type Patient,
} from "@/lib/mock";
import { diasDeEspera, esDeHoy } from "@/lib/dates";
import { resolveConsultationIdentity } from "@/lib/clinical/patient-identity";
import { usePeekClick } from "@/components/app/PeekProvider";
import { useRunway } from "@/components/app/SignRunway";
import { useAgendaHoy } from "@/components/app/AgendaHoy";
import { TurnoHUD } from "./TurnoHUD";
import { StartSurface } from "./StartSurface";
import { DayFlow } from "./DayFlow";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/app/StatusBadge";
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
  SectionRule,
} from "@/components/app/AppPage";

export default function DashboardPage() {
  const router = useRouter();
  const { consultations, role, loading } = useStore();
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
        <MedicoView hoy={hoy} pendientes={pendientes} />
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

/* ============================ MEDICO: LA JORNADA ============================ */

/**
 * El Inicio ya no es un panel de administracion: es LA JORNADA del medico.
 * Una sola columna que se lee como el dia mismo: el HUD (fecha, hora viva y
 * los numeros del turno), el orbe que se mantiene pulsado para empezar, el
 * riel del dia con la marca AHORA, y la deuda de firma antes de cerrar.
 *
 * Se fueron: las tarjetas de metricas (el HUD las dice en una linea), los
 * "ultimos pacientes" (Pacientes ahora es un expediente con panel propio) y
 * la caja de agenda separada (el riel la fusiona con las consultas).
 */
function MedicoView({
  hoy,
  pendientes,
}: {
  hoy: Consultation[];
  pendientes: Consultation[];
}) {
  const { getPatient, orgKind, loadError, retryLoad } = useStore();
  const { openRunway } = useRunway();
  const agenda = useAgendaHoy();
  const muestraRotulo = (orgKind ?? "institution") === "institution";

  // El reloj del turno: UN tick de 30 s para el HUD y la marca AHORA del riel.
  // Nace null porque el reloj no puede pintarse en el servidor sin
  // desincronizar la hidratacion; el primer tick llega en el montaje.
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    setAhora(new Date());
    const id = setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const cola = useMemo(
    () => [...pendientes].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
    [pendientes],
  );
  const colaVisibleIds = useMemo(() => cola.slice(0, 4).map((c) => c.id), [cola]);

  // Cuentas del HUD. Atendidas = consultas de hoy + citas atendidas que no
  // tienen su consulta en el store (sin doble conteo del mismo encuentro).
  const idsConsultasHoy = useMemo(() => new Set(hoy.map((c) => c.id)), [hoy]);
  const atendidasHoy =
    hoy.length +
    agenda.citas.filter(
      (c) =>
        c.estado === "atendida" &&
        !(c.clinicalEncounterId && idsConsultasHoy.has(c.clinicalEncounterId)),
    ).length;
  const enAgenda = agenda.citas.filter(
    (c) => c.estado === "programada" || c.estado === "en_curso",
  ).length;

  return (
    <AppPage className="max-w-3xl">
      <TurnoHUD
        ahora={ahora}
        atendidasHoy={atendidasHoy}
        enAgenda={enAgenda}
        porFirmar={cola.length}
        esperaMaxIso={cola[0]?.fecha ?? null}
      />

      <div className="mt-6">
        <StartSurface />
      </div>

      <div className="mt-8">
        <DayFlow ahora={ahora} agenda={agenda} />
      </div>

      <section className="mt-8">
        <SectionRule
          title="Antes de cerrar el dia"
          count={cola.length || undefined}
          action={
            cola.length ? (
              <button
                type="button"
                onClick={() => openRunway(cola.map((c) => c.id))}
                className="clinical-tertiary min-h-9 px-2.5 text-[13px]"
              >
                <PenLine size={14} /> Firmar en serie
              </button>
            ) : null
          }
        />

        {cola.length ? (
          <div className="clinical-list stagger-in">
            {cola.slice(0, 4).map((c) => (
              <SignQueueRow
                key={c.id}
                consultation={c}
                showRotulo={muestraRotulo}
                getPatient={getPatient}
                peekIds={colaVisibleIds}
              />
            ))}
          </div>
        ) : loadError ? (
          /* Sin esto, un fallo de lectura se celebraba como "Estas al dia" -
             justo la respuesta contraria a la verdad. */
          <div className="clinical-panel flex flex-wrap items-center gap-3 px-5 py-4">
            <AlertTriangle size={18} className="shrink-0 text-warning" />
            <p className="min-w-0 flex-1 text-sm text-ink-soft">
              No se pudieron cargar tus notas. No sabemos si tienes pendientes.
            </p>
            <button type="button" onClick={retryLoad} className="clinical-secondary">
              Reintentar
            </button>
          </div>
        ) : (
          <div className="clinical-panel flex items-center gap-3 px-5 py-4">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 size={17} />
            </span>
            <p className="text-sm text-ink-soft">Ninguna nota espera tu firma.</p>
          </div>
        )}
      </section>
    </AppPage>
  );
}

/**
 * Una nota de la cola de firma.
 *
 * La columna que faltaba y era la que importaba: cuánto lleva esperando. En
 * Colombia una historia clínica sin firmar no está cerrada, así que la espera
 * no es un detalle de orden — es el riesgo. Va en monoespaciada para que las
 * filas se comparen en columna, y sube de tono con los días.
 */
function SignQueueRow({
  consultation,
  showRotulo,
  getPatient,
  peekIds,
}: {
  consultation: Consultation;
  showRotulo: boolean;
  getPatient: (id: string | null | undefined) => Patient | undefined;
  /** Ids visibles de la cola: J/K del panel rápido recorre exactamente esto. */
  peekIds: readonly string[];
}) {
  const abrirPeek = usePeekClick(
    { kind: "consultation", id: consultation.id },
    peekIds,
  );
  const identidad = resolveConsultationIdentity(
    getPatient(consultation.pacienteId),
    consultation,
  );
  const rotulo = showRotulo ? rotuloDeNota(consultation.note) : undefined;
  const dias = diasDeEspera(consultation.fecha);
  const tono =
    dias >= 8 ? "text-danger" : dias >= 3 ? "text-warning" : "text-muted";

  return (
    <Link
      href={`/app/consultas/${consultation.id}`}
      onClick={abrirPeek}
      data-light
      className="clinical-list-row flex items-center gap-3 px-4 py-3"
    >
      <Avatar name={identidad.nombre} size="sm" />

      <span className="min-w-0 flex-1">
        <span className="truncate text-sm font-semibold text-deep">
          {identidad.nombre ?? rotulo ?? "Paciente sin identificar"}
        </span>
        <span className="block truncate text-[12px] text-muted">
          {identidad.documento ? (
            <span className="data">{identidad.documento} · </span>
          ) : null}
          {consultation.especialidad}
        </span>
      </span>

      <span className="hidden min-w-0 flex-1 truncate text-[13px] text-ink-soft lg:block">
        {consultation.motivo}
      </span>

      <span className="hidden shrink-0 sm:block">
        <StatusBadge estado={consultation.estado} />
      </span>

      <span className={`data shrink-0 text-right text-[12px] font-semibold ${tono}`}>
        {dias === 0 ? "hoy" : `${dias} d`}
        <span className="sr-only"> esperando firma</span>
      </span>

      <ChevronRight size={16} className="shrink-0 text-muted" />
    </Link>
  );
}

/** Rótulo (número de caso de patología) de una nota, si lo tiene. */
function rotuloDeNota(note: readonly NoteSection[] | undefined) {
  const seccion = note?.find((s) => s.id === "rotulo" || s.titulo === "Rótulo");
  return seccion?.texto?.trim() || undefined;
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
        <Link href="/app/institucion" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
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
