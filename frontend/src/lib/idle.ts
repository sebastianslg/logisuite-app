/**
 * Momento libre del navegador. `requestIdleCallback` no existe en Safari: ahí se usa un temporizador corto.
 */

/** Ejecuta `cb` cuando el navegador quede libre (como máximo tras `timeout` ms). Devuelve cómo cancelarlo. */
export function onIdle(cb: () => void, timeout = 400): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(cb, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, Math.min(timeout, 80));
  return () => window.clearTimeout(id);
}

/** Chromium sabe si hay una entrada sin atender; los demás navegadores no lo dicen y se asume que no. */
export function isInputPending(): boolean {
  const scheduling = (navigator as Navigator & { scheduling?: { isInputPending?: () => boolean } }).scheduling;
  try {
    return scheduling?.isInputPending?.() === true;
  } catch {
    return false;
  }
}

/** Entradas que cuentan como actividad: si el usuario toca, escribe, desplaza o pulsa, la espera vuelve a empezar. */
const ACTIVITY = ["pointerdown", "keydown", "touchstart", "touchmove", "wheel", "scroll"] as const;

/** Reintento con espera creciente cuando hay un modal abierto o la pestaña oculta (200 → 400 → 800 → 2000 ms). */
const RETRY_MIN = 200;
const RETRY_MAX = 2_000;
/** Tope de aplazamiento: aunque el usuario no deje de interactuar, el trabajo caro se hace al quedar libre la entrada. */
const MAX_DEFER = 15_000;

export interface QuietOptions {
  /** Cuánto tiene que llevar la página sin actividad antes de ejecutar (fracción de «libre»). */
  quiet?: number;
  /** Tope de `requestIdleCallback`: aunque el navegador no quede libre del todo, se vuelve a evaluar. */
  timeout?: number;
  /** Reintentos cuando el turno llega por vencimiento (el navegador seguía ocupado). */
  retries?: number;
  /** Condición extra para ejecutar: si devuelve `false`, se reintenta más tarde. */
  when?: () => boolean;
}

/**
 * Ejecuta `cb` cuando la página ya cargó, la pestaña está visible, el navegador lleva `quiet` ms sin actividad del
 * usuario, no hay una entrada pendiente y el navegador está en un momento libre (o, tras unos intentos, al menos lo
 * parece). Con actividad nueva, la espera se reinicia; crear el mapa no es urgente.
 *
 * Pasado `MAX_DEFER` desde la carga, la calma deja de exigirse: si alguien no deja de interactuar, el trabajo se hace
 * igualmente en cuanto no haya una entrada pendiente. Un modal abierto o la pestaña oculta sí lo aplazan (nada caro
 * debe compilarse debajo de un diálogo o fuera de pantalla), con reintentos de espera creciente.
 *
 * Es para trabajo caro que puede esperar: crear el contexto WebGL del mapa 3D bloquea el hilo principal más
 * de un segundo y, si cae encima de un toque o de la paleta de búsqueda (Ctrl K), arruina el INP. Mientras
 * tanto se ve la red dibujada en plano.
 */
export function onQuiet(cb: () => void, { quiet = 1_500, timeout = 1_000, retries = 3, when }: QuietOptions = {}): () => void {
  if (typeof window === "undefined") return () => {};

  let last = performance.now();
  let capAt = Infinity;
  let backoff = RETRY_MIN;
  let attempts = 0;
  let done = false;
  let loaded = false;
  let idleId: number | null = null;
  let timer: number | null = null;
  let loadTimer: number | null = null;

  const mark = () => {
    last = performance.now();
  };

  const stop = () => {
    for (const type of ACTIVITY) window.removeEventListener(type, mark, true);
    window.removeEventListener("load", onLoad);
    document.removeEventListener("visibilitychange", onVisibility);
    if (idleId !== null) window.cancelIdleCallback(idleId);
    if (timer !== null) window.clearTimeout(timer);
    if (loadTimer !== null) window.clearTimeout(loadTimer);
    idleId = null;
    timer = null;
    loadTimer = null;
  };

  const finish = () => {
    if (done) return;
    done = true;
    stop();
    cb();
  };

  const retry = (wait: number) => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(schedule, Math.max(RETRY_MIN, wait));
  };

  const check = (deadline?: IdleDeadline) => {
    idleId = null;
    if (done) return;
    const now = performance.now();
    const left = quiet - (now - last);
    // Pasado el tope, la calma deja de exigirse: el mapa no puede quedarse esperando a que alguien deje de usar la app.
    const forced = now >= capAt;
    const hidden = document.visibilityState !== "visible";
    const modal = when ? !when() : false;
    // Oculto o debajo de un diálogo modal no se crea: se reintenta con espera creciente, sin sondear cada 200 ms.
    if (hidden || modal) {
      retry(backoff);
      backoff = Math.min(backoff * 2, RETRY_MAX);
      return;
    }
    // Una entrada en cola (Chromium) o un turno nacido por vencimiento (el navegador seguía trabajando): un respiro
    // corto. Es el caso de alguien interactuando sin parar; pasado el tope, este es el único motivo que queda.
    const pending = isInputPending();
    if (pending || (!forced && left > 0) || (deadline?.didTimeout === true && attempts <= retries)) {
      retry(pending || deadline?.didTimeout === true ? RETRY_MIN : Math.min(left, 400));
      return;
    }
    finish();
  };

  function schedule() {
    if (done) return;
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    if (idleId !== null) {
      window.cancelIdleCallback(idleId);
      idleId = null;
    }
    attempts += 1;
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(check, { timeout });
    } else {
      // Safari: no hay forma de saber si hay una entrada pendiente; un respiro corto y a comprobar la calma
      timer = window.setTimeout(() => check(), 60);
    }
  }

  // Al volver a la pestaña se reevalúa de inmediato, sin esperar al reintento con espera creciente.
  function onVisibility() {
    if (done || document.visibilityState !== "visible") return;
    backoff = RETRY_MIN;
    schedule();
  }

  function onLoad() {
    if (loaded) return;
    loaded = true;
    if (loadTimer !== null) {
      window.clearTimeout(loadTimer);
      loadTimer = null;
    }
    // La calma se cuenta desde que la página terminó de cargar: el trabajo de arranque ya quedó atrás.
    last = performance.now();
    capAt = last + MAX_DEFER;
    schedule();
  }

  for (const type of ACTIVITY) window.addEventListener(type, mark, { capture: true, passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  if (document.readyState === "complete") {
    onLoad();
  } else {
    window.addEventListener("load", onLoad, { once: true });
    // Si `load` se queda colgado (un recurso que no responde), el mapa no espera para siempre
    loadTimer = window.setTimeout(onLoad, 10_000);
  }

  return () => {
    done = true;
    stop();
  };
}
