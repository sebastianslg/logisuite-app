"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Cloud, Factory, Info, Leaf, Scale, Wind } from "lucide-react";

import { BentoCell, BentoGrid, KpiCard } from "@/components/dashboard/bento";
import { ChartTooltip } from "@/components/dashboard/chart-tooltip";
import { ModeChain } from "@/components/status-badge";
import { CountUp } from "@/components/ui/count-up";
import { Dial, EcoBar } from "@/components/ui/dial";
import { MODES } from "@/lib/modes";
import { EASE, T_FAST } from "@/lib/motion";
import type { SustainabilitySummary } from "@/lib/types";

const ROW_LIFT = "0 6px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)";

/** Huella de carbono (CO₂e): total, eco-eficiencia frente a carretera, intensidad por modo y mayores emisores. */
export function CarbonView({ summary }: { summary: SustainabilitySummary }) {
  const t = summary.totals;
  const saved = t.saved_vs_road_pct;
  const maxIntensity = Math.max(1, ...summary.by_mode.map((m) => m.intensity_g_tkm));

  return (
    <BentoGrid>
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        label={`Huella (${summary.window_days} días)`}
        value={<CountUp value={t.co2e_kg / 1000} decimals={1} suffix=" t CO₂e" />}
        icon={<Cloud />}
        footnote={`${summary.shipments} envíos · ${t.tkm_fmt}`}
      />
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        label="Intensidad de carbono"
        value={<CountUp value={t.intensity_g_tkm} decimals={1} suffix=" g/t-km" />}
        icon={<Factory />}
        footnote="CO₂e por tonelada-kilómetro movida"
      />
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        label="Frente a todo por carretera"
        value={<CountUp value={saved} decimals={1} suffix=" %" />}
        icon={<Scale />}
        accent={saved >= 0 ? "var(--color-success)" : "var(--color-destructive)"}
        footnote={saved >= 0 ? `Evita ${t.baseline_co2e_fmt} → emite ${t.co2e_fmt}` : "Emite más que la referencia"}
      />
      <KpiCard
        className="md:col-span-3 xl:col-span-3"
        label="Combustible asociado"
        value={<CountUp value={t.fuel_l} suffix=" L" />}
        icon={<Wind />}
        footnote="Derivado de las mismas emisiones"
      />

      <BentoCell
        className="md:col-span-6 xl:col-span-4"
        title="Eco-eficiencia"
        description="Menos CO₂e que mover todo por camión"
        icon={<Leaf />}
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 pb-6">
          <Dial
            value={Math.max(saved, 0)}
            color="var(--sys-green)"
            label="Reducción de CO₂e frente a mover toda la carga por carretera"
            sublabel="menos que por carretera"
            decimals={0}
            size={184}
          />
          {saved < 0 && (
            <p className="text-center text-sm text-destructive" role="status">
              La mezcla actual emite {Math.abs(saved).toLocaleString("es-CO", { maximumFractionDigits: 1 })} % más que la referencia.
            </p>
          )}
        </div>
      </BentoCell>

      <BentoCell
        className="md:col-span-3 xl:col-span-4"
        title="Intensidad por modo"
        description="g de CO₂e por tonelada-kilómetro"
        icon={<BarChart3 />}
      >
        <ul className="flex flex-col gap-4 px-5 pb-5">
          {[...summary.by_mode]
            .sort((a, b) => a.intensity_g_tkm - b.intensity_g_tkm)
            .map((m, i) => {
              const Icon = MODES[m.mode].icon;
              return (
                <li key={m.mode}>
                  <div className="mb-1.5 flex items-center gap-2 text-sm">
                    <Icon className="size-4" style={{ color: MODES[m.mode].color }} aria-hidden />
                    <span className="flex-1 font-medium">{m.label}</span>
                    <span className="tabular text-xs text-muted-foreground">{m.intensity_g_tkm} g/t-km</span>
                  </div>
                  <EcoBar value={m.intensity_g_tkm} max={maxIntensity} color={MODES[m.mode].color} delay={0.1 + i * 0.05} />
                </li>
              );
            })}
        </ul>
      </BentoCell>

      <BentoCell
        className="md:col-span-3 xl:col-span-4"
        title="Emisiones por modo"
        description="Participación en el total"
        icon={<Cloud />}
      >
        <ul className="flex flex-col gap-4 px-5 pb-5">
          {summary.by_mode.map((m, i) => {
            const Icon = MODES[m.mode].icon;
            return (
              <li key={m.mode}>
                <div className="mb-1.5 flex items-center gap-2 text-sm">
                  <Icon className="size-4" style={{ color: MODES[m.mode].color }} aria-hidden />
                  <span className="flex-1 font-medium">{m.label}</span>
                  <span className="tabular text-xs text-muted-foreground">{m.co2e_fmt}</span>
                  <span className="tabular w-12 text-right text-sm font-medium">
                    {m.co2e_share_pct.toLocaleString("es-CO")} %
                  </span>
                </div>
                <EcoBar value={m.co2e_share_pct} max={100} color={MODES[m.mode].color} delay={0.1 + i * 0.05} />
              </li>
            );
          })}
        </ul>
      </BentoCell>

      <BentoCell
        className="md:col-span-6 xl:col-span-7"
        title="Emisiones por día"
        description="kg de CO₂e por fecha de despacho, 14 días"
        icon={<BarChart3 />}
      >
        <Co2Trend data={summary.co2e_14d} />
      </BentoCell>

      <BentoCell
        className="md:col-span-6 xl:col-span-5"
        title="Mayores emisores"
        description="Envíos con más CO₂e"
        icon={<Factory />}
      >
        <ul className="-mx-2.5 flex flex-col px-5 pb-4">
          {summary.top_emitters.map((e) => (
            <li key={e.code} className="px-0">
              <motion.div
                whileHover={{ scale: 1.02, y: -2, boxShadow: ROW_LIFT, transition: T_FAST }}
                className="my-1 flex items-center gap-3 rounded-2xl bg-fill px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.route}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <ModeChain modes={e.modes} />
                    <span className="font-mono text-xs text-muted-foreground">{e.code}</span>
                  </div>
                </div>
                <div className="tabular shrink-0 text-right">
                  <div className="text-sm font-semibold">{e.co2e_fmt} CO₂e</div>
                  <div className="text-xs text-muted-foreground">{e.fuel_fmt}</div>
                </div>
              </motion.div>
            </li>
          ))}
        </ul>
      </BentoCell>

      <BentoCell
        className="md:col-span-6 xl:col-span-12"
        title="Cómo se calcula"
        description="Transparencia del método"
        icon={<Info />}
      >
        <div className="px-5 pb-5 text-sm text-muted-foreground">
          <p>{summary.method.note}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {summary.method.factors.map((f) => (
              <li key={f.mode} className="rounded-xl bg-fill px-3 py-1.5 text-xs">
                <span className="font-medium text-foreground">{MODES[f.mode].label}</span> · {f.g_co2e_per_tkm} g/t-km · {f.fuel}
              </li>
            ))}
          </ul>
        </div>
      </BentoCell>
    </BentoGrid>
  );
}

