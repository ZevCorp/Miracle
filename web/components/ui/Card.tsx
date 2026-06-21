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
      className={`rounded-lg border border-line bg-white/90 p-6 shadow-[var(--shadow-md)] backdrop-blur-sm ${className}`}
    >
      {children}
    </Tag>
  );
}
