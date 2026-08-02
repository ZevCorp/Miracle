import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ClipboardList, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { formatFechaRelativa } from "@/lib/dates";
import { StatTile } from "@/components/superadmin/charts/StatTile";
import { BarList } from "@/components/superadmin/charts/BarList";
import { StatusBadge } from "@/components/app/StatusBadge";
import type { ConsultationStatus } from "@/lib/mock";
import { APP_ROLE_LABEL, isAppRole } from "@/lib/auth/roles";
import { userState, type ActivityPayload } from "@/lib/superadmin/usuarios";

type DashboardOrg = {
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

type ConsultaRow = {
  id: string;
  motivo: string | null;
  fecha: string;
  estado: ConsultationStatus;
  especialidad: string | null;
};

export default async function SuperadminOrganizacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await createClient();

  const [dashRes, activityRes, consultasRes] = await Promise.all([
    db.rpc("superadmin_dashboard"),
    db.rpc("superadmin_activity"),
    db
      .from("consultations")
      .select("id, motivo, fecha, estado, especialidad")
      .eq("organization_id", id)
      .order("fecha", { ascending: false })
      .limit(10),
  ]);

  const dash = (dashRes.data ?? null) as DashboardOrg | null;
  const org = dash?.organizaciones.find((o) => o.id === id);
  if (!org) {
    notFound();
  }

  const activity = (activityRes.data ?? null) as ActivityPayload | null;
  const miembros = (activity?.users ?? []).filter((u) => u.organization_id === id);
  const consultas = (consultasRes.data ?? []) as ConsultaRow[];

  // Las 8 semanas de la RPC vienen como enteros ordenados de la más vieja a la
  // actual; las etiquetas se derivan aquí para no engordar el payload.
  const semanas = org.weekly.map((value, index) => {
    const faltan = org.weekly.length - 1 - index;
    return {
      label: faltan === 0 ? "Esta semana" : faltan === 1 ? "Hace 1 semana" : `Hace ${faltan} semanas`,
      value,
    };
  });

  return (
    <div className="space-y-6">
      {/* --- Encabezado ---------------------------------------------------- */}
      <div>
        <Link
          href="/superadmin/organizaciones"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-deep"
        >
          <ArrowLeft size={15} /> Organizaciones
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold text-deep">{org.name}</h1>
          <Badge tone={org.kind === "institution" ? "mint" : "neutral"}>
            {org.kind === "institution" ? "Hospital" : "Personal"}
          </Badge>
          {org.nit ? <span className="text-sm text-muted">NIT {org.nit}</span> : null}
        </div>
      </div>

      {/* --- KPIs de la organización --------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Consultas esta semana"
          value={org.consultas_7d}
          spark={org.weekly}
          icon={ClipboardList}
        />
        <StatTile
          label="Consultas en 30 días"
          value={org.consultas_30d}
          footnote={`${org.consultas_total} desde el inicio`}
          icon={ClipboardList}
        />
        <StatTile
          label="Miembros activos"
          value={org.members_active_30d}
          suffix={`de ${org.members}`}
          footnote="con actividad en 30 días"
          icon={Users}
        />
        <StatTile
          label="Última actividad"
          value={org.last_activity_at ? formatFechaRelativa(org.last_activity_at).split(" · ")[0] : "—"}
          footnote={org.last_activity_at ? undefined : "sin consultas registradas"}
          icon={CalendarClock}
        />
      </div>

      {/* --- Tendencia + miembros ------------------------------------------ */}
      <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
        <Card className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Últimas 8 semanas
          </h2>
          <p className="mb-4 mt-1 text-xs text-muted">Consultas registradas por semana.</p>
          <BarList items={semanas} emptyLabel="Sin actividad todavía." />
        </Card>

        <div className="min-w-0 overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-xs)]">
          <div className="border-b border-line px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Miembros ({miembros.length})
            </h2>
          </div>
          {miembros.map((user, index) => {
            const estado = userState(user);
            const work7 = user.consultations_7d + user.encounters_7d;
            const work30 = user.consultations_30d + user.encounters_30d;
            return (
              <div
                key={user.id}
                className={`grid grid-cols-2 gap-2 px-5 py-3.5 sm:grid-cols-[1.6fr_.8fr_1fr_.6fr_.8fr] sm:items-center sm:gap-4 ${
                  index ? "border-t border-line" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-deep">
                    {user.full_name || user.email}
                  </div>
                  <div className="truncate text-xs text-muted">{user.email}</div>
                </div>
                <div>
                  <Badge tone={user.role === "superadmin" ? "accent" : "neutral"}>
                    {isAppRole(user.role) ? APP_ROLE_LABEL[user.role] : user.role}
                  </Badge>
                </div>
                <div className="text-xs text-muted">
                  {user.last_sign_in_at
                    ? `Entró ${formatFechaRelativa(user.last_sign_in_at).split(" · ")[0].toLowerCase()}`
                    : "Nunca entró"}
                </div>
                <div className="text-sm text-deep sm:text-center">
                  {user.role === "medico" ? (
                    <>
                      <span className="font-semibold">{work7}</span>
                      <span className="text-muted">/{work30}</span>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </div>
                <div title={estado.hint}>
                  <Badge tone={estado.tone}>{estado.label}</Badge>
                </div>
              </div>
            );
          })}
          {miembros.length === 0 ? (
            <div className="px-5 py-6 text-sm text-muted">
              {activity
                ? "Sin miembros asignados a esta organización."
                : "No fue posible cargar los miembros."}
            </div>
          ) : null}
        </div>
      </div>

      {/* --- Últimas consultas --------------------------------------------- */}
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Últimas consultas
          </h2>
          <Link
            href={`/superadmin/consultas?org=${org.id}`}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Ver todas →
          </Link>
        </div>
        {consultas.map((c, index) => (
          <div
            key={c.id}
            className={`grid grid-cols-2 gap-2 px-5 py-3.5 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-center sm:gap-4 ${
              index ? "border-t border-line" : ""
            }`}
          >
            <div className="min-w-0 truncate text-sm text-deep">
              {c.motivo || "Sin motivo registrado"}
            </div>
            <div className="truncate text-xs text-muted">{c.especialidad ?? "—"}</div>
            <StatusBadge estado={c.estado} />
            <div className="text-xs text-muted">{formatFechaRelativa(c.fecha)}</div>
          </div>
        ))}
        {consultas.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted">Sin consultas registradas.</div>
        ) : null}
      </div>
    </div>
  );
}
