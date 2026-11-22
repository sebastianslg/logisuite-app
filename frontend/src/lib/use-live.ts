"use client";

/**
 * Punto de entrada histórico del sondeo compartido. La implementación vive en `sondeo.ts`:
 * una sola petición por URL, pausa con la pestaña oculta o sin red, cancelación al desmontar y espera
 * creciente si la API falla, conservando siempre la última lectura buena.
 */
export { useLive, useLiveState, useLiveClock } from "@/lib/sondeo";
export type { LiveState } from "@/lib/sondeo";