/** Emisiones diarias: barras de una serie que crecen desde 0, con tooltip. */
function Co2Trend({ data }: { data: SustainabilitySummary["co2e_14d"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.co2e_kg));
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" });

  return (
    <div className="flex flex-1 flex-col px-5 pb-5">
      <div className="relative mt-2 flex min-h-40 flex-1 items-end gap-1.5" onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div key={d.date} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(3, (d.co2e_kg / max) * 100)}%` }}
              transition={{ duration: 0.8, delay: i * 0.03, ease: EASE }}
              className="w-full rounded-t-[4px] transition-[opacity] duration-300 ease-apple"
              style={{
                backgroundColor: d.co2e_kg ? "var(--sys-blue)" : "var(--fill)",
                opacity: hover === null || hover === i ? 1 : 0.4,
              }}
            />
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border-strong" />
        {hover !== null && (
          <ChartTooltip open x={`${((hover + 0.5) / data.length) * 100}%`} y={0}>
            <span className="font-medium">{fmt(data[hover].date)}</span>
            <span className="tabular ml-2 text-muted-foreground">
              {data[hover].co2e_kg.toLocaleString("es-CO")} kg CO₂e
            </span>
          </ChartTooltip>
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{fmt(data[0].date)}</span>
        <span>Hoy</span>
      </div>
    </div>
  );
}
