"use client";

import { useEffect, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

import { cn } from "@/lib/utils";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/**
 * Registra el service worker (solo en producción: en desarrollo estorbaría con el HMR) y avisa cuando el navegador pierde la
 * red. El aviso entra y sale con transform y opacity; el servidor sigue siendo el único dueño de los datos, así que sin red
 * no se guarda nada y el aviso lo dice.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sin service worker la app funciona igual; solo se pierde la página de respaldo sin conexión */
    });
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={online}
      className={cn(
        "pointer-events-none fixed inset-x-0 top-3 z-[70] flex justify-center px-4 transition-[transform,opacity] duration-300 motion-reduce:transition-none",
        online ? "-translate-y-6 opacity-0" : "translate-y-0 opacity-100",
      )}
    >
      <span className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
        <WifiOff className="size-4" aria-hidden />
        {online ? "" : "Sin conexión: los cambios no se guardarán hasta que vuelva"}
      </span>
    </div>
  );
}
