import { NextResponse } from "next/server";
import { reportError } from "@/lib/observability";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

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
    .slice(-20);

  if (!messages.length) {
    return NextResponse.json({ error: "Sin mensajes." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      reply:
        "El asistente todavía no está conectado: falta configurar la clave ANTHROPIC_API_KEY en el servidor. En cuanto se agregue, responderé tus preguntas clínicas aquí.",
      connected: false,
    });
  }

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
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      // No se registra el cuerpo de la respuesta (puede contener datos sensibles).
      reportError(new Error("anthropic chat error"), { route: "chat", status: res.status });
      return NextResponse.json(
        { error: "No se pudo obtener respuesta del asistente." },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const reply =
      data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n")
        .trim() || "No recibí respuesta del asistente.";

    return NextResponse.json({ reply, connected: true });
  } catch (e) {
    reportError(e, { route: "chat" });
    return NextResponse.json(
      { error: "Error de conexión con el asistente." },
      { status: 500 },
    );
  }
}
