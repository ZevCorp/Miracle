import { Activity, AlertTriangle, FileStack, Stethoscope, UserCheck, UserX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { APP_ROLE_LABEL, isAppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { formatFechaRelativa } from "@/lib/dates";

type ActivityUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  organization_id: string | null;
  created_at: string;
  onboarding_completed_at: string | null;
  last_sign_in_at: string | null;
  last_activity_at: string | null;
  consultations_total: number;
  consultations_7d: number;
  consultations_30d: number;
  encounters_total: number;
  encounters_7d: number;
  encounters_30d: number;
};

type ActivityPayload = {
  generated_at: string;
  active: {
    total_users: number;
    total_doctors: number;
    signed_in_today: number;
    signed_in_7d: number;
    signed_in_30d: number;
    working_7d: number;
    working_30d: number;
    never_signed_in: number;
    never_worked: number;
    onboarding_pending: number;
  };
  users: ActivityUser[];
  adoption: {
    templates_total: number;
    templates_used: number;
    top_templates: { name: string; specialty: string; uses: number }[];
    weekly: { week: string; consultations: number; encounters: number; doctors: number }[];
  };
  health: {
    funnel: { status: string; count: number }[];
    failed_total: number;
    failed_7d: number;
    stuck_7d: number;
    consultations_7d: number;
    encounters_7d: number;
    audit_events_7d: number;
  };
};

const STATUS_LABEL: Record<string, string> = {
  created: "Creada",
  transcript_ready: "Transcrita",
  note_generating: "Generando nota",
  note_generated: "Nota generada",
  completed: "Completada",
  failed: "Fallida",
};

type UserState = {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
  hint: string;
};

/**
 * Estado de uso de una persona. Solo los médicos dictan: para el resto de roles
 * "no ha dictado nunca" no es abandono, así que se mide únicamente el acceso.
 */
function userState(user: ActivityUser): UserState {
  const isDoctor = user.role === "medico";
  const work7 = user.consultations_7d + user.encounters_7d;
  const work30 = user.consultations_30d + user.encounters_30d;

  if (!user.last_sign_in_at) {
    return { label: "Nunca entró", tone: "danger", hint: "Cuenta creada, sin un solo ingreso." };
  }
  if (!isDoctor) {
    const signedRecently =
      new Date(user.last_sign_in_at).getTime() > Date.now() - 30 * 86_400_000;
    return signedRecently
      ? { label: "Activo", tone: "success", hint: "Ingresó en los últimos 30 días." }
      : { label: "Inactivo", tone: "neutral", hint: "Sin ingresos en 30 días." };
  }
  if (work7 > 0) {
    return { label: "Activo", tone: "success", hint: "Dictó esta semana." };
  }
  if (work30 > 0) {
    return { label: "Bajó el uso", tone: "warning", hint: "Dictó este mes, pero no esta semana." };
  }
  if (!user.last_activity_at) {
    return {
      label: "Entró sin usar",
      tone: "danger",
      hint: "Ingresó alguna vez pero nunca generó una consulta.",
    };
  }
  return { label: "Inactivo", tone: "neutral", hint: "Sin consultas en los últimos 30 días." };
}

export default async function SuperadminActividadPage() {
  const db = await createClient();

  const { data, error } = await db.rpc("superadmin_activity");
  const payload = (data ?? null) as ActivityPayload | null;

  if (error || !payload) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-deep">Actividad</h1>
          <p className="text-sm text-muted">Quién usa Miracle, qué se adopta y qué falla.</p>
        </div>
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          No fue posible cargar la actividad. Verifica que la migración{" "}
          <code>superadmin_activity</code> esté aplicada en la base.
        </div>
      </div>
    );
  }

  const { active, users, adoption, health } = payload;

  const orgsRes = await db.from("organizations").select("id, name");
  const orgName = new Map(
    ((orgsRes.data ?? []) as { id: string; name: string }[]).map((o) => [o.id, o.name]),
  );

  const metrics = [
    {
      label: "Ingresaron hoy",
      value: active.signed_in_today,
      of: `de ${active.total_users} usuarios`,
      icon: UserCheck,
    },
    {
      label: "Ingresaron esta semana",
      value: active.signed_in_7d,
      of: `de ${active.total_users} usuarios`,
      icon: Activity,
    },
    {
      label: "Médicos dictando (7d)",
      value: active.working_7d,
      of: `de ${active.total_doctors} médicos`,
      icon: Stethoscope,
    },
    {
      label: "Médicos que nunca usaron",
      value: active.never_worked,
      of: `${active.never_signed_in} ni siquiera entraron`,
      icon: UserX,
    },
  ];

  const maxWeekly = Math.max(
    1,
    ...adoption.weekly.map((w) => w.consultations + w.encounters),
  );
  const funnelTotal = Math.max(1, health.funnel.reduce((sum, f) => sum + f.count, 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-deep">Actividad</h1>
        <p className="text-sm text-muted">
          Quién usa Miracle de verdad, qué se adopta y qué se está rompiendo.
        </p>
      </div>

      {/* --- Activos ---------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="flex items-start gap-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ice text-accent">
                <Icon size={20} />
              </span>
              <div className="min-w-0">
                <div className="text-2xl font-semibold text-deep">{m.value}</div>
                <div className="text-sm text-muted">{m.label}</div>
                <div className="mt-0.5 text-xs text-muted">{m.of}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* --- Detalle por usuario ---------------------------------------- */}
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
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
          const state = userState(user);
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

              <div title={state.hint}>
                <Badge tone={state.tone}>{state.label}</Badge>
              </div>
            </div>
          );
        })}
        {users.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted">Sin usuarios.</div>
        ) : null}
      </div>

      {/* --- Adopción ---------------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Consultas por semana
          </h2>
          <p className="mt-1 text-xs text-muted">
            Últimas 8 semanas. La cifra de la derecha son los médicos distintos que
            trabajaron esa semana.
          </p>
          <div className="mt-4 space-y-2">
            {adoption.weekly.map((week) => {
              const total = week.consultations + week.encounters;
              return (
                <div key={week.week} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-xs text-muted">
                    {week.week.slice(8, 10)}/{week.week.slice(5, 7)}
                  </span>
                  <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ice">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.round((total / maxWeekly) * 100)}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm font-medium text-deep">
                    {total}
                  </span>
                  <span className="w-16 shrink-0 text-right text-xs text-muted">
                    {week.doctors} méd.
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <FileStack size={15} /> Plantillas realmente usadas
          </h2>
          <p className="mt-1 text-xs text-muted">
            {adoption.templates_used} de {adoption.templates_total} plantillas se han usado
            alguna vez.
          </p>
          <div className="mt-4 space-y-2">
            {adoption.top_templates.map((tpl) => (
              <div key={`${tpl.name}-${tpl.specialty}`} className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-deep" title={tpl.name}>
                  {tpl.name}
                </span>
                {tpl.specialty ? (
                  <span className="hidden shrink-0 text-xs text-muted sm:inline">
                    {tpl.specialty}
                  </span>
                ) : null}
                <span className="shrink-0 text-sm font-semibold text-deep">{tpl.uses}</span>
              </div>
            ))}
            {adoption.top_templates.length === 0 ? (
              <p className="text-sm text-muted">Todavía nadie ha usado una plantilla.</p>
            ) : null}
          </div>
        </Card>
      </div>

      {/* --- Salud ------------------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Embudo de la consulta
          </h2>
          <p className="mt-1 text-xs text-muted">
            Dónde se quedan las consultas del asistente clínico.
          </p>
          <div className="mt-4 space-y-2">
            {health.funnel.map((step) => (
              <div key={step.status} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-sm text-deep">
                  {STATUS_LABEL[step.status] ?? step.status}
                </span>
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ice">
                  <div
                    className={`h-full rounded-full ${
                      step.status === "failed" ? "bg-danger" : "bg-accent"
                    }`}
                    style={{ width: `${Math.round((step.count / funnelTotal) * 100)}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-sm font-medium text-deep">
                  {step.count}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <AlertTriangle size={15} /> Atención
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">Consultas fallidas (total)</dt>
              <dd className="font-semibold text-deep">{health.failed_total}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">Fallidas esta semana</dt>
              <dd className="font-semibold text-deep">{health.failed_7d}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">Empezadas y sin terminar</dt>
              <dd className="font-semibold text-deep">{health.stuck_7d}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">Médicos sin completar onboarding</dt>
              <dd className="font-semibold text-deep">{active.onboarding_pending}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">Eventos de auditoría (7d)</dt>
              <dd className="font-semibold text-deep">{health.audit_events_7d}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
