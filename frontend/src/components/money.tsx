"use client";

import { useApp } from "@/components/providers";

/**
 * Monto en la moneda elegida (la API entrega USD). `compact` abrevia millones y `suffix` añade una
 * unidad ("/ t"). Usable desde Server Components.
 */
export function Money({
  usd,
  suffix,
  compact,
  className,
}: {
  usd: number | null | undefined;
  suffix?: string;
  compact?: boolean;
  className?: string;
}) {
  const { money } = useApp();
  return (
    <span className={className}>
      {money(usd, compact)}
      {suffix}
    </span>
  );
}
