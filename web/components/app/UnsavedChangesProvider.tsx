"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/ConfirmDialog";

/**
 * Guard de navegación para pantallas con cambios sin guardar (p. ej. la
 * consulta en vivo con una transcripción dictada).
 *
 * App Router de Next 16 no expone `router.events` ni una forma de CANCELAR una
 * navegación en curso, así que el guard se aplica en los puntos de navegación
 * (los `<Link>`/`router.push` del shell interceptan el clic con un confirm
 * síncrono) más un `beforeunload` para recarga/cierre y un `popstate`
 * best-effort para el botón atrás/adelante del navegador.
 */

type GuardState = { message: string } | null;

interface UnsavedChangesValue {
  /** true si no hay guard activo o el usuario confirma abandonar. */
  confirmLeave: () => Promise<boolean>;
  /** ¿Hay cambios sin guardar ahora mismo? Síncrono, para frenar un clic. */
  hasGuard: () => boolean;
  /** Ejecuta `navigate` solo si `confirmLeave` pasa. */
  guardedNavigate: (navigate: () => void) => void;
  /** Registra/limpia el guard. Lo usa `useUnsavedChangesGuard`. */
  setGuard: (guard: GuardState) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  // Ref, no estado: cambiar el guard no debe re-renderizar el árbol de la app.
  const confirm = useConfirm();
  const guardRef = useRef<GuardState>(null);
  // URL protegida en el momento de registrar el guard (para revertir popstate).
  const guardedUrlRef = useRef<string | null>(null);

  const setGuard = useCallback((guard: GuardState) => {
    guardRef.current = guard;
    guardedUrlRef.current = guard
      ? window.location.pathname + window.location.search
      : null;
  }, []);

  /** ¿Hay algo que perder? Síncrono, para poder frenar un clic antes de navegar. */
  const hasGuard = useCallback(() => guardRef.current !== null, []);

  const confirmLeave = useCallback(async () => {
    const guard = guardRef.current;
    if (!guard) return true;
    return confirm({
      titulo: "Tienes cambios sin guardar",
      descripcion: guard.message,
      confirmLabel: "Salir sin guardar",
      tono: "peligro",
    });
  }, [confirm]);

  const guardedNavigate = useCallback(
    (navigate: () => void) => {
      // Camino rápido: sin nada que perder se navega en el acto, sin meter un
      // salto de microtarea en cada clic de la app.
      if (!guardRef.current) {
        navigate();
        return;
      }
      void confirmLeave().then((ok) => {
        if (ok) navigate();
      });
    },
    [confirmLeave],
  );

  // Recarga / cierre de pestaña.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (guardRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Atrás/adelante del navegador. Limitación conocida: cuando dispara popstate
  // App Router ya procesó la navegación, así que si el usuario cancela hay un
  // parpadeo de la ruta destino antes de volver (no hay API para cancelarla).
  //
  // AQUÍ SE QUEDA EL DIÁLOGO NATIVO A PROPÓSITO. Es el único de la app que no
  // se migró: `window.confirm` bloquea el hilo, y ese bloqueo es justamente lo
  // que evita la pérdida de datos. Con un diálogo propio (asíncrono) la
  // pantalla de dictado se desmontaría mientras el médico decide, y la
  // transcripción se perdería antes de que pudiera responder.
  useEffect(() => {
    function onPopState() {
      const guard = guardRef.current;
      if (!guard) return;
      if (!window.confirm(guard.message)) {
        const url = guardedUrlRef.current;
        if (url) router.push(url);
      } else {
        // El usuario abandona: el guard deja de aplicar a la ruta anterior.
        guardRef.current = null;
        guardedUrlRef.current = null;
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);

  return (
    <UnsavedChangesContext.Provider
      value={{ confirmLeave, hasGuard, guardedNavigate, setGuard }}
    >
      {children}
    </UnsavedChangesContext.Provider>
  );
}

/** Helpers para los componentes de navegación (sidebar, command palette…). */
export function useNavigationGuard(): {
  confirmLeave: () => Promise<boolean>;
  hasGuard: () => boolean;
  guardedNavigate: (navigate: () => void) => void;
} {
  const ctx = useContext(UnsavedChangesContext);
  // Fuera del provider (p. ej. superadmin) la navegación no se bloquea.
  if (!ctx) {
    return {
      confirmLeave: async () => true,
      hasGuard: () => false,
      guardedNavigate: (fn) => fn(),
    };
  }
  return {
    confirmLeave: ctx.confirmLeave,
    hasGuard: ctx.hasGuard,
    guardedNavigate: ctx.guardedNavigate,
  };
}

/** Registra un guard mientras `hasUnsaved` sea true. */
export function useUnsavedChangesGuard(hasUnsaved: boolean, message: string): void {
  const ctx = useContext(UnsavedChangesContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setGuard(hasUnsaved ? { message } : null);
    return () => ctx.setGuard(null);
  }, [ctx, hasUnsaved, message]);
}
