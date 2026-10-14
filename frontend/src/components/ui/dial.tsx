"use client";

import { motion, useReducedMotion } from "framer-motion";

import { CountUp } from "@/components/ui/count-up";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Dial circular de progreso. El arco se dibuja de 0 al valor final al montarse
 * (el cambio posterior de `value` también se anima) y el centro cuenta hasta la cifra.
 * `value` y `max` están en la misma unidad; el arco se limita a 0–100 %.
 */
export function Dial({
  value,
  max = 100,
  color = "var(--sys-blue)",
  label,
  sublabel,
  size = 168,
  stroke = 12,
  decimals = 0,
  suffix = " %",
  className,
}: {
  value: number;
  max?: number;
  color?: string;
  label: string;
  sublabel?: React.ReactNode;
  size?: number;
  stroke?: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.min(Math.max(value / max, 0), 1);

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value * 10) / 10}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - frac) : c }}
          animate={{ strokeDashoffset: c * (1 - frac) }}
          transition={{ duration: 1, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <CountUp value={value} decimals={decimals} suffix={suffix} className="tabular text-3xl font-bold tracking-tight" />
        {sublabel && <span className="mt-0.5 max-w-[70%] text-xs leading-tight text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  );
}

/** Barra de eco-eficiencia horizontal que crece de 0 a su valor (0–100 % de `max`). */
export function EcoBar({
  value,
  max,
  color,
  delay = 0,
  className,
}: {
  value: number;
  max: number;
  color: string;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const pct = Math.min(Math.max((value / (max || 1)) * 100, 0), 100);
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-fill", className)} aria-hidden>
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: reduce ? `${pct}%` : 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: EASE, delay }}
      />
    </div>
  );
}
