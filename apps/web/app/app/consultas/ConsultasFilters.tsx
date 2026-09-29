"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchField } from "@/components/ui/SearchField";

export type DoctorOption = { id: string; label: string };

/** Búsqueda por motivo + filtro de servicio y de médico.
 *  Empujan `?q=`/`?servicio=`/`?medico=` a la URL (preservando el chip de
 *  estado) para que la página RSC re-consulte. */
export function ConsultasFilters({
  initialQuery,
  initialServicio,
  estado,
  doctors = [],
  initialMedico = "todos",
  showServicio = true,
  servicios,
}: {
  initialQuery: string;
  initialServicio: string;
  estado: string;
  doctors?: DoctorOption[];
  initialMedico?: string;
  /** La secretaría filtra por médico y no por servicio: su vista ya está
   *  acotada a los médicos que le asignaron, y el servicio no le aporta. */
  showServicio?: boolean;
  /** Servicios de la institución (Configuración). Los resuelve la página. */
  servicios: string[];
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
      <SearchField
        value={q}
        onChange={setQ}
        placeholder="Buscar por paciente, cédula, motivo o rótulo"
        className="flex-1"
      />
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
      {showServicio ? (
        <select
          value={servicio}
          onChange={(e) => {
            setServicio(e.target.value);
            push(q, e.target.value, medico);
          }}
          className="clinical-control px-3 text-sm outline-none lg:min-w-52"
        >
          <option value="todos">Todos los servicios</option>
          {servicios.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
