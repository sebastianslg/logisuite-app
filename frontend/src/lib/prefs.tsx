"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

/**
 * Apariencia de la persona (Sistema / Claro / Oscuro). Se guarda en este navegador (localStorage);
 * si no está disponible, la app sigue el sistema. La moneda y la TRM viven en <AppProvider>.
 */
export type ThemePref = "system" | "light" | "dark";

const K_THEME = "westvane.theme";

interface Prefs {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  /** Apariencia efectiva (resuelve "Sistema"). */
  resolved: "light" | "dark";
}

const Ctx = createContext<Prefs | null>(null);

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
  return t === "light" || t === "dark" ? t : "system";
};
const subscribeScheme = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getSystemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "system" as ThemePref);
  const systemDark = useSyncExternalStore(subscribeScheme, getSystemDark, () => true);

  const setTheme = useCallback((t: ThemePref) => {
    write(K_THEME, t);
    const root = document.documentElement;
    if (t === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", t);
    emit();
  }, []);

  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const value = useMemo(() => ({ theme, setTheme, resolved }), [theme, setTheme, resolved]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs debe usarse dentro de <PrefsProvider>");
  return v;
}

/** Script que fija la apariencia elegida antes del primer pintado (evita el destello). */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${K_THEME}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
