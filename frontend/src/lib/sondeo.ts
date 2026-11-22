"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Sondeo compartido de lecturas y reloj de la interfaz.
 *
 * Reglas (DESIGN.md: «lo que no se ve no trabaja»):
 *  - Una sola petición por URL aunque la pidan varios componentes a la vez. Los suscriptores comparten lectura,
 *    error y antigüedad; una petición en curso nunca se repite.
 *  - Se pausa con la pestaña oculta, sin red o cuando ningún componente visible necesita el dato (`ref` fuera de
 *    pantalla). Al volver, consulta enseguida si la lectura envejeció.
 *  - Cada petición se corta a los 10 s. Al desmontar la ruta o al ocultarse la pestaña se aborta la que esté en
 *    curso, sin contarla como fallo; la última lectura buena se conserva y se muestra mientras se reintenta.
 *  - Si la API falla, se espera el doble en cada intento (hasta 2 min); el error queda disponible para quien
 *    quiera avisarlo, pero el dato anterior no se pierde.
 *
 * El reloj (30 s) también es único para toda la app: lo comparten la hora del encabezado y el modo presentación,
 * y se detiene con la pestaña oculta.
 */

const TIMEOUT_MS = 10_000;
const MAX_BACKOFF_MS = 120_000;
const MIN_EVERY_MS = 1_000;

export interface LiveState<T> {
  data: T;
  /** La última petición falló (se conserva `data` si había una lectura anterior). */
  error: boolean;
  /** Momento de la última lectura buena (0 si aún no hay ninguna). */
  at: number;
}

type Snapshot = { data: unknown; error: boolean; at: number };
type Watcher = { every: number };

type Entry = {
  data: unknown;
  at: number;
  failures: number;
  /** Petición en curso; sirve de candado y de cancelación. */
  inflight: AbortController | null;
  timer: ReturnType<typeof setTimeout> | null;
  listeners: Set<() => void>;
  /** Componentes que necesitan el dato ahora, con el intervalo que pide cada uno. */
  watchers: Map<symbol, Watcher>;
  version: number;
  snapshot: Snapshot | null;
  snapshotVersion: number;
};

const entries = new Map<string, Entry>();

const pageVisible = () => typeof document === "undefined" || document.visibilityState === "visible";
const hasNetwork = () => typeof navigator === "undefined" || navigator.onLine !== false;

function ensure(url: string): Entry {
  let entry = entries.get(url);
  if (!entry) {
    entry = {
      data: undefined,
      at: 0,
      failures: 0,
      inflight: null,
      timer: null,
      listeners: new Set(),
      watchers: new Map(),
      version: 0,
      snapshot: null,
      snapshotVersion: -1,
    };
    entries.set(url, entry);
  }
  return entry;
}

function notify(entry: Entry) {
  entry.version += 1;
  entry.listeners.forEach((listener) => listener());
}

function clearTimer(entry: Entry) {
  if (entry.timer !== null) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
}

/** Intervalo efectivo: el más corto que pida alguien que esté mirando. */
function effectiveEvery(entry: Entry): number {
  let every = Number.POSITIVE_INFINITY;
  for (const watcher of entry.watchers.values()) every = Math.min(every, watcher.every);
  return Number.isFinite(every) ? Math.max(MIN_EVERY_MS, every) : 0;
}

const isActive = (entry: Entry) => entry.watchers.size > 0 && pageVisible() && hasNetwork();

function schedule(url: string, entry: Entry) {
  clearTimer(entry);
  // Mientras hay una petición en curso, su `finally` vuelve a programar: no se encima otro temporizador.
  if (entry.inflight || !isActive(entry)) return;
  const every = effectiveEvery(entry);
  if (!every) return;
  const wait = entry.failures ? Math.min(every * 2 ** Math.min(entry.failures, 3), MAX_BACKOFF_MS) : every;
  const delay = entry.failures ? wait : Math.max(0, entry.at + wait - Date.now());
  entry.timer = setTimeout(() => {
    entry.timer = null;
    void load(url, entry);
  }, delay);
}

/** Aborta la petición en curso sin contarla como error (pausa, desmontaje, cambio de pestaña). */
function pause(entry: Entry, reason: string) {
  clearTimer(entry);
  entry.inflight?.abort(reason);
}

async function load(url: string, entry: Entry) {
  if (entry.inflight || !isActive(entry)) return;
  const controller = new AbortController();
  entry.inflight = controller;
  clearTimer(entry);
  const timeout = setTimeout(() => controller.abort("timeout"), TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(String(res.status));
    entry.data = (await res.json()) as unknown;
    entry.at = Date.now();
    entry.failures = 0;
    notify(entry);
  } catch {
    // Pausar o desmontar no es un fallo de la API: no cuenta para la espera creciente ni para el aviso.
    const reason = controller.signal.reason;
    if (reason !== "pause" && reason !== "unmount" && reason !== "offline") {
      entry.failures = Math.min(entry.failures + 1, 8);
      notify(entry);
    }
  } finally {
    clearTimeout(timeout);
    if (entry.inflight === controller) entry.inflight = null;
    schedule(url, entry);
  }
}

