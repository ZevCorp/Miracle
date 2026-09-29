// Descarga de la adopción por profesional en CSV.
//
// Route handler y no server action: una server action no puede devolver una
// descarga. Un GET con Content-Disposition es un <a href> sin una línea de
// JavaScript, y hereda el periodo copiando los searchParams de la página.
//
// El proxy ya exige sesión para /app/*, pero el rol se vuelve a comprobar aquí:
// el proxy es UX, la barrera autoritativa es esta. Y por debajo sigue estando la
// RLS, que acota los datos a la organización de quien pide.

import type { NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { formatFechaHoraTabular } from "@/lib/dates";
import { cabecerasCsv, nombreArchivoCsv, toCsv } from "@/lib/superadmin/csv";
import { resolverRango } from "@/lib/superadmin/rango";
import {
  ETIQUETA_ADOPCION,
  estadoAdopcion,
  fetchHospitalDashboard,
} from "@/lib/hospital/dashboard";

export const dynamic = "force-dynamic";

const CABECERAS = [
  "profesional",
  "estado",
  "notas_en_periodo",
  "sin_firmar",
  "completitud_pct",
  "ultima_nota_bogota",
  "ultima_nota_iso",
  "medico_id",
];

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "supervisor")) {
    return new Response("No autorizado", { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const rango = resolverRango({
    rango: sp.get("rango") ?? undefined,
    desde: sp.get("desde") ?? undefined,
    hasta: sp.get("hasta") ?? undefined,
  });

  const supabase = await createClient();
  const { data, error } = await fetchHospitalDashboard(supabase, rango);

  if (error) {
    return new Response(`No fue posible generar la exportación: ${error}`, {
      status: 500,
    });
  }

  const filas = data.por_medico.map((m) => [
    m.nombre,
    ETIQUETA_ADOPCION[estadoAdopcion(m)],
    m.consultas,
    m.sin_firmar,
    // Sin notas en el periodo no hay promedio: se deja vacío en vez de 0, que
    // en una hoja de cálculo se promediaría con el resto y ensuciaría el total.
    m.consultas ? m.completitud : "",
    m.ultima ? formatFechaHoraTabular(m.ultima) : "",
    m.ultima ?? "",
    m.medico_id,
  ]);

  const csv = toCsv(CABECERAS, filas, {
    // ?sep=coma para pandas o Google Sheets; por defecto ';', que es lo que
    // espera Excel con configuración regional en español.
    separador: sp.get("sep") === "coma" ? "," : ";",
  });

  return new Response(csv, {
    headers: cabecerasCsv(
      nombreArchivoCsv("adopcion", `${rango.desde}_${rango.hasta}`),
    ),
  });
}
