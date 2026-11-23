"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EnlaceIntencion as Link } from "@/components/ui/enlace-intencion";
import { useRouter } from "next/navigation";
import { ChevronRight, FileUp, Plus, Search, TriangleAlert, UserRound, Warehouse as WarehouseIcon } from "lucide-react";

import { EmptyStart } from "@/components/empty-start";
import { PrintHeader } from "@/components/print-header";
import { ModeIcon } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatStrip } from "@/components/ui/stat-strip";
import { PaginasLocales, usePaginas } from "@/components/ui/paginas-locales";
import { abrirCargaDeExcel, filtersActive, isStartEmpty } from "@/lib/empty";
import { MODE_ORDER, MODES, tint } from "@/lib/modes";
import type { FleetSummary, Mode, Vehicle, VehicleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useVistaGuardada } from "@/lib/use-vista-guardada";

import { FLEET_ORDERS, fleetHref, fleetKey, isFleetOrder, type FleetFilters, type FleetOrder } from "./filters";
import { km, ServiceMeter, STATUS_ORDER, VEHICLE_STATUS, VehicleStatusBadge } from "./status";

/**
 * Orden por placa con comparación simple de códigos: da lo mismo en el servidor y en el navegador (sin depender del
 * idioma del entorno) y las placas solo tienen letras, números y guion.
 */
const porPlaca = (a: Vehicle, b: Vehicle) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
const RECORDAR = ["modo", "estado", "alertas", "orden"] as const;

/**
 * Lista de vehículos: indicadores que filtran, búsqueda, filtros por modo y estado, orden y una fila por vehículo.
 * Los filtros y el orden viven en la URL (`initial` llega del servidor); cada cambio navega a esa URL, así que el
 * enlace compartible —y una recarga— devuelven la misma vista.
 */
