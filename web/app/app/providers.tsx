"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  consultations as seedConsultations,
  doctors,
  type ClinicalCode,
  type CodeStatus,
  type Consultation,
  type ConsultationStatus,
  type Role,
} from "@/lib/mock";

const STORAGE_KEY = "miracle-store-v2";

type ToastTone = "success" | "info" | "warning";
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface StoreValue {
  consultations: Consultation[];
  role: Role;
  setRole: (r: Role) => void;
  getConsultation: (id: string) => Consultation | undefined;
  approveNote: (id: string) => void;
  exportNote: (id: string) => void;
  markReviewed: (id: string) => void;
  setCodeStatus: (id: string, codeId: string, estado: CodeStatus) => void;
  addCode: (id: string, code: Omit<ClinicalCode, "id" | "estado">) => void;
  addConsultation: (c: Consultation) => void;
  resetDemo: () => void;
  toast: Toast | null;
  showToast: (message: string, tone?: ToastTone) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function currentUserName(role: Role): string {
  const map: Record<Role, string> = {
    medico: "Dra. Daniela Rincón",
    auditor: "Dr. Mauricio Lozano",
    gerencia: "Dra. Patricia Núñez",
  };
  return map[role] ?? doctors[0].nombre;
}

export function MiracleProvider({ children }: { children: ReactNode }) {
  const [consultations, setConsultations] =
    useState<Consultation[]>(seedConsultations);
  const [role, setRole] = useState<Role>("medico");
  const [toast, setToast] = useState<Toast | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hidratar desde localStorage tras el montaje (evita desajuste SSR).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          consultations?: Consultation[];
          role?: Role;
        };
        if (saved.consultations?.length) setConsultations(saved.consultations);
        if (saved.role) setRole(saved.role);
      }
    } catch {
      /* almacenamiento no disponible */
    }
    setHydrated(true);
  }, []);

  // Persistir cambios.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ consultations, role }));
    } catch {
      /* ignore */
    }
  }, [consultations, role, hydrated]);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now();
    setToast({ id, message, tone });
    setTimeout(() => {
      setToast((t) => (t?.id === id ? null : t));
    }, 3200);
  }, []);

  const patch = useCallback(
    (id: string, fn: (c: Consultation) => Consultation) => {
      setConsultations((list) =>
        list.map((c) => (c.id === id ? fn(c) : c)),
      );
    },
    [],
  );

  const addEvent = useCallback(
    (c: Consultation, accion: string, detalle?: string): Consultation => ({
      ...c,
      auditoria: [
        ...c.auditoria,
        {
          id: `a${c.auditoria.length + 1}-${Date.now()}`,
          fecha: new Date().toISOString(),
          actor: currentUserName(role),
          accion,
          detalle,
        },
      ],
    }),
    [role],
  );

  const setStatus = useCallback(
    (id: string, estado: ConsultationStatus, accion: string, detalle?: string) => {
      patch(id, (c) => addEvent({ ...c, estado }, accion, detalle));
    },
    [patch, addEvent],
  );

  const approveNote = useCallback(
    (id: string) => {
      setStatus(id, "aprobada", "Nota aprobada");
      showToast("Nota aprobada correctamente.", "success");
    },
    [setStatus, showToast],
  );

  const exportNote = useCallback(
    (id: string) => {
      setStatus(id, "exportada", "Nota exportada a HC", "Copiada al sistema de historia clínica.");
      showToast("Nota exportada a la historia clínica.", "success");
    },
    [setStatus, showToast],
  );

  const markReviewed = useCallback(
    (id: string) => {
      setStatus(id, "revisada", "Nota marcada como revisada");
      showToast("Nota marcada como revisada.", "info");
    },
    [setStatus, showToast],
  );

  const setCodeStatus = useCallback(
    (id: string, codeId: string, estado: CodeStatus) => {
      patch(id, (c) => {
        const code = c.codigos.find((k) => k.id === codeId);
        const next = {
          ...c,
          codigos: c.codigos.map((k) =>
            k.id === codeId ? { ...k, estado } : k,
          ),
        };
        if (estado === "aceptado" && code) {
          return addEvent(next, "Código aceptado", `${code.sistema} ${code.codigo}`);
        }
        return next;
      });
    },
    [patch, addEvent],
  );

  const addCode = useCallback(
    (id: string, code: Omit<ClinicalCode, "id" | "estado">) => {
      patch(id, (c) => ({
        ...c,
        codigos: [
          ...c.codigos,
          { ...code, id: `k-${Date.now()}`, estado: "aceptado" },
        ],
      }));
      showToast("Código agregado.", "success");
    },
    [patch, showToast],
  );

  const addConsultation = useCallback((c: Consultation) => {
    setConsultations((list) => [c, ...list]);
  }, []);

  const resetDemo = useCallback(() => {
    setConsultations(seedConsultations);
    setRole("medico");
    showToast("Demo reiniciada.", "info");
  }, [showToast]);

  const getConsultation = useCallback(
    (id: string) => consultations.find((c) => c.id === id),
    [consultations],
  );

  const value = useMemo<StoreValue>(
    () => ({
      consultations,
      role,
      setRole,
      getConsultation,
      approveNote,
      exportNote,
      markReviewed,
      setCodeStatus,
      addCode,
      addConsultation,
      resetDemo,
      toast,
      showToast,
    }),
    [
      consultations,
      role,
      getConsultation,
      approveNote,
      exportNote,
      markReviewed,
      setCodeStatus,
      addCode,
      addConsultation,
      resetDemo,
      toast,
      showToast,
    ],
  );

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
