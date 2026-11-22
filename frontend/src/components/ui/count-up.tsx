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
  unitClassName,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
  delay?: number;
  /** Formato propio (por ejemplo, moneda); reemplaza a `decimals` y `suffix`. */
  format?: (n: number) => string;
  className?: string;
  /** Con esta clase, lo que no es número («US$ », « t», « %») va en su propio tramo: más pequeño y atenuado. */
  unitClassName?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const parts = useRef<(HTMLSpanElement | null)[]>([]);
  const shown = useRef(0);
  const reduce = useReducedMotion();
  const fmt = (n: number) =>
    format ? format(n) : n.toLocaleString("es-CO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;

  /** «US$ 195.734» → ["US$ ", "195.734", ""]: el texto antes del primer dígito, el número y lo que sigue. */
  const split = (t: string): [string, string, string] => {
    const m = t.match(/^([^\d-]*)(-?[\d.,\s]*\d)(.*)$/);
    return m ? [m[1], m[2], m[3]] : ["", t, ""];
  };
  const paint = (el: HTMLSpanElement, n: number) => {
    const t = fmt(n);
    if (!unitClassName) {
      el.textContent = t;
      return;
    }
    split(t).forEach((x, i) => {
      const node = parts.current[i];
      if (node) node.textContent = x;
    });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      shown.current = value;
      paint(el, value);
      return;
    }
    const controls = animate(shown.current, value, {
      duration,
      delay,
      ease: EASE,
      onUpdate: (v) => {
        shown.current = v;
        paint(el, v);
      },
    });
    return () => controls.stop();
    // fmt depende de format/decimals/suffix, que ya están en la lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals, suffix, duration, delay, reduce, format, unitClassName]);

  if (unitClassName) {
    const [pre, num, post] = split(fmt(value));
    return (
      <span ref={ref} className={className} aria-label={fmt(value)}>
        <span aria-hidden ref={(n) => { parts.current[0] = n; }} className={unitClassName}>{pre}</span>
        <span aria-hidden ref={(n) => { parts.current[1] = n; }}>{num}</span>
        <span aria-hidden ref={(n) => { parts.current[2] = n; }} className={unitClassName}>{post}</span>
      </span>
    );
  }

  return (
    <span ref={ref} className={className} aria-label={fmt(value)}>
      {fmt(value)}
    </span>
  );
}
