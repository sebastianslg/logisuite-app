"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Coincidencia de una media query (false en el servidor y en la hidratación). */
export function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
