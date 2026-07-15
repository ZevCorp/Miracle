import { NextResponse } from "next/server";
import { reportError } from "@/lib/observability";
import { rateLimit, requireApiUser } from "@/lib/api/guard";

export const runtime = "nodejs";

/**
 * Proxy server-side de la sesión de transcripción en vivo.
 *
 * El backend Miracle autentica `POST /api/v1/transcription/session` con la API
 * key de plataforma (MIRACLE_API_KEY) — un secreto que jamás puede llegar al
 * navegador. Esta ruta la guarda server-side y solo entrega la sesión (tokens
 * TEMPORALES del proveedor STT, TTL ~60 s) a médicos con sesión Supabase.
 *
 * El navegador luego abre el WebSocket directo al proveedor (Soniox/Deepgram);
 * ni el audio ni la transcripción pasan por esta ruta.
 */
export async function POST() {
  const userId = await requireApiUser();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!rateLimit(`stt:${userId}`, 10)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espera un momento e intenta de nuevo." },
      { status: 429 },
    );
  }

  const base = (
    process.env.MIRACLE_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    ""
  ).replace(/\/+$/, "");
  const apiKey = process.env.MIRACLE_API_KEY;
  if (!base || !apiKey) {
    return NextResponse.json(
      { error: "La transcripción en vivo no está configurada." },
      { status: 503 },
    );
  }

  try {
    const upstream = await fetch(`${base}/api/v1/transcription/session`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "content-type": "application/json" },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const payload = (await upstream.json().catch(() => null)) as {
      websocket_url?: unknown;
    } | null;

    if (!upstream.ok || typeof payload?.websocket_url !== "string") {
      // Nunca registrar el cuerpo: trae tokens del proveedor STT.
      reportError(new Error("stt session upstream"), {
        route: "stt/session",
        status: upstream.status,
      });
      return NextResponse.json(
        { error: "No fue posible iniciar la transcripción en vivo." },
        { status: 502 },
      );
    }

    // Passthrough exacto: el motor de dictado consume estos nombres de campo.
    return NextResponse.json(payload, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    reportError(e, { route: "stt/session" });
    return NextResponse.json(
      { error: "No fue posible conectar con el servicio de transcripción." },
      { status: 502 },
    );
  }
}
