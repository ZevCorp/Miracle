import Link from "next/link";
import { ChevronDown, ShieldAlert, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/app/EmptyState";
import { APP_ROLE_LABEL, APP_ROLES, isAppRole } from "@/lib/auth/roles";
import { isAssignableRole } from "@/lib/superadmin/roles";
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
  searchParams: Promise<{
    ok?: string;
    error?: string;
    q?: string;
    org?: string;
    rol?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const sp = await searchParams;
  const db = await createClient();

  // La fuente pasa de `profiles` crudo a la RPC de actividad: además de quién
  // existe, trae quién entra y quién dicta — la señal que faltaba en esta vista.
  const [orgsRes, activityRes] = await Promise.all([
    // Sin las archivadas: estos desplegables son destinos de asignación, y
    // mover a alguien a una organización archivada lo dejaría sin poder entrar.
    db.from("organizations").select("id, name, kind").is("archived_at", null).order("name"),
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

  /* ORDEN POR COLUMNA, por URL y resuelto en el servidor.
     Es lo que convierte una lista en una tabla de trabajo: con 64 cuentas la
     pregunta nunca es "quien esta", es "quien no ha entrado nunca" o "quien
     mas dicta". Sin una linea de JS: cada encabezado es un enlace. */
  const ORDENABLES = ["usuario", "org", "rol", "ingreso", "actividad", "trabajo", "estado"] as const;
  type Columna = (typeof ORDENABLES)[number];
  const columna: Columna = (ORDENABLES as readonly string[]).includes(sp.sort ?? "")
    ? (sp.sort as Columna)
    : "usuario";
  const desc = sp.dir === "desc";

  function clave(user: (typeof usuarios)[number], col: Columna): string | number {
    switch (col) {
      case "org":
        return (orgName.get(user.organization_id ?? "") ?? "").toLowerCase();
      case "rol":
        return user.role;
      // Fechas en ISO: comparar como texto ya las ordena bien. El vacio queda
      // primero al ascender, que es justo a quien se busca ("nunca entro").
      case "ingreso":
        return user.last_sign_in_at ?? "";
      case "actividad":
        return user.last_activity_at ?? "";
      case "trabajo":
        return user.consultations_30d + user.encounters_30d;
      case "estado":
        return user.disabled_at ? "zz" : userState(user).label;
      default:
        return (user.full_name || user.email).toLowerCase();
    }
  }

  usuarios.sort((a, b) => {
    const va = clave(a, columna);
    const vb = clave(b, columna);
    const cmp =
      typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "es");
    return desc ? -cmp : cmp;
  });

  /** Enlace del encabezado: conserva los filtros y alterna la direccion. */
  function hrefOrden(col: Columna): string {
    const q = new URLSearchParams();
    if (sp.q) q.set("q", sp.q);
    if (sp.org) q.set("org", sp.org);
    if (sp.rol) q.set("rol", sp.rol);
    q.set("sort", col);
    q.set("dir", columna === col && !desc ? "desc" : "asc");
    return `/superadmin/usuarios?${q.toString()}`;
  }

  const GRID =
    "xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_.8fr_.85fr_.85fr_.55fr_.8fr_auto]";

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

      {/* --- Tabla -----------------------------------------------------------
          Antes: el nombre y el correo compartían una columna estrecha y salían
          cortados («Dra. …», «patolo…»), mientras DOS desplegables y un
          «Guardar» por fila ocupaban un quinto del ancho de forma permanente
          para una acción que se hace de vez en cuando. En una lista de usuarios
          lo único imprescindible es saber quién es quién.

          Ahora: la identidad manda, la organización es columna propia (y se
          ordena), y reasignar se pliega dentro de la fila: se abre solo la que
          se toca. Sin una línea de JS — cada fila es un <details>. */}
      <div className="rounded-[14px] border border-line bg-surface shadow-[var(--shadow-xs)]">
        <div
          className={`hidden gap-3 border-b border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted xl:grid ${GRID}`}
        >
          <Orden href={hrefOrden("usuario")} activa={columna === "usuario"} desc={desc}>
            Usuario
          </Orden>
          <Orden href={hrefOrden("org")} activa={columna === "org"} desc={desc}>
            Organización
          </Orden>
          <Orden href={hrefOrden("rol")} activa={columna === "rol"} desc={desc}>
            Rol
          </Orden>
          <Orden href={hrefOrden("ingreso")} activa={columna === "ingreso"} desc={desc}>
            Último ingreso
          </Orden>
          <Orden href={hrefOrden("actividad")} activa={columna === "actividad"} desc={desc}>
            Última consulta
          </Orden>
          <Orden
            href={hrefOrden("trabajo")}
            activa={columna === "trabajo"}
            desc={desc}
            className="xl:justify-center"
          >
            7d/30d
          </Orden>
          <Orden href={hrefOrden("estado")} activa={columna === "estado"} desc={desc}>
            Estado
          </Orden>
          <span />
        </div>

        {usuarios.map((user) => {
          const estado = userState(user);
          const work7 = user.consultations_7d + user.encounters_7d;
          const work30 = user.consultations_30d + user.encounters_30d;
          const organizacion = user.organization_id
            ? (orgName.get(user.organization_id) ?? "—")
            : "—";
          // Solo estas filas se reasignan; las demás no se abren.
          const editable = user.role !== "superadmin" && !user.disabled_at;

          const celdas = (
            <>
              <div className="min-w-0">
                <div className="truncate font-medium text-deep">
                  {user.full_name || user.email}
                </div>
                <div className="data truncate text-[12px] text-muted">{user.email}</div>
              </div>

              <div className="min-w-0 truncate text-sm text-muted">{organizacion}</div>

              <div>
                <Badge tone={user.role === "superadmin" ? "accent" : "neutral"}>
                  {isAppRole(user.role) ? APP_ROLE_LABEL[user.role] : user.role}
                </Badge>
              </div>

              <div className="text-[13px] text-muted">
                {user.last_sign_in_at ? formatFechaRelativa(user.last_sign_in_at) : "Nunca"}
              </div>

              <div className="text-[13px] text-muted">
                {user.last_activity_at ? formatFechaRelativa(user.last_activity_at) : "—"}
              </div>

              <div className="data text-[13px] text-deep xl:text-center">
                {user.role === "medico" ? (
                  <>
                    <span className="font-semibold">{work7}</span>
                    <span className="text-muted">/{work30}</span>
                  </>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>

              {/* Una cuenta dada de baja no tiene «estado de uso»: lo relevante
                  es que está cerrada, y eso gana a cualquier otra etiqueta. */}
              {user.disabled_at ? (
                <div title={user.disabled_reason ?? "Cuenta dada de baja"}>
                  <Badge tone="danger">De baja</Badge>
                </div>
              ) : (
                <div title={estado.hint}>
                  <Badge tone={estado.tone}>{estado.label}</Badge>
                </div>
              )}
            </>
          );

          const filaClase = `grid grid-cols-1 gap-2 px-4 py-2.5 xl:items-center xl:gap-3 ${GRID}`;

          if (!editable) {
            return (
              <div key={user.id} className={`${filaClase} border-t border-line`}>
                {celdas}
                {user.disabled_at ? (
                  <Link
                    href="/superadmin/mantenimiento"
                    className="text-[12px] font-semibold text-accent hover:underline"
                  >
                    Reactivar →
                  </Link>
                ) : (
                  <span className="text-[12px] text-muted">Plataforma</span>
                )}
              </div>
            );
          }

          return (
            <details key={user.id} className="group border-t border-line">
              <summary
                className={`${filaClase} cursor-pointer list-none hover:bg-ice-soft/60 group-open:bg-ice-soft/70 [&::-webkit-details-marker]:hidden`}
              >
                {celdas}
                <span className="flex items-center gap-1 text-[12px] font-semibold text-accent">
                  Editar
                  <ChevronDown
                    size={14}
                    className="transition-transform group-open:rotate-180"
                  />
                </span>
              </summary>

              <div className="border-t border-line/60 bg-pearl px-4 py-3">
                <form action={assignUserToOrg} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="userId" value={user.id} />
                  <label className="text-[12px]">
                    <span className="mb-1 block font-semibold text-muted">Organización</span>
                    <select
                      name="organizationId"
                      defaultValue={user.organization_id ?? ""}
                      aria-label={`Organización de ${user.email}`}
                      className="rounded-md border border-line bg-field px-2.5 py-2 text-sm text-deep outline-none focus:border-accent"
                    >
                      {orgs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {/* La opción del rol ACTUAL siempre está presente, aunque no
                      sea asignable desde aquí (secretaria). Sin ella el
                      navegador seleccionaba la primera opción —médico— y
                      guardar un simple cambio de organización le quitaba el rol
                      en silencio. La RPC además conserva el rol si no se manda
                      uno, así que hay doble red. */}
                  <label className="text-[12px]">
                    <span className="mb-1 block font-semibold text-muted">Rol</span>
                    <select
                      name="role"
                      defaultValue={user.role}
                      aria-label={`Rol de ${user.email}`}
                      className="rounded-md border border-line bg-field px-2.5 py-2 text-sm text-deep outline-none focus:border-accent"
                    >
                      {!isAssignableRole(user.role) ? (
                        <option value={user.role}>
                          {isAppRole(user.role) ? APP_ROLE_LABEL[user.role] : user.role} (actual)
                        </option>
                      ) : null}
                      <option value="medico">Médico</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </label>
                  <button type="submit" className="clinical-primary min-h-10 px-4 text-[13px]">
                    Guardar
                  </button>
                </form>
              </div>
            </details>
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
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold text-deep">Usuarios</h1>
        <p className="text-sm text-muted">
          Todas las personas de todas las organizaciones, con su actividad real: quién entra,
          quién dicta y quién nunca arrancó.
        </p>
      </div>
      {/* Dar de baja no vive aquí a propósito: un control irreversible no debe
          estar en la pantalla que se abre para consultar. */}
      <Link
        href="/superadmin/mantenimiento"
        className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-deep hover:border-mist"
      >
        <ShieldAlert size={15} className="text-danger" /> Dar de baja o eliminar
      </Link>
    </div>
  );
}

/**
 * Encabezado que ordena. Es un enlace, no un botón con estado: el orden vive en
 * la URL, así que se puede compartir y sobrevive a recargar.
 */
function Orden({
  href,
  activa,
  desc,
  className = "",
  children,
}: {
  href: string;
  activa: boolean;
  desc: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-sort={activa ? (desc ? "descending" : "ascending") : "none"}
      className={`flex items-center gap-1 transition-colors hover:text-deep ${
        activa ? "text-deep" : ""
      } ${className}`}
    >
      {children}
      {/* La flecha solo en la columna activa: seis flechas grises a la vez son
          ruido, y no dicen cuál manda. */}
      {activa ? (
        <ChevronDown
          size={12}
          className={desc ? "" : "rotate-180"}
          aria-hidden
        />
      ) : null}
    </Link>
  );
}
