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
    <Card className="flex flex-col border-l-[3px] border-l-accent shadow-none">
      <div className="font-display text-3xl font-semibold tracking-tight text-deep">
        {value}
      </div>
      <div className="mt-1.5 text-sm font-semibold text-ink-soft">{label}</div>
      {hint ? <p className="mt-1 text-[13px] text-muted">{hint}</p> : null}
    </Card>
  );
}
