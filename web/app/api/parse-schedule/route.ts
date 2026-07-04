import { NextResponse } from "next/server";
import { reportError } from "@/lib/observability";
import { normalizeHora, type ParsedCita } from "@/lib/agenda";

export const runtime = "nodejs";

// Formatos que acepta la API de visión de Anthropic.
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
// Límite de Anthropic por imagen: 5 MB binarios (~6,7M caracteres en base64).
const MAX_BASE64_CHARS = 7_000_000;

const SYSTEM = `Extraes citas médicas de la foto o captura de pantalla de un horario o agenda (sistemas hospitalarios, planillas impresas, cuadernos).

Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, con esta forma exacta:
{"citas": [{"hora": "HH:MM", "paciente": string, "motivo": string | null, "documento": string | null}]}

Reglas:
- "hora" en formato 24 horas (ej. "08:30", "14:00"). Omite filas sin hora legible.
- "paciente": el nombre tal como aparece. Omite filas sin paciente (descansos, bloqueos, "DISPONIBLE", totales).
- "motivo": motivo, servicio o procedimiento si aparece; si no, null. No lo inventes.
- "documento": número de documento o identificación si aparece; si no, null.
- Ordena por hora ascendente. Si la imagen no contiene un horario de citas, devuelve {"citas": []}.`;

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  // Sin clave: el cliente ofrece el alta manual como alternativa.
  if (!apiKey) return NextResponse.json({ connected: false });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 3000,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: b64 },
              },
              { type: "text", text: "Extrae las citas de este horario." },
            ],
          },
          { role: "assistant", content: "{" },
        ],
      }),
    });

    if (!res.ok) {
      reportError(new Error("anthropic parse-schedule error"), {
        route: "parse-schedule",
        status: res.status,
      });
      return NextResponse.json({ connected: true, error: "anthropic" }, { status: 502 });
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const raw =
      "{" +
      (data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("") ?? "");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // No se registra `raw` (puede contener nombres de pacientes).
      reportError(new Error("parse-schedule JSON parse failed"), {
        route: "parse-schedule",
        stage: "parse",
      });
      return NextResponse.json({ connected: true, error: "parse" }, { status: 502 });
    }

    return NextResponse.json({ connected: true, citas: sanitizeCitas(parsed) });
  } catch (e) {
    reportError(e, { route: "parse-schedule" });
    return NextResponse.json({ connected: true, error: "network" }, { status: 500 });
  }
}
