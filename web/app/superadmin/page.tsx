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
import { formatFechaRelativa } from "@/lib/dates";
import { FlashBanner } from "@/components/superadmin/FlashBanner";
import { StatTile } from "@/components/superadmin/charts/StatTile";
import { TrendChart } from "@/components/superadmin/charts/TrendChart";
import { BarList } from "@/components/superadmin/charts/BarList";
import { Sparkline } from "@/components/superadmin/charts/Sparkline";

type Kpi = { value: number; previous?: number; delta_pct: number | null };

type Dashboard = {
  generated_at: string;
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
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const db = await createClient();

  const { data, error: rpcError } = await db.rpc("superadmin_dashboard");
  const dash = (data ?? null) as Dashboard | null;

  if (rpcError || !dash) {
    return (
      <div className="space-y-6">
        <Encabezado />
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

  return (
    <div className="space-y-6">
      <Encabezado generadoEn={dash.generated_at} />
      <FlashBanner ok={ok} error={error} />

      {/* --- Fila de KPIs ------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Consultas esta semana"
          value={kpis.consultas.value}
          deltaPct={kpis.consultas.delta_pct}
          previousLabel="vs. semana anterior"
          spark={spark}
          icon={ClipboardList}
        />
        <StatTile
          label="Médicos trabajando"
          value={kpis.medicos.value}
          deltaPct={kpis.medicos.delta_pct}
          previousLabel="vs. semana anterior"
          spark={sparkAsistente}
          icon={Stethoscope}
        />
        <StatTile
          label="Organizaciones activas"
          value={kpis.organizaciones.value}
          suffix={`de ${kpis.organizaciones.total}`}
          footnote="con consultas en los últimos 30 días"
          icon={Building2}
        />
        <StatTile
          label="Notas sin fallar"
          value={kpis.exito_notas.value === null ? "—" : `${kpis.exito_notas.value}%`}
          footnote={
            kpis.exito_notas.total === 0
              ? "sin actividad del asistente en 30 días"
              : `${kpis.exito_notas.fallidos} fallidas de ${kpis.exito_notas.total} en 30 días`
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
            <span className="text-xs text-muted">Últimos 30 días</span>
          </div>
          <p className="mb-4 text-xs text-muted">
            Las consultas de la web y las del asistente clínico se cuentan aparte: una misma
            atención puede quedar registrada en ambos.
          </p>
          <TrendChart data={serie_diaria} />
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
            ) : null}
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
                <span className="ml-auto shrink-0 text-xs text-muted">
                  {formatFechaRelativa(evento.fecha).split(" · ")[0]}
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
              value: org.consultas_30d,
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
            Consultas de los últimos 30 días. La línea muestra las últimas 8 semanas.
          </p>
        </Card>

        <Card className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Especialidades
          </h2>
          <p className="mb-4 mt-1 text-xs text-muted">Consultas de los últimos 90 días.</p>
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

function Encabezado({ generadoEn }: { generadoEn?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold text-deep">Resumen de la plataforma</h1>
        <p className="text-sm text-muted">
          Cómo va Miracle hoy: volumen, adopción y estado del servicio.
        </p>
      </div>
      {generadoEn ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <Activity size={13} />
          Actualizado {formatFechaRelativa(generadoEn).toLowerCase()}
        </span>
      ) : null}
    </div>
  );
}
