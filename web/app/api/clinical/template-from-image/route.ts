import { NextResponse } from "next/server";
import { reportError } from "@/lib/observability";
import { rateLimit, requireEntitledApiUser } from "@/lib/api/guard";
import { anthropicUsage, reportAiUsage } from "@/lib/ai-usage";
import {
  sanitizeTemplateProposal,
  MAX_IMAGE_NOTES_CHARS,
  MAX_IMPORT_IMAGES,
} from "@/lib/clinical/template-import";

export const runtime = "nodejs";
// Leer varias páginas de un formulario tarda: sin esto la función se corta con
// el timeout por defecto de Vercel.
export const maxDuration = 60;

/**
 * ESTRUCTURA de plantilla a partir de FOTOS del formulario que el médico ya usa.
 *
 * Devuelve los RÓTULOS de las secciones, nunca lo escrito encima. Esa es la
 * protección de datos de esta funcionalidad: aunque el médico fotografíe una
 * nota ya diligenciada, del otro lado sale una estructura vacía, no los datos
 * de su paciente. La imagen no se guarda en ningún sitio.
 *
 * Espeja `app/api/parse-schedule/route.ts` —la otra ruta del portal que llama
 * directo a Anthropic— y NO `note-from-photo`, que está reservada a cuentas de
 * patólogo y proxya a Graph con su propia etiqueta de consumo.
 *
 * Diseño: UNA sola llamada de visión por lote. Las páginas de un mismo
 * formulario van juntas en el mismo mensaje, así el modelo puede unirlas sin
 * repetir secciones y sin que cueste una llamada por foto.
 */

// Formatos que acepta la API de visión de Anthropic.
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// El límite de body de la plataforma son 4.5 MB, es decir de CARACTERES: el
// alfabeto base64 no necesita escape JSON, así que un carácter es un byte de
// petición. Estos topes quedan por debajo para poder devolver un 413 en JSON;
// si se pasan, la plataforma corta antes y responde HTML que el cliente no
// puede parsear. El cliente ya comprime a 900 000 por foto.
const MAX_BASE64_CHARS_PER_IMAGE = 1_400_000;
const MAX_TOTAL_BASE64_CHARS = 4_000_000;

const SYSTEM = `Extraes la ESTRUCTURA de una plantilla de nota clínica a partir de fotos del formulario en papel que usa un médico.

Devuelves los TÍTULOS de las secciones y de los campos del formulario. NUNCA el contenido escrito sobre ellos.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, con esta forma exacta:
{"name": string, "description": string | null, "sections": [{"label": string, "required": boolean, "instruction": string | null}]}

Reglas:
- Si la foto trae una nota ya diligenciada, IGNORA por completo los datos del paciente (nombres, documentos, edades, teléfonos, fechas, hallazgos escritos). Solo te interesan los rótulos impresos o preimpresos.
- "name": nombre corto de la plantilla, tomado del título del formulario. Si no hay título, descríbelo por su uso (ej. "Control de hipertensión").
- "label": el rótulo tal como aparece en el papel, en español y en singular. Máximo 90 caracteres. Omite rótulos ilegibles.
- "required": true solo si el formulario marca esa casilla como obligatoria (asterisco, negrilla explícita, la palabra "obligatorio"). Ante la duda, false.
- "instruction": la ayuda impresa bajo el rótulo, si la hay. Si no, null. No la inventes.
- Mantén el orden en que aparecen en el papel. Máximo 30 secciones.
- Si las fotos son páginas de un MISMO formulario, únelas en una sola lista sin repetir secciones.
- "description": para qué tipo de atención sirve, en una línea. Si no se deduce, null.
- Si las imágenes no contienen un formulario ni una nota clínica, devuelve {"name": "", "description": null, "sections": []}.`;

function extractJsonObject(raw: string): string | null {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return start >= 0 && end > start ? clean.slice(start, end + 1) : null;
}

type ParsedImage = { mediaType: string; data: string };

