"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CloudUpload, Moon, Search, Sun } from "lucide-react";
import { useStore } from "@/app/app/providers";
import { ActionDock } from "./ActionDock";
import { AmbientCanvas } from "./AmbientCanvas";
import { CursorLight } from "./CursorLight";
import { AppSidebar } from "./AppSidebar";
import { ConsultationPeek } from "./ConsultationPeek";
import { PatientPeek } from "./PatientPeek";
import { PeekProvider } from "./PeekProvider";
import { RunwayProvider } from "./SignRunway";
import { StartProvider } from "./StartContext";
import { BillingBanner } from "./BillingBanner";
import { MobileBottomNavigation } from "./MobileBottomNavigation";
import { MedicalChat } from "./MedicalChat";
import { QuickConsultationLauncher } from "./QuickConsultationLauncher";
import { CommandPalette } from "./CommandPalette";
import { PulseOrb } from "./PulseOrb";
import { HoverHint } from "@/components/ui/HoverHint";
import type { AuthenticatedProfile } from "@/lib/auth/server";
import { canAccessPath } from "@/lib/auth/roles";
import { visibleAppNav } from "@/lib/site";
import { applyTheme, watchSystemTheme } from "@/lib/theme";
import { restorePreferredMic } from "@/lib/stt/microphone-source";
import { signOut } from "@/app/login/actions";
import { Logo } from "@/components/brand/Logo";

/** Ruta que abre el lanzador rápido; decide si el botón debe existir. */
const RUTA_GRABACION = "/app/consultas/en-vivo";

