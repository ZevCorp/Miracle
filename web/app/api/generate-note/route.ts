import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Turn = { hablante?: string; texto?: string };

export async function POST(req: Request) {
  let body: {
    transcript?: Turn[];
    plantillaNombre?: string;
    secciones?: string[];
    paciente?: { nombre?: string; edad?: number; sexo?: string } | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  // Sin clave: el cliente usa su borrador base de respaldo.
  if (!apiKey) return NextResponse.json({ connected: false });

  const transcript = (body.transcript ?? [])
    .map((t) => `${t.hablante ?? ""}: ${t.texto ?? ""}`)
    .join("\n");
  const secciones = (body.secciones ?? []).filter(Boolean);
  const seccionesTxt = secciones.length
    ? secciones.join(", ")
    : "Motivo de consulta, Enfermedad actual, Antecedentes, Examen físico, Análisis, Plan, Recomendaciones";
  const pac = body.paciente?.nombre
    ? `Paciente: ${body.paciente.nombre}${body.paciente.edad ? `, ${body.paciente.edad} años` : ""}${body.paciente.sexo ? `, sexo ${body.paciente.sexo}` : ""}.`
    : "Paciente sin identificar.";

  const system = `Eres un escriba clínico experto que trabaja en Colombia. A partir de la transcripción de una consulta médica redactas una nota clínica estructurada y sugieres códigos CIE-10 (diagnósticos) y CUPS (procedimientos).

Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, con esta forma exacta:
{"resumen": string, "secciones": [{"titulo": string, "contenido": string | string[]}], "codigos": [{"sistema": "CIE-10" | "CUPS", "codigo": string, "descripcion": string, "confianza": number}]}

Reglas:
- Usa exactamente estas secciones, en este orden: ${seccionesTxt}.
- "contenido" es un string para narrativa, o un arreglo de strings para listas (p. ej. Plan, Recomendaciones).
- "confianza" es un entero de 0 a 100.
- No inventes datos que no estén en la transcripción; si falta información, indícalo en la narrativa.
- Español clínico, claro y conciso.`;

  const user = `${pac}\n\nTranscripción de la consulta:\n${transcript || "(sin transcripción disponible)"}`;

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
        max_tokens: 2000,
        system,
        messages: [
          { role: "user", content: user },
          { role: "assistant", content: "{" },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[generate-note] anthropic error", res.status, await res.text());
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

    let note: unknown;
    try {
      note = JSON.parse(raw);
    } catch {
      console.error("[generate-note] JSON parse failed:", raw.slice(0, 240));
      return NextResponse.json({ connected: true, error: "parse" }, { status: 502 });
    }

    return NextResponse.json({ connected: true, note });
  } catch (e) {
    console.error("[generate-note] request failed", e);
    return NextResponse.json({ connected: true, error: "network" }, { status: 500 });
  }
}
