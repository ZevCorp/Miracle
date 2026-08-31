"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  FileCheck2,
  Loader2,
  PenLine,
  SkipForward,
  X,
} from "lucide-react";
import { useStore } from "@/app/app/providers";
import { NoteSectionView } from "@/components/app/NoteSectionView";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { BrandSphere } from "@/components/brand/BrandSphere";
import { resolveConsultationIdentity } from "@/lib/clinical/patient-identity";
import { etiquetaEspera } from "@/lib/dates";
import { isDemoConsultation } from "@/lib/demo";
import type { Consultation } from "@/lib/mock";

/**
 * LA SESIÓN DE FIRMA — el "inbox zero" clínico.
 *
 * El trabajo real del médico al final del día no es "abrir una consulta":
 * es vaciar la cola. Hoy cada nota cuesta lista → detalle → leer → firmar →
 * volver; con diez pendientes son cuarenta viajes. Esta pantalla convierte la
 * cola en una PISTA: las notas pasan una tras otra, el teclado es el control
 * (F firma, R marca revisada, S salta, K vuelve, Esc sale) y al llegar a cero
 * hay una recompensa serena — el orbe, no confeti: esto es una clínica.
 *
 * El patrón viene de los mejores flujos de correo (Superhuman: el teclado
 * como controlador y una meta concreta con recompensa al llegar a cero),
 * aplicado al único lote que existe en esta app.
 *
 * Firmar usa EXACTAMENTE la misma vía que el detalle (approveNoteAsync →
 * server action con validación de estado, guarda anti-demo, CAS y hash).
 * La pista recorta la navegación, jamás la validación: la nota completa está
 * EN PANTALLA al momento de firmar — se firma lo que se está leyendo.
 *
 * Las notas de demostración entran a la pista (para poder ensayar el flujo
 * con la cuenta demo) pero su firma está deshabilitada con el porqué visible;
 * solo se pueden saltar.
 */

type Desenlace = "firmada" | "revisada" | "saltada" | "error";

interface RunwayValue {
  /** Abre la pista con esa cola de ids (en su orden). */
  openRunway: (ids: readonly string[]) => void;
}

const RunwayContext = createContext<RunwayValue | null>(null);

export function useRunway(): RunwayValue {
  const ctx = useContext(RunwayContext);
  if (!ctx) throw new Error("useRunway necesita RunwayProvider");
  return ctx;
}

export function RunwayProvider({ children }: { children: ReactNode }) {
  const [cola, setCola] = useState<readonly string[] | null>(null);
  const openRunway = useCallback((ids: readonly string[]) => {
    if (ids.length) setCola(ids);
  }, []);
  const value = useMemo(() => ({ openRunway }), [openRunway]);
  return (
    <RunwayContext.Provider value={value}>
      {children}
      {cola ? <SignRunway ids={cola} onClose={() => setCola(null)} /> : null}
    </RunwayContext.Provider>
  );
}

