"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useStore } from "@/app/app/providers";
import { STATUS_LABEL } from "@/lib/mock";

export function NotificationsBell() {
  const { consultations, getPatient } = useStore();
  const [open, setOpen] = useState(false);

  const pendientes = consultations.filter(
    (c) => c.estado === "borrador" || c.estado === "revisada",
  );

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notificaciones${pendientes.length ? `: ${pendientes.length} pendientes` : ""}`}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-ice-soft hover:text-deep"
      >
        <Bell size={18} />
        {pendientes.length ? (
          <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
            {pendientes.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-lg)]">
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
                      <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">
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
