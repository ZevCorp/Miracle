import { NextResponse } from "next/server";
import { normalizeHora, type ParsedCita } from "@/lib/agenda";
import { rateLimit, requireEntitledApiUser } from "@/lib/api/guard";
import {
  anthropicApiKey,
  callAnthropicJson,
  DATA_NOT_INSTRUCTIONS,
  failureStatus,
} from "@/lib/ai/anthropic";

export const runtime = "nodejs";
// La visión sobre una agenda densa puede tardar: sin esto la función se corta
// con el timeout por defecto de Vercel.
export const maxDuration = 60;

// Formatos que acepta la API de visión de Anthropic.
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
// Alineado con el límite de body de Vercel (~4.5 MB): 5.8M chars base64.
const MAX_BASE64_CHARS = 5_800_000;

const SYSTEM = `Extraes citas médicas de la foto o captura de pantalla de un horario o agenda (sistemas hospitalarios, planillas impresas, cuadernos).

Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, con esta forma exacta:
{"citas": [{"hora": "HH:MM", "paciente": string, "motivo": string | null, "documento": string | null}]}

Reglas:
- "hora" en formato 24 horas (ej. "08:30", "14:00"). Omite filas sin hora legible.
- "paciente": el nombre tal como aparece. Omite filas sin paciente (descansos, bloqueos, "DISPONIBLE", totales).
- "motivo": motivo, servicio o procedimiento si aparece; si no, null. No lo inventes.
- "documento": número de documento o identificación si aparece; si no, null.
- Ordena por hora ascendente. Si la imagen no contiene un horario de citas, devuelve {"citas": []}.

${DATA_NOT_INSTRUCTIONS}`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function sanitizeCitas(value: unknown): ParsedCita[] {
  const list = (value as any)?.citas;
  if (!Array.isArray(list)) return [];
  const out: ParsedCita[] = [];
  for (const c of list) {
    if (!c || typeof c !== "object") continue;
    const hora = normalizeHora(String((c as any).hora ?? ""));
    const paciente = String((c as any).paciente ?? "").trim();
    if (!hora || !paciente) continue;
    out.push({
      hora,
      paciente: paciente.slice(0, 120),
      motivo:
        typeof (c as any).motivo === "string" && (c as any).motivo.trim()
          ? (c as any).motivo.trim().slice(0, 200)
          : null,
      documento:
        typeof (c as any).documento === "string" && (c as any).documento.trim()
          ? (c as any).documento.trim().slice(0, 60)
          : null,
    });
    if (out.length >= 60) break;
  }
  return out.sort((a, b) => a.hora.localeCompare(b.hora));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function POST(req: Request) {
  // Sesión + derecho comercial: cada llamada a visión cuesta dinero.
  const gate = await requireEntitledApiUser();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const userId = gate.userId;
  if (!(await rateLimit(`parse-schedule:${userId}`, 6))) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espera un momento e intenta de nuevo." },
      { status: 429 },
    );
  }

  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const match = (body.image ?? "").match(/^data:([a-z0-9/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  const mediaType = match?.[1]?.toLowerCase() ?? "";
  if (!match || !MEDIA_TYPES.has(mediaType)) {
    return NextResponse.json(
      { error: "Formato de imagen no soportado. Usa JPG, PNG o WebP." },
      { status: 400 },
    );
  }
  const b64 = match[2].replace(/\s/g, "");
  if (b64.length > MAX_BASE64_CHARS) {
    return NextResponse.json(
      { error: "La imagen supera 5 MB. Usa una captura más liviana." },
      { status: 413 },
    );
  }

  // Sin clave: el cliente ofrece el alta manual como alternativa.
  if (!anthropicApiKey()) return NextResponse.json({ connected: false });

  // Llamada del portal a un modelo que NO pasa por Graph: el helper la mide.
  const result = await callAnthropicJson({
    system: SYSTEM,
    content: [
      {
        type: "image",
        source: { type: "base64", media_type: mediaType, data: b64 },
      },
      { type: "text", text: "Extrae las citas de este horario." },
    ],
    maxTokens: 3000,
    timeoutMs: 60_000,
    feature: "schedule_parsing",
    userId,
    route: "parse-schedule",
  });
  if (!result.ok) {
    return NextResponse.json(
      { connected: true, error: result.reason },
      { status: failureStatus(result) },
    );
  }

  return NextResponse.json({ connected: true, citas: sanitizeCitas(result.parsed) });
}
