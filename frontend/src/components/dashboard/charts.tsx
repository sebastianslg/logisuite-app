"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { ChartTooltip } from "./chart-tooltip";
import { MODE_ORDER, MODES } from "@/lib/modes";
import { EASE } from "@/lib/motion";
import type { DashboardSummary } from "@/lib/types";

const ease = EASE;

/**
 * Reparto modal (t-km): barra 100% apilada en el ORDEN FIJO de modos
 * validado para CVD, con 2 px de separación entre segmentos, tooltip por
 * segmento y leyenda con etiquetas directas (la identidad nunca es solo color).
 */
export function ModalSplit({ data }: { data: DashboardSummary["modal_split"] }) {
  const [hover, setHover] = useState<{ i: number; x: number } | null>(null);
  const byMode = new Map(data.map((d) => [d.mode, d]));
  const rows = MODE_ORDER.filter((m) => byMode.has(m)).map((m) => byMode.get(m)!);

  return (
    <div className="flex flex-col gap-5 px-5 pb-5">
      <div className="relative" onMouseLeave={() => setHover(null)}>
        <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded">
          {rows.map((r, i) => (
            <motion.div
              key={r.mode}
              initial={{ width: 0 }}
              animate={{ width: `${r.share_pct}%` }}
              transition={{ duration: 0.8, delay: 0.1 + i * 0.05, ease }}
              onMouseEnter={(e) => {
                const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                const seg = e.currentTarget.getBoundingClientRect();
                setHover({ i, x: seg.left - box.left + seg.width / 2 });
              }}
              className="h-full min-w-[3px] first:rounded-l last:rounded-r transition-opacity"
              style={{
                backgroundColor: MODES[r.mode].color,
                opacity: hover && hover.i !== i ? 0.45 : 1,
              }}
            />
          ))}
        </div>
        <ChartTooltip open={!!hover} x={hover?.x ?? 0} y={0}>
          {hover && (
            <>
              <div className="font-medium">{rows[hover.i].label}</div>
              <div className="tabular text-muted-foreground">
                {rows[hover.i].share_pct.toLocaleString("es-CO")} % · {rows[hover.i].tkm_fmt}
              </div>
            </>
          )}
        </ChartTooltip>
      </div>
      <ul className="grid grid-cols-1 gap-2.5">
        {rows.map((r) => {
          const Icon = MODES[r.mode].icon;
          return (
            <li key={r.mode} className="flex items-center gap-2.5 text-sm">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: MODES[r.mode].color }} />
              <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-[4.5rem] flex-1 truncate text-foreground/80">{r.label}</span>
              <span className="tabular text-xs whitespace-nowrap text-muted-foreground">{r.tkm_fmt}</span>
              <span className="tabular w-14 shrink-0 text-right font-medium whitespace-nowrap">
                {r.share_pct.toLocaleString("es-CO")} %
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Despachos por día (14 días): una sola serie, barras finas con tooltip. */
export function DispatchTrend({ data }: { data: DashboardSummary["dispatches_14d"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  const total = data.reduce((a, d) => a + d.count, 0);

  return (
    <div className="flex flex-1 flex-col px-5 pb-5">
      <div className="tabular text-2xl font-semibold tracking-tight">{total}</div>
      <div className="text-xs text-muted-foreground">despachos en 14 días</div>
      <div className="relative mt-4 flex h-28 items-end gap-1" onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div
            key={d.date}
            className="relative flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(i)}
          >
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
              transition={{ duration: 0.6, delay: i * 0.025, ease }}
              className="w-full rounded-t-[3px] transition-[opacity,background-color] duration-300 ease-apple"
              style={{
                backgroundColor: d.count ? "var(--sys-blue)" : "var(--color-fill)",
                opacity: hover === null || hover === i ? 1 : 0.4,
              }}
            />
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border-strong" />
        {hover !== null && (
          <ChartTooltip open x={`${((hover + 0.5) / data.length) * 100}%`} y={0}>
            <span className="font-medium">{fmt(data[hover].date)}</span>
            <span className="tabular ml-2 text-muted-foreground">{data[hover].count} despachos</span>
          </ChartTooltip>
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{fmt(data[0].date)}</span>
        <span>Hoy</span>
      </div>
    </div>
  );
}

/** Corredores con más toneladas: barras horizontales de una serie. */
export function TopCorridors({ data }: { data: DashboardSummary["top_corridors"] }) {
  const max = Math.max(1, ...data.map((d) => d.tons));
  return (
    <ul className="flex flex-col gap-3 px-5 pb-5">
      {data.map((d, i) => (
        <li key={d.corridor} className="group/row">
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-foreground/80">{d.corridor}</span>
            <span className="tabular shrink-0 text-xs font-medium">{d.tons_fmt}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-fill">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(d.tons / max) * 100}%` }}
              transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease }}
              className="h-full rounded-full bg-sys-blue"
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
