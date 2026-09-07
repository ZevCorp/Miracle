import { Ban, Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { requireRole } from "@/lib/auth/server";
import { APP_ROLE_LABEL, type AppRole } from "@/lib/auth/roles";
import { assignableRolesFor } from "@/lib/superadmin/roles";
import { createClient } from "@/lib/supabase/server";
import { formatFechaRelativa } from "@/lib/dates";
import { FlashBanner } from "@/components/superadmin/FlashBanner";
import { AppPage, AppPageHeader } from "@/components/app/AppPage";
import { UsuariosFilters } from "./UsuariosFilters";
import { setUserArea, updateUserRole } from "./actions";
import { createDoctorAccount } from "@/app/superadmin/actions";

const roleTone: Record<AppRole, "accent" | "mint" | "neutral"> = {
  superadmin: "accent",
  medico: "accent",
  supervisor: "mint",
  admin: "neutral",
  admin_area: "mint",
  secretaria: "neutral",
};

const SIN_AREA = "sin-area";

const inputClass =
  "w-full rounded-md border border-line bg-field px-3 py-2 text-sm text-deep outline-none focus:border-accent";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  created_at: string;
  /** Cuenta dada de baja desde /superadmin/mantenimiento. */
  disabled_at: string | null;
  disabled_reason: string | null;
};

