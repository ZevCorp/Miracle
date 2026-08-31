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
import { X } from "lucide-react";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import { getClinicalEncounter } from "@/lib/api/clinical";
import { transcriptTextToTurns } from "@/lib/clinical/encounter-to-consultation";
import { extractPatientIdentity } from "@/lib/clinical/patient-identity";
import type { AppRole } from "@/lib/auth/roles";
import {
  ORG_SETTINGS_COLUMNS,
  ORG_SETTINGS_VACIOS,
  rowToOrgSettings,
  type OrgSettings,
  type OrgSettingsRow,
} from "@/lib/hospital/org";
import { signConsultationNote } from "@/app/app/consultas/actions";

type ToastTone = "success" | "info" | "warning";
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  /** Se guarda para poder reiniciar la cuenta al soltar el cursor. */
  duracionMs: number;
}

/** Más de tres avisos a la vez tapan la pantalla en vez de informar. */
const TOPE_AVISOS = 3;

/**
 * Una advertencia dura el doble: "No se pudo guardar la nota" no puede
 * desaparecer al mismo ritmo que "Código agregado". Si el médico estaba
 * mirando al paciente, el aviso de fallo tiene que seguir ahí al volver.
 */
const DURACION_MS: Record<ToastTone, number> = {
  success: 3200,
  info: 3200,
  warning: 6500,
};

interface NewPatientInput {
  nombre: string;
  documento?: string;
  edad?: number;
  sexo?: Patient["sexo"];
  eps?: string;
  telefono?: string;
}

/**
 * Adenda a una nota firmada. Las adendas viven en su propia tabla append-only
 * (nunca modifican la nota original) y se cargan bajo demanda en el detalle.
 */
export interface ConsultationAddendum {
  id: string;
  consultationId: string;
  autor: string;
  fecha: string;
  contenido: string;
}

