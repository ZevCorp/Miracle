"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { SuperadminSidebar, type NavCounts } from "./SuperadminSidebar";

/**
 * Navegación de la consola en móvil: hamburguesa + drawer. Bajo `md` la sidebar
 * fija desaparece, y sin esto la consola quedaba sin navegación en el teléfono.
 * Reutiliza el SuperadminSidebar completo pasándole onNavigate para cerrarse.
 */
export function MobileSidebar({ counts }: { counts?: NavCounts }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // El foco entra al panel para que teclado y lectores sigan la apertura.
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir navegación"
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-deep hover:bg-ice-soft"
      >
        <Menu size={20} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Cerrar navegación"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navegación de la consola"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-72 outline-none"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text"
            >
              <X size={18} />
            </button>
            <SuperadminSidebar counts={counts} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
