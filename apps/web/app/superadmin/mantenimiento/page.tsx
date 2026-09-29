// Centro de mantenimiento: el ÚNICO sitio de toda la app donde se da de baja
// gente y organizaciones.
//
// Deliberadamente una página aparte y no botones repartidos por la consola:
//   · Un control irreversible no debe vivir en una pantalla que se abre para
//     leer (el detalle de organización, la lista de usuarios).
//   · Aquí cabe el RADIO DE IMPACTO —"8 miembros · 33 consultas"— que es lo que
//     de verdad evita el error de la fila equivocada.
//   · Y hay un solo lugar que auditar cuando algo desaparece.
//
// Toda acción pide la contraseña del super-admin; la comprueba la base dentro
// de la misma transacción (ver la migración 20260803010000).

import Link from "next/link";
import { Building2, ShieldAlert, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/app/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { formatFechaRelativa } from "@/lib/dates";
import { FlashBanner } from "@/components/superadmin/FlashBanner";
import { FilterBar } from "@/components/superadmin/FilterBar";
import { DangerZoneDialog } from "@/components/superadmin/DangerZoneDialog";
import { getCurrentProfile } from "@/lib/auth/server";
import {
  archiveOrganization,
  deactivateUser,
  deleteOrganization,
  deleteUserPermanently,
  reactivateUser,
  restoreOrganization,
} from "../actions";

const BASE = "/superadmin/mantenimiento";

type OrgFila = {
  id: string;
  name: string;
  kind: string;
  archived_at: string | null;
  miembros: number;
  consultas: number;
  pacientes: number;
  last_activity_at: string | null;
};

type UsuarioFila = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  organization_id: string | null;
  disabled_at: string | null;
  disabled_reason: string | null;
  consultas: number;
  last_sign_in_at: string | null;
};

