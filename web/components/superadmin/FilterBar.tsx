"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export type FilterSelect = {
  name: string;
  value: string;
  allLabel: string;
  options: { value: string; label: string }[];
};

/**
 * Barra de filtros de las listas de la consola. Todo vive en la URL
 * (`?q=&org=&rol=…`) para que la página siga siendo un server component que
 * re-consulta con los searchParams; este componente solo empuja la URL.
 *
 * El texto lleva debounce (300 ms); los selects empujan de inmediato. Mismo
 * patrón que app/app/consultas/ConsultasFilters.tsx, generalizado.
 */
export function FilterBar({
  basePath,
  searchPlaceholder = "Buscar",
  initialQuery = "",
  selects = [],
  preserved = {},
}: {
  basePath: string;
  searchPlaceholder?: string;
  initialQuery?: string;
  selects?: FilterSelect[];
  /** Parámetros que no controla esta barra pero deben sobrevivir (ej. estado). */
  preserved?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(selects.map((s) => [s.name, s.value])),
  );
  const first = useRef(true);

  const push = (nextQ: string, nextValues: Record<string, string>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(preserved)) {
      if (v) sp.set(k, v);
    }
    for (const select of selects) {
      const v = nextValues[select.name];
      if (v && v !== "todos" && v !== "todas") sp.set(select.name, v);
    }
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    const qs = sp.toString();
    router.replace(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => push(q, values), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const control =
    "rounded-md border border-line bg-field px-3 py-2 text-sm text-deep outline-none focus:border-accent";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className={`flex min-w-52 flex-1 items-center gap-2 ${control}`}>
        <Search size={15} className="shrink-0 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
          aria-label={searchPlaceholder}
        />
      </div>
      {selects.map((select) => (
        <select
          key={select.name}
          value={values[select.name]}
          onChange={(e) => {
            const next = { ...values, [select.name]: e.target.value };
            setValues(next);
            push(q, next);
          }}
          className={`${control} sm:min-w-44`}
          aria-label={select.allLabel}
        >
          <option value="todos">{select.allLabel}</option>
          {select.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
