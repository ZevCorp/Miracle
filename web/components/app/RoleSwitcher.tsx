"use client";

import { ROLE_LABEL } from "@/lib/mock";
import { useStore } from "@/app/app/providers";

/** Read-only role indicator. Roles are assigned in Supabase by an admin. */
export function RoleSwitcher() {
  const { role, isDemo } = useStore();

  // La cuenta de demostración se presenta como médico: su inicio es el panel
  // clínico, aunque por debajo tenga rol admin para alcanzar las demás
  // secciones durante la presentación.
  const label = isDemo ? ROLE_LABEL.medico : ROLE_LABEL[role];

  return (
    <div className="inline-flex rounded-full border border-line bg-pearl px-3 py-1.5 text-xs font-semibold text-deep">
      {label}
    </div>
  );
}
