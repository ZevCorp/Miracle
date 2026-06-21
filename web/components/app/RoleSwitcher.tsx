"use client";

import { ROLE_LABEL } from "@/lib/mock";
import { useStore } from "@/app/app/providers";

/** Read-only role indicator. Roles are assigned in Supabase by an admin. */
export function RoleSwitcher() {
  const { role } = useStore();

  return (
    <div className="inline-flex rounded-full border border-line bg-pearl px-3 py-1.5 text-xs font-semibold text-deep">
      {ROLE_LABEL[role]}
    </div>
  );
}