function initials(profile: AuthenticatedProfile) {
  const words = (profile.fullName ?? profile.email).trim().split(/\s+/);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

export function AppShell({
  children,
  profile,
}: {
  children: ReactNode;
  profile: AuthenticatedProfile;
}) {
  const [cmdk, setCmdk] = useState(false);
  const pathname = usePathname();
  // El dock del escritorio abre la hoja del lanzador y el panel del asistente;
  // el estado vive aqui para que dock, FABs de movil y paneles compartan uno.
  const [quickOpen, setQuickOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { syncing } = useStore();

  const puedeGrabar = canAccessPath(profile.role, RUTA_GRABACION, profile.isDemo);
  // Misma fuente de verdad que el menu: si Configuracion no esta en su nav
  // (p. ej. la demo), la tarjeta del pie no debe enlazarla.
  const puedeAbrirConfiguracion = visibleAppNav(
    profile.uiRole,
    profile.professionalType,
    profile.isDemo,
    profile.orgKind,
  ).some((item) => item.href === "/app/configuracion");

  // Si aún no hay una elección explícita, el tema sigue los cambios del SO.
  useEffect(() => watchSystemTheme(), []);

  // El micrófono elegido en Configuración se reaplica en cada carga: el desvío
  // de getUserMedia vive en memoria, así que sin esto la preferencia duraría
  // hasta el primer refresco y el médico creería que no se guardó.
  useEffect(() => restorePreferredMic(), []);

  // El botón de la cabecera es un interruptor de dos posiciones: pasa a claro o
  // a oscuro, siempre explícito. Volver a "seguir al sistema" solo se puede
  // desde Configuración > Apariencia, porque es una tercera opción y este botón
  // no tiene sitio donde enseñarla sin volverse un menú.
  function toggleTheme() {
    applyTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
  }

  return (
    <PeekProvider>
    <RunwayProvider>
    <StartProvider
      value={{
        canStart: puedeGrabar,
        userId: profile.id,
        specialtyCode: profile.specialtyCode,
        openSheet: () => setQuickOpen(true),
      }}
    >
    <div className="app-shell flex min-h-screen">
      <AmbientCanvas />
      <CursorLight />
      <aside className="app-aside sticky top-0 hidden h-screen shrink-0 md:block">
        <div className="aside-float">
        <AppSidebar
          role={profile.uiRole}
          professionalType={profile.professionalType}
          isDemo={profile.isDemo}
          orgKind={profile.orgKind}
          profileName={profile.fullName ?? profile.email}
          specialtyName={profile.specialtyName}
          canOpenSettings={puedeAbrirConfiguracion}
        />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-bar app-mobile-header sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[var(--glass-edge)] px-3 md:h-16 md:gap-3 md:px-6">
          <Logo href="/app/dashboard" size={31} className="md:hidden [&>span]:hidden" />

          <button
            type="button"
            onClick={() => setCmdk(true)}
            className="clinical-control hidden w-[min(24rem,38vw)] items-center gap-2 px-3 text-sm text-muted sm:flex"
          >
            <Search size={15} />
            <span>Buscar paciente o consulta</span>
            <kbd className="ml-auto rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] font-medium">
              ⌘K
            </kbd>
          </button>

          {/* En móvil no hay ⌘K: la lupa abre el mismo buscador. */}
          <HoverHint label="Buscar paciente o consulta">
            <button
              type="button"
              aria-label="Buscar paciente o consulta"
              onClick={() => setCmdk(true)}
              className="icon-btn h-11 w-11 text-deep sm:hidden"
            >
              <Search size={19} />
            </button>
          </HoverHint>

          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            {syncing ? (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1.5 text-xs font-semibold text-warning"
              >
                <CloudUpload size={13} className="animate-pulse" />
                <span className="hidden sm:inline">Guardando cambios…</span>
              </span>
            ) : null}
            <HoverHint label="Cambiar entre modo claro y oscuro">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Cambiar entre modo claro y oscuro"
                className="icon-btn hidden sm:inline-flex"
              >
                <Moon size={18} className="theme-icon-light" />
                <Sun size={18} className="theme-icon-dark" />
              </button>
            </HoverHint>
            <PulseOrb />
            <form action={signOut} className="flex items-center gap-2">
              <span
                title={profile.fullName ?? profile.email}
                className="hidden h-9 w-9 items-center justify-center rounded-full bg-night text-sm font-semibold text-white sm:inline-flex"
              >
                {initials(profile)}
              </span>
              {/* Desde `md`, no desde `lg`: `md` es justo donde aparece el
                  sidebar y desaparece la barra inferior. Con el pie del sidebar
                  retirado, entre 768 y 1024 px no quedaba NINGUNA forma de
                  cerrar sesión — ni este botón, ni la hoja «Más». */}
              <button type="submit" className="hidden text-sm font-semibold text-muted hover:text-deep md:inline">
                Salir
              </button>
            </form>
          </div>
        </header>

        {/* Solo orgs personales: en un hospital paga la institución y el
            estado comercial no es asunto del médico. */}
        {profile.orgKind === "personal" && !profile.isDemo ? (
          <BillingBanner billing={profile.billing} />
        ) : null}

        <main className="app-main min-w-0 flex-1 px-3 py-5 sm:px-5 sm:py-6 md:px-8 md:py-9">
          {/* La key remonta el contenido por SECCION (pathname), no por query:
              paginar o filtrar no parpadea; cambiar de seccion respira. */}
          <div key={pathname} className="page-enter">
            {children}
          </div>
        </main>
      </div>

      <MobileBottomNavigation profile={profile} onToggleTheme={toggleTheme} />

      {/* El lanzador rápido solo aparece si la cuenta puede LLEGAR a la
          grabación. Se pregunta a canAccessPath en vez de repetir la regla aquí:
          es la misma función que aplica el proxy, así que el botón y el permiso
          no pueden desincronizarse.

          Aquí vivía también un botón flotante de "Conectar Omi", encima de la
          pantalla clínica en todo momento y en toda pantalla. Se retiró: el
          emparejamiento vive en Configuración > Audio y dispositivos, y en la
          consulta queda un punto de estado dentro del panel de grabación
          (OmiStatusDot), que es donde el médico mira cuando el Omi le importa.

          Antes se mostraba a todo el que no fuera secretaría, incluido un
          administrador —que no puede grabar—. El botón sí creaba el encounter
          en la API y el proxy rebotaba después: quedaba un encounter huérfano y
          la pantalla se movía sin explicación. */}
      {puedeGrabar ? (
        <QuickConsultationLauncher
          userId={profile.id}
          specialtyCode={profile.specialtyCode}
          open={quickOpen}
          onOpenChange={setQuickOpen}
        />
      ) : null}

      {/* El asistente clínico sí lo usan administrador y supervisor (consultar
          sobre notas del equipo); solo la secretaría, de solo lectura, no. */}
      {profile.role !== "secretaria" ? (
        <MedicalChat open={chatOpen} onOpenChange={setChatOpen} />
      ) : null}

      {/* El dock no decide permisos: solo refleja los mismos gates de arriba. */}
      <ActionDock
        canStart={puedeGrabar}
        canAssist={profile.role !== "secretaria"}
        userId={profile.id}
        specialtyCode={profile.specialtyCode}
        onStartConsultation={() => setQuickOpen(true)}
        onOpenAssistant={() => setChatOpen(true)}
      />
      <CommandPalette open={cmdk} onOpenChange={setCmdk} />
      {/* El panel rápido vive al final del shell: por encima del contenido,
          por debajo del asistente (z 60 < 80). */}
      <ConsultationPeek />
      <PatientPeek />
    </div>
    </StartProvider>
    </RunwayProvider>
    </PeekProvider>
  );
}
