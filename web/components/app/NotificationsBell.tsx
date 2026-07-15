"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useStore } from "@/app/app/providers";
import { STATUS_LABEL } from "@/lib/mock";
import { isDemoConsultation } from "@/lib/demo";
import { HoverHint } from "@/components/ui/HoverHint";

export function NotificationsBell() {
  const { consultations, getPatient } = useStore();
  const [open, setOpen] = useState(false);

  // Cierre estándar con Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pendientes = consultations.filter(
    (c) =>
      (c.estado === "borrador" || c.estado === "revisada") &&
      !isDemoConsultation(c),
  );

  return (
    <div className="relative">
      <HoverHint label={pendientes.length ? `Ver ${pendientes.length} notas pendientes` : "Ver notificaciones"}>
        <button
          type="button"
          aria-label={`Notificaciones${pendientes.length ? `: ${pendientes.length} pendientes` : ""}`}
          onClick={() => setOpen((v) => !v)}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-ice-soft hover:text-deep"
        >
          <Bell size={18} />
          {pendientes.length ? (
            <span className="absolute right-0.5 top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-white">
              {pendientes.length}
            </span>
          ) : null}
        </button>
      </HoverHint>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="fixed left-3 right-3 top-[calc(3.75rem+env(safe-area-inset-top,0px))] z-50 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-lg)] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 sm:rounded-xl">
            <div className="border-b border-line px-4 py-3 text-sm font-semibold text-deep">
              Pendientes de revisión
            </div>
            {pendientes.length ? (
              <ul className="max-h-80 overflow-y-auto">
                {pendientes.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/app/consultas/${c.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-ice-soft"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-deep">
                          {getPatient(c.pacienteId)?.nombre ??
                            "Paciente sin identificar"}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {c.motivo}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                        {STATUS_LABEL[c.estado]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted">
                Todo al día. Sin notas pendientes.
              </p>
            )}
            <Link
              href="/app/notas"
              onClick={() => setOpen(false)}
              className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-accent hover:bg-ice-soft"
            >
              Ver todas las notas
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
