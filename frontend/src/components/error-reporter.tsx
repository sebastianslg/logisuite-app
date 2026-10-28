"use client";

import { useEffect } from "react";

/** Mensajes del navegador o de extensiones que no son fallas de la app. */
const NOISE = /ResizeObserver loop|Script error\.?$|chrome-extension:|moz-extension:|AbortError|The user aborted/i;
const MAX_PER_PAGE = 5;

/**
 * Envía al servidor los errores de JavaScript que ocurren en este navegador (mensaje, pila y la página sin
 * parámetros), para enterarse de un fallo sin que nadie lo reporte. Como mucho 5 por carga y sin repetir el
 * mismo mensaje. Se ven en Configuración › Errores recientes.
 */
export function ErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>();
    const report = (message: string, stack?: string) => {
      if (!message || NOISE.test(message) || NOISE.test(stack ?? "") || seen.has(message) || seen.size >= MAX_PER_PAGE) return;
      seen.add(message);
      const body = JSON.stringify({
        path: window.location.pathname,
        message: message.slice(0, 1000),
        stack: stack?.slice(0, 4000),
        release: process.env.NEXT_PUBLIC_RELEASE || undefined,
      });
      // sendBeacon sobrevive a que la página se cierre; si no está, fetch sin esperar respuesta
      const blob = new Blob([body], { type: "application/json" });
      if (!navigator.sendBeacon?.("/api/client-errors", blob)) {
        void fetch("/api/client-errors", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
      }
    };
    const onError = (e: ErrorEvent) => report(e.message, e.error instanceof Error ? e.error.stack : `${e.filename}:${e.lineno}:${e.colno}`);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      report(r instanceof Error ? `${r.name}: ${r.message}` : String(r), r instanceof Error ? r.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
