import { NextResponse } from "next/server";
import { reportError } from "@/lib/observability";
import { rateLimit, requireApiUser } from "@/lib/api/guard";
import { getCurrentProfile } from "@/lib/auth/server";
import { canUsePhotoNotes } from "@/lib/clinical/bacteriology";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Nota de laboratorio desde FOTO (exclusiva de bacteriólogos).
 *
 * La lectura de la hoja manuscrita la hace el backend Graph: su tarjeta de
 * Provider Studio "Biopsia" expone `POST /api/v1/biopsy/extract`, que envía la
 * foto a un modelo de VISIÓN (OpenAI por defecto) y devuelve las casillas
 * transcritas. Esta ruta es un proxy server-side: autentica al bacteriólogo,
 * carga la plantilla (RLS) y reenvía la foto a Graph con la API key de
 * plataforma (MIRACLE_API_KEY), un secreto que jamás llega al navegador.
 *
 * Diseño: UNA sola llamada de IA por foto. La nota queda como datos
 * estructurados; editar una casilla o volver a descargar el PDF no gasta tokens.
 */

// Formatos aceptados (validación temprana antes de llegar a Graph).
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
// ~5 MB de imagen binaria en base64.
const MAX_BASE64_CHARS = 7_000_000;
// Tope defensivo por sección.
const MAX_SECTION_CHARS = 4_000;

type TemplateSection = {
  key: string;
  label: string;
  order?: number;
  required?: boolean;
  instruction?: string;
};

type FilledSection = { key: string; label: string; content: string };

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
 * Alinea la respuesta del backend con las secciones de la plantilla: una entrada
 * por key, en el orden de la plantilla, con el content saneado. Defensivo: aunque
 * Graph ya alinea, garantiza el contrato hacia la UI si algo cambia upstream.
 */
function alignSections(template: TemplateSection[], upstream: unknown): FilledSection[] {
  const list = (upstream as any)?.sections;
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

/**
 * Modo dinámico: no hay plantilla contra la cual alinear, así que se pasan las
 * secciones que diseñó la IA (key/label/content) saneando cada campo. Graph ya
 * las sanea; esto es una segunda barrera defensiva del contrato hacia la UI.
 */
function sanitizeDynamicSections(value: unknown): FilledSection[] {
  const list = (value as any)?.sections;
  if (!Array.isArray(list)) return [];
  const out: FilledSection[] = [];
  const usedKeys = new Set<string>();
  list.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    if (out.length >= 40) return;
    const label = String((item as any).label ?? "").trim().slice(0, 120) || `Sección ${index + 1}`;
    let key = String((item as any).key ?? "").trim() || `seccion_${index + 1}`;
    while (usedKeys.has(key)) key = `${key}_${index}`;
    usedKeys.add(key);
    const raw = (item as any).content;
    const content = typeof raw === "string" ? raw.trim().slice(0, MAX_SECTION_CHARS) : "";
    out.push({ key, label, content });
  });
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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

  let body: { image?: string; templateId?: string; dynamic?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  // Modo dinámico: la IA diseña su propia plantilla a partir de la foto (sin
  // plantilla fija). En ese caso no se exige templateId ni se carga plantilla.
  const dynamic = body.dynamic === true;
  const templateId = String(body.templateId ?? "").trim();
  if (!dynamic && !templateId) {
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

  // Cargar las secciones de la plantilla (RLS: institucional activa o propia del
  // usuario). Solo en modo con plantilla fija; en dinámico la diseña la IA.
  let template: { id: string; name: string; specialty_code: string | null } | null = null;
  let sections: TemplateSection[] = [];
  if (!dynamic) {
    const supabase = await createClient();
    const { data: templateRow, error: templateError } = await supabase
      .from("clinical_templates")
      .select("id, name, specialty_code, sections")
      .eq("id", templateId)
      .maybeSingle();

    if (templateError || !templateRow) {
      return NextResponse.json({ error: "No se encontró la plantilla." }, { status: 404 });
    }

    sections = parseTemplateSections(templateRow.sections);
    if (!sections.length) {
      return NextResponse.json({ error: "La plantilla no tiene secciones." }, { status: 400 });
    }
    template = {
      id: templateRow.id as string,
      name: templateRow.name as string,
      specialty_code: (templateRow.specialty_code as string | null) ?? null,
    };
  }

  // Backend Graph (tarjeta Provider Studio "Biopsia"). Sin backend/clave, el
  // cliente ofrece rellenar la plantilla manualmente.
  const base = (
    process.env.MIRACLE_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    ""
  ).replace(/\/+$/, "");
  const apiKey = process.env.MIRACLE_API_KEY;
  if (!base || !apiKey) {
    return NextResponse.json({ connected: false });
  }

  try {
    const upstream = await fetch(`${base}/api/v1/biopsy/extract`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "content-type": "application/json" },
      body: JSON.stringify(
        dynamic
          ? { image: `data:${mediaType};base64,${b64}`, mode: "dynamic" }
          : {
              image: `data:${mediaType};base64,${b64}`,
              template: { name: template!.name, sections },
            },
      ),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });

    // 503 = el provider de visión no está configurado en Graph. Se trata igual
    // que "sin conexión": el cliente ofrece el relleno manual.
    if (upstream.status === 503) {
      return NextResponse.json({ connected: false });
    }

    const payload = (await upstream.json().catch(() => null)) as {
      template?: { name?: string };
      sections?: unknown;
      warnings?: unknown;
    } | null;

    if (!upstream.ok || !payload) {
      // Nunca se registra el cuerpo: puede contener datos de la muestra/paciente.
      reportError(new Error("biopsy extract upstream"), {
        route: "note-from-photo",
        status: upstream.status,
      });
      return NextResponse.json({ connected: true, error: "upstream" }, { status: 502 });
    }

    if (dynamic) {
      const dynSections = sanitizeDynamicSections(payload);
      if (!dynSections.length) {
        return NextResponse.json({ connected: true, error: "parse" }, { status: 502 });
      }
      const name = String(payload.template?.name ?? "").trim() || "Informe de laboratorio";
      return NextResponse.json({
        connected: true,
        template: { id: null, name, specialtyCode: "bacteriologia" },
        sections: dynSections,
        warnings: sanitizeWarnings(payload),
      });
    }

    return NextResponse.json({
      connected: true,
      template: { id: template!.id, name: template!.name, specialtyCode: template!.specialty_code },
      sections: alignSections(sections, payload),
      warnings: sanitizeWarnings(payload),
    });
  } catch (e) {
    reportError(e, { route: "note-from-photo" });
    return NextResponse.json({ connected: true, error: "network" }, { status: 500 });
  }
}
