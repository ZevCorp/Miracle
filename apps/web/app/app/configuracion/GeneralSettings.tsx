"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useStore } from "@/app/app/providers";
import { ClinicalTemplatePicker } from "@/components/app/ClinicalTemplatePicker";
import {
  friendlyClinicalMessage,
  getClinicalTemplates,
  type ClinicalTemplate,
} from "@/lib/api/clinical";
import {
  clearTemplatePreference,
  getTemplatePreferences,
  pickPreselectedTemplate,
  pinnedTemplateIds,
  setTemplatePreference,
  type TemplatePreference,
} from "@/lib/clinical/template-preferences";
import { serviciosDe } from "@/lib/hospital/org";
import { useUserPreferences } from "@/lib/preferences/client";
import type { TemplateStartMode } from "@/lib/preferences/types";
import { createClient } from "@/lib/supabase/client";
import { ChoiceGroup, SettingCard, inputClass, type Opcion } from "./ui";

const MODOS: readonly Opcion<TemplateStartMode>[] = [
  {
    value: "last",
    label: "La última que usé",
    desc: "Miracle recuerda con qué plantilla grabaste la última vez y la trae ya puesta.",
  },
  {
    value: "fixed",
    label: "Siempre la misma",
    desc: "Eliges una y es con la que arranca cada consulta, sin excepciones.",
  },
  {
    value: "manual",
    label: "Elegirla cada vez",
    desc: "No se preselecciona ninguna. Útil si atiendes cosas muy distintas cada día.",
  },
];

/** Sentinela del desplegable de servicio: usar el que ponga la institución. */
const HEREDAR = "__heredar__";