function SignRunway({
  ids,
  onClose,
}: {
  ids: readonly string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { getConsultation, getPatient, role, approveNoteAsync, markReviewed } =
    useStore();

  const [indice, setIndice] = useState(0);
  const [desenlaces, setDesenlaces] = useState<Record<string, Desenlace>>({});
  const [firmando, setFirmando] = useState(false);
  const [errorNota, setErrorNota] = useState<string | null>(null);
  const [terminada, setTerminada] = useState(false);
  // Duración de la sesión, congelada al terminar (Date.now no puede vivir en
  // el render: lo prohíbe la regla de pureza y con razón).
  const [minutos, setMinutos] = useState(1);
  const inicioRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inicioRef.current = Date.now();
  }, []);

  const id = ids[indice];
  const c: Consultation | undefined = id ? getConsultation(id) : undefined;
  const identidad = c
    ? resolveConsultationIdentity(getPatient(c.pacienteId), c)
    : { nombre: null, documento: null };
  const demo = c ? isDemoConsultation(c) : false;
  const puedeFirmar = Boolean(
    c &&
      role !== "secretaria" &&
      !demo &&
      (c.estado === "borrador" || c.estado === "revisada"),
  );

  const resuelto = useCallback(
    (que: Desenlace) => {
      if (!id) return;
      setDesenlaces((prev) => ({ ...prev, [id]: que }));
      setErrorNota(null);
      if (indice + 1 >= ids.length) {
        setMinutos(
          Math.max(
            1,
            Math.round((Date.now() - (inicioRef.current ?? Date.now())) / 60000),
          ),
        );
        setTerminada(true);
      } else setIndice((i) => i + 1);
    },
    [id, indice, ids.length],
  );

  const firmar = useCallback(async () => {
    if (!id || !puedeFirmar || firmando) return;
    setFirmando(true);
    setErrorNota(null);
    const result = await approveNoteAsync(id);
    setFirmando(false);
    if (result.ok) {
      resuelto("firmada");
    } else {
      // El error se queda EN la nota, no en un toast que tapa la siguiente:
      // el médico decide si reintenta o la salta.
      setErrorNota(result.error ?? "No se pudo firmar la nota.");
      setDesenlaces((prev) => ({ ...prev, [id]: "error" }));
    }
  }, [id, puedeFirmar, firmando, approveNoteAsync, resuelto]);

  const revisada = useCallback(() => {
    if (!id || !c || demo || role === "secretaria" || c.estado !== "borrador") return;
    markReviewed(id);
    resuelto("revisada");
  }, [id, c, demo, role, markReviewed, resuelto]);

  const saltar = useCallback(() => resuelto("saltada"), [resuelto]);

  const atras = useCallback(() => {
    setErrorNota(null);
    setIndice((i) => Math.max(0, i - 1));
  }, []);

  const cerrar = useCallback(() => {
    // Las listas del servidor (consultas/notas) no leen del store: sin esto
    // los badges quedarían viejos al volver de una tanda de firmas.
    router.refresh();
    onClose();
  }, [router, onClose]);

  // Teclado: F firma, R revisada, S/J salta, K atrás, Esc sale.
  useEffect(() => {
    panelRef.current?.focus();
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const t = event.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) {
        return;
      }
      const k = event.key.toLowerCase();
      if (event.key === "Escape") {
        event.preventDefault();
        cerrar();
      } else if (terminada) {
        if (k === "enter") cerrar();
      } else if (k === "f") {
        event.preventDefault();
        void firmar();
      } else if (k === "r") {
        event.preventDefault();
        revisada();
      } else if (k === "s" || k === "j") {
        event.preventDefault();
        saltar();
      } else if (k === "k") {
        event.preventDefault();
        atras();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [firmar, revisada, saltar, atras, cerrar, terminada]);

  const cuentas = useMemo(() => {
    const valores = Object.values(desenlaces);
    return {
      firmadas: valores.filter((v) => v === "firmada").length,
      revisadas: valores.filter((v) => v === "revisada").length,
      saltadas: valores.filter((v) => v === "saltada" || v === "error").length,
    };
  }, [desenlaces]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Sesión de firma"
      tabIndex={-1}
      className="runway-enter fixed inset-0 z-[75] flex flex-col outline-none"
    >
      {/* El velo: la app queda detrás, difuminada. La pista es el foco. */}
      <div aria-hidden className="glass-bar absolute inset-0" />

      {/* Cabecera de la pista */}
      <div className="relative z-10 flex items-center gap-3 px-4 py-3 sm:px-8">
        <span className="doc-label">Sesión de firma</span>
        {!terminada ? (
          <RunwayDots total={ids.length} indice={indice} desenlaces={desenlaces} ids={ids} />
        ) : null}
        <span className="min-w-2 flex-1" />
        {!terminada ? (
          <span className="data text-[12px] font-semibold text-muted">
            {indice + 1} de {ids.length}
          </span>
        ) : null}
        <button type="button" onClick={cerrar} aria-label="Salir de la sesión" className="icon-btn">
          <X size={18} />
        </button>
      </div>

      {/* La nota en pista */}
      {terminada ? (
        <ResumenFinal cuentas={cuentas} minutos={minutos} onClose={cerrar} />
      ) : c ? (
        <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-3 pb-3 sm:px-6">
          <div className="clinical-panel flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Quién y desde cuándo espera */}
            <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
              <Avatar name={identidad.nombre} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-deep">
                  {identidad.nombre ?? "Paciente sin identificar"}
                </p>
                <p className="data truncate text-[12px] text-muted">
                  {identidad.documento ? `${identidad.documento} · ` : ""}
                  <span className="font-sans">
                    {c.especialidad} · esperando {etiquetaEspera(c.fecha)}
                  </span>
                </p>
              </div>
              <StatusBadge estado={c.estado} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
              {c.motivo ? (
                <p className="mb-3 text-sm leading-relaxed text-ink-soft">{c.motivo}</p>
              ) : null}
              <div className="doc px-4 py-2">
                {c.note.length ? (
                  c.note.map((s) => (
                    <NoteSectionView key={s.id} section={s} editable={false} />
                  ))
                ) : (
                  <p className="py-4 text-sm text-muted">Sin nota generada.</p>
                )}
              </div>
            </div>

            {errorNota ? (
              <p role="alert" className="border-t border-danger/25 bg-danger-soft px-4 py-2.5 text-sm font-medium text-danger-ink sm:px-6">
                {errorNota} — puedes reintentar con F o saltarla con S.
              </p>
            ) : null}
            {demo ? (
              <p className="border-t border-warning/30 bg-warning-soft px-4 py-2.5 text-sm font-medium text-warning-ink sm:px-6">
                Nota de demostración: se puede recorrer pero no firmar. Sáltala con S.
              </p>
            ) : null}
          </div>

          {/* Los controles: teclas primero, botones como respaldo. */}
          <div className="glass-panel mx-auto mt-3 flex flex-wrap items-center justify-center gap-2 rounded-full p-1.5">
            <button
              type="button"
              onClick={() => void firmar()}
              disabled={!puedeFirmar || firmando}
              className="clinical-primary min-h-11 px-5 disabled:opacity-50"
              data-light
            >
              {firmando ? <Loader2 size={16} className="animate-spin" /> : <PenLine size={16} />}
              Firmar <Tecla>F</Tecla>
            </button>
            {c.estado === "borrador" && !demo && role !== "secretaria" ? (
              <button type="button" onClick={revisada} className="clinical-secondary min-h-11 px-4">
                <FileCheck2 size={15} /> Revisada <Tecla>R</Tecla>
              </button>
            ) : null}
            <button type="button" onClick={saltar} className="clinical-secondary min-h-11 px-4">
              <SkipForward size={15} /> Saltar <Tecla>S</Tecla>
            </button>
            {indice > 0 ? (
              <button type="button" onClick={atras} aria-label="Nota anterior" className="icon-btn h-11 w-11">
                <ChevronLeft size={18} />
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex flex-1 items-center justify-center text-muted">
          <Loader2 size={22} className="animate-spin" />
        </div>
      )}
    </div>
  );
}

/** Los puntos de la pista: hueco = por pasar, lleno = resuelta, halo = actual. */
function RunwayDots({
  total,
  indice,
  desenlaces,
  ids,
}: {
  total: number;
  indice: number;
  desenlaces: Record<string, Desenlace>;
  ids: readonly string[];
}) {
  if (total > 24) return null; // con tandas enormes los puntos son ruido
  return (
    <span aria-hidden className="hidden items-center gap-1.5 sm:flex">
      {ids.map((id, i) => {
        const d = desenlaces[id];
        const color =
          d === "firmada"
            ? "bg-success"
            : d === "revisada"
              ? "bg-accent"
              : d === "saltada" || d === "error"
                ? "bg-mist"
                : "bg-transparent border border-mist";
        return (
          <span
            key={id}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${color} ${
              i === indice ? "ring-2 ring-accent/40" : ""
            }`}
          />
        );
      })}
    </span>
  );
}

function Tecla({ children }: { children: ReactNode }) {
  return (
    <kbd className="ml-1 hidden rounded border border-white/25 bg-white/10 px-1.5 text-[11px] font-semibold sm:inline">
      {children}
    </kbd>
  );
}

/** La recompensa al llegar a cero: serena, de marca. Esto es una clínica. */
function ResumenFinal({
  cuentas,
  minutos,
  onClose,
}: {
  cuentas: { firmadas: number; revisadas: number; saltadas: number };
  minutos: number;
  onClose: () => void;
}) {
  const alDia = cuentas.saltadas === 0;
  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
      <BrandSphere size={170} />
      <h2 className="mt-4 font-display text-[1.8rem] font-[650] tracking-[-0.03em] text-deep">
        {alDia ? "Quedaste al día" : "Sesión terminada"}
      </h2>
      <p className="mt-2 max-w-md text-[0.95rem] leading-relaxed text-muted">
        {cuentas.firmadas > 0 ? (
          <>
            <strong className="text-deep">{cuentas.firmadas}</strong>{" "}
            {cuentas.firmadas === 1 ? "nota firmada" : "notas firmadas"}
          </>
        ) : (
          "Ninguna nota firmada"
        )}
        {cuentas.revisadas > 0 ? <> · {cuentas.revisadas} revisadas</> : null}
        {cuentas.saltadas > 0 ? <> · {cuentas.saltadas} saltadas</> : null}
        {" · "}
        {minutos} {minutos === 1 ? "minuto" : "minutos"}
      </p>
      {!alDia ? (
        <p className="mt-1 text-sm text-muted">
          Las saltadas siguen en tu cola para la próxima sesión.
        </p>
      ) : null}
      <button type="button" onClick={onClose} className="clinical-primary mt-6 min-h-11 px-6" data-light>
        <CheckCircle2 size={16} /> Volver al panel <ArrowRight size={15} />
      </button>
    </div>
  );
}
