"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * El puente entre el shell y cualquier superficie que quiera ARRANCAR una
 * consulta: quién puede grabar, con qué identidad se preselecciona plantilla,
 * y cómo abrir la hoja del lanzador (cuyo estado vive en AppShell).
 *
 * Existe porque la Jornada del dashboard necesita abrir esa hoja y antes solo
 * el dock sabía hacerlo. null-safe a propósito: sin provider (o sin permiso),
 * el consumidor degrada a navegar a /app/consultas/nueva.
 */
export interface StartValue {
  canStart: boolean;
  userId: string | null;
  specialtyCode: string | null;
  openSheet: () => void;
}

const StartContext = createContext<StartValue | null>(null);

export function StartProvider({
  value,
  children,
}: {
  value: StartValue;
  children: ReactNode;
}) {
  return <StartContext.Provider value={value}>{children}</StartContext.Provider>;
}

export function useStart(): StartValue | null {
  return useContext(StartContext);
}
