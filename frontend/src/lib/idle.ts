/**
 * Ejecuta `cb` cuando el navegador quede libre (como máximo tras `timeout` ms). Devuelve cómo cancelarlo.
 * Safari no tiene requestIdleCallback: ahí se usa un temporizador corto.
 */
export function onIdle(cb: () => void, timeout = 400): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(cb, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, Math.min(timeout, 80));
  return () => window.clearTimeout(id);
}
