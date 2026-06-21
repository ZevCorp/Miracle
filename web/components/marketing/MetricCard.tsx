import { Card } from "@/components/ui/Card";

export function MetricCard({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col">
      <div className="font-display text-4xl font-bold tracking-tight text-deep">
        {value}
      </div>
      <div className="mt-1 text-sm font-semibold text-ink-soft">{label}</div>
      {hint ? <p className="mt-2 text-sm text-muted">{hint}</p> : null}
    </Card>
  );
}
