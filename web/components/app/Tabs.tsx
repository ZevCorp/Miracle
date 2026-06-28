export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-line bg-surface text-ink-soft hover:border-mist hover:text-deep"
            }`}
          >
            {tab.label}
            {typeof tab.count === "number" ? (
              <span
                className={`rounded-full px-1.5 text-xs font-semibold ${
                  isActive ? "bg-accent/15 text-accent-ink" : "bg-ice text-muted"
                }`}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
