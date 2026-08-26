// Reporte de consumo de IA hacia el ledger central (Graph).
//
// POR QUÉ EL PORTAL REPORTA. Casi todas las llamadas a modelos del producto
// pasan por Graph, que las instrumenta en su capa de proveedor. La excepción es
// esta app: `app/api/parse-schedule` llama directo a Anthropic. Si no se
// reportara desde aquí, ese gasto no aparecería en ningún lado.
//
// ATRIBUCIÓN. El `userId` viene SIEMPRE de la sesión de Supabase ya verificada
// en la ruta (requireApiUser / getCurrentProfile), nunca del cuerpo de la
// petición. La organización se deriva del perfil de ese usuario.
//
// PRIVACIDAD. Solo se envían cifras y etiquetas técnicas. Ni la imagen, ni el
// prompt, ni el texto extraído — que contiene nombres de pacientes — salen de
// esta función.
//
// NO BLOQUEA. Si el ledger no responde, la ruta sigue su curso: la telemetría
// es observación, no funcionalidad.

import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability";

type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

export type AiUsageReport = {
  userId: string;
  feature: string;
  provider: "anthropic" | "openai" | "google" | "deepgram" | "soniox";
  apiFamily?: string;
  requestedModel: string;
  servedModel?: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  /** Segundos de audio procesados (STT); el costo por minuto sale de ai_model_prices. */
  audioSeconds?: number;
  /**
   * Id de sesión del ledger. Para consumo con alcance de consulta va el
   * encounter_id: es lo que permite atribuir tokens/minutos a una consulta
   * (ver docs/graph-metrics-contract.md).
   */
  sessionId?: string;
  status?: "ok" | "error";
  errorCode?: string;
  latencyMs?: number;
  providerRequestId?: string;
};

function ingestTarget(): { url: string; key: string } | null {
  const base = (process.env.GRAPH_BASE_URL ?? "").replace(/\/+$/, "");
  const key = (process.env.GRAPH_USAGE_INGEST_KEY ?? "").trim();
  if (!base || !key) return null;
  return { url: `${base}/api/internal/usage/events`, key };
}

/** Organización del usuario. RLS permite a cada quien leer su propio perfil. */
async function organizationOf(userId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    return (data?.organization_id as string | undefined) ?? null;
  } catch {
    // Sin organización el evento sigue siendo válido y atribuible al usuario.
    return null;
  }
}

/**
 * Envía un evento de consumo al ledger. Siempre resuelve; nunca lanza.
 */
export async function reportAiUsage(report: AiUsageReport): Promise<void> {
  const target = ingestTarget();
  if (!target) {
    // Sin configuración de ingesta no hay nada que hacer, y avisar en cada
    // llamada solo llenaría los logs. Se documenta en README/AGENTS.
    return;
  }

  try {
    const organizationId = await organizationOf(report.userId);
    await fetch(target.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-graph-usage-key": target.key,
      },
      body: JSON.stringify({
        provider: report.provider,
        apiFamily: report.apiFamily ?? "messages",
        requestedModel: report.requestedModel,
        servedModel: report.servedModel ?? report.requestedModel,
        inputTokens: report.inputTokens,
        outputTokens: report.outputTokens,
        cachedInputTokens: report.cachedInputTokens ?? 0,
        audioSeconds: report.audioSeconds ?? 0,
        sessionId: report.sessionId ?? "",
        status: report.status ?? "ok",
        errorCode: report.errorCode ?? "",
        latencyMs: report.latencyMs,
        providerRequestId: report.providerRequestId ?? "",
        // Atribución resuelta en servidor contra la sesión autenticada.
        userId: report.userId,
        organizationId,
        actorType: "user",
        attributionSource: "session",
        app: "web_app",
        feature: report.feature,
      }),
      // El ledger no puede retrasar la respuesta al médico.
      signal: AbortSignal.timeout(4000),
    });
  } catch (error) {
    reportError(error, { route: "ai-usage-report", feature: report.feature });
  }
}

/** Normaliza el bloque `usage` de la API de Anthropic. */
export function anthropicUsage(usage: AnthropicUsage | undefined) {
  const input = Number(usage?.input_tokens ?? 0) || 0;
  const output = Number(usage?.output_tokens ?? 0) || 0;
  const cacheRead = Number(usage?.cache_read_input_tokens ?? 0) || 0;
  const cacheCreate = Number(usage?.cache_creation_input_tokens ?? 0) || 0;
  return {
    // Los tokens de creación de caché se facturan como entrada (con recargo);
    // los de lectura se cobran aparte y por eso van en su propio campo.
    inputTokens: input + cacheCreate,
    outputTokens: output,
    cachedInputTokens: cacheRead,
  };
}
