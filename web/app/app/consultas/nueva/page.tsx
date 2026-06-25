"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  FileAudio,
  Monitor,
  Search,
  UserPlus,
  Video,
  X,
} from "lucide-react";
import { useStore } from "@/app/app/providers";
import { templates as catalogTemplates, type ConsultationType, type Template } from "@/lib/mock";
import { createClient } from "@/lib/supabase/client";
import {
  customTemplateSelect,
  customTemplateToTemplate,
  type CustomClinicalTemplateRow,
} from "@/lib/templates/custom";

const tipos: { id: ConsultationType; label: string; icon: typeof Monitor }[] = [
  { id: "presencial", label: "Presencial", icon: Monitor },
  { id: "telemedicina", label: "Telemedicina", icon: Video },
  { id: "audio", label: "Subir audio", icon: FileAudio },
];

const inputClass =
  "w-full rounded-md border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent";

export default function NuevaConsultaPage() {
  const router = useRouter();
  const { patients, addPatient, getPatient } = useStore();

  const [query, setQuery] = useState("");
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<ConsultationType>("presencial");
  const [plantillaId, setPlantillaId] = useState(catalogTemplates[0].id);
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [profileSpecialtyCode, setProfileSpecialtyCode] = useState("medicina-general");
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientDocument, setNewPatientDocument] = useState("");
  const [newPatientAge, setNewPatientAge] = useState("");
  const [newPatientSex, setNewPatientSex] = useState<"F" | "M">("F");

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
      const supabase = createClient();
      const [userResult, templatesResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("clinical_templates")
          .select(customTemplateSelect)
          .order("updated_at", { ascending: false }),
      ]);

      if (ignore) return;

      const userId = userResult.data.user?.id;
      if (userId) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("specialty_code")
          .eq("id", userId)
          .maybeSingle();

        if (!ignore && !profileError && profile?.specialty_code) {
          setProfileSpecialtyCode(profile.specialty_code);
        }
      }

      if (templatesResult.error) {
        console.error("[consultas/nueva] custom templates failed", {
          code: templatesResult.error.code,
          message: templatesResult.error.message,
          details: templatesResult.error.details,
          hint: templatesResult.error.hint,
        });
        return;
      }

      setCustomTemplates(
        ((templatesResult.data ?? []) as CustomClinicalTemplateRow[]).map(
          customTemplateToTemplate,
        ),
      );
    }

    loadTemplateContext();

    return () => {
      ignore = true;
    };
  }, []);

  const institutionalTemplates = useMemo(
    () =>
      catalogTemplates.filter(
        (template) => template.especialidadCode === profileSpecialtyCode,
      ),
    [profileSpecialtyCode],
  );
  const availableTemplates = useMemo(
    () => [...customTemplates, ...institutionalTemplates],
    [customTemplates, institutionalTemplates],
  );
  const selectedTemplateId = availableTemplates.some((template) => template.id === plantillaId)
    ? plantillaId
    : (availableTemplates[0]?.id ?? "");
  const plantilla =
    availableTemplates.find((template) => template.id === selectedTemplateId) ??
    availableTemplates[0];
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
      sexo: newPatientSex,
    });

    elegir(p.id, p.nombre);
    setNewPatientName("");
    setNewPatientDocument("");
    setNewPatientAge("");
    setNewPatientSex("F");
    setShowNewPatient(false);
  }

  function limpiar() {
    setPacienteId(null);
    setQuery("");
  }

  function empezar() {
    const sp = new URLSearchParams({ tipo, plantilla: selectedTemplateId });
    sp.set("plantillaNombre", plantilla.nombre);
    sp.set("plantillaEspecialidad", plantilla.especialidad);
    if (pacienteId) sp.set("paciente", pacienteId);
    router.push(`/app/consultas/en-vivo?${sp.toString()}`);
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
        <section className="rounded-lg border border-line bg-white p-5">
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
                <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-white p-1.5 shadow-[var(--shadow-lg)]">
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
                    onChange={(event) => setNewPatientSex(event.target.value as "F" | "M")}
                    className={`${inputClass} mt-1.5`}
                  >
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
        <section className="rounded-lg border border-line bg-white p-5">
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
                  onClick={() => setTipo(t.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-md border px-3 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line text-ink-soft hover:border-mist"
                  }`}
                >
                  <Icon size={18} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Plantilla */}
        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-display text-base font-semibold text-deep">
            3 · Plantilla de nota
          </h2>
          <select
            value={selectedTemplateId}
            onChange={(e) => setPlantillaId(e.target.value)}
            className={`${inputClass} mt-3`}
          >
            {availableTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} — {t.especialidad}
              </option>
            ))}
          </select>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {plantilla.secciones.map((s) => (
              <span
                key={s}
                className="rounded-full bg-ice px-2.5 py-1 text-xs text-ink-soft"
              >
                {s}
              </span>
            ))}
          </div>
        </section>

        {/* Acción */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {seleccionado
              ? `Listo para iniciar con ${seleccionado.nombre}.`
              : "Puede iniciar sin paciente identificado."}
          </p>
          <button
            type="button"
            onClick={empezar}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Empezar consulta <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
