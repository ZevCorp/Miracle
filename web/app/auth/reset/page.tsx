"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, AuthField } from "@/components/brand/AuthShell";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Destino del enlace de recuperación: el callback de auth ya intercambió el
 * código por una sesión, así que aquí solo se define la contraseña nueva.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(
        "No se pudo actualizar la contraseña. El enlace pudo haber expirado; solicita uno nuevo desde «Recuperar contraseña».",
      );
      return;
    }

    router.push("/app/dashboard");
  }

  return (
    <AuthShell
      title="Crea tu nueva contraseña"
      description={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres. Evita datos personales o contraseñas que uses en otros servicios.`}
      back={{
        href: "/login/recuperar",
        label: "¿El enlace expiró? Solicita uno nuevo",
      }}
    >
      {error ? (
        <AlertBanner tone="danger" className="mb-4">
          {error}
        </AlertBanner>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-3.5">
        <AuthField
          id="password"
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <AuthField
          id="confirm"
          label="Confirma la contraseña"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <button
          type="submit"
          disabled={saving}
          className="clinical-primary mt-1 w-full px-5 py-3"
        >
          {saving ? "Guardando…" : "Guardar y entrar"}
        </button>
      </form>
    </AuthShell>
  );
}
