import { KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { APP_ROLE_LABEL, isAppRole } from "@/lib/auth/roles";
import { changeOrgMemberRole, setOrgOwner } from "@/app/superadmin/actions";

/**
 * Quién administra una organización, y los únicos controles para cambiarlo.
 *
 * POR QUÉ ES UNA PANTALLA Y NO UN SELECTOR MÁS
 * La consola ya permitía cambiar roles desde /superadmin/usuarios, pero en un
 * desplegable que comparte formulario con "mover de organización": el mismo
 * botón Guardar hacía las dos cosas, así que reasignar a alguien de hospital
 * podía cambiarle los permisos sin que nadie lo pretendiera. Y para responder
 * "¿quién manda en este hospital?" había que ir a otra pantalla y cruzar dos
 * filtros. Aquí las dos preguntas —quién administra y quién es el principal—
 * se responden de un vistazo, y cada acción es un botón con un solo efecto.
 *
 * El administrador PRINCIPAL es el que el hospital ya no puede tocar
 * (organizations.owner_id, migración 20260808140000): degradarlo o desactivarlo
 * es exclusivo de la plataforma. Por eso el control de relevo vive aquí y en
 * ningún otro sitio de la app.
 */

export type MiembroOrg = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  disabled_at?: string | null;
};

function nombreDe(m: MiembroOrg): string {
  return m.full_name || m.email;
}

export function OrgAdmins({
  orgId,
  miembros,
  ownerId,
}: {
  orgId: string;
  miembros: MiembroOrg[];
  /** organizations.owner_id. `undefined` = la migración no está aplicada. */
  ownerId?: string | null;
}) {
  const activos = miembros.filter((m) => !m.disabled_at);
  const admins = activos.filter((m) => m.role === "admin");
  // Candidatos a ascender: cualquiera del equipo clínico. Se excluye a los
  // superadmin —su cuenta es de plataforma, no de la organización— y a quien ya
  // es admin.
  const candidatos = activos.filter((m) => m.role === "medico" || m.role === "supervisor");
  const principal = admins.find((m) => m.id === ownerId) ?? null;

  const botonSecundario =
    "rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-deep transition-colors hover:border-mist hover:bg-ice-soft";

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-xs)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          <ShieldCheck size={15} /> Administración
        </h2>
        <span className="text-xs text-muted">
          {admins.length === 1 ? "1 administrador" : `${admins.length} administradores`}
        </span>
      </div>

      {/* Una organización sin administradores no se gobierna sola: nadie puede
          dar de alta médicos ni ver el panel institucional. Se dice, porque una
          lista vacía se lee como "todavía no lo han configurado". */}
      {admins.length === 0 ? (
        <p className="border-b border-line bg-warning-soft px-5 py-3 text-sm text-warning">
          Esta organización no tiene ningún administrador. Nadie puede gestionar su equipo ni
          ver el panel institucional hasta que asignes uno.
        </p>
      ) : null}

      {ownerId === undefined ? (
        <p className="border-b border-line px-5 py-3 text-xs text-muted">
          Falta aplicar la migración del administrador principal: por ahora solo se puede
          cambiar el rol.
        </p>
      ) : admins.length > 0 && !principal ? (
        <p className="border-b border-line px-5 py-3 text-sm text-warning">
          El puesto de administrador principal está vacante. Mientras lo esté, cualquier
          administrador puede degradar a los demás.
        </p>
      ) : null}

      <ul className="divide-y divide-line">
        {admins.map((m) => {
          const esPrincipal = m.id === ownerId;
          return (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-deep">{nombreDe(m)}</span>
                  {esPrincipal ? (
                    <Badge tone="accent">
                      <KeyRound size={12} /> Principal
                    </Badge>
                  ) : null}
                </div>
                <div className="truncate text-xs text-muted">{m.email}</div>
              </div>

              {esPrincipal ? (
                // Sin salida de emergencia a propósito: para quitarle el rol hay
                // que designar antes a otro principal. Así nunca existe el estado
                // "organización sin dueño" creado por un clic de más.
                <span className="text-xs text-muted">
                  Designa a otro principal para poder cambiar su rol.
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {ownerId !== undefined ? (
                    <form action={setOrgOwner}>
                      <input type="hidden" name="orgId" value={orgId} />
                      <input type="hidden" name="userId" value={m.id} />
                      <input type="hidden" name="etiqueta" value={nombreDe(m)} />
                      <button type="submit" className={botonSecundario}>
                        Hacer principal
                      </button>
                    </form>
                  ) : null}
                  <form action={changeOrgMemberRole}>
                    <input type="hidden" name="orgId" value={orgId} />
                    <input type="hidden" name="userId" value={m.id} />
                    <input type="hidden" name="role" value="medico" />
                    <input type="hidden" name="etiqueta" value={nombreDe(m)} />
                    <button
                      type="submit"
                      className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-danger/40 hover:text-danger"
                    >
                      Quitar administrador
                    </button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Ascender: un solo selector y un solo botón, con un único efecto. */}
      <div className="border-t border-line px-5 py-4">
        {candidatos.length === 0 ? (
          <p className="text-xs text-muted">
            No hay más miembros que puedan ascender a administrador.
          </p>
        ) : (
          <form action={changeOrgMemberRole} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="role" value="admin" />
            <label className="min-w-0 flex-1 text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Añadir administrador
              </span>
              <select
                name="userId"
                required
                defaultValue=""
                aria-label="Miembro que pasará a administrador"
                className="w-full rounded-md border border-line bg-field px-3 py-2 text-sm text-deep outline-none focus:border-accent"
              >
                <option value="" disabled>
                  Elegir miembro…
                </option>
                {candidatos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {nombreDe(m)} ·{" "}
                    {isAppRole(m.role) ? APP_ROLE_LABEL[m.role] : m.role}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              <UserPlus size={14} /> Hacer administrador
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
