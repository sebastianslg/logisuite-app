"use client";

import { useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Radio } from "lucide-react";

import { ModeIcon, StatusBadge } from "@/components/status-badge";
import { MODE_ORDER, MODES } from "@/lib/modes";
import { EASE, T_FAST } from "@/lib/motion";
import type { FleetLive } from "@/lib/types";
import { useLive } from "@/lib/use-live";

/** Sombra de elevación contenida (el <li> recorta lo que sobresale de su caja). */
const ROW_LIFT = "0 6px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)";

const REFRESH_MS = 20_000;
const MotionLink = motion.create(Link);

/** Flota en tránsito: conteo por modo y activos con su avance (se refresca solo). */
export function LiveFleet({ initial }: { initial: FleetLive }) {
  const ref = useRef<HTMLDivElement>(null);
  // Sondeo compartido con el mapa del resumen; se pausa con la pestaña oculta o el bloque fuera de pantalla
  const fleet = useLive<FleetLive>("/api/fleet/live", REFRESH_MS, initial, ref);

  const assets = [...fleet.assets].sort((a, b) => b.progress_pct - a.progress_pct).slice(0, 6);

  return (
    <div ref={ref} className="flex flex-1 flex-col gap-4 px-5 pb-5">
      <div className="grid grid-cols-5 gap-2">
        {MODE_ORDER.map((m) => {
          const Icon = MODES[m].icon;
          return (
            <Link
              key={m}
              href={`/envios?modo=${m}`}
              title={`${MODES[m].label}: ver envíos`}
              aria-label={`${MODES[m].label}: ${fleet.by_mode[m] ?? 0} activos. Ver envíos`}
              className="press flex flex-col items-center gap-1 rounded-2xl bg-fill py-2 outline-none hover:bg-fill/70 focus-visible:ring-[3px] focus-visible:ring-ring/80"
            >
              <Icon className="size-4" style={{ color: MODES[m].color }} />
              <span className="tabular text-sm font-semibold">{fleet.by_mode[m] ?? 0}</span>
            </Link>
          );
        })}
      </div>
      <ul className="-mx-2.5 flex flex-col">
        <AnimatePresence initial={false}>
          {assets.map((a) => (
            <motion.li
              key={a.shipment_code}
              layout="position"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5, ease: EASE, layout: T_FAST }}
              className="overflow-hidden px-2.5"
            >
              <MotionLink
                href={`/envios/${a.shipment_code}`}
                aria-label={`${a.id}, ${a.origin} a ${a.destination}. Ver envío ${a.shipment_code}`}
                whileHover={{ scale: 1.02, y: -2, boxShadow: ROW_LIFT, transition: T_FAST }}
                className="my-1 flex cursor-pointer items-center gap-3 rounded-2xl bg-fill px-3 py-2.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80"
              >
                <ModeIcon mode={a.mode} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate font-medium">{a.id}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {a.origin} → {a.destination}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 w-full rounded-full bg-fill">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: MODES[a.mode].color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${a.progress_pct}%` }}
                      transition={{ duration: 0.8, ease: EASE }}
                    />
                  </div>
                </div>
                <StatusBadge status={a.status} className="hidden 2xl:inline-flex" />
              </MotionLink>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
        <span className="size-2 rounded-full bg-success" aria-hidden />
        <Radio className="size-3" aria-hidden />
        {fleet.count} activos · telemetría simulada sobre el trazado de cada ruta
      </div>
    </div>
  );
}
