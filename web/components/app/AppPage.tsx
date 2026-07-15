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

export function AppPageHeader({
  title,
  description,
  kicker,
  action,
}: {
  title: string;
  description?: ReactNode;
  kicker?: string;
  action?: ReactNode;
}) {
  return (
    <header className="app-page-header">
      <div className="app-page-heading">
        {kicker ? <p className="app-page-kicker">{kicker}</p> : null}
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
