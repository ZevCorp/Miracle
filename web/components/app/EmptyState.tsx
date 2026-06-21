import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-white/60 px-6 py-14 text-center">
      {icon ? (
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-ice text-accent">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-deep">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
