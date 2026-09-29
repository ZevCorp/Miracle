"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { getSnippets, type Snippet } from "@/lib/clinical/snippets";
import { createClient } from "@/lib/supabase/client";

/**
 * Los atajos del médico, cargados UNA vez por sesión.
 *
 * Antes cada SnippetPopup se los pedía a Supabase al montarse. Como el popup se
 * monta y desmonta con cada apertura y hay uno por sección, una nota de ocho
 * secciones podía disparar ocho peticiones idénticas —cada una con su spinner—
 * para pintar exactamente la misma lista. Ninguna mejora visual del popup se
 * siente rápida mientras eso siga pasando.
 *
 * CARGA PEREZOSA. Montar el provider no pide nada: la secretaria no necesita
 * atajos y no tiene por qué pagar la consulta. La dispara el primer popup que se
 * abre, o el gestor al montarse.
 *
 * NO VA EN MiracleProvider a propósito: ese contexto se re-renderiza con cada
 * consulta, paciente y toast, y filterSnippets se recalcularía con cada tecla
 * escrita en cualquier parte de la app.
 */

interface SnippetsValue {
  snippets: Snippet[];
  loading: boolean;
  error: string | null;
  /** Idempotente: varias llamadas a la vez comparten una sola petición. */
  ensureLoaded: () => void;
  reload: () => Promise<void>;
  /** Tras confirmar la escritura en Supabase, para no volver a leer la tabla. */
  add: (snippet: Snippet) => void;
  replace: (snippet: Snippet) => void;
  remove: (id: string) => void;
}

const SnippetsContext = createContext<SnippetsValue | null>(null);

export function SnippetsProvider({ children }: { children: React.ReactNode }) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // La promesa en curso: es lo que hace que ocho secciones abriendo a la vez
  // compartan una sola consulta en vez de lanzar ocho.
  const enVuelo = useRef<Promise<void> | null>(null);
  const yaCargado = useRef(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSnippets(createClient());
      setSnippets(result);
      yaCargado.current = true;
    } catch {
      setError("No se pudieron cargar tus atajos.");
    } finally {
      setLoading(false);
      enVuelo.current = null;
    }
  }, []);

  const ensureLoaded = useCallback(() => {
    if (yaCargado.current || enVuelo.current) return;
    enVuelo.current = fetchAll();
  }, [fetchAll]);

  const reload = useCallback(async () => {
    yaCargado.current = false;
    enVuelo.current = fetchAll();
    await enVuelo.current;
  }, [fetchAll]);

  const add = useCallback((snippet: Snippet) => {
    setSnippets((current) => [snippet, ...current]);
  }, []);

  const replace = useCallback((snippet: Snippet) => {
    setSnippets((current) =>
      current.map((item) => (item.id === snippet.id ? snippet : item)),
    );
  }, []);

  const remove = useCallback((id: string) => {
    setSnippets((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo<SnippetsValue>(
    () => ({ snippets, loading, error, ensureLoaded, reload, add, replace, remove }),
    [snippets, loading, error, ensureLoaded, reload, add, replace, remove],
  );

  return (
    <SnippetsContext.Provider value={value}>{children}</SnippetsContext.Provider>
  );
}

export function useSnippets(): SnippetsValue {
  const value = useContext(SnippetsContext);
  if (!value) {
    throw new Error("useSnippets debe usarse dentro de SnippetsProvider.");
  }
  return value;
}
