"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Loader2,
  Printer,
  X,
} from "lucide-react";
import { useStore } from "@/app/app/providers";
import { usePeek } from "@/components/app/PeekProvider";
import { NoteSectionView } from "@/components/app/NoteSectionView";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { HoverHint } from "@/components/ui/HoverHint";
import { resolveConsultationIdentity } from "@/lib/clinical/patient-identity";
import { formatFechaRelativa } from "@/lib/dates";
import { isDemoConsultation } from "@/lib/demo";
import { abrirImpresionNota } from "@/lib/pdf/note-print";
import { TYPE_LABEL, type Consultation } from "@/lib/mock";

/**
 * El panel rápido de una consulta: la nota COMPLETA y sus acciones, sin
 * abandonar la lista.
 *
 * Es el mayor ahorro de clics del experimento: el ciclo real del médico es
 * "revisar y firmar diez notas", y hoy cada una cuesta lista → detalle →
 * leer → firmar → volver. Aquí es clic → leer → firmar → J. Firmar usa el
 * MISMO camino que el detalle (`approveNote` → server action con validación
 * de estado, guarda anti-demo, CAS y hash): el panel no abre ningún atajo
 * legal, solo recorta la navegación.
 *
 * J / K se mueve por la lista visible; Escape y el botón atrás cierran;
 * ⌘-clic en la fila siguió navegando al detalle (eso lo decide usePeekClick).
 */
