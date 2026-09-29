import {
  AlertTriangle,
  Building2,
  FileWarning,
  HeartPulse,
  MonitorSmartphone,
  Send,
  ShieldCheck,
  Stethoscope,
  TimerOff,
  UserX,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { StatTile } from "@/components/superadmin/charts/StatTile";
import { BarList } from "@/components/superadmin/charts/BarList";
import { AlertPanel, type Alerta } from "@/components/superadmin/AlertPanel";
import { AutoRefresh } from "@/components/superadmin/AutoRefresh";
import type { DeviceRow } from "@/components/superadmin/DeviceTable";
import { estaDesactualizada, versionMasReciente } from "@/lib/superadmin/versiones";
import {
  ENCOUNTER_PIPELINE_ORDER,
  ENCOUNTER_STATUS_LABEL,
  type ActivityPayload,
} from "@/lib/superadmin/usuarios";

// Bloques de `superadmin_dashboard` que consume esta página.
type DashboardSalud = {
  generated_at: string;
  kpis: { exito_notas: { value: number | null; fallidos: number; total: number } };
  salud: {
    encounters_funnel: { status: string; count: number }[];
    consultas_por_estado: { estado: string; count: number }[];
    exports: { status: string; count: number }[];
    encounters_stuck: number;
    encounters_failed: number;
  };
  dispositivos: {
    windows_total: number;
    moviles_total: number;
    /** Versiones de TODA la tabla, no solo de las filas mostradas. */
    windows_versiones: string[];
    moviles_versiones: string[];
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

  // La versión de referencia sale del conjunto COMPLETO que devuelve la RPC.
  // Calcularla sobre las 20 filas visibles hacía que retrocediera sola cuando
  // el equipo con el build más nuevo llevaba días apagado.
  const versionWindows = versionMasReciente(dispositivos.windows_versiones ?? []);
  const filasWindows: DeviceRow[] = dispositivos.windows.map((d) => ({
    primary: d.display_name || d.email,
    secondary: [d.machine_name, d.os_version].filter(Boolean).join(" · ") || d.email,
    version: d.app_version,
    versionOutdated: estaDesactualizada(d.app_version, versionWindows),
    lastSeenAt: d.last_seen_at,
    href: d.email ? `/superadmin/usuarios?q=${encodeURIComponent(d.email)}` : undefined,
  }));

  const versionMovil = versionMasReciente(dispositivos.moviles_versiones ?? []);
  const filasMoviles: DeviceRow[] = dispositivos.moviles.map((d) => ({
    primary: d.display_name || "Dispositivo sin nombre",
    secondary: d.device_model,
    version: d.app_version,
    versionOutdated: estaDesactualizada(d.app_version, versionMovil),
    lastSeenAt: d.last_seen_at,
  }));

  const equiposViejos =
    filasWindows.filter((f) => f.versionOutdated).length +
    filasMoviles.filter((f) => f.versionOutdated).length;

  // --- Alertas ---------------------------------------------------------------
  // Se enlaza SOLO donde existe una lista filtrada de verdad. Las que no la
  // tienen se quedan sin enlace en vez de llevar a una página genérica.
  const alertas: Alerta[] = activity
    ? [
        {
          id: "fallidas",
          label: "Notas fallidas esta semana",
          count: activity.health.failed_7d,
          severity: "critica",
          icon: FileWarning,
          hint: "La generación no pudo completarse",
        },
        {
          id: "doctores-fallos",
          label: "Médicos con fallos repetidos",
          count: activity.health.doctores_con_fallos.length,
          severity: "critica",
          icon: Stethoscope,
          hint: activity.health.doctores_con_fallos
            .map((d) => `${d.nombre} (${d.fallos})`)
            .join(", "),
        },
        {
          id: "atascadas",
          label: "Consultas empezadas y sin terminar",
          count: activity.health.stuck_7d,
          severity: "atencion",
          icon: TimerOff,
          hint: "Más de un día abiertas en el asistente",
        },
        {
          id: "borradores",
          label: "Borradores sin firmar de más de una semana",
          count: activity.health.borradores_estancados,
          severity: "atencion",
          icon: FileWarning,
          href: "/superadmin/consultas?estado=borrador",
          hint: "Una nota sin firmar es un pendiente de cumplimiento",
        },
        {
          id: "exportaciones",
          label: "Exportaciones abandonadas",
          count: activity.health.exportaciones_abandonadas,
          severity: "atencion",
          icon: Send,
          hint: "El proceso murió a mitad y la nota no llegó al HIS",
        },
        {
          id: "onboarding",
          label: "Médicos sin completar onboarding",
          count: activity.active.onboarding_pending,
          severity: "atencion",
          icon: UserX,
          href: "/superadmin/usuarios?rol=medico",
        },
        {
          id: "nunca-entraron",
          label: "Cuentas que nunca han entrado",
          count: activity.active.never_signed_in,
          severity: "info",
          icon: UserX,
          href: "/superadmin/usuarios",
        },
        {
          id: "orgs-dormidas",
          label: "Organizaciones sin actividad en 30 días",
          count: activity.health.orgs_sin_actividad_30d,
          severity: "info",
          icon: Building2,
          href: "/superadmin/organizaciones",
          hint: "Contratos en riesgo",
        },
        {
          id: "equipos-viejos",
          label: "Equipos en versión vieja",
          count: equiposViejos,
          severity: "info",
          icon: MonitorSmartphone,
          href: "/superadmin/dispositivos",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <Encabezado generadoEn={dash.generated_at} />

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
              ? "sin actividad del asistente en el periodo"
              : `${kpis.exito_notas.fallidos} fallidas de ${kpis.exito_notas.total}`
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
          <BarList items={funnelItems} emptyLabel="Sin consultas en el asistente todavía." />
        </Card>

        {activity ? (
          <AlertPanel alertas={alertas} />
        ) : (
          <Card className="min-w-0">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Atención</h2>
            <p className="mt-4 text-sm text-muted">
              No fue posible cargar el detalle (RPC <code>superadmin_activity</code>).
            </p>
          </Card>
        )}
      </div>

      {/* --- Volumen de la semana (métricas, no alertas) --------------------- */}
      {activity ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label="Consultas de la web (7d)"
            value={activity.health.consultations_7d}
            footnote="registradas desde la aplicación"
          />
          <StatTile
            label="Consultas del asistente (7d)"
            value={activity.health.encounters_7d}
            footnote="dictadas con el asistente clínico"
          />
          <StatTile
            label="Eventos de auditoría (7d)"
            value={activity.health.audit_events_7d}
            footnote="ver el registro completo en Actividad"
          />
        </div>
      ) : null}

      {/* --- Estados web + exportaciones ----------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Consultas por estado
          </h2>
          <p className="mb-4 mt-1 text-xs text-muted">El ciclo de revisión y firma en la web.</p>
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

      {/* El inventario de las apps instaladas vive en /superadmin/dispositivos:
          un inventario no es una alerta, y aquí solo estorbaba a la pregunta
          "¿algo está roto ahora?". La alerta de versiones viejas (arriba)
          enlaza allí. */}
    </div>
  );
}

function Encabezado({ generadoEn }: { generadoEn?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-deep">
          <HeartPulse size={22} className="text-accent" /> Salud del servicio
        </h1>
        <p className="text-sm text-muted">
          Qué se está rompiendo y qué necesita a alguien: consultas atascadas, notas fallidas y
          exportaciones. El inventario de apps vive en Dispositivos.
        </p>
      </div>
      {/* El sello y el auto-refresco usan el `generated_at` de la RPC, no
          `new Date()`: miden la edad del DATO. Antes esto imprimía el reloj del
          render, así que decía "ahora" aunque la página llevara media hora
          abierta — justo al revés de lo que necesita una pantalla que responde
          "¿algo está roto ahora mismo?". */}
      {generadoEn ? <AutoRefresh generadoEn={generadoEn} /> : null}
    </div>
  );
}
