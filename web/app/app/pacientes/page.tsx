"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { useStore } from "@/app/app/providers";

export default function PacientesPage() {
  const { consultations, patients } = useStore();
  const [query, setQuery] = useState("");

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.documento.toLowerCase().includes(q),
    );
  }, [query, patients]);

  function countFor(id: string) {
    return consultations.filter((c) => c.pacienteId === id).length;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-deep">Pacientes</h1>
      <p className="text-sm text-muted">{patients.length} pacientes registrados</p>

      <div className="mt-5 flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2">
        <Search size={16} className="text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o documento…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-line bg-white">
        {filtrados.map((p, i) => (
          <Link
            key={p.id}
            href={`/app/pacientes/${p.id}`}
            className={`flex items-center gap-4 px-5 py-4 hover:bg-ice-soft ${
              i !== 0 ? "border-t border-line" : ""
            }`}
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-deep text-sm font-semibold text-white">
              {p.nombre.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-deep">{p.nombre}</div>
              <div className="truncate text-xs text-muted">
                {p.edad} años · {p.sexo === "F" ? "Femenino" : "Masculino"} ·{" "}
                {p.documento} · {p.eps}
              </div>
            </div>
            <span className="hidden text-sm text-muted sm:block">
              {countFor(p.id)} consultas
            </span>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}