export function GeneralSettings({ specialtyCode }: { specialtyCode: string | null }) {
  const { preferences, update } = useUserPreferences();
  const { org, showToast } = useStore();

  const [templates, setTemplates] = useState<ClinicalTemplate[] | null>(null);
  const [pins, setPins] = useState<TemplatePreference[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorPlantillas, setErrorPlantillas] = useState<string | null>(null);

  const modo = preferences.templateStartMode;

  // El catálogo solo se pide cuando de verdad hace falta enseñarlo: entrar a
  // Configuración no debería costar una llamada al backend clínico a quien solo
  // viene a cambiar el tema.
  const cargarPlantillas = useCallback(async () => {
    setCargando(true);
    setErrorPlantillas(null);
    try {
      const [lista, prefs] = await Promise.all([
        getClinicalTemplates(),
        getTemplatePreferences(createClient()).catch(() => [] as TemplatePreference[]),
      ]);
      setTemplates(lista.filter((t) => t.status !== "archived"));
      setPins(prefs);
    } catch (e) {
      setErrorPlantillas(friendlyClinicalMessage(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (modo !== "fixed" || templates || cargando) return;
    void cargarPlantillas();
  }, [modo, templates, cargando, cargarPlantillas]);

  // Cuál es HOY la plantilla fijada. Se resuelve con la misma función que decide
  // la preselección real, así que esta pantalla no puede prometer una plantilla
  // distinta de la que va a salir al iniciar la consulta.
  const plantillaFijada = templates
    ? pickPreselectedTemplate({
        templates,
        preferences: pins,
        specialtyCode,
        mode: "fixed",
      })
    : "";

  async function cambiarModo(siguiente: TemplateStartMode) {
    if (siguiente === modo) return;
    const ok = await update({ templateStartMode: siguiente });
    if (!ok) showToast("No se pudo guardar la preferencia.", "warning");
  }

  async function fijarPlantilla(templateId: string) {
    const plantilla = templates?.find((t) => t.id === templateId);
    if (!plantilla) return;
    try {
      const supabase = createClient();
      // El pin es por especialidad (así lo modela user_template_preferences), y
      // se fija en la de la PLANTILLA, no en la del médico: si un internista
      // elige una de urgencias, lo que quiso fijar es esa.
      await setTemplatePreference(supabase, {
        specialtyCode: plantilla.specialty,
        templateId,
      });
      // Los pines de OTRAS especialidades se retiran: aquí el médico está
      // eligiendo su plantilla, en singular. Dejar los viejos haría que mañana
      // ganara el más reciente y arrancara con otra sin haber tocado nada.
      const sobrantes = pins.filter((p) => p.templateId !== templateId);
      await Promise.all(
        sobrantes.map((p) =>
          clearTemplatePreference(supabase, p.specialtyCode).catch(() => {}),
        ),
      );
      await getTemplatePreferences(supabase).then(setPins).catch(() => {});
      showToast(`Tus consultas arrancarán con ${plantilla.name}.`, "success");
    } catch {
      showToast("No se pudo fijar la plantilla. Intenta de nuevo.", "warning");
    }
  }

  const servicios = serviciosDe(org);

  async function cambiarServicio(valor: string) {
    const ok = await update({ defaultServicio: valor === HEREDAR ? null : valor });
    if (!ok) showToast("No se pudo guardar el servicio.", "warning");
  }

  return (
    <>
      <SettingCard
        title="Al iniciar una consulta"
        description="Qué plantilla aparece ya seleccionada cuando empiezas a grabar."
      >
        <ChoiceGroup
          label="Plantilla al iniciar una consulta"
          value={modo}
          options={MODOS}
          onChange={(v) => void cambiarModo(v)}
        />

        {modo === "fixed" ? (
          <div className="mt-4 border-t border-line pt-4">
            {cargando ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Loader2 size={15} className="animate-spin" /> Cargando tus plantillas…
              </p>
            ) : errorPlantillas ? (
              <div className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5 text-sm text-warning">
                <p>{errorPlantillas}</p>
                <button
                  type="button"
                  onClick={() => void cargarPlantillas()}
                  className="mt-1.5 text-sm font-semibold underline"
                >
                  Reintentar
                </button>
              </div>
            ) : templates && templates.length ? (
              <>
                <ClinicalTemplatePicker
                  templates={templates}
                  specialtyCode={specialtyCode}
                  value={plantillaFijada}
                  onChange={(id) => void fijarPlantilla(id)}
                  label="Tu plantilla"
                  pinnedTemplateIds={pinnedTemplateIds(pins)}
                />
                {!plantillaFijada ? (
                  <p className="mt-2 text-xs text-warning">
                    Aún no has elegido cuál. Mientras tanto se sigue usando la
                    sugerida de tu especialidad.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted">
                Todavía no tienes plantillas disponibles.{" "}
                <Link
                  href="/app/plantillas"
                  className="font-semibold text-accent hover:underline"
                >
                  Ir al catálogo
                </Link>
              </p>
            )}
          </div>
        ) : null}
      </SettingCard>

      <SettingCard
        title="Servicio por defecto"
        description={
          org.name
            ? `Con qué servicio nacen tus consultas. La lista la define ${org.name}; tú eliges cuál es el tuyo.`
            : "Con qué servicio nacen tus consultas."
        }
      >
        <select
          aria-label="Servicio por defecto"
          className={inputClass}
          value={preferences.defaultServicio ?? HEREDAR}
          onChange={(e) => void cambiarServicio(e.target.value)}
        >
          <option value={HEREDAR}>
            El que use la institución ({servicios[0] ?? "Consulta externa"})
          </option>
          {servicios.map((servicio) => (
            <option key={servicio} value={servicio}>
              {servicio}
            </option>
          ))}
        </select>
        {/* Un servicio guardado que ya no está en la lista de la institución no
            se pierde en silencio: se avisa y se sigue usando el institucional,
            que es lo que hace servicioPreferidoDe(). */}
        {preferences.defaultServicio &&
        !servicios.includes(preferences.defaultServicio) ? (
          <p className="mt-2 text-xs text-warning">
            El servicio {preferences.defaultServicio} ya no está en la lista de
            tu institución, así que se está usando el de siempre. Elige otro.
          </p>
        ) : null}
      </SettingCard>
    </>
  );
}
