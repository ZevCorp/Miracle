import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/app/EmptyState";
import { Clock3, MapPin } from "lucide-react";
import { ETIQUETA_FASE, fmtMin, fmtMsSeg, fmtNum } from "@/lib/superadmin/medicion";

const BASE = "/superadmin/medicion";

/**
 * Timeline anonimizado de UN turno: la serie de actividad por minuto, las visitas
 * SAP en orden (el journey del HIS) y los eventos (lock, pausa, encounters). Sin
 * una sola pieza de contenido clínico — los encounters son huellas, las pantallas
 * son códigos de transacción.
 */
export default async function TurnoPage({ params }: { params: Promise<{ shiftId: string }> }) {
  const { shiftId } = await params;
  const db = await createClient();

  const { data, error } = await db.rpc("superadmin_medicion_turno", { p_shift: shiftId });
  const t = (data ?? null) as {
    turno: {
      fecha_operativa: string;
      phase: string;
      duracion_ms: number;
      active_ms_total: number;
      his_ms: number;
      typing_ms: number;
      clicks: number;
      encounters: number;
      post_atencion_ms: number;
      cobertura_pct: number | null;
      calidad_ok: boolean;
    } | null;
    serie: { minuto: string; app: string; active_ms: number; clicks: number; encounter_key: string | null }[];
    visitas: { tcode: string; surface: string; entered_at: string; dwell_ms: number; ready_ms: number | null; sap_wait_ms: number; exit_to: string | null }[];
    eventos: { kind: string; occurred_at: string; encounter_key: string | null; detail: Record<string, unknown> }[];
  } | null;

  if (error || !t?.turno) {
    return (
      <div className="space-y-4">
        <Link href={BASE} className="text-sm text-accent hover:underline">← Volver a medición</Link>
        <Card className="p-6">
          <EmptyState icon={<Clock3 className="h-6 w-6" />} title="Turno no encontrado" description="Puede que aún no esté resumido o que el id no exista." />
        </Card>
      </div>
    );
  }

  const turno = t.turno;

  return (
    <div className="space-y-6">
      <div>
        <Link href={BASE} className="text-sm text-accent hover:underline">← Volver a medición</Link>
        <h1 className="mt-1 text-xl font-semibold text-ink">Turno del {turno.fecha_operativa}</h1>
        <p className="text-sm text-muted">
          {ETIQUETA_FASE[turno.phase] ?? turno.phase} ·{" "}
          {turno.calidad_ok ? "buena calidad" : `calidad baja (${turno.cobertura_pct ?? 0}% cobertura)`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Mini label="Duración" value={fmtMin(turno.duracion_ms / 60000)} />
        <Mini label="Activo" value={fmtMin(turno.active_ms_total / 60000)} />
        <Mini label="En el HIS" value={fmtMin(turno.his_ms / 60000)} />
        <Mini label="Escribiendo" value={fmtMin(turno.typing_ms / 60000)} />
        <Mini label="Clics" value={fmtNum(turno.clicks)} />
        <Mini label="Consultas" value={fmtNum(turno.encounters)} />
        <Mini label="Post-atención" value={fmtMin(turno.post_atencion_ms / 60000)} />
      </div>

      <Card className="p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <MapPin className="h-4 w-4" /> Recorrido por SAP ({t.visitas.length} pantallas)
        </p>
        {t.visitas.length === 0 ? (
          <p className="text-sm text-muted">Sin visitas SAP en este turno.</p>
        ) : (
          <ol className="space-y-1">
            {t.visitas.map((v, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                <span className="font-mono text-xs text-deep">{v.tcode}</span>
                <span className="flex-1 truncate text-muted" title={v.surface}>{v.surface}</span>
                <span className="tabular-nums text-muted">
                  {fmtMsSeg(v.dwell_ms)} · espera {fmtMsSeg(v.sap_wait_ms)} · listo {fmtMsSeg(v.ready_ms)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card className="p-4">
        <p className="mb-3 text-sm font-semibold text-ink">Eventos del turno</p>
        {t.eventos.length === 0 ? (
          <p className="text-sm text-muted">Sin eventos registrados.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {t.eventos.map((e, i) => (
              <li key={i} className="flex items-center gap-3 text-muted">
                <span className="w-16 shrink-0 font-mono text-xs">{new Date(e.occurred_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="font-medium text-ink">{e.kind}</span>
                {e.encounter_key && <span className="font-mono text-xs">· {e.encounter_key.slice(0, 8)}…</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink tabular-nums">{value}</p>
    </Card>
  );
}