type AreaRow = { id: string; name: string };

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; q?: string; rol?: string }>;
}) {
  const profile = await requireRole("admin", "admin_area");
  const { ok, error: flashError, q, rol } = await searchParams;

  const esJefeDeArea = profile.role === "admin_area";
  // Lo que ESTE rol puede repartir. Un jefe de servicio no ve en el desplegable
  // las opciones de administrador, y si las manda a mano la base las recorta.
  const repartibles = assignableRolesFor(profile.role);
  const puedeRepartir = (r: AppRole): boolean =>
    (repartibles as readonly string[]).includes(r);

  const supabase = await createClient();

  // La lista NO se filtra por área en el cliente: la RLS ya se la acota a un
  // jefe de servicio (profiles_select_self exige private.supervises). Filtrar
  // aquí además sería una segunda regla que mantener sincronizada con la
  // primera, y la que manda es la de la base.
  //
  // `area_id` va en su propia consulta, tolerante: si el código llega antes que
  // la migración de áreas, la columna no existe y pedirla dentro del select
  // principal dejaría al admin sin la pantalla de usuarios entera.
  const [{ data, error }, { data: areasData }, { data: areaAsignada }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, role, created_at, disabled_at, disabled_reason")
        .order("created_at", { ascending: true }),
      supabase.from("org_areas").select("id, name").order("name"),
      supabase.from("profiles").select("id, area_id"),
    ]);

  if (error) {
    throw new Error("No fue posible cargar los usuarios.");
  }

  const users = (data ?? []) as ProfileRow[];
  const areas = (areasData ?? []) as AreaRow[];
  const hayAreas = areas.length > 0;
  const areaPorUsuario = new Map<string, string | null>(
    ((areaAsignada ?? []) as { id: string; area_id: string | null }[]).map((r) => [
      r.id,
      r.area_id,
    ]),
  );
  const nombreArea = new Map(areas.map((a) => [a.id, a.name]));
  const miArea = profile.areaId ? nombreArea.get(profile.areaId) ?? null : null;

  // Filtrado en memoria: la lista es el equipo de una institución (decenas de
  // personas), así que traerla completa y filtrarla aquí evita un viaje a la
  // base por cada tecla y mantiene el contador "N de M" siempre exacto.
  const termino = (q ?? "").trim().toLowerCase();
  const rolFiltro = (rol ?? "todos").trim();
  const visibles = users.filter((u) => {
    if (rolFiltro !== "todos" && u.role !== rolFiltro) return false;
    if (!termino) return true;
    return (
      (u.full_name ?? "").toLowerCase().includes(termino) ||
      u.email.toLowerCase().includes(termino)
    );
  });

  const activos = users.filter((u) => !u.disabled_at).length;
  const dadosDeBaja = users.length - activos;

  return (
    <AppPage>
      <AppPageHeader
        title="Usuarios y roles"
        description={
          <>
            {users.length} {users.length === 1 ? "cuenta" : "cuentas"} · {activos}{" "}
            {activos === 1 ? "activa" : "activas"}
            {dadosDeBaja > 0 ? ` · ${dadosDeBaja} dada${dadosDeBaja === 1 ? "" : "s"} de baja` : ""}
            {/* Un jefe de servicio ve una lista recortada por la RLS. Sin
                decírselo, "6 cuentas" en un hospital de 53 parece un error. */}
            {esJefeDeArea ? (
              <> · solo tu área{miArea ? `: ${miArea}` : " (todavía sin asignar)"}</>
            ) : null}
          </>
        }
      />

      <div className="mt-5 space-y-5">
        <FlashBanner ok={ok} error={flashError} />

        {esJefeDeArea && !profile.areaId ? (
          <Card>
            <p className="text-sm text-deep">
              Todavía no tienes un área asignada, así que no ves ni gestionas a
              nadie. Pídele al administrador de la institución que te asigne la
              tuya desde esta misma pantalla.
            </p>
          </Card>
        ) : null}

        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-deep">
            <UserPlus size={16} />{" "}
            {esJefeDeArea ? "Agregar profesional a tu área" : "Agregar profesional a tu institución"}
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
              <span className="mb-1 block font-medium text-deep">Rol</span>
              <select name="role" defaultValue="medico" className={inputClass}>
                {repartibles.map((r) => (
                  <option key={r} value={r}>
                    {APP_ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            {hayAreas && !esJefeDeArea ? (
              <label className="text-sm">
                <span className="mb-1 block font-medium text-deep">Área</span>
                <select name="areaId" defaultValue="" className={inputClass}>
                  <option value="">Sin área</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="text-sm">
              <span className="mb-1 block font-medium text-deep">Contraseña</span>
              <input
                name="password"
                type="text"
                required
                minLength={8}
                placeholder="mín. 8"
                autoComplete="off"
                className={inputClass}
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              Crear
            </button>
          </form>
          <p className="mt-2 text-xs text-muted">
            {esJefeDeArea
              ? "La cuenta nace en tu área y con rol de médico o supervisor. Comparte el correo y la contraseña con el profesional."
              : "La cuenta queda en tu organización. Comparte el correo y la contraseña con el profesional."}
          </p>
        </Card>

        <UsuariosFilters initialQuery={q ?? ""} initialRol={rolFiltro} />

        <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
          <div
            className={`hidden gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted sm:grid ${
              hayAreas ? "grid-cols-[1.6fr_1fr_1fr_auto]" : "grid-cols-[1.6fr_1fr_auto]"
            }`}
          >
            <span>Usuario</span>
            <span>Rol</span>
            {hayAreas ? <span>Área</span> : null}
            <span>Estado</span>
          </div>

          {visibles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ice text-muted">
                <Search size={20} />
              </span>
              <p className="font-medium text-deep">Ninguna cuenta coincide</p>
              <p className="text-sm text-muted">
                Ajusta la búsqueda o el filtro de rol.
              </p>
            </div>
          ) : (
            visibles.map((user, index) => {
              const deBaja = Boolean(user.disabled_at);
              // Un rol que esta pantalla no puede asignar NO se muestra como
              // selector: el <select> no tendría su opción, el navegador
              // mostraría la primera ("Médico") como si fuera la actual y un
              // clic en Guardar cambiaría el rol sin que nadie lo pidiera.
              const editable = puedeRepartir(user.role) && !deBaja;
              const areaActual = areaPorUsuario.get(user.id) ?? null;
              // Un jefe de servicio no reasigna a nadie a OTRA área: lo único
              // que puede hacer es sacarlo de la suya. Ofrecerle el desplegable
              // completo sería enseñarle opciones que la base va a rechazar.
              const areasOfrecidas = esJefeDeArea
                ? areas.filter((a) => a.id === profile.areaId)
                : areas;

              return (
                <div
                  key={user.id}
                  className={`grid grid-cols-1 gap-3 px-5 py-4 sm:items-center sm:gap-4 ${
                    hayAreas ? "sm:grid-cols-[1.6fr_1fr_1fr_auto]" : "sm:grid-cols-[1.6fr_1fr_auto]"
                  } ${index ? "border-t border-line" : ""} ${deBaja ? "bg-ice-soft/60" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-deep">
                      {user.full_name || user.email}
                    </div>
                    {user.full_name ? (
                      <div className="truncate text-sm text-muted">{user.email}</div>
                    ) : null}
                  </div>

                  {editable ? (
                    <form action={updateUserRole} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <select
                        name="role"
                        defaultValue={user.role}
                        aria-label={`Rol de ${user.email}`}
                        className="rounded-md border border-line bg-field px-3 py-2 text-sm text-deep outline-none focus:border-accent"
                      >
                        {repartibles.map((r) => (
                          <option key={r} value={r}>
                            {APP_ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-full px-3 py-2 text-xs font-semibold text-accent hover:bg-ice-soft"
                      >
                        Guardar
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge tone={roleTone[user.role]}>{APP_ROLE_LABEL[user.role]}</Badge>
                      <span className="text-xs text-muted">
                        {deBaja ? "cuenta inactiva" : "no editable aquí"}
                      </span>
                    </div>
                  )}

                  {hayAreas ? (
                    deBaja ? (
                      <span className="text-sm text-muted">
                        {areaActual ? nombreArea.get(areaActual) ?? "—" : "Sin área"}
                      </span>
                    ) : (
                      <form action={setUserArea} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <select
                          name="areaId"
                          defaultValue={areaActual ?? SIN_AREA}
                          aria-label={`Área de ${user.email}`}
                          className="min-w-0 flex-1 rounded-md border border-line bg-field px-3 py-2 text-sm text-deep outline-none focus:border-accent"
                        >
                          <option value={SIN_AREA}>
                            {esJefeDeArea ? "Sacar de mi área" : "Sin área"}
                          </option>
                          {areasOfrecidas.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-full px-3 py-2 text-xs font-semibold text-accent hover:bg-ice-soft"
                        >
                          Guardar
                        </button>
                      </form>
                    )
                  ) : null}

                  {/* Estado REAL de la cuenta. Antes esta columna decía "Activo"
                      fijo en el JSX, así que una cuenta dada de baja se veía
                      igual que una operativa. */}
                  {deBaja ? (
                    <span
                      className="flex items-center gap-2 text-sm font-medium text-danger"
                      title={user.disabled_reason ?? undefined}
                    >
                      <Ban size={15} />
                      Dada de baja {formatFechaRelativa(user.disabled_at!)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-sm font-medium text-success">
                      <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                      Activo
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {visibles.length !== users.length ? (
          <p className="text-xs text-muted">
            Mostrando {visibles.length} de {users.length} cuentas.
          </p>
        ) : null}

        <p className="text-xs text-muted">
          Dar de baja o reactivar una cuenta se hace desde la consola de plataforma
          de Miracle. Escríbenos si necesitas cerrar el acceso de alguien.
        </p>
      </div>
    </AppPage>
  );
}
