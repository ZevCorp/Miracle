type Step = {
  title: string;
  text: string;
};

export function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
      {steps.map((step, i) => (
        <li
          key={step.title}
          className="relative rounded-lg border border-line bg-surface/85 p-5 shadow-[var(--shadow-sm)] backdrop-blur-sm"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-deep font-display text-sm font-semibold text-white">
            {i + 1}
          </span>
          <h3 className="mt-4 text-base font-semibold text-deep">
            {step.title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            {step.text}
          </p>
        </li>
      ))}
    </ol>
  );
}
