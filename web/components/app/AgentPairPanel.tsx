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
  approved,
}: {
  consultationId: string;
  /** La nota tal como la tiene la página en vivo. `null` mientras aún no hay nada. */
  note: { sections?: readonly NoteSectionLike[] } | null;
  /**
   * La nota está generada, revisada y guardada (`noteSaved && !noteDirty`).
   *
   * NADA sale de aquí antes de eso, y es una decisión de seguridad, no de comodidad.
   * Estos números terminan escritos en la historia clínica de un hospital: que hayan
   * pasado por los ojos del médico antes de salir es la única garantía que de verdad
   * vale. Empujar mientras se dicta era más vistoso y metía valores a medio decir en
   * un sistema clínico.
   */
  approved: boolean;
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
    if (!code || !approved) return;

    const concepts = extractConcepts(note?.sections);
    const rev = conceptsRevision(concepts);
    if (rev === sentRev.current) return;

    void (async () => {
      const { error: pushError } = await supabase.rpc("push_agent_values", {
        p_consultation_id: consultationId,
        p_values: concepts,
        p_rev: rev,
      });
      if (pushError) {
        // A la vista, no en silencio. Tragarse este error dejaba el panel diciendo lo
        // mismo de siempre mientras el agente recibía cero datos, y desde fuera era
        // indistinguible de «la nota no tiene signos vitales».
        setError(`No se pudieron enviar los datos: ${pushError.message}`);
        return; // se reintenta solo si la nota vuelve a cambiar
      }
      setError(null);
      sentRev.current = rev;
      setPushed(concepts);
    })();
  }, [code, approved, note, consultationId, supabase]);

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
              ? `${enviados} dato(s) disponibles para el agente.`
              : approved
                ? "La nota guardada no trae signos vitales que sepa reconocer."
                : "Genera la nota y guárdala: los datos se envían al guardar."}
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
