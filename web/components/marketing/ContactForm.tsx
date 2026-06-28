"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { whatsappLink } from "@/lib/site";

const roles = [
  "Gerencia / Dirección general",
  "Dirección médica",
  "Coordinación de calidad",
  "Transformación digital / TI",
  "Médico/a",
  "Otro",
];

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-ink shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-accent";

export function ContactForm() {
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    // Honeypot anti-spam
    if (data.get("company-extra")) return;

    const nombre = String(data.get("nombre") ?? "");
    const institucion = String(data.get("institucion") ?? "");
    const rol = String(data.get("rol") ?? "");
    const mensaje = String(data.get("mensaje") ?? "");

    const texto = `Hola, soy ${nombre} (${rol}) de ${institucion}. ${mensaje}`;
    window.open(whatsappLink(texto), "_blank", "noopener,noreferrer");
    setSent(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nombre" className="mb-1.5 block text-sm font-medium text-deep">
            Nombre
          </label>
          <input id="nombre" name="nombre" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="institucion" className="mb-1.5 block text-sm font-medium text-deep">
            Institución
          </label>
          <input id="institucion" name="institucion" required className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="rol" className="mb-1.5 block text-sm font-medium text-deep">
          Rol
        </label>
        <select id="rol" name="rol" required className={inputClass} defaultValue="">
          <option value="" disabled>
            Seleccione…
          </option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="mensaje" className="mb-1.5 block text-sm font-medium text-deep">
          Mensaje
        </label>
        <textarea
          id="mensaje"
          name="mensaje"
          rows={4}
          placeholder="Cuéntenos sobre su institución y qué servicio tiene más carga documental."
          className={inputClass}
        />
      </div>

      {/* Honeypot oculto */}
      <input
        type="text"
        name="company-extra"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="submit" variant="primary" size="lg">
          Enviar por WhatsApp <Send size={16} />
        </Button>
        {sent ? (
          <span className="text-sm text-success">
            Abrimos WhatsApp con su mensaje. Si no se abrió, escríbanos directo.
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted">
        Al enviar, se abre WhatsApp con su mensaje prellenado para iniciar la
        conversación con el equipo.
      </p>
    </form>
  );
}
