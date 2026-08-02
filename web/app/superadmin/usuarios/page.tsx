import { UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/app/EmptyState";
import { APP_ROLE_LABEL, APP_ROLES, isAppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { formatFechaRelativa } from "@/lib/dates";
import { FlashBanner } from "@/components/superadmin/FlashBanner";
import { FilterBar } from "@/components/superadmin/FilterBar";
import { userState, type ActivityPayload } from "@/lib/superadmin/usuarios";
import { assignUserToOrg, createDoctorAccount } from "../actions";

type OrgRow = { id: string; name: string; kind: string };

const inputClass =
  "w-full rounded-md border border-line bg-field px-3 py-2 text-sm text-deep outline-none focus:border-accent";

export default async function SuperadminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; q?: string; org?: string; rol?: string }>;
}) {
  const sp = await searchParams;
  const db = await createClient();

  // La fuente pasa de `profiles` crudo a la RPC de actividad: además de quién
  // existe, trae quién entra y quién dicta — la señal que faltaba en esta vista.
  const [orgsRes, activityRes] = await Promise.all([
    db.from("organizations").select("id, name, kind").order("name"),
    db.rpc("superadmin_activity"),
  ]);

  const orgs = (orgsRes.data ?? []) as OrgRow[];
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  const activity = (activityRes.data ?? null) as ActivityPayload | null;

  if (activityRes.error || !activity) {
    return (
      <div className="space-y-6">
        <Encabezado />
        <FlashBanner ok={sp.ok} error={sp.error} />
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          No fue posible cargar los usuarios. Verifica que la migración{" "}
          <code>superadmin_activity</code> esté aplicada en la base.
        </div>
      </div>
    );
  }

  // Con ~16 usuarios el filtrado se hace aquí, en el servidor, sobre el array de
  // la RPC. Si algún día pasan de ~30, el Pager existente entra sin rediseño.
  const term = (sp.q ?? "").trim().toLowerCase();
  const orgFilter = orgs.some((o) => o.id === sp.org) ? (sp.org as string) : "todos";
  const rolFilter = (APP_ROLES as readonly string[]).includes(sp.rol ?? "") ? (sp.rol as string) : "todos";

  const usuarios = activity.users.filter((user) => {
    if (orgFilter !== "todos" && user.organization_id !== orgFilter) return false;
    if (rolFilter !== "todos" && user.role !== rolFilter) return false;
    if (term) {
      const haystack = `${user.full_name ?? ""} ${user.email}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <Encabezado />
      <FlashBanner ok={sp.ok} error={sp.error} />

      {/* Crear cuenta, plegado: es esporádico y la tabla es lo que se consulta.
          Abierto si el último submit falló, para no esconder el error. */}
      <details
        open={Boolean(sp.error)}
        className="group rounded-[14px] border border-line bg-surface shadow-[var(--shadow-xs)]"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold text-deep [&::-webkit-details-marker]:hidden">
          <UserPlus size={16} className="text-accent" />
          Agregar médico
        </summary>
        <div className="border-t border-line px-5 py-4">
          <form
            action={createDoctorAccount}
            className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_.9fr_.9fr_auto] lg:items-end"
          >
            <label className="text-sm">
              <span className="mb-1 block font-medium text-deep">Correo</span>
              <input name="email" type="email" required placeholder="medico@hospital.com" className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-deep">Nombre</span>
              <input name="fullName" required placeholder="Dra. Ana Ruiz" className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-deep">Organización</span>
              <select name="organizationId" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Elegir…
                </option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-deep">Rol</span>
              <select name="role" defaultValue="medico" className={inputClass}>
                <option value="medico">Médico</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-deep">Tipo profesional</span>
              <select name="professionalType" defaultValue="" className={inputClass}>
                <option value="">Se define en onboarding</option>
                <option value="patologo">Patólogo/a · patología</option>
              </select>
            </label>
            <div className="grid gap-1">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-deep">Contraseña</span>
                <input
                  name="password"
                  type="text"
                  required
                  minLength={8}
                  placeholder="mín. 8"
                  className={inputClass}
                />
              </label>
            </div>
            <button
              type="submit"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover lg:col-span-6 lg:w-fit lg:justify-self-end"
            >
              Crear médico
            </button>
          </form>
          <p className="mt-2 text-xs text-muted">
            Marca <strong>Patólogo/a</strong> para habilitar la generación de informes desde una
            foto de la hoja (patología). Los demás tipos se completan en el onboarding.
          </p>
        </div>
      </details>

      <FilterBar
        basePath="/superadmin/usuarios"
        searchPlaceholder="Buscar por nombre o correo"
        initialQuery={sp.q ?? ""}
        selects={[
          {
            name: "org",
            value: orgFilter,
            allLabel: "Todas las organizaciones",
            options: orgs.map((o) => ({ value: o.id, label: o.name })),
          },
          {
            name: "rol",
            value: rolFilter,
            allLabel: "Todos los roles",
            options: APP_ROLES.map((rol) => ({ value: rol, label: APP_ROLE_LABEL[rol] })),
          },
        ]}
      />

      {/* --- Tabla ---------------------------------------------------------- */}
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-xs)]">
        <div className="hidden grid-cols-[1.5fr_.8fr_.9fr_.9fr_.5fr_.7fr_1.4fr] gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted xl:grid">
          <span>Usuario</span>
          <span>Rol</span>
          <span>Último ingreso</span>
          <span>Última consulta</span>
          <span className="text-center">7d/30d</span>
          <span>Estado</span>
          <span>Reasignar</span>
        </div>
        {usuarios.map((user, index) => {
          const estado = userState(user);
          const work7 = user.consultations_7d + user.encounters_7d;
          const work30 = user.consultations_30d + user.encounters_30d;
          return (
            <div
              key={user.id}
              className={`grid grid-cols-1 gap-3 px-5 py-4 xl:grid-cols-[1.5fr_.8fr_.9fr_.9fr_.5fr_.7fr_1.4fr] xl:items-center xl:gap-4 ${
                index ? "border-t border-line" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-deep">{user.full_name || user.email}</div>
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

              <div className="text-sm text-deep xl:text-center">
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

              {user.role === "superadmin" ? (
                <span className="text-sm text-muted">Cuenta de plataforma.</span>
              ) : (
                <form
                  action={assignUserToOrg}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-2"
                >
                  <input type="hidden" name="userId" value={user.id} />
                  <select
                    name="organizationId"
                    defaultValue={user.organization_id ?? ""}
                    aria-label={`Organización de ${user.email}`}
                    className="rounded-md border border-line bg-field px-2 py-2 text-sm text-deep outline-none focus:border-accent"
                  >
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="role"
                    defaultValue={user.role}
                    aria-label={`Rol de ${user.email}`}
                    className="rounded-md border border-line bg-field px-2 py-2 text-sm text-deep outline-none focus:border-accent"
                  >
                    <option value="medico">Médico</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Administrador</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-full px-3 py-2 text-xs font-semibold text-accent hover:bg-ice-soft"
                  >
                    Guardar
                  </button>
                </form>
              )}
            </div>
          );
        })}
        {usuarios.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Users size={20} />}
              title={term ? `Nadie coincide con «${sp.q}»` : "No hay usuarios con ese filtro"}
              description="Prueba con otro término o quita los filtros."
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Encabezado() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-deep">Usuarios</h1>
      <p className="text-sm text-muted">
        Todas las personas de todas las organizaciones, con su actividad real: quién entra,
        quién dicta y quién nunca arrancó.
      </p>
    </div>
  );
}