function addWatcher(url: string, every: number) {
  const entry = ensure(url);
  const token = Symbol("watcher");
  entry.watchers.set(token, { every: Math.max(MIN_EVERY_MS, every) });
  if (!entry.inflight) {
    // Tras un fallo no se fuerza otra petición: se respeta la espera creciente.
    if (entry.data === undefined && entry.failures === 0) void load(url, entry);
    else schedule(url, entry);
  }
  return () => {
    if (!entry.watchers.delete(token)) return;
    if (entry.watchers.size === 0) pause(entry, "unmount");
    else schedule(url, entry);
  };
}

function subscribeTo(url: string, listener: () => void) {
  const entry = ensure(url);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
  };
}

const EMPTY_SNAPSHOT: Snapshot = { data: undefined, error: false, at: 0 };

function readSnapshot(url: string): Snapshot {
  const entry = entries.get(url);
  if (!entry) return EMPTY_SNAPSHOT;
  if (!entry.snapshot || entry.snapshotVersion !== entry.version) {
    entry.snapshot = { data: entry.data, error: entry.failures > 0, at: entry.at };
    entry.snapshotVersion = entry.version;
  }
  return entry.snapshot;
}

/** Guarda la lectura del servidor como primer dato (evita pedirla otra vez al montar). */
function seed(url: string, initial: unknown) {
  if (initial === undefined || initial === null) return;
  const entry = ensure(url);
  if (entry.data === undefined) {
    entry.data = initial;
    entry.at = Date.now();
  }
}

// Pestaña oculta: se detiene todo y se cancela lo que esté en curso. Visible de nuevo: se reanuda y, si el
// dato envejeció, se consulta de inmediato. Sin red, igual: se espera a que el navegador avise que volvió.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    const visible = pageVisible();
    entries.forEach((entry, url) => {
      if (!visible) pause(entry, "pause");
      else if (entry.watchers.size > 0) schedule(url, entry);
    });
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("offline", () => entries.forEach((entry) => pause(entry, "offline")));
  window.addEventListener("online", () => {
    entries.forEach((entry, url) => {
      if (entry.watchers.size > 0) schedule(url, entry);
    });
  });
}

function usePoll<T>(url: string | null, every: number, initial: T, ref?: React.RefObject<Element | null>): Snapshot {
  const initialSnapshot = useRef<Snapshot>({ data: initial, error: false, at: 0 });
  const initialRef = useRef(initial);
  // La lectura inicial del servidor solo se usa una vez por URL: si llega una nueva por un refresco de la
  // página, no debe pisar la última lectura del sondeo (que puede ser más reciente).
  useEffect(() => {
    initialRef.current = initial;
  }, [initial]);

  const subscribe = useCallback(
    (listener: () => void) => (url ? subscribeTo(url, listener) : () => {}),
    [url],
  );
  const getSnapshot = useCallback(() => (url ? readSnapshot(url) : initialSnapshot.current), [url]);
  const getServerSnapshot = useCallback(() => initialSnapshot.current, []);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!url) return;
    seed(url, initialRef.current);
    const element = ref?.current;
    if (!element) return addWatcher(url, every);
    let release: (() => void) | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !release) release = addWatcher(url, every);
        else if (!entry.isIntersecting && release) {
          release();
          release = null;
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      release?.();
    };
  }, [url, every, ref]);

  return snapshot;
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
  const snapshot = usePoll(url, every, initial, ref);
  return (snapshot.data ?? initial) as T;
}

/**
 * Como `useLive`, pero además dice si la última petición falló y cuándo fue la última lectura buena. Sirve
 * para el estado de la API en el dock (sin agregar otro sondeo: comparte el mismo por URL).
 */
export function useLiveState<T>(
  url: string | null,
  every: number,
  initial: T,
  ref?: React.RefObject<Element | null>,
): LiveState<T> {
  const snapshot = usePoll(url, every, initial, ref);
  return { data: (snapshot.data ?? initial) as T, error: snapshot.error, at: snapshot.at };
}

// ---- Reloj compartido de 30 s -------------------------------------------------------------

const CLOCK_EVERY_MS = 30_000;
let clockValue: Date | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;
const clockListeners = new Set<() => void>();

function tickClock() {
  clockValue = new Date();
  clockListeners.forEach((listener) => listener());
}

function startClock() {
  if (clockTimer !== null || typeof document === "undefined" || document.visibilityState !== "visible") return;
  clockTimer = setInterval(tickClock, CLOCK_EVERY_MS);
  tickClock();
}

function stopClock() {
  if (clockTimer !== null) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
}

function onClockVisibility() {
  if (document.visibilityState === "visible") startClock();
  else stopClock();
}

function subscribeClock(listener: () => void) {
  const first = clockListeners.size === 0;
  clockListeners.add(listener);
  if (first && typeof document !== "undefined") document.addEventListener("visibilitychange", onClockVisibility);
  startClock();
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0) {
      document.removeEventListener("visibilitychange", onClockVisibility);
      stopClock();
    }
  };
}

/**
 * Hora actual compartida, al día cada 30 s. Un solo temporizador para todos los componentes y detenido con la
 * pestaña oculta; al volver se actualiza en el acto. Devuelve `null` hasta que el navegador puede leer la hora
 * (el HTML del servidor no la fija).
 */
export function useLiveClock(): Date | null {
  return useSyncExternalStore(subscribeClock, () => clockValue, () => null);
}
