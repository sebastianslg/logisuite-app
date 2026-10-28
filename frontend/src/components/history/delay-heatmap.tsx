"use client";

import { useMemo, useState } from "react";

import { ModeIcon } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { History } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
/** Cinco pasos de un solo tono (como el mapa por departamento); sin retraso, gris neutro. */
// El último paso es el acento pleno: es el único con texto blanco y así llega a 4,6:1 (en oscuro, 4,9:1)
const STEPS = [14, 30, 48, 68, 100];
const fill = (step: number) => (step < 0 ? "var(--fill)" : `color-mix(in srgb, var(--accent-solid) ${STEPS[step]}%, var(--card))`);
const h = (v: number) => `${v.toLocaleString("es-CO", { maximumFractionDigits: 1 })} h`;

/**
 * Mapa de calor de retrasos: vías (filas) por día de salida (columnas), con las horas de retraso acumuladas por
 * los envíos que pasaron por cada vía. Un solo tono en cinco pasos por cuantiles. Es una tabla de verdad: los
 * lectores de pantalla la recorren celda a celda y cada celda dice su valor.
 */
export function DelayHeatmap({ delays }: { delays: History["delays"] }) {
  const [active, setActive] = useState<{ row: number; day: number } | null>(null);
  // Cortes por quintiles sin repetir (con pocos valores distintos hay menos de cinco clases)
  const breaks = useMemo(() => {
    const vals = delays.flatMap((d) => d.hours).filter((v) => v > 0).sort((a, b) => a - b);
    if (!vals.length) return [];
    const qs = [0.2, 0.4, 0.6, 0.8].map((q) => vals[Math.min(vals.length - 1, Math.floor(q * vals.length))]);
    return qs.filter((b, i) => b < vals[vals.length - 1] && (i === 0 || b !== qs[i - 1]));
  }, [delays]);
  // Clase k (0..breaks.length) llevada a los cinco tonos, para que la mayor siempre sea el acento pleno
  const tone = (k: number) => (breaks.length ? Math.round((k * (STEPS.length - 1)) / breaks.length) : STEPS.length - 1);
  const step = (v: number) => (v <= 0 ? -1 : tone(breaks.filter((b) => v > b).length));

  if (!delays.length)
    return (
      <div className="glass rounded-3xl">
        <EmptyState figure="0" title="Sin retrasos en esta ventana" description="Ningún envío que salió en estos días acumuló horas de retraso." />
      </div>
    );

  const detail = active ? delays[active.row] : null;
  return (
    <section className="glass rounded-3xl p-5" aria-labelledby="delays-title">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="delays-title" className="text-sm font-semibold">
          Retrasos por vía y día de salida
        </h2>
        {/* Detalle de la celda bajo el puntero o con el foco */}
        <p className="tabular min-h-5 text-xs text-muted-foreground" aria-live="polite">
          {detail && active
            ? detail.hours[active.day] > 0
              ? `${detail.corridor}, salidas del ${DAY_NAMES[active.day]}: ${h(detail.hours[active.day])} en ${detail.shipments[active.day]} ${detail.shipments[active.day] === 1 ? "envío" : "envíos"}`
              : `${detail.corridor}, salidas del ${DAY_NAMES[active.day]}: sin retraso`
            : "Pasa el puntero por una celda para ver el detalle"}
        </p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th scope="col" className="px-2 py-1 text-left font-medium text-muted-foreground">Vía</th>
              {DAYS.map((d) => (
                <th key={d} scope="col" className="w-[9%] px-1 py-1 text-center font-medium text-muted-foreground">
                  {d}
                </th>
              ))}
              <th scope="col" className="px-2 py-1 text-right font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {delays.map((d, row) => (
              <tr key={d.corridor}>
                <th scope="row" className="max-w-[16rem] px-2 py-1 text-left font-normal">
                  <span className="flex items-center gap-2">
                    <ModeIcon mode={d.mode} />
                    <span className="truncate text-[13px]">{d.corridor}</span>
                  </span>
                </th>
                {d.hours.map((v, day) => {
                  const s = step(v);
                  return (
                    <td
                      key={day}
                      tabIndex={v > 0 ? 0 : -1}
                      onPointerEnter={() => setActive({ row, day })}
                      onPointerLeave={() => setActive(null)}
                      onFocus={() => setActive({ row, day })}
                      onBlur={() => setActive(null)}
                      aria-label={`${DAY_NAMES[day]}: ${v > 0 ? h(v) : "sin retraso"}`}
                      className={cn(
                        "tabular h-9 rounded-md text-center outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80",
                        // Blanco solo en el paso más oscuro: en los intermedios no llega a 4,5:1 sobre el tono claro
                        s === STEPS.length - 1 ? "font-medium text-white" : "text-foreground",
                        active?.row === row && active.day === day && "ring-2 ring-foreground",
                      )}
                      style={{ backgroundColor: fill(s) }}
                    >
                      {v > 0 ? v.toLocaleString("es-CO", { maximumFractionDigits: 0 }) : ""}
                    </td>
                  );
                })}
                <td className="tabular px-2 text-right font-medium">{h(d.total_h)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Horas de retraso</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ background: fill(-1) }} aria-hidden /> Sin retraso
        </span>
        {Array.from({ length: breaks.length + 1 }, (_, k) => (
          <span key={k} className="tabular inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: fill(tone(k)) }} aria-hidden />
            {breaks.length === 0
              ? "con retraso"
              : k === 0
                ? `hasta ${h(breaks[0])}`
                : k === breaks.length
                  ? `más de ${h(breaks[k - 1])}`
                  : `${h(breaks[k - 1])}–${h(breaks[k])}`}
          </span>
        ))}
      </div>
      <p className="mt-3 max-w-[70ch] text-xs text-muted-foreground">
        Cada envío retrasado suma sus horas de retraso en cada vía de su ruta, en la columna del día en que salió: muestra
        dónde se concentran los envíos con problemas, no qué vía los causó. Las 12 vías con más horas.
      </p>
    </section>
  );
}
