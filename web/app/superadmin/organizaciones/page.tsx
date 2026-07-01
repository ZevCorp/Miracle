import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { APP_ROLE_LABEL, isAppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { FlashBanner } from "@/components/superadmin/FlashBanner";
import { createOrganization } from "../actions";

type OrgRow = { id: string; name: string; kind: string; nit: string | null; created_at: string };
type MemberRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  organization_id: string | null;
};

export default async function OrganizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const db = hasServiceRole() ? createAdminClient() : await createClient();

  const [orgsRes, membersRes] = await Promise.all([
    db.from("organizations").select("id, name, kind, nit, created_at").order("created_at"),
    db.from("profiles").select("id, email, full_name, role, organization_id"),
  ]);

  const orgs = (orgsRes.data ?? []) as OrgRow[];
  const members = (membersRes.data ?? []) as MemberRow[];

  const membersByOrg = members.reduce<Record<string, MemberRow[]>>((acc, m) => {
    const key = m.organization_id ?? "—";
    (acc[key] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-deep">Organizaciones</h1>
        <p className="text-sm text-muted">
          Cada hospital (o consultorio) es una organización aislada. Crea nuevas y revisa sus
          miembros.
        </p>
      </div>

      <FlashBanner ok={ok} error={error} />

      <Card>
        <h2 className="text-sm font-semibold text-deep">Crear organización</h2>
        <form
          action={createOrganization}
          className="mt-4 grid gap-3 sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-end"
        >
          <label className="text-sm">
            <span className="mb-1 block font-medium text-deep">Nombre</span>
            <input
              name="name"
              required
              placeholder="Hospital Norte"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-deep outline-none focus:border-accent"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-deep">Tipo</span>
            <select
              name="kind"
              defaultValue="institution"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-deep outline-none focus:border-accent"
            >
              <option value="institution">Hospital</option>
              <option value="personal">Personal</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-deep">NIT (opcional)</span>
            <input
              name="nit"
              placeholder="900.000.000-0"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-deep outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Crear
          </button>
        </form>
      </Card>

      <div className="space-y-4">
        {orgs.map((org) => {
          const list = membersByOrg[org.id] ?? [];
          return (
            <Card key={org.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-deep">{org.name}</h3>
                  <p className="text-sm text-muted">
                    {org.kind === "institution" ? "Hospital" : "Personal"}
                    {org.nit ? ` · NIT ${org.nit}` : ""}
                  </p>
                </div>
                <Badge tone="neutral">{list.length} miembro{list.length === 1 ? "" : "s"}</Badge>
              </div>

              {list.length ? (
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {list.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-deep">
                          {m.full_name || m.email}
                        </div>
                        {m.full_name ? (
                          <div className="truncate text-xs text-muted">{m.email}</div>
                        ) : null}
                      </div>
                      <Badge tone={m.role === "superadmin" ? "accent" : "mint"}>
                        {isAppRole(m.role) ? APP_ROLE_LABEL[m.role] : m.role}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
                  Sin miembros todavía.
                </p>
              )}
            </Card>
          );
        })}
        {orgs.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">Aún no hay organizaciones. Crea la primera arriba.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
