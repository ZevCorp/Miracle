import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { rateLimit } from "@/lib/api/guard";
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
 * clínica — obtiene una talla y una tensión, durante ocho horas.
 *
 * Los conceptos los EMPUJA la página en vivo mientras el médico dicta
 * (`push_agent_values`). Esta ruta no toca la nota ni la tabla `consultations`: esa
 * fila ni siquiera existe durante el dictado — se escribe al guardar la nota —, así
 * que leerla habría devuelto vacío justo durante los veinte minutos que importan.
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
    const { data, error } = await supabase.rpc("agent_values_for_code", { p_code: code });

    if (error) {
      reportError(error, { route: "agent/values" });
      return NextResponse.json({ error: "No fue posible leer la consulta." }, { status: 502 });
    }

    const payload = data as
      | { ok?: boolean; rev?: unknown; values?: unknown }
      | null;

    if (!payload?.ok) {
      // `stop` le dice al agente que deje de sondear en vez de reintentar cuarenta
      // veces por minuto contra un código que no va a revivir.
      return NextResponse.json(
        { error: "Código inválido o vencido.", stop: true },
        { status: 404 },
      );
    }

    // Plano y sin adornos: el agente coloca valores, no interpreta estructuras.
    const stored = (payload.values ?? {}) as Record<string, { value?: unknown; evidence?: unknown }>;
    const values: Record<string, string> = {};
    const evidence: Record<string, string> = {};
    for (const [key, v] of Object.entries(stored)) {
      if (typeof v?.value !== "string") continue;
      values[key] = v.value;
      if (typeof v.evidence === "string") evidence[key] = v.evidence;
    }

    const rev = typeof payload.rev === "string" ? payload.rev : "0";

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
