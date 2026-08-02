import {
  AlertTriangle,
  HeartPulse,
  MonitorSmartphone,
  MonitorX,
  Send,
  ShieldCheck,
  Smartphone,
  TimerOff,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { formatFechaRelativa } from "@/lib/dates";
import { StatTile } from "@/components/superadmin/charts/StatTile";
import { BarList } from "@/components/superadmin/charts/BarList";
import { DeviceTable, type DeviceRow } from "@/components/superadmin/DeviceTable";
import {
  ENCOUNTER_PIPELINE_ORDER,
  ENCOUNTER_STATUS_LABEL,
  type ActivityPayload,
} from "@/lib/superadmin/usuarios";

// Bloques de `superadmin_dashboard` que consume esta página.
type DashboardSalud = {
  kpis: { exito_notas: { value: number | null; fallidos: number; total: number } };
  salud: {
    encounters_funnel: { status: string; count: number }[];
    consultas_por_estado: { estado: string; count: number }[];
    exports: { status: string; count: number }[];
    encounters_stuck: number;
    encounters_failed: number;
  };
  dispositivos: {
    windows: {
      email: string;
      display_name: string | null;
      app_version: string | null;
      machine_name: string | null;
      os_version: string | null;
      last_seen_at: string | null;
    }[];
    moviles: {
      display_name: string | null;
      device_model: string | null;
      app_version: string | null;
      last_seen_at: string | null;
    }[];
  };
};

const ESTADO_WEB_LABEL: Record<string, string> = {
  en_curso: "En curso",
  borrador: "Borrador",
  revisada: "Revisada",
  aprobada: "Aprobada",
  exportada: "Exportada",
};

const EXPORT_STATUS_LABEL: Record<string, string> = {
  pending: "En cola",
  claimed: "En proceso",
  completed: "Completadas",
  needs_doctor: "Requieren al médico",
  failed: "Fallidas",
  cancelled: "Canceladas",
};

// Comparación de versiones "1.2.3" por segmentos numéricos; suficiente para
// marcar instalaciones viejas sin arrastrar una librería de semver.
function versionLessThan(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => Number(n) || 0);
  const pb = b.split(".").map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da < db;
  }
  return false;
}

function latestVersion(versions: (string | null | undefined)[]): string | null {
  let max: string | null = null;
  for (const v of versions) {
    if (!v) continue;
    if (max === null || versionLessThan(max, v)) max = v;
  }
  return max;
}

