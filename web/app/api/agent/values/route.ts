import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { rateLimit } from "@/lib/api/guard";
import {
  conceptsRevision,
  extractConcepts,
  type ConceptKey,
} from "@/lib/clinical/vital-concepts";
import { reportError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Los conceptos clínicos de una consulta, para el agente de escritorio.
 *
 * Es la única ruta del portal que responde SIN sesión de Supabase, y por eso merece
 * explicación. El agente corre en el PC del hospital y no puede tener el JWT del
 * médico: sería una credencial real suelta en una máquina compartida. En su lugar el
 * médico genera un código de 8 caracteres atado a UNA consulta (`create_agent_link`)
 * y lo pega una vez en el agente.
 *
 * Lo que se entrega es deliberadamente pobre: nueve números y su evidencia. Ni la
 * nota, ni el paciente, ni el historial. Quien robe un código no obtiene una historia
 * clínica — obtiene una talla y una tensión, durante ocho horas o hasta que la
 * consulta se firme.
 *
 * La conversión nota → conceptos ocurre AQUÍ, en el servidor: la RPC devuelve la nota
 * completa (la necesita para extraer) pero esa nota nunca cruza la respuesta.
 */
export async function GET(request: NextRequest) {
  const code = (request.nextUrl.searchParams.get("code") ?? "").trim().toUpperCase();

  // Forma antes que fondo: 8 caracteres del alfabeto sin ambigüedades. Descartar aquí
  // lo que ni siquiera parece un código evita ir a la base por cada intento a ciegas.
  if (!/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(code)) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  }

  // Rate limit POR CÓDIGO: el sondeo legítimo es cada 1,5 s (~40/min), así que 90 deja
  // holgura para un reintento y sigue cortando a quien pruebe códigos en serie.
  if (!(await rateLimit(`agent-values:${code}`, 90))) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes." },
      { status: 429 },
    );
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("agent_note_for_code", { p_code: code });

    if (error) {
      reportError(error, { route: "agent/values" });
      return NextResponse.json({ error: "No fue posible leer la consulta." }, { status: 502 });
    }

    const payload = data as { ok?: boolean; reason?: string; note?: unknown } | null;

    if (!payload?.ok) {
      // 'closed' se distingue de 'invalid' porque NO es un error del que pregunta: la
      // consulta se firmó y el agente debe dejar de sondear en vez de reintentar.
      const closed = payload?.reason === "closed";
      return NextResponse.json(
        {
          error: closed
            ? "La consulta ya fue firmada; este código dejó de servir."
            : "Código inválido o vencido.",
          stop: true,
        },
        { status: closed ? 409 : 404 },
      );
    }

    const sections = Array.isArray(payload.note) ? payload.note : [];
    const concepts = extractConcepts(sections as never);

    // Plano y sin adornos: el agente coloca valores, no interpreta estructuras.
    const values: Record<string, string> = {};
    const evidence: Record<string, string> = {};
    for (const [key, v] of Object.entries(concepts)) {
      if (!v) continue;
      values[key] = v.value;
      evidence[key as ConceptKey] = v.evidence;
    }

    const rev = conceptsRevision(concepts);

    // ETag para que el sondeo sea barato: si nada cambió desde la última lectura, un
    // 304 sin cuerpo. Cuarenta lecturas por minuto durante una consulta larga son
    // muchas respuestas idénticas que no hace falta ni serializar ni transmitir.
    if (request.headers.get("if-none-match") === `"${rev}"`) {
      return new NextResponse(null, {
        status: 304,
        headers: { etag: `"${rev}"`, "cache-control": "no-store" },
      });
    }

    return NextResponse.json(
      { rev, values, evidence },
      { headers: { etag: `"${rev}"`, "cache-control": "no-store" } },
    );
  } catch (e) {
    reportError(e, { route: "agent/values" });
    return NextResponse.json({ error: "No fue posible leer la consulta." }, { status: 502 });
  }
}
