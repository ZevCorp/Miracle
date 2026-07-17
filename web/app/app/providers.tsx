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
import {
  type AuditEvent,
  type ClinicalCode,
  type CodeStatus,
  type Consultation,
  type ConsultationStatus,
  type ConsultationType,
  type NoteSection,
  type Patient,
  type Role,
} from "@/lib/mock";
import { createClient } from "@/lib/supabase/client";
import { getClinicalEncounter } from "@/lib/api/clinical";
import { transcriptTextToTurns } from "@/lib/clinical/encounter-to-consultation";
import type { AppRole } from "@/lib/auth/roles";
import { signConsultationNote } from "@/app/app/consultas/actions";

type ToastTone = "success" | "info" | "warning";
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface NewPatientInput {
  nombre: string;
  documento?: string;
  edad?: number;
  sexo?: Patient["sexo"];
  eps?: string;
  telefono?: string;
}

interface StoreValue {
  consultations: Consultation[];
  patients: Patient[];
  role: Role;
  loading: boolean;
  /** true mientras haya escrituras pendientes de sincronizar con el servidor. */
  syncing: boolean;
  /** Carga bajo demanda la transcripción de una consulta (no viene en la carga inicial). */
  ensureTranscript: (id: string) => Promise<void>;
  getConsultation: (id: string) => Consultation | undefined;
  getPatient: (id: string | null | undefined) => Patient | undefined;
  getMedicoName: (id: string) => string | undefined;
  addPatient: (patient: string | NewPatientInput) => Patient;
  approveNote: (id: string) => void;
  exportNote: (id: string) => void;
  markReviewed: (id: string) => void;
  setCodeStatus: (id: string, codeId: string, estado: CodeStatus) => void;
  addCode: (id: string, code: Omit<ClinicalCode, "id" | "estado">) => void;
  updateNote: (id: string, sectionId: string, next: Partial<NoteSection>) => void;
  addConsultation: (c: Consultation) => void;
  /**
   * Inserta o actualiza (por id) una consulta. Lo usa el puente del backend
   * clínico: al completar un encounter, su nota se espeja aquí para que aparezca
   * en el historial y pueda firmarse/exportarse. Idempotente por id.
   */
  upsertConsultation: (c: Consultation) => void;
  resetDemo: () => void;
  toast: Toast | null;
  showToast: (message: string, tone?: ToastTone) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function uuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Topes de la carga inicial del store (bounded load): se cargan las consultas y
// los pacientes más recientes; el audit se trae solo de las consultas cargadas.
// Las páginas de lista pesadas migran a paginación en servidor (RSC) aparte.
const CONSULTATIONS_CAP = 300;
const PATIENTS_CAP = 500;

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToPatient(r: any): Patient {
  return {
    id: r.id,
    nombre: r.nombre,
    documento: r.documento || "Por registrar",
    edad: r.edad ?? 0,
    sexo: (r.sexo as Patient["sexo"]) ?? null,
    eps: r.eps || "Por registrar",
    telefono: r.telefono || "—",
    antecedentes: r.antecedentes ?? [],
    alergias: r.alergias ?? [],
    medicamentos: r.medicamentos ?? [],
  };
}

function rowToConsultation(r: any, auditoria: AuditEvent[]): Consultation {
  return {
    id: r.id,
    pacienteId: r.patient_id ?? "",
    medicoId: r.medico_id ?? "",
    servicio: r.servicio ?? "",
    especialidad: r.especialidad ?? "",
    tipo: (r.tipo as ConsultationType) ?? "presencial",
    estado: (r.estado as ConsultationStatus) ?? "borrador",
    fecha: r.fecha,
    duracionMin: r.duracion_min ?? 0,
    plantilla: r.plantilla ?? "",
    motivo: r.motivo ?? "",
    note: (r.note as NoteSection[]) ?? [],
    transcript: r.transcript ?? [],
    resumen: r.resumen ?? "",
    codigos: (r.codigos as ClinicalCode[]) ?? [],
    auditoria,
    firma: r.firma ?? undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function MiracleProvider({
  children,
  role,
  userName,
}: {
  children: ReactNode;
  role: AppRole;
  userName?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  // El actor de auditoría es siempre el usuario real; nunca un nombre ficticio.
  const actor = userName?.trim() || "Profesional de salud";

  const [patients, setPatients] = useState<Patient[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [medicos, setMedicos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  const consultationsRef = useRef<Consultation[]>([]);
  useEffect(() => {
    consultationsRef.current = consultations;
  }, [consultations]);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now();
    setToast({ id, message, tone });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3200);
  }, []);

  // ---- Carga inicial desde Supabase ----------------------------------------
  // Columnas explícitas: `transcript` (el campo más pesado) se carga bajo
  // demanda con ensureTranscript; los perfiles no exponen el email al cliente.
  const load = useCallback(async () => {
    const [patRes, conRes, profRes] = await Promise.all([
      supabase
        .from("patients")
        .select(
          "id, nombre, documento, edad, sexo, eps, telefono, antecedentes, alergias, medicamentos",
        )
        .order("created_at", { ascending: false })
        .limit(PATIENTS_CAP),
      supabase
        .from("consultations")
        .select(
          "id, patient_id, medico_id, servicio, especialidad, tipo, estado, fecha, duracion_min, plantilla, motivo, note, resumen, codigos, firma",
        )
        .order("fecha", { ascending: false })
        .limit(CONSULTATIONS_CAP),
      supabase.from("profiles").select("id, full_name"),
    ]);

    const med: Record<string, string> = {};
    for (const p of profRes.data ?? []) {
      med[p.id] = p.full_name || "Médico";
    }
    setMedicos(med);

    setPatients((patRes.data ?? []).map(rowToPatient));

    // Audit: dependiente de las consultas cargadas (por sus IDs), para conservar
    // el timeline completo de cada una sin traer eventos huérfanos.
    const consultRows = conRes.data ?? [];
    const consultIds = consultRows.map((c) => c.id);
    const auditByCons = new Map<string, AuditEvent[]>();
    if (consultIds.length) {
      const { data: audData } = await supabase
        .from("audit_events")
        .select("*")
        .in("consultation_id", consultIds)
        .order("fecha", { ascending: true });
      for (const a of audData ?? []) {
        const list = auditByCons.get(a.consultation_id) ?? [];
        list.push({
          id: a.id,
          fecha: a.fecha,
          actor: a.actor_name ?? "Sistema",
          accion: a.accion,
          detalle: a.detalle ?? undefined,
        });
        auditByCons.set(a.consultation_id, list);
      }
    }
    setConsultations(
      consultRows.map((c) => rowToConsultation(c, auditByCons.get(c.id) ?? [])),
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // Limpieza: el store anterior guardaba en localStorage; ya no se usa.
    try {
      localStorage.removeItem("miracle-store-v3");
    } catch {
      /* ignore */
    }
    let ignore = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        console.error("[store] carga inicial falló", e);
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [load]);

  // ---- Persistencia de mutaciones ------------------------------------------
  // Reintenta con backoff y expone `syncing` para que la UI avise mientras
  // haya cambios sin confirmar; en cada intento se toma la versión más
  // reciente de la consulta para no pisar ediciones posteriores.
  const [pendingWrites, setPendingWrites] = useState(0);

  const persist = useCallback(
    (c: Consultation) => {
      setPendingWrites((n) => n + 1);
      void (async () => {
        const delays = [1_000, 3_000, 8_000];
        try {
          for (let attempt = 0; ; attempt++) {
            const latest =
              consultationsRef.current.find((x) => x.id === c.id) ?? c;
            const { error } = await supabase
              .from("consultations")
              .update({
                estado: latest.estado,
                note: latest.note,
                codigos: latest.codigos,
                resumen: latest.resumen,
                firma: latest.firma ?? null,
              })
              .eq("id", c.id);
            if (!error) return;
            if (attempt >= delays.length) {
              console.error("[store] persist consulta", error.message);
              showToast(
                "No se pudo guardar el cambio. Revisa tu conexión e intenta de nuevo.",
                "warning",
              );
              return;
            }
            await new Promise((r) => setTimeout(r, delays[attempt]));
          }
        } finally {
          setPendingWrites((n) => n - 1);
        }
      })();
    },
    [supabase, showToast],
  );

  // Aviso del navegador si se intenta cerrar con cambios sin sincronizar.
  // Depende del booleano (no del contador) para no re-registrar el listener
  // en cada escritura.
  const hasPendingWrites = pendingWrites > 0;
  useEffect(() => {
    if (!hasPendingWrites) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasPendingWrites]);

  // ---- Transcripción bajo demanda -------------------------------------------
  const transcriptFetched = useRef(new Set<string>());

  const ensureTranscript = useCallback(
    async (id: string) => {
      const current = consultationsRef.current.find((c) => c.id === id);
      if (!current || current.transcript.length > 0) return;
      if (transcriptFetched.current.has(id)) return;
      transcriptFetched.current.add(id);
      // 1) Espejo local (consultations.transcript): la vía normal para consultas nuevas.
      const { data, error } = await supabase
        .from("consultations")
        .select("transcript")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        transcriptFetched.current.delete(id);
        console.error("[store] transcript", error.message);
        return;
      }
      let transcript = (data?.transcript as Consultation["transcript"]) ?? [];

      // 2) Respaldo: consultas antiguas cuya transcripción quedó solo en el backend
      //    clínico (el espejo local no la tenía). Si el backend no responde, se
      //    mantiene "sin transcripción" sin romper la vista.
      if (!transcript.length) {
        try {
          const encounter = await getClinicalEncounter(id);
          transcript = transcriptTextToTurns(encounter.transcript);
        } catch {
          /* backend no disponible: sigue sin transcripción */
        }
      }

      if (transcript.length) {
        setConsultations((list) =>
          list.map((c) => (c.id === id ? { ...c, transcript } : c)),
        );
      }
    },
    [supabase],
  );

  const remoteAudit = useCallback(
    (consultationId: string, accion: string, detalle?: string) => {
      supabase
        .from("audit_events")
        .insert({
          consultation_id: consultationId,
          actor_name: actor,
          accion,
          detalle: detalle ?? null,
        })
        .then(({ error }) => {
          if (error) console.error("[store] audit", error.message);
        });
    },
    [supabase, actor],
  );

  // Aplica un cambio a una consulta: estado local + Supabase + auditoría.
  const mutate = useCallback(
    (
      id: string,
      fn: (c: Consultation) => Consultation,
      accion?: string,
      detalle?: string,
    ) => {
      const cur = consultationsRef.current.find((c) => c.id === id);
      if (!cur) return;
      let next = fn(cur);
      if (accion) {
        next = {
          ...next,
          auditoria: [
            ...next.auditoria,
            {
              id: `a-${Date.now()}`,
              fecha: new Date().toISOString(),
              actor,
              accion,
              detalle,
            },
          ],
        };
      }
      setConsultations((list) => list.map((c) => (c.id === id ? next : c)));
      persist(next);
      if (accion) remoteAudit(id, accion, detalle);
    },
    [actor, persist, remoteAudit],
  );

  // ---- Pacientes ------------------------------------------------------------
  const getPatient = useCallback(
    (id: string | null | undefined) =>
      id ? patients.find((p) => p.id === id) : undefined,
    [patients],
  );

  const addPatient = useCallback(
    (patient: string | NewPatientInput): Patient => {
      const input = typeof patient === "string" ? { nombre: patient } : patient;
      const nuevo: Patient = {
        id: uuid(),
        nombre: input.nombre.trim(),
        documento: input.documento?.trim() || "Por registrar",
        edad: input.edad && input.edad > 0 ? input.edad : 0,
        // Sin valor por defecto: un dato clínico no registrado queda como null.
        sexo: input.sexo ?? null,
        eps: input.eps?.trim() || "Por registrar",
        telefono: input.telefono?.trim() || "—",
        antecedentes: [],
        alergias: [],
        medicamentos: [],
      };
      setPatients((list) => [nuevo, ...list]);
      supabase
        .from("patients")
        .insert({
          id: nuevo.id,
          nombre: nuevo.nombre,
          documento: input.documento?.trim() || null,
          edad: nuevo.edad > 0 ? nuevo.edad : null,
          sexo: nuevo.sexo ?? null,
          eps: input.eps?.trim() || null,
          telefono: input.telefono?.trim() || null,
        })
        .then(({ error }) => {
          if (error) {
            console.error("[store] insert paciente", error.message);
            showToast("Paciente creado, pero no se pudo guardar.", "warning");
          }
        });
      return nuevo;
    },
    [supabase, showToast],
  );

  // ---- Consultas ------------------------------------------------------------
  const getConsultation = useCallback(
    (id: string) => consultations.find((c) => c.id === id),
    [consultations],
  );

  const getMedicoName = useCallback((id: string) => medicos[id], [medicos]);

  const addConsultation = useCallback(
    (c: Consultation) => {
      setConsultations((list) => [c, ...list]);
      (async () => {
        const { error } = await supabase.from("consultations").insert({
          id: c.id,
          patient_id: c.pacienteId || null,
          servicio: c.servicio,
          especialidad: c.especialidad,
          tipo: c.tipo,
          estado: c.estado,
          motivo: c.motivo,
          fecha: c.fecha,
          duracion_min: c.duracionMin,
          plantilla: c.plantilla,
          resumen: c.resumen,
          note: c.note,
          codigos: c.codigos,
          transcript: c.transcript,
          firma: c.firma ?? null,
        });
        if (error) {
          console.error("[store] insert consulta", error.message);
          showToast("No se pudo guardar la consulta.", "warning");
          return;
        }
        if (c.auditoria.length) {
          await supabase.from("audit_events").insert(
            c.auditoria.map((a) => ({
              consultation_id: c.id,
              actor_name: a.actor,
              accion: a.accion,
              detalle: a.detalle ?? null,
            })),
          );
        }
      })();
    },
    [supabase, showToast],
  );

  // Puente del backend clínico: espeja un encounter completado como consulta.
  // Idempotente por id (upsert) para que re-guardar la nota no duplique filas;
  // registra la auditoría solo en la primera creación.
  const upsertConsultation = useCallback(
    (c: Consultation) => {
      const isNew = !consultationsRef.current.some((x) => x.id === c.id);
      const audit = isNew
        ? {
            id: `a-${uuid()}`,
            fecha: c.fecha,
            actor,
            accion: "Nota generada con Miracle",
            detalle: "Generada desde la consulta activa.",
          }
        : null;

      setConsultations((list) =>
        isNew
          ? [{ ...c, auditoria: audit ? [audit] : [] }, ...list]
          : // Preserva la auditoría existente al actualizar el contenido.
            list.map((x) =>
              x.id === c.id ? { ...c, auditoria: x.auditoria } : x,
            ),
      );

      void (async () => {
        const { error } = await supabase.from("consultations").upsert(
          {
            id: c.id,
            patient_id: c.pacienteId || null,
            servicio: c.servicio,
            especialidad: c.especialidad,
            tipo: c.tipo,
            estado: c.estado,
            motivo: c.motivo,
            fecha: c.fecha,
            duracion_min: c.duracionMin,
            plantilla: c.plantilla,
            resumen: c.resumen,
            note: c.note,
            codigos: c.codigos,
            transcript: c.transcript,
            firma: c.firma ?? null,
          },
          { onConflict: "id" },
        );
        if (error) {
          console.error("[store] upsert consulta (puente)", error.message);
          showToast(
            "La nota se generó, pero no se pudo guardar en tu historial. Reintenta.",
            "warning",
          );
          return;
        }
        if (audit) {
          await supabase.from("audit_events").insert({
            consultation_id: c.id,
            actor_name: audit.actor,
            accion: audit.accion,
            detalle: audit.detalle,
          });
        }
      })();
    },
    [supabase, actor, showToast],
  );

  // La firma se hace en el servidor (valida sesión, estado y deja hash del
  // contenido en auditoría); aquí solo se refleja el resultado en el estado.
  const approveNote = useCallback(
    (id: string) => {
      void (async () => {
        const result = await signConsultationNote(id);
        if (!result.ok || !result.firma) {
          showToast(result.error ?? "No se pudo firmar la nota.", "warning");
          return;
        }
        const { firma } = result;
        setConsultations((list) =>
          list.map((c) =>
            c.id === id
              ? {
                  ...c,
                  estado: "aprobada" as const,
                  firma,
                  auditoria: [
                    ...c.auditoria,
                    {
                      id: `a-${Date.now()}`,
                      fecha: firma.fecha,
                      actor: firma.por,
                      accion: "Nota aprobada y firmada",
                      detalle: `Firmada por ${firma.por}`,
                    },
                  ],
                }
              : c,
          ),
        );
        showToast("Nota aprobada y firmada.", "success");
      })();
    },
    [showToast],
  );

  const exportNote = useCallback(
    (id: string) => {
      mutate(
        id,
        (c) => ({ ...c, estado: "exportada" }),
        "Nota exportada a HC",
        "Copiada al sistema de historia clínica.",
      );
      showToast("Nota exportada a la historia clínica.", "success");
    },
    [mutate, showToast],
  );

  const markReviewed = useCallback(
    (id: string) => {
      mutate(id, (c) => ({ ...c, estado: "revisada" }), "Nota marcada como revisada");
      showToast("Nota marcada como revisada.", "info");
    },
    [mutate, showToast],
  );

  const setCodeStatus = useCallback(
    (id: string, codeId: string, estado: CodeStatus) => {
      const code = consultationsRef.current
        .find((c) => c.id === id)
        ?.codigos.find((k) => k.id === codeId);
      mutate(
        id,
        (c) => ({
          ...c,
          codigos: c.codigos.map((k) => (k.id === codeId ? { ...k, estado } : k)),
        }),
        estado === "aceptado" && code ? "Código aceptado" : undefined,
        estado === "aceptado" && code ? `${code.sistema} ${code.codigo}` : undefined,
      );
    },
    [mutate],
  );

  const addCode = useCallback(
    (id: string, code: Omit<ClinicalCode, "id" | "estado">) => {
      mutate(
        id,
        (c) => ({
          ...c,
          codigos: [
            ...c.codigos,
            { ...code, id: `k-${Date.now()}`, estado: "aceptado" },
          ],
        }),
        "Código agregado",
        `${code.sistema} ${code.codigo}`,
      );
      showToast("Código agregado.", "success");
    },
    [mutate, showToast],
  );

  const updateNote = useCallback(
    (id: string, sectionId: string, next: Partial<NoteSection>) => {
      mutate(
        id,
        (c) => ({
          ...c,
          note: c.note.map((s) => (s.id === sectionId ? { ...s, ...next } : s)),
        }),
        "Nota editada",
        next.titulo ? `Sección «${next.titulo}»` : undefined,
      );
    },
    [mutate],
  );

  const resetDemo = useCallback(() => {
    setLoading(true);
    load().finally(() => showToast("Datos recargados.", "info"));
  }, [load, showToast]);

  const value = useMemo<StoreValue>(
    () => ({
      consultations,
      patients,
      role,
      loading,
      syncing: pendingWrites > 0,
      ensureTranscript,
      getConsultation,
      getPatient,
      getMedicoName,
      addPatient,
      approveNote,
      exportNote,
      markReviewed,
      setCodeStatus,
      addCode,
      updateNote,
      addConsultation,
      upsertConsultation,
      resetDemo,
      toast,
      showToast,
    }),
    [
      consultations,
      patients,
      role,
      loading,
      pendingWrites,
      ensureTranscript,
      getConsultation,
      getPatient,
      getMedicoName,
      addPatient,
      approveNote,
      exportNote,
      markReviewed,
      setCodeStatus,
      addCode,
      updateNote,
      addConsultation,
      upsertConsultation,
      resetDemo,
      toast,
      showToast,
    ],
  );

  // Sin puerta de carga global: cada página decide su propio skeleton con
  // `loading`, y la navegación queda usable desde el primer render.
  return (
    <StoreContext.Provider value={value}>
      {children}
      <ToastHost toast={toast} />
    </StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de MiracleProvider");
  return ctx;
}

function ToastHost({ toast }: { toast: Toast | null }) {
  if (!toast) return null;
  const tone =
    toast.tone === "success"
      ? "border-success/30 bg-success-soft text-success"
      : toast.tone === "warning"
        ? "border-warning/30 bg-warning-soft text-warning"
        : "border-accent/30 bg-accent-soft text-accent-ink";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4">
      <div
        role="status"
        className={`pointer-events-auto rounded-full border px-5 py-2.5 text-sm font-semibold shadow-[var(--shadow-lg)] ${tone}`}
      >
        {toast.message}
      </div>
    </div>
  );
}
