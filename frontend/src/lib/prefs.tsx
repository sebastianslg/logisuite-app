"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

/**
 * Apariencia de la persona (Sistema / Claro / Oscuro). Se guarda en este navegador (localStorage);
 * sin elección guardada, la app usa el tema claro. La moneda y la TRM viven en <AppProvider>.
 */
export type ThemePref = "system" | "light" | "dark";

const K_THEME = "westvane.theme";

interface Prefs {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  /** Apariencia efectiva (resuelve "Sistema"). */
  resolved: "light" | "dark";
}

const Ctx = createContext(false);

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento: la preferencia vale solo en esta sesión */
  }
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
const getTheme = (): ThemePref => {
  const t = read(K_THEME);
  return t === "system" || t === "dark" ? t : "light";
};
const subscribeScheme = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getSystemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

/**
 * El proveedor no lleva el tema en su valor (que no cambia nunca): cada componente lo lee con usePrefs. Así, al
 * hidratar con el tema oscuro guardado, ningún bloque <Suspense> pendiente recibe una actualización antes de
 * hidratarse (ver providers.tsx).
 */
export function PrefsProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  if (!useContext(Ctx)) throw new Error("usePrefs debe usarse dentro de <PrefsProvider>");
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light" as ThemePref);
  const systemDark = useSyncExternalStore(subscribeScheme, getSystemDark, () => false);

  // Cambiar de apariencia funde la página vieja con la nueva en 250 ms (View Transitions: solo opacidad). Es un
  // gesto raro y deliberado; con "reducir movimiento" o sin soporte del navegador el cambio es inmediato.
  const setTheme = useCallback((t: ThemePref) => {
    const apply = () => {
      write(K_THEME, t);
      document.documentElement.setAttribute("data-theme", t);
      flushSync(emit);
    };
    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) apply();
    else document.startViewTransition(apply);
  }, []);

  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  return useMemo(() => ({ theme, setTheme, resolved }), [theme, setTheme, resolved]);
}

/** Script que fija la apariencia elegida antes del primer pintado (evita el destello). */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${K_THEME}");if(t==="system"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
