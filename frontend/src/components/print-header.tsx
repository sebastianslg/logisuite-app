"use client";

import { useHydrated } from "@/lib/use-hydrated";

/**
 * Encabezado de impresión de una lista: marca, título de la pantalla y fecha de impresión en es-CO. En pantalla
 * no ocupa nada (`hidden print:block`). La fecha se escribe después de hidratar: el HTML del servidor sale sin
 * ella, así no hay diferencia entre los dos renders ni un parpadeo visible.
 */
export function PrintHeader({ title }: { title: string }) {
  const hydrated = useHydrated();
  const fecha = hydrated ? new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date()) : "";

  return (
    <header data-print-header className="mb-6 hidden border-b border-border pb-3 print:block">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold tracking-tight">Westvane</p>
        <p className="tabular text-xs text-muted-foreground">{fecha}</p>
      </div>
      <p className="mt-1.5 text-[1.25rem] leading-tight font-semibold tracking-[-0.02em]">{title}</p>
    </header>
  );
}
