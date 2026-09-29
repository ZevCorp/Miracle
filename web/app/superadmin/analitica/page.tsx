import { Activity, FileStack, Stethoscope, UserCheck, UserX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { APP_ROLE_LABEL, isAppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { formatFechaRelativa } from "@/lib/dates";
import { StatTile } from "@/components/superadmin/charts/StatTile";
import { BarList } from "@/components/superadmin/charts/BarList";
import { userState, type ActivityPayload } from "@/lib/superadmin/usuarios";

export default async function SuperadminAnaliticaPage() {
  const db = await createClient();

  const { data, error } = await db.rpc("superadmin_activity");
  const payload = (data ?? null) as ActivityPayload | null;

  if (error || !payload) {
    return (
      <div className="space-y-6">
        <Encabezado />
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          No fue posible cargar la analítica. Verifica que la migración{" "}
          <code>superadmin_activity</code> esté aplicada en la base.
        </div>
      </div>
    );
  }

  const { active, users, adoption } = payload;

  const orgsRes = await db.from("organizations").select("id, name");
  const orgName = new Map(
    ((orgsRes.data ?? []) as { id: string; name: string }[]).map((o) => [o.id, o.name]),
  );

  return (
    <div className="space-y-6">
      <Encabezado generadoEn={payload.generated_at} />

      {/* --- KPIs de adopción ---------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Ingresaron hoy"
          value={active.signed_in_today}
          suffix={`de ${active.total_users}`}
          icon={UserCheck}
        />
        <StatTile
          label="Ingresaron esta semana"
          value={active.signed_in_7d}
          suffix={`de ${active.total_users}`}
          footnote={`${active.never_signed_in} nunca han entrado`}
          icon={Activity}
        />
        <StatTile
          label="Médicos dictando (7d)"
          value={active.working_7d}
          suffix={`de ${active.total_doctors}`}
          footnote={`${active.working_30d} en los últimos 30 días`}
          icon={Stethoscope}
        />
        <StatTile
          label="Médicos que nunca usaron"
          value={active.never_worked}
          footnote="entrar no es usar: nunca generaron una consulta"
          icon={UserX}
          invertido
        />
      </div>

      {/* --- Uso por persona ------------------------------------------------ */}
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-xs)]">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Uso por persona
          </h2>
          <p className="mt-1 text-xs text-muted">
            Ordenado por última actividad. Entrar no es usar: un médico puede iniciar sesión
            y no dictar nada.
          </p>
        </div>
        <div className="hidden grid-cols-[1.7fr_.9fr_1fr_1fr_.7fr_.9fr] gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted lg:grid">
          <span>Usuario</span>
          <span>Rol</span>
          <span>Último ingreso</span>
          <span>Última consulta</span>
          <span className="text-center">7d / 30d</span>
          <span>Estado</span>
        </div>
        {users.map((user, index) => {
          const estado = userState(user);
          const work7 = user.consultations_7d + user.encounters_7d;
          const work30 = user.consultations_30d + user.encounters_30d;
          return (
            <div
              key={user.id}
              className={`grid grid-cols-1 gap-2 px-5 py-4 lg:grid-cols-[1.7fr_.9fr_1fr_1fr_.7fr_.9fr] lg:items-center lg:gap-4 ${
                index ? "border-t border-line" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-deep">
                  {user.full_name || user.email}
                </div>
                <div className="truncate text-sm text-muted">
                  {user.email}
                  {user.organization_id ? ` · ${orgName.get(user.organization_id) ?? "—"}` : ""}
                </div>
              </div>

              <div>
                <Badge tone={user.role === "superadmin" ? "accent" : "neutral"}>
                  {isAppRole(user.role) ? APP_ROLE_LABEL[user.role] : user.role}
                </Badge>
              </div>

              <div className="text-sm text-muted">
                {user.last_sign_in_at ? formatFechaRelativa(user.last_sign_in_at) : "Nunca"}
              </div>

              <div className="text-sm text-muted">
                {user.last_activity_at ? formatFechaRelativa(user.last_activity_at) : "—"}
              </div>

              <div className="text-sm text-deep lg:text-center">
                {user.role === "medico" ? (
                  <>
                    <span className="font-semibold">{work7}</span>
                    <span className="text-muted"> / {work30}</span>
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
        {users.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted">Sin usuarios.</div>
        ) : null}
      </div>

      {/* --- Adopción ------------------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Consultas por semana
          </h2>
          <p className="mb-4 mt-1 text-xs text-muted">
            Últimas 8 semanas, web y asistente juntos. El dato al lado son los médicos
            distintos que trabajaron esa semana.
          </p>
          <BarList
            items={adoption.weekly.map((week) => ({
              label: `${week.week.slice(8, 10)}/${week.week.slice(5, 7)}`,
              value: week.consultations + week.encounters,
              hint: `${week.doctors} méd.`,
            }))}
            emptyLabel="Sin actividad registrada."
          />
        </Card>

        <Card className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <FileStack size={15} /> Plantillas realmente usadas
          </h2>
          <p className="mb-4 mt-1 text-xs text-muted">
            {adoption.templates_used} de {adoption.templates_total} plantillas se han usado
            alguna vez.
          </p>
          <BarList
            items={adoption.top_templates.map((tpl) => ({
              label: tpl.name,
              value: tpl.uses,
              hint: tpl.specialty || undefined,
            }))}
            emptyLabel="Todavía nadie ha usado una plantilla."
          />
        </Card>
      </div>
    </div>
  );
}

function Encabezado({ generadoEn }: { generadoEn?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {/* La URL sigue siendo /analitica para no romper enlaces guardados;
            el nombre nuevo dice lo que la página siempre midió: adopción. */}
        <h1 className="font-display text-2xl font-semibold text-deep">Adopción</h1>
        <p className="text-sm text-muted">
          Quién usa Miracle de verdad y qué se adopta. Lo que ocurre dentro de cada consulta
          vive en Métricas; lo que se rompe, en Salud.
        </p>
      </div>
      {generadoEn ? (
        <span className="text-xs text-muted">
          Actualizado {formatFechaRelativa(generadoEn).toLowerCase()}
        </span>
      ) : null}
    </div>
  );
}
