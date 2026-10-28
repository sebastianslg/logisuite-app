"use client";

import { useId, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Línea fina de tendencia (una sola serie, sin ejes): 1,5 px, extremos redondeados y un punto en el último
 * valor. Al pasar el puntero muestra el día y el valor; sin puntero, el resumen va en `label` para lectores.
 * Escala de 0 al máximo (no del mínimo), para no exagerar cambios pequeños.
 */
export function Sparkline({
  values,
  dates,
  format = (n) => n.toLocaleString("es-CO"),
  label,
  color = "var(--muted-foreground)",
  className,
  height = 32,
}: {
  values: number[];
  dates: string[];
  format?: (n: number) => string;
  label: string;
  color?: string;
  className?: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId();
  const w = 100;
  const max = Math.max(1, ...values);
  const n = values.length;
  const x = (i: number) => (n <= 1 ? w : (i / (n - 1)) * w);
  const y = (v: number) => height - 2 - (v / max) * (height - 6);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const active = hover ?? n - 1;
  const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" });

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        className="block h-8 w-full overflow-visible"
        role="img"
        aria-label={label}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
        }}
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.14" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L${w},${height} L0,${height} Z`} fill={`url(#${gid})`} />
        <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* El punto va fuera del SVG estirado para que siga siendo un círculo */}
      <span
        aria-hidden
        className="pointer-events-none absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--card)]"
        style={{ left: `${x(active)}%`, top: `${(y(values[active] ?? 0) / height) * 100}%`, backgroundColor: color }}
      />
      {hover !== null && (
        <span
          role="status"
          className="tabular pointer-events-none absolute -top-7 z-10 -translate-x-1/2 rounded-md bg-foreground px-1.5 py-0.5 text-[11px] whitespace-nowrap text-background"
          style={{ left: `${Math.min(92, Math.max(8, x(hover)))}%` }}
        >
          {day(dates[hover])} · {format(values[hover])}
        </span>
      )}
    </div>
  );
}

/** Variación frente a la semana anterior, con flecha. `good` dice qué dirección es buena (o ninguna). */
export function Delta({
  pct,
  good = "none",
  suffix = "vs. semana anterior",
  className,
}: {
  pct: number | null;
  good?: "up" | "down" | "none";
  suffix?: string;
  className?: string;
}) {
  if (pct === null || !Number.isFinite(pct))
    return <span className={cn("text-[12px] text-muted-foreground", className)}>Sin período anterior para comparar</span>;
  const flat = Math.abs(pct) < 0.5;
  const up = pct > 0;
  const tone = flat || good === "none" ? "text-muted-foreground" : (up === (good === "up")) ? "text-success" : "text-destructive";
  const Arrow = flat ? ArrowRight : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("tabular inline-flex items-center gap-1 text-[12px]", tone, className)}>
      <Arrow className="size-3.5 shrink-0" aria-hidden />
      {flat ? "Igual" : `${up ? "Sube" : "Baja"} ${Math.abs(pct).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`}
      {suffix && <span className="text-muted-foreground">{suffix}</span>}
    </span>
  );
}
