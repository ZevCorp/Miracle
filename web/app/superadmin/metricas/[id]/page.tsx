import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock3,
  Cpu,
  Gauge,
  MessagesSquare,
  Timer,
  VolumeX,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { formatFechaHora } from "@/lib/dates";
import { StatTile } from "@/components/superadmin/charts/StatTile";
import { formatTokens, formatUsd, ETIQUETA_FEATURE } from "@/lib/superadmin/consumo";
import { formatMs, type DetalleConsulta } from "@/lib/superadmin/metricas";

/**
 * Radiografía de UNA consulta: telemetría + costo de IA por operación.
 *
 * Solo metadatos técnicos — jamás transcripción, nota ni nombre de paciente.
 * Cada métrica sin dato dice POR QUÉ no está («requiere diarización»,
 * «consulta anterior a la telemetría») en vez de inventar un cero.
 */
export default async function SuperadminMetricaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const db = await createClient();
  const { data, error } = await db.rpc("superadmin_encounter_detail", {
    p_encounter_id: id,
  });
  const detalle = (data ?? null) as DetalleConsulta | null;

  if (error || !detalle) {
    return (
      <div className="space-y-6">
        <Volver />
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          No fue posible cargar el detalle.
          {error?.message ? ` (${error.message})` : ""}
        </div>
      </div>
    );
  }

  const { encounter, metrics, ai_usage } = detalle;
  if (!encounter) notFound();

  const tokens = ai_usage.totales;
  const denomMs =
    metrics && metrics.recording_ms > 0
      ? metrics.recording_ms
      : tokens.audio_seconds > 0
        ? tokens.audio_seconds * 1000
        : null;
  const tokensPorMinuto =
    denomMs && tokens.total_tokens > 0
      ? Math.round((tokens.total_tokens * 60000) / denomMs)
      : null;

  const pctInterrogatorio =
    metrics?.interrogation_ms != null && metrics.recording_ms > 0
      ? Math.round((metrics.interrogation_ms / metrics.recording_ms) * 100)
      : null;
  const pctSilencio =
    metrics?.silence_ms != null && metrics.recording_ms > 0
      ? Math.round((metrics.silence_ms / metrics.recording_ms) * 100)
      : null;

  return (
    <div className="space-y-6">
      <Volver />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-deep">
            Consulta · {encounter.doctor?.nombre ?? "Médico desconocido"}
          </h1>
          <p className="text-sm text-muted">
            {encounter.doctor?.organizacion ?? "Sin organización"} ·{" "}
            {formatFechaHora(encounter.created_at)} · plantilla{" "}
            {encounter.template_name ?? "—"}
          </p>
        </div>
        <Badge tone={encounter.status === "completed" ? "accent" : "neutral"}>
          {encounter.status}
        </Badge>
      </div>

      {!metrics ? (
        <div className="rounded-[14px] border border-line bg-pearl px-4 py-3 text-sm text-ink-soft">
          Esta consulta es anterior a la telemetría (o su telemetría nunca llegó): no hay
          duración, tiempo de uso ni análisis de conversación. El consumo de IA de abajo sí es
          real si Graph la atribuyó.
        </div>
      ) : null}

      {/* --- La ficha del pedido --------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          label="Duración (grabación)"
          value={formatMs(metrics ? metrics.recording_ms || null : null)}
          footnote={
            metrics
              ? `${metrics.session_count} sesión(es) · ${metrics.flush_count} reportes`
              : "no medido"
          }
          icon={Timer}
        />
        <StatTile
          label="Tiempo de uso de Notes"
          value={formatMs(metrics ? metrics.active_ms || null : null)}
          footnote={
            metrics?.finished_at
              ? `cerrada ${formatFechaHora(metrics.finished_at)}`
              : metrics
                ? "sin finalizar"
                : "no medido"
          }
          icon={Clock3}
        />
        <StatTile
          label="Tokens / minuto"
          value={tokensPorMinuto === null ? "—" : tokensPorMinuto.toLocaleString("es-CO")}
          footnote={denomMs === null ? "sin denominador medido" : undefined}
          icon={Gauge}
        />
        <StatTile
          label="Interrogatorio"
          value={formatMs(metrics?.interrogation_ms)}
          footnote={
            metrics?.interrogation_ms == null
              ? metrics?.diarization === false
                ? "no disponible: la sesión no tuvo diarización"
                : "no medido"
              : pctInterrogatorio !== null
                ? `${pctInterrogatorio}% de la consulta`
                : undefined
          }
          icon={MessagesSquare}
        />
        <StatTile
          label="Silencios"
          value={formatMs(metrics?.silence_ms)}
          footnote={
            metrics?.silence_ms == null
              ? "no disponible: sin línea de tiempo de audio"
              : `${pctSilencio !== null ? `${pctSilencio}% de la consulta · ` : ""}mayor: ${formatMs(metrics.longest_silence_ms)}`
          }
          icon={VolumeX}
        />
        <StatTile
          label="Tokens totales"
          value={tokens.total_tokens > 0 ? formatTokens(tokens.total_tokens) : "—"}
          footnote={
            tokens.total_tokens > 0
              ? `${formatTokens(tokens.input_tokens)} entrada · ${formatTokens(tokens.output_tokens)} salida`
              : "sin consumo atribuido (requiere session_id de Graph)"
          }
          icon={Cpu}
        />
      </div>

      {/* --- Hablantes -------------------------------------------------------- */}
      {metrics?.talk_ms_by_speaker && Object.keys(metrics.talk_ms_by_speaker).length > 0 ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Habla por participante
          </h2>
          <p className="mb-3 mt-1 text-xs text-muted">
            Etiquetas del proveedor de transcripción ({metrics.timeline_segments} segmentos
            {metrics.speaker_timeline_truncated ? ", truncados" : ""}). Sin diarización todo
            aparece como un solo participante.
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(metrics.talk_ms_by_speaker)
              .sort(([, a], [, b]) => b - a)
              .map(([clave, ms]) => (
                <span
                  key={clave}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-pearl px-3 py-1.5 text-sm text-deep"
                >
                  <span className="text-xs font-semibold uppercase text-muted">
                    {clave.replace(/^s\d+:/, "Hablante ")}
                  </span>
                  {formatMs(ms)}
                </span>
              ))}
          </div>
        </Card>
      ) : null}

      {/* --- Consumo por operación -------------------------------------------- */}
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-xs)]">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Consumo de IA por operación
          </h2>
          <p className="mt-1 text-xs text-muted">
            Todos los eventos del ledger con esta consulta como sesión. Costo total:{" "}
            {formatUsd(tokens.costo_usd)}
            {tokens.sin_tarifa > 0 ? ` (mínimo: ${tokens.sin_tarifa} llamadas sin tarifa)` : ""}.
          </p>
        </div>
        <div className="hidden grid-cols-[1.4fr_1fr_.7fr_.7fr_.7fr_.7fr_.7fr] gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted lg:grid">
          <span>Operación</span>
          <span>Modelo</span>
          <span className="text-right">Llamadas</span>
          <span className="text-right">Entrada</span>
          <span className="text-right">Salida</span>
          <span className="text-right">Total</span>
          <span className="text-right">Costo</span>
        </div>
        {ai_usage.operaciones.map((op, index) => (
          <div
            key={`${op.feature}-${op.provider}-${op.model}`}
            className={`grid grid-cols-2 gap-2 px-5 py-3 text-sm lg:grid-cols-[1.4fr_1fr_.7fr_.7fr_.7fr_.7fr_.7fr] lg:items-center lg:gap-4 ${index ? "border-t border-line" : ""}`}
          >
            <div className="col-span-2 min-w-0 lg:col-span-1">
              <div className="truncate font-medium text-deep">
                {ETIQUETA_FEATURE[op.feature] ?? op.feature}
              </div>
              <div className="truncate text-xs text-muted">
                {op.provider}
                {op.errores > 0 ? ` · ${op.errores} con error` : ""}
                {op.audio_seconds > 0 ? ` · ${Math.round(op.audio_seconds / 60)} min de audio` : ""}
              </div>
            </div>
            <div className="truncate text-muted" title={op.model}>
              {op.model}
            </div>
            <div className="text-right text-muted">{op.eventos}</div>
            <div className="text-right text-muted">{formatTokens(op.input_tokens)}</div>
            <div className="text-right text-muted">{formatTokens(op.output_tokens)}</div>
            <div className="text-right font-medium text-deep">{formatTokens(op.total_tokens)}</div>
            <div className="text-right text-muted">
              {op.sin_tarifa > 0 ? `≥ ${formatUsd(op.costo_usd)}` : formatUsd(op.costo_usd)}
            </div>
          </div>
        ))}
        {ai_usage.operaciones.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted">
            Sin consumo atribuido. Los tokens de esta consulta aparecerán aquí cuando Graph
            envíe <code>session_id = encounter_id</code> en sus eventos.
          </p>
        ) : null}
      </div>

      {/* --- Ficha técnica ----------------------------------------------------- */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Ficha técnica
        </h2>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Dato etiqueta="Tipo" valor={encounter.consultation_type} />
          <Dato etiqueta="Creada" valor={formatFechaHora(encounter.created_at)} />
          <Dato
            etiqueta="Nota generada"
            valor={encounter.note_generated_at ? formatFechaHora(encounter.note_generated_at) : "—"}
          />
          <Dato
            etiqueta="Intentos de generación"
            valor={String(encounter.generation_attempts ?? "—")}
          />
          <Dato
            etiqueta="Transcripción"
            valor={`${encounter.transcript_chars.toLocaleString("es-CO")} caracteres`}
          />
          <Dato etiqueta="Encounter" valor={encounter.id} mono />
        </dl>
      </Card>
    </div>
  );
}

function Volver() {
  return (
    <Link
      href="/superadmin/metricas"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-deep"
    >
      <ArrowLeft size={15} /> Métricas de consultas
    </Link>
  );
}

function Dato({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted">{etiqueta}</dt>
      <dd className={`truncate text-deep ${mono ? "font-mono text-xs" : ""}`} title={valor}>
        {valor}
      </dd>
    </div>
  );
}
