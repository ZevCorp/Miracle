"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  CalendarDays,
  Camera,
  Check,
  Loader2,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useStore } from "@/app/app/providers";
import { createClient } from "@/lib/supabase/client";
import {
  normalizeHora,
  rowToAppointment,
  todayLocalISO,
  type Appointment,
  type ParsedCita,
} from "@/lib/agenda";

const inputClass =
  "rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-accent";

function sortCitas(list: Appointment[]): Appointment[] {
  return [...list].sort((a, b) => a.hora.localeCompare(b.hora));
}

/**
 * Agenda del día del médico: citas creadas a mano o importadas desde una foto
 * del horario del sistema que use (extracción con IA + revisión manual).
 */
export function AgendaHoy({
  onCountChange,
}: {
  onCountChange?: (n: number) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useStore();
  const hoy = useMemo(() => todayLocalISO(), []);

  const [citas, setCitas] = useState<Appointment[]>([]);
  const [cargando, setCargando] = useState(true);
  // false si la tabla appointments aún no existe (migración sin aplicar).
  const [dbLista, setDbLista] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("fecha", hoy)
        .order("hora", { ascending: true });
      if (ignore) return;
      if (error) {
        console.error("[agenda] load", error.message);
        setDbLista(false);
      } else {
        setCitas((data ?? []).map(rowToAppointment));
      }
      setCargando(false);
    })();
    return () => {
      ignore = true;
    };
  }, [supabase, hoy]);

  useEffect(() => {
    onCountChange?.(citas.filter((c) => c.estado !== "cancelada").length);
  }, [citas, onCountChange]);

  // ---- Alta manual -----------------------------------------------------------
  const [showAdd, setShowAdd] = useState(false);
  const [hora, setHora] = useState("");
  const [nombre, setNombre] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const agregar = useCallback(async () => {
    const h = normalizeHora(hora);
    const n = nombre.trim();
    if (!h || !n) {
      showToast("Indica hora y nombre del paciente.", "warning");
      return;
    }
    setGuardando(true);
    const { data, error } = await supabase
      .from("appointments")
      .insert({ fecha: hoy, hora: h, paciente_nombre: n, motivo: motivo.trim() || null })
      .select()
      .single();
    setGuardando(false);
    if (error || !data) {
      console.error("[agenda] insert", error?.message);
      showToast("No se pudo guardar la cita.", "warning");
      return;
    }
    setCitas((list) => sortCitas([...list, rowToAppointment(data)]));
    setHora("");
    setNombre("");
    setMotivo("");
    setShowAdd(false);
    showToast("Cita agendada.", "success");
  }, [supabase, hoy, hora, nombre, motivo, showToast]);

  const marcarAtendida = useCallback(
    async (id: string) => {
      setCitas((list) =>
        list.map((c) => (c.id === id ? { ...c, estado: "atendida" as const } : c)),
      );
      const { error } = await supabase
        .from("appointments")
        .update({ estado: "atendida" })
        .eq("id", id);
      if (error) {
        console.error("[agenda] update", error.message);
        showToast("No se pudo actualizar la cita.", "warning");
      }
    },
    [supabase, showToast],
  );

  const eliminar = useCallback(
    async (id: string) => {
      setCitas((list) => list.filter((c) => c.id !== id));
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) {
        console.error("[agenda] delete", error.message);
        showToast("No se pudo eliminar la cita.", "warning");
      }
    },
    [supabase, showToast],
  );

  // ---- Confirmación de borrado ----------------------------------------------
  // Primer toque: pide confirmar; se auto-cancela a los 4 s. Evita borrados
  // accidentales en móvil (los botones de acción están contiguos).
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmId) return;
    const t = setTimeout(() => setConfirmId(null), 4000);
    return () => clearTimeout(t);
  }, [confirmId]);

  // ---- Importación por foto ----------------------------------------------------
  const [importOpen, setImportOpen] = useState(false);

  const onImported = useCallback((nuevas: Appointment[]) => {
    setCitas((list) => sortCitas([...list, ...nuevas]));
  }, []);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-deep">Consultas de hoy</h2>
        <CalendarDays size={18} className="text-muted" />
      </div>

      {dbLista ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAdd((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft/40 px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-soft"
          >
            <Plus size={14} /> Agregar cita
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-deep hover:border-mist"
          >
            <Camera size={14} /> Desde foto
          </button>
        </div>
      ) : null}

      {showAdd ? (
        <div className="mb-3 rounded-lg border border-dashed border-accent/40 bg-ice-soft p-3">
          <div className="flex flex-wrap gap-2">
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              aria-label="Hora de la cita"
              className={`${inputClass} w-[110px]`}
            />
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del paciente"
              aria-label="Nombre del paciente"
              className={`${inputClass} min-w-[150px] flex-1`}
            />
          </div>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (opcional)"
            aria-label="Motivo de la cita"
            className={`${inputClass} mt-2 w-full`}
          />
          <div className="mt-2.5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-deep hover:border-mist"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={agregar}
              disabled={guardando}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Agendar
            </button>
          </div>
        </div>
      ) : null}

      {cargando ? (
        <div className="flex justify-center py-4">
          <Loader2 size={18} className="animate-spin text-muted" />
        </div>
      ) : !dbLista ? (
        <p className="py-2 text-sm text-muted">
          La agenda aún no está disponible: falta aplicar la migración{" "}
          <code className="rounded bg-ice px-1 py-0.5 text-xs">appointments</code> en
          Supabase.
        </p>
      ) : citas.length ? (
        <ul className="divide-y divide-line">
          {citas.map((c) => {
            const cancelada = c.estado === "cancelada";
            return (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="rounded-md bg-ice-soft px-2 py-1 text-xs font-semibold tabular-nums text-deep">
                  {c.hora}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm font-medium ${
                      cancelada ? "text-muted line-through" : "text-deep"
                    }`}
                  >
                    {c.pacienteNombre}
                  </span>
                  {c.motivo ? (
                    <span className="block truncate text-xs text-muted">{c.motivo}</span>
                  ) : null}
                </span>
                {c.estado === "atendida" ? (
                  <span className="rounded-full bg-mint-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                    Atendida
                  </span>
                ) : null}
                {confirmId === c.id ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmId(null);
                        eliminar(c.id);
                      }}
                      className="rounded-full bg-danger px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      aria-label="Cancelar eliminación"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-ice-soft"
                    >
                      <X size={16} />
                    </button>
                  </span>
                ) : c.estado === "programada" ? (
                  <span className="flex shrink-0 items-center gap-0.5">
                    <Link
                      href={`/app/consultas/nueva?nombre=${encodeURIComponent(c.pacienteNombre)}`}
                      title="Iniciar consulta"
                      aria-label={`Iniciar consulta con ${c.pacienteNombre}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md text-accent hover:bg-accent-soft"
                    >
                      <Play size={16} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => marcarAtendida(c.id)}
                      title="Marcar atendida"
                      aria-label={`Marcar atendida la cita de ${c.pacienteNombre}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-mint-soft hover:text-success"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(c.id)}
                      title="Eliminar cita"
                      aria-label={`Eliminar la cita de ${c.pacienteNombre}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(c.id)}
                    title="Eliminar cita"
                    aria-label={`Eliminar la cita de ${c.pacienteNombre}`}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-2 text-sm text-muted">
          Sin citas agendadas para hoy. Agrégalas a mano o importa una foto de tu
          horario.
        </p>
      )}

      {importOpen ? (
        <ImportarFotoModal
          fecha={hoy}
          onClose={() => setImportOpen(false)}
          onImported={onImported}
        />
      ) : null}
    </Card>
  );
}

/* ============================ Importar desde foto ============================ */

type FilaRevision = ParsedCita & { incluir: boolean };

function ImportarFotoModal({
  fecha,
  onClose,
  onImported,
}: {
  fecha: string;
  onClose: () => void;
  onImported: (citas: Appointment[]) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Cache del último análisis: re-analizar la misma foto no debe volver a
  // pagar la llamada de visión.
  const lastAnalysisRef = useRef<{ img: string; citas: ParsedCita[] } | null>(null);

  const [img, setImg] = useState<string | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaRevision[] | null>(null);
  const [agregando, setAgregando] = useState(false);

  // Accesibilidad del modal: foco inicial en el diálogo y cierre con Escape.
  useEffect(() => {
    dialogRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onFile(f: File | undefined) {
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(f.type)) {
      showToast("Usa una imagen JPG, PNG o WebP.", "warning");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      showToast("La imagen supera 5 MB. Usa una captura más liviana.", "warning");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImg(String(reader.result));
      setFilas(null);
      setAviso(null);
    };
    reader.readAsDataURL(f);
  }

  async function analizar() {
    if (!img) return;
    if (lastAnalysisRef.current?.img === img) {
      setFilas(lastAnalysisRef.current.citas.map((c) => ({ ...c, incluir: true })));
      return;
    }
    setAnalizando(true);
    setAviso(null);
    try {
      const res = await fetch("/api/parse-schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: img }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAviso(data?.error ?? "No se pudo analizar la imagen. Intenta de nuevo.");
        return;
      }
      if (data?.connected === false) {
        setAviso(
          "El análisis con IA no está configurado en el servidor. Puedes agregar las citas manualmente con «Agregar cita».",
        );
        return;
      }
      const citas: ParsedCita[] = Array.isArray(data?.citas) ? data.citas : [];
      if (!citas.length) {
        setAviso(
          "No se detectaron citas en la imagen. Prueba con una foto más nítida o donde se vean las horas y los nombres.",
        );
        return;
      }
      lastAnalysisRef.current = { img, citas };
      setFilas(citas.map((c) => ({ ...c, incluir: true })));
    } catch {
      setAviso("Error de red al analizar la imagen. Intenta de nuevo.");
    } finally {
      setAnalizando(false);
    }
  }

  function updateFila(i: number, patch: Partial<FilaRevision>) {
    setFilas((list) =>
      list ? list.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) : list,
    );
  }

  const seleccionadas = (filas ?? []).filter(
    (f) => f.incluir && normalizeHora(f.hora) && f.paciente.trim(),
  );

  async function confirmar() {
    if (!seleccionadas.length) {
      showToast("Selecciona al menos una cita con hora y paciente.", "warning");
      return;
    }
    setAgregando(true);
    const { data, error } = await supabase
      .from("appointments")
      .insert(
        seleccionadas.map((f) => ({
          fecha,
          hora: normalizeHora(f.hora),
          paciente_nombre: f.paciente.trim(),
          paciente_documento: f.documento?.trim() || null,
          motivo: f.motivo?.trim() || null,
          source: "importada",
        })),
      )
      .select();
    setAgregando(false);
    if (error || !data) {
      console.error("[agenda] import", error?.message);
      showToast("No se pudieron guardar las citas.", "warning");
      return;
    }
    onImported(data.map(rowToAppointment));
    showToast(
      `${data.length} ${data.length === 1 ? "cita agendada" : "citas agendadas"}.`,
      "success",
    );
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-night/40 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Importar horario desde foto"
        className="relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-xl)] outline-none"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="text-base font-semibold text-deep">
            Importar horario desde foto
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-muted hover:text-deep"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {!filas ? (
            <>
              <p className="text-sm text-muted">
                Sube una foto o captura del horario de tu sistema (agenda
                hospitalaria, planilla, cuaderno). Se extraen las citas y las
                revisas antes de agregarlas. La imagen no se guarda.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              {img ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt="Vista previa del horario"
                    className="mt-4 max-h-64 w-full rounded-lg border border-line object-contain"
                  />
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-deep hover:border-mist"
                    >
                      Cambiar imagen
                    </button>
                    <button
                      type="button"
                      onClick={analizar}
                      disabled={analizando}
                      className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
                    >
                      {analizando ? (
                        <>
                          <Loader2 size={15} className="animate-spin" /> Analizando…
                        </>
                      ) : (
                        <>Analizar horario</>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-4 flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-accent/50 bg-ice-soft px-4 py-8 text-sm font-semibold text-accent-ink hover:bg-accent-soft"
                >
                  <Camera size={22} />
                  Elegir foto o captura
                </button>
              )}
              {aviso ? (
                <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                  {aviso}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                Revisa lo detectado: corrige horas o nombres, desmarca lo que no
                aplique y confirma.
              </p>
              <ul className="mt-3 space-y-2">
                {filas.map((f, i) => (
                  <li
                    key={i}
                    className={`flex flex-wrap items-center gap-2 rounded-md border p-2.5 ${
                      f.incluir ? "border-line" : "border-line opacity-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={f.incluir}
                      onChange={(e) => updateFila(i, { incluir: e.target.checked })}
                      aria-label={`Incluir cita de ${f.paciente || "paciente"}`}
                      className="h-4 w-4 accent-accent"
                    />
                    <input
                      type="time"
                      value={normalizeHora(f.hora) ?? ""}
                      onChange={(e) => updateFila(i, { hora: e.target.value })}
                      aria-label="Hora"
                      className={`${inputClass} w-[105px]`}
                    />
                    <input
                      value={f.paciente}
                      onChange={(e) => updateFila(i, { paciente: e.target.value })}
                      placeholder="Paciente"
                      aria-label="Paciente"
                      className={`${inputClass} min-w-[140px] flex-1`}
                    />
                    <input
                      value={f.motivo ?? ""}
                      onChange={(e) => updateFila(i, { motivo: e.target.value })}
                      placeholder="Motivo (opcional)"
                      aria-label="Motivo"
                      className={`${inputClass} min-w-[120px] flex-1`}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {filas ? (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3.5">
            <button
              type="button"
              onClick={() => setFilas(null)}
              className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-deep hover:border-mist"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={agregando || !seleccionadas.length}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {agregando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Agregar {seleccionadas.length}{" "}
              {seleccionadas.length === 1 ? "cita" : "citas"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
