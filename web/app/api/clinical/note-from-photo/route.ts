import { NextResponse } from "next/server";
import { reportError } from "@/lib/observability";
import { rateLimit, requireApiUser } from "@/lib/api/guard";
import { getCurrentProfile } from "@/lib/auth/server";
import { canUsePhotoNotes } from "@/lib/clinical/bacteriology";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Formatos que acepta la API de visión de Anthropic.
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
// Límite de Anthropic por imagen: 5 MB binarios (~6,7M caracteres en base64).
const MAX_BASE64_CHARS = 7_000_000;
// Tope defensivo por sección (una casilla de laboratorio no debería excederlo).
const MAX_SECTION_CHARS = 4_000;

type TemplateSection = {
  key: string;
  label: string;
  order?: number;
  required?: boolean;
  instruction?: string;
};

type FilledSection = { key: string; label: string; content: string };

const SYSTEM = `Eres un asistente que TRANSCRIBE y ORGANIZA una hoja de trabajo de laboratorio escrita a mano por un profesional (bacteriología, patología o laboratorio clínico) mientras analiza una muestra al microscopio.

Tu tarea: leer la foto de la hoja y volcar su contenido en las secciones (casillas) de la plantilla que se te indica, respetando EXACTAMENTE las claves ("key") dadas.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, con esta forma exacta:
{"sections": [{"key": string, "content": string}], "warnings": [string]}

Reglas:
- Incluye una entrada por cada "key" de la plantilla, en el mismo orden. No agregues claves que no estén en la plantilla.
- "content": transcribe fielmente lo escrito para esa sección. Conserva términos técnicos, nombres de microorganismos, medidas, recuentos y notación de cruces (+, ++, +++). Corrige solo abreviaturas obvias.
- NO inventes ni completes datos clínicos que no estén en la hoja. Si una sección no tiene información en la hoja, deja "content" como cadena vacía "".
- Usa "warnings" para señalar texto ilegible o dudoso (p. ej. "El recuento de leucocitos es poco legible"). Si no hay dudas, devuelve [].
- No incluyas datos de otras secciones dentro de una que no corresponde.`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseTemplateSections(value: unknown): TemplateSection[] {
  if (!Array.isArray(value)) return [];
  const out: TemplateSection[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const key = String((raw as any).key ?? "").trim();
    const label = String((raw as any).label ?? "").trim();
    if (!key) continue;
    out.push({
      key,
      label: label || key,
      order: typeof (raw as any).order === "number" ? (raw as any).order : undefined,
      required: Boolean((raw as any).required),
      instruction:
        typeof (raw as any).instruction === "string" ? (raw as any).instruction : undefined,
    });
  }
  return out.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Alinea la respuesta del modelo con las secciones de la plantilla: una entrada por key,
 * en el orden de la plantilla, con el content saneado. Garantiza que la nota casa con la
 * plantilla aunque el modelo omita, reordene o invente claves.
 */
function alignSections(
  template: TemplateSection[],
  modelValue: unknown,
): FilledSection[] {
  const list = (modelValue as any)?.sections;
  const byKey = new Map<string, string>();
  if (Array.isArray(list)) {
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const key = String((item as any).key ?? "").trim();
      if (!key) continue;
      const content = typeof (item as any).content === "string" ? (item as any).content : "";
      byKey.set(key, content.trim().slice(0, MAX_SECTION_CHARS));
    }
  }
  return template.map((section) => ({
    key: section.key,
    label: section.label,
    content: byKey.get(section.key) ?? "",
  }));
}

function sanitizeWarnings(value: unknown): string[] {
  const list = (value as any)?.warnings;
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const w of list) {
    if (typeof w === "string" && w.trim()) out.push(w.trim().slice(0, 240));
    if (out.length >= 12) break;
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function extractJsonObject(raw: string): string | null {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return start >= 0 && end > start ? clean.slice(start, end + 1) : null;
}

export async function POST(req: Request) {
  const userId = await requireApiUser();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // Exclusivo de cuentas bacteriólogo. El resto de médicos no puede usar esta ruta.
  const profile = await getCurrentProfile();
  if (!profile || !canUsePhotoNotes(profile.professionalType)) {
    return NextResponse.json({ error: "Funcionalidad no disponible para esta cuenta." }, { status: 403 });
  }

  if (!rateLimit(`note-from-photo:${userId}`, 6)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espera un momento e intenta de nuevo." },
      { status: 429 },
    );
  }

  let body: { image?: string; templateId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const templateId = String(body.templateId ?? "").trim();
  if (!templateId) {
    return NextResponse.json({ error: "Falta la plantilla." }, { status: 400 });
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
      { error: "La imagen supera 5 MB. Usa una foto más liviana." },
      { status: 413 },
    );
  }

  // Cargar las secciones de la plantilla (RLS: institucional activa o propia del usuario).
  const supabase = await createClient();
  const { data: template, error: templateError } = await supabase
    .from("clinical_templates")
    .select("id, name, specialty_code, sections")
    .eq("id", templateId)
    .maybeSingle();

  if (templateError || !template) {
    return NextResponse.json({ error: "No se encontró la plantilla." }, { status: 404 });
  }

  const sections = parseTemplateSections(template.sections);
  if (!sections.length) {
    return NextResponse.json({ error: "La plantilla no tiene secciones." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  // Sin clave: el cliente ofrece rellenar la plantilla manualmente.
  if (!apiKey) {
    return NextResponse.json({ connected: false });
  }

  const templateGuide = sections
    .map(
      (section, index) =>
        `${index + 1}. key="${section.key}" — ${section.label}${
          section.instruction ? ` (${section.instruction})` : ""
        }`,
    )
    .join("\n");

  const userText = `Plantilla: "${template.name}".
Rellena estas secciones a partir de la hoja de la foto (usa exactamente estas keys):
${templateGuide}`;

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
        max_tokens: 4000,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: b64 },
              },
              { type: "text", text: userText },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      reportError(new Error("anthropic note-from-photo error"), {
        route: "note-from-photo",
        status: res.status,
      });
      return NextResponse.json({ connected: true, error: "anthropic" }, { status: 502 });
    }

    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const raw =
      data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("") ?? "";
    const json = extractJsonObject(raw);

    let parsed: unknown;
    try {
      if (!json) throw new Error("JSON object missing");
      parsed = JSON.parse(json);
    } catch {
      // No se registra `raw`: puede contener datos del paciente/muestra.
      reportError(new Error("note-from-photo JSON parse failed"), {
        route: "note-from-photo",
        stage: "parse",
      });
      return NextResponse.json({ connected: true, error: "parse" }, { status: 502 });
    }

    return NextResponse.json({
      connected: true,
      template: { id: template.id, name: template.name, specialtyCode: template.specialty_code },
      sections: alignSections(sections, parsed),
      warnings: sanitizeWarnings(parsed),
    });
  } catch (e) {
    reportError(e, { route: "note-from-photo" });
    return NextResponse.json({ connected: true, error: "network" }, { status: 500 });
  }
}
