"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Pause, ShieldCheck, Sparkles, Square } from "lucide-react";
import {
  templates,
  TYPE_LABEL,
  type ClinicalCode,
  type Consultation,
  type ConsultationType,
  type NoteSection,
  type Patient,
  type SpeakerTurn,
  type Template,
} from "@/lib/mock";
import { useStore } from "@/app/app/providers";
import { Waveform } from "@/components/app/Waveform";
import { PatientHeader } from "@/components/app/PatientHeader";

const SCRIPT: SpeakerTurn[] = [
  { t: "00:04", hablante: "Médico", texto: "Cuénteme, ¿qué la trae hoy a consulta?" },
  { t: "00:09", hablante: "Paciente", texto: "He tenido dolor de cabeza los últimos tres días." },
  { t: "00:18", hablante: "Médico", texto: "¿El dolor es constante? ¿Algo lo mejora o lo empeora?" },
  { t: "00:25", hablante: "Paciente", texto: "Va y viene. Mejora si descanso y empeora con las pantallas." },
  { t: "00:36", hablante: "Médico", texto: "¿Ha tenido fiebre, náuseas o visión borrosa?" },
  { t: "00:41", hablante: "Paciente", texto: "Náuseas leves, lo demás no." },
];

function buildDraft(
  patient: Patient | undefined,
  tipo: ConsultationType,
  plantillaNombre: string,
  segundos: number,
): Consultation {
  const id = `c-${Date.now()}`;
  const note: NoteSection[] = [
    {
      id: "identificacion",
      titulo: "Identificación",
      kind: "texto",
      texto:
        patient && patient.edad > 0
          ? `Paciente ${patient.sexo === "F" ? "femenina" : "masculino"} de ${patient.edad} años.`
          : patient
            ? `Paciente: ${patient.nombre}. Datos demográficos por completar.`
            : "Paciente sin identificar.",
    },
    { id: "motivo", titulo: "Motivo de consulta", kind: "texto", texto: "Cefalea de 3 días de evolución." },
    {
      id: "enfermedad_actual",
      titulo: "Enfermedad actual",
      kind: "texto",
      texto:
        "Cuadro de 3 días de cefalea intermitente, que mejora con el reposo y empeora con la exposición a pantallas, asociada a náuseas leves. Niega fiebre y alteraciones visuales.",
    },
    {
      id: "antecedentes",
      titulo: "Antecedentes",
      kind: "texto",
      texto: patient?.antecedentes.join(". ") ?? "Sin antecedentes relevantes.",
      colapsadaPorDefecto: true,
    },
    { id: "examen_fisico", titulo: "Examen físico", kind: "texto", texto: "Paciente en buenas condiciones generales, sin signos neurológicos focales. Signos vitales por confirmar." },
    { id: "analisis", titulo: "Análisis", kind: "texto", texto: "Cefalea tensional probable, sin signos de alarma neurológicos en el momento." },
    {
      id: "plan",
      titulo: "Plan",
      kind: "lista",
      items: [
        "Analgesia según indicación médica.",
        "Higiene del sueño y pausas de pantalla.",
        "Control si no mejora o aparecen signos de alarma.",
      ],
    },
    {
      id: "recomendaciones",
      titulo: "Recomendaciones",
      kind: "lista",
      items: [
        "Descanse e hidrátese adecuadamente.",
        "Limite el tiempo de exposición a pantallas.",
        "Consulte si el dolor es intenso, súbito o se acompaña de fiebre o vómito.",
      ],
    },
  ];
  const codigos: ClinicalCode[] = [
    { id: "k1", sistema: "CIE-10", codigo: "R51", descripcion: "Cefalea", confianza: 86, estado: "sugerido" },
    { id: "k2", sistema: "CIE-10", codigo: "G44.2", descripcion: "Cefalea de tipo tensional", confianza: 71, estado: "sugerido" },
    { id: "k3", sistema: "CUPS", codigo: "890201", descripcion: "Consulta de primera vez por medicina especializada", confianza: 93, estado: "sugerido" },
  ];
  return {
    id,
    pacienteId: patient?.id ?? "",
    medicoId: "d1",
    servicio: "Consulta externa",
    especialidad: "Medicina interna",
    tipo,
    estado: "borrador",
    fecha: new Date().toISOString(),
    duracionMin: Math.max(1, Math.round(segundos / 60)),
    plantilla: plantillaNombre,
    motivo: "Cefalea de 3 días",
    note,
    transcript: SCRIPT,
    resumen:
      "Paciente que consulta por cefalea intermitente de 3 días, que mejora con reposo y empeora con pantallas, con náuseas leves y sin signos de alarma neurológicos. Se plantea cefalea tensional probable; se indica analgesia, higiene del sueño y control si no hay mejoría.",
    codigos,
    auditoria: [
      {
        id: "a1",
        fecha: new Date().toISOString(),
        actor: "Miracle IA",
        accion: "Nota generada por IA",
        detalle: "A partir de la captura de la consulta.",
      },
    ],
  };
}