export function ConsultationPeek() {
  const { target, closePeek, movePeek, listIds } = usePeek();
  const router = useRouter();
  const {
    getConsultation,
    fetchConsultation,
    getPatient,
    getMedicoName,
    getMedicoIdentity,
    org,
    role,
    approveNote,
    markReviewed,
    showToast,
  } = useStore();

  const abierto = target?.kind === "consultation" ? target.id : null;

  // Consultas fuera del store (páginas profundas): caché propia del panel.
  const [fetched, setFetched] = useState<Record<string, Consultation>>({});
  const [cargando, setCargando] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const focoPrevio = useRef<HTMLElement | null>(null);
  // El listener de teclado vive mientras el panel esté abierto; estas refs le
  // dan siempre la acción de LA NOTA VISIBLE (que cambia con J/K).
  const firmarRef = useRef<(() => void) | null>(null);
  const revisarRef = useRef<(() => void) | null>(null);

  const c: Consultation | undefined = abierto
    ? (getConsultation(abierto) ?? fetched[abierto])
    : undefined;

  // Traer la consulta que el store no tiene.
  useEffect(() => {
    if (!abierto || getConsultation(abierto) || fetched[abierto]) return;
    let vigente = true;
    setCargando(true);
    void fetchConsultation(abierto)
      .then((res) => {
        if (!vigente) return;
        if (res) setFetched((prev) => ({ ...prev, [abierto]: res }));
        else {
          showToast("No se pudo abrir la consulta.", "warning");
          closePeek();
        }
      })
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  // Foco: entra al panel al abrir, vuelve al disparador al cerrar. Escape
  // cierra. J/K navega (con el mismo guard de la espina: dentro de un campo,
  // j es una letra).
  useEffect(() => {
    if (!abierto) return;
    focoPrevio.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePeek();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const t = event.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) {
        return;
      }
      if (event.key === "j" || event.key === "J") {
        event.preventDefault();
        movePeek(1);
      } else if (event.key === "k" || event.key === "K") {
        event.preventDefault();
        movePeek(-1);
      } else if (event.key === "f" || event.key === "F") {
        // Firmar sin soltar el teclado: el mismo botón, en tecla.
        event.preventDefault();
        firmarRef.current?.();
      } else if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        revisarRef.current?.();
      } else if (event.key === "Tab") {
        // Trampa de foco: el diálogo es la única superficie viva.
        const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables?.length) return;
        const primera = focusables[0];
        const ultima = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === primera) {
          event.preventDefault();
          ultima.focus();
        } else if (!event.shiftKey && document.activeElement === ultima) {
          event.preventDefault();
          primera.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      focoPrevio.current?.focus?.();
    };
  }, [abierto, closePeek, movePeek]);

  if (!abierto) return null;

  const patient = c ? getPatient(c.pacienteId) : undefined;
  const identidad = c ? resolveConsultationIdentity(patient, c) : { nombre: null, documento: null };
  const demo = c ? isDemoConsultation(c) : false;
  const canEdit = role !== "secretaria" && !demo;
  const firmable = Boolean(c && canEdit && (c.estado === "borrador" || c.estado === "revisada"));
  const posicion = listIds.indexOf(abierto);
  const esFetched = Boolean(c && !getConsultation(abierto));

  firmarRef.current = firmable ? firmar : null;
  revisarRef.current =
    c && canEdit && c.estado === "borrador" ? revisar : null;

  function firmar() {
    if (!c) return;
    approveNote(c.id);
    // Las filas RSC (consultas/notas) no leen del store: sin esto el badge
    // de la lista quedaría en borrador hasta la próxima visita.
    router.refresh();
    // Si la consulta vive solo en la caché del panel, el store no la va a
    // refrescar por nosotros: se vuelve a pedir cuando la firma ya asentó.
    if (esFetched) {
      window.setTimeout(() => {
        void fetchConsultation(c.id).then((res) => {
          if (res) setFetched((prev) => ({ ...prev, [c.id]: res }));
        });
      }, 1200);
    }
  }

  function revisar() {
    if (!c) return;
    markReviewed(c.id);
    router.refresh();
    if (esFetched) {
      setFetched((prev) => ({ ...prev, [c.id]: { ...c, estado: "revisada" } }));
    }
  }

  function imprimir() {
    if (!c) return;
    abrirImpresionNota(
      {
        consultation: c,
        patient,
        identidad,
        medicoNombre: getMedicoName(c.medicoId),
        medicoIdentidad: getMedicoIdentity(c.medicoId),
        org,
        demo,
        // Las adendas viven en el detalle (se cargan aparte); el panel imprime
        // el documento base. Para el expediente completo está "Abrir completo".
      },
      () => showToast("Permita las ventanas emergentes para generar el PDF.", "warning"),
    );
  }

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Scrim: cierra al clic, sin robar el foco del panel. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar panel"
        onClick={closePeek}
        className="absolute inset-0 cursor-default bg-overlay/70 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Consulta de ${identidad.nombre ?? "paciente sin identificar"}`}
        tabIndex={-1}
        className="peek-enter glass-panel absolute inset-y-0 right-0 flex w-[min(500px,100vw)] flex-col outline-none sm:inset-y-2 sm:right-2 sm:rounded-[24px]"
      >
        {/* Cabecera */}
        <div className="flex items-start gap-3 border-b border-line/60 px-4 py-3.5 sm:px-5">
          <Avatar name={identidad.nombre} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-semibold text-deep">
                {identidad.nombre ?? "Paciente sin identificar"}
              </span>
              {c ? <StatusBadge estado={c.estado} /> : null}
            </div>
            <p className="data mt-0.5 truncate text-[12px] text-muted">
              {identidad.documento ? `${identidad.documento} · ` : ""}
              {c ? (
                <span className="font-sans">
                  {c.especialidad} · {TYPE_LABEL[c.tipo]} · {formatFechaRelativa(c.fecha)}
                </span>
              ) : null}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {listIds.length > 1 ? (
              <>
                <HoverHint label="Anterior (K)">
                  <button
                    type="button"
                    onClick={() => movePeek(-1)}
                    disabled={posicion <= 0}
                    aria-label="Consulta anterior"
                    className="icon-btn h-9 w-9 disabled:opacity-35"
                  >
                    <ChevronUp size={17} />
                  </button>
                </HoverHint>
                <HoverHint label="Siguiente (J)">
                  <button
                    type="button"
                    onClick={() => movePeek(1)}
                    disabled={posicion === -1 || posicion >= listIds.length - 1}
                    aria-label="Consulta siguiente"
                    className="icon-btn h-9 w-9 disabled:opacity-35"
                  >
                    <ChevronDown size={17} />
                  </button>
                </HoverHint>
              </>
            ) : null}
            <button
              type="button"
              onClick={closePeek}
              aria-label="Cerrar panel"
              className="icon-btn h-9 w-9"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Cuerpo: la nota como documento, con scroll propio. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {c ? (
            <>
              {c.motivo ? (
                <p className="mb-3 text-sm leading-relaxed text-ink-soft">{c.motivo}</p>
              ) : null}
              <div className="doc px-4 py-2">
                {c.note.length ? (
                  c.note.map((s) => (
                    <NoteSectionView key={s.id} section={s} editable={false} />
                  ))
                ) : (
                  <p className="py-4 text-sm text-muted">
                    Esta consulta aún no tiene nota generada.
                  </p>
                )}
              </div>
              {demo ? (
                <p className="mt-3 text-[12px] leading-relaxed text-warning">
                  Consulta de demostración: no puede firmarse ni exportarse.
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex h-40 items-center justify-center text-muted">
              {cargando ? <Loader2 size={20} className="animate-spin" /> : null}
            </div>
          )}
        </div>

        {/* Acciones: espejo exacto de las del detalle, ninguna nueva. */}
        <div className="glass-bar flex flex-wrap items-center gap-2 border-t border-line/60 px-4 py-3 sm:rounded-b-[24px] sm:px-5">
          {firmable ? (
            <button type="button" onClick={firmar} className="clinical-primary min-h-11 px-4">
              <CheckCircle2 size={16} /> Aprobar y firmar
            </button>
          ) : null}
          {c && canEdit && c.estado === "borrador" ? (
            <button type="button" onClick={revisar} className="clinical-secondary min-h-11 px-3.5">
              <FileCheck2 size={15} /> Revisada
            </button>
          ) : null}
          <span className="min-w-2 flex-1" />
          <HoverHint label="Imprimir o guardar PDF">
            <button
              type="button"
              onClick={imprimir}
              disabled={!c}
              aria-label="Descargar PDF"
              className="icon-btn"
            >
              <Printer size={17} />
            </button>
          </HoverHint>
          <Link
            href={`/app/consultas/${abierto}`}
            onClick={() => closePeek()}
            className="clinical-tertiary min-h-11 px-3.5"
          >
            Abrir completo <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
