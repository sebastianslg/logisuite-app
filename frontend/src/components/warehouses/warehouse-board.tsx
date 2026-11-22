"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EnlaceIntencion as Link } from "@/components/ui/enlace-intencion";
import { useRouter } from "next/navigation";
import { ChevronRight, MapPin, Plus, Search, Truck } from "lucide-react";

import { GroupBlock } from "@/components/corridors/group-block";
import { LimiteSeccion } from "@/components/limite-seccion";
import { EmptyStart } from "@/components/empty-start";
import { PrintHeader } from "@/components/print-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatStrip } from "@/components/ui/stat-strip";
import { PaginasLocales, usePaginas } from "@/components/ui/paginas-locales";
import { filtersActive, isStartEmpty } from "@/lib/empty";
import type { Warehouse, WarehouseRole, WarehouseSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useVistaGuardada } from "@/lib/use-vista-guardada";

import { WarehouseNetworkMap } from "./network-map";
import { Capabilities, n0, OccupancyBar, RoleIcon, WarehouseStatusBadge } from "./status";

/** Filtros de la red de bodegas. Viven en la URL (`?q=…&rol=…&alertas=1`) para que el enlace restaure la vista. */
export interface WarehouseFilters {
  q: string;
  /** Clave del rol (?rol=hub); vacío, todos. */
  role: string;
  /** Solo bodegas con avisos de inventario (?alertas=1). */
  alerts: boolean;
}

/** Firma estable de los filtros, para distinguir un cambio de URL propio de uno que llega de fuera. */
const warehouseKey = (f: WarehouseFilters) => JSON.stringify([f.q.trim(), f.role, f.alerts]);
const RECORDAR = ["rol", "alertas"] as const;

/** Enlace de la red con estos filtros; sin filtros, la ruta limpia. */
function warehouseHref(f: WarehouseFilters): string {
  const sp = new URLSearchParams();
  if (f.q.trim()) sp.set("q", f.q.trim());
  if (f.role) sp.set("rol", f.role);
  if (f.alerts) sp.set("alertas", "1");
  const qs = sp.toString();
  return `/bodegas${qs ? `?${qs}` : ""}`;
}

/**
 * Red de bodegas: indicadores, filtros por rol, esquema hub-and-spoke y la lista agrupada por ciudad.
 * Los filtros viven en la URL (`initial` llega del servidor) y cada cambio navega a esa URL.
 */
