import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/app/EmptyState";
import { GitCompare } from "lucide-react";
import {
  ETIQUETA_FASE,
  FASES,
  fmtMin,
  fmtNum,
  fmtSeg,
  reduccionPct,
  type ComparacionFases,
} from "@/lib/superadmin/medicion";

const BASE = "/superadmin/medicion";

/**
 * Comparación de fases: baseline vs Notes vs Notes+Operations, lado a lado. Es la
 * pregunta que el estudio existe para responder — "¿cuánto trabajo elimina
 * Miracle?" — con medianas por turno y solo turnos de buena calidad. Los números
 * son ejemplos de forma, no resultados: hasta que no haya datos de las tres
 * fases, las columnas vacías se muestran como «—», nunca como cero.
 */
export default async function ComparacionPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; desde?: string; hasta?: string }>;
}) {
  const sp = await searchParams;
  const db = await createClient();

  const orgsRes = await db.from("organizations").select("id, name").eq("kind", "institution").order("name");
  const orgs = (orgsRes.data ?? []) as { id: string; name: string }[];
  const org = sp.org && sp.org !== "todas" ? sp.org : orgs[0]?.id ?? null;

  if (!org) {
    return (
      <div className="space-y-4">
        <Encabezado />
        <Card className="p-6">
          <EmptyState icon={<GitCompare className="h-6 w-6" />} title="No hay ninguna institución" description="La comparación de fases es por hospital." />
        </Card>
      </div>
    );
  }

  const { data, error } = await db.rpc("superadmin_medicion_fases", {
    p_org: org,
    p_from: sp.desde ?? null,
    p_to: sp.hasta ?? null,
  });

  const c = (data ?? null) as ComparacionFases | null;
  const filas: { clave: keyof NonNullable<ComparacionFases["por_fase"]>[string]; label: string; fmt: (v: number | null) => string; menosEsMejor: boolean }[] = [
    { clave: "activo_min_mediana", label: "Tiempo activo por turno", fmt: fmtMin, menosEsMejor: true },
    { clave: "his_min_mediana", label: "Tiempo en el HIS", fmt: fmtMin, menosEsMejor: true },
    { clave: "escritura_min_mediana", label: "Tiempo escribiendo", fmt: fmtMin, menosEsMejor: true },
    { clave: "clics_mediana", label: "Clics", fmt: fmtNum, menosEsMejor: true },
    { clave: "context_switches_mediana", label: "Cambios de contexto", fmt: fmtNum, menosEsMejor: true },
    { clave: "post_min_mediana", label: "Trabajo post-atención", fmt: fmtMin, menosEsMejor: true },
    { clave: "sap_espera_seg_mediana", label: "Espera de SAP", fmt: fmtSeg, menosEsMejor: true },
  ];

  const val = (fase: string, clave: string): number | null => {
    const f = c?.por_fase?.[fase] as Record<string, number | null> | undefined;
    return f ? (f[clave] ?? null) : null;
  };

  return (
    <div className="space-y-6">
      <Encabezado />

      <div className="flex flex-wrap items-center gap-2">
        {orgs.map((o) => (
          <Link
            key={o.id}
            href={`${BASE}/comparacion?org=${o.id}`}
            className={`rounded-lg border px-3 py-1.5 text-sm ${o.id === org ? "border-accent bg-accent/10 font-medium text-accent" : "border-line text-ink hover:bg-pearl"}`}
          >
            {o.name}
          </Link>
        ))}
        <Link href={BASE} className="ml-auto rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-pearl">
          ← Volver
        </Link>
      </div>

      {error || !c ? (
        <Card className="p-6">
          <EmptyState icon={<GitCompare className="h-6 w-6" />} title="Sin datos de comparación" description="Aún no hay turnos de buena calidad para esta institución." />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-pearl text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Métrica</th>
                  {FASES.map((f) => (
                    <th key={f} className="px-4 py-3 text-right">
                      {ETIQUETA_FASE[f]}
                      <span className="ml-1 font-normal text-muted">(n={fmtNum(c.por_fase?.[f]?.n ?? null)})</span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Reducción</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => {
                  const base = val("baseline", fila.clave as string);
                  const ultima = val("notes_ops", fila.clave as string) ?? val("notes", fila.clave as string);
                  return (
                    <tr key={fila.clave as string} className="border-t border-line">
                      <td className="px-4 py-3 font-medium text-ink">{fila.label}</td>
                      {FASES.map((f) => (
                        <td key={f} className="px-4 py-3 text-right tabular-nums">
                          {fila.fmt(val(f, fila.clave as string))}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-700">
                        {reduccionPct(base, ultima)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-4 py-3 text-xs text-muted">
            Medianas por turno, solo turnos de buena calidad. «Reducción» compara baseline con la última
            fase con datos. Un «—» significa que esa fase todavía no tiene turnos medidos — nunca un cero.
          </p>
        </Card>
      )}
    </div>
  );
}

function Encabezado() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">Comparación de fases</h1>
      <p className="text-sm text-muted">Antes de Miracle, con Miracle Notes, y con Notes + Operations — la misma vara para las tres.</p>
    </div>
  );
}
