"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus, Search } from "lucide-react";
import { useStore } from "@/app/app/providers";
import {
  SERVICIOS,
  STATUS_LABEL,
  type ConsultationStatus,
} from "@/lib/mock";
import { ConsultationCard } from "@/components/app/ConsultationCard";
import { EmptyState } from "@/components/app/EmptyState";

const estados: (ConsultationStatus | "todas")[] = [
  "todas",
  "borrador",
  "revisada",
  "aprobada",
  "exportada",
];

export default function ConsultasPage() {
  const { consultations, getPatient } = useStore();
  const [estado, setEstado] = useState<ConsultationStatus | "todas">("todas");
  const [servicio, setServicio] = useState<string>("todos");
  const [query, setQuery] = useState("");

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    return consultations.filter((c) => {
      if (estado !== "todas" && c.estado !== estado) return false;
      if (servicio !== "todos" && c.servicio !== servicio) return false;
      if (q) {
        const nombre = getPatient(c.pacienteId)?.nombre.toLowerCase() ?? "";
        if (!nombre.includes(q) && !c.motivo.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [consultations, estado, servicio, query]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-deep">Consultas</h1>
          <p className="text-sm text-muted">
            {filtradas.length} de {consultations.length} consultas
          </p>
        </div>
        <Link
          href="/app/consultas/nueva"
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          <Plus size={16} /> Nueva consulta
        </Link>
      </div>

      {/* Filtros */}
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-line bg-white px-3 py-2">
          <Search size={16} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por paciente o motivo…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </div>
        <select
          value={servicio}
          onChange={(e) => setServicio(e.target.value)}
          className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="todos">Todos los servicios</option>
          {SERVICIOS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {estados.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEstado(e)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              estado === e
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-line bg-white text-ink-soft hover:border-mist"
            }`}
          >
            {e === "todas" ? "Todas" : STATUS_LABEL[e]}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtradas.length ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtradas.map((c) => (
            <ConsultationCard key={c.id} consultation={c} />
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState
            icon={<ClipboardList size={22} />}
            title="Sin consultas para este filtro"
            description="Ajuste los filtros o inicie una nueva consulta."
          />
        </div>
      )}
    </div>
  );
}
