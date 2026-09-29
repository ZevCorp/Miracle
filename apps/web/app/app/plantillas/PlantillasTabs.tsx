"use client";

import { useEffect, useState } from "react";
import { Tabs } from "@/components/app/Tabs";
import { TemplateCatalog } from "./TemplateCatalog";
import { AtajosManager } from "./AtajosManager";
import { useSnippets } from "@/components/app/SnippetsProvider";

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
  // Estando en la biblioteca del médico, cargar sus atajos es lo esperable: es
  // una consulta al entrar, no una por sección como antes.
  const { snippets, ensureLoaded } = useSnippets();
  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);
  const total = snippets.length;

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
    <div className="app-page">
      <Tabs
        tabs={[
          { id: "plantillas", label: "Plantillas" },
          // El contador ya lo soportaba `Tabs` y nadie lo usaba: sin él, la
          // pestaña no dice si hay algo detrás.
          { id: "atajos", label: "Mis atajos", count: total || undefined },
        ]}
        active={tab}
        onChange={selectTab}
      />
      <div className="mt-6">
        {tab === "atajos" ? (
          <AtajosManager specialtyCode={initialSpecialtyCode} />
        ) : (
          <TemplateCatalog initialSpecialtyCode={initialSpecialtyCode} embedded />
        )}
      </div>
    </div>
  );
}