export function WarehouseBoard({ warehouses, summary, roles, initial }: { warehouses: Warehouse[]; summary: WarehouseSummary; roles: WarehouseRole[]; initial: WarehouseFilters }) {
  const router = useRouter();
  const recordar = useVistaGuardada("/bodegas", RECORDAR);
  const [query, setQuery] = useState(initial.q);
  // Un rol que ya no existe (o un enlace viejo) se ignora en vez de dejar la lista vacía
  const [role, setRole] = useState<string | null>(roles.some((r) => r.key === initial.role) ? initial.role : null);
  const [alertsOnly, setAlertsOnly] = useState(initial.alerts);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // En papel no hay listas plegadas: la impresión abre todas las ciudades para que no falte ninguna bodega
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("print");
    const sync = () => setPrinting(mq.matches);
    const before = () => setPrinting(true);
    sync();
    mq.addEventListener("change", sync);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", sync);
    };
  }, []);

  const inicialKey = warehouseKey(initial);
  const confirmada = useRef(inicialKey);
  const primeraVez = useRef(true);

  /** Navega con los filtros nuevos; los que no cambian se conservan. Igual que `irA` en la lista de envíos. */
  function irA(cambios: Partial<WarehouseFilters>, modo: "push" | "replace" = "push") {
    const next: WarehouseFilters = { q: query, role: role ?? "", alerts: alertsOnly, ...cambios };
    // Lo que esta pantalla escribe queda confirmado: al volver del servidor no se pisa lo que se está escribiendo
    confirmada.current = warehouseKey(next);
    const href = warehouseHref(next);
    recordar(href);
    if (modo === "replace") router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  function quitarFiltros() {
    setQuery("");
    setRole(null);
    setAlertsOnly(false);
    irA({ q: "", role: "", alerts: false });
  }

  function toggleAlertas() {
    const next = !alertsOnly;
    setAlertsOnly(next);
    irA({ alerts: next });
  }

  // Un cambio de URL que no nació aquí (atrás/adelante, un enlace o la pestaña): manda la URL
  useEffect(() => {
    if (inicialKey === confirmada.current) return;
    confirmada.current = inicialKey;
    setQuery(initial.q);
    setRole(roles.some((r) => r.key === initial.role) ? initial.role : null);
    setAlertsOnly(initial.alerts);
  }, [inicialKey, initial, roles]);

  // La búsqueda se escribe al instante en la lista y, tras una pausa, también en la URL (sin una entrada por tecla)
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (query.trim() !== initial.q.trim()) irA({ q: query }, "replace");
    }, 400);
    return () => clearTimeout(t);
    // También al cambiar otro filtro: el temporizador pendiente no debe escribir una URL con el estado viejo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, role, alertsOnly]);

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
  const filtering = filtersActive(query, role, alertsOnly);
  // La red se ve vacía porque todavía no hay bodegas (no porque un filtro las esconda)
  const inicioVacio = isStartEmpty(warehouses.length, filtering);

  const groups = useMemo(() => {
    const by: Record<string, Warehouse[]> = {};
    for (const w of list) (by[w.city] ??= []).push(w);
    const rank = (r: string) => (r === "hub" ? 0 : r === "regional" ? 1 : 2);
    return Object.entries(by)
      .map(([city, items]) => ({ city, items: items.sort((a, b) => rank(a.role) - rank(b.role) || a.name.localeCompare(b.name)) }))
      .sort((a, b) => b.items.length - a.items.length || a.city.localeCompare(b.city));
  }, [list]);
  // Se pagina después de agrupar: ninguna bodega cambia de lugar al pasar de página.
  const ordenadas = useMemo(() => groups.flatMap(g => g.items), [groups]);
  const pagina = usePaginas(ordenadas, JSON.stringify([query, role, alertsOnly]));
  const visibles = pagina.paginas > 1 && !printing ? new Set(pagina.filas.map(w => w.warehouse_id)) : null;
  const gruposVisibles = visibles ? groups.map(g => ({ ...g, items: g.items.filter(w => visibles.has(w.warehouse_id)) })).filter(g => g.items.length) : groups;

  const alerts = summary.low_stock_lines + summary.over_stock_lines + summary.full_warehouses.length;
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const w of warehouses) c[w.role] = (c[w.role] ?? 0) + 1;
    return c;
  }, [warehouses]);

  return (
    <div className="flex flex-col gap-5 print:block">
      <PrintHeader title="Bodegas y centros de distribución" />
      <div className="print:hidden">
        <StatStrip
        items={[
          { label: "Bodegas", value: summary.warehouses, hint: `en ${summary.cities} ciudades · ${summary.operating} operativas` },
          { label: "Ocupación", value: `${summary.occupancy_pct.toLocaleString("es-CO")} %`, hint: `${n0(summary.used_m3)} de ${n0(summary.capacity_m3)} m³`, tone: summary.occupancy_pct >= 90 ? "danger" : summary.occupancy_pct >= 75 ? "warning" : undefined },
          { label: "Bajo el mínimo", value: summary.low_stock_lines, hint: "productos por reponer", tone: summary.low_stock_lines ? "danger" : undefined, active: alertsOnly, onClick: toggleAlertas },
          { label: "En exceso", value: summary.over_stock_lines, hint: `${summary.full_warehouses.length} ${summary.full_warehouses.length === 1 ? "bodega casi llena" : "bodegas casi llenas"}`, tone: summary.over_stock_lines ? "warning" : undefined },
          { label: "Traslados en tránsito", value: summary.in_transit, hint: "entre bodegas", href: "/bodegas?ver=traslados" },
        ]}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] print:block">
        <div className="flex min-w-0 flex-col gap-4 print:block">
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <label className="relative flex h-10 w-full max-w-xs items-center">
              <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar bodega, ciudad o responsable" aria-label="Buscar bodegas"
                className="h-10 w-full field pr-3 pl-9 text-sm outline-none" />
            </label>
            <button type="button" aria-pressed={alertsOnly} onClick={toggleAlertas}
              className={cn("press flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors", alertsOnly ? "border-warning/50 bg-warning/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
              Con alertas {alerts ? <span className="tabular font-semibold">{warehouses.filter((w) => w.alerts.length).length}</span> : null}
            </button>
            {filtering && (
              <button type="button" className="press text-xs text-primary hover:underline" onClick={quitarFiltros}>
                Quitar filtros
              </button>
            )}
          </div>
          <div className="chip-scroll flex flex-wrap gap-1.5 print:hidden" role="group" aria-label="Filtrar por rol">
            {roles.map((r) => {
              const on = role === r.key;
              return (
                <button key={r.key} type="button" aria-pressed={on} onClick={() => { setRole(on ? null : r.key); irA({ role: on ? "" : r.key }); }} title={`${r.description} Almacena: ${r.stores}`}
                  className={cn("press flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors", on ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                  <RoleIcon role={r.key} className="size-3.5" />
                  {r.label}
                  <span className="tabular text-muted-foreground">{counts[r.key] ?? 0}</span>
                </button>
              );
            })}
          </div>
          {role && <p className="rounded-2xl border border-border bg-card px-4 py-3 text-[13px] print:hidden"><strong>{roles.find((r) => r.key === role)?.label}:</strong> {roles.find((r) => r.key === role)?.description} Almacena: {roles.find((r) => r.key === role)?.stores.toLowerCase()}.</p>}

          {!inicioVacio && (
            <p className="tabular text-xs text-muted-foreground print:mb-2" aria-live="polite">{list.length} de {warehouses.length} bodegas en {groups.length} ciudades</p>
          )}
          <ul className="flex flex-col gap-1">
            {inicioVacio ? (
              <li className="glass rounded-3xl">
                <EmptyStart
                  title="Aún no hay bodegas"
                  description="Crea la primera con su ciudad y su función en la red. El inventario se carga desde un Excel cuando la bodega ya existe."
                  actions={[
                    { label: "Crear la primera bodega", href: "/bodegas/nueva", icon: Plus },
                  ]}
                />
              </li>
            ) : groups.length === 0 ? (
              <li className="glass rounded-3xl">
                <EmptyState title="Ninguna bodega coincide" description="Prueba con otra ciudad o quita los filtros." action={{ label: "Quitar filtros", onClick: quitarFiltros }} />
              </li>
            ) : null}
            {gruposVisibles.map((g, i) => (
              <GroupBlock key={g.city} title={g.city} count={g.items.length} icon={<MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                open={printing || (open[g.city] ?? (filtering || i < 4))} onToggle={() => setOpen((o) => ({ ...o, [g.city]: !(printing || (o[g.city] ?? (filtering || i < 4))) }))}>
                {g.items.map((w) => (
                  <li key={w.warehouse_id}>
                    <Link href={`/bodegas/${w.warehouse_id}`} data-ripple className="row-link lift block px-5 py-4">
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
          <PaginasLocales {...pagina} />
        </div>

        <aside className="min-w-0 xl:sticky xl:top-24 xl:h-fit print:hidden">
          <div className="glass rounded-3xl p-4">
            <h2 className="px-1 text-sm font-semibold">Cómo fluye la carga</h2>
            <p className="mt-1 px-1 text-xs text-muted-foreground">
              Lo que se recoge en una bodega urbana sube a su centro regional o nacional, se clasifica y viaja por la red hasta el centro del destino. Las especializadas (frío, puerto, aduana, frontera) cuelgan del centro de su ciudad.
            </p>
            <LimiteSeccion nombre="el esquema de bodegas">
              <WarehouseNetworkMap network={summary.network} highlight={filtering ? (n) => ids.has(n.code) : undefined} className="mt-2" />
            </LimiteSeccion>
          </div>
        </aside>
      </div>
    </div>
  );
}
