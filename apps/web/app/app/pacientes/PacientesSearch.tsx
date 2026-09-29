"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchField } from "@/components/ui/SearchField";

/** Buscador de pacientes: empuja `?q=` a la URL (debounced) para que la página
 *  RSC re-consulte. Reinicia la paginación al buscar.
 *
 *  Usa SearchField —el buscador único de la app— en vez de su propio input:
 *  tenía otro alto y no traía botón de limpiar, así que buscar y luego volver a
 *  la lista completa obligaba a borrar el texto a mano. */
export function PacientesSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      const qs = sp.toString();
      router.replace(`/app/pacientes${qs ? `?${qs}` : ""}`);
    }, 300);
    return () => clearTimeout(t);
  }, [q, router]);

  return (
    <SearchField
      value={q}
      onChange={setQ}
      placeholder="Buscar por nombre o documento"
      ariaLabel="Buscar paciente"
    />
  );
}