export default async function MantenimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; q?: string; org?: string }>;
}) {
  const sp = await searchParams;
  const db = await createClient();
  const yo = await getCurrentProfile();

  // Se leen las tablas directamente en vez de reutilizar superadmin_dashboard:
  // aquí hace falta el conteo EXACTO que usan los guardas de la base
  // (incluidas las consultas borradas en suave), no las métricas del panel.
  const [orgsRes, perfilesRes, consultasRes, pacientesRes] = await Promise.all([
    db.from("organizations").select("id, name, kind, archived_at").order("name"),
    db
      .from("profiles")
      .select("id, email, full_name, role, organization_id, disabled_at, disabled_reason")
      .order("email"),
    db.from("consultations").select("id, organization_id, medico_id, fecha"),
    db.from("patients").select("id, organization_id"),
  ]);

  const errorCarga = orgsRes.error ?? perfilesRes.error;
  if (errorCarga) {
    return (
      <div className="space-y-6">
        <Encabezado />
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          No fue posible cargar los datos. Si el error menciona{" "}
          <code>disabled_at</code> o <code>archived_at</code>, falta aplicar la migración{" "}
          <code>superadmin_destructive_ops</code>.
        </div>
      </div>
    );
  }

  const orgsRaw = (orgsRes.data ?? []) as {
    id: string;
    name: string;
    kind: string;
    archived_at: string | null;
  }[];
  const perfiles = (perfilesRes.data ?? []) as Omit<UsuarioFila, "consultas" | "last_sign_in_at">[];
  const consultas = (consultasRes.data ?? []) as {
    organization_id: string | null;
    medico_id: string | null;
    fecha: string;
  }[];
  const pacientes = (pacientesRes.data ?? []) as { organization_id: string | null }[];

  const contar = <T,>(filas: T[], clave: (f: T) => string | null | undefined) => {
    const mapa = new Map<string, number>();
    for (const fila of filas) {
      const k = clave(fila);
      if (k) mapa.set(k, (mapa.get(k) ?? 0) + 1);
    }
    return mapa;
  };

  const consultasPorOrg = contar(consultas, (c) => c.organization_id);
  const consultasPorMedico = contar(consultas, (c) => c.medico_id);
  const pacientesPorOrg = contar(pacientes, (p) => p.organization_id);
  const miembrosPorOrg = contar(perfiles, (p) => p.organization_id);

  const ultimaActividad = new Map<string, string>();
  for (const c of consultas) {
    if (!c.organization_id) continue;
    const previo = ultimaActividad.get(c.organization_id);
    if (!previo || c.fecha > previo) ultimaActividad.set(c.organization_id, c.fecha);
  }

  const orgs: OrgFila[] = orgsRaw.map((o) => ({
    ...o,
    miembros: miembrosPorOrg.get(o.id) ?? 0,
    consultas: consultasPorOrg.get(o.id) ?? 0,
    pacientes: pacientesPorOrg.get(o.id) ?? 0,
    last_activity_at: ultimaActividad.get(o.id) ?? null,
  }));

  const orgNombre = new Map(orgs.map((o) => [o.id, o.name]));

  const termino = (sp.q ?? "").trim().toLowerCase();
  const orgFiltro = orgs.some((o) => o.id === sp.org) ? (sp.org as string) : "todos";

  const usuarios: UsuarioFila[] = perfiles
    .map((p) => ({
      ...p,
      consultas: consultasPorMedico.get(p.id) ?? 0,
      last_sign_in_at: null,
    }))
    .filter((u) => {
      if (orgFiltro !== "todos" && u.organization_id !== orgFiltro) return false;
      if (!termino) return true;
      return `${u.full_name ?? ""} ${u.email}`.toLowerCase().includes(termino);
    });

  const orgsVisibles = orgs.filter((o) => {
    if (orgFiltro !== "todos" && o.id !== orgFiltro) return false;
    if (!termino) return true;
    return o.name.toLowerCase().includes(termino);
  });

  return (
    <div className="space-y-6">
      <Encabezado />
      <FlashBanner ok={sp.ok} error={sp.error} />

      <div className="rounded-[14px] border border-warning/40 bg-warning-soft px-5 py-4 text-sm text-warning">
        <p className="font-semibold">Lo que se hace aquí no se deshace desde ninguna otra parte.</p>
        <p className="mt-1">
          Dar de baja y archivar son reversibles: bloquean el acceso pero no borran nada. Eliminar
          es definitivo, y por eso la base solo lo permite cuando no queda historia clínica de por
          medio.
        </p>
      </div>

      <FilterBar
        basePath={BASE}
        searchPlaceholder="Buscar persona u organización"
        initialQuery={sp.q ?? ""}
        selects={[
          {
            name: "org",
            value: orgFiltro,
            allLabel: "Todas las organizaciones",
            options: orgs.map((o) => ({ value: o.id, label: o.name })),
          },
        ]}
      />

      {/* --- Personas ------------------------------------------------------- */}
      <Card className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          <Users size={15} /> Personas
        </h2>
        <p className="mb-4 mt-1 text-xs text-muted">
          Dar de baja bloquea el acceso y conserva su historia clínica y sus firmas. El borrado
          definitivo solo está disponible para cuentas que nunca generaron nada.
        </p>

        <div className="divide-y divide-line">
          {usuarios.map((u) => {
            const esYo = u.id === yo?.id;
            const esPlataforma = u.role === "superadmin";
            const tieneHistoria = u.consultas > 0;
            const etiqueta = u.full_name || u.email;

            return (
              <div
                key={u.id}
                className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-deep">{etiqueta}</span>
                    {u.disabled_at ? <Badge tone="danger">De baja</Badge> : null}
                    {esPlataforma ? <Badge tone="accent">Plataforma</Badge> : null}
                    {esYo ? <Badge tone="neutral">Tú</Badge> : null}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {u.email}
                    {u.organization_id ? ` · ${orgNombre.get(u.organization_id) ?? "—"}` : ""}
                    {` · ${u.consultas} ${u.consultas === 1 ? "consulta" : "consultas"}`}
                    {u.disabled_at
                      ? ` · de baja ${formatFechaRelativa(u.disabled_at).toLowerCase()}${
                          u.disabled_reason ? `: ${u.disabled_reason}` : ""
                        }`
                      : ""}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  {esYo || esPlataforma ? (
                    <span className="text-xs text-muted">Sin acciones</span>
                  ) : u.disabled_at ? (
                    <DangerZoneDialog
                      titulo={`Reactivar a ${etiqueta}`}
                      descripcion="Vuelve a tener acceso con la misma contraseña y la misma organización."
                      etiquetaBoton="Reactivar"
                      etiquetaConfirmar="Reactivar"
                      tono="neutro"
                      action={reactivateUser}
                      campos={{ userId: u.id, etiqueta }}
                    />
                  ) : (
                    <DangerZoneDialog
                      titulo={`Dar de baja a ${etiqueta}`}
                      descripcion="Deja de poder entrar de inmediato y se cierran sus sesiones abiertas. Es reversible."
                      impacto={
                        <>
                          Se conservan sus{" "}
                          <strong>
                            {u.consultas} {u.consultas === 1 ? "consulta" : "consultas"}
                          </strong>{" "}
                          y las notas que firmó. La historia clínica no se toca.
                        </>
                      }
                      etiquetaBoton="Dar de baja"
                      etiquetaConfirmar="Dar de baja"
                      tono="aviso"
                      action={deactivateUser}
                      campos={{ userId: u.id, etiqueta }}
                      pedirMotivo
                    />
                  )}

                  <DangerZoneDialog
                    titulo={`Eliminar a ${etiqueta}`}
                    descripcion="Borra la cuenta de forma definitiva. No se puede deshacer."
                    impacto={
                      <>
                        La cuenta no tiene historia clínica asociada, así que no se pierde ningún
                        dato de pacientes. El registro de auditoría de lo que hizo se conserva.
                      </>
                    }
                    etiquetaBoton="Eliminar"
                    etiquetaConfirmar="Eliminar definitivamente"
                    action={deleteUserPermanently}
                    campos={{ userId: u.id, etiqueta }}
                    deshabilitado={esYo || esPlataforma || tieneHistoria}
                    razonDeshabilitado={
                      esYo
                        ? "No puedes eliminar tu propia cuenta."
                        : esPlataforma
                          ? "Las cuentas de plataforma no se eliminan desde aquí."
                          : `Tiene ${u.consultas} consultas: su historia clínica debe conservarse. Usa Dar de baja.`
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>

        {usuarios.length === 0 ? (
          <EmptyState
            icon={<Users size={20} />}
            title="Nadie coincide con el filtro"
            description="Prueba con otro término o quita los filtros."
          />
        ) : null}
      </Card>

      {/* --- Organizaciones ------------------------------------------------- */}
      <Card className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          <Building2 size={15} /> Organizaciones
        </h2>
        <p className="mb-4 mt-1 text-xs text-muted">
          Archivar es la vía normal: la organización sale de toda la consola y sus miembros dejan
          de entrar, pero nada se borra. Eliminar solo se permite si está completamente vacía.
        </p>

        <div className="divide-y divide-line">
          {orgsVisibles.map((org) => {
            const esMia = org.id === yo?.organizationId;
            const vacia = org.miembros === 0 && org.consultas === 0 && org.pacientes === 0;
            const impacto = (
              <>
                <strong>{org.miembros}</strong> {org.miembros === 1 ? "miembro" : "miembros"} ·{" "}
                <strong>{org.consultas}</strong>{" "}
                {org.consultas === 1 ? "consulta" : "consultas"} ·{" "}
                <strong>{org.pacientes}</strong>{" "}
                {org.pacientes === 1 ? "paciente" : "pacientes"}
              </>
            );

            return (
              <div key={org.id} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/superadmin/organizaciones/${org.id}`}
                      className="truncate font-medium text-deep hover:text-accent"
                    >
                      {org.name}
                    </Link>
                    {org.archived_at ? <Badge tone="warning">Archivada</Badge> : null}
                    {esMia ? <Badge tone="accent">La tuya</Badge> : null}
                    {vacia && !org.archived_at ? <Badge tone="neutral">Vacía</Badge> : null}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {org.kind === "institution" ? "Hospital" : "Personal"} · {org.miembros}{" "}
                    {org.miembros === 1 ? "miembro" : "miembros"} · {org.consultas}{" "}
                    {org.consultas === 1 ? "consulta" : "consultas"} ·{" "}
                    {org.last_activity_at
                      ? `última actividad ${formatFechaRelativa(org.last_activity_at).toLowerCase()}`
                      : "sin actividad"}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  {esMia ? (
                    <span className="text-xs text-muted">Sin acciones</span>
                  ) : org.archived_at ? (
                    <DangerZoneDialog
                      titulo={`Restaurar «${org.name}»`}
                      descripcion="Vuelve a aparecer en la consola y sus miembros pueden entrar de nuevo."
                      etiquetaBoton="Restaurar"
                      etiquetaConfirmar="Restaurar"
                      tono="neutro"
                      action={restoreOrganization}
                      campos={{ orgId: org.id, etiqueta: org.name }}
                    />
                  ) : (
                    <DangerZoneDialog
                      titulo={`Archivar «${org.name}»`}
                      descripcion="Sale de la consola y del resto de la app, y sus miembros dejan de poder entrar. No se borra nada y se puede restaurar."
                      impacto={impacto}
                      etiquetaBoton="Archivar"
                      etiquetaConfirmar="Archivar"
                      tono="aviso"
                      action={archiveOrganization}
                      campos={{ orgId: org.id, etiqueta: org.name }}
                    />
                  )}

                  <DangerZoneDialog
                    titulo={`Eliminar «${org.name}»`}
                    descripcion="Borra la organización de forma definitiva. No se puede deshacer."
                    impacto={<>Está vacía: no hay miembros, consultas ni pacientes que perder.</>}
                    etiquetaBoton="Eliminar"
                    etiquetaConfirmar="Eliminar definitivamente"
                    action={deleteOrganization}
                    campos={{ orgId: org.id, etiqueta: org.name }}
                    deshabilitado={esMia || !vacia}
                    razonDeshabilitado={
                      esMia
                        ? "No puedes eliminar tu propia organización."
                        : `Tiene ${org.miembros} miembros, ${org.consultas} consultas y ${org.pacientes} pacientes. Borrarla destruiría esa historia clínica: archívala, o mueve a sus miembros primero.`
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>

        {orgsVisibles.length === 0 ? (
          <EmptyState
            icon={<Building2 size={20} />}
            title="Ninguna organización coincide"
            description="Prueba con otro término o quita los filtros."
          />
        ) : null}
      </Card>
    </div>
  );
}

function Encabezado() {
  return (
    <div>
      <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-deep">
        <ShieldAlert size={22} className="text-danger" /> Mantenimiento
      </h1>
      <p className="text-sm text-muted">
        Dar de baja, archivar y eliminar. El único lugar de la plataforma donde se puede, y todo
        pide tu contraseña.
      </p>
    </div>
  );
}