function aiToConsultation(
  aiNote: {
    resumen?: string;
    secciones?: { titulo?: string; contenido?: string | string[] }[];
    codigos?: {
      sistema?: string;
      codigo?: string;
      descripcion?: string;
      confianza?: number;
    }[];
  },
  base: Consultation,
): Consultation {
  const secciones: NoteSection[] = (aiNote.secciones ?? []).map((s, i) => {
    const id =
      (s.titulo ?? `seccion-${i}`)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "") || `seccion-${i}`;
    if (Array.isArray(s.contenido)) {
      return {
        id,
        titulo: s.titulo ?? "Sección",
        kind: "lista",
        items: s.contenido.map(String),
      };
    }
    return {
      id,
      titulo: s.titulo ?? "Sección",
      kind: "texto",
      texto: String(s.contenido ?? ""),
    };
  });
  const codigos: ClinicalCode[] = (aiNote.codigos ?? []).map((k, i) => ({
    id: `k-ai-${i}-${Date.now()}`,
    sistema: k.sistema === "CUPS" ? "CUPS" : "CIE-10",
    codigo: String(k.codigo ?? ""),
    descripcion: String(k.descripcion ?? ""),
    confianza: Math.max(0, Math.min(100, Number(k.confianza) || 80)),
    estado: "sugerido",
  }));
  return {
    ...base,
    note: secciones.length ? secciones : base.note,
    resumen: aiNote.resumen ? String(aiNote.resumen) : base.resumen,
    codigos: codigos.length ? codigos : base.codigos,
  };
}

