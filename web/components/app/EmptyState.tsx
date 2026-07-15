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
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-line bg-surface px-6 py-10 text-center shadow-[var(--shadow-xs)]">
      {icon ? (
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-ice text-accent">
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
