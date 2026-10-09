import { TrafficCone } from "lucide-react";

import { MODE_ORDER, MODES } from "@/lib/modes";

const STYLE: Record<string, string> = {
  terrestre: "Carretera",
  fluvial: "Río",
  maritimo: "Mar",
  aereo: "Vuelo",
  ferreo: "Ferrocarril",
};

/** Leyenda de capas: muestra de línea + ícono + texto (identidad nunca solo color). */
export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-300">
      {MODE_ORDER.map((m) => {
        const Icon = MODES[m].icon;
        return (
          <span key={m} className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-5 rounded-full"
              style={
                m === "ferreo"
                  ? { backgroundImage: `repeating-linear-gradient(90deg, ${MODES[m].color} 0 5px, transparent 5px 8px)` }
                  : m === "aereo"
                    ? { background: `linear-gradient(90deg, ${MODES[m].color}, #22d3ee)` }
                    : { backgroundColor: MODES[m].color }
              }
            />
            <Icon className="size-3" style={{ color: MODES[m].color }} />
            {STYLE[m]}
          </span>
        );
      })}
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-0.5 w-5 rounded-full"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, #fb7185 0 3px, transparent 3px 6px)" }}
        />
        <TrafficCone className="size-3 text-neon-rose" />
        Cerrada
      </span>
    </div>
  );
}
