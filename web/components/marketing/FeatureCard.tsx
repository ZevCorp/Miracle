import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export function FeatureCard({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex h-full flex-col">
      {icon ? (
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-md bg-accent-soft text-accent">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold text-deep">{title}</h3>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">
        {children}
      </p>
    </Card>
  );
}