/** Valida el lote entero antes de gastar un solo token. */
function parseImages(
  value: unknown,
): { images: ParsedImage[] } | { error: string; status: number } {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: "Añade al menos una foto.", status: 400 };
  }
  if (value.length > MAX_IMPORT_IMAGES) {
    return {
      error: `Puedes subir hasta ${MAX_IMPORT_IMAGES} fotos a la vez.`,
      status: 400,
    };
  }
  const images: ParsedImage[] = [];
  let total = 0;
  for (const raw of value) {
    const match =
      typeof raw === "string"
        ? raw.match(/^data:([a-z0-9/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/i)
        : null;
    const mediaType = match?.[1]?.toLowerCase() ?? "";
    if (!match || !MEDIA_TYPES.has(mediaType)) {
      return {
        error: "Formato de imagen no soportado. Usa JPG, PNG o WebP.",
        status: 400,
      };
    }
    const data = match[2].replace(/\s/g, "");
    if (data.length > MAX_BASE64_CHARS_PER_IMAGE) {
      return {
        error: "Una de las fotos es demasiado pesada. Tómala con menos resolución.",
        status: 413,
      };
    }
    total += data.length;
    if (total > MAX_TOTAL_BASE64_CHARS) {
      return {
        error: "Las fotos pesan demasiado juntas. Envía menos páginas por vez.",
        status: 413,
      };
    }
    images.push({ mediaType, data });
  }
  return { images };
}

export async function POST(req: Request) {
  // Sesión + derecho comercial: cada lectura de visión cuesta dinero.
  const gate = await requireEntitledApiUser();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const userId = gate.userId;
  if (!(await rateLimit(`template-from-image:${userId}`, 6))) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espera un momento e intenta de nuevo." },
      { status: 429 },
    );
  }

  let body: { images?: unknown; notes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const parsed = parseImages(body.images);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  // Texto que acompaña a las fotos ("la página 2 la pegué a mano"): entra en la
  // misma llamada en vez de gastar una segunda.
  const notes =
    typeof body.notes === "string"
      ? body.notes.trim().slice(0, MAX_IMAGE_NOTES_CHARS)
      : "";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  // Sin clave: el cliente ofrece armar la plantilla a mano.
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
        messages: [
          {
            role: "user",
            content: [
              ...parsed.images.map((image) => ({
                type: "image",
                source: {
                  type: "base64",
                  media_type: image.mediaType,
                  data: image.data,
                },
              })),
              {
                type: "text",
                text: notes
                  ? `Extrae la estructura de este formulario. El médico añadió estas notas o el texto de otra página:\n\n${notes}`
                  : parsed.images.length > 1
                    ? `Extrae la estructura de este formulario. Las ${parsed.images.length} fotos son páginas del MISMO formulario: únelas en una sola lista.`
                    : "Extrae la estructura de este formulario.",
              },
            ],
          },
        ],
      }),
      // Corta dentro del presupuesto de maxDuration en vez de dejar que la mate
      // la plataforma con un 504 en HTML.
      signal: AbortSignal.timeout(55_000),
    });

    if (!res.ok) {
      // Un error del proveedor puede haber consumido tokens igual. Se registra
      // sin cifras, que es exactamente lo que sabemos.
      void reportAiUsage({
        userId,
        feature: "template_from_image",
        provider: "anthropic",
        requestedModel: model,
        inputTokens: 0,
        outputTokens: 0,
        status: "error",
        errorCode: `http_${res.status}`,
        latencyMs: Date.now() - startedAt,
      });
      reportError(new Error("anthropic template-from-image error"), {
        route: "template-from-image",
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

    // Se reporta el consumo aunque el parseo de abajo falle: los tokens ya se
    // gastaron. Nunca se envía el texto extraído.
    void reportAiUsage({
      userId,
      feature: "template_from_image",
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

    let proposal: unknown;
    try {
      if (!json) throw new Error("JSON object missing");
      proposal = JSON.parse(json);
    } catch {
      // No se registra `raw`: la foto pudo traer datos de paciente.
      reportError(new Error("template-from-image JSON parse failed"), {
        route: "template-from-image",
        stage: "parse",
      });
      return NextResponse.json({ connected: true, error: "parse" }, { status: 502 });
    }

    const template = sanitizeTemplateProposal(proposal);
    if (!template) {
      // El modelo respondió, pero en la foto no había una estructura utilizable.
      return NextResponse.json({ connected: true, error: "sin-secciones" }, { status: 422 });
    }

    return NextResponse.json({ connected: true, template });
  } catch (e) {
    reportError(e, { route: "template-from-image" });
    return NextResponse.json({ connected: true, error: "network" }, { status: 500 });
  }
}
