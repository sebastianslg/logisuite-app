"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Datos "en vivo" que se consultan cada cierto tiempo, con el menor gasto posible:
 *  - Un solo sondeo por URL aunque la usen varios componentes (resumen, mapa, flota).
 *  - Se pausa con la pestaña oculta y, si se pasa un `ref`, mientras el bloque está fuera de pantalla.
 *    Al volver a verse, consulta enseguida si el dato quedó viejo.
 *  - Nunca hay dos peticiones a la vez para la misma URL y cada una se corta a los 10 s.
 *  - Si la API falla, se conserva la última lectura y se espera el doble (hasta 2 min) antes de reintentar.
 */
type Entry = {
  data: unknown;
  at: number;
  inflight: boolean;
  failures: number;
  listeners: Set<() => void>;
  /** Componentes que lo necesitan ahora (visibles en pantalla). */
  watchers: number;
  timer: ReturnType<typeof setTimeout> | null;
  every: number;
};

const entries = new Map<string, Entry>();
const TIMEOUT_MS = 10_000;

function entry(url: string, every: number): Entry {
  let e = entries.get(url);
  if (!e) {
    e = { data: undefined, at: 0, inflight: false, failures: 0, listeners: new Set(), watchers: 0, timer: null, every };
    entries.set(url, e);
  }
  e.every = Math.min(e.every, every);
  return e;
}

const pageVisible = () => typeof document === "undefined" || document.visibilityState === "visible";

async function load(url: string, e: Entry) {
  if (e.inflight) return;
  e.inflight = true;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(String(res.status));
    e.data = await res.json();
    e.at = Date.now();
    e.failures = 0;
    e.listeners.forEach((l) => l());
  } catch {
    e.failures += 1;
  } finally {
    e.inflight = false;
    schedule(url, e);
  }
}

function schedule(url: string, e: Entry) {
  if (e.timer) clearTimeout(e.timer);
  e.timer = null;
  if (e.watchers <= 0 || !pageVisible()) return;
  const wait = Math.min(e.every * 2 ** Math.min(e.failures, 3), 120_000);
  const due = Math.max(0, e.at + wait - Date.now());
  e.timer = setTimeout(() => load(url, e), e.failures ? wait : due);
}

// Pestaña oculta: se detiene todo. Visible de nuevo: se reanuda (y consulta si el dato envejeció).
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    entries.forEach((e, url) => {
      if (!pageVisible()) {
        if (e.timer) clearTimeout(e.timer);
        e.timer = null;
      } else {
        schedule(url, e);
      }
    });
  });
}

/** Guarda la lectura del servidor como primer dato (evita pedirla otra vez al montar). */
function seed(url: string, every: number, initial: unknown) {
  const e = entry(url, every);
  if (e.data === undefined && initial !== undefined && initial !== null) {
    e.data = initial;
    e.at = Date.now();
  }
}

function subscribeTo(url: string | null, cb: () => void) {
  if (!url) return () => {};
  const e = entries.get(url);
  e?.listeners.add(cb);
  return () => {
    e?.listeners.delete(cb);
  };
}

const snapshotOf = (url: string | null) => (url ? entries.get(url)?.data : undefined);

/** Un componente empieza a necesitar el dato: arranca el sondeo. Devuelve cómo dejar de necesitarlo. */
function watch(url: string) {
  const e = entries.get(url);
  if (!e) return () => {};
  e.watchers += 1;
  if (e.data === undefined) load(url, e);
  else schedule(url, e);
  return () => {
    e.watchers -= 1;
    if (e.watchers <= 0 && e.timer) {
      clearTimeout(e.timer);
      e.timer = null;
    }
  };
}

/**
 * Lee `url` cada `every` ms mientras se vea (`url` null: no consulta nada). `initial` es la lectura del
 * servidor (evita pedirla dos veces). Con `ref`, el sondeo se detiene mientras ese elemento está fuera de
 * pantalla.
 */
export function useLive<T>(
  url: string | null,
  every: number,
  initial: T,
  ref?: React.RefObject<Element | null>,
): T {
  if (url) seed(url, every, initial);
  const data = useSyncExternalStore(
    useCallback((cb: () => void) => subscribeTo(url, cb), [url]),
    () => snapshotOf(url) as T | undefined,
    () => initial,
  );

  useEffect(() => {
    if (!url) return;
    const el = ref?.current;
    if (!el) return watch(url);
    let release: (() => void) | null = null;
    const io = new IntersectionObserver(
      ([x]) => {
        if (x.isIntersecting && !release) release = watch(url);
        else if (!x.isIntersecting && release) {
          release();
          release = null;
        }
      },
      { rootMargin: "100px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      release?.();
    };
  }, [url, ref]);

  return (data ?? initial) as T;
}
