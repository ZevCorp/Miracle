"use client";

import { useRouter } from "next/navigation";
import { Clock3, FlaskConical } from "lucide-react";

/**
 * Filtros propios de /superadmin/metricas: organización, médico, franja
 * horaria del día y el interruptor de cuentas de prueba.
 *
 * Mismo contrato que FilterBar/RangePicker: SOLO empujan la URL y la página
 * (server component) re-consulta con los searchParams; así el estado se
 * comparte por enlace y sobrevive refrescos. El RangePicker vive aparte en la
 * página y conserva estos parámetros vía `preserved`.
 */
export function MetricasFilters({
  basePath,
  org,
  usuario,
  hdesde,
  hhasta,
  incluirPrueba,
  orgs,
  usuarios,
  preserved = {},
}: {
  basePath: string;
  org: string;
  usuario: string;
  hdesde: string;
  hhasta: string;
  incluirPrueba: boolean;
  orgs: { value: string; label: string }[];
  usuarios: { value: string; label: string }[];
  /** Parámetros del RangePicker que deben sobrevivir (rango/desde/hasta). */
  preserved?: Record<string, string | undefined>;
}) {
  const router = useRouter();

  const push = (cambios: Record<string, string | undefined>) => {
    const actuales: Record<string, string | undefined> = {
      ...preserved,
      org: org || undefined,
      usuario: usuario || undefined,
      hdesde: hdesde || undefined,
      hhasta: hhasta || undefined,
      prueba: incluirPrueba ? "1" : undefined,
      ...cambios,
    };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(actuales)) {
      if (v) sp.set(k, v);
    }
    const qs = sp.toString();
    router.replace(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  const control =
    "rounded-md border border-line bg-field px-3 py-2 text-sm text-deep outline-none focus:border-accent";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={org}
        onChange={(e) => push({ org: e.target.value || undefined })}
        aria-label="Organización"
        className={control}
      >
        <option value="">Todas las organizaciones</option>
        {orgs.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={usuario}
        onChange={(e) => push({ usuario: e.target.value || undefined })}
        aria-label="Médico"
        className={control}
      >
        <option value="">Todos los médicos</option>
        {usuarios.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </select>

      {/* Franja horaria [desde, hasta) en hora de Bogotá. Cruzar la medianoche
          es válido (22 → 6). Ambos extremos o ninguno: un solo extremo no
          define franja y el server la ignora (resolverFranjaHoraria). */}
      <div className="flex items-center gap-1.5 rounded-md border border-line bg-field px-3 py-1.5">
        <Clock3 size={14} className="shrink-0 text-muted" />
        <select
          value={hdesde}
          onChange={(e) => push({ hdesde: e.target.value || undefined })}
          aria-label="Desde la hora"
          className="bg-transparent text-sm text-deep outline-none"
        >
          <option value="">Todo el día</option>
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={String(h)}>
              {h}:00
            </option>
          ))}
        </select>
        <span className="text-xs text-muted">→</span>
        <select
          value={hhasta}
          onChange={(e) => push({ hhasta: e.target.value || undefined })}
          aria-label="Hasta la hora"
          className="bg-transparent text-sm text-deep outline-none"
        >
          <option value="">—</option>
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={String(h)}>
              {h}:00
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => push({ prueba: incluirPrueba ? undefined : "1" })}
        aria-pressed={incluirPrueba}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
          incluirPrueba
            ? "border-accent bg-accent-soft text-accent-ink"
            : "border-line bg-surface text-ink-soft hover:border-mist"
        }`}
        title="Las cuentas @miracle.app y la cuenta demo se excluyen por defecto para no distorsionar los promedios."
      >
        <FlaskConical size={14} />
        {incluirPrueba ? "Incluyendo cuentas de prueba" : "Incluir cuentas de prueba"}
      </button>
    </div>
  );
}
