"use client";

import { useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Radio } from "lucide-react";

import { ModeIcon } from "@/components/status-badge";
import { MODE_ORDER, MODES } from "@/lib/modes";
import { EASE, T_FAST } from "@/lib/motion";
import type { FleetLive } from "@/lib/types";
import { useLive } from "@/lib/use-live";


const REFRESH_MS = 20_000;

/** Flota en tránsito: conteo por modo y activos con su avance (se refresca solo). */
export function LiveFleet({ initial }: { initial: FleetLive }) {
  const ref = useRef<HTMLDivElement>(null);
  // Sondeo compartido con el mapa del resumen; se pausa con la pestaña oculta o el bloque fuera de pantalla
  const fleet = useLive<FleetLive>("/api/fleet/live", REFRESH_MS, initial, ref);

  const assets = [...fleet.assets].sort((a, b) => b.progress_pct - a.progress_pct).slice(0, 6);

  return (
    <div ref={ref} className="flex flex-1 flex-col">
      {/* Conteo por modo: una fila de cifras con su ícono, sin cajas */}
      <div className="-ml-px grid grid-cols-5 border-y border-border">
        {MODE_ORDER.map((m) => {
          const Icon = MODES[m].icon;
          return (
            <Link
              key={m}
              href={`/envios?modo=${m}`}
              title={`${MODES[m].label}: ver envíos`}
              aria-label={`${MODES[m].label}: ${fleet.by_mode[m] ?? 0} activos. Ver envíos`}
              data-ripple
              className="flex flex-col items-center gap-1 border-l border-border py-3 outline-none transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--card)_96%,var(--foreground))] focus-visible:ring-[3px] focus-visible:ring-ring/80 focus-visible:ring-inset"
            >
              <Icon className="size-4" style={{ color: MODES[m].color }} aria-hidden />
              <span className="tabular text-[0.9375rem] font-semibold">{fleet.by_mode[m] ?? 0}</span>
            </Link>
          );
        })}
      </div>
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {assets.map((a) => (
            <motion.li
              key={a.shipment_code}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE, layout: T_FAST }}
              className="border-b border-border last:border-b-0"
            >
              <Link
                href={`/envios/${a.shipment_code}`}
                aria-label={`${a.id}, ${a.origin} a ${a.destination}. Ver envío ${a.shipment_code}`}
                data-ripple
                className="flex items-center gap-3 px-5 py-3 outline-none transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--card)_96%,var(--foreground))] focus-visible:ring-[3px] focus-visible:ring-ring/80 focus-visible:ring-inset"
              >
                <ModeIcon mode={a.mode} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="truncate font-medium">{a.id}</span>
                    <span className="truncate text-[13px] text-muted-foreground">
                      {a.origin} → {a.destination}
                    </span>
                  </div>
                  <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-fill">
                    <motion.div
                      className="h-full w-full origin-left rounded-full"
                      style={{ backgroundColor: MODES[a.mode].color }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: a.progress_pct / 100 }}
                      transition={{ duration: 0.8, ease: EASE }}
                    />
                  </div>
                </div>
                <span className="tabular w-10 shrink-0 text-right text-[13px] text-muted-foreground">{Math.round(a.progress_pct)} %</span>
              </Link>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="mt-auto flex items-center gap-2 border-t border-border px-5 py-3 text-[13px] text-muted-foreground">
        <Radio className="size-3.5" aria-hidden />
        {fleet.count} activos · telemetría simulada sobre el trazado de cada ruta
      </div>
    </div>
  );
}
