"use client";

import { DetailTable } from "@/components/ui/detail-table";
import { MODES } from "@/lib/modes";
import type { SustainabilitySummary } from "@/lib/types";

const nf = (n: number, d = 0) => n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Tabla completa por modo: t-km, CO₂e, combustible, intensidad y participación. Sirve a las hojas de huella y combustible. */
export function ModeFootprintTable({ rows, csvName }: { rows: SustainabilitySummary["by_mode"]; csvName: string }) {
  return (
    <DetailTable
      csvName={csvName}
      getKey={(r) => r.mode}
      rows={rows}
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
        { key: "fuel", label: "Combustible tipo", render: (r) => r.fuel_type, csv: (r) => r.fuel_type },
        { key: "tkm", label: "t-km", align: "right", render: (r) => r.tkm_fmt, csv: (r) => r.tkm },
        { key: "int", label: "g CO₂e/t-km", align: "right", render: (r) => nf(r.intensity_g_tkm), csv: (r) => r.intensity_g_tkm },
        { key: "co2", label: "CO₂e", align: "right", render: (r) => r.co2e_fmt, csv: (r) => r.co2e_kg },
        { key: "share", label: "% de CO₂e", align: "right", render: (r) => `${nf(r.co2e_share_pct, 1)} %`, csv: (r) => r.co2e_share_pct },
        { key: "l", label: "Combustible", align: "right", render: (r) => r.fuel_fmt, csv: (r) => r.fuel_l },
      ]}
    />
  );
}
