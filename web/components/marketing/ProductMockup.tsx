import {
  Activity,
  CheckCircle2,
  FileText,
  Mic,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";

/**
 * Mockup visual de la pantalla clínica de Miracle (sin datos reales).
 * Tres zonas: rail de navegación · transcripción en vivo · nota estructurada
 * con codificación CIE-10/CUPS, confianza y estado de revisión.
 */
export function ProductMockup() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-[var(--shadow-xl)]">
      {/* Barra superior */}
      <div className="flex items-center gap-3 border-b border-line bg-deep px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-white/25" />
          <span className="h-3 w-3 rounded-full bg-white/25" />
          <span className="h-3 w-3 rounded-full bg-white/25" />
        </div>
        <span className="text-xs font-medium text-mist">
          Miracle · Consulta en vivo
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-danger/15 px-2.5 py-1 text-xs font-semibold text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff6b6b]" />
          Grabando · 04:12
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[52px_1fr_1.05fr]">
        {/* Rail */}
        <div className="hidden flex-col items-center gap-3 border-r border-line bg-pearl py-4 md:flex">
          {[Activity, Users, FileText, Stethoscope, ShieldCheck].map(
            (Icon, i) => (
              <span
                key={i}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${
                  i === 0
                    ? "bg-accent text-white"
                    : "text-muted hover:bg-ice-soft"
                }`}
              >
                <Icon size={18} />
              </span>
            ),
          )}
        </div>

        {/* Transcripción */}
        <div className="border-b border-line p-4 md:border-b-0 md:border-r">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
            <Mic size={14} className="text-accent" />
            Transcripción en vivo
          </div>

          {/* Paciente (ejemplo) */}
          <div className="mt-3 rounded-md border border-line bg-ice-soft px-3 py-2.5">
            <div className="text-sm font-semibold text-deep">
              Paciente de ejemplo
            </div>
            <div className="text-xs text-muted">
              Consulta externa · Medicina interna
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <Line who="Médico">
              ¿Hace cuánto presenta la dificultad para respirar y la tos?
            </Line>
            <Line who="Paciente">
              Como cinco días. En las noches me cuesta más y silba el pecho.
            </Line>
            <Line who="Médico">
              ¿Ha usado el inhalador? ¿Antecedente de asma?
            </Line>
            <Line who="Paciente">
              Sí, asma desde niño. Esta semana lo usé más de lo normal.
            </Line>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-[0.7rem] text-muted">
            <ShieldCheck size={13} className="text-success" />
            Consentimiento registrado · el audio no se conserva tras generar la
            nota.
          </p>
        </div>

        {/* Nota estructurada */}
        <div className="bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Nota clínica · SOAP
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-[0.7rem] font-semibold text-warning">
              Borrador · pendiente de revisión
            </span>
          </div>

          <div className="mt-3 space-y-3">
            <NoteBlock label="S — Subjetivo">
              Disnea y tos de 5 días, sibilancias nocturnas. Asma bronquial
              conocida; mayor uso de broncodilatador esta semana.
            </NoteBlock>
            <NoteBlock label="O — Objetivo">
              Sibilancias espiratorias difusas a la auscultación. SatO₂ y signos
              vitales por confirmar.
            </NoteBlock>
            <NoteBlock label="A — Análisis">
              Probable exacerbación de asma. Pendiente correlación con examen
              físico.
            </NoteBlock>
          </div>

          {/* Codificación sugerida */}
          <div className="mt-4 rounded-md border border-line bg-pearl p-3">
            <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
              Codificación sugerida
            </div>
            <div className="mt-2 space-y-2">
              <CodeRow code="CIE-10 · J45.9" label="Asma, no especificada" confidence={88} />
              <CodeRow code="CUPS · 890201" label="Consulta médica especializada" confidence={94} />
            </div>
            <p className="mt-2 text-[0.7rem] text-muted">
              Sugerencias para revisión del médico — no son un diagnóstico
              final.
            </p>
          </div>

          {/* Acciones */}
          <div className="mt-4 flex items-center gap-2">
            <button className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white">
              <CheckCircle2 size={16} /> Aprobar
            </button>
            <button className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-deep">
              Exportar a HC
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({ who, children }: { who: string; children: string }) {
  const isDoctor = who === "Médico";
  return (
    <div>
      <span
        className={`mr-1.5 text-[0.7rem] font-semibold ${
          isDoctor ? "text-accent" : "text-success"
        }`}
      >
        {who}
      </span>
      <span className="text-ink-soft">{children}</span>
    </div>
  );
}

function NoteBlock({ label, children }: { label: string; children: string }) {
  return (
    <div>
      <div className="text-[0.7rem] font-semibold text-muted">{label}</div>
      <p className="mt-0.5 text-sm leading-relaxed text-ink">{children}</p>
    </div>
  );
}

function CodeRow({
  code,
  label,
  confidence,
}: {
  code: string;
  label: string;
  confidence: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex shrink-0 items-center rounded-md bg-accent-soft px-2 py-1 text-xs font-semibold text-accent-ink">
        {code}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">
        {label}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-line">
          <span
            className="block h-full rounded-full bg-success"
            style={{ width: `${confidence}%` }}
          />
        </span>
        <span className="w-8 text-right text-[0.7rem] font-medium text-muted">
          {confidence}%
        </span>
      </span>
    </div>
  );
}
