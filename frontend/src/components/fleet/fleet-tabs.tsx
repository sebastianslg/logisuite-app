import Link from "next/link";

import { cn } from "@/lib/utils";

export const FLEET_TABS = [
  { key: "vehiculos", label: "Vehículos", href: "/flota" },
  { key: "mantenimiento", label: "Mantenimiento", href: "/flota?ver=mantenimiento" },
  { key: "fallas", label: "Fallas", href: "/flota?ver=fallas" },
  { key: "conductores", label: "Conductores", href: "/flota?ver=conductores" },
] as const;

export type FleetTab = (typeof FLEET_TABS)[number]["key"];

/** Pestañas de la flota: cada una es una URL, así que se puede enlazar y recargar. */
export function FleetTabs({ current, badges = {} }: { current: FleetTab; badges?: Partial<Record<FleetTab, number>> }) {
  return (
    <nav aria-label="Secciones de la flota" className="inline-flex max-w-full overflow-x-auto rounded-full bg-fill p-1 text-sm">
      {FLEET_TABS.map((t) => {
        const on = t.key === current;
        const n = badges[t.key];
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
            {n ? <span className="tabular rounded-full bg-destructive/15 px-1.5 text-xs font-semibold text-destructive">{n}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
