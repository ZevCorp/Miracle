import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "li";
}) {
  return (
    <Tag
      className={`rounded-[16px] border border-line bg-surface p-5 shadow-[var(--elev-1)] sm:p-6 ${className}`}
    >
      {children}
    </Tag>
  );
}