export function FleetBoard({ vehicles, summary, initial }: { vehicles: Vehicle[]; summary: FleetSummary; initial: FleetFilters }) {
  const router = useRouter();
  const recordar = useVistaGuardada("/flota", RECORDAR);
  const [query, setQuery] = useState(initial.q);
  const [modes, setModes] = useState<Mode[]>(initial.modes);
  const [statuses, setStatuses] = useState<VehicleStatus[]>(initial.statuses);
  const [onlyAlerts, setOnlyAlerts] = useState(initial.alerts);
  const [order, setOrder] = useState<FleetOrder>(initial.order);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // Firma de los filtros que la URL ya tiene (los que llegaron del servidor o los últimos que escribió esta pantalla)
  const inicialKey = fleetKey(initial);
  const confirmada = useRef(inicialKey);
  const primeraVez = useRef(true);

  /** Navega con los filtros nuevos; los que no cambian se conservan. Igual que `irA` en la lista de envíos. */
  function irA(cambios: Partial<FleetFilters>, modo: "push" | "replace" = "push") {
    const next: FleetFilters = { q: query, modes, statuses, alerts: onlyAlerts, order, ...cambios };
    // Lo que esta pantalla escribe queda confirmado: al volver del servidor no se pisa lo que se está escribiendo
    confirmada.current = fleetKey(next);
    const href = fleetHref(next);
    recordar(href);
    if (modo === "replace") router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  function quitarFiltros() {
    setQuery("");
    setModes([]);
    setStatuses([]);
    setOnlyAlerts(false);
    irA({ q: "", modes: [], statuses: [], alerts: false });
  }

  // Un cambio de URL que no nació aquí (atrás/adelante, un enlace o la pestaña): manda la URL
  useEffect(() => {
    if (inicialKey === confirmada.current) return;
    confirmada.current = inicialKey;
    setQuery(initial.q);
    setModes(initial.modes);
    setStatuses(initial.statuses);
    setOnlyAlerts(initial.alerts);
    setOrder(initial.order);
  }, [inicialKey, initial]);

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
  }, [query, modes, statuses, onlyAlerts, order]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = vehicles.filter(
      (v) =>
        (!q ||
          [v.code, v.vehicle_type, v.make, v.model, v.home_name, v.home_city, v.driver?.name]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)) &&
        (modes.length === 0 || modes.includes(v.mode)) &&
        (statuses.length === 0 || statuses.includes(v.status)) &&
        (!onlyAlerts || v.blockers.length > 0 || v.warnings.length > 0),
    );
    if (order === "defecto") return filtered;
    return filtered.sort((a, b) => {
      if (order === "placa") return porPlaca(a, b);
      if (order === "estado") return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || porPlaca(a, b);
      // Próximo mantenimiento: primero lo más consumido (lo que vence antes)
      return b.service.pct_used - a.service.pct_used || porPlaca(a, b);
    });
  }, [vehicles, query, modes, statuses, onlyAlerts, order]);

  const pagina = usePaginas(list, JSON.stringify([query, modes, statuses, onlyAlerts, order]));
  const bs = summary.by_status;
  const blocked = bs["Inhabilitado"] + bs["Mantenimiento vencido"];
  const only = (s: VehicleStatus[]) => (statuses.length === s.length && s.every((x) => statuses.includes(x)));
  const set = (s: VehicleStatus[]) => {
    const next = only(s) ? [] : s;
    setStatuses(next);
    irA({ statuses: next });
  };
  const hasFilters = filtersActive(query, modes.length, statuses.length, onlyAlerts);
  // La flota se ve vacía porque todavía no hay vehículos (no porque un filtro los esconda)
  const inicioVacio = isStartEmpty(vehicles.length, hasFilters);

  return (
    <div className="flex flex-col gap-5 print:block">
      <PrintHeader title="Flota de vehículos" />
      <div className="print:hidden">
        <StatStrip
        items={[
          {
            label: "Disponibilidad",
            value: `${summary.availability_pct.toLocaleString("es-CO")} %`,
            hint: `${bs["Disponible"] + bs["Reservado"]} listos de ${summary.total}`,
            active: only(["Disponible", "Reservado"]),
            onClick: () => set(["Disponible", "Reservado"]),
          },
          { label: "En ruta", value: bs["En ruta"], hint: "Llevando un envío", active: only(["En ruta"]), onClick: () => set(["En ruta"]) },
          { label: "En mantenimiento", value: bs["En mantenimiento"], hint: "En el taller", tone: bs["En mantenimiento"] ? "warning" : undefined, active: only(["En mantenimiento"]), onClick: () => set(["En mantenimiento"]) },
          { label: "Sin poder operar", value: blocked, hint: "Falla, servicio o documentos vencidos", tone: blocked ? "danger" : undefined, active: only(["Inhabilitado", "Mantenimiento vencido"]), onClick: () => set(["Inhabilitado", "Mantenimiento vencido"]) },
          { label: "Mantenimiento próximo", value: summary.maintenance_due.filter((m) => m.state === "Próximo").length, hint: "Vence pronto" },
          {
            label: "SOAT y técnico-mecánica",
            value: (summary.documents_due ?? []).length,
            hint: (summary.documents_due ?? []).some((d) => d.state === "Vencido") ? "Hay documentos vencidos" : "Por vencer en 30 días",
            tone: (summary.documents_due ?? []).some((d) => d.state === "Vencido") ? "danger" : (summary.documents_due ?? []).length ? "warning" : undefined,
          },
        ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <label className="relative flex h-10 w-full max-w-xs items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar placa, tipo, bodega o conductor"
            aria-label="Buscar vehículos"
            className="h-10 w-full field pr-3 pl-9 text-sm outline-none"
          />
        </label>
        <div className="chip-scroll flex flex-wrap gap-1" role="group" aria-label="Filtrar por modo">
          {MODE_ORDER.map((m) => {
            const on = modes.includes(m);
            const { icon: Icon, color, label } = MODES[m];
            return (
              <button key={m} type="button" onClick={() => { const next = toggle(modes, m); setModes(next); irA({ modes: next }); }} aria-pressed={on} title={label}
                className={cn("press flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors", on ? "text-foreground" : "border-border text-muted-foreground")}
                style={on ? { borderColor: tint(color, 45), backgroundColor: tint(color, 12) } : undefined}>
                <Icon className="size-3.5" style={{ color }} aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
        <div className="chip-scroll flex flex-wrap gap-1" role="group" aria-label="Filtrar por estado">
          {STATUS_ORDER.map((s) => {
            const on = statuses.includes(s);
            const { icon: Icon } = VEHICLE_STATUS[s];
            return (
              <button key={s} type="button" onClick={() => { const next = toggle(statuses, s); setStatuses(next); irA({ statuses: next }); }} aria-pressed={on}
                className={cn("press flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                  on ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                <Icon className="size-3.5" aria-hidden />
                {s}
              </button>
            );
          })}
          <button type="button" onClick={() => { setOnlyAlerts(!onlyAlerts); irA({ alerts: !onlyAlerts }); }} aria-pressed={onlyAlerts}
            className={cn("press flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
              onlyAlerts ? "border-warning/50 bg-warning/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
            <TriangleAlert className="size-3.5" aria-hidden />
            Con alertas
          </button>
        </div>
        {hasFilters ? (
          <button type="button" className="press text-xs text-primary hover:underline" onClick={quitarFiltros}>
            Quitar filtros
          </button>
        ) : null}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Ordenar por
          <select
            value={order}
            onChange={(e) => {
              const next = isFleetOrder(e.target.value) ? e.target.value : "defecto";
              setOrder(next);
              irA({ order: next });
            }}
            className="field h-10 px-3 text-sm text-foreground outline-none"
          >
            {FLEET_ORDERS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      {!inicioVacio && (
        <p className="tabular text-xs text-muted-foreground print:mb-2" aria-live="polite">
          {list.length} de {vehicles.length} vehículos
        </p>
      )}

      <ul className="list-in glass rule-list overflow-hidden rounded-3xl">
        {inicioVacio ? (
          <li>
            <EmptyStart
              title="Aún no hay vehículos"
              description="Agrega el primero o carga toda la flota desde un Excel con su placa, modo y tipo."
              actions={[
                { label: "Agregar el primer vehículo", href: "/flota/nuevo", icon: Plus },
                { label: "Importar desde Excel", onClick: abrirCargaDeExcel, icon: FileUp },
              ]}
            />
          </li>
        ) : list.length === 0 ? (
          <li>
            <EmptyState
              title="Ningún vehículo coincide"
              description="Prueba con otra placa, otro modo o quita los filtros."
              action={hasFilters ? { label: "Quitar filtros", onClick: quitarFiltros } : undefined}
            />
          </li>
        ) : null}
        {pagina.filas.map((v) => (
          <li key={v.id}>
            <Link
              href={`/flota/${v.id}`}
              transitionTypes={['nav-forward']}
              data-ripple
              className={cn(
                "row-link lift grid gap-3 px-5 py-3.5",
                "md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto]",
                v.retired && "opacity-70",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <ModeIcon mode={v.mode} className="size-8" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-sm font-semibold">{v.code}</span>
                    <span className="truncate text-sm text-muted-foreground">{v.vehicle_type}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {v.home_name && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <WarehouseIcon className="size-3 shrink-0" aria-hidden />
                        <span className="truncate">{v.home_name}</span>
                      </span>
                    )}
                    {v.driver && (
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="size-3 shrink-0" aria-hidden />
                        {v.driver.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="min-w-0">
                <VehicleStatusBadge status={v.status} />
                {(v.blockers[0] || v.warnings[0]) && (
                  <p className={cn("mt-1 line-clamp-2 text-xs", v.blockers.length ? "text-destructive" : "text-warning")}>
                    {v.blockers[0] ?? v.warnings[0]}
                  </p>
                )}
                {v.current && <p className="mt-1 truncate text-xs text-muted-foreground">Lleva el envío {v.current.shipment_code}</p>}
              </div>
              <div className="min-w-0">
                {v.retired ? (
                  <span className="text-xs text-muted-foreground">Fuera de la flota</span>
                ) : (
                  <>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Próximo mantenimiento</div>
                    <ServiceMeter service={v.service} compact />
                  </>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 md:justify-end">
                <span className="tabular text-xs text-muted-foreground">
                  {v.capacity_t.toLocaleString("es-CO")} t · {km(v.odometer_km)} km
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <PaginasLocales {...pagina} />
    </div>
  );
}
