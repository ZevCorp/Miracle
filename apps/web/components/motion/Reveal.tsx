"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Retraso en segundos, para escalonar varios Reveal en la misma sección. */
  delay?: number;
  /** Distancia (px) desde la que entra el contenido. */
  y?: number;
};

/**
 * Envoltorio de entrada al hacer scroll: fade + slide sutil, una sola vez.
 * `initial`/`variants` NUNCA dependen de useReducedMotion (eso rompería la
 * hidratación SSR); solo la duración de la transición se ajusta.
 */
export function Reveal({ children, className, delay = 0, y = 16 }: RevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration: reduceMotion ? 0 : 0.6,
        delay: reduceMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

type RevealGroupProps = {
  children: ReactNode;
  className?: string;
  /** Retraso entre cada hijo directo. */
  stagger?: number;
};

/** Anima en cascada a sus hijos directos cuando el grupo entra en pantalla. */
export function RevealGroup({
  children,
  className,
  stagger = 0.09,
}: RevealGroupProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: reduceMotion ? 0 : stagger },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

/** Hijo de RevealGroup: se anima siguiendo el stagger del padre. */
export function RevealItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={itemVariants}
      transition={{
        duration: reduceMotion ? 0 : 0.55,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
