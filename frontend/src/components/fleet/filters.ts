import type { Mode, VehicleStatus } from "@/lib/types";

import { STATUS_ORDER } from "./status";

/**
 * Filtros y orden de la lista de vehículos. Viven en la URL, así que un enlace restaura la misma vista:
 * `/flota?estado=En+ruta,Disponible&modo=terrestre&q=texto&alertas=1&orden=placa`.
 */
export interface FleetFilters {
  /** Búsqueda de texto (?q=): placa, tipo, bodega o conductor. */
  q: string;
  statuses: VehicleStatus[];
  modes: Mode[];
  /** Solo vehículos con fallas o avisos (?alertas=1). */
  alerts: boolean;
  order: FleetOrder;
}

/** Órdenes del listado, en el orden del desplegable. «Como vienen» es el orden con que los entrega la API. */
export const FLEET_ORDERS = [
  { key: "defecto", label: "Como vienen" },
  { key: "placa", label: "Placa (A–Z)" },
  { key: "estado", label: "Estado" },
  { key: "mantenimiento", label: "Próximo mantenimiento" },
] as const;

export type FleetOrder = (typeof FLEET_ORDERS)[number]["key"];

export const isFleetOrder = (v: string | undefined): v is FleetOrder => FLEET_ORDERS.some((o) => o.key === v);

export const isVehicleStatus = (v: string): v is VehicleStatus => (STATUS_ORDER as string[]).includes(v);

/** Firma estable de los filtros: dos combinaciones iguales dan la misma firma aunque los chips se marcaran en otro orden. */
export function fleetKey(f: FleetFilters): string {
  return JSON.stringify([f.q.trim(), [...f.statuses].sort(), [...f.modes].sort(), f.alerts, f.order]);
}

/** Enlace de la lista con estos filtros; sin filtros, la ruta limpia. */
export function fleetHref(f: FleetFilters): string {
  const sp = new URLSearchParams();
  if (f.q.trim()) sp.set("q", f.q.trim());
  if (f.statuses.length) sp.set("estado", f.statuses.join(","));
  if (f.modes.length) sp.set("modo", f.modes.join(","));
  if (f.alerts) sp.set("alertas", "1");
  if (f.order !== "defecto") sp.set("orden", f.order);
  const qs = sp.toString();
  return `/flota${qs ? `?${qs}` : ""}`;
}
