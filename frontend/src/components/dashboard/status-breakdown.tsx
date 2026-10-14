"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { STATUS_ORDER } from "@/lib/modes";
import type { DashboardSummary } from "@/lib/types";

/** Envíos por estado: cada fila lleva a la lista de envíos filtrada por ese estado. */
export function StatusBreakdown({ counts }: { counts: DashboardSummary["status_counts"] }) {
  const total = STATUS_ORDER.reduce((a, s) => a + (counts[s] ?? 0), 0) || 1;
  return (
    <ul className="flex flex-col gap-1 px-3 pb-4">
      {STATUS_ORDER.map((s) => (
        <li key={s}>
          <Link
            href={`/envios?estado=${encodeURIComponent(s)}`}
            className="press flex min-h-10 items-center justify-between gap-3 rounded-xl px-2 outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <StatusBadge status={s} />
            <span className="flex items-baseline gap-2">
              <span className="tabular text-sm font-medium">{counts[s] ?? 0}</span>
              <span className="tabular w-10 text-right text-xs text-muted-foreground">
                {Math.round((100 * (counts[s] ?? 0)) / total)} %
              </span>
              <ChevronRight className="size-4 self-center text-muted-foreground" aria-hidden />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
