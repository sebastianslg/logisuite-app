"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { BentoCell, BentoGrid } from "@/components/dashboard/bento";
import { StatStrip } from "@/components/ui/stat-strip";
import { ChartTooltip } from "@/components/dashboard/chart-tooltip";
import { ModeFootprintTable } from "@/components/green/mode-footprint-table";
import { DetailTable } from "@/components/ui/detail-table";
import { Sheet } from "@/components/ui/sheet";
import Link from "next/link";
import { ModeChain } from "@/components/status-badge";
import { CountUp } from "@/components/ui/count-up";
import { Dial, EcoBar } from "@/components/ui/dial";
import { MODES } from "@/lib/modes";
import { EASE } from "@/lib/motion";
import type { SustainabilitySummary } from "@/lib/types";

/** Huella de carbono (CO₂e): total, eco-eficiencia frente a carretera, intensidad por modo y mayores emisores. */
export function CarbonView({ summary }: { summary: SustainabilitySummary }) {
  const t = summary.totals;
  const [sheet, setSheet] = useState<null | "modes" | "days" | "eco">(null);
  const close = () => setSheet(null);
  const saved = t.saved_vs_road_pct;
  const maxIntensity = Math.max(1, ...summary.by_mode.map((m) => m.intensity_g_tkm));

  return (
    <BentoGrid>
      <div className="col-span-2 md:col-span-6 xl:col-span-12">
        <StatStrip
          items={[
          { label: `Huella (${summary.window_days} días)`, value: <CountUp value={t.co2e_kg / 1000} decimals={1} suffix=" t CO₂e" />, hint: `${summary.shipments} envíos · ${t.tkm_fmt}` },
          { label: "Intensidad de carbono", value: <CountUp value={t.intensity_g_tkm} decimals={1} suffix=" g/t-km" />, hint: "CO₂e por tonelada-kilómetro movida" },
          { label: "Frente a todo por carretera", value: <CountUp value={saved} decimals={1} suffix=" %" />, hint: saved >= 0 ? `Evita ${t.baseline_co2e_fmt} → emite ${t.co2e_fmt}` : "Emite más que la referencia", href: "/envios", tone: saved >= 0 ? "success" : "danger" },
          { label: "Combustible asociado", value: <CountUp value={t.fuel_l} suffix=" L" />, hint: "Derivado de las mismas emisiones", href: "/combustible" },
          ]}
        />
      </div>

      <BentoCell
        className="md:col-span-6 xl:col-span-4"
        title="Eco-eficiencia"
        description="Menos CO₂e que mover todo por camión"
        onOpen={() => setSheet("eco")}
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
        onOpen={() => setSheet("modes")}
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
        onOpen={() => setSheet("days")}
      >
        <Co2Trend data={summary.co2e_14d} />
      </BentoCell>

      <BentoCell
        className="md:col-span-6 xl:col-span-5"
        title="Mayores emisores"
        description="Envíos con más CO₂e"
      >
        <ul className="rule-list border-t border-border">
          {summary.top_emitters.map((e) => (
            <li key={e.code}>
              <Link
                href={`/envios/${e.code}`}
                aria-label={`${e.route}, ${e.co2e_fmt} de CO₂e. Ver envío ${e.code}`}
                data-ripple
                className="row-link"
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
              </Link>
            </li>
          ))}
        </ul>
      </BentoCell>

      <BentoCell
        className="md:col-span-6 xl:col-span-12"
        title="Cómo se calcula"
        description="Transparencia del método"
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
      <Sheet open={sheet === "modes"} onClose={close} title="Huella por modo" description={`Últimos ${summary.window_days} días`}>
        <ModeFootprintTable rows={summary.by_mode} csvName="huella-por-modo" />
        <p className="mt-3 text-xs text-muted-foreground">{summary.method.note}</p>
      </Sheet>
      <Sheet open={sheet === "days"} onClose={close} title="Emisiones por día" description="kg de CO₂e por fecha de despacho">
        <DetailTable
          csvName="emisiones-por-dia"
          getKey={(d) => d.date}
          rows={[...summary.co2e_14d].reverse()}
          columns={[
            { key: "d", label: "Fecha", render: (d) => new Date(`${d.date}T12:00:00`).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" }), csv: (d) => d.date },
            { key: "k", label: "kg CO₂e", align: "right", render: (d) => d.co2e_kg.toLocaleString("es-CO"), csv: (d) => d.co2e_kg },
          ]}
        />
      </Sheet>
      <Sheet open={sheet === "eco"} onClose={close} title="Eco-eficiencia" description="Cómo se compara con mover todo por camión">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Emisión actual", t.co2e_fmt],
            ["Si todo fuera por carretera", t.baseline_co2e_fmt],
            ["Diferencia", `${saved >= 0 ? "−" : "+"}${Math.abs(saved).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`],
            ["Intensidad media", `${t.intensity_g_tkm.toLocaleString("es-CO")} g/t-km`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-fill p-3">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="tabular mt-1 text-lg font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">
          La referencia mueve las mismas toneladas-kilómetro por camión (80 g CO₂e/t-km). El porcentaje positivo indica cuánto
          evita la mezcla de modos actual.
        </p>
        <Link href="/envios" className="mt-3 inline-block text-sm text-primary hover:underline">Ver los envíos que componen la huella</Link>
      </Sheet>
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
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.8, delay: i * 0.03, ease: EASE }}
              className="w-full origin-bottom rounded-t-[4px] transition-[opacity] duration-300 ease-apple"
              style={{
                height: `${Math.max(3, (d.co2e_kg / max) * 100)}%`,
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
