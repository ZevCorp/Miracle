"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { NoteSection } from "@/lib/mock";

export function NoteSectionView({ section }: { section: NoteSection }) {
  const [open, setOpen] = useState(!section.colapsadaPorDefecto);

  return (
    <div className="border-b border-line py-4 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <ChevronDown
          size={18}
          className={`shrink-0 text-muted transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
        <h3 className="font-display text-base font-semibold text-deep">
          {section.titulo}
        </h3>
      </button>

      {open ? (
        <div className="mt-2 pl-6 text-[0.95rem] leading-relaxed text-ink">
          {section.kind === "lista" && section.items ? (
            <ul className="space-y-1.5">
              {section.items.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{section.texto}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
