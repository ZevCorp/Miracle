import type { ReactNode } from "react";

export function AppPage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`app-page ${className}`}>{children}</div>;
}

/**
 * Cabecera de pantalla: un título y, si hace falta, una línea que lo explique.
 *
 * Hubo un tercer elemento encima del título —un `kicker` en versales con la
 * categoría de la pantalla ("BIBLIOTECA CLÍNICA", "REVISIÓN MÉDICA")—. Se quitó:
 * repetía en mayúsculas lo que el título ya decía, y entre él y la descripción
 * dejaban dos subtítulos para un solo título, que es ruido en una pantalla que
 * el médico mira cien veces al día.
 */
export function AppPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="app-page-header">
      <div className="app-page-heading">
        <h1 className="app-page-title">{title}</h1>
        {description ? <div className="app-page-description">{description}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/**
 * Encabezado de bloque: un rótulo en versalita, una regla que cruza el ancho y,
 * opcionalmente, un conteo y una acción.
 *
 * Existe para dejar de meter cada lista en una tarjeta con borde. En el panel
 * del médico hay tres bloques seguidos; encerrados en cajas, la pantalla eran
 * cajas dentro de cajas. La regla agrupa igual y no cuesta un marco.
 */
export function SectionRule({
  title,
  count,
  action,
  className = "",
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex items-center gap-3 ${className}`}>
      <h2 className="doc-label shrink-0">{title}</h2>
      {count !== undefined ? (
        <span className="data shrink-0 rounded-full bg-ice px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
          {count}
        </span>
      ) : null}
      <span aria-hidden className="h-px min-w-4 flex-1 bg-line" />
      {action}
    </div>
  );
}

export function ClinicalSectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="clinical-section-heading">
      <h2 className="clinical-section-title">{title}</h2>
      {action}
    </div>
  );
}
