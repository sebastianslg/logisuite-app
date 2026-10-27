"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";

import { EASE } from "@/lib/motion";

/** Cifra que cuenta desde 0 hasta su valor al montarse (es-CO). Sin movimiento, muestra el valor final. */
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
  const reduce = useReducedMotion();
  const fmt = (n: number) =>
    format ? format(n) : n.toLocaleString("es-CO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = fmt(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      delay,
      ease: EASE,
      onUpdate: (v) => {
        el.textContent = fmt(v);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals, suffix, duration, delay, reduce]);

  return (
    <span ref={ref} className={className} aria-label={fmt(value)}>
      {fmt(value)}
    </span>
  );
}
