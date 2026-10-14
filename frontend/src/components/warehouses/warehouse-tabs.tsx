import Link from "next/link";

import { cn } from "@/lib/utils";

export const WAREHOUSE_TABS = [
  { key: "red", label: "Red de bodegas", href: "/bodegas" },
  { key: "traslados", label: "Traslados", href: "/bodegas?ver=traslados" },
] as const;

export type WarehouseTab = (typeof WAREHOUSE_TABS)[number]["key"];

/** Pestañas de bodegas: cada una es una URL, así que se puede enlazar y recargar. */
export function WarehouseTabs({ current, transit = 0 }: { current: WarehouseTab; transit?: number }) {
  return (
    <nav aria-label="Secciones de bodegas" className="inline-flex max-w-full overflow-x-auto rounded-full bg-fill p-1 text-sm">
      {WAREHOUSE_TABS.map((t) => {
        const on = t.key === current;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "press flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors",
              on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.key === "traslados" && transit > 0 ? <span className="tabular rounded-full bg-warning/15 px-1.5 text-xs font-semibold text-warning">{transit}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
