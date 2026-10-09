import {
  ArrowRightLeft,
  CalendarClock,
  CircleCheck,
  Navigation,
  Plane,
  Sailboat,
  Ship,
  TrainFront,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from "lucide-react";

import type { Mode, Priority, ShipmentStatus } from "./types";

/**
 * Paleta por modo (fuente única para mapa, gráficos y badges).
 * Validada con el script del skill de visualización sobre la superficie
 * #0B0F19: banda de luminosidad, croma, contraste y separación CVD en pares
 * adyacentes (peor par ΔE 17,8). El ORDEN es parte de la validación: los
 * gráficos de partes de un todo usan MODE_ORDER, nunca un orden por valor.
 */
export const MODE_ORDER: Mode[] = ["maritimo", "terrestre", "aereo", "ferreo", "fluvial"];

export const MODES: Record<
  Mode,
  { label: string; vehicle: string; color: string; rgb: [number, number, number]; icon: LucideIcon }
> = {
  maritimo: { label: "Marítimo", vehicle: "Buque", color: "#4a7cf0", rgb: [74, 124, 240], icon: Ship },
  terrestre: { label: "Terrestre", vehicle: "Camión", color: "#199e70", rgb: [25, 158, 112], icon: Truck },
  aereo: { label: "Aéreo", vehicle: "Avión", color: "#a173e8", rgb: [161, 115, 232], icon: Plane },
  ferreo: { label: "Férreo", vehicle: "Tren", color: "#c98500", rgb: [201, 133, 0], icon: TrainFront },
  fluvial: { label: "Fluvial", vehicle: "Barcaza", color: "#11a4c4", rgb: [17, 164, 196], icon: Sailboat },
};

export type Tone = "neutral" | "cyan" | "cobalt" | "emerald" | "amber" | "violet" | "rose";

export const STATUSES: Record<ShipmentStatus, { tone: Tone; icon: LucideIcon }> = {
  "En Ruta": { tone: "emerald", icon: Navigation },
  "Transferencia Modal": { tone: "amber", icon: ArrowRightLeft },
  Retrasado: { tone: "rose", icon: TriangleAlert },
  Programado: { tone: "cobalt", icon: CalendarClock },
  Entregado: { tone: "neutral", icon: CircleCheck },
};

export const STATUS_ORDER: ShipmentStatus[] = [
  "En Ruta",
  "Transferencia Modal",
  "Retrasado",
  "Programado",
  "Entregado",
];

export const PRIORITIES: Record<Priority, string> = {
  tiempo: "Tiempo",
  costo: "Costo",
  balanceado: "Balanceado",
};
