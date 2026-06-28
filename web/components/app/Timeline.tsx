import { formatFechaRelativa, type AuditEvent } from "@/lib/mock";

export function Timeline({ events }: { events: AuditEvent[] }) {
  return (
    <ol className="relative space-y-5 pl-6">
      <span
        className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-line"
        aria-hidden
      />
      {events.map((ev) => (
        <li key={ev.id} className="relative">
          <span
            className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-accent bg-surface"
            aria-hidden
          />
          <div className="text-sm font-semibold text-deep">{ev.accion}</div>
          <div className="text-xs text-muted">
            {ev.actor} · {formatFechaRelativa(ev.fecha)}
          </div>
          {ev.detalle ? (
            <div className="mt-0.5 text-sm text-ink-soft">{ev.detalle}</div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
