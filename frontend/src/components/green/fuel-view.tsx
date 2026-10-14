"use client";

import { Activity, Fuel, Gauge, Route, Scale } from "lucide-react";

import { useState } from "react";
import Link from "next/link";

import { BentoCell, BentoGrid, KpiCard } from "@/components/dashboard/bento";
import { ModeFootprintTable } from "@/components/green/mode-footprint-table";
import { DetailTable } from "@/components/ui/detail-table";
import { Sheet } from "@/components/ui/sheet";
import { FuelAssets, FuelDial, FuelEmpty, useFuelLive } from "@/components/green/fuel-telemetry";
import { CountUp } from "@/components/ui/count-up";
import { Dial, EcoBar } from "@/components/ui/dial";
import { MODES } from "@/lib/modes";
import type { FuelLive, SustainabilitySummary } from "@/lib/types";

/** Telemetría de combustible: consumo en vivo por activo, por modo y frente a la línea base de carretera. */
export function FuelView({ summary, initial }: { summary: SustainabilitySummary; initial: FuelLive }) {
  const live = useFuelLive(initial);
  const [sheet, setSheet] = useState<null | "modes" | "assets" | "road">(null);
  const close = () => setSheet(null);
  const t = summary.totals;
  const maxFuel = Math.max(1, ...summary.by_mode.map((m) => m.fuel_l));
  const overRoad = t.fuel_vs_road_pct > 100;

  return (
    <BentoGrid>
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        href="/huella"
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
        onOpen={() => setSheet("assets")}
      >
        <FuelDial live={live} />
      </BentoCell>

      <BentoCell
        className="md:col-span-3 xl:col-span-4"
        title="Combustible por modo"
        description={`Últimos ${summary.window_days} días`}
        icon={<Fuel />}
        onOpen={() => setSheet("modes")}
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
        onOpen={() => setSheet("road")}
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
      <Sheet open={sheet === "modes"} onClose={close} title="Combustible por modo" description={`Últimos ${summary.window_days} días`}>
        <ModeFootprintTable rows={summary.by_mode} csvName="combustible-por-modo" />
      </Sheet>
      <Sheet open={sheet === "assets"} onClose={close} title="Consumo por activo" description={`${live.count} activos en tránsito`}>
        <DetailTable
          csvName="combustible-activos"
          getKey={(a) => a.shipment_code}
          rows={live.assets}
          columns={[
            {
              key: "a",
              label: "Activo",
              render: (a) => (
                <Link href={`/envios/${a.shipment_code}`} className="font-medium text-primary hover:underline">
                  {a.id}
                </Link>
              ),
              csv: (a) => a.id,
            },
            { key: "r", label: "Ruta", render: (a) => `${a.origin} → ${a.destination}`, csv: (a) => `${a.origin} → ${a.destination}` },
            { key: "f", label: "Combustible", render: (a) => a.fuel_type, csv: (a) => a.fuel_type },
            { key: "b", label: "Consumido (L)", align: "right", render: (a) => a.burned_l.toLocaleString("es-CO"), csv: (a) => a.burned_l },
            { key: "t", label: "Proyectado (L)", align: "right", render: (a) => a.total_l.toLocaleString("es-CO"), csv: (a) => a.total_l },
            { key: "p", label: "% usado", align: "right", render: (a) => `${a.burned_pct.toLocaleString("es-CO")} %`, csv: (a) => a.burned_pct },
          ]}
        />
      </Sheet>
      <Sheet open={sheet === "road"} onClose={close} title="Frente a todo por carretera" description="Combustible de la operación vs. la referencia">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Consumo de la operación", t.fuel_fmt],
            ["Si todo fuera por carretera", t.baseline_fuel_fmt],
            ["Relación", `${t.fuel_vs_road_pct.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`],
            ["Envíos analizados", String(summary.shipments)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-fill p-3">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="tabular mt-1 text-lg font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">
          Menos de 100 % significa que la mezcla de modos quema menos combustible que el camión para las mismas toneladas-kilómetro.
        </p>
      </Sheet>
    </BentoGrid>
  );
}
