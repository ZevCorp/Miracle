"use client";

import { useEffect, useRef, useState } from "react";
import { CloudUpload, Moon, Search, Sun } from "lucide-react";
import { HoverHint } from "@/components/ui/HoverHint";
import { PulseOrb } from "@/components/app/PulseOrb";
import { signOut } from "@/app/login/actions";
import type { AuthenticatedProfile } from "@/lib/auth/server";

/**
 * LA CÁPSULA DE ESTADO — lo que antes era la barra superior.
 *
 * Una barra de ancho completo con borde y fondo para sostener cuatro controles
 * era puro cromo: robaba una franja de la pantalla en todas las pantallas y no
 * agrupaba nada que fuera junto. Ahora esos controles flotan arriba a la
 * derecha, en la misma cápsula de vidrio que el dock de acciones de abajo: la
 * app queda con dos islas —estado arriba, acciones abajo— y el contenido gana
 * el ancho completo.
 *
 * Los cortes por ancho se conservan EXACTAMENTE como estaban, porque estaban
 * pensados: el tema y la cuenta viven también en la hoja «Más» del móvil, así
 * que aquí aparecen desde `sm` y `md`. Salir sigue alcanzable en TODOS los
 * anchos (bajo md por la hoja «Más», de md en adelante por esta cápsula): ese
 * hueco entre 768 y 1024 px ya dejó a un médico encerrado en su sesión una vez.
 */
export function StatusDock({
  profile,
  syncing,
  onOpenSearch,
  onToggleTheme,
}: {
  profile: AuthenticatedProfile;
  syncing: boolean;
  onOpenSearch: () => void;
  onToggleTheme: () => void;
}) {
  const [cuenta, setCuenta] = useState(false);
  const cajaRef = useRef<HTMLDivElement>(null);

  const nombre = profile.fullName ?? profile.email;
  const iniciales = nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!cuenta) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCuenta(false);
    }
    function onDown(e: PointerEvent) {
      if (!cajaRef.current?.contains(e.target as Node)) setCuenta(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [cuenta]);

  return (
    <>
      {/* De md en adelante el buscador tiene su propia isla, con forma de campo
          abierto. No es un input de verdad y no finge serlo por capricho: la
          búsqueda vive en la paleta ⌘K, que trae su propio buscador y se lleva
          el foco al abrirse. Duplicar aquí el estado del texto solo daría dos
          sitios donde escribir lo mismo. */}
      <button
        type="button"
        onClick={onOpenSearch}
        aria-keyshortcuts="Meta+K Control+K"
        className="chrome-search clinical-control fixed top-4 z-40 hidden items-center gap-2.5 px-3.5 text-left md:flex"
      >
        <Search size={16} className="shrink-0 text-muted" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm text-muted">
          Buscar paciente o consulta
        </span>
        {/* El ⌘K solo desde lg. Entre md y lg el campo es estrecho y el chip le
            comía el sitio justo al texto, que acababa cortado: leer para qué
            sirve el campo importa más que anunciar su atajo. */}
        <kbd className="hidden shrink-0 rounded border border-line bg-surface/70 px-1.5 py-0.5 text-[11px] font-medium text-muted lg:block">
          ⌘K
        </kbd>
      </button>

      <div
        ref={cajaRef}
        className="fixed right-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-40 sm:right-4 sm:top-4"
      >
        <div className="glass-panel flex items-center gap-0.5 rounded-full p-1.5">
          {syncing ? (
            <span
              role="status"
              className="mr-0.5 inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1.5 text-xs font-semibold text-warning"
            >
              <CloudUpload size={13} className="animate-pulse" />
              <span className="hidden sm:inline">Guardando cambios…</span>
            </span>
          ) : null}

          {/* Por debajo de md no hay sitio para el campo abierto: ahí la lupa
              sigue viviendo en la cápsula. Sin el ⌘K al lado, que en un
              teléfono no significa nada y era la mitad del amontonamiento. */}
          <HoverHint label="Buscar paciente o consulta">
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Buscar paciente o consulta"
              className="icon-btn text-deep md:hidden"
            >
              <Search size={18} />
            </button>
          </HoverHint>

          <HoverHint label="Cambiar entre modo claro y oscuro">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Cambiar entre modo claro y oscuro"
              className="icon-btn hidden sm:inline-flex"
            >
              <Moon size={18} className="theme-icon-light" />
              <Sun size={18} className="theme-icon-dark" />
            </button>
          </HoverHint>

          <PulseOrb />

          {/* La cuenta: de `md` hacia arriba. Por debajo, la hoja «Más» de la
              barra inferior tiene el mismo "Cerrar sesión". */}
          <span aria-hidden className="mx-0.5 hidden h-6 w-px bg-line/70 md:block" />
          <button
            type="button"
            onClick={() => setCuenta((v) => !v)}
            aria-expanded={cuenta}
            aria-label={`Cuenta de ${nombre}`}
            title={nombre}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-night text-[13px] font-semibold text-white ring-1 ring-white/15 transition-transform hover:scale-105 motion-reduce:hover:scale-100 md:inline-flex"
          >
            {iniciales}
          </button>
        </div>

        {cuenta ? (
          <div
            role="dialog"
            aria-label="Cuenta"
            className="glass-panel absolute right-0 top-[calc(100%+0.5rem)] hidden w-64 overflow-hidden rounded-[18px] md:block"
          >
            <div className="border-b border-line/60 px-4 py-3">
              <p className="truncate text-sm font-semibold text-deep">{nombre}</p>
              {profile.email && profile.email !== nombre ? (
                <p className="data truncate text-[12px] text-muted">
                  {profile.email}
                </p>
              ) : null}
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="w-full px-4 py-3 text-left text-sm font-semibold text-deep transition-colors hover:bg-ice-soft"
              >
                Salir
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </>
  );
}
