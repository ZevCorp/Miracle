"use client";

import { useEffect, useState } from "react";
import { applyTheme, readTheme, type ThemeMode } from "@/lib/theme";
import { ChoiceGroup, SettingCard, type Opcion } from "../ui";

const TEMAS: readonly Opcion<ThemeMode>[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "El del sistema" },
];

export function AparienciaSettings() {
  // Arranca en "system" —el valor que devuelve readTheme() en el servidor— y se
  // sincroniza con localStorage tras montar. Leerlo durante el primer render
  // haría que el HTML del servidor y el del cliente no coincidan; el tema en sí
  // ya lo pintó el script del <head> antes de esto, así que lo único que se
  // acomoda aquí es cuál de los tres botones sale marcado.
  const [modo, setModo] = useState<ThemeMode>("system");
  useEffect(() => setModo(readTheme()), []);

  function cambiar(siguiente: ThemeMode) {
    setModo(siguiente);
    applyTheme(siguiente);
  }

  return (
    <SettingCard
      title="Tema"
      description="Se aplica al instante y se recuerda en este computador."
    >
      <ChoiceGroup
        label="Tema de la interfaz"
        value={modo}
        options={TEMAS}
        onChange={cambiar}
        columns={3}
      />
      <p className="mt-3 text-xs leading-relaxed text-muted">
        {modo === "system"
          ? "Miracle cambia solo cuando tu computador cambia entre claro y oscuro."
          : "Miracle se queda en este tema aunque tu computador cambie."}{" "}
        Es una preferencia de este equipo: si entras desde otro, ahí eliges de
        nuevo.
      </p>
    </SettingCard>
  );
}
