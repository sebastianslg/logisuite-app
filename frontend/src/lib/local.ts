"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Preferencias que viven solo en este navegador (vistas guardadas, densidad de la tabla, avisos vistos).
 * - En el servidor y en la hidratación se usa el valor inicial: no hay diferencias entre HTML y cliente.
 * - Si el navegador bloquea localStorage (modo privado estricto), el valor vive en memoria esta sesión.
 * - Todas las pestañas y componentes que leen la misma clave se actualizan juntos.
 */
const EVENT = "westvane:local";
const memory = new Map<string, string>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function writeLocal<T>(key: string, value: T) {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    /* sin almacenamiento: queda en memoria */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useLocal<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const getSnapshot = () => {
    const raw = readRaw(key);
    const hit = cache.get(key);
    // Mismo texto, mismo objeto: useSyncExternalStore exige una instantánea estable
    if (hit && hit.raw === raw) return hit.value as T;
    let value: T = initial;
    if (raw !== null) {
      try {
        value = JSON.parse(raw) as T;
      } catch {
        value = initial;
      }
    }
    cache.set(key, { raw, value });
    return value;
  };
  const value = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = getSnapshot();
      writeLocal(key, typeof next === "function" ? (next as (p: T) => T)(prev) : next);
    },
    // getSnapshot solo depende de key e initial
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, set];
}
