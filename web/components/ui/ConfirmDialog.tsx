"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Confirmaciones de la app.
 *
 * POR QUÉ EXISTE: había once `window.confirm()` nativos, uno de ellos en mitad
 * de una grabación. El diálogo del navegador bloquea el hilo, no se puede
 * maquetar, sale con los botones en el idioma del sistema y en iOS aparece
 * como "localhost dice:". Para una app clínica que se le enseña a un hospital,
 * eso es una fuga de la marca justo en el momento de más peso.
 *
 * SE APOYA EN `<dialog>` NATIVO, el mismo patrón ya probado en
 * components/superadmin/DangerZoneDialog.tsx: `showModal()` regala trampa de
 * foco, cierre con Escape, capa superior sobre cualquier z-index y devolución
 * del foco al elemento que lo abrió. Nada de eso hay que escribirlo.
 */

export interface ConfirmOptions {
  titulo: string;
  descripcion?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `peligro` pinta el botón en rojo: borrar, descartar, perder trabajo. */
  tono?: "peligro" | "principal";
}

type Peticion = { opts: ConfirmOptions; resolver: (ok: boolean) => void };

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(
  null,
);

/**
 * Devuelve una función que abre el diálogo y resuelve a true/false.
 * Uso: `if (!(await confirm({ titulo: "…" }))) return;`
 */
export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [peticion, setPeticion] = useState<Peticion | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolver) => setPeticion({ opts, resolver })),
    [],
  );

  const responder = useCallback(
    (ok: boolean) => {
      setPeticion((actual) => {
        actual?.resolver(ok);
        return null;
      });
    },
    [],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {peticion ? <ConfirmDialog opts={peticion.opts} onResponder={responder} /> : null}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  opts,
  onResponder,
}: {
  opts: ConfirmOptions;
  onResponder: (ok: boolean) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const peligro = opts.tono === "peligro";

  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    // Abrir y bloquear el scroll son cosas separadas: con `if (el.open) return`
    // arriba, un remontaje del efecto (React lo hace en desarrollo) se saltaba
    // el bloqueo y la página seguía moviéndose detrás del diálogo.
    if (!el.open) el.showModal();
    // `<dialog>` nativo NO bloquea el scroll del fondo: con el diálogo abierto
    // la página seguía moviéndose detrás.
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  return (
    <dialog
      ref={dialogo}
      // Escape dispara `cancel`: se trata como "no".
      onCancel={(e) => {
        e.preventDefault();
        onResponder(false);
      }}
      // Clic en el telón. El <dialog> ocupa toda la pantalla, así que un clic
      // fuera del panel llega con el propio diálogo como destino.
      onClick={(e) => {
        if (e.target === dialogo.current) onResponder(false);
      }}
      className="preview-in m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[24px] border border-line bg-surface p-0 text-deep shadow-[var(--elev-3)] backdrop:bg-night/40"
    >
      <div className="flex items-start gap-3 px-5 pb-2 pt-5">
        <span
          aria-hidden
          className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            peligro ? "bg-danger-soft text-danger-ink" : "bg-accent-soft text-accent-ink"
          }`}
        >
          <AlertTriangle size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold leading-snug">{opts.titulo}</h2>
          {opts.descripcion ? (
            <div className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              {opts.descripcion}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 px-5 pb-5 pt-4 sm:flex-row sm:justify-end">
        {/* Cancelar recibe el foco inicial: ante una acción que no se puede
            deshacer, la tecla Enter a ciegas no debe ejecutarla. */}
        <button
          type="button"
          autoFocus
          onClick={() => onResponder(false)}
          className="clinical-secondary w-full sm:w-auto"
        >
          {opts.cancelLabel ?? "Cancelar"}
        </button>
        <button
          type="button"
          onClick={() => onResponder(true)}
          className={`${peligro ? "clinical-danger" : "clinical-primary"} w-full sm:w-auto`}
        >
          {opts.confirmLabel ?? "Confirmar"}
        </button>
      </div>
    </dialog>
  );
}
