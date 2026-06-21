import { Badge } from "@/components/ui/Badge";
import { STATUS_LABEL, statusTone, type ConsultationStatus } from "@/lib/mock";

export function StatusBadge({ estado }: { estado: ConsultationStatus }) {
  return (
    <Badge tone={statusTone(estado)}>
      <span
        className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70"
        aria-hidden
      />
      {STATUS_LABEL[estado]}
    </Badge>
  );
}