interface StoreValue {
  consultations: Consultation[];
  patients: Patient[];
  role: Role;
  /** Cuenta de demostración comercial: ver canAccessPath en lib/auth/roles.ts. */
  isDemo: boolean;
  /**
   * personal = consultorio de una persona (B2C); institution = hospital (B2B).
   * Lo necesitan pantallas de cliente para decidir qué es propio de una
   * institución, como el rótulo (número de caso de laboratorio).
   */
  orgKind: "personal" | "institution" | null;
  /** División de cuenta (p. ej. "patologia"): decide qué secciones existen. */
  professionalType: string | null;
  /**
   * Ajustes de la institución (nombre, NIT, sede, servicios…).
   *
   * Viven en el store porque los necesitan pantallas de cliente: el encabezado
   * de la nota impresa y el servicio con el que nacen las consultas. Cualquier
   * miembro los puede leer por RLS ("members read own org"); escribirlos es
   * solo del admin, y eso pasa por la server action de Configuración.
   */
  org: OrgSettings;
  loading: boolean;
  /** true si la carga inicial falló: las listas están vacías por error, no porque no haya datos. */
  loadError: boolean;
  /** Vuelve a intentar la carga inicial. */
  retryLoad: () => void;
  /** true mientras haya escrituras pendientes de sincronizar con el servidor. */
  syncing: boolean;
  /** Carga bajo demanda la transcripción de una consulta (no viene en la carga inicial). */
  ensureTranscript: (id: string) => Promise<void>;
  /** Consultas cuya transcripción falló al leerse (≠ "no tiene transcripción"). */
  transcriptFailed: Record<string, true>;
  getConsultation: (id: string) => Consultation | undefined;
  /**
   * Trae UNA consulta que no está en el store (el cap de la carga inicial es
   * de 300, y las páginas profundas de /app/notas viven fuera de él). No la
   * mete al estado global —el cap existe por memoria—: el que la pida se
   * encarga de recordarla. Sin auditoría: el panel rápido no la muestra.
   */
  fetchConsultation: (id: string) => Promise<Consultation | undefined>;
  getPatient: (id: string | null | undefined) => Patient | undefined;
  getMedicoName: (id: string) => string | undefined;
  /** Cédula y registro médico del profesional — para el PDF y "Copiar nota"
   *  (la secretaria los necesita al llenar el sistema del hospital).
   *  honorific/responsableLabel solo existen para las cuentas a las que se
   *  les cargó el bloque de pie de página al estilo del sistema del
   *  hospital — no se derivan de full_name, así que la mayoría de
   *  profesionales los tendrá en null. */
  getMedicoIdentity: (id: string) =>
    | {
        identificationNumber: string | null;
        professionalRegistration: string | null;
        honorific: string | null;
        responsableLabel: string | null;
      }
    | undefined;
  addPatient: (patient: string | NewPatientInput) => Patient;
  /** Como addPatient, pero espera la confirmación de Supabase antes de resolver. */
  addPatientAsync: (
    patient: NewPatientInput,
  ) => Promise<{ ok: boolean; patient: Patient }>;
  approveNote: (id: string) => void;
  /** Como approveNote pero devuelve el desenlace y sin toasts (firma en serie). */
  approveNoteAsync: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Registro MANUAL de la secretaria: marca la consulta como exportada sin
   * enviar nada al HIS. La exportación automática vive en `useNoteExport`.
   */
  markExportedManually: (id: string) => void;
  /** Aplica en memoria un estado que el servidor ya confirmó (solo aprobada→exportada). */
  applyServerConsultationEstado: (id: string, estado: string) => void;
  markReviewed: (id: string) => void;
  setCodeStatus: (id: string, codeId: string, estado: CodeStatus) => void;
  addCode: (id: string, code: Omit<ClinicalCode, "id" | "estado">) => void;
  updateNote: (id: string, sectionId: string, next: Partial<NoteSection>) => void;
  addConsultation: (c: Consultation) => void;
  /**
   * Inserta o actualiza (por id) una consulta. Lo usa el puente del backend
   * clínico: al completar un encounter, su nota se espeja aquí para que aparezca
   * en el historial y pueda firmarse/exportarse. Idempotente por id.
   *
   * Una fila existente se actualiza de forma PARCIAL, sin tocar `estado` ni
   * `firma`: una nota firmada es inmutable (el trigger de la BD lo refuerza) y
   * el puente nunca puede degradarla a borrador ni borrar la firma. Resuelve
   * solo cuando Supabase confirmó la escritura.
   */
  upsertConsultation: (c: Consultation) => Promise<{ ok: boolean }>;
  /** Adendas de una nota firmada (bajo demanda; no viven en Consultation).
   *  `null` = no se pudo leer, que NO es lo mismo que "no tiene". */
  listAddenda: (consultationId: string) => Promise<ConsultationAddendum[] | null>;
  addAddendum: (
    consultationId: string,
    contenido: string,
  ) => Promise<{ ok: boolean; addendum?: ConsultationAddendum }>;
  resetDemo: () => void;
  toasts: Toast[];
  showToast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: number) => void;
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
    // Copias que la base extrae de la nota. Se traen para que las tarjetas no
    // tengan que volver a buscar el nombre dentro del JSON de la nota.
    pacienteNombre: r.paciente_nombre ?? null,
    pacienteDocumento: r.paciente_documento ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function MiracleProvider({
  children,
  role,
  userName,
  isDemo = false,
  orgKind = null,
  professionalType = null,
}: {
  children: ReactNode;
  role: AppRole;
  userName?: string;
  isDemo?: boolean;
  orgKind?: "personal" | "institution" | null;
  professionalType?: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  // El actor de auditoría es siempre el usuario real; nunca un nombre ficticio.
  const actor = userName?.trim() || "Profesional de salud";

  const [patients, setPatients] = useState<Patient[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [medicos, setMedicos] = useState<Record<string, string>>({});
  const [medicoIdentity, setMedicoIdentity] = useState<
    Record<
      string,
      {
        identificationNumber: string | null;
        professionalRegistration: string | null;
        honorific: string | null;
        responsableLabel: string | null;
      }
    >
  >({});
  const [org, setOrg] = useState<OrgSettings>(ORG_SETTINGS_VACIOS);
  const [loading, setLoading] = useState(true);
  // Si la carga inicial falla, el store se queda con listas vacías — y sin esta
  // bandera el panel diría "Estás al día" cuando en realidad no pudo leer nada.
  const [loadError, setLoadError] = useState(false);
  // Consultas cuya transcripción no se pudo leer. Sin esto, un fallo de red se
  // mostraba como "esta consulta no tiene transcripción", que es afirmar algo
  // falso sobre la evidencia de la que se derivó una nota clínica.
  const [transcriptFailed, setTranscriptFailed] = useState<Record<string, true>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Ids de un contador, no de Date.now(): dos avisos en el mismo milisegundo
  // (guardar + confirmar) colisionaban y uno cerraba al otro.
  const idAvisoRef = useRef(0);
  const temporizadoresRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const consultationsRef = useRef<Consultation[]>([]);
  useEffect(() => {
    consultationsRef.current = consultations;
  }, [consultations]);

  const dismissToast = useCallback((id: number) => {
    const pendiente = temporizadoresRef.current.get(id);
    if (pendiente) {
      clearTimeout(pendiente);
      temporizadoresRef.current.delete(id);
    }
    setToasts((lista) => lista.filter((t) => t.id !== id));
  }, []);

  const programarCierre = useCallback(
    (id: number, ms: number) => {
      const pendiente = temporizadoresRef.current.get(id);
      if (pendiente) clearTimeout(pendiente);
      temporizadoresRef.current.set(id, setTimeout(() => dismissToast(id), ms));
    },
    [dismissToast],
  );

  const pausarCierre = useCallback((id: number) => {
    const pendiente = temporizadoresRef.current.get(id);
    if (pendiente) {
      clearTimeout(pendiente);
      temporizadoresRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = (idAvisoRef.current += 1);
      const duracionMs = DURACION_MS[tone];
      // Se APILAN: antes había una sola ranura y un aviso nuevo borraba al
      // anterior, así que un éxito podía tapar una advertencia sin que nadie
      // la leyera.
      setToasts((lista) => {
        const siguiente = [...lista, { id, message, tone, duracionMs }];
        return siguiente.slice(-TOPE_AVISOS);
      });
      programarCierre(id, duracionMs);
    },
    [programarCierre],
  );

  useEffect(() => {
    const temporizadores = temporizadoresRef.current;
    return () => {
      for (const t of temporizadores.values()) clearTimeout(t);
      temporizadores.clear();
    };
  }, []);

  // ---- Carga inicial desde Supabase ----------------------------------------
  // Columnas explícitas: `transcript` (el campo más pesado) se carga bajo
  // demanda con ensureTranscript; los perfiles no exponen el email al cliente.
  const load = useCallback(async () => {
    const [patRes, conRes, profRes, orgRes] = await Promise.all([
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
          "id, patient_id, medico_id, servicio, especialidad, tipo, estado, fecha, duracion_min, plantilla, motivo, note, resumen, codigos, firma, paciente_nombre, paciente_documento",
        )
        .order("fecha", { ascending: false })
        .limit(CONSULTATIONS_CAP),
      supabase
        .from("profiles")
        .select(
          "id, full_name, identification_number, professional_registration, honorific, responsable_label",
        ),
      // Ajustes de la institución. Por RLS ("members read own org") esta consulta
      // devuelve una sola fila: la organización del usuario.
      supabase.from("organizations").select(ORG_SETTINGS_COLUMNS).maybeSingle(),
    ]);

    setOrg(rowToOrgSettings((orgRes.data ?? null) as OrgSettingsRow | null));

    const med: Record<string, string> = {};
    const ident: typeof medicoIdentity = {};
    for (const p of profRes.data ?? []) {
      med[p.id] = p.full_name || "Médico";
      ident[p.id] = {
        identificationNumber: p.identification_number,
        professionalRegistration: p.professional_registration,
        honorific: p.honorific,
        responsableLabel: p.responsable_label,
      };
    }
    setMedicos(med);
    setMedicoIdentity(ident);

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

  const retryLoad = useCallback(() => {
    setLoadError(false);
    setLoading(true);
    void load().catch((e) => {
      console.error("[store] reintento de carga falló", e);
      setLoadError(true);
      setLoading(false);
    });
  }, [load]);

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
        if (!ignore) setLoadError(false);
      } catch (e) {
        console.error("[store] carga inicial falló", e);
        if (!ignore) {
          setLoadError(true);
          setLoading(false);
        }
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
        setTranscriptFailed((m) => ({ ...m, [id]: true }));
        return;
      }
      setTranscriptFailed((m) => {
        if (!m[id]) return m;
        const resto = { ...m };
        delete resto[id];
        return resto;
      });
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

  // Variante awaitable: para flujos que encadenan acciones sobre el paciente
  // recién creado (p. ej. asociarlo a un encounter) y necesitan saber que el
  // insert quedó confirmado antes de continuar.
  const addPatientAsync = useCallback(
    async (
      input: NewPatientInput,
    ): Promise<{ ok: boolean; patient: Patient }> => {
      const nuevo: Patient = {
        id: uuid(),
        nombre: input.nombre.trim(),
        documento: input.documento?.trim() || "Por registrar",
        edad: input.edad && input.edad > 0 ? input.edad : 0,
        sexo: input.sexo ?? null,
        eps: input.eps?.trim() || "Por registrar",
        telefono: input.telefono?.trim() || "—",
        antecedentes: [],
        alergias: [],
        medicamentos: [],
      };
      setPatients((list) => [nuevo, ...list]);
      const { error } = await supabase.from("patients").insert({
        id: nuevo.id,
        nombre: nuevo.nombre,
        documento: input.documento?.trim() || null,
        edad: nuevo.edad > 0 ? nuevo.edad : null,
        sexo: nuevo.sexo ?? null,
        eps: input.eps?.trim() || null,
        telefono: input.telefono?.trim() || null,
      });
      if (error) {
        console.error("[store] insert paciente", error.message);
        showToast("No se pudo guardar el paciente. Intenta de nuevo.", "warning");
        return { ok: false, patient: nuevo };
      }
      return { ok: true, patient: nuevo };
    },
    [supabase, showToast],
  );

  // ---- Consultas ------------------------------------------------------------
  const fetchConsultation = useCallback(
    async (id: string): Promise<Consultation | undefined> => {
      const { data, error } = await supabase
        .from("consultations")
        .select(
          "id, patient_id, medico_id, servicio, especialidad, tipo, estado, fecha, duracion_min, plantilla, motivo, note, resumen, codigos, firma, paciente_nombre, paciente_documento",
        )
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return undefined;
      return rowToConsultation(data, []);
    },
    [supabase],
  );

  const getConsultation = useCallback(
    (id: string) => consultations.find((c) => c.id === id),
    [consultations],
  );

  const getMedicoName = useCallback((id: string) => medicos[id], [medicos]);
  const getMedicoIdentity = useCallback(
    (id: string) => medicoIdentity[id],
    [medicoIdentity],
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

  // Puente del backend clínico: espeja un encounter completado como consulta.
  //
  // Desde 2026-08-01 el SERVIDOR es quien publica la fila (ConsultationMirror
  // en el backend Graph), porque cuando esto vivía solo aquí bastaba cerrar la
  // pestaña para que la nota quedara huérfana: existía en el backend pero no
  // aparecía en el historial, sin error ni aviso (24 consultas así). Esta
  // función se conserva como RED DE SEGURIDAD —si el servidor no pudo publicar,
  // por ejemplo un médico sin organización, aquí se crea igual— y como la vía
  // para refrescar lo que solo el navegador sabe: paciente y nota rehidratada.
  //
  // Idempotente por id para que re-guardar la nota no duplique filas; registra
  // la auditoría solo en la primera creación. Filas existentes se actualizan
  // en PARCIAL (sin estado ni firma): el puente nunca degrada una nota firmada.
  // El reparto completo de quién manda sobre cada dato está en
  // Backend Miracle/Graph/docs/consultation-data-ownership.md
  const upsertConsultation = useCallback(
    async (c: Consultation): Promise<{ ok: boolean }> => {
      const existing = consultationsRef.current.find((x) => x.id === c.id);
      if (
        existing &&
        (existing.estado === "aprobada" || existing.estado === "exportada")
      ) {
        showToast(
          "Esta nota ya está firmada. Los cambios van como adenda.",
          "warning",
        );
        return { ok: false };
      }

      // La identidad se recalcula desde la nota con la MISMA función que
      // reproduce el trigger de la base, para que la fila local y la de
      // Supabase digan lo mismo sin esperar a una recarga. Cualquier edición de
      // la nota (asistente, laboratorio, corrección a mano) pasa por aquí.
      const identidad = extractPatientIdentity(c.note);
      c = {
        ...c,
        pacienteNombre: identidad.nombre ?? null,
        pacienteDocumento: identidad.documento ?? null,
      };

      const isNew = !existing;
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
          : // Preserva estado, firma y auditoría existentes: el puente solo
            // actualiza el contenido de la nota.
            list.map((x) =>
              x.id === c.id
                ? { ...c, estado: x.estado, firma: x.firma, auditoria: x.auditoria }
                : x,
            ),
      );

      if (isNew) {
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
          return { ok: false };
        }
        if (audit) {
          await supabase.from("audit_events").insert({
            consultation_id: c.id,
            actor_name: audit.actor,
            accion: audit.accion,
            detalle: audit.detalle,
          });
        }
        return { ok: true };
      }

      const { data, error } = await supabase
        .from("consultations")
        .update({
          patient_id: c.pacienteId || null,
          servicio: c.servicio,
          especialidad: c.especialidad,
          tipo: c.tipo,
          motivo: c.motivo,
          fecha: c.fecha,
          duracion_min: c.duracionMin,
          plantilla: c.plantilla,
          resumen: c.resumen,
          note: c.note,
          codigos: c.codigos,
          transcript: c.transcript,
        })
        .eq("id", c.id)
        .select("id");
      if (error || !data?.length) {
        console.error("[store] update consulta (puente)", error?.message);
        showToast(
          "La nota se generó, pero no se pudo guardar en tu historial. Reintenta.",
          "warning",
        );
        return { ok: false };
      }
      return { ok: true };
    },
    [supabase, actor, showToast],
  );

  const listAddenda = useCallback(
    async (consultationId: string): Promise<ConsultationAddendum[] | null> => {
      const { data, error } = await supabase
        .from("consultation_addenda")
        .select("id, consultation_id, author_name, contenido, created_at")
        .eq("consultation_id", consultationId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("[store] listar adendas", error.message);
        // null, NO lista vacía: devolver [] hacía que la pantalla afirmara
        // "esta nota no tiene adendas" sobre un documento clínico firmado
        // cuando lo único cierto es que no se pudo leer.
        return null;
      }
      return (data ?? []).map((r) => ({
        id: r.id,
        consultationId: r.consultation_id,
        autor: r.author_name,
        fecha: r.created_at,
        contenido: r.contenido,
      }));
    },
    [supabase],
  );

  const addAddendum = useCallback(
    async (
      consultationId: string,
      contenido: string,
    ): Promise<{ ok: boolean; addendum?: ConsultationAddendum }> => {
      const texto = contenido.trim();
      if (!texto) return { ok: false };
      const { data, error } = await supabase
        .from("consultation_addenda")
        .insert({
          consultation_id: consultationId,
          author_name: actor,
          contenido: texto,
        })
        .select("id, consultation_id, author_name, contenido, created_at")
        .single();
      if (error || !data) {
        console.error("[store] adenda", error?.message);
        showToast("No se pudo guardar la adenda. Intenta de nuevo.", "warning");
        return { ok: false };
      }
      // El detalle de auditoría no incluye contenido clínico, solo el hecho.
      remoteAudit(consultationId, "Adenda agregada", `Adenda de ${actor}.`);
      setConsultations((list) =>
        list.map((c) =>
          c.id === consultationId
            ? {
                ...c,
                auditoria: [
                  ...c.auditoria,
                  {
                    id: `a-${uuid()}`,
                    fecha: data.created_at,
                    actor,
                    accion: "Adenda agregada",
                    detalle: `Adenda de ${actor}.`,
                  },
                ],
              }
            : c,
        ),
      );
      showToast("Adenda agregada.", "success");
      return {
        ok: true,
        addendum: {
          id: data.id,
          consultationId: data.consultation_id,
          autor: data.author_name,
          fecha: data.created_at,
          contenido: data.contenido,
        },
      };
    },
    [supabase, actor, remoteAudit, showToast],
  );

  // La firma se hace en el servidor (valida sesión, estado y deja hash del
  // contenido en auditoría); aquí solo se refleja el resultado en el estado.
  //
  // La variante async devuelve el resultado y NO muestra toasts: la sesión de
  // firma en serie necesita saber nota a nota qué pasó y contar el desenlace
  // ella misma (un toast por nota en una tanda de diez sería una lluvia).
  const approveNoteAsync = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      const result = await signConsultationNote(id);
      if (!result.ok || !result.firma) {
        return { ok: false, error: result.error ?? "No se pudo firmar la nota." };
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
      return { ok: true };
    },
    [],
  );

  const approveNote = useCallback(
    (id: string) => {
      void approveNoteAsync(id).then((result) => {
        if (!result.ok) {
          showToast(result.error ?? "No se pudo firmar la nota.", "warning");
          return;
        }
        showToast("Nota aprobada y firmada.", "success");
      });
    },
    [approveNoteAsync, showToast],
  );

  /**
   * Marca la consulta como exportada SIN enviar nada a la historia clínica.
   *
   * Es el registro manual de la secretaria: ella copia la nota al sistema del
   * hospital a mano y luego deja constancia aquí. No tiene permiso de UPDATE
   * directo sobre `consultations` (ni debe tenerlo: solo puede mover esta
   * transición puntual), así que pasa por una RPC security definer acotada.
   *
   * La exportación AUTOMÁTICA es otra cosa y vive en `useNoteExport`: pide el
   * trabajo a Graph y solo llega a 'exportada' cuando el ejecutor confirma que
   * la nota quedó escrita en el HIS. Este camino no la sustituye ni la simula.
   */
  const markExportedManually = useCallback(
    (id: string) => {
      void (async () => {
        const { error } = await supabase.rpc("secretary_mark_exported", {
          p_consultation_id: id,
        });
        if (error) {
          showToast("No se pudo marcar como exportada. Intenta de nuevo.", "warning");
          return;
        }
        setConsultations((list) =>
          list.map((c) =>
            c.id === id
              ? {
                  ...c,
                  estado: "exportada" as const,
                  auditoria: [
                    ...c.auditoria,
                    {
                      id: `a-${Date.now()}`,
                      fecha: new Date().toISOString(),
                      actor,
                      accion: "Nota exportada a HC",
                      detalle: "Copiada al sistema de historia clínica.",
                    },
                  ],
                }
              : c,
          ),
        );
        remoteAudit(id, "Nota exportada a HC", "Copiada al sistema de historia clínica.");
        showToast("Marcada como exportada (registro manual).", "success");
      })();
    },
    [showToast, supabase, actor, remoteAudit],
  );

  /**
   * Refleja en memoria el estado de negocio que ya confirmó el servidor.
   *
   * Lo llama el detalle de la consulta cuando Graph reporta que la exportación
   * terminó bien: la transición la hizo la base de datos, aquí solo se pinta.
   * Se ignora cualquier cosa que no sea la transición legal aprobada→exportada,
   * para que esto no pueda usarse como puerta trasera para degradar una nota
   * firmada.
   */
  const applyServerConsultationEstado = useCallback(
    (id: string, estado: string) => {
      if (estado !== "exportada") return;
      setConsultations((list) =>
        list.map((c) => (c.id === id && c.estado === "aprobada"
          ? { ...c, estado: "exportada" as const }
          : c)),
      );
    },
    [],
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
      isDemo,
      orgKind,
      professionalType,
      org,
      loading,
      loadError,
      retryLoad,
      syncing: pendingWrites > 0,
      ensureTranscript,
      transcriptFailed,
      getConsultation,
      fetchConsultation,
      getPatient,
      getMedicoName,
      getMedicoIdentity,
      addPatient,
      addPatientAsync,
      approveNote,
      approveNoteAsync,
      markExportedManually,
      applyServerConsultationEstado,
      markReviewed,
      setCodeStatus,
      addCode,
      updateNote,
      addConsultation,
      upsertConsultation,
      listAddenda,
      addAddendum,
      resetDemo,
      toasts,
      showToast,
      dismissToast,
    }),
    [
      consultations,
      patients,
      role,
      isDemo,
      orgKind,
      professionalType,
      org,
      loading,
      loadError,
      retryLoad,
      pendingWrites,
      ensureTranscript,
      transcriptFailed,
      getConsultation,
      fetchConsultation,
      getPatient,
      getMedicoName,
      getMedicoIdentity,
      addPatient,
      addPatientAsync,
      approveNote,
      approveNoteAsync,
      markExportedManually,
      applyServerConsultationEstado,
      markReviewed,
      setCodeStatus,
      addCode,
      updateNote,
      addConsultation,
      upsertConsultation,
      listAddenda,
      addAddendum,
      resetDemo,
      toasts,
      showToast,
      dismissToast,
    ],
  );

  // Sin puerta de carga global: cada página decide su propio skeleton con
  // `loading`, y la navegación queda usable desde el primer render.
  return (
    <StoreContext.Provider value={value}>
      <ConfirmProvider>{children}</ConfirmProvider>
      <ToastHost
        toasts={toasts}
        onDismiss={dismissToast}
        onPause={pausarCierre}
        onResume={(t) => programarCierre(t.id, t.duracionMs)}
      />
    </StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de MiracleProvider");
  return ctx;
}

