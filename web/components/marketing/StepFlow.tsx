"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

/** Diagrama de pasos con números grandes "fantasma". Limpio y aireado. */
export function StepFlow({
  steps,
}: {
  steps: { title: string; text: string }[];
}) {
  return (
    <ol className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((s, i) => (
        <Step key={s.title} index={i} title={s.title} text={s.text} />
      ))}
    </ol>
  );
}

function Step({
  index,
  title,
  text,
}: {
  index: number;
  title: string;
  text: string;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const numberY = useTransform(scrollYProgress, [0, 1], [16, -16]);

  return (
    <li ref={ref} className="relative">
      {/* style siempre presente (SSR-safe); el override de reduced-motion
          vive en CSS (.parallax-num), no en una rama de JS. */}
      <motion.div
        style={{ y: numberY }}
        className="parallax-num font-display text-6xl font-semibold leading-none text-accent/15"
      >
        {String(index + 1).padStart(2, "0")}
      </motion.div>
      <h3 className="mt-3 text-lg font-semibold text-deep">{title}</h3>
      <p className="mt-2 text-[0.97rem] leading-relaxed text-ink-soft">
        {text}
      </p>
    </li>
  );
}
