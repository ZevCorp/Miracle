"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Monitor } from "lucide-react";

import {
  conceptsRevision,
  extractConcepts,
  type ConceptMap,
} from "@/lib/clinical/vital-concepts";
import { createClient } from "@/lib/supabase/client";
import type { NoteSection } from "@/lib/mock";

/**
 * Empareja esta consulta con el agente de escritorio (Ü) y le va empujando los
 * conceptos clínicos mientras el médico dicta.
 *
 * El agente corre en el PC del hospital escribiendo en SAP y no puede tener el JWT
 * del médico — sería una credencial real suelta en una máquina compartida. En su
 * lugar: un código de 8 caracteres que se teclea una vez, atado a esta consulta y con
 * ocho horas de vida.
 *
 * Lo que viaja son CONCEPTOS (`vital.talla`, `vital.peso`…), no campos de SAP. Este
 * componente no sabe —ni debe— que del otro lado hay un `RNPA10-TALLA`: los conceptos
 * son estables y las pantallas cambian, así que el acoplamiento vive en el cliente
 * que ve la pantalla.
 *
 * La extracción corre AQUÍ, en el navegador, sobre la nota que ya está en memoria. No
 * hay llamada al servidor por cada cambio y no hay LLM: la nota cambia cada pocos
 * segundos mientras se dicta y el valor tiene que aparecer en el campo mientras el
 * paciente sigue hablando.
 */
export function AgentPairPanel({
  consultationId,
  note,
}: {
  consultationId: string;
  note: readonly NoteSection[];
}) {
  const supabase = createClient();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushed, setPushed] = useState<ConceptMap>({});

  // La última revisión ENVIADA. Sin esto se repetiría el mismo push en cada tecla que
  // el médico corrige, y son cuarenta escrituras por minuto que no cambian nada.
  const sentRev = useRef<string>("");

  const generar = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("create_agent_link", {
        p_consultation_id: consultationId,
      });
      if (rpcError || typeof data !== "string") {
        setError("No se pudo generar el código.");
        return;
      }
      setCode(data);
      sentRev.current = ""; // código nuevo: hay que reenviar lo que ya se sabe
    } finally {
      setBusy(false);
    }
  }, [consultationId, supabase]);

  useEffect(() => {
    if (!code) return;

    const concepts = extractConcepts(note);
    const rev = conceptsRevision(concepts);
    if (rev === sentRev.current) return;

    // Debounce: mientras se dicta, la nota se reescribe entera cada pocos segundos.
    // Medio segundo agrupa las correcciones sin que se note el retraso en el campo.
    const t = setTimeout(() => {
      void (async () => {
        const { error: pushError } = await supabase.rpc("push_agent_values", {
          p_consultation_id: consultationId,
          p_values: concepts,
          p_rev: rev,
        });
        if (pushError) return; // se reintenta solo en el próximo cambio de la nota
        sentRev.current = rev;
        setPushed(concepts);
      })();
    }, 500);

    return () => clearTimeout(t);
  }, [code, note, consultationId, supabase]);

  const enviados = Object.keys(pushed).length;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="flex items-center gap-2">
        <Monitor className="size-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-medium">Agente de escritorio</h3>
      </header>

      {!code ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Genera un código y tecléalo en Ü para que vaya llenando los signos vitales
            en el sistema del hospital mientras hablas.
          </p>
          <button
            type="button"
            onClick={generar}
            disabled={busy}
            className="mt-3 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Generando…" : "Generar código"}
          </button>
        </>
      ) : (
        <>
          {/* Grande y monoespaciado: se teclea a mano en otra pantalla, a veces
              leyéndolo de lejos. */}
          <p
            className="mt-3 select-all font-mono text-2xl tracking-[0.3em]"
            aria-label={`Código de emparejamiento: ${code.split("").join(" ")}`}
          >
            {code}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Válido 8 horas. {enviados > 0
              ? `Enviando ${enviados} dato(s) al agente.`
              : "Aún no hay signos vitales en la nota."}
          </p>
          <button
            type="button"
            onClick={generar}
            disabled={busy}
            className="mt-2 text-xs text-muted-foreground underline disabled:opacity-50"
          >
            Generar uno nuevo (anula el anterior)
          </button>
        </>
      )}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
