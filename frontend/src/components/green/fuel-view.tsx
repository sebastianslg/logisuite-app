"use client";

import { Activity, Fuel, Gauge, Route, Scale } from "lucide-react";

import { BentoCell, BentoGrid, KpiCard } from "@/components/dashboard/bento";
import { FuelAssets, FuelDial, FuelEmpty, useFuelLive } from "@/components/green/fuel-telemetry";
import { CountUp } from "@/components/ui/count-up";
import { Dial, EcoBar } from "@/components/ui/dial";
import { MODES } from "@/lib/modes";
import type { FuelLive, SustainabilitySummary } from "@/lib/types";

/** Telemetría de combustible: consumo en vivo por activo, por modo y frente a la línea base de carretera. */
export function FuelView({ summary, initial }: { summary: SustainabilitySummary; initial: FuelLive }) {
  const live = useFuelLive(initial);
  const t = summary.totals;
  const maxFuel = Math.max(1, ...summary.by_mode.map((m) => m.fuel_l));
  const overRoad = t.fuel_vs_road_pct > 100;

  return (
    <BentoGrid>
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        label={`Combustible (${summary.window_days} días)`}
        value={<CountUp value={t.fuel_l} suffix=" L" />}
        icon={<Fuel />}
        footnote={`${summary.shipments} envíos · ${t.tkm_fmt}`}
      />
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        label="Consumido en ruta ahora"
        value={<CountUp value={live.burned_l} suffix=" L" />}
        icon={<Activity />}
        accent="var(--color-warning)"
        footnote={`${live.count} activos en tránsito`}
      />
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        label="Proyectado al llegar"
        value={<CountUp value={live.total_l} suffix=" L" />}
        icon={<Route />}
        footnote="Suma de los envíos en curso"
      />
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        label="Frente a todo por carretera"
        value={<CountUp value={t.fuel_vs_road_pct} decimals={1} suffix=" %" />}
        icon={<Scale />}
        accent={overRoad ? "var(--color-warning)" : "var(--color-success)"}
        footnote={`Referencia: ${t.baseline_fuel_fmt}`}
      />

      <BentoCell
        className="md:col-span-6 xl:col-span-5"
        title="Consumo en curso"
        description="Combustible quemado sobre el proyectado"
        icon={<Gauge />}
      >
        <FuelDial live={live} />
      </BentoCell>

      <BentoCell
        className="md:col-span-3 xl:col-span-4"
        title="Combustible por modo"
        description={`Últimos ${summary.window_days} días`}
        icon={<Fuel />}
      >
        <ul className="flex flex-col gap-4 px-5 pb-5">
          {summary.by_mode.map((m, i) => {
            const Icon = MODES[m.mode].icon;
            return (
              <li key={m.mode}>
                <div className="mb-1.5 flex items-center gap-2 text-sm">
                  <Icon className="size-4" style={{ color: MODES[m.mode].color }} aria-hidden />
                  <span className="flex-1 font-medium">{m.label}</span>
                  <span className="tabular text-xs text-muted-foreground">{m.fuel_fmt}</span>
                </div>
                <EcoBar value={m.fuel_l} max={maxFuel} color={MODES[m.mode].color} delay={0.1 + i * 0.05} />
                <div className="mt-1 text-xs text-muted-foreground">{m.fuel_type}</div>
              </li>
            );
          })}
        </ul>
      </BentoCell>

      <BentoCell
        className="md:col-span-3 xl:col-span-3"
        title="Frente a carretera"
        description="100 % = todo por camión"
        icon={<Scale />}
      >
        <div className="flex flex-1 items-center justify-center px-5 pb-6">
          <Dial
            value={t.fuel_vs_road_pct}
            color={overRoad ? "var(--sys-orange)" : "var(--sys-green)"}
            label="Combustible frente a mover toda la carga por carretera"
            sublabel={overRoad ? "más que por carretera" : "del consumo por carretera"}
            decimals={0}
          />
        </div>
      </BentoCell>

      <BentoCell
        className="md:col-span-6 xl:col-span-12"
        title="Activos en tránsito"
        description="Telemetría de combustible estimada"
        icon={<Activity />}
      >
        {live.assets.length ? <FuelAssets live={live} /> : <FuelEmpty />}
      </BentoCell>
    </BentoGrid>
  );
}
