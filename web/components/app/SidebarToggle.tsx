"use client";

import { useEffect, useRef } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const CLAVE = "miracle-sidebar";

/**
 * Contrae o expande el menú lateral.
 *
 * El estado no vive en React sino en `<html data-sidebar>` (mismo patrón que el
 * tema oscuro): el script del layout lo aplica antes del primer pintado, así que
 * el servidor y el cliente renderizan el mismo HTML y al recargar no hay salto.
 * Todo lo visual lo resuelve el CSS de `globals.css`.
 */
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

  function alternar() {
    const raiz = document.documentElement;
    const contraido = raiz.dataset.sidebar === "collapsed";
    if (contraido) delete raiz.dataset.sidebar;
    else raiz.dataset.sidebar = "collapsed";
    ref.current?.setAttribute("aria-expanded", contraido ? "true" : "false");
    try {
      localStorage.setItem(CLAVE, contraido ? "expanded" : "collapsed");
    } catch {
      /* almacenamiento no disponible */
    }
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={alternar}
      aria-label="Contraer o expandir el menú"
      title="Contraer o expandir el menú"
      className={`sidebar-toggle h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-text ${className}`}
    >
      <PanelLeftClose size={18} className="sidebar-expanded-only" />
      <PanelLeftOpen size={18} className="sidebar-collapsed-only" />
    </button>
  );
}
