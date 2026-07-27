"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Monitor } from "lucide-react";

import {
  conceptsRevision,
  extractConcepts,
  type ConceptMap,
  type NoteSectionLike,
} from "@/lib/clinical/vital-concepts";
import { createClient } from "@/lib/supabase/client";

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
  transcript,
}: {
  consultationId: string;
  /** La nota tal como la tiene la página en vivo. `null` mientras aún no hay nada. */
  note: { sections?: readonly NoteSectionLike[] } | null;
  /**
   * El borrador de la transcripción, que es lo ÚNICO que crece mientras el médico
   * habla. La nota no existe hasta que se pulsa «Generar nota clínica», así que
   * leyendo solo la nota los datos aparecían al final y se perdía todo el sentido de
   * que se vayan llenando durante la conversación.
   */
  transcript: string;
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

    // La NOTA va primero y el borrador después: los patrones se quedan con la primera
    // coincidencia, así que lo curado gana sobre lo crudo. Si el médico se corrige al
    // hablar («talla 1.75… perdón, 1.70»), la nota ya trae el valor bueno; y mientras
    // la nota no exista, el borrador es lo único que hay.
    const concepts = extractConcepts([
      ...(note?.sections ?? []),
      { texto: transcript },
    ]);
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
  }, [code, note, transcript, consultationId, supabase]);

  const enviados = Object.keys(pushed).length;

  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <Monitor size={14} aria-hidden />
        Agente de escritorio
      </div>

      {!code ? (
        <>
          <p className="mt-2 text-sm text-muted">
            Genera un código y tecléalo en Ü para que vaya llenando los signos vitales
            en el sistema del hospital mientras hablas.
          </p>
          <button
            type="button"
            onClick={generar}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-accent/25 bg-accent-soft/45 px-3 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-soft disabled:opacity-50"
          >
            {busy ? "Generando…" : "Generar código"}
          </button>
        </>
      ) : (
        <>
          {/* Grande y monoespaciado: se teclea a mano en la otra pantalla, a veces
              leyéndolo de lejos. `select-all` para poder copiarlo de un clic. */}
          <p
            className="mt-3 select-all font-mono text-2xl tracking-[0.3em] text-deep"
            aria-label={`Código de emparejamiento: ${code.split("").join(" ")}`}
          >
            {code}
          </p>
          <p className="mt-2 text-xs text-muted">
            Válido 8 horas.{" "}
            {enviados > 0
              ? `Enviando ${enviados} dato(s) al agente.`
              : "Aún no se han dicho signos vitales."}
          </p>
          <button
            type="button"
            onClick={generar}
            disabled={busy}
            className="mt-2 text-xs text-muted underline disabled:opacity-50"
          >
            Generar uno nuevo (anula el anterior)
          </button>
        </>
      )}

      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
