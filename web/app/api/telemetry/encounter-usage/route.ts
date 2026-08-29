import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser } from "@/lib/api/guard";
import { reportAiUsage } from "@/lib/ai-usage";
import { reportError } from "@/lib/observability";

export const runtime = "nodejs";

/**
 * Telemetría de uso por consulta que no puede ir directa a Supabase:
 *
 * 1. BEACON DE CIERRE. `navigator.sendBeacon` no puede usar supabase-js, así
 *    que el último flush al ocultar/cerrar la pestaña llega aquí y se reenvía
 *    al RPC `record_encounter_usage` con la sesión de las cookies. El RPC
 *    valida dueño y clampa deltas: esta ruta no añade confianza, solo
 *    transporte.
 *
 * 2. MINUTOS TRANSCRITOS → LEDGER. El audio va navegador→proveedor STT
 *    directo, así que ni Graph ni el servidor ven su duración: solo el
 *    cliente la conoce. Aquí se reporta al ledger de consumo con
 *    session_id = encounter_id (feature `live_transcription`), que es lo que
 *    permite costear la transcripción por consulta. La ingest key es secreta
 *    y por eso este reporte no puede hacerse desde el navegador.
 *
 * Sin gate de entitlement: esto es observación, no una función que cueste
 * dinero por llamada; cortarla dejaría consultas legítimas sin medir.
 * PRIVACIDAD: por aquí pasan números y etiquetas técnicas, nunca texto.
 */

const MAX_TIMELINE_SEGMENTS = 4000;
const STT_PROVIDERS = new Set(["deepgram", "soniox"]);

type Payload = {
  encounterId?: unknown;
  sessionId?: unknown;
  activeMs?: unknown;
  recordingMs?: unknown;
  timeline?: unknown;
  diarization?: unknown;
  finalize?: unknown;
  phase?: unknown;
  appVersion?: unknown;
  audioSource?: unknown;
  stt?: { audioSeconds?: unknown; provider?: unknown; model?: unknown } | null;
};

const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function POST(request: NextRequest) {
  const userId = await requireApiUser();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Payload | null;
  if (!body || !isUuid(body.encounterId) || !isUuid(body.sessionId)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const activeMs = Math.max(0, Math.round(Number(body.activeMs) || 0));
  const recordingMs = Math.max(0, Math.round(Number(body.recordingMs) || 0));
  const timeline =
    Array.isArray(body.timeline) && body.timeline.length <= MAX_TIMELINE_SEGMENTS
      ? body.timeline
      : null;
  const finalize = body.finalize === true;

  // El RPC valida que auth.uid() sea el dueño del encounter y clampa deltas.
  if (activeMs > 0 || recordingMs > 0 || timeline || finalize) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.rpc("record_encounter_usage", {
        p_encounter_id: body.encounterId,
        p_session_id: body.sessionId,
        p_active_ms: activeMs,
        p_recording_ms: recordingMs,
        p_timeline: timeline,
        p_diarization: typeof body.diarization === "boolean" ? body.diarization : null,
        p_finalize: finalize,
        // Pasan crudos: el RPC los valida contra su lista cerrada y los acota,
        // igual que ya hace con los deltas. Esta ruta sigue siendo transporte.
        p_phase: typeof body.phase === "string" ? body.phase : null,
        p_app_version: typeof body.appVersion === "string" ? body.appVersion : null,
        p_audio_source: typeof body.audioSource === "string" ? body.audioSource : null,
      });
      if (error) {
        reportError(new Error(error.message), { route: "telemetry/encounter-usage" });
      }
    } catch (e) {
      reportError(e, { route: "telemetry/encounter-usage" });
    }
  }

  // Minutos de transcripción al ledger. Tope de 4 h por reporte: más que eso
  // no es una consulta, es un bug del cliente.
  const stt = body.stt;
  const audioSeconds = Math.min(Math.max(0, Math.round(Number(stt?.audioSeconds) || 0)), 14_400);
  if (stt && audioSeconds >= 1) {
    const provider =
      typeof stt.provider === "string" && STT_PROVIDERS.has(stt.provider)
        ? (stt.provider as "deepgram" | "soniox")
        : "soniox";
    const model =
      typeof stt.model === "string" && stt.model.trim() ? stt.model.trim() : "unknown";
    await reportAiUsage({
      userId,
      feature: "live_transcription",
      provider,
      apiFamily: "stt_streaming",
      requestedModel: model,
      inputTokens: 0,
      outputTokens: 0,
      audioSeconds,
      sessionId: body.encounterId,
    });
  }

  return NextResponse.json({ ok: true });
}
