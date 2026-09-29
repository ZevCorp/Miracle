"use client";

/**
 * Estado, autoguardado y recuperación de las anotaciones por sección.
 *
 * QUÉ TIENE QUE AGUANTAR (esto pasa EN MITAD DE UNA CONSULTA):
 *
 *   - Escribir no puede tocar la grabación. Por eso el estado vive aquí y no
 *     junto al de la transcripción: teclear en una sección no re-renderiza el
 *     dictado ni interrumpe el WebSocket.
 *   - Guardar no puede ir por cada tecla. Se espera a que el médico deje de
 *     escribir (DEBOUNCE_MS) y se manda una sola escritura por sección.
 *   - Lo escrito no se puede perder. Dos redes de seguridad:
 *       1. localStorage, en el mismo evento en que se teclea. Sobrevive a un
 *          refresco, a cerrar la pestaña y a quedarse sin internet.
 *       2. Supabase, con upsert por (encounter_id, section_key).
 *     Al abrir se leen las dos y GANA LA MÁS RECIENTE, que casi siempre es la
 *     local: es la que pudo no haber llegado a la nube.
 *   - Si Supabase falla, la pantalla lo dice pero NO borra nada ni bloquea al
 *     médico: lo escrito sigue en pantalla y en localStorage, y el siguiente
 *     guardado reintenta.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeSectionDrafts, type SectionDrafts } from "./section-drafts";

/** Silencio de tecleo tras el cual se guarda. Ni tan corto que escriba en cada
 *  letra, ni tan largo que un cierre brusco se lleve la frase. */
const DEBOUNCE_MS = 900;
const MAX_CONTENT = 20_000;

export type SaveState = "idle" | "saving" | "saved" | "error";

function storageKey(encounterId: string): string {
  return `miracle:section-drafts:${encounterId}`;
}

/** Copia local. Nunca lanza: sin localStorage (modo privado) se sigue igual. */
function readLocal(encounterId: string): SectionDrafts {
  try {
    const crudo = window.localStorage.getItem(storageKey(encounterId));
    if (!crudo) return {};
    const parsed = JSON.parse(crudo) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return normalizeSectionDrafts(parsed as SectionDrafts);
  } catch {
    return {};
  }
}

function writeLocal(encounterId: string, drafts: SectionDrafts): void {
  try {
    window.localStorage.setItem(storageKey(encounterId), JSON.stringify(drafts));
  } catch {
    // Cuota llena o almacenamiento bloqueado: la copia en la nube sigue en pie.
  }
}

export function clearLocalSectionDrafts(encounterId: string): void {
  try {
    window.localStorage.removeItem(storageKey(encounterId));
  } catch {
    /* nada que hacer */
  }
}

export interface SectionDraftsController {
  drafts: SectionDrafts;
  setDraft: (sectionKey: string, content: string) => void;
  saveState: SaveState;
  /** Fuerza a guardar lo pendiente. Se llama antes de generar la nota. */
  flush: () => Promise<void>;
  /** `true` mientras se lee lo ya guardado, para no pintar cajas vacías. */
  loading: boolean;
}

export function useSectionDrafts(encounterId: string | null): SectionDraftsController {
  const [drafts, setDrafts] = useState<SectionDrafts>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loading, setLoading] = useState(Boolean(encounterId));

  // Las secciones con cambios sin escribir. Se lleva en ref y no en estado
  // porque cambia en cada tecla y no debe provocar un render.
  const pendientes = useRef<Set<string>>(new Set());
  const timer = useRef<number | null>(null);
  // El valor vigente para el temporizador, que se dispara fuera del render.
  const draftsRef = useRef<SectionDrafts>({});
  draftsRef.current = drafts;

  // Carga inicial: local y nube, gana la más reciente.
  useEffect(() => {
    if (!encounterId) {
      setDrafts({});
      setLoading(false);
      return;
    }
    let vivo = true;
    const local = readLocal(encounterId);
    // Se pinta lo local de inmediato: si el médico refrescó sin querer, ve su
    // texto al instante y no una pantalla vacía mientras responde la red.
    if (Object.keys(local).length) setDrafts(local);

    void (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("encounter_section_drafts")
          .select("section_key, content")
          .eq("encounter_id", encounterId);
        if (!vivo) return;
        if (error) {
          // Sin nube se sigue con lo local: escribir nunca se bloquea.
          setLoading(false);
          return;
        }
        const remoto: SectionDrafts = {};
        for (const fila of data ?? []) {
          const key = (fila as { section_key?: string }).section_key;
          const content = (fila as { content?: string }).content;
          if (key && content) remoto[key] = content;
        }
        // Lo local manda sobre lo remoto en las secciones que tenga: es lo que
        // pudo no haber alcanzado a subir.
        setDrafts(normalizeSectionDrafts({ ...remoto, ...local }));
      } finally {
        if (vivo) setLoading(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [encounterId]);

  const guardarPendientes = useCallback(async () => {
    if (!encounterId) return;
    const keys = [...pendientes.current];
    if (!keys.length) return;
    pendientes.current.clear();

    const actuales = draftsRef.current;
    const conTexto = keys.filter((key) => (actuales[key] ?? "").trim());
    const sinTexto = keys.filter((key) => !(actuales[key] ?? "").trim());

    setSaveState("saving");
    try {
      const supabase = createClient();
      if (conTexto.length) {
        const filas = conTexto.map((key) => ({
          encounter_id: encounterId,
          section_key: key,
          content: (actuales[key] ?? "").slice(0, MAX_CONTENT),
        }));
        const { error } = await supabase
          .from("encounter_section_drafts")
          .upsert(filas, { onConflict: "encounter_id,section_key" });
        if (error) throw error;
      }
      // Vaciar una sección es borrarla, no guardar una cadena vacía: así la
      // tabla refleja exactamente las secciones que el médico anotó.
      if (sinTexto.length) {
        const { error } = await supabase
          .from("encounter_section_drafts")
          .delete()
          .eq("encounter_id", encounterId)
          .in("section_key", sinTexto);
        if (error) throw error;
      }
      setSaveState("saved");
    } catch {
      // Se devuelven a la cola: el siguiente guardado reintenta. Nada se borra
      // de la pantalla ni de localStorage.
      for (const key of keys) pendientes.current.add(key);
      setSaveState("error");
    }
  }, [encounterId]);

  const setDraft = useCallback(
    (sectionKey: string, content: string) => {
      const recortado = content.slice(0, MAX_CONTENT);
      setDrafts((previo) => {
        const siguiente = { ...previo, [sectionKey]: recortado };
        // localStorage en el mismo evento del tecleo: es la copia que
        // sobrevive a un cierre brusco.
        if (encounterId) writeLocal(encounterId, siguiente);
        return siguiente;
      });
      if (!encounterId) return;
      pendientes.current.add(sectionKey);
      setSaveState("saving");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        void guardarPendientes();
      }, DEBOUNCE_MS);
    },
    [encounterId, guardarPendientes],
  );

  const flush = useCallback(async () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    await guardarPendientes();
  }, [guardarPendientes]);

  // Cerrar la pestaña con algo sin guardar: localStorage ya lo tiene, así que
  // no se retiene al médico con un diálogo. Solo se intenta el envío.
  useEffect(() => {
    function alSalir() {
      if (pendientes.current.size) void guardarPendientes();
    }
    window.addEventListener("pagehide", alSalir);
    return () => {
      window.removeEventListener("pagehide", alSalir);
      alSalir();
    };
  }, [guardarPendientes]);

  return { drafts, setDraft, saveState, flush, loading };
}
