"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PenLine, Play } from "lucide-react";
import { useStore } from "@/app/app/providers";
import { usePeek } from "@/components/app/PeekProvider";
import { useRunway } from "@/components/app/SignRunway";
import { BrandMark } from "@/components/brand/BrandMark";
import { rowToAppointment, todayLocalISO, type Appointment } from "@/lib/agenda";
import { diasDeEspera, etiquetaEspera } from "@/lib/dates";
import { isDemoConsultation } from "@/lib/demo";
import { createClient } from "@/lib/supabase/client";

/**
 * EL PULSO — las "notificaciones" de Miracle, repensadas.
 *
 * Una campana con badge es el patrón de una red social: te grita cantidades.
 * Lo que un médico necesita es el ESTADO DE SU TRABAJO, y aquí eso es una sola
 * cosa: cuántas notas esperan firma y desde cuándo. Así que la campana muere y
 * en su lugar late el orbe de la marca: verde en calma cuando estás al día,
 * ámbar cuando hay cola, rojo cuando algo lleva más de una semana esperando
 * (el mismo umbral que enciende la fila en la Jornada).
 *
 * Y el panel no lista avisos: ACTÚA. Firmar en serie a un clic, cada nota
 * abre su panel de lectura, y si dejaste una consulta a medias, reanudarla.
 */
export function PulseOrb() {
  const { consultations, getPatient } = useStore();
  const { openPeek } = usePeek();
  const { openRunway } = useRunway();
  const supabase = useMemo(() => createClient(), []);

  const [open, setOpen] = useState(false);
  const [enCurso, setEnCurso] = useState<Appointment | null>(null);

  const pendientes = useMemo(
    () =>
      consultations
        .filter(
          (c) =>
            (c.estado === "borrador" || c.estado === "revisada") &&
            !isDemoConsultation(c),
        )
        .sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
    [consultations],
  );

  const urgente = pendientes.some((c) => diasDeEspera(c.fecha) >= 8);
  const estado = pendientes.length === 0 ? "calma" : urgente ? "alerta" : "cola";

  // La consulta dejada a medias se pregunta AL ABRIR, no en vivo: cero costo
  // con el panel cerrado, datos frescos en cada apertura, y si la tabla de
  // agenda no existe el bloque simplemente no aparece.
  useEffect(() => {
    if (!open) return;
    let vigente = true;
    void supabase
      .from("appointments")
      .select("*")
      .eq("fecha", todayLocalISO())
      .eq("estado", "en_curso")
      .limit(1)
      .then(({ data, error }) => {
        if (!vigente || error) return;
        const fila = data?.[0];
        setEnCurso(fila ? rowToAppointment(fila) : null);
      });
    return () => {
      vigente = false;
    };
  }, [open, supabase]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const top = pendientes.slice(0, 5);
  const topIds = top.map((c) => c.id);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          pendientes.length === 0
            ? "Tu trabajo: al día"
            : `Tu trabajo: ${pendientes.length} pendientes`
        }
        className={`pulse-orb pulse-${estado} relative inline-flex h-10 w-10 items-center justify-center rounded-full`}
      >
        <BrandMark size={24} plain />
        {pendientes.length > 0 ? (
          <span
            aria-hidden
            className={`data absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
              urgente ? "bg-danger" : "bg-warning"
            }`}
          >
            {pendientes.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="dialog"
            aria-label="Tu trabajo"
            className="glass-panel fixed left-3 right-3 top-[calc(3.75rem+env(safe-area-inset-top,0px))] z-50 overflow-hidden rounded-[20px] sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[22rem]"
          >
            <div className="flex items-baseline justify-between gap-3 border-b border-line/60 px-4 py-3">
              <h2 className="text-sm font-semibold text-deep">Tu trabajo</h2>
              {pendientes.length ? (
                <span className="data text-[11px] text-muted">
                  la más antigua {etiquetaEspera(pendientes[0].fecha)}
                </span>
              ) : null}
            </div>

            {enCurso?.clinicalEncounterId ? (
              <Link
                href={`/app/consultas/en-vivo?encounter=${encodeURIComponent(enCurso.clinicalEncounterId)}&appointment=${encodeURIComponent(enCurso.id)}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 border-b border-warning/25 bg-warning-soft/50 px-4 py-2.5 text-sm font-semibold text-warning-ink hover:bg-warning-soft"
              >
                <Play size={15} /> Consulta en curso con {enCurso.pacienteNombre} —
                reanudar
              </Link>
            ) : null}

            {pendientes.length ? (
              <>
                <div className="px-3 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      openRunway(pendientes.map((c) => c.id));
                    }}
                    className="clinical-primary min-h-10 w-full px-4 text-[13px]"
                    data-light
                  >
                    <PenLine size={14} /> Firmar en serie ({pendientes.length})
                  </button>
                </div>
                <ul className="p-2">
                  {top.map((c) => {
                    const nombre =
                      getPatient(c.pacienteId)?.nombre ??
                      c.pacienteNombre ??
                      "Paciente sin identificar";
                    const dias = diasDeEspera(c.fecha);
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            // El panel se cierra ANTES de abrir el peek: los
                            // dos pelean por el foco si conviven.
                            setOpen(false);
                            openPeek({ kind: "consultation", id: c.id }, topIds);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left hover:bg-ice-soft"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-deep">
                              {nombre}
                            </span>
                            <span className="block truncate text-[12px] text-muted">
                              {c.motivo || "Sin motivo registrado"}
                            </span>
                          </span>
                          <span
                            className={`data shrink-0 text-[11px] font-semibold ${
                              dias >= 8
                                ? "text-danger"
                                : dias >= 3
                                  ? "text-warning"
                                  : "text-muted"
                            }`}
                          >
                            {dias === 0 ? "hoy" : `${dias} d`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="px-4 py-5 text-center text-sm text-muted">
                Al día. Ninguna nota espera tu firma.
              </p>
            )}

            <Link
              href="/app/notas"
              onClick={() => setOpen(false)}
              className="block border-t border-line/60 px-4 py-2.5 text-center text-[13px] font-semibold text-accent hover:bg-ice-soft"
            >
              Ver todas las notas
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
