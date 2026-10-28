"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { useApp } from "@/components/providers";
import { CountUp } from "@/components/ui/count-up";
import { Delta, Sparkline } from "@/components/ui/sparkline";
import type { Trends } from "@/lib/types";
import { cn } from "@/lib/utils";

export type Secondary = { label: string; value: string; href: string; hint?: string };

/**
 * Estado de la operación: las tres cifras que más importan (envíos en ruta, retrasos y costo acumulado en
 * tránsito) en grande, y debajo, tras una línea fina, las secundarias en una fila compacta. Todo en una sola
 * superficie: se lee de un vistazo, como el encabezado de un informe. La fila secundaria usa
 * las mismas columnas que las cifras, para que las líneas verticales coincidan. Cada cifra abre la vista filtrada.
 * Las cifras cuentan al cargar y, cuando cambian, desde el valor anterior. Debajo de cada una, la tendencia de
 * 14 días (cierre de cada día) y el cambio frente a la semana anterior.
 */
export function HeroFigures({
  inTransit,
  delayed,
  cost,
  secondary = [],
  trends,
}: {
  inTransit: number;
  delayed: number;
  cost: number;
  secondary?: Secondary[];
  trends?: Trends;
}) {
  const { money } = useApp();
  const series = trends?.series ?? [];
  const dates = series.map((d) => d.date);
  const items = [
    {
      label: "Envíos en ruta", value: inTransit, href: "/envios?estado=En Ruta,Transferencia Modal,Retrasado",
      trend: series.map((d) => d.in_transit), change: trends?.week_vs_prev.in_transit ?? null, good: "none" as const,
    },
    {
      label: "Con retraso", value: delayed, href: "/envios?estado=Retrasado", danger: delayed > 0,
      trend: series.map((d) => d.delayed), change: trends?.week_vs_prev.delayed ?? null, good: "down" as const,
    },
    {
      label: "Costo comprometido en tránsito", value: cost, href: "/envios?estado=En Ruta,Transferencia Modal,Retrasado", money: true,
      trend: series.map((d) => d.cost_in_transit), change: trends?.week_vs_prev.cost_in_transit ?? null, good: "none" as const,
    },
  ];
  return (
    <section aria-label="Estado de la operación" className="glass mb-6 overflow-hidden rounded-3xl">
      {/* Celular: en ruta y retraso lado a lado, el costo a lo ancho. Escritorio: las tres en fila. */}
      <div className="-ml-px grid grid-cols-2 md:grid-cols-[1fr_1fr_1.4fr]">
        {items.map((it, i) => (
          <Link
            key={it.label}
            href={it.href}
            data-ripple
            className={cn(
              "group/hero block min-w-0 border-l border-border px-5 py-5 outline-none transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--card)_97%,var(--foreground))] focus-visible:ring-[3px] focus-visible:ring-ring/80 focus-visible:ring-inset md:px-7 md:py-7",
              i === 2 && "col-span-2 border-t md:col-span-1 md:border-t-0",
            )}
          >
            <span className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground">
              {it.label}
              <ChevronRight
                className="size-3.5 opacity-0 transition-opacity duration-200 group-hover/hero:opacity-60 motion-reduce:transition-none"
                aria-hidden
              />
            </span>
            <CountUp
              value={it.value}
              format={it.money ? (n) => money(n, true) : undefined}
              className={cn(
                "tabular mt-3 block text-[2.5rem] leading-[0.95] font-semibold tracking-[-0.045em] md:text-[clamp(2.25rem,3.6vw,3.75rem)]",
                it.danger && "text-destructive",
              )}
            />
            {it.trend.length > 1 && (
              <div className="mt-4 flex flex-col gap-1.5">
                <Sparkline
                  values={it.trend}
                  dates={dates}
                  format={it.money ? (n) => money(n, true) : undefined}
                  color={it.danger ? "var(--danger)" : "var(--accent)"}
                  label={`${it.label}, últimos 14 días: de ${it.money ? money(it.trend[0], true) : it.trend[0]} a ${it.money ? money(it.trend.at(-1) ?? 0, true) : it.trend.at(-1)}`}
                  className="max-w-[16rem]"
                />
                <Delta pct={it.change} good={it.good} />
              </div>
            )}
          </Link>
        ))}
      </div>
      {secondary.length > 0 && (
        <ul className="-ml-px grid grid-cols-1 border-t border-border sm:grid-cols-3 md:grid-cols-[1fr_1fr_1.4fr]">
          {secondary.map((s) => (
            <li key={s.label} className="border-l border-border not-first:border-t sm:not-first:border-t-0">
              <Link
                href={s.href}
                data-ripple
                className="flex items-baseline justify-between gap-3 px-6 py-3.5 outline-none transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--card)_97%,var(--foreground))] focus-visible:ring-[3px] focus-visible:ring-ring/80 focus-visible:ring-inset md:px-7"
              >
                <span className="min-w-0 truncate text-[13px] text-muted-foreground">
                  {s.label}
                  {s.hint && <span> · {s.hint}</span>}
                </span>
                <span className="tabular shrink-0 text-[0.9375rem] font-semibold">{s.value}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
