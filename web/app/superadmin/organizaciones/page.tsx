import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/app/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { formatFechaRelativa } from "@/lib/dates";
import { FlashBanner } from "@/components/superadmin/FlashBanner";
import { Sparkline } from "@/components/superadmin/charts/Sparkline";
import { createOrganization } from "../actions";

type DashboardOrgs = {
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
};

export default async function OrganizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const db = await createClient();

  const { data, error: rpcError } = await db.rpc("superadmin_dashboard");
  const dash = (data ?? null) as DashboardOrgs | null;

  if (rpcError || !dash) {
    return (
      <div className="space-y-6">
        <Encabezado />
        <FlashBanner ok={ok} error={error} />
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          No fue posible cargar las organizaciones. Verifica que la migración{" "}
          <code>superadmin_dashboard</code> esté aplicada en la base.
        </div>
      </div>
    );
  }

  const orgs = dash.organizaciones;

  return (
    <div className="space-y-6">
      <Encabezado />
      <FlashBanner ok={ok} error={error} />

      {/* El form vive plegado: crear una organización es esporádico y no debe
          empujar las cards —lo que se consulta a diario— fuera de la pantalla.
          Se abre solo si el último submit falló, para no esconder el error. */}
      <details
        open={Boolean(error)}
        className="group rounded-[14px] border border-line bg-surface shadow-[var(--shadow-xs)]"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold text-deep [&::-webkit-details-marker]:hidden">
          <Plus size={16} className="text-accent transition-transform group-open:rotate-45" />
          Crear organización
        </summary>
        <form
          action={createOrganization}
          className="grid gap-3 border-t border-line px-5 py-4 sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-end"
        >
          <label className="text-sm">
            <span className="mb-1 block font-medium text-deep">Nombre</span>
            <input
              name="name"
              required
              placeholder="Hospital Norte"
              className="w-full rounded-md border border-line bg-field px-3 py-2 text-sm text-deep outline-none focus:border-accent"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-deep">Tipo</span>
            <select
              name="kind"
              defaultValue="institution"
              className="w-full rounded-md border border-line bg-field px-3 py-2 text-sm text-deep outline-none focus:border-accent"
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
              className="w-full rounded-md border border-line bg-field px-3 py-2 text-sm text-deep outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Crear
          </button>
        </form>
      </details>

      {/* --- Cards por organización ---------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        {orgs.map((org) => (
          <Link key={org.id} href={`/superadmin/organizaciones/${org.id}`} className="group">
            <Card className="h-full transition-shadow group-hover:shadow-[var(--shadow-sm)]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-deep group-hover:text-accent">
                    {org.name}
                  </h3>
                  <p className="text-sm text-muted">
                    {org.kind === "institution" ? "Hospital" : "Personal"}
                    {org.nit ? ` · NIT ${org.nit}` : ""}
                  </p>
                </div>
                <Badge tone={org.kind === "institution" ? "mint" : "neutral"}>
                  {org.members_active_30d}/{org.members} activos
                </Badge>
              </div>

              <div className="mt-4 flex items-end justify-between gap-4">
                <dl className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted">7 días</dt>
                    <dd className="font-display text-lg font-semibold text-deep">
                      {org.consultas_7d}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">30 días</dt>
                    <dd className="font-display text-lg font-semibold text-deep">
                      {org.consultas_30d}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Total</dt>
                    <dd className="font-display text-lg font-semibold text-deep">
                      {org.consultas_total}
                    </dd>
                  </div>
                </dl>
                {org.weekly.some((v) => v > 0) ? (
                  <Sparkline
                    values={org.weekly}
                    width={96}
                    height={28}
                    label={`Tendencia de ${org.name}`}
                  />
                ) : null}
              </div>

              <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
                {org.last_activity_at
                  ? `Última actividad ${formatFechaRelativa(org.last_activity_at).toLowerCase()}`
                  : "Sin actividad todavía"}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      {orgs.length === 0 ? (
        <EmptyState
          icon={<Building2 size={20} />}
          title="Aún no hay organizaciones"
          description="Crea la primera con el formulario de arriba: cada hospital o consultorio es una organización aislada."
        />
      ) : null}
    </div>
  );
}

function Encabezado() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-deep">Organizaciones</h1>
      <p className="text-sm text-muted">
        Cada hospital (o consultorio) es una organización aislada. Toca una para ver sus
        miembros y su actividad.
      </p>
    </div>
  );
}
