"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, TriangleAlert } from "lucide-react";

import { Money } from "@/components/money";
import { EmptyState } from "@/components/ui/empty-state";
import { ModeIcon } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import type { Fault } from "@/lib/types";
import { cn } from "@/lib/utils";

import { dt, SeverityBadge } from "./status";

/** Todas las fallas de la flota: las abiertas primero, de la más grave a la más leve. */
export function FaultsBoard({ faults }: { faults: Fault[] }) {
  const [view, setView] = useState<"abiertas" | "todas">("abiertas");
  const rank = { Crítica: 0, Moderada: 1, Leve: 2 } as const;
  const open = faults.filter((f) => f.status !== "Resuelta").sort((a, b) => rank[a.severity] - rank[b.severity] || b.reported_at.localeCompare(a.reported_at));
  const closed = faults.filter((f) => f.status === "Resuelta");
  const list = view === "abiertas" ? open : [...open, ...closed];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex rounded-md border border-border p-0.5 text-xs w-fit" role="radiogroup" aria-label="Qué fallas ver">
        {(["abiertas", "todas"] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)}
            className={cn("press h-7 rounded px-3 capitalize", view === v ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {v}{v === "abiertas" && open.length > 0 && <span className="ml-1 text-destructive">{open.length}</span>}
          </button>
        ))}
      </div>
      <ul className="glass rule-list overflow-hidden rounded-3xl">
        {list.length === 0 && <li><EmptyState figure="0" title="Sin fallas abiertas" description="Cuando alguien reporte una desde la ficha de un vehículo, aparecerá aquí." /></li>}
        {list.map((f) => (
          <li key={f.fault_id}>
            <Link href={`/flota/${f.vehicle_id}`}
              data-ripple className={cn("row-link items-start px-5 py-4", f.status === "Resuelta" && "opacity-75")}>
              {f.mode && <ModeIcon mode={f.mode} className="mt-0.5 size-8" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{f.code}</span>
                  <span className="text-xs text-muted-foreground">{f.vehicle_type}</span>
                  <SeverityBadge severity={f.severity} />
                  <Badge tone="neutral"><TriangleAlert aria-hidden />{f.category}</Badge>
                  <Badge tone={f.status === "Resuelta" ? "success" : f.status === "En reparación" ? "warning" : "danger"}>{f.status}</Badge>
                  {f.status !== "Resuelta" && !f.blocks_operation && <Badge tone="neutral">Puede operar</Badge>}
                </div>
                <p className="mt-1 text-sm">{f.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reportada {dt(f.reported_at)}{f.reported_by ? ` por ${f.reported_by}` : ""}
                  {f.status === "Resuelta" && <> · resuelta {dt(f.resolved_at)}{f.repair_cost_usd ? <> · <Money usd={f.repair_cost_usd} /></> : null}</>}
                </p>
              </div>
              <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
