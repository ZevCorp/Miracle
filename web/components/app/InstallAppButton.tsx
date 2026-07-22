"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Botón "Instalar app" para el pie del sidebar.
 *
 * Registra el service worker y escucha `beforeinstallprompt`. Solo se muestra
 * cuando el navegador ofrece instalar la app y esta no está ya instalada /
 * abierta como aplicación (modo standalone). Requiere ejecutarse en cliente.
 */
export function InstallAppButton({ onNavigate }: { onNavigate?: () => void }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* La instalación puede seguir siendo posible; ignoramos el fallo. */
      });
    }

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) setInstalled(true);

    const onBeforeInstall = (event: Event) => {
      // Evita el mini-infobar por defecto para ofrecer la instalación desde el botón.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  const handleClick = async () => {
    const promptEvent = deferred;
    // El prompt solo puede usarse una vez; lo consumimos.
    setDeferred(null);
    await promptEvent.prompt();
    try {
      await promptEvent.userChoice;
    } catch {
      /* noop */
    }
    onNavigate?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-mist hover:bg-white/8 hover:text-white"
    >
      <Download size={16} />
      Instalar app
    </button>
  );
}
