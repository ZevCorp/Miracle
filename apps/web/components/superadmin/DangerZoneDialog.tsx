"use client";

import { useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

/**
 * Confirmación de una acción de mantenimiento.
 *
 * `<dialog>` nativo: modal real, cierre con Escape y foco atrapado sin añadir
 * una librería. Dentro va el formulario de la server action, así que la
 * contraseña viaja en el cuerpo del POST y nunca por la URL.
 *
 * El radio de impacto se muestra ANTES de pedir la contraseña: la contraseña
 * evita que alguien use tu sesión abierta, pero lo que evita el error de la
 * fila equivocada es leer "3 miembros · 41 consultas" antes de escribirla.
 */
export function DangerZoneDialog({
  titulo,
  descripcion,
  impacto,
  etiquetaBoton,
  etiquetaConfirmar,
  tono = "peligro",
  action,
  campos,
  pedirMotivo = false,
  deshabilitado,
  razonDeshabilitado,
}: {
  titulo: string;
  descripcion: ReactNode;
  /** Qué se lleva por delante la acción. Se ve antes de confirmar. */
  impacto?: ReactNode;
  etiquetaBoton: string;
  etiquetaConfirmar: string;
  tono?: "peligro" | "aviso" | "neutro";
  action: (formData: FormData) => void | Promise<void>;
  /** Campos ocultos (ids, etiquetas) que la acción necesita. */
  campos: Record<string, string>;
  pedirMotivo?: boolean;
  deshabilitado?: boolean;
  razonDeshabilitado?: string;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState("");

  const cerrar = () => {
    setPassword("");
    dialogo.current?.close();
  };

  const estiloBoton =
    tono === "peligro"
      ? "border-danger/40 text-danger hover:bg-danger-soft"
      : tono === "aviso"
        ? "border-warning/40 text-warning hover:bg-warning-soft"
        : "border-line text-deep hover:bg-ice-soft";

  if (deshabilitado) {
    return (
      <span
        title={razonDeshabilitado}
        className="inline-flex cursor-not-allowed items-center rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-mist"
      >
        {etiquetaBoton}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${estiloBoton}`}
      >
        {etiquetaBoton}
      </button>

      <dialog
        ref={dialogo}
        onClose={() => setPassword("")}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-[14px] border border-line bg-surface p-0 text-deep shadow-[var(--shadow-md)] backdrop:bg-night/40"
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <AlertTriangle
            size={18}
            className={tono === "peligro" ? "mt-0.5 text-danger" : "mt-0.5 text-warning"}
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold">{titulo}</h2>
            <div className="mt-1 text-sm text-muted">{descripcion}</div>
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="rounded-md p-1 text-muted hover:bg-ice-soft hover:text-deep"
          >
            <X size={16} />
          </button>
        </div>

        <form action={action} className="space-y-4 px-5 py-4">
          {Object.entries(campos).map(([nombre, valor]) => (
            <input key={nombre} type="hidden" name={nombre} value={valor} />
          ))}

          {impacto ? (
            <div className="rounded-lg border border-line bg-ice-soft px-3 py-2.5 text-sm text-deep">
              {impacto}
            </div>
          ) : null}

          {pedirMotivo ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Motivo (opcional)</span>
              <input
                name="motivo"
                placeholder="Dejó el hospital, cuenta duplicada…"
                className="w-full rounded-md border border-line bg-field px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <span className="mt-1 block text-xs text-muted">
                Queda en el registro de actividad.
              </span>
            </label>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Tu contraseña</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-line bg-field px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={cerrar}
              className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted hover:text-deep"
            >
              Cancelar
            </button>
            <BotonConfirmar etiqueta={etiquetaConfirmar} tono={tono} listo={password.length > 0} />
          </div>
        </form>
      </dialog>
    </>
  );
}

/**
 * useFormStatus solo funciona en un hijo del <form>, de ahí el componente
 * aparte. Evita el doble envío, que en una acción irreversible no es un detalle.
 */
function BotonConfirmar({
  etiqueta,
  tono,
  listo,
}: {
  etiqueta: string;
  tono: "peligro" | "aviso" | "neutro";
  listo: boolean;
}) {
  const { pending } = useFormStatus();
  // `bg-danger` es la utilidad propia de globals.css que apunta a
  // --color-danger-solid (legible en claro y oscuro), no el token de texto.
  const fondo =
    tono === "peligro"
      ? "bg-danger hover:opacity-90"
      : tono === "aviso"
        ? "bg-warning hover:opacity-90"
        : "bg-accent hover:bg-accent-hover";

  return (
    <button
      type="submit"
      disabled={pending || !listo}
      className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${fondo}`}
    >
      {pending ? "Aplicando…" : etiqueta}
    </button>
  );
}
