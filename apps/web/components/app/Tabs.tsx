export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

/**
 * Pestañas sobre el riel neumórfico compartido (.seg): la activa "sale" del
 * hueco como pulgar elevado, así el estado se lee por materia y no solo por
 * color. Misma API de siempre; el estilo vive en globals.css para que
 * cualquier segmented de la app se vea idéntico a estas pestañas.
 */
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
    <div className="seg w-full sm:w-auto" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className="seg-item min-w-0 flex-1 sm:flex-none"
          >
            <span className="truncate">{tab.label}</span>
            {typeof tab.count === "number" ? (
              <span
                className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${
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
