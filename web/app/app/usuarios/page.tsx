import { UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth/server";
import { APP_ROLE_LABEL, type AppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { updateUserRole } from "./actions";

const roleTone: Record<AppRole, "accent" | "mint" | "neutral"> = {
  medico: "accent",
  supervisor: "mint",
  admin: "neutral",
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  created_at: string;
};

export default async function UsuariosPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("No fue posible cargar los usuarios.");
  }

  const users = (data ?? []) as ProfileRow[];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-deep">Usuarios y roles</h1>
          <p className="text-sm text-muted">
            Las cuentas se crean al iniciar con Google. Asigna aquí el rol institucional.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-muted">
          <UserPlus size={16} /> Acceso mediante Google
        </span>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
        <div className="hidden grid-cols-[1.4fr_1fr_auto] gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted sm:grid">
          <span>Usuario</span>
          <span>Rol</span>
          <span>Estado</span>
        </div>
        {users.map((user, index) => (
          <div
            key={user.id}
            className={`grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center sm:gap-4 ${
              index ? "border-t border-line" : ""
            }`}
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-deep">
                {user.full_name || user.email}
              </div>
              {user.full_name ? <div className="truncate text-sm text-muted">{user.email}</div> : null}
            </div>
            <form action={updateUserRole} className="flex items-center gap-2">
              <input type="hidden" name="userId" value={user.id} />
              <select
                name="role"
                defaultValue={user.role}
                aria-label={`Rol de ${user.email}`}
                className="rounded-md border border-line bg-white px-3 py-2 text-sm text-deep outline-none focus:border-accent"
              >
                <option value="medico">Médico</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
              <button type="submit" className="rounded-full px-3 py-2 text-xs font-semibold text-accent hover:bg-ice-soft">
                Guardar
              </button>
            </form>
            <span className="flex items-center gap-2 text-sm font-medium text-success">
              <Badge tone={roleTone[user.role]}>{APP_ROLE_LABEL[user.role]}</Badge>
              Activo
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
