"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  FileAudio,
  Loader2,
  Monitor,
  Search,
  UserPlus,
  Video,
  X,
} from "lucide-react";
import { useStore } from "@/app/app/providers";
import type { ConsultationType } from "@/lib/mock";
import { createClient } from "@/lib/supabase/client";
import {
  createClinicalEncounter,
  friendlyClinicalMessage,
  getClinicalTemplates,
  normalizeSpecialtyCode,
  sortedTemplateSections,
  toBackendConsultationType,
  type ClinicalTemplate,
} from "@/lib/api/clinical";

const tipos: {
  id: ConsultationType;
  label: string;
  icon: typeof Monitor;
  disabled?: boolean;
}[] = [
  { id: "presencial", label: "Presencial", icon: Monitor },
  { id: "telemedicina", label: "Telemedicina", icon: Video },
  // "Subir audio" queda deshabilitado hasta que exista transcripción real.
  { id: "audio", label: "Subir audio", icon: FileAudio, disabled: true },
];

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent";

function NuevaConsultaForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { patients, addPatient, getPatient } = useStore();

  // Prellenado desde la agenda ("Iniciar consulta" en una cita del día).
  const [query, setQuery] = useState(() => sp.get("nombre")?.trim() ?? "");
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<ConsultationType>("presencial");
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientDocument, setNewPatientDocument] = useState("");
  const [newPatientAge, setNewPatientAge] = useState("");
  // "" = sin registrar: no se inventa un sexo por defecto.
  const [newPatientSex, setNewPatientSex] = useState<"F" | "M" | "">("");

  // Plantillas reales del backend clínico (institucionales + personales).
  const [templates, setTemplates] = useState<ClinicalTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [profileSpecialtyCode, setProfileSpecialtyCode] = useState<string | null>(null);

  // El backend exige consent: true para crear el encounter — siempre se pide.
  const [consentGiven, setConsentGiven] = useState(false);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const seleccionado = getPatient(pacienteId);

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients.slice(0, 6);
    return patients
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.documento.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [query, patients]);

  useEffect(() => {
    let ignore = false;

    async function loadTemplateContext() {
      setTemplatesLoading(true);
      setTemplatesError(null);

      // La especialidad del perfil solo se usa para priorizar plantillas; si
      // falla, se muestran todas. El catálogo clínico viene SOLO del backend.
      const supabase = createClient();
      const profilePromise = (async () => {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return null;
        const { data: profile } = await supabase
          .from("profiles")
          .select("specialty_code")
          .eq("id", userId)
          .maybeSingle();
        return profile?.specialty_code ?? null;
      })();

      try {
        const [list, specialtyCode] = await Promise.all([
          getClinicalTemplates(),
          profilePromise.catch(() => null),
        ]);
        if (ignore) return;
        setProfileSpecialtyCode(specialtyCode);
        setTemplates(list);
      } catch (error) {
        if (ignore) return;
        setTemplates([]);
        setTemplatesError(friendlyClinicalMessage(error));
      } finally {
        if (!ignore) setTemplatesLoading(false);
      }
    }

    void loadTemplateContext();

    return () => {
      ignore = true;
    };
  }, []);

  // Personales del médico + institucionales de su especialidad (o todas si el
  // perfil no tiene especialidad registrada o no hay coincidencias).
  const personalTemplates = useMemo(
    () => templates.filter((template) => template.scope === "personal"),
    [templates],
  );
  const institutionalTemplates = useMemo(() => {
    const institutional = templates.filter(
      (template) => template.scope !== "personal",
    );
    if (!profileSpecialtyCode) return institutional;
    const wanted = normalizeSpecialtyCode(profileSpecialtyCode);
    const matching = institutional.filter(
      (template) => normalizeSpecialtyCode(template.specialty) === wanted,
    );
    return matching.length ? matching : institutional;
  }, [templates, profileSpecialtyCode]);

  const availableTemplates = useMemo(
    () => [...personalTemplates, ...institutionalTemplates],
    [personalTemplates, institutionalTemplates],
  );

  // Selección con template.id REAL; si la selección quedó fuera de la lista,
  // cae a la primera institucional (o a la primera disponible).
  const effectiveTemplateId = availableTemplates.some(
    (template) => template.id === selectedTemplateId,
  )
    ? selectedTemplateId
    : (institutionalTemplates[0]?.id ?? availableTemplates[0]?.id ?? "");
  const plantilla = availableTemplates.find(
    (template) => template.id === effectiveTemplateId,
  );
  const plantillaSections = sortedTemplateSections(plantilla?.sections);

  const nombreNuevo = query.trim();
  const existeExacto = patients.some(
    (p) => p.nombre.toLowerCase() === nombreNuevo.toLowerCase(),
  );

  function elegir(id: string, nombre: string) {
    setPacienteId(id);
    setQuery(nombre);
    setOpen(false);
  }

  function crear() {
    if (!nombreNuevo) return;
    const p = addPatient(nombreNuevo);
    elegir(p.id, p.nombre);
  }

  function crearPacienteNuevo() {
    const nombre = newPatientName.trim() || nombreNuevo;
    if (!nombre.trim()) return;

    const edad = Number.parseInt(newPatientAge, 10);
    const p = addPatient({
      nombre,
      documento: newPatientDocument,
      edad: Number.isFinite(edad) ? edad : 0,
      sexo: newPatientSex || undefined,
    });

    elegir(p.id, p.nombre);
    setNewPatientName("");
    setNewPatientDocument("");
    setNewPatientAge("");
    setNewPatientSex("");
    setShowNewPatient(false);
  }

  function limpiar() {
    setPacienteId(null);
    setQuery("");
  }

  const canStart = Boolean(effectiveTemplateId) && consentGiven && !creating;

  async function empezar() {
    if (!canStart) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createClinicalEncounter({
        patient_id: pacienteId ?? null,
        consultation_type: toBackendConsultationType(tipo),
        template_id: effectiveTemplateId,
        consent: true,
      });
      // El encounter_id es la llave de todo el flujo: viaja en la URL para
      // sobrevivir recargas de la pantalla de consulta activa.
      const params = new URLSearchParams({ encounter: result.encounter_id });
      if (pacienteId) params.set("paciente", pacienteId);
      router.push(`/app/consultas/en-vivo?${params.toString()}`);
    } catch (error) {
      setCreateError(friendlyClinicalMessage(error));
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-deep">Nueva consulta</h1>
      <p className="mt-1 text-sm text-muted">
        Inicie la captura. Puede asociar un paciente o crear uno nuevo — o
        hacerlo después.
      </p>

      <div className="mt-6 space-y-6">
        {/* Paciente */}
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="font-display text-base font-semibold text-deep">
            1 · Paciente{" "}
            <span className="font-normal text-muted">(opcional)</span>
          </h2>

          <div className="relative mt-3">
            <div className="flex items-center gap-2 rounded-md border border-line px-3 py-2 focus-within:border-accent">
              <Search size={16} className="text-muted" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPacienteId(null);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                placeholder="Buscar paciente por nombre o documento…"
                aria-label="Buscar paciente por nombre o documento"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
              />
              {seleccionado ? (
                <button
                  type="button"
                  onClick={limpiar}
                  aria-label="Quitar paciente"
                  className="text-muted hover:text-deep"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>

            {open ? (
              <>
                {/* overlay para cerrar al hacer clic afuera */}
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setOpen(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lg)]">
                  {resultados.length ? (
                    <ul className="max-h-64 overflow-auto">
                      {resultados.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => elegir(p.id, p.nombre)}
                            className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-ice-soft"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-deep">
                                {p.nombre}
                              </span>
                              <span className="block truncate text-xs text-muted">
                                {p.edad > 0
                                  ? `${p.edad} años · ${p.documento}`
                                  : "Datos por completar"}
                              </span>
                            </span>
                            {pacienteId === p.id ? (
                              <Check size={16} className="text-accent" />
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-3 py-2 text-sm text-muted">
                      {nombreNuevo
                        ? "Sin coincidencias."
                        : "Escribe un nombre o documento para buscar."}
                    </p>
                  )}

                  {nombreNuevo && !existeExacto ? (
                    <button
                      type="button"
                      onClick={crear}
                      className="mt-1 flex w-full items-center gap-2.5 rounded-lg border border-dashed border-accent/50 bg-accent-soft/40 px-3 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-soft"
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent text-white">
                        <UserPlus size={14} />
                      </span>
                      Crear paciente «{nombreNuevo}»
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                setShowNewPatient((show) => !show);
                if (!newPatientName && nombreNuevo) setNewPatientName(nombreNuevo);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent-soft/40 px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-soft"
            >
              <UserPlus size={16} />
              Añadir paciente nuevo
            </button>
          </div>

          {showNewPatient ? (
            <div className="mt-4 rounded-lg border border-dashed border-accent/40 bg-ice-soft p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-deep sm:col-span-2">
                  Nombre completo
                  <input
                    value={newPatientName}
                    onChange={(event) => setNewPatientName(event.target.value)}
                    className={`${inputClass} mt-1.5`}
                    placeholder="Ej. María Gómez"
                  />
                </label>
                <label className="block text-sm font-medium text-deep">
                  Documento
                  <input
                    value={newPatientDocument}
                    onChange={(event) => setNewPatientDocument(event.target.value)}
                    className={`${inputClass} mt-1.5`}
                    placeholder="Ej. CC 123456789"
                  />
                </label>
                <label className="block text-sm font-medium text-deep">
                  Edad
                  <input
                    value={newPatientAge}
                    onChange={(event) => setNewPatientAge(event.target.value)}
                    className={`${inputClass} mt-1.5`}
                    inputMode="numeric"
                    placeholder="Ej. 42"
                  />
                </label>
                <label className="block text-sm font-medium text-deep">
                  Sexo
                  <select
                    value={newPatientSex}
                    onChange={(event) =>
                      setNewPatientSex(event.target.value as "F" | "M" | "")
                    }
                    className={`${inputClass} mt-1.5`}
                  >
                    <option value="">Sin registrar</option>
                    <option value="F">Femenino</option>
                    <option value="M">Masculino</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPatient(false)}
                  className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-deep hover:border-mist"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={crearPacienteNuevo}
                  disabled={!newPatientName.trim() && !nombreNuevo}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Check size={15} />
                  Crear y seleccionar
                </button>
              </div>
            </div>
          ) : null}

          {seleccionado ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-mint-soft px-3 py-1.5 text-sm font-medium text-success">
              <Check size={15} /> {seleccionado.nombre}
            </div>
          ) : null}
        </section>

        {/* Tipo */}
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="font-display text-base font-semibold text-deep">
            2 · Tipo de consulta
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {tipos.map((t) => {
              const active = t.id === tipo;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={t.disabled}
                  onClick={() => {
                    if (!t.disabled) setTipo(t.id);
                  }}
                  title={t.disabled ? "Próximamente" : undefined}
                  className={`flex flex-col items-center gap-1.5 rounded-md border px-3 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line text-ink-soft hover:border-mist"
                  } ${t.disabled ? "cursor-not-allowed opacity-50 hover:border-line" : ""}`}
                >
                  <Icon size={18} />
                  {t.label}
                  {t.disabled ? (
                    <span className="text-[10px] font-normal text-muted">Próximamente</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        {/* Plantilla */}
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="font-display text-base font-semibold text-deep">
            3 · Plantilla de nota
          </h2>

          {templatesLoading ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
              <Loader2 size={15} className="animate-spin text-accent" />
              Cargando plantillas...
            </p>
          ) : templatesError ? (
            <p
              role="alert"
              className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              No se pudieron cargar las plantillas. {templatesError}
            </p>
          ) : availableTemplates.length === 0 ? (
            <p className="mt-3 rounded-md border border-line bg-pearl px-3 py-2 text-sm text-muted">
              No hay plantillas disponibles. Crea una en «Plantillas» antes de
              iniciar la consulta.
            </p>
          ) : (
            <>
              <select
                value={effectiveTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                aria-label="Plantilla de nota"
                className={`${inputClass} mt-3`}
              >
                {personalTemplates.length ? (
                  <optgroup label="Mis plantillas">
                    {personalTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <optgroup label="Institucionales">
                  {institutionalTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {plantillaSections.map((s) => (
                  <span
                    key={s.key}
                    className="rounded-full bg-ice px-2.5 py-1 text-xs text-ink-soft"
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Acción */}
        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4 text-sm text-deep">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <span>
              Confirmo el <strong>consentimiento del paciente</strong> para registrar y
              procesar la información de esta consulta.
            </span>
          </label>

          {createError ? (
            <p
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              No se pudo iniciar la consulta. {createError}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {!consentGiven
                ? "Debes confirmar el consentimiento."
                : seleccionado
                  ? `Listo para iniciar con ${seleccionado.nombre}.`
                  : "Puede iniciar sin paciente identificado."}
            </p>
            <button
              type="button"
              onClick={() => void empezar()}
              disabled={!canStart}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Creando consulta...
                </>
              ) : (
                <>
                  Empezar consulta <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// useSearchParams exige un límite de Suspense en la página (mismo patrón que en-vivo).
export default function NuevaConsultaPage() {
  return (
    <Suspense fallback={null}>
      <NuevaConsultaForm />
    </Suspense>
  );
}
