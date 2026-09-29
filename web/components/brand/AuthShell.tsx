import type { ReactNode } from "react";
import Link from "next/link";
import { BrandSphere } from "@/components/brand/BrandSphere";
import { AmbientCanvas } from "@/components/app/AmbientCanvas";

/**
 * LA PUERTA — el cascarón de las cuatro pantallas de acceso (ingresar,
 * registro, recuperar y contraseña nueva).
 *
 * Antes cada una repetía su propio centrado, su propio orbe de 110px y su
 * propia tarjeta, así que la puerta de Miracle no se parecía ni a sí misma ni
 * a la app que hay detrás. Ahora las cuatro entran por aquí.
 *
 * Tres decisiones:
 *
 *  1. EL ORBE ES EL LOGO, no un adorno. Va lo bastante grande como para que
 *     "Miracle" se lea dentro, que es como está dibujada la marca. A 110px la
 *     palabra desaparecía y quedaba una bolita azul anónima.
 *  2. LA MISMA ATMÓSFERA QUE LA APP. Las luces que derivan detrás son las del
 *     lienzo ambiental de adentro: la puerta ya se siente como el sitio al que
 *     se entra, no como un formulario de otro producto.
 *  3. EL MISMO MATERIAL. El panel es vidrio y los campos van hundidos, igual
 *     que en la app — quien entra ya aprendió el idioma antes de entrar.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
  back = { href: "/", label: "← Volver al inicio" },
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Enlaces de abajo (crear cuenta, acceso institucional…). */
  footer?: ReactNode;
  /** El regreso del pie. Cada pantalla vuelve al sitio del que se llega:
   *  el ingreso a la portada, recuperar al ingreso, y así. */
  back?: { href: string; label: string };
}) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <AmbientCanvas />

      <div className="w-full max-w-[26rem]">
        <div className="flex flex-col items-center text-center">
          <Link
            href="/"
            aria-label="Miracle — inicio"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {/* Tamaño fijo para el trazo del aro, ancho fluido para la caja:
                así el orbe respira en un teléfono sin adelgazar su filo. */}
            <BrandSphere
              size={260}
              wordmark
              className="h-auto w-[clamp(12rem,38vw,16.5rem)]"
            />
          </Link>

          <h1 className="font-display -mt-2 text-[1.7rem] font-[650] leading-tight tracking-[-0.03em] text-deep">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-[22rem] text-[0.9rem] leading-relaxed text-muted">
              {description}
            </p>
          ) : null}
        </div>

        <div className="glass-panel mt-6 rounded-[24px] p-5 sm:p-6">{children}</div>

        {footer ? (
          <div className="mt-5 text-center text-[0.875rem] text-ink-soft">
            {footer}
          </div>
        ) : null}

        <p className="mt-6 text-center">
          <Link
            href={back.href}
            className="text-[13px] font-medium text-muted transition-colors hover:text-deep"
          >
            {back.label}
          </Link>
        </p>
      </div>
    </main>
  );
}

/** Separador con leyenda ("o con tu correo"). */
export function AuthSeparator({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Campo de texto de las pantallas de acceso: mismo material que la app. */
export function AuthField({
  id,
  label,
  hint,
  ...input
}: {
  id: string;
  label: string;
  hint?: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-deep">
          {label}
        </label>
        {hint}
      </div>
      <input
        id={id}
        {...input}
        className="clinical-control w-full px-3.5 py-2.5 text-sm outline-none"
      />
    </div>
  );
}
