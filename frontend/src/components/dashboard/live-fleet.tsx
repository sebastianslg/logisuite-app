"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Radio } from "lucide-react";

import { ModeIcon, StatusBadge } from "@/components/status-badge";
import { MODE_ORDER, MODES } from "@/lib/modes";
import type { FleetLive } from "@/lib/types";

const REFRESH_MS = 20_000;

/** Flota en tránsito: conteo por modo y activos con su avance (se refresca solo). */
export function LiveFleet({ initial }: { initial: FleetLive }) {
  const [fleet, setFleet] = useState(initial);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/fleet/live", { cache: "no-store" });
        if (res.ok) setFleet(await res.json());
      } catch {
        /* se conserva la última lectura */
      }
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const assets = [...fleet.assets].sort((a, b) => b.progress_pct - a.progress_pct).slice(0, 6);

  return (
    <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
      <div className="grid grid-cols-5 gap-2">
        {MODE_ORDER.map((m) => {
          const Icon = MODES[m].icon;
          return (
            <div
              key={m}
              className="flex flex-col items-center gap-1 rounded-md border border-white/[0.05] bg-white/[0.02] py-2"
              title={MODES[m].label}
            >
              <Icon className="size-4" style={{ color: MODES[m].color }} />
              <span className="tabular text-sm font-semibold">{fleet.by_mode[m] ?? 0}</span>
            </div>
          );
        })}
      </div>
      <ul className="flex flex-col divide-y divide-white/[0.04]">
        <AnimatePresence initial={false}>
          {assets.map((a) => (
            <motion.li
              key={a.shipment_code}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Link
                href={`/envios/${a.shipment_code}`}
                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-white/[0.03]"
                title={`Ver envío ${a.shipment_code}`}
              >
              <ModeIcon mode={a.mode} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="truncate font-medium">{a.id}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {a.origin} → {a.destination}
                  </span>
                </div>
                <div className="mt-1.5 h-1 w-full rounded-full bg-white/[0.05]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: MODES[a.mode].color }}
                    initial={false}
                    animate={{ width: `${a.progress_pct}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
              </div>
              <StatusBadge status={a.status} className="hidden 2xl:inline-flex" />
              </Link>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="mt-auto flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-neon-emerald/60" />
          <span className="relative inline-flex size-2 rounded-full bg-neon-emerald" />
        </span>
        <Radio className="size-3" aria-hidden />
        {fleet.count} activos · telemetría simulada sobre el trazado de cada ruta
      </div>
    </div>
  );
}
