"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { MapLegend } from "@/components/map/map-legend";
import { Map3DLazy, MapLoading } from "@/components/map/map-3d-lazy";
import { useMapData } from "@/components/map/use-map-data";
import { MODE_ORDER, MODES } from "@/lib/modes";
import type { DashboardSummary } from "@/lib/types";

/** Celda del dashboard: mapa 3D compacto con la flota animada y el resumen por modo. */
export function NetworkMapCard({ network: stats }: { network: DashboardSummary["network"] }) {
  const { network, departments, fleet, error } = useMapData();
  const byMode = new Map(stats.modes.map((m) => [m.mode, m]));

  return (
    <div className="relative flex-1">
      <div className="absolute inset-0">
        {network && departments ? (
          <Map3DLazy network={network} departments={departments} fleet={fleet} compact />
        ) : (
          <MapLoading label={error ?? undefined} />
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5">
        <div className="pointer-events-auto flex flex-wrap gap-2">
          {MODE_ORDER.map((m) => {
            const Icon = MODES[m].icon;
            return (
              <div
                key={m}
                className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-[#0b0f19]/70 px-2.5 py-1.5 backdrop-blur-md"
              >
                <Icon className="size-3.5" style={{ color: MODES[m].color }} />
                <span className="tabular text-xs font-medium">{byMode.get(m)?.km_fmt ?? "0 km"}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-end justify-between gap-4">
          <MapLegend />
          <Link
            href="/red"
            className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-1.5 text-xs font-medium text-neon-cyan backdrop-blur-md transition-colors hover:bg-neon-cyan/20"
          >
            Simulador de rutas
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
