"use client";

import { useState } from "react";
import Link from "next/link";

import { BentoCell } from "@/components/dashboard/bento";
import { DispatchTrend, ModalSplit, TopCorridors } from "@/components/dashboard/charts";
import { Button } from "@/components/ui/button";
import { EcoBar } from "@/components/ui/dial";
import { DetailTable } from "@/components/ui/detail-table";
import { Sheet } from "@/components/ui/sheet";
import { MODES } from "@/lib/modes";
import type { DashboardSummary, SustainabilitySummary } from "@/lib/types";

const nf = (n: number, d = 0) => n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
const dayFmt = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });

/** Reparto modal: gráfico en el panel y detalle completo (t-km, CO₂e, combustible, intensidad) en la hoja. */
export function ModalSplitCell({
  data,
  footprint,
  className,
}: {
  data: DashboardSummary["modal_split"];
  footprint: SustainabilitySummary["by_mode"];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const fp = new Map(footprint.map((m) => [m.mode, m]));
  return (
    <>
      <BentoCell
        className={className}
        title="Reparto modal"
        description="Toneladas-kilómetro movidas por modo"
        onOpen={() => setOpen(true)}
      >
        <ModalSplit data={data} />
      </BentoCell>
      <Sheet open={open} onClose={() => setOpen(false)} title="Reparto modal" description="Toneladas-kilómetro movidas por modo, con su huella">
        <div className="-mx-5 mb-4">
          <ModalSplit data={data} />
        </div>
        <DetailTable
          csvName="reparto-modal"
          getKey={(r) => r.mode}
          rows={data}
          columns={[
            {
              key: "mode",
              label: "Modo",
              render: (r) => {
                const Icon = MODES[r.mode].icon;
                return (
                  <span className="flex items-center gap-2 font-medium">
                    <Icon className="size-4" style={{ color: MODES[r.mode].color }} aria-hidden />
                    {r.label}
                  </span>
                );
              },
              csv: (r) => r.label,
            },
            { key: "tkm", label: "t-km", align: "right", render: (r) => r.tkm_fmt, csv: (r) => r.tkm },
            { key: "share", label: "Participación", align: "right", render: (r) => `${nf(r.share_pct, 1)} %`, csv: (r) => r.share_pct },
            {
              key: "co2",
              label: "CO₂e",
              align: "right",
              render: (r) => fp.get(r.mode)?.co2e_fmt ?? "—",
              csv: (r) => fp.get(r.mode)?.co2e_kg ?? "",
            },
            {
              key: "fuel",
              label: "Combustible",
              align: "right",
              render: (r) => fp.get(r.mode)?.fuel_fmt ?? "—",
              csv: (r) => fp.get(r.mode)?.fuel_l ?? "",
            },
            {
              key: "int",
              label: "g CO₂e/t-km",
              align: "right",
              render: (r) => fp.get(r.mode)?.intensity_g_tkm ?? "—",
              csv: (r) => fp.get(r.mode)?.intensity_g_tkm ?? "",
            },
            {
              key: "go",
              label: "",
              render: (r) => (
                <Link href={`/envios?modo=${r.mode}`} className="text-primary hover:underline">
                  Ver envíos
                </Link>
              ),
            },
          ]}
        />
      </Sheet>
    </>
  );
}

/** Despachos por día: gráfico y tabla día por día con total, promedio y pico. */
export function DispatchCell({ data, className }: { data: DashboardSummary["dispatches_14d"]; className?: string }) {
  const [open, setOpen] = useState(false);
  const total = data.reduce((a, d) => a + d.count, 0);
  const peak = data.reduce((a, d) => (d.count > a.count ? d : a), data[0]);
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <>
      <BentoCell className={className} title="Despachos" onOpen={() => setOpen(true)}>
        <DispatchTrend data={data} />
      </BentoCell>
      <Sheet open={open} onClose={() => setOpen(false)} title="Despachos" description="Últimos 14 días">
        <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Total", nf(total)],
            ["Promedio diario", nf(total / data.length, 1)],
            ["Día pico", `${peak.count} · ${dayFmt(peak.date)}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-fill p-3">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="tabular mt-1 text-lg font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        <DetailTable
          csvName="despachos-14-dias"
          getKey={(r) => r.date}
          rows={[...data].reverse()}
          columns={[
            { key: "d", label: "Fecha", render: (r) => dayFmt(r.date), csv: (r) => r.date },
            { key: "n", label: "Despachos", align: "right", render: (r) => r.count, csv: (r) => r.count },
            { key: "b", label: "", render: (r) => <EcoBar value={r.count} max={max} color="var(--sys-blue)" className="min-w-24" /> },
          ]}
        />
        <div className="mt-4 flex justify-end">
          <Button asChild>
            <Link href="/envios">Ver todos los envíos</Link>
          </Button>
        </div>
      </Sheet>
    </>
  );
}

/** Corredores más cargados: top 6 en el panel y todos los corredores en la hoja. */
export function CorridorsCell({
  top,
  all,
  className,
}: {
  top: DashboardSummary["top_corridors"];
  all: DashboardSummary["all_corridors"];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const max = Math.max(1, ...all.map((c) => c.tons));
  const total = all.reduce((a, c) => a + c.tons, 0) || 1;
  return (
    <>
      <BentoCell
        className={className}
        title="Corredores más cargados"
        description="Toneladas en los últimos despachos"
        onOpen={() => setOpen(true)}
      >
        <TopCorridors data={top} />
      </BentoCell>
      <Sheet open={open} onClose={() => setOpen(false)} title="Corredores" description={`${all.length} corredores con carga`}>
        <DetailTable
          csvName="corredores"
          getKey={(r) => r.corridor}
          rows={all}
          columns={[
            { key: "c", label: "Corredor", render: (r) => <span className="font-medium">{r.corridor}</span>, csv: (r) => r.corridor },
            { key: "t", label: "Toneladas", align: "right", render: (r) => r.tons_fmt, csv: (r) => r.tons },
            { key: "p", label: "% del total", align: "right", render: (r) => `${nf((100 * r.tons) / total, 1)} %`, csv: (r) => ((100 * r.tons) / total).toFixed(1) },
            { key: "b", label: "", render: (r) => <EcoBar value={r.tons} max={max} color="var(--sys-blue)" className="min-w-24" /> },
          ]}
        />
      </Sheet>
    </>
  );
}
