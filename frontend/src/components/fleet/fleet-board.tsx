"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, TriangleAlert, UserRound, Warehouse as WarehouseIcon } from "lucide-react";

import { ModeIcon } from "@/components/status-badge";
import { MODE_ORDER, MODES } from "@/lib/modes";
import type { FleetSummary, Mode, Vehicle, VehicleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

import { km, ServiceMeter, STATUS_ORDER, VEHICLE_STATUS, VehicleStatusBadge } from "./status";

/** Un indicador que además filtra: pulsarlo deja solo los vehículos de ese estado. */
function Tile({
  label,
  value,
  hint,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "success" | "accent" | "warning" | "danger";
  active?: boolean;
  onClick?: () => void;
}) {
  const color = tone ? `var(--color-${tone === "accent" ? "primary" : tone === "danger" ? "destructive" : tone})` : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        "press glass flex min-w-0 flex-col rounded-2xl p-4 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80",
        active && "ring-2 ring-primary/50",
        !onClick && "cursor-default",
      )}
    >
      <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
      <span className="tabular mt-1.5 text-2xl font-bold tracking-tight" style={color ? { color } : undefined}>
        {value}
      </span>
      {hint && <span className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</span>}
    </button>
  );
}

/** Lista de vehículos: indicadores que filtran, búsqueda, filtros por modo y estado, y una fila por vehículo. */
export function FleetBoard({ vehicles, summary }: { vehicles: Vehicle[]; summary: FleetSummary }) {
  const [query, setQuery] = useState("");
  const [modes, setModes] = useState<Mode[]>([]);
  const [statuses, setStatuses] = useState<VehicleStatus[]>([]);
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vehicles.filter(
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
  }, [vehicles, query, modes, statuses, onlyAlerts]);

  const bs = summary.by_status;
  const blocked = bs["Inhabilitado"] + bs["Mantenimiento vencido"];
  const only = (s: VehicleStatus[]) => (statuses.length === s.length && s.every((x) => statuses.includes(x)));
  const set = (s: VehicleStatus[]) => setStatuses(only(s) ? [] : s);
  const hasFilters = query || modes.length || statuses.length || onlyAlerts;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="Disponibilidad" value={`${summary.availability_pct.toLocaleString("es-CO")} %`} hint={`${summary.total} vehículos en flota`} />
        <Tile label="Disponibles" value={bs["Disponible"] + bs["Reservado"]} hint="Listos o reservados" tone="success"
          active={only(["Disponible", "Reservado"])} onClick={() => set(["Disponible", "Reservado"])} />
        <Tile label="En ruta" value={bs["En ruta"]} hint="Llevando un envío" tone="accent" active={only(["En ruta"])} onClick={() => set(["En ruta"])} />
        <Tile label="En mantenimiento" value={bs["En mantenimiento"]} hint="En el taller" tone="warning"
          active={only(["En mantenimiento"])} onClick={() => set(["En mantenimiento"])} />
        <Tile label="Sin poder operar" value={blocked} hint="Falla o servicio vencido" tone={blocked ? "danger" : undefined}
          active={only(["Inhabilitado", "Mantenimiento vencido"])} onClick={() => set(["Inhabilitado", "Mantenimiento vencido"])} />
        <Tile label="Mantenimiento próximo" value={summary.maintenance_due.filter((m) => m.state === "Próximo").length}
          hint="Vencen pronto" tone="warning" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex h-9 w-full max-w-xs items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar placa, tipo, bodega o conductor"
            aria-label="Buscar vehículos"
            className="h-9 w-full rounded-md border border-input bg-fill/50 pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground/70"
          />
        </label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por modo">
          {MODE_ORDER.map((m) => {
            const on = modes.includes(m);
            const { icon: Icon, color, label } = MODES[m];
            return (
              <button key={m} type="button" onClick={() => setModes(toggle(modes, m))} aria-pressed={on} title={label}
                className={cn("press flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors", on ? "text-foreground" : "border-border text-muted-foreground")}
                style={on ? { borderColor: `${color}66`, backgroundColor: `${color}1a` } : undefined}>
                <Icon className="size-3.5" style={{ color }} aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por estado">
          {STATUS_ORDER.map((s) => {
            const on = statuses.includes(s);
            const { icon: Icon } = VEHICLE_STATUS[s];
            return (
              <button key={s} type="button" onClick={() => setStatuses(toggle(statuses, s))} aria-pressed={on}
                className={cn("press flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                  on ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                <Icon className="size-3.5" aria-hidden />
                {s}
              </button>
            );
          })}
          <button type="button" onClick={() => setOnlyAlerts(!onlyAlerts)} aria-pressed={onlyAlerts}
            className={cn("press flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
              onlyAlerts ? "border-warning/50 bg-warning/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
            <TriangleAlert className="size-3.5" aria-hidden />
            Con alertas
          </button>
        </div>
        {hasFilters ? (
          <button type="button" className="press text-xs text-primary hover:underline"
            onClick={() => { setQuery(""); setModes([]); setStatuses([]); setOnlyAlerts(false); }}>
            Quitar filtros
          </button>
        ) : null}
      </div>

      <p className="tabular text-xs text-muted-foreground" aria-live="polite">
        {list.length} de {vehicles.length} vehículos
      </p>

      <ul className="flex flex-col gap-2">
        {list.length === 0 && (
          <li className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">Ningún vehículo coincide con la búsqueda y los filtros.</li>
        )}
        {list.map((v) => (
          <li key={v.id}>
            <Link
              href={`/flota/${v.id}`}
              className={cn(
                "press glass grid items-center gap-3 rounded-2xl p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80",
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
                    <div className="mb-1 text-[0.6875rem] font-medium text-muted-foreground">Próximo mantenimiento</div>
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
    </div>
  );
}
