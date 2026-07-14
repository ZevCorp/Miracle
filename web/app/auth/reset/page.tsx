"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandSphere } from "@/components/brand/BrandSphere";
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
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandSphere size={64} />
          <h1 className="mt-4 text-2xl font-semibold text-deep">
            Crea tu nueva contraseña
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Mínimo {MIN_PASSWORD_LENGTH} caracteres. Evita datos personales o
            contraseñas que uses en otros servicios.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface/90 p-6 shadow-[var(--shadow-lg)] backdrop-blur-sm">
          {error ? (
            <p
              role="alert"
              className="mb-4 rounded-md border border-warning/30 bg-warning-soft px-3.5 py-3 text-sm text-warning"
            >
              {error}
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-deep"
              >
                Nueva contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent"
              />
            </div>
            <div>
              <label
                htmlFor="confirm"
                className="mb-1.5 block text-sm font-medium text-deep"
              >
                Confirma la contraseña
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar y entrar"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login/recuperar" className="hover:text-deep">
            ¿El enlace expiró? Solicita uno nuevo
          </Link>
        </p>
      </div>
    </main>
  );
}
