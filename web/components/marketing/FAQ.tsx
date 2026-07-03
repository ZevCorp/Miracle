import { ChevronDown } from "lucide-react";

type FAQItem = {
  question: string;
  answer: string;
};

/** Acordeón de preguntas frecuentes, sin JS (usa <details>/<summary> nativos). */
export function FAQ({ items }: { items: FAQItem[] }) {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-line">
      {items.map((item) => (
        <details key={item.question} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
            <span className="text-base font-semibold text-deep">
              {item.question}
            </span>
            <ChevronDown
              size={18}
              className="mt-0.5 shrink-0 text-muted transition-transform duration-300 group-open:rotate-180"
            />
          </summary>
          <p className="mt-3 pr-8 text-[0.97rem] leading-relaxed text-ink-soft">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
