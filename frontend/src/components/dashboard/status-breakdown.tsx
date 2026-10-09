import { StatusBadge } from "@/components/status-badge";
import { STATUS_ORDER } from "@/lib/modes";
import type { DashboardSummary } from "@/lib/types";

/** Envíos por estado: badge con ícono + conteo (estado nunca solo por color). */
export function StatusBreakdown({ counts }: { counts: DashboardSummary["status_counts"] }) {
  const total = STATUS_ORDER.reduce((a, s) => a + (counts[s] ?? 0), 0) || 1;
  return (
    <ul className="flex flex-col gap-2.5 px-5 pb-5">
      {STATUS_ORDER.map((s) => (
        <li key={s} className="flex items-center justify-between gap-3">
          <StatusBadge status={s} />
          <span className="flex items-baseline gap-2">
            <span className="tabular text-sm font-medium">{counts[s] ?? 0}</span>
            <span className="tabular w-10 text-right text-xs text-muted-foreground">
              {Math.round((100 * (counts[s] ?? 0)) / total)} %
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
