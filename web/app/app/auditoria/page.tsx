import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  formatFechaRelativa,
  type ClinicalCode,
  type Consultation,
  type NoteSection,
} from "@/lib/mock";
import {
  auditConsultation,
  auditSummaryLabel,
  worstSeverity,
} from "@/lib/clinical/note-audit";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/marketing/MetricCard";
import { StatusBadge } from "@/components/app/StatusBadge";
import { AuditFindingList, AuditSeverityBadge } from "@/components/app/AuditFindings";

const POR_REVISAR_LIMIT = 24;

type Stats = { total: number; por_revisar: number; con_dx: number; promedio_completitud: number };

type RevisarRow = {
  id: string;
  motivo: string | null;
  fecha: string;
  estado: Consultation["estado"];
  codigos: unknown;
  note: unknown;
  resumen: string | null;
  firma: unknown;
  patients: { nombre: string | null } | { nombre: string | null }[] | null;
};

type EventoRow = {
  id: string;
  accion: string;
  fecha: string;
  actor_name: string | null;
  consultation_id: string | null;
  consultations:
    | { patients: { nombre: string | null } | { nombre: string | null }[] | null }
    | null;
};

function nombreDe(p: { nombre: string | null } | { nombre: string | null }[] | null): string | undefined {
  if (!p) return undefined;
  const row = Array.isArray(p) ? p[0] : p;
  return row?.nombre ?? undefined;
}

export default async function AuditoriaPage() {
  const supabase = await createClient();

  const [statsRes, revisarRes, eventosRes] = await Promise.all([
    supabase.rpc("consultation_audit_stats"),
    supabase
      .from("consultations")
      .select("id, motivo, fecha, estado, codigos, note, resumen, firma, patients(nombre)")
      .in("estado", ["borrador", "revisada"])
      .order("fecha", { ascending: false })
      .limit(POR_REVISAR_LIMIT),
    supabase
      .from("audit_events")
      .select("id, accion, fecha, actor_name, consultation_id, consultations(patients(nombre))")
      .order("fecha", { ascending: false })
      .limit(8),
  ]);

  const stats = (statsRes.data ?? {
    total: 0,
    por_revisar: 0,
    con_dx: 0,
    promedio_completitud: 0,
  }) as Stats;
  const porRevisar = (revisarRes.data ?? []) as unknown as RevisarRow[];
  // Supabase tipa los embeds anidados como arrays; en runtime (relación to-one)
  // llegan como objeto. `nombreDe` maneja ambos; el cast concilia el tipo.
  const eventos = (eventosRes.data ?? []) as unknown as EventoRow[];

  // Auditoría concreta por nota (motor determinista), ordenada peor-primero para
  // que las notas con más por corregir queden arriba.
  const auditadas = porRevisar
    .map((c) => ({
      row: c,
      report: auditConsultation({
        estado: c.estado,
        motivo: c.motivo,
        resumen: c.resumen,
        note: (c.note ?? []) as NoteSection[],
        codigos: (c.codigos ?? []) as ClinicalCode[],
        firma: c.firma,
      }),
    }))
    .sort((a, b) => a.report.puntaje - b.report.puntaje);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-deep">Auditoría y calidad</h1>
      <p className="text-sm text-muted">
        Revisión de completitud, codificación y trazabilidad. Cada nota indica qué
        se puede mejorar antes de firmar.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        <MetricCard
          value={String(stats.por_revisar)}
          label="Notas por revisar"
          hint="Borrador o revisada"
        />
        <MetricCard
          value={`${stats.promedio_completitud}%`}
          label="Completitud promedio"
          hint="Sobre campos de RIPS"
        />
        <MetricCard
          value={`${stats.con_dx}/${stats.total}`}
          label="Con diagnóstico (CIE-10)"
          hint="Código principal aceptado"
        />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-deep">
            Notas que requieren atención
          </h2>
          {auditadas.length ? (
            <div className="space-y-3">
              {auditadas.map(({ row: c, report }) => (
                <Link
                  key={c.id}
                  href={`/app/consultas/${c.id}`}
                  className="block rounded-lg border border-line p-4 hover:border-mist"
                >
                  <div className="flex items-start gap-3">
                    <AuditSeverityBadge severidad={worstSeverity(report)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-deep">
                            {nombreDe(c.patients) ?? "Paciente sin identificar"}
                            {c.motivo ? ` · ${c.motivo}` : ""}
                          </div>
                          <div className="text-xs text-muted">
                            {auditSummaryLabel(report)} · {formatFechaRelativa(c.fecha)}
                          </div>
                        </div>
                        <StatusBadge estado={c.estado} />
                      </div>
                      <div className="mt-2.5">
                        <AuditFindingList
                          hallazgos={report.hallazgos}
                          max={2}
                          emptyLabel="Lista para firmar — sin observaciones."
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">
              Todas las notas están al día. Nada pendiente de revisión.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-deep">Eventos recientes</h2>
          {eventos.length ? (
            <ol className="space-y-4">
              {eventos.map((e) => {
                const paciente = nombreDe(e.consultations?.patients ?? null);
                return (
                  <li key={e.id} className="text-sm">
                    {e.consultation_id ? (
                      <Link
                        href={`/app/consultas/${e.consultation_id}`}
                        className="font-medium text-deep hover:text-accent"
                      >
                        {e.accion}
                      </Link>
                    ) : (
                      <span className="font-medium text-deep">{e.accion}</span>
                    )}
                    <div className="text-xs text-muted">
                      {paciente ? `${paciente} · ` : ""}
                      {e.actor_name ?? "Sistema"} · {formatFechaRelativa(e.fecha)}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted">Sin eventos registrados.</p>
          )}
          <Link
            href="/app/reportes"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
          >
            Ver reportes de calidad <ArrowRight size={14} />
          </Link>
        </Card>
      </div>
    </div>
  );
}
