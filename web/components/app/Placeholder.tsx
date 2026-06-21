import { Construction } from "lucide-react";

/**
 * Marcador de página para los módulos de la app privada (Prompt 2).
 * Mantiene la arquitectura de rutas viva sin construir aún la lógica real.
 */
export function Placeholder({
  title,
  description,
  points,
}: {
  title: string;
  description: string;
  points?: string[];
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft text-accent">
          <Construction size={20} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-deep">{title}</h1>
          <p className="text-sm text-muted">Módulo en construcción · Prompt 2</p>
        </div>
      </div>

      <p className="mt-6 max-w-2xl text-ink-soft">{description}</p>

      {points && points.length > 0 ? (
        <div className="mt-6 max-w-2xl rounded-lg border border-line bg-white/80 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Incluirá
          </h2>
          <ul className="mt-3 space-y-2">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-ink-soft">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
