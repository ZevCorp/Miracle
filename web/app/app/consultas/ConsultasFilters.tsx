"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { SERVICIOS } from "@/lib/mock";

/** Búsqueda por motivo + filtro de servicio. Empujan `?q=`/`?servicio=` a la URL
 *  (preservando el chip de estado) para que la página RSC re-consulte. */
export function ConsultasFilters({
  initialQuery,
  initialServicio,
  estado,
}: {
  initialQuery: string;
  initialServicio: string;
  estado: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [servicio, setServicio] = useState(initialServicio);
  const first = useRef(true);

  const push = (nextQ: string, nextServicio: string) => {
    const sp = new URLSearchParams();
    if (estado && estado !== "todas") sp.set("estado", estado);
    if (nextServicio && nextServicio !== "todos") sp.set("servicio", nextServicio);
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    const qs = sp.toString();
    router.replace(`/app/consultas${qs ? `?${qs}` : ""}`);
  };

  // Debounce solo para el texto; el select empuja de inmediato.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => push(q, servicio), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="flex flex-1 items-center gap-2 rounded-md border border-line bg-surface px-3 py-2">
        <Search size={16} className="text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por motivo…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </div>
      <select
        value={servicio}
        onChange={(e) => {
          setServicio(e.target.value);
          push(q, e.target.value);
        }}
        className="rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      >
        <option value="todos">Todos los servicios</option>
        {SERVICIOS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
