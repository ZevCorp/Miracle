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
import { Loader2 } from "lucide-react";
import {
  doctors,
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
import type { AppRole } from "@/lib/auth/roles";

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
  getConsultation: (id: string) => Consultation | undefined;
  getPatient: (id: string | null | undefined) => Patient | undefined;
  addPatient: (patient: string | NewPatientInput) => Patient;
  approveNote: (id: string) => void;
  exportNote: (id: string) => void;
  markReviewed: (id: string) => void;
  setCodeStatus: (id: string, codeId: string, estado: CodeStatus) => void;
  addCode: (id: string, code: Omit<ClinicalCode, "id" | "estado">) => void;
  updateNote: (id: string, sectionId: string, next: Partial<NoteSection>) => void;
  addConsultation: (c: Consultation) => void;
  resetDemo: () => void;
  toast: Toast | null;
  showToast: (message: string, tone?: ToastTone) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function currentUserName(role: Role): string {
  const map: Record<Role, string> = {
    medico: "Dra. Daniela Rincón",
    supervisor: "Dr. Mauricio Lozano",
    admin: "Dra. Patricia Núñez",
  };
  return map[role] ?? doctors[0].nombre;
}

function uuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToPatient(r: any): Patient {
  return {
    id: r.id,
    nombre: r.nombre,
    documento: r.documento || "Por registrar",
    edad: r.edad ?? 0,
    sexo: (r.sexo as Patient["sexo"]) ?? "F",
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
  const actor = userName?.trim() || currentUserName(role);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
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
  const load = useCallback(async () => {
    const [patRes, conRes, audRes] = await Promise.all([
      supabase.from("patients").select("*").order("created_at", { ascending: false }),
      supabase.from("consultations").select("*").order("fecha", { ascending: false }),
      supabase.from("audit_events").select("*").order("fecha", { ascending: true }),
    ]);

    setPatients((patRes.data ?? []).map(rowToPatient));

    const auditByCons = new Map<string, AuditEvent[]>();
    for (const a of audRes.data ?? []) {
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
    setConsultations(
      (conRes.data ?? []).map((c) => rowToConsultation(c, auditByCons.get(c.id) ?? [])),
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
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
  const persist = useCallback(
    (c: Consultation) => {
      supabase
        .from("consultations")
        .update({
          estado: c.estado,
          note: c.note,
          codigos: c.codigos,
          resumen: c.resumen,
          firma: c.firma ?? null,
        })
        .eq("id", c.id)
        .then(({ error }) => {
          if (error) {
            console.error("[store] persist consulta", error.message);
            showToast("No se pudo sincronizar el cambio.", "warning");
          }
        });
    },
    [supabase, showToast],
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
        sexo: input.sexo ?? "F",
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
          sexo: nuevo.sexo,
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

  const approveNote = useCallback(
    (id: string) => {
      mutate(
        id,
        (c) => ({
          ...c,
          estado: "aprobada",
          firma: { por: actor, fecha: new Date().toISOString() },
        }),
        "Nota aprobada y firmada",
        `Firmada por ${actor}`,
      );
      showToast("Nota aprobada y firmada.", "success");
    },
    [mutate, actor, showToast],
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
      getConsultation,
      getPatient,
      addPatient,
      approveNote,
      exportNote,
      markReviewed,
      setCodeStatus,
      addCode,
      updateNote,
      addConsultation,
      resetDemo,
      toast,
      showToast,
    }),
    [
      consultations,
      patients,
      role,
      loading,
      getConsultation,
      getPatient,
      addPatient,
      approveNote,
      exportNote,
      markReviewed,
      setCodeStatus,
      addCode,
      updateNote,
      addConsultation,
      resetDemo,
      toast,
      showToast,
    ],
  );

  if (loading) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center bg-pearl">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    );
  }

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