export default async function SuperadminSaludPage() {
  const db = await createClient();

  const [dashRes, activityRes] = await Promise.all([
    db.rpc("superadmin_dashboard"),
    db.rpc("superadmin_activity"),
  ]);
  const dash = (dashRes.data ?? null) as DashboardSalud | null;
  const activity = (activityRes.data ?? null) as ActivityPayload | null;

  if (dashRes.error || !dash) {
    return (
      <div className="space-y-6">
        <Encabezado />
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          No fue posible cargar el estado del servicio. Verifica que la migración{" "}
          <code>superadmin_dashboard</code> esté aplicada en la base.
        </div>
      </div>
    );
  }

  const { salud, dispositivos, kpis } = dash;

  // Embudo en orden de pipeline, no de conteo: la forma cuenta la historia.
  const funnelByStatus = new Map(salud.encounters_funnel.map((f) => [f.status, f.count]));
  const funnelItems = ENCOUNTER_PIPELINE_ORDER.filter((status) =>
    funnelByStatus.has(status),
  ).map((status) => ({
    label: ENCOUNTER_STATUS_LABEL[status] ?? status,
    value: funnelByStatus.get(status) ?? 0,
    color: status === "failed" ? "var(--color-danger-solid)" : undefined,
  }));

  const exportsFallidos = salud.exports
    .filter((e) => e.status === "failed" || e.status === "needs_doctor")
    .reduce((sum, e) => sum + e.count, 0);
  const exportsTotal = salud.exports.reduce((sum, e) => sum + e.count, 0);

  const versionWindows = latestVersion(dispositivos.windows.map((d) => d.app_version));
  const filasWindows: DeviceRow[] = dispositivos.windows.map((d) => ({
    primary: d.display_name || d.email,
    secondary: [d.machine_name, d.os_version].filter(Boolean).join(" · ") || d.email,
    version: d.app_version,
    versionOutdated: Boolean(
      d.app_version && versionWindows && versionLessThan(d.app_version, versionWindows),
    ),
    lastSeenAt: d.last_seen_at,
  }));

  const versionMovil = latestVersion(dispositivos.moviles.map((d) => d.app_version));
  const filasMoviles: DeviceRow[] = dispositivos.moviles.map((d) => ({
    primary: d.display_name || "Dispositivo sin nombre",
    secondary: d.device_model,
    version: d.app_version,
    versionOutdated: Boolean(
      d.app_version && versionMovil && versionLessThan(d.app_version, versionMovil),
    ),
    lastSeenAt: d.last_seen_at,
  }));

  return (
    <div className="space-y-6">
      <Encabezado />

      {/* --- KPIs de salud ------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Consultas sin terminar"
          value={salud.encounters_stuck}
          footnote="más de un día abiertas en el asistente"
          icon={TimerOff}
          invertido
        />
        <StatTile
          label="Notas fallidas"
          value={salud.encounters_failed}
          footnote="la generación no pudo completarse"
          icon={AlertTriangle}
          invertido
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
        <StatTile
          label="Exportaciones con problema"
          value={exportsFallidos}
          footnote={
            exportsTotal === 0
              ? "la exportación al HIS aún no se estrena"
              : `de ${exportsTotal} solicitadas`
          }
          icon={Send}
          invertido
        />
      </div>

      {/* --- Embudo + atención --------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Embudo del asistente clínico
          </h2>
          <p className="mb-4 mt-1 text-xs text-muted">
            Dónde están las consultas dictadas: de creada a completada.
          </p>
          <BarList
            items={funnelItems}
            emptyLabel="Sin consultas en el asistente todavía."
          />
        </Card>

        <Card className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <AlertTriangle size={15} /> Atención
          </h2>
          {activity ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Fallidas esta semana</dt>
                <dd className="font-semibold text-deep">{activity.health.failed_7d}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Empezadas y sin terminar</dt>
                <dd className="font-semibold text-deep">{activity.health.stuck_7d}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Médicos sin completar onboarding</dt>
                <dd className="font-semibold text-deep">{activity.active.onboarding_pending}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Eventos de auditoría (7d)</dt>
                <dd className="font-semibold text-deep">{activity.health.audit_events_7d}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Consultas del asistente (7d)</dt>
                <dd className="font-semibold text-deep">{activity.health.encounters_7d}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted">
              No fue posible cargar el detalle (RPC <code>superadmin_activity</code>).
            </p>
          )}
        </Card>
      </div>

      {/* --- Estados web + exportaciones ----------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Consultas por estado
          </h2>
          <p className="mb-4 mt-1 text-xs text-muted">
            El ciclo de revisión y firma en la web.
          </p>
          <BarList
            items={salud.consultas_por_estado.map((e) => ({
              label: ESTADO_WEB_LABEL[e.estado] ?? e.estado,
              value: e.count,
            }))}
            emptyLabel="Sin consultas registradas."
          />
        </Card>

        <Card className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Exportaciones a la historia clínica
          </h2>
          <p className="mb-4 mt-1 text-xs text-muted">
            Cola hacia el HIS: solo un éxito confirmado marca la consulta como exportada.
          </p>
          <BarList
            items={salud.exports.map((e) => ({
              label: EXPORT_STATUS_LABEL[e.status] ?? e.status,
              value: e.count,
              color:
                e.status === "failed" || e.status === "needs_doctor"
                  ? "var(--color-danger-solid)"
                  : undefined,
            }))}
            emptyLabel="La exportación al HIS todavía no se ha estrenado: ninguna nota ha salido por esta vía."
          />
        </Card>
      </div>

      {/* --- Flotas de apps ------------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DeviceTable
          title="App de escritorio (Windows)"
          icon={MonitorSmartphone}
          emptyLabel="Nadie ha conectado la app de Windows todavía."
          rows={filasWindows}
        />
        <DeviceTable
          title="App móvil"
          icon={Smartphone}
          emptyLabel="Ningún dispositivo móvil registrado."
          rows={filasMoviles}
        />
      </div>

      {filasWindows.length === 0 && filasMoviles.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <MonitorX size={13} />
          Las flotas se llenan solas cuando alguien instala y abre las apps.
        </p>
      ) : null}
    </div>
  );
}

function Encabezado() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-deep">
          <HeartPulse size={22} className="text-accent" /> Salud del servicio
        </h1>
        <p className="text-sm text-muted">
          Qué se está rompiendo y qué necesita a alguien: consultas atascadas, notas
          fallidas, exportaciones y las apps instaladas.
        </p>
      </div>
      <span className="text-xs text-muted">
        Actualizado {formatFechaRelativa(new Date().toISOString()).toLowerCase()}
      </span>
    </div>
  );
}
