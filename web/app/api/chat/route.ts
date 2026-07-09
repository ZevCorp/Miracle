import { NextResponse } from "next/server";
import { reportError } from "@/lib/observability";
import { rateLimit, requireApiUser } from "@/lib/api/guard";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGE_CHARS = 4_000;

const SYSTEM_PROMPT = `Eres el asistente clínico de Miracle, una plataforma de inteligencia clínica-operativa para profesionales de la salud en Colombia.

Tu usuario es personal médico (médicos generales y especialistas). Ayudas con:
- Dudas clínicas: diagnósticos diferenciales, criterios, dosis, interacciones farmacológicas, banderas rojas.
- Codificación CIE-10 y CUPS, y preparación de RIPS.
- Redacción y estructura de notas clínicas.

Reglas:
- Responde en español, claro y conciso. Usa viñetas cuando ayude.
- Eres apoyo y NO reemplazas el juicio del profesional. Para decisiones de manejo, recuerda verificar con las guías vigentes y el criterio clínico.
- Si una consulta sugiere una emergencia o riesgo vital, indícalo con claridad y prioriza la seguridad.
- No inventes dosis ni códigos: si no estás seguro, dilo y sugiere verificar la fuente oficial.
- No emites diagnósticos definitivos sobre un paciente concreto; ofreces orientación para que el médico decida.`;

export async function POST(req: Request) {
  const userId = await requireApiUser();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!rateLimit(`chat:${userId}`, 20)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espera un momento e intenta de nuevo." },
      { status: 429 },
    );
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
    .slice(-20);

  if (!messages.length) {
    return NextResponse.json({ error: "Sin mensajes." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      reply:
        "El asistente todavía no está habilitado para tu institución. Mientras tanto puedes seguir registrando tus consultas con normalidad.",
      connected: false,
    });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 1024,
        stream: true,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      // No se registra el cuerpo de la respuesta (puede contener datos sensibles).
      reportError(new Error("anthropic chat error"), { route: "chat", status: upstream.status });
      return NextResponse.json(
        { error: "No se pudo obtener respuesta del asistente." },
        { status: 502 },
      );
    }

    // Reenvía solo los deltas de texto del SSE de Anthropic como texto plano,
    // para que el cliente pinte la respuesta a medida que llega.
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = upstream.body.getReader();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let buffer = "";

        function emitLine(line: string) {
          if (!line.startsWith("data:")) return;
          const payload = line.slice(5).trim();
          if (!payload) return;
          try {
            const event = JSON.parse(payload) as {
              type?: string;
              delta?: { type?: string; text?: string };
            };
            if (
              event.type === "content_block_delta" &&
              event.delta?.type === "text_delta" &&
              event.delta.text
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          } catch {
            /* evento no-JSON del SSE: se ignora */
          }
        }

        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) emitLine(line);
          }
          // Vacía lo que quede al cerrar el stream (bytes multi-byte partidos
          // y una posible última línea sin salto final).
          buffer += decoder.decode();
          if (buffer) emitLine(buffer);
        } catch (e) {
          reportError(e, { route: "chat", stage: "stream" });
        } finally {
          controller.close();
        }
      },
      cancel() {
        void reader.cancel();
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    reportError(e, { route: "chat" });
    return NextResponse.json(
      { error: "Error de conexión con el asistente." },
      { status: 500 },
    );
  }
}
