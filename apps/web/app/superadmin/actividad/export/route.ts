// Descarga del registro de actividad en CSV.
//
// Route handler y no server action: una server action no puede devolver una
// descarga — habría que pasar el archivo en base64 por el payload RSC y armar
// un objectURL en el cliente. Un GET con Content-Disposition es un <a href>
// sin una línea de JavaScript, y hereda los filtros copiando los searchParams
// de la página.
//
// La ruta está bajo /superadmin/*, así que proxy.ts ya refresca la sesión y
// rebota a quien no sea superadmin; aquí se vuelve a comprobar de todas formas:
// el proxy es UX, la barrera autoritativa es esta.

import type { NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { formatFechaHoraTabular } from "@/lib/dates";
import { cabecerasCsv, nombreArchivoCsv, toCsv } from "@/lib/superadmin/csv";
import { resolverRango } from "@/lib/superadmin/rango";
import {
  cargarOpciones,
  construirConsulta,
  etiquetaAccion,
  nombreOrg,
  resolverFiltros,
  type EventoAuditoria,
} from "@/lib/superadmin/actividad";

export const dynamic = "force-dynamic";

/** Tope de filas por descarga. Ver el aviso que toCsv escribe en el archivo. */
const MAX_FILAS = 5000;

const CABECERAS = [
  "fecha_bogota",
  "fecha_iso",
  "accion",
  "persona",
  "organizacion",
  "detalle",
  "consulta_id",
  "evento_id",
];

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "superadmin") {
    return new Response("No autorizado", { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const leer = (clave: string) => sp.get(clave) ?? undefined;

  const db = await createClient();
  const rango = resolverRango({
    rango: leer("rango"),
    desde: leer("desde"),
    hasta: leer("hasta"),
  });
  const opciones = await cargarOpciones(db);
  const filtros = resolverFiltros(
    { org: leer("org"), accion: leer("accion"), actor: leer("actor"), q: leer("q") },
    rango,
    opciones,
  );

  const { data, count, error } = await construirConsulta(db, filtros).range(0, MAX_FILAS - 1);

  if (error) {
    return new Response(`No fue posible generar la exportación: ${error.message}`, {
      status: 500,
    });
  }

  const eventos = (data ?? []) as unknown as EventoAuditoria[];
  const total = count ?? eventos.length;
  const truncado = total > MAX_FILAS;

  if (truncado) {
    // Además del aviso dentro del archivo, queda rastro en los logs de Vercel:
    // un export recortado en silencio se lee después como "esto es todo".
    console.warn(
      `[superadmin/actividad/export] recortado: ${MAX_FILAS} de ${total} filas (${rango.desde}..${rango.hasta})`,
    );
  }

  const filas = eventos.map((evento) => [
    formatFechaHoraTabular(evento.fecha),
    evento.fecha,
    etiquetaAccion(evento.accion),
    evento.actor_name ?? "Sistema",
    nombreOrg(evento) ?? "",
    evento.detalle ?? "",
    evento.consultation_id ?? "",
    evento.id,
  ]);

  const csv = toCsv(CABECERAS, filas, {
    // ?sep=coma para pandas / Google Sheets; por defecto ';', que es lo que
    // espera Excel con configuración regional en español.
    separador: sp.get("sep") === "coma" ? "," : ";",
    truncadoEn: truncado ? { exportadas: MAX_FILAS, total } : null,
  });

  return new Response(csv, {
    headers: cabecerasCsv(
      nombreArchivoCsv("actividad", `${rango.desde}_${rango.hasta}`),
    ),
  });
}
