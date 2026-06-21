import type { ReactNode } from "react";

type Tone = "accent" | "mint" | "neutral" | "success" | "warning";

const tones: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent-ink",
  mint: "bg-mint-soft text-success",
  neutral: "bg-ice text-ink-soft",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
