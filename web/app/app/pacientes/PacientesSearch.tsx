"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/** Buscador de pacientes: empuja `?q=` a la URL (debounced) para que la página
 *  RSC re-consulte. Reinicia la paginación al buscar. */
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
    <div className="clinical-control flex items-center gap-2 px-3">
      <Search size={16} className="text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre o documento"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
      />
    </div>
  );
}
