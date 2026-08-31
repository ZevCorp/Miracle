"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronUp, Loader2, Mic, Sparkles } from "lucide-react";
import { HoverHint } from "@/components/ui/HoverHint";
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
  type TemplateContext,
} from "@/lib/clinical/template-prefetch";

/**
 * El dock del escritorio: UNA cápsula de vidrio abajo a la derecha con las dos
 * únicas acciones que merecen estar siempre a mano — iniciar una consulta y
 * abrir el asistente.
 *
 * EXPERIMENTO "un clic": cuando el sistema ya sabe con qué plantilla arranca
 * este médico (su fijada, o la última que usó), el botón lo dice — «Iniciar ·
 * Cita de rutina» — y el clic crea el encounter y abre el micrófono SIN pasar
 * por la hoja de confirmación. El caret de al lado conserva el camino largo
 * para cambiar de plantilla. Si no hay preselección (modo manual, catálogo
 * vacío, backend caído), el botón degrada al comportamiento clásico: abrir la
 * hoja. Nunca un error visible por culpa del atajo.
 *
 * Los permisos no viven aquí: llegan resueltos del AppShell (canStart espeja
 * canAccessPath; canAssist el gating de la secretaría).
 */

/** Rutas donde grabar no aplica — espejo de QuickConsultationLauncher. */
const SIN_INICIAR = new Set([
  "/app/consultas/en-vivo",
  "/app/consultas/nueva",
  "/app/plantillas",
]);

/** Rutas donde el asistente flotante no aplica — espejo de MedicalChat. */
const SIN_ASISTENTE = new Set(["/app/consultas/en-vivo", "/app/plantillas"]);

export function ActionDock({
  canStart,
  canAssist,
  userId,
  specialtyCode,
  onStartConsultation,
  onOpenAssistant,
}: {
  canStart: boolean;
  canAssist: boolean;
  userId?: string | null;
  specialtyCode?: string | null;
  onStartConsultation: () => void;
  onOpenAssistant: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { guardedNavigate } = useNavigationGuard();
  const { preferences } = useUserPreferences();
  const supabase = useMemo(() => createClient(), []);

  const muestraIniciar = canStart && !SIN_INICIAR.has(pathname);
  const muestraAsistente = canAssist && !SIN_ASISTENTE.has(pathname);

  const [contexto, setContexto] = useState<TemplateContext | null>(null);
  const [starting, setStarting] = useState(false);

  // Precalentar el catálogo apenas el botón existe. Un fallo deja `contexto`
  // en null y el dock simplemente se queda con el camino clásico.
  useEffect(() => {
    if (!muestraIniciar) return;
    let vigente = true;
    void getTemplateContext(supabase)
      .then((ctx) => vigente && setContexto(ctx))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [muestraIniciar, supabase]);

  const preseleccion = useMemo(() => {
    if (!contexto) return null;
    const id = pickPreselectedTemplate({
      templates: contexto.templates,
      preferences: contexto.preferences,
      lastUsedId: readLastTemplateId(userId),
      specialtyCode,
      mode: preferences.templateStartMode,
    });
    if (!id) return null;
    const template = contexto.templates.find((t) => t.id === id);
    return template ? { id, nombre: template.name } : null;
  }, [contexto, userId, specialtyCode, preferences.templateStartMode]);

  if (!muestraIniciar && !muestraAsistente) return null;

  async function iniciarDirecto() {
    if (!preseleccion || starting) return;
    setStarting(true);
    try {
      const result = await createClinicalEncounter({
        patient_id: null,
        consultation_type: "presencial",
        template_id: preseleccion.id,
      });
      rememberTemplateId(userId, preseleccion.id);
      invalidateTemplateContext();
      const params = new URLSearchParams({
        encounter: result.encounter_id,
        record: "1",
      });
      guardedNavigate(() =>
        router.push(`/app/consultas/en-vivo?${params.toString()}`),
      );
    } catch {
      // El atajo nunca muestra su propio error: se degrada a la hoja, que ya
      // sabe contar qué pasó si el médico reintenta desde ahí.
      setStarting(false);
      onStartConsultation();
    }
  }

  return (
    <div className="glass-panel fixed bottom-5 right-5 z-50 hidden items-center gap-1.5 rounded-full p-1.5 md:flex">
      {muestraIniciar ? (
        preseleccion ? (
          <span className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => void iniciarDirecto()}
              disabled={starting}
              title={`Grabar ya con la plantilla ${preseleccion.nombre}`}
              className="clinical-primary min-h-11 max-w-[21rem] rounded-r-md px-5"
              data-light
            >
              {starting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Preparando…
                </>
              ) : (
                <>
                  <Mic size={16} />
                  <span className="truncate">
                    Iniciar · {preseleccion.nombre}
                  </span>
                </>
              )}
            </button>
            <HoverHint label="Elegir otra plantilla">
              <button
                type="button"
                onClick={onStartConsultation}
                disabled={starting}
                aria-label="Elegir plantilla para la consulta"
                className="clinical-primary min-h-11 rounded-l-md px-2"
              >
                <ChevronUp size={16} />
              </button>
            </HoverHint>
          </span>
        ) : (
          <button
            type="button"
            onClick={onStartConsultation}
            className="clinical-primary min-h-11 px-5"
            data-light
          >
            <Mic size={16} /> Iniciar consulta
          </button>
        )
      ) : null}

      {muestraIniciar && muestraAsistente ? (
        <span aria-hidden className="h-6 w-px bg-line/70" />
      ) : null}

      {muestraAsistente ? (
        <HoverHint label="Asistente clínico" side="top">
          <button
            type="button"
            onClick={onOpenAssistant}
            aria-label="Abrir asistente clínico"
            className="icon-btn h-11 w-11 text-accent"
          >
            <Sparkles size={19} />
          </button>
        </HoverHint>
      ) : null}
    </div>
  );
}
