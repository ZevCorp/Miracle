"use client";

import { ROLE_LABEL, type Role } from "@/lib/mock";
import { useStore } from "@/app/app/providers";

const roles: Role[] = ["medico", "auditor", "gerencia"];

export function RoleSwitcher() {
  const { role, setRole } = useStore();
  return (
    <div className="inline-flex rounded-full border border-line bg-pearl p-0.5">
      {roles.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => setRole(r)}
          aria-pressed={role === r}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            role === r
              ? "bg-deep text-white"
              : "text-muted hover:text-deep"
          }`}
        >
          {ROLE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}
