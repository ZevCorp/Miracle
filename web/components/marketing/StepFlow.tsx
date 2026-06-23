/** Diagrama de pasos con números grandes "fantasma". Limpio y aireado. */
export function StepFlow({
  steps,
}: {
  steps: { title: string; text: string }[];
}) {
  return (
    <ol className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s.title} className="relative">
          <div className="font-display text-6xl font-semibold leading-none text-accent/15">
            {String(i + 1).padStart(2, "0")}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-deep">{s.title}</h3>
          <p className="mt-2 text-[0.97rem] leading-relaxed text-ink-soft">
            {s.text}
          </p>
        </li>
      ))}
    </ol>
  );
}