const TONO_AVISO: Record<ToastTone, string> = {
  success: "border-success/30 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  info: "border-accent/30 bg-accent-soft text-accent-ink",
};

/**
 * Los avisos de la app.
 *
 * El contenedor está SIEMPRE montado, aunque no haya nada que decir: antes el
 * nodo con `aria-live` nacía junto a su texto, y un lector de pantalla que ve
 * aparecer la región y el contenido a la vez suele no anunciar nada.
 *
 * La posición libra la barra de navegación inferior del móvil (que ocupa unos
 * 62px más el área segura): antes el aviso se pintaba encima de ella y tapaba
 * los iconos justo cuando el médico acababa de hacer algo.
 */
function ToastHost({
  toasts,
  onDismiss,
  onPause,
  onResume,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
  onPause: (id: number) => void;
  onResume: (toast: Toast) => void;
}) {
  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notificaciones"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          // Al apuntar con el cursor se detiene la cuenta: leer un aviso no
          // debería ser una carrera contra el reloj.
          onMouseEnter={() => onPause(t.id)}
          onMouseLeave={() => onResume(t)}
          className={`preview-in pointer-events-auto flex max-w-[min(30rem,100%)] items-center gap-3 rounded-full border py-2.5 pl-5 pr-2.5 text-sm font-semibold shadow-[var(--shadow-lg)] ${TONO_AVISO[t.tone]}`}
        >
          <span className="min-w-0">{t.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Cerrar aviso"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-current opacity-60 transition-opacity hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
