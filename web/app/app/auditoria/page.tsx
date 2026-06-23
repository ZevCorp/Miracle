"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { useStore } from "@/app/app/providers";
import {
  acceptedCodes,
  completitud,
  formatFechaRelativa,
  type AuditEvent,
} from "@/lib/mock";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/marketing/MetricCard";
import { StatusBadge } from "@/components/app/StatusBadge";

export default function AuditoriaPage() {
  const { consultations, getPatient } = useStore();

  const porRevisar = consultations.filter(
    (c) => c.estado === "borrador" || c.estado === "revisada",
  );
  const promedio = consultations.length
    ? Math.round(
        consultations.reduce((acc, c) => acc + completitud(c), 0) /
          consultations.length,
      )
    : 0;
  const conCodificacion = consultations.filter(
    (c) => acceptedCodes(c, "CIE-10").length > 0,
  ).length;

  const eventos: (AuditEvent & { consultaId: string; paciente?: string })[] =
    consultations
      .flatMap((c) =>
        c.auditoria.map((e) => ({
          ...e,
          consultaId: c.id,
          paciente: getPatient(c.pacienteId)?.nombre,
        })),
      )
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
      .slice(0, 8);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-deep">Auditoría y calidad</h1>
      <p className="text-sm text-muted">
        Revisión de completitud, codificación y trazabilidad documental.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        <MetricCard value={String(porRevisar.length)} label="Notas por revisar" hint="Borrador o revisada" />
        <MetricCard value={`${promedio}%`} label="Completitud promedio" hint="Sobre campos de RIPS" />
        <MetricCard value={`${conCodificacion}/${consultations.length}`} label="Con diagnóstico (CIE-10)" hint="Código principal aceptado" />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-deep">
            Notas que requieren atención
          </h2>
          {porRevisar.length ? (
            <div className="space-y-3">
              {porRevisar.map((c) => {
                const pct = completitud(c);
                const ok = pct >= 80;
                return (
                  <Link
                    key={c.id}
                    href={`/app/consultas/${c.id}`}
                    className="flex items-center gap-4 rounded-lg border border-line p-4 hover:border-mist"
                  >
                    <span
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                        ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
                      }`}
                    >
                      {ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-deep">
                        {getPatient(c.pacienteId)?.nombre} · {c.motivo}
                      </div>
                      <div className="text-xs text-muted">
                        Completitud {pct}% · {formatFechaRelativa(c.fecha)}
                      </div>
                    </div>
                    <StatusBadge estado={c.estado} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted">
              Todas las notas están al día. Nada pendiente de revisión.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-deep">
            Eventos recientes
          </h2>
          <ol className="space-y-4">
            {eventos.map((e) => (
              <li key={e.id} className="text-sm">
                <Link
                  href={`/app/consultas/${e.consultaId}`}
                  className="font-medium text-deep hover:text-accent"
                >
                  {e.accion}
                </Link>
                <div className="text-xs text-muted">
                  {e.paciente ? `${e.paciente} · ` : ""}
                  {e.actor} · {formatFechaRelativa(e.fecha)}
                </div>
              </li>
            ))}
          </ol>
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
