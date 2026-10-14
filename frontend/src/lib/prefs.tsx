"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

/**
 * Preferencias de la persona: apariencia (Sistema / Claro / Oscuro) y moneda (USD / COP con TRM editable).
 * Se guardan en este navegador (localStorage); si no está disponible, la app funciona con los valores por defecto.
 */
export type ThemePref = "system" | "light" | "dark";
export type Currency = "USD" | "COP";

/** TRM de referencia (COP por USD) hasta que la persona fije la suya. Es un valor editable, no una cotización. */
export const DEFAULT_TRM = 4000;

const K_THEME = "westvane.theme";
const K_CURRENCY = "westvane.currency";
const K_TRM = "westvane.trm";

interface Prefs {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  /** Apariencia efectiva (resuelve "Sistema"). */
  resolved: "light" | "dark";
  currency: Currency;
  setCurrency: (c: Currency) => void;
  trm: number;
  setTrm: (n: number) => void;
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

// Almacén externo sobre localStorage: se lee sin efectos y se notifica a quien lo escucha.
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
const getCurrency = (): Currency => (read(K_CURRENCY) === "COP" ? "COP" : "USD");
const getTrm = (): number => {
  const r = Number(read(K_TRM));
  return Number.isFinite(r) && r > 0 ? r : DEFAULT_TRM;
};

const subscribeScheme = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getSystemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "system" as ThemePref);
  const currency = useSyncExternalStore(subscribe, getCurrency, () => "USD" as Currency);
  const trm = useSyncExternalStore(subscribe, getTrm, () => DEFAULT_TRM);
  const systemDark = useSyncExternalStore(subscribeScheme, getSystemDark, () => true);

  const setTheme = useCallback((t: ThemePref) => {
    write(K_THEME, t);
    const root = document.documentElement;
    if (t === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", t);
    emit();
  }, []);
  const setCurrency = useCallback((c: Currency) => {
    write(K_CURRENCY, c);
    emit();
  }, []);
  const setTrm = useCallback((n: number) => {
    if (!Number.isFinite(n) || n <= 0) return;
    write(K_TRM, String(n));
    emit();
  }, []);

  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const value = useMemo(
    () => ({ theme, setTheme, resolved, currency, setCurrency, trm, setTrm }),
    [theme, setTheme, resolved, currency, setCurrency, trm, setTrm],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs debe usarse dentro de <PrefsProvider>");
  return v;
}

/** Script que fija la apariencia elegida antes del primer pintado (evita el destello). */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${K_THEME}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

// --- Formato de dinero (es-CO) ---------------------------------------------
const int = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

/** Formatea un monto en USD (la moneda del sistema) en la moneda elegida. `compact` abrevia millones. */
export function formatMoney(usd: number, currency: Currency, trm: number, compact = false): string {
  if (currency === "USD") {
    if (compact && Math.abs(usd) >= 1e6) return `US$ ${one.format(usd / 1e6)} M`;
    return `US$ ${int.format(usd)}`;
  }
  const cop = usd * trm;
  if (compact && Math.abs(cop) >= 1e9) return `$ ${one.format(cop / 1e9)} mil M`;
  if (compact && Math.abs(cop) >= 1e6) return `$ ${one.format(cop / 1e6)} M`;
  return `$ ${int.format(cop)}`;
}

export function useMoney() {
  const { currency, trm } = usePrefs();
  return useMemo(
    () => ({
      currency,
      trm,
      fmt: (usd: number, compact = false) => formatMoney(usd, currency, trm, compact),
      /** Lo mismo en la otra moneda, para el tooltip. */
      other: (usd: number) => formatMoney(usd, currency === "USD" ? "COP" : "USD", trm),
    }),
    [currency, trm],
  );
}
