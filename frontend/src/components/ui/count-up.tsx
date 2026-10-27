"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";

import { EASE } from "@/lib/motion";

/**
 * Cifra que cuenta (es-CO, 900 ms con la curva base). Al montarse cuenta desde 0; cuando `value` cambia,
 * cuenta desde el valor que se veía (no vuelve a cero). Sin movimiento, muestra el valor final.
 * Solo cambia el texto del nodo (sin re-render de React por cuadro).
 */
export function CountUp({
  value,
  decimals = 0,
  suffix = "",
  duration = 0.9,
  delay = 0,
  format,
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
  delay?: number;
  /** Formato propio (por ejemplo, moneda); reemplaza a `decimals` y `suffix`. */
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const reduce = useReducedMotion();
  const fmt = (n: number) =>
    format ? format(n) : n.toLocaleString("es-CO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      shown.current = value;
      el.textContent = fmt(value);
      return;
    }
    const controls = animate(shown.current, value, {
      duration,
      delay,
      ease: EASE,
      onUpdate: (v) => {
        shown.current = v;
        el.textContent = fmt(v);
      },
    });
    return () => controls.stop();
    // fmt depende de format/decimals/suffix, que ya están en la lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals, suffix, duration, delay, reduce, format]);

  return (
    <span ref={ref} className={className} aria-label={fmt(value)}>
      {fmt(value)}
    </span>
  );
}
