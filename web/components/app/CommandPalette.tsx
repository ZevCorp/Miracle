"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search, User } from "lucide-react";
import { useStore } from "@/app/app/providers";
import { useNavigationGuard } from "@/components/app/UnsavedChangesProvider";

type Item = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: typeof User;
};

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { patients, consultations, getPatient, role } = useStore();
  const { guardedNavigate } = useNavigationGuard();
  const [query, setQuery] = useState("");
  const closePalette = useCallback(() => {
    setQuery("");
    onOpenChange(false);
  }, [onOpenChange]);

  // Atajo global Cmd/Ctrl+K y cierre con Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) closePalette();
        else onOpenChange(true);
      } else if (e.key === "Escape" && open) {
        closePalette();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePalette, open, onOpenChange]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    // "Nueva consulta" es una acción exclusiva del médico: la secretaría (y
    // cualquier otro rol de solo lectura) no debe verla ni activarla desde acá.
    const acciones: Item[] =
      role === "medico"
        ? [
            {
              id: "nueva",
              label: "Nueva consulta",
              hint: "Iniciar captura",
              href: "/app/consultas/nueva",
              icon: Plus,
            },
          ]
        : [];
    const pac: Item[] = patients
      .filter(
        (p) =>
          !q ||
          p.nombre.toLowerCase().includes(q) ||
          p.documento.toLowerCase().includes(q),
      )
      .slice(0, 5)
      .map((p) => ({
        id: `pac-${p.id}`,
        label: p.nombre,
        hint: p.edad > 0 ? `${p.edad} años · ${p.documento}` : "Paciente",
        href: `/app/pacientes/${p.id}`,
        icon: User,
      }));
    const cons: Item[] = consultations
      .filter((c) => {
        if (!q) return true;
        const nombre = getPatient(c.pacienteId)?.nombre.toLowerCase() ?? "";
        return nombre.includes(q) || c.motivo.toLowerCase().includes(q);
      })
      .slice(0, 5)
      .map((c) => ({
        id: `con-${c.id}`,
        label: getPatient(c.pacienteId)?.nombre ?? "Paciente sin identificar",
        hint: c.motivo,
        href: `/app/consultas/${c.id}`,
        icon: FileText,
      }));
    return q
      ? [...acciones.filter((a) => a.label.toLowerCase().includes(q)), ...pac, ...cons]
      : [...acciones, ...pac, ...cons];
  }, [query, patients, consultations, getPatient, role]);

  if (!open) return null;

  function go(href: string) {
    guardedNavigate(() => {
      closePalette();
      router.push(href);
    });
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-0 sm:p-4 sm:pt-[12vh]">
      <div
        className="absolute inset-0 bg-overlay backdrop-blur-sm"
        onClick={closePalette}
      />
      <div className="relative flex h-dvh w-full max-w-xl flex-col overflow-hidden bg-surface shadow-[var(--shadow-xl)] sm:h-auto sm:rounded-2xl sm:border sm:border-line">
        <div className="app-mobile-header flex items-center gap-2 border-b border-line px-4 sm:h-auto">
          <Search size={18} className="text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && items[0]) go(items[0].href);
            }}
            placeholder="Buscar paciente, consulta o acción…"
            className="w-full bg-transparent py-3.5 text-base outline-none placeholder:text-muted sm:text-sm"
          />
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-xs font-medium text-muted sm:block">
            ESC
          </kbd>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:max-h-80">
          {items.length ? (
            items.map((it) => {
              const Icon = it.icon;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => go(it.href)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-ice-soft"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ice text-accent">
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-deep">
                      {it.label}
                    </span>
                    {it.hint ? (
                      <span className="block truncate text-xs text-muted">
                        {it.hint}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted">
              Sin resultados para «{query}».
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
