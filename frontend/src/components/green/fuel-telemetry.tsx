"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Fuel, Radio } from "lucide-react";

import { ModeIcon } from "@/components/status-badge";
import { CountUp } from "@/components/ui/count-up";
import { Dial, EcoBar } from "@/components/ui/dial";
import { MODES } from "@/lib/modes";
import { EASE, T_FAST } from "@/lib/motion";
import type { FuelLive } from "@/lib/types";
import { useLive } from "@/lib/use-live";

const REFRESH_MS = 20_000;

/** Hook: la telemetría se refresca sola (pausada con la pestaña oculta); si falla, se conserva la última lectura. */
export function useFuelLive(initial: FuelLive) {
  return useLive<FuelLive>("/api/sustainability/fuel-live", REFRESH_MS, initial);
}

/** Dial de combustible consumido sobre el proyectado de los envíos en curso. */
export function FuelDial({ live }: { live: FuelLive }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-5 pb-6 sm:flex-row sm:gap-8">
      <Dial
        value={live.burned_pct}
        color="var(--sys-orange)"
        label="Combustible consumido sobre el proyectado de los envíos en curso"
        sublabel="del proyectado"
        decimals={0}
        size={176}
      />
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Consumido hasta ahora</dt>
          <dd className="tabular text-2xl font-bold">
            <CountUp value={live.burned_l} suffix=" L" />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Proyectado al llegar</dt>
          <dd className="tabular text-2xl font-bold text-muted-foreground">
            <CountUp value={live.total_l} suffix=" L" />
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** Consumo por activo: barra animada de avance de combustible, con altas/bajas fluidas. */
export function FuelAssets({ live }: { live: FuelLive }) {
  const assets = live.assets.slice(0, 8);
  return (
    <div className="flex flex-col">
      <ul className="rule-list border-t border-border">
        <AnimatePresence initial={false}>
          {assets.map((a) => (
            <motion.li
              key={a.shipment_code}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE, layout: T_FAST }}
            >
              <Link
                href={`/envios/${a.shipment_code}`}
                aria-label={`${a.id}, ${a.origin} a ${a.destination}. Ver envío ${a.shipment_code}`}
                data-ripple
                className="row-link"
              >
                <ModeIcon mode={a.mode} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium">
                      {a.id}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {a.origin} → {a.destination}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-xs text-muted-foreground">
                      {a.burned_l.toLocaleString("es-CO")} / {a.total_l.toLocaleString("es-CO")} L
                    </span>
                  </div>
                  <EcoBar value={a.burned_pct} max={100} color={MODES[a.mode].color} className="mt-2 h-[3px]" />
                  <div className="mt-1.5 text-xs text-muted-foreground">{a.fuel_type}</div>
                </div>
              </Link>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <p className="flex items-center gap-2 border-t border-border px-5 py-3 text-[13px] text-muted-foreground">
        <Radio className="size-3.5" aria-hidden />
        {live.count} activos · consumo estimado según tramo recorrido y factor del modo · actualiza cada 20 s
      </p>
    </div>
  );
}

export function FuelEmpty() {
  return (
    <div className="flex flex-col items-center gap-2 px-8 py-10 text-center text-sm text-muted-foreground">
      <Fuel className="size-6" aria-hidden />
      No hay activos en tránsito en este momento.
    </div>
  );
}
