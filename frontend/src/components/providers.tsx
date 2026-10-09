"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { Currency, FxRate } from "@/lib/types";

/**
 * Estado global de la interfaz:
 *  - Moneda de visualización (USD o COP). Los montos llegan de la API en USD
 *    y se convierten con la TRM configurada en /configuracion.
 *  - Nombre del operador: firma los cambios en el historial. No hay
 *    autenticación; es un nombre declarado que se guarda en este navegador.
 */
interface AppState {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  fx: FxRate | null;
  refreshFx: () => Promise<void>;
  operator: string;
  setOperator: (name: string) => void;
  /** Formatea un monto en USD en la moneda elegida. */
  money: (usd: number | null | undefined) => string;
}

const AppContext = createContext<AppState | null>(null);

const KEY_CURRENCY = "logisuite.currency";
const KEY_OPERATOR = "logisuite.operator";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Respaldo en memoria si el navegador bloquea localStorage
const memory = new Map<string, string>();
const PREF_EVENT = "logisuite:pref";

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
    () => read(key) ?? memory.get(key) ?? fallback,
    () => fallback,
  );
}

const group = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export function formatMoney(usd: number, currency: Currency, rate: number | null): string {
  if (currency === "COP" && rate) return `COP ${group.format(usd * rate)}`;
  return `US$ ${group.format(usd)}`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const storedCurrency = usePref(KEY_CURRENCY, "USD");
  const currency: Currency = storedCurrency === "COP" ? "COP" : "USD";
  const operator = usePref(KEY_OPERATOR, "");
  const [fx, setFx] = useState<FxRate | null>(null);

  const refreshFx = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (res.ok) setFx((await res.json()).fx);
    } catch {
      /* sin TRM: se sigue mostrando USD */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (alive && data) setFx(data.fx);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<AppState>(() => {
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
      money: (usd) => (usd === null || usd === undefined ? "N/D" : formatMoney(usd, effective, rate)),
    };
  }, [currency, fx, operator, refreshFx]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp debe usarse dentro de <AppProvider>");
  return ctx;
}
