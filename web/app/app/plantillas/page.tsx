"use client";

import { useState } from "react";
import { Copy, FileText, Plus, Trash2 } from "lucide-react";
import { templates as seedTemplates, type Template } from "@/lib/mock";
import { useStore } from "@/app/app/providers";
import { Badge } from "@/components/ui/Badge";

export default function PlantillasPage() {
  const { showToast } = useStore();
  const [items, setItems] = useState<Template[]>(seedTemplates);
  const [selected, setSelected] = useState<string>(seedTemplates[0].id);
  const [copyCounter, setCopyCounter] = useState(0);

  const actual = items.find((t) => t.id === selected) ?? items[0];

  function duplicate(t: Template) {
    const nextCopy = copyCounter + 1;
    setCopyCounter(nextCopy);
    const copy: Template = {
      ...t,
      id: `${t.id}-copy-${nextCopy}`,
      nombre: `${t.nombre} (copia)`,
      predeterminada: false,
      creadaPor: "Usuario",
      actualizada: "2026-06-20",
    };
    setItems((list) => [copy, ...list]);
    setSelected(copy.id);
    showToast("Plantilla duplicada.", "success");
  }

  function remove(id: string) {
    setItems((list) => list.filter((t) => t.id !== id));
    showToast("Plantilla eliminada.", "info");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-deep">Plantillas</h1>
          <p className="text-sm text-muted">
            Estructuras de nota por especialidad y formatos internos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => showToast("La creación de plantillas estará disponible en la versión conectada.", "info")}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          <Plus size={16} /> Crear plantilla
        </button>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-2.5">
          {items.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t.id)}
              className={`flex w-full items-center gap-3 rounded-lg border bg-white p-4 text-left transition-colors ${
                t.id === selected ? "border-accent ring-1 ring-accent/30" : "border-line hover:border-mist"
              }`}
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ice text-accent">
                <FileText size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-deep">{t.nombre}</span>
                  {t.predeterminada ? <Badge tone="accent">Predeterminada</Badge> : null}
                </div>
                <div className="truncate text-xs text-muted">
                  {t.especialidad} · {t.creadaPor} · act. {t.actualizada}
                </div>
              </div>
              <span className="flex items-center gap-1">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicate(t);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-ice-soft hover:text-deep"
                  aria-label="Duplicar"
                >
                  <Copy size={15} />
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(t.id);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-ice-soft hover:text-danger"
                  aria-label="Eliminar"
                >
                  <Trash2 size={15} />
                </span>
              </span>
            </button>
          ))}
        </div>

        <aside className="h-fit rounded-lg border border-line bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Vista previa
          </div>
          <h2 className="mt-1 font-display text-lg font-semibold text-deep">
            {actual?.nombre}
          </h2>
          <p className="text-sm text-muted">{actual?.especialidad}</p>
          <div className="mt-4 space-y-2">
            {actual?.secciones.map((s) => (
              <div
                key={s}
                className="rounded-md border border-line bg-pearl px-3 py-2 text-sm text-ink-soft"
              >
                {s}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
