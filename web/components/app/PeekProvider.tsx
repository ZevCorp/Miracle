"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

/**
 * El estado del panel rápido (peek): qué consulta o paciente está abierto y
 * sobre qué lista, para que J/K recorra lo que el médico tiene en pantalla.
 *
 * Vive en contexto y NO en la URL a propósito: /app/consultas y /app/notas son
 * páginas de servidor, y un cambio de URL las volvería a pedir en cada
 * apertura — exactamente el viaje que el peek existe para evitar. El botón
 * atrás del móvil se resuelve igual con un `pushState` centinela: abrir el
 * panel empuja una entrada marcada, y `popstate` lo cierra.
 */

export type PeekTarget =
  | { kind: "consultation"; id: string }
  | { kind: "patient"; id: string };

interface PeekValue {
  target: PeekTarget | null;
  /** Ids de la lista visible al abrir; J/K se mueve dentro de ella. */
  listIds: readonly string[];
  openPeek: (target: PeekTarget, listIds?: readonly string[]) => void;
  /**
   * Cierra el panel. Por defecto deshace la entrada centinela con un
   * `history.back()`, que es lo correcto para la X y para Escape.
   *
   * `{ rewind: false }` es OBLIGATORIO cuando se cierra PARA NAVEGAR a otra
   * pantalla: ese back() es asíncrono y se ejecuta DESPUÉS del push del
   * enlace, así que deshace la navegación y devuelve al médico a la lista.
   * Era exactamente el fallo de "Abrir completo": el botón parecía muerto.
   */
  closePeek: (opts?: { rewind?: boolean }) => void;
  /** J/K: se mueve delta posiciones dentro de listIds (con tope). */
  movePeek: (delta: number) => void;
}

const PeekContext = createContext<PeekValue | null>(null);

/** Marca de la entrada de historial que abre el peek. */
const CENTINELA = "miraclePeek";

export function PeekProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<PeekTarget | null>(null);
  const [listIds, setListIds] = useState<readonly string[]>([]);
  // El popstate de cierre no debe hacer history.back() otra vez.
  const cerrandoPorPop = useRef(false);

  const openPeek = useCallback(
    (next: PeekTarget, ids: readonly string[] = []) => {
      setTarget((prev) => {
        // Solo la PRIMERA apertura empuja historial: navegar con J/K o
        // encadenar paneles no debe apilar una entrada por consulta.
        if (!prev) {
          try {
            window.history.pushState({ [CENTINELA]: true }, "");
          } catch {
            /* Safari en modo raro: el peek funciona igual, solo sin atrás. */
          }
        }
        return next;
      });
      if (ids.length) setListIds(ids);
    },
    [],
  );

  const closePeek = useCallback((opts?: { rewind?: boolean }) => {
    setTarget(null);
    setListIds([]);
    // Deshacer la entrada centinela SOLO si sigue siendo la actual: si el
    // navegador ya se movió (popstate nos cerró), retroceder otra vez se
    // comería una entrada que no es nuestra.
    if (cerrandoPorPop.current || !window.history.state?.[CENTINELA]) {
      cerrandoPorPop.current = false;
      return;
    }
    if (opts?.rewind === false) {
      // Se cierra para IRSE a otra pantalla. Aquí un back() cancelaría el push
      // del enlace, así que solo se apaga la marca en su sitio: el "atrás" de
      // la pantalla de destino vuelve a la lista sin intentar cerrar un panel
      // que ya no existe. Se conserva el resto del estado porque ahí vive el
      // árbol interno del router de Next.
      try {
        window.history.replaceState(
          { ...window.history.state, [CENTINELA]: false },
          "",
        );
      } catch {
        /* Si no se puede, la marca sobrante solo provoca un popstate inocuo. */
      }
      return;
    }
    window.history.back();
  }, []);

  const movePeek = useCallback(
    (delta: number) => {
      setTarget((prev) => {
        if (!prev || !listIds.length) return prev;
        const actual = listIds.indexOf(prev.id);
        if (actual === -1) return prev;
        const siguiente = Math.min(listIds.length - 1, Math.max(0, actual + delta));
        return siguiente === actual ? prev : { ...prev, id: listIds[siguiente] };
      });
    },
    [listIds],
  );

  // Botón atrás (móvil y escritorio): la entrada centinela desaparece del
  // historial y el panel se cierra con ella.
  useEffect(() => {
    function onPop() {
      cerrandoPorPop.current = true;
      setTarget((prev) => {
        if (prev === null) cerrandoPorPop.current = false;
        return null;
      });
      setListIds([]);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const value = useMemo(
    () => ({ target, listIds, openPeek, closePeek, movePeek }),
    [target, listIds, openPeek, closePeek, movePeek],
  );

  return <PeekContext.Provider value={value}>{children}</PeekContext.Provider>;
}

export function usePeek(): PeekValue {
  const ctx = useContext(PeekContext);
  if (!ctx) throw new Error("usePeek necesita PeekProvider");
  return ctx;
}

/**
 * onClick para un <Link> de lista: el clic izquierdo puro abre el peek sin
 * navegar; con ctrl/cmd/shift o botón central, el enlace navega como siempre
 * (pestaña nueva, etc.). Así el peek AHORRA el viaje sin confiscarlo.
 */
export function usePeekClick(
  target: PeekTarget,
  listIds?: readonly string[],
): (event: MouseEvent<HTMLAnchorElement>) => void {
  const { openPeek } = usePeek();
  return useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }
      event.preventDefault();
      openPeek(target, listIds);
    },
    [openPeek, target, listIds],
  );
}
