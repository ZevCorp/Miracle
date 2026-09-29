// Descarga del baseline de medición en CSV — una fila por turno (shift_summary).
// Route handler y no server action por la misma razón que el resto de exports:
// un GET con Content-Disposition es un <a href> sin JavaScript, y hereda los
// filtros de la página copiando los searchParams.
//
// La barrera de rol se comprueba aquí además del proxy: el proxy es UX, esto es
// autoritativo. Y sale del summary (ya agregado, sin PHI), nunca del crudo.

import type { NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { cabecerasCsv, nombreArchivoCsv, toCsv } from "@/lib/superadmin/csv";

export const dynamic = "force-dynamic";

const MAX_FILAS = 10000;

const CABECERAS = [
  "shift_id",
  "fecha_operativa",
  "fase",
  "doctor_id",
  "device_id",
  "duracion_min",
  "activo_min",
  "his_min",
  "escritura_min",
  "clics",
  "cambios_contexto",
  "consultas",
  "post_atencion_min",
  "cola_post_turno_min",
  "espera_sap_seg",
  "ready_p95_seg",
  "pantallas_distintas",
  "visitas",
  "cobertura_pct",
  "calidad_ok",
];

function min(ms: number | null): number | "" {
  return ms == null ? "" : Math.round((ms / 60000) * 10) / 10;
}
function seg(ms: number | null): number | "" {
  return ms == null ? "" : Math.round((ms / 1000) * 10) / 10;
}

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "superadmin") {
    return new Response("No autorizado", { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const org = sp.get("org");
  const fase = sp.get("fase");
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");

  const db = await createClient();
  let query = db
    .from("metrics_shift_summary")
    .select(
      "shift_id, fecha_operativa, phase, doctor_id, device_id, duracion_ms, active_ms_total, his_ms, typing_ms, clicks, context_switches, encounters, post_atencion_ms, cola_post_turno_ms, sap_wait_ms_total, ready_ms_p95, pantallas_distintas, visitas, cobertura_pct, calidad_ok",
    )
    .order("fecha_operativa", { ascending: false })
    .limit(MAX_FILAS + 1);

  if (org && org !== "todas") query = query.eq("organization_id", org);
  if (fase && fase !== "todas") query = query.eq("phase", fase);
  if (desde) query = query.gte("fecha_operativa", desde);
  if (hasta) query = query.lte("fecha_operativa", hasta);

  const { data, error } = await query;
  if (error) return new Response(`Error: ${error.message}`, { status: 500 });

  const rows = (data ?? []) as Record<string, number | string | boolean | null>[];
  const truncado = rows.length > MAX_FILAS;
  const usar = truncado ? rows.slice(0, MAX_FILAS) : rows;

  const filas = usar.map((r) => [
    r.shift_id,
    r.fecha_operativa,
    r.phase,
    r.doctor_id ?? "",
    r.device_id,
    min(r.duracion_ms as number),
    min(r.active_ms_total as number),
    min(r.his_ms as number),
    min(r.typing_ms as number),
    r.clicks,
    r.context_switches,
    r.encounters,
    min(r.post_atencion_ms as number),
    min(r.cola_post_turno_ms as number),
    seg(r.sap_wait_ms_total as number),
    seg(r.ready_ms_p95 as number | null),
    r.pantallas_distintas,
    r.visitas,
    r.cobertura_pct ?? "",
    r.calidad_ok,
  ]);

  const csv = toCsv(CABECERAS, filas, {
    truncadoEn: truncado ? { exportadas: MAX_FILAS, total: rows.length } : undefined,
  });
  const nombre = nombreArchivoCsv("medicion-turnos", new Date().toISOString().slice(0, 10));
  return new Response(csv, { headers: cabecerasCsv(nombre) });
}
