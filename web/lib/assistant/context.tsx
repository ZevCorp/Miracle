"use client";

// Puente entre la pantalla de la consulta y el asistente clínico.
//
// POR QUÉ EXISTE: el chat vive en el AppShell (ventana flotante) y, en la
// consulta en vivo, embebido en el panel lateral. Ninguna de las dos
// superficies conoce la nota que el médico tiene en pantalla, los códigos ni
// el paciente. La página que SÍ los tiene los publica aquí; el chat los lee
// al armar cada pregunta y los usa para decidir qué preguntas de inicio
// ofrecer y si puede aplicar una propuesta de nota.
//
// POR QUÉ NO ES UN ESTADO NORMAL DE REACT: la consulta en vivo se re-renderiza
// con cada segmento dictado y la nota cambia con cada tecla. Publicar el
// objeto en un useState provocaría un ciclo (publicar → re-render del shell →
// re-render de la página → objeto nuevo → publicar…). Aquí el valor vive en un
// ref y solo se avisa a los consumidores cuando cambia algo que ellos pintan
// (una firma barata del contexto); al enviar una pregunta se lee siempre lo
// último.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AssistantCodeContext,
  AssistantNoteProposal,
  AssistantPatientContext,
  ClinicalNoteJson,
} from "@/lib/api/clinical";

export interface AssistantEncounterContext {
  /** Encounter de Graph (mismo id que la consulta del historial). */
  encounterId: string | null;
  specialtyCode: string | null;
  templateName?: string;
  /** La nota tal como está en pantalla, guardada o no. */
  note: ClinicalNoteJson | null;
  codes: AssistantCodeContext[];
  patient: AssistantPatientContext | null;
  /** false = firmada/exportada o sin permiso: el chat no ofrece «Aplicar». */
  editable: boolean;
  hasTranscript: boolean;
  /**
   * Aplica una propuesta a la nota de la página. Devuelve false si el médico
   * canceló (deriva detectada) o no se pudo aplicar.
   */
  applyProposal?: (proposal: AssistantNoteProposal) => Promise<boolean> | boolean;
}

interface AssistantContextStore {
  getValue: () => AssistantEncounterContext | null;
  /** Cambia cuando cambia algo que los consumidores pintan. */
  version: number;
  publish: (value: AssistantEncounterContext | null) => void;
}

const AssistantContext = createContext<AssistantContextStore | null>(null);

/** Firma barata del contexto: lo que, si cambia, el chat debe volver a pintar. */
export function assistantContextSignature(value: AssistantEncounterContext | null): string {
  if (!value) return "";
  return JSON.stringify({
    e: value.encounterId,
    s: value.specialtyCode,
    t: value.templateName ?? "",
    n: value.note ? value.note.sections.map((section) => [section.key, section.content]) : null,
    m: value.note?.summary ?? "",
    c: value.codes.map((code) => `${code.sistema}:${code.codigo}:${code.estado}`),
    p: value.patient,
    ed: value.editable,
    tr: value.hasTranscript,
    ap: Boolean(value.applyProposal),
  });
}

export function AssistantContextProvider({ children }: { children: ReactNode }) {
  const latest = useRef<AssistantEncounterContext | null>(null);
  const lastSignature = useRef("");
  const [version, setVersion] = useState(0);

  const publish = useCallback((value: AssistantEncounterContext | null) => {
    latest.current = value;
    const signature = assistantContextSignature(value);
    if (signature !== lastSignature.current) {
      lastSignature.current = signature;
      setVersion((current) => current + 1);
    }
  }, []);

  const store = useMemo<AssistantContextStore>(
    () => ({ getValue: () => latest.current, version, publish }),
    [version, publish],
  );

  return <AssistantContext.Provider value={store}>{children}</AssistantContext.Provider>;
}

/**
 * Lo que la página de la consulta publicó, o null fuera de una consulta. Se
 * re-renderiza solo cuando cambia la firma del contexto.
 */
export function useAssistantContext(): AssistantEncounterContext | null {
  const store = useContext(AssistantContext);
  // `version` es la dependencia real: fuerza el re-render cuando el contexto
  // cambió aunque el ref sea el mismo.
  return useMemo(() => store?.getValue() ?? null, [store]);
}

/**
 * Para la página que tiene la consulta: publica el contexto en cada render
 * (barato: es un ref) y lo retira al desmontar. Pasar null equivale a «sin
 * consulta».
 */
export function useAssistantContextPublisher(value: AssistantEncounterContext | null) {
  const store = useContext(AssistantContext);
  const publish = store?.publish;
  useEffect(() => {
    publish?.(value);
  });
  useEffect(() => () => publish?.(null), [publish]);
}