function mmss(s: number) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function EnVivoInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { addConsultation, getPatient } = useStore();

  const pacienteId = sp.get("paciente") ?? "";
  const tipo = (sp.get("tipo") as ConsultationType) ?? "presencial";
  const plantillaId = sp.get("plantilla") ?? templates[0].id;
  const plantillaNombre = sp.get("plantillaNombre");
  const plantillaEspecialidad = sp.get("plantillaEspecialidad");
  const plantilla =
    templates.find((t) => t.id === plantillaId) ??
    ({
      id: plantillaId,
      nombre: plantillaNombre ?? templates[0].nombre,
      especialidad: plantillaEspecialidad ?? "Plantilla personalizada",
      creadaPor: "Tú",
      source: "personal",
      secciones: [],
      actualizada: new Date().toISOString(),
    } satisfies Template);
  const patient = useMemo(() => getPatient(pacienteId), [getPatient, pacienteId]);

  const [seconds, setSeconds] = useState(0);
  const [revealed, setRevealed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (paused || generating) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    const r = setInterval(
      () => setRevealed((n) => Math.min(n + 1, SCRIPT.length)),
      2600,
    );
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, [paused, generating]);

  async function finalizar() {
    setGenerating(true);
    const base = buildDraft(patient, tipo, plantilla.nombre, seconds);
    let final = base;
    try {
      const res = await fetch("/api/generate-note", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript: SCRIPT,
          plantillaNombre: plantilla.nombre,
          secciones: plantilla.secciones,
          paciente: patient
            ? { nombre: patient.nombre, edad: patient.edad, sexo: patient.sexo }
            : null,
        }),
      });
      const data = await res.json();
      if (data?.connected && data.note) {
        final = aiToConsultation(data.note, base);
      }
    } catch {
      /* sin conexión: se usa el borrador base */
    }
    addConsultation(final);
    router.push(`/app/consultas/${final.id}`);
  }

  if (generating) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <Loader2 size={40} className="animate-spin text-accent" />
        <h1 className="mt-4 text-xl font-semibold text-deep">
          Generando la nota clínica…
        </h1>
        <p className="mt-1 text-sm text-muted">
          Miracle está estructurando la consulta y sugiriendo códigos.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Captura */}
        <div className="rounded-lg border border-line bg-surface p-6">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-danger/10 px-3 py-1.5 text-sm font-semibold text-danger">
              <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
              {paused ? "En pausa" : "Grabando"} · {mmss(seconds)}
            </span>
            <span className="text-xs text-muted">{TYPE_LABEL[tipo]}</span>
          </div>

          <div className="mt-5 rounded-md bg-pearl p-4">
            <Waveform active={!paused} />
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-muted">
            <span>Nivel de micrófono</span>
            <span className="flex items-center gap-1">
              {[0.4, 0.7, 1, 0.6, 0.85].map((h, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-success"
                  style={{
                    height: `${8 + h * 10}px`,
                    opacity: paused ? 0.3 : 1,
                  }}
                />
              ))}
            </span>
          </div>

          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Transcripción en vivo
            </div>
            <div className="mt-3 space-y-3">
              {SCRIPT.slice(0, revealed).map((turn, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="w-11 shrink-0 pt-0.5 font-mono text-xs text-muted">
                    {turn.t}
                  </span>
                  <div>
                    <span
                      className={`mr-2 text-xs font-semibold ${
                        turn.hablante === "Médico" ? "text-accent" : "text-success"
                      }`}
                    >
                      {turn.hablante}
                    </span>
                    <span className="text-ink">{turn.texto}</span>
                  </div>
                </div>
              ))}
              {revealed < SCRIPT.length ? (
                <div className="flex items-center gap-2 pl-14 text-xs text-muted">
                  <Sparkles size={13} className="text-accent" /> escuchando…
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-deep hover:border-mist"
            >
              <Pause size={16} /> {paused ? "Reanudar" : "Pausar"}
            </button>
            <button
              type="button"
              onClick={finalizar}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              <Square size={15} /> Finalizar y generar
            </button>
          </div>
        </div>

        {/* Paciente */}
        <aside className="h-fit space-y-4">
          <div className="rounded-lg border border-line bg-surface p-5">
            {patient ? (
              <PatientHeader patient={patient} />
            ) : (
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ice font-semibold text-muted">
                  ?
                </span>
                <div className="text-sm font-semibold text-deep">
                  Paciente sin identificar
                </div>
              </div>
            )}
            <dl className="mt-4 space-y-3 text-sm">
              <ClinicalRow label="Antecedentes" values={patient?.antecedentes} />
              <ClinicalRow label="Alergias" values={patient?.alergias} />
              <ClinicalRow label="Medicamentos" values={patient?.medicamentos} />
            </dl>
          </div>
          <div className="rounded-lg border border-line bg-surface p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Plantilla
            </div>
            <div className="mt-1 font-medium text-deep">{plantilla.nombre}</div>
          </div>
          <p className="flex items-start gap-2 px-1 text-xs text-muted">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />
            El audio no se conserva tras generar la nota.
          </p>
        </aside>
      </div>
    </div>
  );
}

function ClinicalRow({
  label,
  values,
}: {
  label: string;
  values?: string[];
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-ink-soft">
        {values && values.length ? values.join(", ") : "—"}
      </dd>
    </div>
  );
}

export default function EnVivoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 size={32} className="animate-spin text-accent" />
        </div>
      }
    >
      <EnVivoInner />
    </Suspense>
  );
}
