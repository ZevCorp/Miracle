import { UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { APP_ROLE_LABEL, isAppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { FlashBanner } from "@/components/superadmin/FlashBanner";
import { assignUserToOrg, createDoctorAccount } from "../actions";

type OrgRow = { id: string; name: string; kind: string };
type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  organization_id: string | null;
  created_at: string;
};

const inputClass =
  "w-full rounded-md border border-line bg-field px-3 py-2 text-sm text-deep outline-none focus:border-accent";

export default async function SuperadminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const db = await createClient();

  const [orgsRes, usersRes] = await Promise.all([
    db.from("organizations").select("id, name, kind").order("name"),
    db
      .from("profiles")
      .select("id, email, full_name, role, organization_id, created_at")
      .order("created_at", { ascending: true }),
  ]);

  const orgs = (orgsRes.data ?? []) as OrgRow[];
  const users = (usersRes.data ?? []) as ProfileRow[];
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-deep">Usuarios</h1>
        <p className="text-sm text-muted">
          Todas las personas de todas las organizaciones. Crea médicos o muévelos entre hospitales.
        </p>
      </div>

      <FlashBanner ok={ok} error={error} />

      <Card>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-deep">
          <UserPlus size={16} /> Agregar médico
        </h2>
        <form
          action={createDoctorAccount}
          className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] lg:items-end"
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
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover lg:col-span-5 lg:w-fit lg:justify-self-end"
          >
            Crear médico
          </button>
        </form>
      </Card>

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="hidden grid-cols-[1.4fr_1fr_1.6fr] gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted lg:grid">
          <span>Usuario</span>
          <span>Rol actual</span>
          <span>Reasignar</span>
        </div>
        {users.map((user, index) => (
          <div
            key={user.id}
            className={`grid grid-cols-1 gap-3 px-5 py-4 lg:grid-cols-[1.4fr_1fr_1.6fr] lg:items-center lg:gap-4 ${
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
              <Badge tone={user.role === "superadmin" ? "accent" : "mint"}>
                {isAppRole(user.role) ? APP_ROLE_LABEL[user.role] : user.role}
              </Badge>
            </div>

            {user.role === "superadmin" ? (
              <span className="text-sm text-muted">Cuenta de plataforma (se edita en la base).</span>
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
        ))}
        {users.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted">No hay usuarios todavía.</div>
        ) : null}
      </div>
    </div>
  );
}
