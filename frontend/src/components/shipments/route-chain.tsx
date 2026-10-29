import { ArrowRightLeft } from "lucide-react";

import { MODES } from "@/lib/modes";
import type { Leg, Transfer } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * La cadena de modos de un envío, dibujada: cada tramo es una barra del color de su modo, de largo
 * proporcional a su tiempo, con lo recorrido relleno; los transbordos marcan el cambio de modo.
 */
export function RouteChain({
  legs,
  transfers,
  progressPct,
}: {
  legs: Leg[];
  transfers: Transfer[];
  progressPct: number;
}) {
  if (legs.length === 0) return null;
  const totalH = legs[legs.length - 1].end_h || 1;
  const doneH = (Math.min(Math.max(progressPct, 0), 100) / 100) * totalH;
  /** Transbordo que ocurre entre el tramo anterior y este: en el mismo nodo, antes de que arranque el tramo. */
  const transferAt = (leg: Leg, prev: Leg) =>
    transfers.find((t) => t.node.code === leg.from.code && t.start_h >= prev.end_h - 1e-3 && t.start_h <= leg.start_h + 1e-3);

  return (
    <div className="overflow-x-auto pb-2" role="group" aria-label="Cadena de modos del envío">
      <ol className="flex min-w-max items-start gap-0 md:min-w-0">
        {legs.map((l, i) => {
          const { icon: Icon, color, label } = MODES[l.mode];
          const span = Math.max(l.end_h - l.start_h, 1e-6);
          const fill = Math.min(Math.max((doneH - l.start_h) / span, 0), 1);
          const tr = i > 0 ? transferAt(l, legs[i - 1]) : undefined;
          // Peso en % del recorrido (mínimo 10 %): con horas, un viaje de 30 min sumaba 0,5 y la cadena
          // ocupaba solo media fila, porque flex-grow < 1 reparte solo esa fracción del espacio libre.
          const weight = (100 * Math.max(l.end_h - l.start_h, totalH * 0.1)) / totalH;
          const here = fill > 0 && fill < 1;
          return (
            <li key={i} className="min-w-36" style={{ flexGrow: weight, flexBasis: 0 }}>
              <div className="flex items-center">
                <span
                  className="relative z-10 size-3 shrink-0 rounded-full border-2 bg-background"
                  style={{ borderColor: i === 0 || tr ? "var(--foreground)" : color }}
                  aria-hidden
                />
                <span className="relative flex-1" aria-hidden>
                  <span className={cn("block h-2 overflow-hidden rounded-full bg-fill", l.interrupted || l.detour ? "opacity-70" : "")}>
                    <span className="meter-fill block h-full rounded-full" style={{ "--v": fill, backgroundColor: color } as React.CSSProperties} />
                  </span>
                  {here && (
                    // Dónde va la carga ahora: un punto del color del modo con anillo del fondo; quieto, sin animación
                    <span
                      className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-background shadow-[0_0_0_1px_var(--color-border-strong)]"
                      style={{ left: `${fill * 100}%`, backgroundColor: color }}
                    />
                  )}
                </span>
                {i === legs.length - 1 && (
                  <span className="relative z-10 size-3 shrink-0 rounded-full border-2 border-foreground bg-background" aria-hidden />
                )}
              </div>
              <div className="mt-2.5 pr-3">
                <div className="truncate text-sm font-medium">{l.from.city || l.from.name}</div>
                {tr && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-warning">
                    <ArrowRightLeft className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">Transbordo {tr.time_fmt}</span>
                  </div>
                )}
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="size-3.5 shrink-0" style={{ color }} aria-hidden />
                  <span className="truncate">
                    {label}
                    {l.detour ? " · desvío" : ""}
                  </span>
                </div>
                <div className="tabular text-xs text-muted-foreground">
                  {l.distance_fmt} · {l.time_fmt}
                </div>
              </div>
              {i === legs.length - 1 && (
                <div className="sr-only">Destino: {l.to.city || l.to.name}</div>
              )}
            </li>
          );
        })}
        <li className="min-w-20 shrink-0 text-right" style={{ flexBasis: "5rem" }}>
          <div className="h-3.5" />
          <div className="mt-2.5 truncate text-sm font-medium">{legs[legs.length - 1].to.city || legs[legs.length - 1].to.name}</div>
          <div className="mt-1.5 text-xs text-muted-foreground">Destino</div>
        </li>
      </ol>
    </div>
  );
}
