import { NextResponse } from "next/server";
import { reportError } from "@/lib/observability";
import { rateLimit, requireEntitledApiUser } from "@/lib/api/guard";
import { anthropicUsage, reportAiUsage } from "@/lib/ai-usage";
import type { SnippetSuggestion } from "@/lib/clinical/snippet-import";

export const runtime = "nodejs";
// Una tanda de 25 textos puede tardar; sin esto la corta el timeout de Vercel.
export const maxDuration = 60;

/** Ítems por llamada. El cliente ya trocea en tandas de 25. */
const MAX_ITEMS = 40;
const MAX_TEXT_CHARS = 4_000;
const MAX_BODY_CHARS = 1_000_000;

const SYSTEM = `Organizas la biblioteca de textos clínicos de un médico. Recibes fragmentos que él mismo escribió (diagnósticos frecuentes, planes de manejo, recomendaciones) y para cada uno propones un título corto y una categoría.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, con esta forma exacta:
{"atajos": [{"id": string, "titulo": string, "categoria": string}]}

Reglas:
- "id": el mismo id que recibiste. Devuelve un objeto por cada id, sin inventar ninguno.
- "titulo": corto y clínico, tomado del CONTENIDO (máx. 80 caracteres). Ej. "Gastritis crónica por H. pylori". Usa el nombre del archivo solo si el contenido no alcanza para titular.
- "categoria": reutiliza una de las categorías frecuentes que se te dan cuando encaje; si ninguna encaja, propón una corta y general (máx. 40 caracteres). Si no está claro, devuelve cadena vacía.
- No traduzcas ni reescribas el contenido: solo lo clasificas.`;

interface IncomingItem {
  id?: unknown;
  filename?: unknown;
  text?: unknown;
}

function extractJsonObject(raw: string): string | null {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return start >= 0 && end > start ? clean.slice(start, end + 1) : null;
}

/**
 * Se queda solo con lo que se pidió: ids que se enviaron, sin repetir, con los
 * campos recortados. Lo que el modelo devuelva de más se descarta aquí.
 */
function sanitizeSuggestions(value: unknown, sentIds: Set<string>): SnippetSuggestion[] {
  const list = (value as { atajos?: unknown })?.atajos;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: SnippetSuggestion[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!sentIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    const titulo = typeof raw.titulo === "string" ? raw.titulo : "";
    const categoria = typeof raw.categoria === "string" ? raw.categoria : "";
    out.push({
      id,
      // Sin saltos de línea: son un título y una etiqueta, no un párrafo.
      titulo: titulo.replace(/\s+/g, " ").trim().slice(0, 120),
      categoria: categoria.replace(/\s+/g, " ").trim().slice(0, 60),
    });
  }
  return out;
}

export async function POST(req: Request) {
  // Sesión + derecho comercial: cada tanda cuesta dinero.
  const gate = await requireEntitledApiUser();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const userId = gate.userId;
  if (!(await rateLimit(`snippets-categorize:${userId}`, 10))) {
    return NextResponse.json(
      {
        error:
          "Demasiadas tandas seguidas. Espera un minuto y continúa la importación.",
      },
      { status: 429 },
    );
  }

  let body: { items?: IncomingItem[]; categorias_frecuentes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) {
    return NextResponse.json({ error: "No hay textos que clasificar." }, { status: 400 });
  }
  if (rawItems.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: "Demasiados textos en una sola tanda. Divide la importación." },
      { status: 413 },
    );
  }

  const items = rawItems
    .map((item) => ({
      id: String(item.id ?? "").slice(0, 60),
      filename: String(item.filename ?? "").slice(0, 200),
      text: String(item.text ?? "").slice(0, MAX_TEXT_CHARS),
    }))
    .filter((item) => item.id && item.text.trim());
  if (!items.length) {
    return NextResponse.json({ error: "No hay textos que clasificar." }, { status: 400 });
  }

  const categorias = Array.isArray(body.categorias_frecuentes)
    ? body.categorias_frecuentes
        .filter((value): value is string => typeof value === "string")
        .slice(0, 40)
        .map((value) => value.slice(0, 60))
    : [];

  const userContent = JSON.stringify({ categorias_frecuentes: categorias, atajos: items });
  if (userContent.length > MAX_BODY_CHARS) {
    return NextResponse.json(
      { error: "Demasiado contenido en una sola tanda. Divide la importación." },
      { status: 413 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  // Sin clave la importación sigue: el cliente titula con el nombre del archivo
  // y el médico pone la categoría a mano.
  if (!apiKey) return NextResponse.json({ connected: false });

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const startedAt = Date.now();

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
      signal: AbortSignal.timeout(55_000),
    });

    if (!res.ok) {
      // Un error del proveedor puede haber gastado tokens igual: se registra
      // sin cifras, que es exactamente lo que sabemos.
      void reportAiUsage({
        userId,
        feature: "snippet_categorization",
        provider: "anthropic",
        requestedModel: model,
        inputTokens: 0,
        outputTokens: 0,
        status: "error",
        errorCode: `http_${res.status}`,
        latencyMs: Date.now() - startedAt,
      });
      reportError(new Error("anthropic snippets-categorize error"), {
        route: "snippets/categorize",
        status: res.status,
      });
      return NextResponse.json({ connected: true, error: "anthropic" }, { status: 502 });
    }

    const data = (await res.json()) as {
      id?: string;
      model?: string;
      content?: { type: string; text?: string }[];
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    };

    // Se reporta aunque el parseo falle: los tokens ya se gastaron. Nunca se
    // envía el texto del médico, solo cifras y etiquetas técnicas.
    void reportAiUsage({
      userId,
      feature: "snippet_categorization",
      provider: "anthropic",
      requestedModel: model,
      servedModel: data.model ?? model,
      status: "ok",
      latencyMs: Date.now() - startedAt,
      providerRequestId: data.id ?? "",
      ...anthropicUsage(data.usage),
    });

    const raw =
      data.content
        ?.filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("") ?? "";
    const json = extractJsonObject(raw);

    let parsed: unknown;
    try {
      if (!json) throw new Error("JSON object missing");
      parsed = JSON.parse(json);
    } catch {
      // No se registra `raw`: es contenido clínico del médico.
      reportError(new Error("snippets-categorize JSON parse failed"), {
        route: "snippets/categorize",
        stage: "parse",
      });
      return NextResponse.json({ connected: true, error: "parse" }, { status: 502 });
    }

    return NextResponse.json({
      connected: true,
      atajos: sanitizeSuggestions(parsed, new Set(items.map((item) => item.id))),
    });
  } catch (error) {
    reportError(error, { route: "snippets/categorize" });
    return NextResponse.json({ connected: true, error: "network" }, { status: 500 });
  }
}
