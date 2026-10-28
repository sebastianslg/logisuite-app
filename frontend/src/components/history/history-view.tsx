"use client";

import Link from "next/link";
import { useState } from "react";
import { LayoutGroup, motion } from "framer-motion";

import { Money } from "@/components/money";
import { useApp } from "@/components/providers";
import { ModeIcon } from "@/components/status-badge";
import { DetailTable, type Column } from "@/components/ui/detail-table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatStrip } from "@/components/ui/stat-strip";
import { MODES } from "@/lib/modes";
import { SPRING } from "@/lib/motion";
import type { History, HistoryCity, HistoryCorridor, HistoryDepartment } from "@/lib/types";
import { cn } from "@/lib/utils";

const WINDOWS = [7, 30, 90] as const;
type View = "ciudades" | "departamentos" | "corredores";
const VIEWS: { key: View; label: string }[] = [
  { key: "ciudades", label: "Ciudades" },
  { key: "departamentos", label: "Departamentos" },
  { key: "corredores", label: "Corredores" },
];

const n = (v: number) => v.toLocaleString("es-CO");

/** Barra fina proporcional al máximo de la columna (solo transform). */
function Share({ value, max, color = "var(--sys-blue)" }: { value: number; max: number; color?: string }) {
  return (
    <span className="ml-auto block h-1 w-20 overflow-hidden rounded-full bg-fill" aria-hidden>
      <span
        className="block h-full w-full origin-left rounded-full"
        style={{ transform: `scaleX(${max > 0 ? Math.min(1, value / max) : 0})`, backgroundColor: color }}
      />
    </span>
  );
}

/**
 * Historial de trayectos: qué se movió en la ventana elegida, por ciudad, por departamento y por corredor.
 * Por corredor suma segmento a segmento (sin contar dos veces un tramo que recorre varios corredores) e
 * incluye peajes, combustible y CO₂e estimados. Cada vista se exporta a CSV.
 */
