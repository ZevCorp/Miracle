"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { APP_ROLE_LABEL } from "@/lib/auth/roles";
import { ASSIGNABLE_ROLES } from "@/lib/superadmin/roles";

/**
 * Búsqueda y filtro de la bandeja de usuarios.
 *
 * Mismo contrato que ConsultasFilters: solo empuja `?q=`/`?rol=` a la URL y la
 * página (server component) vuelve a filtrar. Así el estado se comparte por
 * enlace y sobrevive a un refresco, y no hace falta subir la lista completa a
 * estado de cliente.
 *
 * Los flashes `?ok=`/`?error=` NO se preservan a propósito: son de un solo uso y
 * arrastrarlos haría que el banner reapareciera al buscar.
 */
export function UsuariosFilters({
  initialQuery,
  initialRol,
}: {
  initialQuery: string;
  initialRol: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [rol, setRol] = useState(initialRol);
  const first = useRef(true);

  const push = (nextQ: string, nextRol: string) => {
    const sp = new URLSearchParams();
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    if (nextRol && nextRol !== "todos") sp.set("rol", nextRol);
    const qs = sp.toString();
    router.replace(`/app/usuarios${qs ? `?${qs}` : ""}`);
  };

  // Debounce solo para el texto; el select empuja de inmediato.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => push(q, rol), 300);
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
          placeholder="Buscar por nombre o correo"
          aria-label="Buscar usuario"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </div>
      <select
        value={rol}
        onChange={(e) => {
          setRol(e.target.value);
          push(q, e.target.value);
        }}
        aria-label="Filtrar por rol"
        className="clinical-control px-3 text-sm outline-none lg:min-w-52"
      >
        <option value="todos">Todos los roles</option>
        {ASSIGNABLE_ROLES.map((r) => (
          <option key={r} value={r}>
            {APP_ROLE_LABEL[r]}
          </option>
        ))}
        {/* La secretaría no se puede crear ni asignar desde aquí, pero si la
            institución ya tiene cuentas con ese rol hay que poder encontrarlas. */}
        <option value="secretaria">{APP_ROLE_LABEL.secretaria}</option>
      </select>
    </div>
  );
}
