"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

import type { Currency, FxRate } from "@/lib/types";

/**
 * Estado global de la interfaz:
 *  - Moneda de visualización (USD o COP). Los montos llegan de la API en USD
 *    y se convierten con la TRM configurada en /configuracion.
 *  - Nombre del operador: firma los cambios en el historial. No hay
 *    autenticación; es un nombre declarado que se guarda en este navegador.
 *
 * Estos valores NO viajan por el contexto: cada componente los lee de su almacén con useSyncExternalStore. Si el
 * contexto cambiara al llegar la TRM o al leer el navegador, los bloques <Suspense> que aún esperaban su HTML del
 * servidor recibirían esa actualización antes de hidratarse y React los volvería a pintar en el cliente, dejando
 * oculta una segunda copia (formularios con campos duplicados, intermitente según qué llegara antes).
 */
interface AppState {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  fx: FxRate | null;
  refreshFx: () => Promise<void>;
  operator: string;
  setOperator: (name: string) => void;
  /** Formatea un monto en USD en la moneda elegida. */
  money: (usd: number | null | undefined, compact?: boolean) => string;
}

const AppContext = createContext(false);

const KEY_CURRENCY = "westvane.currency";
const KEY_OPERATOR = "westvane.operator";
// Nombres anteriores de la app: se leen para no perder la preferencia de quien ya la tenía
const LEGACY: Record<string, string> = { [KEY_CURRENCY]: "logisuite.currency", [KEY_OPERATOR]: "logisuite.operator" };

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Respaldo en memoria si el navegador bloquea localStorage
const memory = new Map<string, string>();
const PREF_EVENT = "westvane:pref";

function write(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* almacenamiento no disponible: el valor vive solo en esta sesión */
  }
  window.dispatchEvent(new Event(PREF_EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(PREF_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(PREF_EVENT, cb);
  };
}

/** Preferencia guardada en este navegador (en el servidor, el valor por defecto). */
function usePref(key: string, fallback: string): string {
  return useSyncExternalStore(
    subscribe,
    () => read(key) ?? (LEGACY[key] ? read(LEGACY[key]) : null) ?? memory.get(key) ?? fallback,
    () => fallback,
  );
}

const group = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

const one = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

/** Formatea un monto en USD (la moneda del sistema) en la moneda elegida; `compact` abrevia millones. */
export function formatMoney(usd: number, currency: Currency, rate: number | null, compact = false): string {
  if (currency === "COP" && rate) {
    const cop = usd * rate;
    if (compact && Math.abs(cop) >= 1e9) return `COP ${one.format(cop / 1e9)} mil M`;
    if (compact && Math.abs(cop) >= 1e6) return `COP ${one.format(cop / 1e6)} M`;
    return `COP ${group.format(cop)}`;
  }
  if (compact && Math.abs(usd) >= 1e6) return `US$ ${one.format(usd / 1e6)} M`;
  return `US$ ${group.format(usd)}`;
}

// TRM: almacén fuera de React (se pide una vez al montar la app y al cambiarla en Configuración)
let fxState: FxRate | null = null;
const fxListeners = new Set<() => void>();
const subscribeFx = (cb: () => void) => {
  fxListeners.add(cb);
  return () => {
    fxListeners.delete(cb);
  };
};
async function refreshFx() {
  try {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (res.ok) {
      fxState = (await res.json()).fx;
      fxListeners.forEach((l) => l());
    }
  } catch {
    /* sin TRM: se sigue mostrando USD */
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void refreshFx();
  }, []);
  // El valor del contexto no cambia nunca: solo marca que el proveedor está montado
  return <AppContext.Provider value>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  if (!useContext(AppContext)) throw new Error("useApp debe usarse dentro de <AppProvider>");
  const storedCurrency = usePref(KEY_CURRENCY, "USD");
  const currency: Currency = storedCurrency === "COP" ? "COP" : "USD";
  const operator = usePref(KEY_OPERATOR, "");
  // Al hidratar, null como en el servidor; después, la TRM que haya llegado
  const fx = useSyncExternalStore(subscribeFx, () => fxState, () => null);

  return useMemo<AppState>(() => {
    const rate = fx?.rate ?? null;
    // Sin TRM configurada, COP no es posible: se muestra USD
    const effective: Currency = currency === "COP" && rate ? "COP" : "USD";
    return {
      currency: effective,
      setCurrency: (c) => write(KEY_CURRENCY, c),
      fx,
      refreshFx,
      operator,
      setOperator: (name) => write(KEY_OPERATOR, name),
      money: (usd, compact) => (usd === null || usd === undefined ? "N/D" : formatMoney(usd, effective, rate, compact)),
    };
  }, [currency, fx, operator]);
}
