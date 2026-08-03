import Link from "next/link";
import {
  Activity,
  Building2,
  ClipboardList,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { formatFechaHora, formatFechaRelativa } from "@/lib/dates";
import { FlashBanner } from "@/components/superadmin/FlashBanner";
import { StatTile } from "@/components/superadmin/charts/StatTile";
import { TrendChart } from "@/components/superadmin/charts/TrendChart";
import { BarList } from "@/components/superadmin/charts/BarList";
import { Sparkline } from "@/components/superadmin/charts/Sparkline";
import { RangePicker } from "@/components/superadmin/RangePicker";
import { AutoRefresh } from "@/components/superadmin/AutoRefresh";
import {
  etiquetaPeriodoAnterior,
  resolverRango,
  type RangoResuelto,
} from "@/lib/superadmin/rango";

type Kpi = { value: number; previous?: number; delta_pct: number | null };

type Dashboard = {
  generated_at: string;
  /** Ventana que la RPC resolvió de verdad (puede diferir de la pedida). */
  rango: { desde: string; hasta: string; dias: number };
  kpis: {
    consultas: Kpi;
    medicos: Kpi;
    organizaciones: { value: number; total: number };
    exito_notas: { value: number | null; fallidos: number; total: number };
  };
  serie_diaria: { date: string; consultations: number; encounters: number }[];
  organizaciones: {
    id: string;
    name: string;
    kind: string;
    nit: string | null;
    members: number;
    members_active_30d: number;
    consultas_total: number;
    /** Consultas dentro del rango elegido. Es lo que manda el selector. */
    consultas_rango: number;
    consultas_30d: number;
    consultas_7d: number;
    last_activity_at: string | null;
    weekly: number[];
  }[];
  especialidades: { name: string; count: number }[];
  actividad_reciente: {
    id: string;
    accion: string;
    actor: string | null;
    organizacion: string | null;
    fecha: string;
  }[];
  salud: {
    encounters_stuck: number;
    encounters_failed: number;
  };
};

export default async function SuperadminResumenPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    error?: string;
    rango?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const sp = await searchParams;
  const { ok, error } = sp;
  const db = await createClient();

  const rango = resolverRango(sp);
  const { data, error: rpcError } = await db.rpc("superadmin_dashboard", rango.rpcArgs);
  const dash = (data ?? null) as Dashboard | null;

  if (rpcError || !dash) {
    return (
      <div className="space-y-6">
        <Encabezado rango={rango} />
        <FlashBanner ok={ok} error={error} />
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          No fue posible cargar las métricas. Verifica que la migración{" "}
          <code>superadmin_dashboard</code> esté aplicada en la base.
        </div>
      </div>
    );
  }

  const { kpis, serie_diaria, organizaciones, especialidades, actividad_reciente, salud } = dash;

  // La sparkline de las tarjetas usa los últimos 14 días: suficiente para ver
  // la forma sin convertir la microtendencia en una gráfica en miniatura.
  const spark = serie_diaria.slice(-14).map((d) => d.consultations);
  const sparkAsistente = serie_diaria.slice(-14).map((d) => d.encounters);

  const orgsConActividad = organizaciones.filter((o) => o.consultas_total > 0);
  const alertas = salud.encounters_failed + salud.encounters_stuck;

  // Etiquetas derivadas del rango: nada de textos fijos "últimos 30 días", que
  // mentirían en cuanto se cambia el periodo.
  const periodo = rango.etiqueta.toLowerCase();
  const comparativa = etiquetaPeriodoAnterior(rango);

  return (
    <div className="space-y-6">
      <Encabezado generadoEn={dash.generated_at} rango={rango} />
      <FlashBanner ok={ok} error={error} />

      {/* --- Fila de KPIs ------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Consultas del periodo"
          value={kpis.consultas.value}
          deltaPct={kpis.consultas.delta_pct}
          previousLabel={comparativa}
          spark={spark}
          icon={ClipboardList}
        />
        <StatTile
          label="Médicos trabajando"
          value={kpis.medicos.value}
          deltaPct={kpis.medicos.delta_pct}
          previousLabel={comparativa}
          spark={sparkAsistente}
          icon={Stethoscope}
        />
        <StatTile
          label="Organizaciones activas"
          value={kpis.organizaciones.value}
          suffix={`de ${kpis.organizaciones.total}`}
          footnote={`con consultas en ${periodo}`}
          icon={Building2}
        />
        <StatTile
          label="Notas sin fallar"
          value={kpis.exito_notas.value === null ? "—" : `${kpis.exito_notas.value}%`}
          footnote={
            kpis.exito_notas.total === 0
              ? `sin actividad del asistente en ${periodo}`
              : `${kpis.exito_notas.fallidos} fallidas de ${kpis.exito_notas.total}`
          }
          icon={ShieldCheck}
        />
      </div>

      {/* --- Gráfica principal + actividad -------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-[1.75fr_1fr]">
        {/* min-w-0: sin esto la gráfica, que tiene ancho mínimo propio para que
            sus ejes sigan siendo legibles, estira la tarjeta y desborda la página. */}
        <Card className="min-w-0">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Atenciones por día
            </h2>
            <span className="text-xs text-muted">{rango.etiqueta}</span>
          </div>
          <p className="mb-4 text-xs text-muted">
            Las consultas de la web y las del asistente clínico se cuentan aparte: una misma
            atención puede quedar registrada en ambos.
          </p>
          <TrendChart data={serie_diaria} periodo={periodo} />
        </Card>

        <Card className="flex min-w-0 flex-col">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Actividad reciente
            </h2>
            {alertas > 0 ? (
              <Link href="/superadmin/salud" className="text-xs font-semibold text-warning hover:underline">
                {alertas} por revisar →
              </Link>
            ) : (
              <Link
                href="/superadmin/actividad"
                className="text-xs font-semibold text-accent hover:underline"
              >
                Ver todo →
              </Link>
            )}
          </div>

          <ul className="mt-4 min-h-0 flex-1 space-y-3.5 overflow-hidden">
            {actividad_reciente.slice(0, 8).map((evento) => (
              <li key={evento.id} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-serie-1)]" />
                <div className="min-w-0">
                  <div className="truncate text-sm text-deep">{evento.accion}</div>
                  <div className="truncate text-xs text-muted">
                    {evento.actor ?? "Sistema"}
                    {evento.organizacion ? ` · ${evento.organizacion}` : ""}
                  </div>
                </div>
                {/* La etiqueta completa, no solo el día: con `.split(" · ")[0]`
                    todas las filas de hoy decían "Hoy" y la lista quedaba sin
                    orden legible. El título lleva la fecha larga al pasar el
                    ratón, para los eventos de hace semanas. */}
                <span
                  className="ml-auto shrink-0 text-xs text-muted"
                  title={formatFechaHora(evento.fecha)}
                >
                  {formatFechaRelativa(evento.fecha)}
                </span>
              </li>
            ))}
            {actividad_reciente.length === 0 ? (
              <li className="text-sm text-muted">Sin eventos registrados.</li>
            ) : null}
          </ul>
        </Card>
      </div>

      {/* --- Organizaciones + especialidades ------------------------------ */}
      <div className="grid gap-4 xl:grid-cols-[1.75fr_1fr]">
        <Card className="min-w-0">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Organizaciones por volumen
            </h2>
            <Link
              href="/superadmin/organizaciones"
              className="text-xs font-semibold text-accent hover:underline"
            >
              Ver todas →
            </Link>
          </div>
          <BarList
            items={orgsConActividad.slice(0, 6).map((org) => ({
              label: org.name,
              value: org.consultas_rango,
              hint: `${org.members_active_30d}/${org.members} activos`,
              href: `/superadmin/organizaciones/${org.id}`,
            }))}
            emptyLabel="Ninguna organización ha registrado consultas."
            trailing={(_, index) => {
              const org = orgsConActividad[index];
              return org?.weekly?.length ? (
                <Sparkline
                  values={org.weekly}
                  width={64}
                  height={20}
                  label={`Tendencia de ${org.name}`}
                />
              ) : null;
            }}
          />
          <p className="mt-4 text-xs text-muted">
            Consultas de {periodo}. La línea muestra las últimas 8 semanas, siempre.
          </p>
        </Card>

        <Card className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Especialidades
          </h2>
          <p className="mb-4 mt-1 text-xs text-muted">Consultas de {periodo}.</p>
          <BarList
            items={especialidades.map((e) => ({ label: e.name, value: e.count }))}
            emptyLabel="Sin consultas registradas."
          />
        </Card>
      </div>

      {/* --- Tabla de organizaciones -------------------------------------- */}
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Todas las organizaciones
          </h2>
        </div>
        <div className="hidden grid-cols-[1.8fr_.8fr_.7fr_.7fr_1fr] gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted sm:grid">
          <span>Organización</span>
          <span>Tipo</span>
          <span className="text-center">Miembros</span>
          <span className="text-center">Consultas</span>
          <span>Última actividad</span>
        </div>
        {organizaciones.map((org, index) => (
          <Link
            key={org.id}
            href={`/superadmin/organizaciones/${org.id}`}
            className={`grid grid-cols-2 gap-3 px-5 py-4 transition-colors hover:bg-ice-soft sm:grid-cols-[1.8fr_.8fr_.7fr_.7fr_1fr] sm:items-center sm:gap-4 ${
              index ? "border-t border-line" : ""
            }`}
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-deep">{org.name}</div>
              {org.nit ? <div className="truncate text-sm text-muted">NIT {org.nit}</div> : null}
            </div>
            <div>
              <Badge tone={org.kind === "institution" ? "mint" : "neutral"}>
                {org.kind === "institution" ? "Hospital" : "Personal"}
              </Badge>
            </div>
            <div className="text-sm text-deep sm:text-center">
              {org.members_active_30d}
              <span className="text-muted">/{org.members}</span>
            </div>
            <div className="text-sm text-deep sm:text-center">{org.consultas_total}</div>
            <div className="text-sm text-muted">
              {org.last_activity_at ? formatFechaRelativa(org.last_activity_at) : "Sin actividad"}
            </div>
          </Link>
        ))}
        {organizaciones.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted">Aún no hay organizaciones.</div>
        ) : null}
      </div>
    </div>
  );
}

function Encabezado({
  generadoEn,
  rango,
}: {
  generadoEn?: string;
  rango: RangoResuelto;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-deep">
            Resumen de la plataforma
          </h1>
          <p className="text-sm text-muted">
            Cómo va Miracle hoy: volumen, adopción y estado del servicio.
          </p>
        </div>
        {generadoEn ? <AutoRefresh generadoEn={generadoEn} /> : null}
      </div>
      <RangePicker basePath="/superadmin" rango={rango} />
    </div>
  );
}
