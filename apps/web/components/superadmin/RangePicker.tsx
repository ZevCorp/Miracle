"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { RANGOS_PRESET, type RangoResuelto } from "@/lib/superadmin/rango";

const ETIQUETA_CORTA: Record<string, string> = {
  "7": "7 días",
  "30": "30 días",
  "90": "90 días",
  "365": "1 año",
};

/**
 * Selector del periodo de las estadísticas.
 *
 * Mismo contrato que FilterBar: solo empuja la URL (?rango=…&desde=…&hasta=…) y
 * la página, que sigue siendo un server component, vuelve a consultar con los
 * searchParams. Así el periodo elegido se puede compartir por enlace y
 * sobrevive a un refresco.
 */
export function RangePicker({
  basePath,
  rango,
  preserved = {},
}: {
  basePath: string;
  rango: RangoResuelto;
  /** Filtros ajenos a este control que deben sobrevivir (org, estado, q…). */
  preserved?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(rango.clave === "custom");
  const [desde, setDesde] = useState(rango.desde);
  const [hasta, setHasta] = useState(rango.hasta);

  const push = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...preserved, ...params })) {
      if (v) sp.set(k, v);
    }
    const qs = sp.toString();
    router.replace(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  const chip = (activo: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
      activo
        ? "border-accent bg-accent-soft text-accent-ink"
        : "border-line bg-surface text-ink-soft hover:border-mist"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {RANGOS_PRESET.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => {
            setAbierto(false);
            // El preset de 30 días es el defecto: se manda sin parámetro para
            // no dejar URLs con estado redundante.
            push({ rango: preset === "30" ? undefined : preset, desde: undefined, hasta: undefined });
          }}
          className={chip(rango.clave === preset)}
          aria-pressed={rango.clave === preset}
        >
          {ETIQUETA_CORTA[preset]}
        </button>
      ))}

      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className={chip(rango.clave === "custom")}
        aria-expanded={abierto}
      >
        <span className="inline-flex items-center gap-1.5">
          <CalendarRange size={14} />
          {rango.clave === "custom" ? rango.etiqueta : "Personalizado"}
        </span>
      </button>

      {abierto ? (
        <div className="flex flex-wrap items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
          <input
            type="date"
            value={desde}
            max={hasta}
            onChange={(e) => setDesde(e.target.value)}
            aria-label="Desde"
            className="bg-transparent text-sm text-deep outline-none"
          />
          <span className="text-xs text-muted">→</span>
          <input
            type="date"
            value={hasta}
            min={desde}
            onChange={(e) => setHasta(e.target.value)}
            aria-label="Hasta"
            className="bg-transparent text-sm text-deep outline-none"
          />
          <button
            type="button"
            onClick={() => push({ rango: "custom", desde, hasta })}
            className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white hover:bg-accent-hover"
          >
            Aplicar
          </button>
        </div>
      ) : null}
    </div>
  );
}
