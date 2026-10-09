"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { MODE_ORDER, MODES } from "@/lib/modes";
import type { DashboardSummary } from "@/lib/types";

/** Resumen de la red por modo (kilómetros y enlaces) con acceso al mapa 3D. */
export function NetworkOverview({ network }: { network: DashboardSummary["network"] }) {
  const byMode = new Map(network.modes.map((m) => [m.mode, m]));
  return (
    <div className="flex flex-1 flex-col justify-between gap-6 px-5 pb-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {MODE_ORDER.map((m, i) => {
          const s = byMode.get(m);
          const Icon = MODES[m].icon;
          return (
            <motion.div
              key={m}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              className="rounded-md border border-white/[0.05] bg-white/[0.02] p-3"
            >
              <Icon className="size-4" style={{ color: MODES[m].color }} />
              <div className="mt-3 text-xs text-muted-foreground">{MODES[m].label}</div>
              <div className="tabular text-lg font-semibold">{s?.km_fmt ?? "0 km"}</div>
              <div className="tabular text-[11px] text-muted-foreground">{s?.links ?? 0} enlaces</div>
            </motion.div>
          );
        })}
      </div>
      <Link
        href="/red"
        className="group/cta inline-flex w-fit items-center gap-2 text-sm text-neon-cyan"
      >
        Abrir mapa 3D y simulador de rutas
        <ArrowRight className="size-4 transition-transform group-hover/cta:translate-x-1" />
      </Link>
    </div>
  );
}
