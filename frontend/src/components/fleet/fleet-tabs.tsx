import Link from "next/link";

import { cn } from "@/lib/utils";

export const FLEET_TABS = [
  { key: "vehiculos", label: "Vehículos", href: "/flota" },
  { key: "mantenimiento", label: "Mantenimiento", href: "/flota?ver=mantenimiento" },
  { key: "fallas", label: "Fallas", href: "/flota?ver=fallas" },
  { key: "conductores", label: "Conductores", href: "/flota?ver=conductores" },
] as const;

export type FleetTab = (typeof FLEET_TABS)[number]["key"];

/** Pestañas de la flota: cada una es una URL, así que se puede enlazar y recargar. En celular, dos por fila. */
export function FleetTabs({ current, badges = {} }: { current: FleetTab; badges?: Partial<Record<FleetTab, number>> }) {
  return (
    <nav aria-label="Secciones de la flota" className="grid grid-cols-2 gap-1 rounded-2xl bg-fill p-1 text-sm sm:inline-flex sm:gap-0 sm:rounded-full">
      {FLEET_TABS.map((t) => {
        const on = t.key === current;
        const n = badges[t.key];
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "press flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-1.5 transition-colors sm:rounded-full",
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
