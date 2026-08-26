"use client";

// Control flotante de conexión Omi, junto al botón "Grabar consulta". Vive
// fuera de la consulta a propósito: el médico conecta el Omi una vez desde
// el panel principal y esa conexión (contexto global, ver
// lib/omi/useOmiMicrophone.tsx) sigue viva al entrar a grabar, así el acceso
// rápido (que arranca grabando solo) ya usa el Omi sin pausar para elegirlo.

import { useEffect, useRef } from "react";
import { Bluetooth, HelpCircle, Loader2 } from "lucide-react";
import { useOmiMicrophone } from "@/lib/omi/useOmiMicrophone";
import { ANDROID_PERMISO } from "@/lib/omi/messages";
import { isAndroid } from "@/lib/omi/platform";
import { useStore } from "@/app/app/providers";

export function OmiFloatingWidget() {
  const omi = useOmiMicrophone();
  const { showToast } = useStore();
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (omi.error && omi.error !== lastErrorRef.current) {
      showToast(omi.error, "warning");
    }
    lastErrorRef.current = omi.error;
  }, [omi.error, showToast]);

  // A diferencia de QuickConsultationLauncher, este control NO se oculta en
  // la consulta en vivo: desde que DictationPanel dejó de tener su propio
  // botón de conectar, este es el único lugar para emparejar el Omi, y
  // justo ahí (a mitad de una consulta) es donde más falta puede hacer.
  if (!omi.supported) return null;

  return (
    <div className="fixed bottom-[calc(9.5rem+env(safe-area-inset-bottom,0px))] right-3 z-50 flex items-center gap-1.5 md:bottom-[4.75rem] md:right-44">
      {/* Android exige un permiso de sistema aparte ("Dispositivos cercanos")
          que Chrome no siempre pide con claridad la primera vez — de ahí que
          el diálogo pareciera no aparecer. Este aviso lo adelanta antes de
          que el médico tenga que adivinar clicando enlaces de error. */}
      {isAndroid() && !omi.isConnected ? (
        <button
          type="button"
          // "warning" (no "info") a propósito: dura el doble (6.5 s en vez de
          // 3.2 s), y este texto es demasiado largo para leerlo en 3 s.
          onClick={() => showToast(ANDROID_PERMISO, "warning")}
          aria-label="Ayuda para conectar Omi en Android"
          title="Ayuda para conectar Omi en Android"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-[var(--shadow-md)] hover:bg-ice-soft hover:text-deep"
        >
          <HelpCircle size={15} />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => (omi.isConnected ? omi.disconnect() : void omi.connect().catch(() => {}))}
        disabled={omi.connecting}
        aria-label={omi.isConnected ? "Desconectar Omi" : "Conectar Omi"}
        title={omi.isConnected ? "Omi conectado — clic para desconectar" : "Conectar el collar Omi como micrófono"}
        className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-[var(--shadow-md)] transition-colors active:scale-[0.98] disabled:opacity-70 ${
          omi.isConnected
            ? "border-success/35 bg-success-soft text-success"
            : "border-line bg-surface text-deep hover:bg-ice-soft"
        }`}
      >
        {omi.connecting ? <Loader2 size={14} className="animate-spin" /> : <Bluetooth size={14} />}
        {omi.connecting ? "Conectando…" : omi.isConnected ? "Omi conectado" : "Conectar Omi"}
      </button>
    </div>
  );
}
