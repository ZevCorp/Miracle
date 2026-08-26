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
