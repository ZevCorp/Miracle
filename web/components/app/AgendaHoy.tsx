"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Camera,
  Check,
  Loader2,
  X,
} from "lucide-react";
import { useStore } from "@/app/app/providers";
import { createClient } from "@/lib/supabase/client";
import {
  appointmentImportFingerprint,
  normalizeHora,
  rowToAppointment,
  todayLocalISO,
  type Appointment,
  type ParsedCita,
} from "@/lib/agenda";

const inputClass = "clinical-control px-3 text-sm outline-none";

function sortCitas(list: Appointment[]): Appointment[] {
  return [...list].sort((a, b) => a.hora.localeCompare(b.hora));
}

/**
 * La agenda del dia como HOOK: citas de hoy + mutaciones, sin markup.
 *
 * Antes esto era un componente monolitico de 400 lineas; ahora la Jornada del
 * dashboard (DayFlow) compone su propio riel con estos datos. Ninguna query
 * cambio: solo se mudaron.
 */
export interface UseAgendaHoy {
  hoy: string;
  citas: Appointment[];
  cargando: boolean;
  /** false si la tabla appointments aun no existe (migracion sin aplicar). */
  dbLista: boolean;
  agregar: (datos: {
    hora: string;
    nombre: string;
    motivo: string;
    linkedPatientId: string;
  }) => Promise<boolean>;
  marcarAtendida: (id: string) => Promise<void>;
  eliminar: (id: string) => Promise<void>;
  onImported: (nuevas: Appointment[]) => void;
}

export function useAgendaHoy(): UseAgendaHoy {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useStore();
  const hoy = useMemo(() => todayLocalISO(), []);

  const [citas, setCitas] = useState<Appointment[]>([]);
  const [cargando, setCargando] = useState(true);
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

  const agregar = useCallback(
    async (datos: {
      hora: string;
      nombre: string;
      motivo: string;
      linkedPatientId: string;
    }): Promise<boolean> => {
      const h = normalizeHora(datos.hora);
      const n = datos.nombre.trim();
      if (!h || !n) {
        showToast("Indica hora y nombre del paciente.", "warning");
        return false;
      }
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          fecha: hoy,
          hora: h,
          paciente_nombre: n,
          motivo: datos.motivo.trim() || null,
          patient_id: datos.linkedPatientId || null,
        })
        .select()
        .single();
      if (error || !data) {
        console.error("[agenda] insert", error?.message);
        showToast("No se pudo guardar la cita.", "warning");
        return false;
      }
      setCitas((list) => sortCitas([...list, rowToAppointment(data)]));
      showToast("Cita agendada.", "success");
      return true;
    },
    [supabase, hoy, showToast],
  );

  const marcarAtendida = useCallback(
    async (id: string) => {
      const previous = citas.find((c) => c.id === id);
      setCitas((list) =>
        list.map((c) => (c.id === id ? { ...c, estado: "atendida" as const } : c)),
      );
      const { error } = await supabase
        .from("appointments")
        .update({ estado: "atendida" })
        .eq("id", id);
      if (error) {
        console.error("[agenda] update", error.message);
        if (previous) {
          const rollback = previous;
          setCitas((list) => list.map((c) => (c.id === id ? rollback : c)));
        }
        showToast("No se pudo actualizar la cita.", "warning");
      }
    },
    [citas, supabase, showToast],
  );

  const eliminar = useCallback(
    async (id: string) => {
      const removed = citas.find((c) => c.id === id);
      setCitas((list) => list.filter((c) => c.id !== id));
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) {
        console.error("[agenda] delete", error.message);
        if (removed) {
          const rollback = removed;
          setCitas((list) => sortCitas([...list.filter((c) => c.id !== id), rollback]));
        }
        showToast("No se pudo eliminar la cita.", "warning");
      }
    },
    [citas, supabase, showToast],
  );

  const onImported = useCallback((nuevas: Appointment[]) => {
    setCitas((list) => sortCitas([...list, ...nuevas]));
  }, []);

  return { hoy, citas, cargando, dbLista, agregar, marcarAtendida, eliminar, onImported };
}

/**
 * El formulario de alta manual de una cita, tal cual era, ahora componible:
 * la Jornada lo abre bajo el encabezado del riel.
 */
