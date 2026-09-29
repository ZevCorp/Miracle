// Consulta del registro de actividad (public.audit_events).
//
// Vive aparte de la página porque la comparten DOS consumidores que deben
// devolver exactamente las mismas filas: el explorador en pantalla y la
// exportación a CSV. Si la construcción del filtro se duplicara, el día que
// alguien añada un filtro el archivo descargado dejaría de coincidir con lo que
// se ve — que es la peor forma de fallar en una herramienta de auditoría.

import type { createClient } from "@/lib/supabase/server";
import { filtroBusqueda } from "@/lib/superadmin/filtros";
import { limitesIso, type RangoResuelto } from "@/lib/superadmin/rango";

type ClienteServidor = Awaited<ReturnType<typeof createClient>>;

/** Columnas que devuelven tanto el explorador como la exportación. */
const COLUMNAS =
  "id, accion, detalle, fecha, actor_id, actor_name, consultation_id, organization_id, organizations(name)";

/** Acciones que el backend escribe como slug; el resto ya vienen en español. */
const ETIQUETA_ACCION: Record<string, string> = {
  agent_link_creado: "Vínculo de escritorio creado",
  agent_link_usado: "Vínculo de escritorio usado",
};

export function etiquetaAccion(accion: string): string {
  return ETIQUETA_ACCION[accion] ?? accion;
}

export type EventoAuditoria = {
  id: string;
  accion: string;
  detalle: string | null;
  fecha: string;
  actor_id: string | null;
  actor_name: string | null;
  consultation_id: string | null;
  organization_id: string | null;
  organizations: { name: string } | { name: string }[] | null;
};

export type FiltrosActividad = {
  rango: RangoResuelto;
  org: string;
  accion: string;
  actor: string;
  termino: string;
};

/** Lee y valida los searchParams del explorador contra las opciones reales. */
export function resolverFiltros(
  sp: { org?: string; accion?: string; actor?: string; q?: string },
  rango: RangoResuelto,
  opciones: { orgs: { id: string }[]; acciones: string[]; actores: { id: string }[] },
): FiltrosActividad {
  return {
    rango,
    org: opciones.orgs.some((o) => o.id === sp.org) ? (sp.org as string) : "todos",
    accion: opciones.acciones.includes(sp.accion ?? "") ? (sp.accion as string) : "todos",
    actor: opciones.actores.some((a) => a.id === sp.actor) ? (sp.actor as string) : "todos",
    termino: (sp.q ?? "").trim(),
  };
}

/**
 * Aplica los filtros a una consulta de audit_events.
 *
 * NOTA sobre el embed: se une a `organizations` pero NO a `profiles`.
 * `audit_events.actor_id` es un uuid suelto sin clave foránea, así que pedir
 * `profiles(email)` falla con "could not find a relationship". El nombre del
 * actor ya viene desnormalizado en `actor_name`, que además es el valor
 * histórico correcto: si alguien cambia de nombre, la auditoría debe seguir
 * diciendo cómo se llamaba cuando ocurrió el hecho.
 */
export function construirConsulta(db: ClienteServidor, filtros: FiltrosActividad) {
  const { desdeIso, hastaIso } = limitesIso(filtros.rango);

  // `count: "exact"` siempre: el explorador lo necesita para paginar y la
  // exportación para saber si recortó filas y avisarlo dentro del archivo.
  let q = db
    .from("audit_events")
    .select(COLUMNAS, { count: "exact" })
    .gte("fecha", desdeIso)
    .lt("fecha", hastaIso)
    .order("fecha", { ascending: false });

  if (filtros.org !== "todos") q = q.eq("organization_id", filtros.org);
  if (filtros.accion !== "todos") q = q.eq("accion", filtros.accion);
  if (filtros.actor !== "todos") q = q.eq("actor_id", filtros.actor);

  const busqueda = filtroBusqueda(filtros.termino, ["accion", "detalle", "actor_name"]);
  if (busqueda) q = q.or(busqueda);

  return q;
}

/**
 * Opciones de los desplegables: se leen de los datos, no de una lista fija.
 * Las acciones las escriben esta app y el backend Graph, que añade valores
 * nuevos sin avisar; una constante en el código se quedaría corta en silencio.
 */
export async function cargarOpciones(db: ClienteServidor) {
  const [orgsRes, distintosRes] = await Promise.all([
    db.from("organizations").select("id, name").order("name"),
    db.from("audit_events").select("accion, actor_id, actor_name").limit(5000),
  ]);

  const orgs = (orgsRes.data ?? []) as { id: string; name: string }[];
  const distintos = (distintosRes.data ?? []) as {
    accion: string;
    actor_id: string | null;
    actor_name: string | null;
  }[];

  const acciones = [...new Set(distintos.map((d) => d.accion))].sort();
  const actoresMap = new Map<string, string>();
  for (const d of distintos) {
    if (d.actor_id && !actoresMap.has(d.actor_id)) {
      actoresMap.set(d.actor_id, d.actor_name || "Sin nombre");
    }
  }
  const actores = [...actoresMap.entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return { orgs, acciones, actores };
}

/** Parámetros de los filtros para enlaces (paginador, exportación, chips). */
export function paramsFiltros(filtros: FiltrosActividad): Record<string, string | undefined> {
  return {
    ...filtros.rango.params,
    org: filtros.org === "todos" ? undefined : filtros.org,
    accion: filtros.accion === "todos" ? undefined : filtros.accion,
    actor: filtros.actor === "todos" ? undefined : filtros.actor,
    q: filtros.termino || undefined,
  };
}

/** Desenvuelve el embed a-uno, que Supabase tipa como array. */
export function nombreOrg(evento: EventoAuditoria): string | null {
  const org = Array.isArray(evento.organizations) ? evento.organizations[0] : evento.organizations;
  return org?.name ?? null;
}
