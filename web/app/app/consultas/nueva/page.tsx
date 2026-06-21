"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  FileAudio,
  Monitor,
  Search,
  Video,
} from "lucide-react";
import {
  patients,
  templates,
  type ConsultationType,
} from "@/lib/mock";

const tipos: { id: ConsultationType; label: string; icon: typeof Monitor }[] = [
  { id: "presencial", label: "Presencial", icon: Monitor },
  { id: "telemedicina", label: "Telemedicina", icon: Video },
  { id: "audio", label: "Subir audio", icon: FileAudio },
];

const inputClass =
  "w-full rounded-md border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent";

export default function NuevaConsultaPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<ConsultationType>("presencial");
  const [plantillaId, setPlantillaId] = useState(templates[0].id);
  const [consent, setConsent] = useState(false);

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients.slice(0, 4);
    return patients.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.documento.toLowerCase().includes(q),
    );
  }, [query]);

  const plantilla = templates.find((t) => t.id === plantillaId)!;
  const paciente = patients.find((p) => p.id === pacienteId);
  const puedeIniciar = Boolean(pacienteId && consent);

  function empezar() {
    if (!puedeIniciar) return;
    const sp = new URLSearchParams({
      paciente: pacienteId!,
      tipo,
      plantilla: plantillaId,
    });
    router.push(`/app/consultas/en-vivo?${sp.toString()}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-deep">Nueva consulta</h1>
      <p className="mt-1 text-sm text-muted">
        Seleccione el paciente, el tipo de consulta y la plantilla antes de
        iniciar la captura.
      </p>

      <div className="mt-6 space-y-6">
        {/* Paciente */}
        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-display text-base font-semibold text-deep">
            1 · Paciente
          </h2>
          <div className="mt-3 flex items-center gap-2 rounded-md border border-line px-3 py-2">
            <Search size={16} className="text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o documento…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {resultados.map((p) => {
              const active = p.id === pacienteId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPacienteId(p.id)}
                  className={`flex items-center justify-between rounded-md border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-accent bg-accent-soft"
                      : "border-line hover:border-mist"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-medium text-deep">
                      {p.nombre}
                    </span>
                    <span className="block text-xs text-muted">
                      {p.edad} años · {p.documento}
                    </span>
                  </span>
                  {active ? <Check size={16} className="text-accent" /> : null}
                </button>
              );
            })}
          </div>
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
            value={plantillaId}
            onChange={(e) => setPlantillaId(e.target.value)}
            className={`${inputClass} mt-3`}
          >
            {templates.map((t) => (
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

        {/* Consentimiento */}
        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-display text-base font-semibold text-deep">
            4 · Consentimiento
          </h2>
          <label className="mt-3 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
            />
            <span className="text-sm text-ink-soft">
              El paciente otorgó su consentimiento informado para el uso de
              asistencia de documentación clínica con IA.
            </span>
          </label>
        </section>

        {/* Acción */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {paciente
              ? `Listo para iniciar con ${paciente.nombre}.`
              : "Seleccione un paciente para continuar."}
          </p>
          <button
            type="button"
            disabled={!puedeIniciar}
            onClick={empezar}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Empezar consulta <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
