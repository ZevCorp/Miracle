import Link from "next/link";
import { Building2, ClipboardList, UserRound, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { APP_ROLE_LABEL, isAppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { FlashBanner } from "@/components/superadmin/FlashBanner";

type ActivitySummary = {
  active: {
    total_users: number;
    total_doctors: number;
    signed_in_today: number;
    signed_in_7d: number;
    working_7d: number;
    never_worked: number;
  };
};

type Overview = {
  totals: { organizations: number; users: number; consultations: number; patients: number };
  by_role: Record<string, number>;
  organizations: {
    id: string;
    name: string;
    kind: string;
    nit: string | null;
    members: number;
    consultations: number;
  }[];
};

export default async function SuperadminResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const db = await createClient();

  // Métricas agregadas en la base (no se cargan tablas enteras al cliente).
  const [{ data, error: rpcError }, { data: activityData }] = await Promise.all([
    db.rpc("superadmin_overview"),
    db.rpc("superadmin_activity"),
  ]);
  const overview = (data ?? null) as Overview | null;
  const activity = (activityData ?? null) as ActivitySummary | null;

  const totals = overview?.totals ?? {
    organizations: 0,
    users: 0,
    consultations: 0,
    patients: 0,
  };
  const byRole = overview?.by_role ?? {};
  const orgs = overview?.organizations ?? [];

  const metrics = [
    { label: "Organizaciones", value: totals.organizations, icon: Building2 },
    { label: "Usuarios", value: totals.users, icon: Users },
    { label: "Consultas", value: totals.consultations, icon: ClipboardList },
    { label: "Pacientes", value: totals.patients, icon: UserRound },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-deep">Resumen de la plataforma</h1>
        <p className="text-sm text-muted">
          Vista global de todas las organizaciones y usuarios de Miracle.
        </p>
      </div>

      <FlashBanner ok={ok} error={error} />

      {rpcError ? (
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          No fue posible cargar las métricas. Verifica que la migración de super-admin esté
          aplicada (función <code>superadmin_overview</code> y políticas RLS).
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="flex items-center gap-4">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ice text-accent">
                <Icon size={20} />
              </span>
              <div>
                <div className="text-2xl font-semibold text-deep">{m.value}</div>
                <div className="text-sm text-muted">{m.label}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {activity ? (
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Quién está activo
            </h2>
            <Link
              href="/superadmin/actividad"
              className="text-xs font-semibold text-accent hover:underline"
            >
              Ver detalle →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              {
                value: activity.active.signed_in_today,
                label: "ingresaron hoy",
                of: `de ${activity.active.total_users}`,
              },
              {
                value: activity.active.signed_in_7d,
                label: "ingresaron esta semana",
                of: `de ${activity.active.total_users}`,
              },
              {
                value: activity.active.working_7d,
                label: "médicos dictando (7d)",
                of: `de ${activity.active.total_doctors}`,
              },
              {
                value: activity.active.never_worked,
                label: "médicos que nunca usaron",
                of: "desde que se crearon",
              },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-xl font-semibold text-deep">{item.value}</div>
                <div className="text-sm text-muted">{item.label}</div>
                <div className="text-xs text-muted">{item.of}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Usuarios por rol
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(byRole).map(([role, count]) => (
            <Badge key={role} tone={role === "superadmin" ? "accent" : "neutral"}>
              {isAppRole(role) ? APP_ROLE_LABEL[role] : role}: {count}
            </Badge>
          ))}
          {Object.keys(byRole).length === 0 ? (
            <span className="text-sm text-muted">Sin usuarios.</span>
          ) : null}
        </div>
      </Card>

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="hidden grid-cols-[1.6fr_1fr_auto_auto] gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted sm:grid">
          <span>Organización</span>
          <span>Tipo</span>
          <span>Miembros</span>
          <span>Consultas</span>
        </div>
        {orgs.map((org, index) => (
          <div
            key={org.id}
            className={`grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-[1.6fr_1fr_auto_auto] sm:items-center sm:gap-4 ${
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
            <div className="text-sm text-deep sm:text-center">{org.members}</div>
            <div className="text-sm text-deep sm:text-center">{org.consultations}</div>
          </div>
        ))}
        {orgs.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted">Aún no hay organizaciones.</div>
        ) : null}
      </div>
    </div>
  );
}
