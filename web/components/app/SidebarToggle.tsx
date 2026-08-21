"use client";

import { useEffect, useRef } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const CLAVE = "miracle-sidebar";

/**
 * El estado no vive en React sino en `<html data-sidebar>` (mismo patrón que el
 * tema oscuro): el script del layout lo aplica antes del primer pintado, así que
 * el servidor y el cliente renderizan el mismo HTML y al recargar no hay salto.
 * Todo lo visual lo resuelve el CSS de `globals.css`.
 */
function alternar() {
  const raiz = document.documentElement;
  const contraido = raiz.dataset.sidebar === "collapsed";
  if (contraido) delete raiz.dataset.sidebar;
  else raiz.dataset.sidebar = "collapsed";
  for (const boton of document.querySelectorAll<HTMLElement>(".sidebar-toggle")) {
    boton.setAttribute("aria-expanded", contraido ? "true" : "false");
  }
  try {
    localStorage.setItem(CLAVE, contraido ? "expanded" : "collapsed");
  } catch {
    /* almacenamiento no disponible */
  }
}

/**
 * Ctrl/⌘+B contrae y expande sin tocar el ratón.
 *
 * Se registra UNA sola vez aunque haya varios botones montados (en la consola,
 * el cajón móvil monta un segundo menú): dos escuchas alternarían dos veces y el
 * menú se quedaría igual. De ahí el conteo de referencias.
 */
let montados = 0;
let quitarEscucha: (() => void) | null = null;

function escribiendo(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) return false;
  return (
    destino.isContentEditable ||
    destino.tagName === "INPUT" ||
    destino.tagName === "TEXTAREA" ||
    destino.tagName === "SELECT"
  );
}

function usarAtajo(): () => void {
  montados += 1;
  if (montados === 1) {
    const alPulsar = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if (e.key !== "b" && e.key !== "B") return;
      // Un médico se pasa el día escribiendo la nota: dentro de un campo el
      // atajo no existe, para no robarle una pulsación mientras redacta.
      if (escribiendo(e.target)) return;
      e.preventDefault();
      alternar();
    };
    window.addEventListener("keydown", alPulsar);
    quitarEscucha = () => window.removeEventListener("keydown", alPulsar);
  }
  return () => {
    montados -= 1;
    if (montados === 0) {
      quitarEscucha?.();
      quitarEscucha = null;
    }
  };
}

export function SidebarToggle({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);

  // aria-expanded se fija después de montar, nunca durante el render: leer el
  // atributo del <html> al renderizar rompería la hidratación.
  useEffect(() => {
    ref.current?.setAttribute(
      "aria-expanded",
      document.documentElement.dataset.sidebar === "collapsed" ? "false" : "true",
    );
  }, []);

  useEffect(() => usarAtajo(), []);

  return (
    <button
      ref={ref}
      type="button"
      onClick={alternar}
      aria-label="Contraer o expandir el menú"
      className={`sidebar-toggle group relative h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-text ${className}`}
    >
      <PanelLeftClose size={18} className="sidebar-expanded-only" />
      <PanelLeftOpen size={18} className="sidebar-collapsed-only" />

      {/* Pista al apuntar, con el atajo a la vista: es como se aprende que el
          atajo existe sin tener que leer documentación. Se ancla a la izquierda
          del botón y crece hacia la derecha para no salirse de la pantalla
          cuando el menú está contraído a 72px. */}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-[70] mt-2 flex translate-y-1 items-center gap-2 whitespace-nowrap rounded-lg bg-night px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-[var(--shadow-md)] transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
      >
        <span className="sidebar-expanded-only">Contraer menú</span>
        <span className="sidebar-collapsed-only">Expandir menú</span>
        <kbd className="rounded border border-white/25 px-1 py-px text-[10px] font-semibold text-white/70">
          Ctrl B
        </kbd>
      </span>
    </button>
  );
}
