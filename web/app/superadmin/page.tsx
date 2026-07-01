import { Building2, ClipboardList, UserRound, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { APP_ROLE_LABEL, isAppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { FlashBanner } from "@/components/superadmin/FlashBanner";

type OrgRow = { id: string; name: string; kind: string; nit: string | null; created_at: string };
type ProfileRow = { role: string; organization_id: string | null };

export default async function SuperadminResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const db = hasServiceRole() ? createAdminClient() : await createClient();

  const [orgsRes, profilesRes, consultationsRes, patientsRes] = await Promise.all([
    db.from("organizations").select("id, name, kind, nit, created_at").order("created_at"),
    db.from("profiles").select("role, organization_id"),
    db.from("consultations").select("organization_id"),
    db.from("patients").select("organization_id"),
  ]);

  const orgs = (orgsRes.data ?? []) as OrgRow[];
  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const consultations = (consultationsRes.data ?? []) as { organization_id: string | null }[];
  const patients = (patientsRes.data ?? []) as { organization_id: string | null }[];

  const loadError =
    orgsRes.error || profilesRes.error || consultationsRes.error || patientsRes.error;

  const byRole = profiles.reduce<Record<string, number>>((acc, p) => {
    acc[p.role] = (acc[p.role] ?? 0) + 1;
    return acc;
  }, {});

  const membersByOrg = countBy(profiles.map((p) => p.organization_id));
  const consultsByOrg = countBy(consultations.map((c) => c.organization_id));

  const metrics = [
    { label: "Organizaciones", value: orgs.length, icon: Building2 },
    { label: "Usuarios", value: profiles.length, icon: Users },
    { label: "Consultas", value: consultations.length, icon: ClipboardList },
    { label: "Pacientes", value: patients.length, icon: UserRound },
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

      {loadError ? (
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          No fue posible cargar algunos datos. Verifica que la migración de super-admin esté
          aplicada (políticas RLS) o configura la clave de servicio.
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
            <div className="text-sm text-deep sm:text-center">
              {membersByOrg[org.id] ?? 0}
            </div>
            <div className="text-sm text-deep sm:text-center">
              {consultsByOrg[org.id] ?? 0}
            </div>
          </div>
        ))}
        {orgs.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted">Aún no hay organizaciones.</div>
        ) : null}
      </div>
    </div>
  );
}

function countBy(values: Array<string | null>): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, v) => {
    if (v) acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
}