export function HistoryView({ data }: { data: History }) {
  const [view, setView] = useState<View>("ciudades");
  const { money } = useApp();
  const t = data.totals;

  const maxCity = Math.max(1, ...data.by_city.map((c) => c.tons_out + c.tons_in));
  const maxDept = Math.max(1, ...data.by_department.map((d) => d.tons_out + d.tons_in));
  const maxCorr = Math.max(1, ...data.by_corridor.map((c) => c.tons));

  const cityCols: Column<HistoryCity>[] = [
    {
      key: "city",
      label: "Ciudad",
      render: (c) => (
        <Link href={`/red?ciudad=${encodeURIComponent(c.city)}`} className="font-medium hover:text-primary">
          {c.city}
        </Link>
      ),
      csv: (c) => c.city,
    },
    { key: "dept", label: "Departamento", render: (c) => c.department ?? "—", csv: (c) => c.department ?? "" },
    { key: "out", label: "Salen", align: "right", render: (c) => n(c.out), csv: (c) => c.out },
    { key: "in", label: "Llegan", align: "right", render: (c) => n(c.in), csv: (c) => c.in },
    {
      key: "tons",
      label: "Toneladas",
      align: "right",
      render: (c) => (
        <span className="flex items-center justify-end gap-3">
          <Share value={c.tons_out + c.tons_in} max={maxCity} />
          <span className="w-20">{c.tons_fmt}</span>
        </span>
      ),
      csv: (c) => c.tons_out + c.tons_in,
    },
    { key: "cost", label: "Flete de lo que sale", align: "right", render: (c) => <Money usd={c.cost_out} />, csv: (c) => c.cost_out },
    {
      key: "top",
      label: "Destinos principales",
      render: (c) => (
        <span className="text-xs text-muted-foreground">
          {c.top_destinations.map((d) => `${d.city} (${d.shipments})`).join(" · ") || "—"}
        </span>
      ),
      csv: (c) => c.top_destinations.map((d) => `${d.city} (${d.shipments})`).join("; "),
    },
  ];

  const deptCols: Column<HistoryDepartment>[] = [
    { key: "name", label: "Departamento", render: (d) => <span className="font-medium">{d.name}</span>, csv: (d) => d.name },
    { key: "cities", label: "Ciudades", align: "right", render: (d) => n(d.cities), csv: (d) => d.cities },
    { key: "out", label: "Salen", align: "right", render: (d) => n(d.out), csv: (d) => d.out },
    { key: "in", label: "Llegan", align: "right", render: (d) => n(d.in), csv: (d) => d.in },
    {
      key: "tons",
      label: "Toneladas",
      align: "right",
      render: (d) => (
        <span className="flex items-center justify-end gap-3">
          <Share value={d.tons_out + d.tons_in} max={maxDept} />
          <span className="w-20">{d.tons_fmt}</span>
        </span>
      ),
      csv: (d) => d.tons_out + d.tons_in,
    },
    { key: "cost", label: "Flete de lo que sale", align: "right", render: (d) => <Money usd={d.cost_out} />, csv: (d) => d.cost_out },
  ];

  const corrCols: Column<HistoryCorridor>[] = [
    {
      key: "corridor",
      label: "Corredor",
      render: (c) => (
        <span className="flex items-center gap-2.5">
          <ModeIcon mode={c.mode} />
          <span className="font-medium">{c.corridor}</span>
        </span>
      ),
      csv: (c) => c.corridor,
    },
    { key: "mode", label: "Modo", render: (c) => MODES[c.mode].label, csv: (c) => MODES[c.mode].label },
    { key: "ship", label: "Envíos", align: "right", render: (c) => n(c.shipments), csv: (c) => c.shipments },
    {
      key: "tons",
      label: "Toneladas",
      align: "right",
      render: (c) => (
        <span className="flex items-center justify-end gap-3">
          <Share value={c.tons} max={maxCorr} color={MODES[c.mode].color} />
          <span className="w-20">{c.tons_fmt}</span>
        </span>
      ),
      csv: (c) => c.tons,
    },
    { key: "km", label: "Recorrido", align: "right", render: (c) => c.km_fmt, csv: (c) => c.km },
    { key: "cost", label: "Flete", align: "right", render: (c) => <Money usd={c.cost} />, csv: (c) => c.cost },
    { key: "tolls", label: "Peajes", align: "right", render: (c) => (c.tolls ? <Money usd={c.tolls} /> : <span className="text-muted-foreground">—</span>), csv: (c) => c.tolls },
    { key: "fuel", label: "Combustible", align: "right", render: (c) => c.fuel_fmt, csv: (c) => c.fuel_l },
    { key: "co2", label: "CO₂e", align: "right", render: (c) => c.co2e_fmt, csv: (c) => c.co2e_kg },
  ];

  const tolls = data.by_corridor.reduce((a, c) => a + c.tolls, 0);
  const fuel = data.by_corridor.reduce((a, c) => a + c.fuel_l, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          id="history-view"
          label="Vista"
          value={view}
          options={VIEWS.map((v) => ({ value: v.key, label: v.label }))}
          onChange={(v) => setView(v as View)}
        />
        <nav aria-label="Ventana de tiempo" className="inline-flex rounded-full bg-fill p-1 text-sm">
          {WINDOWS.map((d) => (
            <Link
              key={d}
              href={`/historial?dias=${d}`}
              scroll={false}
              aria-current={data.window_days === d ? "page" : undefined}
              className={cn(
                "press rounded-full px-3.5 py-1.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80",
                data.window_days === d ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d} días
            </Link>
          ))}
        </nav>
      </div>

      <StatStrip
        items={[
          { label: "Envíos", value: n(t.shipments), hint: `salieron en los últimos ${data.window_days} días` },
          { label: "Toneladas movidas", value: t.tons_fmt, hint: `${t.cities} ciudades · ${t.departments} departamentos` },
          { label: "Flete", value: money(t.cost, true), hint: `${t.corridors} corredores usados` },
          {
            label: "Peajes",
            value: tolls ? money(tolls, true) : "Sin tarifa",
            hint: tolls ? `${n(Math.round(fuel))} L de combustible estimado` : `Carga las tarifas en Configuración · ${n(Math.round(fuel))} L de combustible`,
            href: tolls ? undefined : "/configuracion",
          },
        ]}
      />

      {t.shipments === 0 ? (
        <div className="glass rounded-3xl">
          <EmptyState
            figure="0"
            title="Sin envíos en esta ventana"
            description="Amplía la ventana de tiempo o crea un envío para empezar a acumular historial."
            action={{ label: "Ver 90 días", href: "/historial?dias=90" }}
          />
        </div>
      ) : view === "ciudades" ? (
        <DetailTable columns={cityCols} rows={data.by_city} getKey={(c) => c.city} csvName={`historial-ciudades-${data.window_days}d`} />
      ) : view === "departamentos" ? (
        <DetailTable columns={deptCols} rows={data.by_department} getKey={(d) => d.code} csvName={`historial-departamentos-${data.window_days}d`} />
      ) : (
        <DetailTable columns={corrCols} rows={data.by_corridor} getKey={(c) => c.corridor} csvName={`historial-corredores-${data.window_days}d`} />
      )}

      <p className="max-w-[70ch] text-[13px] text-muted-foreground">
        Entran los envíos que salieron dentro de la ventana. Por corredor se suma cada segmento de la ruta una sola vez.
        Peajes según la tarifa cargada en Configuración; combustible y CO₂e estimados con los factores por modo (no es un
        inventario certificado). Datos simulados.
      </p>
    </div>
  );
}

/** Control segmentado con píldora que se desliza (layoutId, resorte estándar). */
function Segmented({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <LayoutGroup id={id}>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-fill p-1 text-sm">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={cn(
                "press relative rounded-full px-3.5 py-1.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80",
                on ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {on && <motion.span layoutId="pill" transition={SPRING} className="absolute inset-0 rounded-full bg-card shadow-sm" aria-hidden />}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
