"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, MapPin, Search, Truck } from "lucide-react";

import { GroupBlock } from "@/components/corridors/group-block";
import { EmptyState } from "@/components/ui/empty-state";
import { StatStrip } from "@/components/ui/stat-strip";
import type { Warehouse, WarehouseRole, WarehouseSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

import { WarehouseNetworkMap } from "./network-map";
import { Capabilities, n0, OccupancyBar, RoleIcon, WarehouseStatusBadge } from "./status";

/** Red de bodegas: indicadores, filtros por rol, esquema hub-and-spoke y la lista agrupada por ciudad. */
export function WarehouseBoard({ warehouses, summary, roles }: { warehouses: Warehouse[]; summary: WarehouseSummary; roles: WarehouseRole[] }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return warehouses.filter(
      (w) =>
        (!q || [w.name, w.city, w.code, w.manager, w.role_label].filter(Boolean).join(" ").toLowerCase().includes(q)) &&
        (!role || w.role === role) &&
        (!alertsOnly || w.alerts.length > 0),
    );
  }, [warehouses, query, role, alertsOnly]);

  const ids = useMemo(() => new Set(list.map((w) => w.code)), [list]);
  const filtering = !!(query || role || alertsOnly);

  const groups = useMemo(() => {
    const by: Record<string, Warehouse[]> = {};
    for (const w of list) (by[w.city] ??= []).push(w);
    const rank = (r: string) => (r === "hub" ? 0 : r === "regional" ? 1 : 2);
    return Object.entries(by)
      .map(([city, items]) => ({ city, items: items.sort((a, b) => rank(a.role) - rank(b.role) || a.name.localeCompare(b.name)) }))
      .sort((a, b) => b.items.length - a.items.length || a.city.localeCompare(b.city));
  }, [list]);

  const alerts = summary.low_stock_lines + summary.over_stock_lines + summary.full_warehouses.length;
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const w of warehouses) c[w.role] = (c[w.role] ?? 0) + 1;
    return c;
  }, [warehouses]);

  return (
    <div className="flex flex-col gap-5">
      <StatStrip
        items={[
          { label: "Bodegas", value: summary.warehouses, hint: `en ${summary.cities} ciudades · ${summary.operating} operativas` },
          { label: "Ocupación", value: `${summary.occupancy_pct.toLocaleString("es-CO")} %`, hint: `${n0(summary.used_m3)} de ${n0(summary.capacity_m3)} m³`, tone: summary.occupancy_pct >= 90 ? "danger" : summary.occupancy_pct >= 75 ? "warning" : undefined },
          { label: "Bajo el mínimo", value: summary.low_stock_lines, hint: "productos por reponer", tone: summary.low_stock_lines ? "danger" : undefined, active: alertsOnly, onClick: () => setAlertsOnly(!alertsOnly) },
          { label: "En exceso", value: summary.over_stock_lines, hint: `${summary.full_warehouses.length} ${summary.full_warehouses.length === 1 ? "bodega casi llena" : "bodegas casi llenas"}`, tone: summary.over_stock_lines ? "warning" : undefined },
          { label: "Traslados en tránsito", value: summary.in_transit, hint: "entre bodegas", href: "/bodegas?ver=traslados" },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative flex h-10 w-full max-w-xs items-center">
              <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar bodega, ciudad o responsable" aria-label="Buscar bodegas"
                className="h-10 w-full field pr-3 pl-9 text-sm outline-none" />
            </label>
            <button type="button" aria-pressed={alertsOnly} onClick={() => setAlertsOnly(!alertsOnly)}
              className={cn("press flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors", alertsOnly ? "border-warning/50 bg-warning/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
              Con alertas {alerts ? <span className="tabular font-semibold">{warehouses.filter((w) => w.alerts.length).length}</span> : null}
            </button>
            {filtering && (
              <button type="button" className="press text-xs text-primary hover:underline" onClick={() => { setQuery(""); setRole(null); setAlertsOnly(false); }}>
                Quitar filtros
              </button>
            )}
          </div>
          <div className="chip-scroll flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por rol">
            {roles.map((r) => {
              const on = role === r.key;
              return (
                <button key={r.key} type="button" aria-pressed={on} onClick={() => setRole(on ? null : r.key)} title={`${r.description} Almacena: ${r.stores}`}
                  className={cn("press flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors", on ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                  <RoleIcon role={r.key} className="size-3.5" />
                  {r.label}
                  <span className="tabular text-muted-foreground">{counts[r.key] ?? 0}</span>
                </button>
              );
            })}
          </div>
          {role && <p className="rounded-2xl border border-border bg-card px-4 py-3 text-[13px]"><strong>{roles.find((r) => r.key === role)?.label}:</strong> {roles.find((r) => r.key === role)?.description} Almacena: {roles.find((r) => r.key === role)?.stores.toLowerCase()}.</p>}

          <p className="tabular text-xs text-muted-foreground" aria-live="polite">{list.length} de {warehouses.length} bodegas en {groups.length} ciudades</p>
          <ul className="flex flex-col gap-1">
            {groups.length === 0 && <li className="glass rounded-3xl"><EmptyState title="Ninguna bodega coincide" description="Prueba con otra ciudad o quita los filtros." action={{ label: "Quitar filtros", onClick: () => { setQuery(""); setRole(null); setAlertsOnly(false); } }} /></li>}
            {groups.map((g, i) => (
              <GroupBlock key={g.city} title={g.city} count={g.items.length} icon={<MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                open={open[g.city] ?? (filtering || i < 4)} onToggle={() => setOpen((o) => ({ ...o, [g.city]: !(o[g.city] ?? (filtering || i < 4)) }))}>
                {g.items.map((w) => (
                  <li key={w.warehouse_id}>
                    <Link href={`/bodegas/${w.warehouse_id}`} data-ripple className="row-link block px-5 py-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-muted-foreground"><RoleIcon role={w.role} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-semibold">{w.name}</span>
                            {w.status !== "Operativa" && <WarehouseStatusBadge status={w.status} />}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span className="font-mono">{w.code}</span>
                            <span>· {w.role_label}</span>
                            <Capabilities w={w} />
                          </div>
                        </div>
                        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </div>
                      <OccupancyBar pct={w.occupancy_pct} className="mt-3 ml-11" label={false} />
                      <div className="tabular mt-1.5 ml-11 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{w.occupancy_pct.toLocaleString("es-CO")} % de {n0(w.capacity_m3)} m³</span>
                        <span>{w.stock_lines} productos</span>
                        {w.vehicles > 0 && <span className="inline-flex items-center gap-1"><Truck className="size-3" aria-hidden />{w.vehicles}</span>}
                      </div>
                      {w.alerts.length > 0 && <p className="mt-1.5 ml-11 text-xs text-warning">{w.alerts.join(" · ")}</p>}
                    </Link>
                  </li>
                ))}
              </GroupBlock>
            ))}
          </ul>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-24 xl:h-fit">
          <div className="glass rounded-3xl p-4">
            <h2 className="px-1 text-sm font-semibold">Cómo fluye la carga</h2>
            <p className="mt-1 px-1 text-xs text-muted-foreground">
              Lo que se recoge en una bodega urbana sube a su centro regional o nacional, se clasifica y viaja por la red hasta el centro del destino. Las especializadas (frío, puerto, aduana, frontera) cuelgan del centro de su ciudad.
            </p>
            <WarehouseNetworkMap network={summary.network} highlight={filtering ? (n) => ids.has(n.code) : undefined} className="mt-2" />
          </div>
        </aside>
      </div>
    </div>
  );
}