export function AgendaQuickAdd({
  onAgregar,
  onClose,
}: {
  onAgregar: UseAgendaHoy["agregar"];
  onClose: () => void;
}) {
  const { patients } = useStore();
  const [hora, setHora] = useState("");
  const [nombre, setNombre] = useState("");
  const [motivo, setMotivo] = useState("");
  // Vinculo opcional a un paciente ya registrado: al elegirlo se guarda el
  // patient_id verificado (evita luego la confirmacion por nombre al atender).
  const [linkedPatientId, setLinkedPatientId] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    setGuardando(true);
    const ok = await onAgregar({ hora, nombre, motivo, linkedPatientId });
    setGuardando(false);
    if (ok) onClose();
  }

  return (
    <div className="clinical-panel-muted mb-3 p-3.5">
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
      {patients.length ? (
        <select
          value={linkedPatientId}
          onChange={(e) => {
            setLinkedPatientId(e.target.value);
            const p = patients.find((x) => x.id === e.target.value);
            if (p) setNombre(p.nombre);
          }}
          aria-label="Vincular paciente registrado (opcional)"
          className={`${inputClass} mt-2 w-full`}
        >
          <option value="">Vincular paciente registrado (opcional)</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
              {p.documento && p.documento !== "Por registrar"
                ? ` — ${p.documento}`
                : ""}
            </option>
          ))}
        </select>
      ) : null}
      <div className="mt-2.5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="clinical-secondary min-h-10 px-3.5 py-2 text-[13px]"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void agregar()}
          disabled={guardando}
          className="clinical-primary min-h-10 px-4 py-2 text-[13px]"
        >
          {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Agendar
        </button>
      </div>
    </div>
  );
}

/* ============================ Importar desde foto ============================ */

type FilaRevision = ParsedCita & { incluir: boolean };

export function ImportarFotoModal({
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
      // Vercel puede cortar la subida con un 413/504 en HTML antes de llegar a
      // la ruta: se detecta para no mostrar "error de red" ni romper res.json().
      const contentType = res.headers.get("content-type") ?? "";
      if (res.status === 413 || !contentType.includes("application/json")) {
        setAviso(
          "La imagen es demasiado pesada o el servicio no está disponible. Prueba con una foto más liviana.",
        );
        return;
      }
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
    try {
      const { data: userData } = await supabase.auth.getUser();
      const doctorId = userData.user?.id;
      if (!doctorId) {
        showToast("Tu sesión expiró. Vuelve a iniciar sesión para importar citas.", "warning");
        return;
      }

      // Sin patient_id: los nombres vienen de OCR y podrían no coincidir con un
      // registro. El vínculo verificado se resuelve al atender, con la tarjeta
      // de confirmación por nombre de /app/consultas/nueva.
      const rows = await Promise.all(
        seleccionadas.map(async (f) => ({
          fecha,
          hora: normalizeHora(f.hora),
          paciente_nombre: f.paciente.trim(),
          paciente_documento: f.documento?.trim() || null,
          motivo: f.motivo?.trim() || null,
          source: "importada",
          medico_id: doctorId,
          import_fingerprint: await appointmentImportFingerprint({
            fecha,
            hora: f.hora,
            paciente: f.paciente,
          }),
        })),
      );
      const { data, error } = await supabase
        .from("appointments")
        .upsert(rows, { onConflict: "medico_id,import_fingerprint", ignoreDuplicates: true })
        .select();
      if (error || !data) {
        console.error("[agenda] import", error?.message);
        showToast("No se pudieron guardar las citas.", "warning");
        return;
      }
      onImported(data.map(rowToAppointment));
      const skipped = seleccionadas.length - data.length;
      showToast(
        skipped
          ? `${data.length} nuevas y ${skipped} ya existentes. No se duplicaron citas.`
          : `${data.length} ${data.length === 1 ? "cita agendada" : "citas agendadas"}.`,
        "success",
      );
      onClose();
    } catch (error) {
      console.error("[agenda] import failed", error);
      showToast("No se pudieron guardar las citas. Intenta de nuevo.", "warning");
    } finally {
      setAgregando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-overlay backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Importar horario desde foto"
        className="relative z-10 flex h-dvh max-h-dvh w-full max-w-xl flex-col overflow-hidden bg-surface shadow-[var(--shadow-xl)] outline-none sm:h-auto sm:max-h-[85vh] sm:rounded-lg sm:border sm:border-line"
      >
        <div className="app-mobile-header flex items-center justify-between border-b border-line px-4 py-3.5 sm:h-auto sm:px-5">
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
                onChange={(e) => {
                  onFile(e.target.files?.[0]);
                  // Permite volver a elegir la misma captura tras corregirla.
                  e.currentTarget.value = "";
                }}
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
