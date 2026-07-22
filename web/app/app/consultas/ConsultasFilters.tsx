"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { SERVICIOS } from "@/lib/mock";

export type DoctorOption = { id: string; label: string };

/** Búsqueda por motivo + filtro de servicio (+ médico para la secretaría).
 *  Empujan `?q=`/`?servicio=`/`?medico=` a la URL (preservando el chip de
 *  estado) para que la página RSC re-consulte. */
export function ConsultasFilters({
  initialQuery,
  initialServicio,
  estado,
  doctors = [],
  initialMedico = "todos",
}: {
  initialQuery: string;
  initialServicio: string;
  estado: string;
  doctors?: DoctorOption[];
  initialMedico?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [servicio, setServicio] = useState(initialServicio);
  const [medico, setMedico] = useState(initialMedico);
  const first = useRef(true);

  const push = (nextQ: string, nextServicio: string, nextMedico: string) => {
    const sp = new URLSearchParams();
    if (estado && estado !== "todas") sp.set("estado", estado);
    if (nextServicio && nextServicio !== "todos") sp.set("servicio", nextServicio);
    if (nextMedico && nextMedico !== "todos") sp.set("medico", nextMedico);
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    const qs = sp.toString();
    router.replace(`/app/consultas${qs ? `?${qs}` : ""}`);
  };

  // Debounce solo para el texto; los selects empujan de inmediato.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => push(q, servicio, medico), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="clinical-toolbar">
      <div className="clinical-control flex flex-1 items-center gap-2 px-3">
        <Search size={16} className="text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por motivo"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </div>
      {doctors.length ? (
        <select
          value={medico}
          onChange={(e) => {
            setMedico(e.target.value);
            push(q, servicio, e.target.value);
          }}
          className="clinical-control px-3 text-sm outline-none lg:min-w-52"
          aria-label="Filtrar por médico"
        >
          <option value="todos">Todos los médicos</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      ) : null}
      <select
        value={servicio}
        onChange={(e) => {
          setServicio(e.target.value);
          push(q, e.target.value, medico);
        }}
        className="clinical-control px-3 text-sm outline-none lg:min-w-52"
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
