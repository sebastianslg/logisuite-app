"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { MapLegend } from "@/components/map/map-legend";
import { Map3DLazy, MapLoading } from "@/components/map/map-3d-lazy";
import { NetworkPreview } from "@/components/map/network-preview";
import { useMapData } from "@/components/map/use-map-data";
import { Segmented } from "@/components/ui/segmented";
import { useLocal } from "@/lib/local";
import { MODE_ORDER, MODES } from "@/lib/modes";
import type { DashboardSummary } from "@/lib/types";

/**
 * Celda del dashboard: la red con la flota y el resumen por modo. Por defecto es un dibujo plano en SVG (no crea
 * un mapa 3D cada vez que se entra al resumen, que era lo que trababa la pestaña); «3D» monta el mapa completo
 * y la elección se recuerda en este navegador.
 */
export function NetworkMapCard({ network: stats }: { network: DashboardSummary["network"] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { network, departments, fleet, error } = useMapData({ ref });
  const [view, setView] = useLocal<"plano" | "3d">("westvane.dashboard-map", "plano");
  const byMode = new Map(stats.modes.map((m) => [m.mode, m]));

  return (
    <div ref={ref} className="relative flex-1">
      <div className="absolute inset-0">
        {!network || !departments ? (
          <MapLoading label={error ?? undefined} />
        ) : view === "3d" ? (
          <Map3DLazy network={network} departments={departments} fleet={fleet} compact />
        ) : (
          <div className="h-full w-full px-6 pt-14 pb-32 sm:pb-28">
            <NetworkPreview network={network} departments={departments} fleet={fleet} />
          </div>
        )}
      </div>
      <div className="material absolute top-3 left-3 z-10 rounded-xl border border-border">
        <Segmented
          id="dashboard-map"
          label="Vista del mapa"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "plano", label: "Plano" },
            { value: "3d", label: "3D" },
          ]}
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5">
        <div className="pointer-events-auto chip-scroll flex gap-2 md:flex-wrap">
          {MODE_ORDER.map((m) => {
            const Icon = MODES[m].icon;
            return (
              <Link
                key={m}
                href={`/red?modos=${m}`}
                aria-label={`${MODES[m].label}: ${byMode.get(m)?.km_fmt ?? "0 km"}. Ver solo este modo en el mapa`}
                className="material press flex items-center gap-2 rounded-xl border border-border px-2.5 py-1.5 outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/80"
              >
                <Icon className="size-3.5" style={{ color: MODES[m].color }} aria-hidden />
                <span className="tabular text-xs font-medium">{byMode.get(m)?.km_fmt ?? "0 km"}</span>
              </Link>
            );
          })}
        </div>
        {/* En celular la leyenda tapaba medio mapa: los chips ya llevan el ícono y el color de cada modo */}
        <div className="flex items-end justify-end gap-4 sm:justify-between">
          <div className="hidden sm:block">
            <MapLegend />
          </div>
          <Link
            href="/red"
            className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-solid px-3 py-1.5 text-sm font-medium text-primary-foreground press hover:bg-solid/90 focus-visible:ring-[3px] focus-visible:ring-ring/80 outline-none"
          >
            Simulador de rutas
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
