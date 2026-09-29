"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { BrandSphere } from "@/components/brand/BrandSphere";
import { HoldToStart, type HoldToStartHandle } from "@/components/app/HoldToStart";
import { useStart } from "@/components/app/StartContext";
import { useNavigationGuard } from "@/components/app/UnsavedChangesProvider";
import { useUserPreferences } from "@/lib/preferences/client";
import { createClient } from "@/lib/supabase/client";
import { createClinicalEncounter } from "@/lib/api/clinical";
import {
  pickPreselectedTemplate,
  readLastTemplateId,
  rememberTemplateId,
} from "@/lib/clinical/template-preferences";
import {
  getTemplateContext,
  invalidateTemplateContext,
} from "@/lib/clinical/template-prefetch";

/**
 * La superficie de arranque de la Jornada: el orbe que se MANTIENE pulsado.
 *
 * Mantener el orbe (o la barra espaciadora) 600 ms llena el anillo y arranca
 * la grabación DIRECTO con la plantilla preseleccionada — cero diálogos entre
 * el médico y el micrófono. Un clic corto abre la hoja de siempre (elegir
 * plantilla), que también es el destino de todo fallo: backend caído o sin
 * preselección degradan en silencio, jamás un error por culpa del atajo.
 *
 * El listener de Espacio vive aquí (solo montado = solo en el Inicio del
 * médico) con guards estrictos: nada si hay un campo enfocado, un diálogo
 * abierto (peek, pista, hoja) o teclas modificadoras. La paleta ⌘K no tiene
 * aria-modal, pero su buscador roba el foco, así que el guard de activeElement
 * la cubre.
 */
export function StartSurface() {
  const start = useStart();
  const router = useRouter();
  const { guardedNavigate } = useNavigationGuard();
  const { preferences } = useUserPreferences();
  const supabase = useMemo(() => createClient(), []);
  const holdRef = useRef<HoldToStartHandle>(null);

  const [nombrePlantilla, setNombrePlantilla] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!start?.canStart) return;
    let vigente = true;
    void getTemplateContext(supabase)
      .then(({ templates, preferences: prefs }) => {
        if (!vigente) return;
        const id = pickPreselectedTemplate({
          templates,
          preferences: prefs,
          lastUsedId: readLastTemplateId(start.userId),
          specialtyCode: start.specialtyCode,
          mode: preferences.templateStartMode,
        });
        const t = id ? templates.find((x) => x.id === id) : undefined;
        setTemplateId(t ? id : null);
        setNombrePlantilla(t?.name ?? null);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [start?.canStart, start?.userId, start?.specialtyCode, supabase, preferences.templateStartMode]);

  function abrirHoja() {
    if (start) start.openSheet();
    else router.push("/app/consultas/nueva");
  }

  async function arrancarDirecto() {
    if (starting) return;
    if (!templateId) {
      abrirHoja();
      return;
    }
    setStarting(true);
    try {
      const result = await createClinicalEncounter({
        patient_id: null,
        consultation_type: "presencial",
        template_id: templateId,
      });
      rememberTemplateId(start?.userId, templateId);
      invalidateTemplateContext();
      const params = new URLSearchParams({
        encounter: result.encounter_id,
        record: "1",
      });
      guardedNavigate(() =>
        router.push(`/app/consultas/en-vivo?${params.toString()}`),
      );
    } catch {
      setStarting(false);
      abrirHoja();
    }
  }

  // Espacio = mantener el orbe sin tocar el ratón.
  useEffect(() => {
    function onDown(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const activo = document.activeElement;
      const enTrigger = activo instanceof HTMLElement && activo.closest("[data-start-surface]");
      if (activo && activo !== document.body && !enTrigger) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault(); // sin esto, Espacio hace scroll
      holdRef.current?.press();
    }
    function onUp(event: KeyboardEvent) {
      if (event.code === "Space") holdRef.current?.release();
    }
    function onBlur() {
      // Alt-Tab a mitad del hold: soltar, no dejar el anillo pegado.
      holdRef.current?.release();
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  if (start && !start.canStart) return null;

  return (
    <section
      data-start-surface
      className="clinical-panel flex flex-col items-center gap-3 px-6 py-7 text-center"
      data-light
    >
      <HoldToStart
        ref={holdRef}
        onComplete={() => void arrancarDirecto()}
        onTap={abrirHoja}
        disabled={starting}
        label={
          nombrePlantilla
            ? `Mantén pulsado para grabar con la plantilla ${nombrePlantilla}; clic corto para elegir otra`
            : "Iniciar consulta"
        }
      >
        <span className="p-2.5">
          <BrandSphere size={96} wordmark={false} />
        </span>
      </HoldToStart>

      <div>
        <p className="font-display text-[1.05rem] font-[650] tracking-[-0.02em] text-deep">
          {starting ? "Preparando la consulta…" : "Mantén para comenzar"}
        </p>
        {/* Los DOS gestos del orbe, siempre a la vista. Sacar la plantilla a su
            propia pieza no debe costar la pista del clic corto: sin ella el
            único sitio donde se anuncia es el aria-label, que no se ve. */}
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {starting ? (
            " "
          ) : (
            <>
              o mantén <Tecla>espacio</Tecla> · clic corto para elegir{" "}
              {nombrePlantilla ? "otra plantilla" : "la plantilla"}
            </>
          )}
        </p>
      </div>

      {/* CON QUÉ va a arrancar. Va en su propia pieza y no dentro de la frase:
          es el único dato que el médico necesita comprobar ANTES de mantener
          el orbe, y perdido en una línea de texto corrido no se comprobaba.
          Se pulsa para cambiarla. */}
      {!starting && nombrePlantilla ? (
        <button
          type="button"
          onClick={abrirHoja}
          className="clinical-panel-muted group mt-1 flex w-full max-w-sm items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:border-accent/40"
        >
          <FileText size={17} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="doc-label block">Plantilla</span>
            <span className="mt-0.5 line-clamp-2 block text-[13px] font-semibold leading-snug text-deep">
              {nombrePlantilla}
            </span>
          </span>
          <span className="shrink-0 text-[12px] font-semibold text-accent group-hover:underline">
            Cambiar
          </span>
        </button>
      ) : null}
    </section>
  );
}

function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-pearl px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft">
      {children}
    </kbd>
  );
}
