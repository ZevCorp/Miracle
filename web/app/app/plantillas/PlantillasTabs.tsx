"use client";

import { useState } from "react";
import { Tabs } from "@/components/app/Tabs";
import { TemplateCatalog } from "./TemplateCatalog";
import { AtajosManager } from "./AtajosManager";

/**
 * Biblioteca clínica del médico, en dos pestañas.
 *
 * Son dos cosas distintas y conviene no mezclarlas: la PLANTILLA es el
 * esqueleto de la nota (qué secciones tiene) y el ATAJO es un texto que se
 * inserta dentro de una sección. Comparten pantalla porque el médico las busca
 * en el mismo sitio ("mis cosas guardadas"), no porque sean lo mismo.
 */
export function PlantillasTabs({
  initialSpecialtyCode,
  initialTab = "plantillas",
}: {
  initialSpecialtyCode?: string | null;
  initialTab?: "plantillas" | "atajos";
}) {
  const [tab, setTab] = useState<string>(initialTab);

  function selectTab(id: string) {
    setTab(id);
    // Deja la pestaña en la URL para que recargar (o volver desde el editor de
    // la nota con ?tab=atajos) caiga donde el médico estaba. Se hace con
    // history en vez de router.replace: es estado de interfaz, no vale un
    // render del servidor.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (id === "plantillas") url.searchParams.delete("tab");
      else url.searchParams.set("tab", id);
      window.history.replaceState(null, "", url.toString());
    }
  }

  return (
    <div className="app-page max-w-[1440px]">
      <Tabs
        tabs={[
          { id: "plantillas", label: "Plantillas" },
          { id: "atajos", label: "Mis atajos" },
        ]}
        active={tab}
        onChange={selectTab}
      />
      <div className="mt-6">
        {tab === "atajos" ? (
          <AtajosManager />
        ) : (
          <TemplateCatalog initialSpecialtyCode={initialSpecialtyCode} embedded />
        )}
      </div>
    </div>
  );
}
