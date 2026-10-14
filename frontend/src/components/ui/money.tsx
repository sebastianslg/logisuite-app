"use client";

import { useMoney } from "@/lib/prefs";

/** Monto en la moneda elegida (USD o COP según TRM). Recibe siempre USD, la moneda del sistema. */
export function Money({ usd, compact, className }: { usd: number; compact?: boolean; className?: string }) {
  const m = useMoney();
  return (
    <span className={className} title={`${m.other(usd)} · TRM ${m.trm.toLocaleString("es-CO")}`}>
      {m.fmt(usd, compact)}
    </span>
  );
}
