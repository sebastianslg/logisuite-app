"use client";

import { useApp } from "@/components/providers";

/** Monto en la moneda elegida (la API entrega USD). Usable desde Server Components. */
export function Money({ usd, suffix }: { usd: number | null | undefined; suffix?: string }) {
  const { money } = useApp();
  return (
    <>
      {money(usd)}
      {suffix}
    </>
  );
}
