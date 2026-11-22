"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Vuelve a pedir los datos de la página cada N segundos, solo con la pestaña a la vista y con red. El temporizador
 * es encadenado (no `setInterval`): no se acumulan refrescos si uno tarda, se detiene al ocultar la pestaña o al
 * desmontar, y al volver solo refresca si lo que se ve quedó viejo. Sin conexión no se insiste; al recuperarla se
 * consulta en cuanto toca.
 */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const every = Math.max(5, seconds) * 1_000;
    let timer: number | null = null;
    let last = Date.now();
    let stopped = false;

    const clear = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
    const canRefresh = () => !stopped && document.visibilityState === "visible" && navigator.onLine !== false;
    const refresh = () => {
      if (!canRefresh()) return;
      // Evita ráfagas cuando coinciden la vuelta a la pestaña, la red y el temporizador.
      if (Date.now() - last < every - 1_000) return;
      last = Date.now();
      router.refresh();
    };
    const schedule = (delay = every) => {
      clear();
      if (!canRefresh()) return;
      timer = window.setTimeout(() => {
        timer = null;
        try {
          refresh();
        } finally {
          schedule();
        }
      }, Math.max(0, delay));
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") schedule(Math.max(0, every - (Date.now() - last)));
      else clear();
    };
    const onOnline = () => schedule(0);
    const onOffline = () => clear();

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      stopped = true;
      clear();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [router, seconds]);
  return null;
}
