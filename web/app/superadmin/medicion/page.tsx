import Link from "next/link";
import {
  Activity,
  Clock3,
  Hourglass,
  Keyboard,
  MousePointerClick,
  Repeat,
  Stethoscope,
  Timer,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { StatTile } from "@/components/superadmin/charts/StatTile";
import { BarList } from "@/components/superadmin/charts/BarList";
import { RangePicker } from "@/components/superadmin/RangePicker";
import { EmptyState } from "@/components/app/EmptyState";
import { Pager } from "@/components/app/Pager";
import { resolverRango } from "@/lib/superadmin/rango";
import {
  ETIQUETA_FASE,
  fmtMin,
  fmtMsSeg,
  fmtNum,
  fmtSeg,
  minutosApp,
  type ResumenMedicion,
} from "@/lib/superadmin/medicion";

const BASE = "/superadmin/medicion";
const PAGE_SIZE = 25;

/**
 * Medición de impacto — la vista de institución del estudio baseline → Notes →
 * Notes+Operations. Mide el TRABAJO operativo (tiempo en PC/HIS, escritura, clics,
 * navegación SAP, post-atención), no el contenido: los datos vienen del medidor
 * (metrics_*), que nunca captura texto ni identidad de paciente.
 *
 * La banda de COBERTURA va antes que los promedios, igual que en Métricas de
 * consultas: un promedio sobre turnos de mala calidad miente, así que se dice
 * cuántos se midieron y cuántos se excluyeron ANTES de mostrar ningún número.
 */
export default async function MedicionPage({
  searchParams,
}: {
  searchParams: Promise<{
    rango?: string;
    desde?: string;
    hasta?: string;
    org?: string;
    fase?: string;
    medico?: string;
    incluir_mala?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const db = await createClient();
  const rango = resolverRango(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const incluirMala = sp.incluir_mala === "1";
  const org = sp.org && sp.org !== "todas" ? sp.org : null;
  const fase = sp.fase && sp.fase !== "todas" ? sp.fase : null;

  const orgsRes = await db.from("organizations").select("id, name").order("name");
  const orgs = (orgsRes.data ?? []) as { id: string; name: string }[];

  const { data, error } = await db.rpc("superadmin_medicion_resumen", {
    p_from: rango.desde,
    p_to: rango.hasta,
    p_org: org,
    p_phase: fase,
    p_doctor: sp.medico && sp.medico !== "todos" ? sp.medico : null,
    p_incluir_mala_calidad: incluirMala,
    p_page: page,
    p_page_size: PAGE_SIZE,
  });

  if (error) {
    return (
      <div className="space-y-4">
        <Encabezado />
        <Card className="p-6">
          <EmptyState
            icon={<Stethoscope className="h-6 w-6" />}
            title="La medición aún no está disponible"
            description="Falta aplicar las migraciones de medición (metrics_*) o todavía no ha llegado ningún turno. En cuanto un PC con el medidor reporte, esta pantalla se llena."
          />
        </Card>
      </div>
    );
  }

  const r = data as ResumenMedicion;
  const cob = r.cobertura;
  const nombreMedico = new Map(r.por_medico.map((m) => [m.doctor_id, m.nombre]));
  const serieActivo = r.serie.map((d) => d.activo_min);
  // Lo que el RangePicker y el Pager preservan: los filtros ajenos al periodo.
  const preservados: Record<string, string | undefined> = {
    org: sp.org,
    fase: sp.fase,
    medico: sp.medico,
    incluir_mala: incluirMala ? "1" : undefined,
  };

  return (
    <div className="space-y-6">
      <Encabezado />

      <div className="flex flex-wrap items-center gap-3">
        <RangePicker rango={rango} basePath={BASE} preserved={preservados} />
        <a
          href={`${BASE}/comparacion${org ? `?org=${org}` : ""}`}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-pearl"
        >
          Comparar fases →
        </a>
        <a
          href={`${BASE}/config`}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-pearl"
        >
          Configuración
        </a>
        <a
          href={`/superadmin/medicion/export?${new URLSearchParams({ ...(org ? { org } : {}), ...(fase ? { fase } : {}), desde: rango.desde, hasta: rango.hasta }).toString()}`}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-pearl"
        >
          Exportar CSV
        </a>
      </div>

      {/* Cobertura primero: la honestidad del panel. */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Cobertura de la medición</p>
            <p className="text-sm text-muted">
              {fmtNum(cob.turnos_medidos)} de {fmtNum(cob.turnos_totales)} turnos con buena calidad
              {cob.turnos_excluidos > 0 && (
                <> · <span className="text-amber-700">{fmtNum(cob.turnos_excluidos)} excluidos por calidad</span></>
              )}
              {" "}· cobertura media {cob.cobertura_media_pct}%
            </p>
          </div>
          <Link
            href={`${BASE}?${new URLSearchParams({ ...sp, incluir_mala: incluirMala ? "0" : "1" }).toString()}`}
            className="text-sm font-medium text-accent hover:underline"
          >
            {incluirMala ? "Ocultar turnos de baja calidad" : "Incluir turnos de baja calidad"}
          </Link>
        </div>
      </Card>

      {cob.turnos_medidos === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<Stethoscope className="h-6 w-6" />}
            title="Aún no hay turnos medidos en este rango"
            description="Cuando un médico use un PC con el medidor instalado, sus turnos aparecerán aquí. El baseline se llena solo."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Tiempo activo por turno" value={fmtMin(r.kpis.activo_min_prom)} icon={Activity} spark={serieActivo} />
            <StatTile label="Tiempo en el HIS" value={fmtMin(r.kpis.his_min_prom)} icon={Clock3} />
            <StatTile label="Tiempo escribiendo" value={fmtMin(r.kpis.escritura_min_prom)} icon={Keyboard} />
            <StatTile label="Trabajo post-atención" value={fmtMin(r.kpis.post_atencion_min_prom)} icon={Hourglass} footnote="Actividad tras el último paciente del turno" />
            <StatTile label="Clics por turno" value={fmtNum(r.kpis.clics_prom)} icon={MousePointerClick} />
            <StatTile label="Cambios de contexto" value={fmtNum(r.kpis.context_switches_prom)} icon={Repeat} />
            <StatTile label="Espera de SAP" value={fmtSeg(r.kpis.sap_espera_seg_prom)} icon={Timer} footnote="Suma de round-trips por turno" />
            <StatTile label="Tiempo en Miracle" value={fmtMin(minutosApp(r.por_app, "miracle_web"))} icon={Stethoscope} footnote="Cuando el portal está en primer plano" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <p className="mb-3 text-sm font-semibold text-ink">Tiempo activo por aplicación</p>
              <BarList
                formatValue={(v) => `${v} min`}
                items={Object.entries(r.por_app)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([app, ms]) => ({ label: app, value: Math.round(ms / 60000) }))}
              />
            </Card>
            <Card className="p-4">
              <p className="mb-3 text-sm font-semibold text-ink">Tiempo activo por médico</p>
              <BarList
                formatValue={(v) => `${v} min`}
                items={r.por_medico.slice(0, 8).map((m) => ({
                  label: m.nombre,
                  value: Math.round(m.activo_min),
                }))}
              />
            </Card>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">Turnos</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-pearl text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-2">Fecha</th>
                    <th className="px-4 py-2">Médico</th>
                    <th className="px-4 py-2">Fase</th>
                    <th className="px-4 py-2 text-right">Activo</th>
                    <th className="px-4 py-2 text-right">HIS</th>
                    <th className="px-4 py-2 text-right">Clics</th>
                    <th className="px-4 py-2 text-right">Consultas</th>
                    <th className="px-4 py-2 text-right">Post-atención</th>
                    <th className="px-4 py-2">Calidad</th>
                  </tr>
                </thead>
                <tbody>
                  {r.turnos.map((t) => (
                    <tr key={t.shift_id} className="border-t border-line hover:bg-pearl/50">
                      <td className="px-4 py-2">
                        <Link href={`${BASE}/turnos/${t.shift_id}`} className="font-medium text-accent hover:underline">
                          {t.fecha}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{nombreMedico.get(t.doctor_id) ?? "sin médico"}</td>
                      <td className="px-4 py-2 text-muted">{ETIQUETA_FASE[t.phase] ?? t.phase}</td>
                      <td className="px-4 py-2 text-right">{fmtMin(t.activo_min)}</td>
                      <td className="px-4 py-2 text-right">{fmtMin(t.his_min)}</td>
                      <td className="px-4 py-2 text-right">{fmtNum(t.clics)}</td>
                      <td className="px-4 py-2 text-right">{fmtNum(t.encounters)}</td>
                      <td className="px-4 py-2 text-right">{fmtMin(t.post_min)}</td>
                      <td className="px-4 py-2">
                        {t.calidad_ok ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">buena</span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            baja ({t.cobertura_pct ?? 0}%)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line px-4 py-3">
              <Pager page={page} pageSize={PAGE_SIZE} total={cob.turnos_totales} basePath={BASE} params={preservados} />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Encabezado() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">Medición de impacto</h1>
      <p className="text-sm text-muted">
        Cuánto trabajo operativo cuesta una consulta — tiempo, escritura, clics, navegación SAP y
        trabajo posterior — para comparar antes y después de Miracle. Mide el trabajo, no el contenido.
      </p>
    </div>
  );
}
