import type { ReactNode } from "react";

export function SecurityBadge({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-4 rounded-md border border-line bg-white/70 p-5 backdrop-blur-sm">
      <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-mint-soft text-success">
        {icon}
      </div>
      <div>
        <h3 className="text-base font-semibold text-deep">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{children}</p>
      </div>
    </div>
  );
}
