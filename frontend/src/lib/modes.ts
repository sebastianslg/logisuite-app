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
 * `color` es una variable CSS con variante clara y oscura (globals.css); `rgb`
 * es la variante oscura para deck.gl. La paleta se validó en claro y oscuro para
 * separación CVD (diferencia de color mínima ΔE 18,8 en claro y 19,5 en oscuro, medida con
 * simulación de protano, deutero y tritanopía); el ORDEN es parte de la validación: los gráficos de partes
 * de un todo usan MODE_ORDER, nunca un orden por valor. El modo nunca se
 * comunica solo con color: siempre va con ícono y texto.
 */
export const MODE_ORDER: Mode[] = ["maritimo", "terrestre", "aereo", "ferreo", "fluvial"];

export const MODES: Record<
  Mode,
  { label: string; vehicle: string; color: string; rgb: [number, number, number]; icon: LucideIcon }
> = {
  maritimo: { label: "Marítimo", vehicle: "Buque", color: "var(--mode-maritimo)", rgb: [74, 124, 240], icon: Ship },
  terrestre: { label: "Terrestre", vehicle: "Camión", color: "var(--mode-terrestre)", rgb: [25, 158, 112], icon: Truck },
  aereo: { label: "Aéreo", vehicle: "Avión", color: "var(--mode-aereo)", rgb: [198, 57, 156], icon: Plane },
  ferreo: { label: "Férreo", vehicle: "Tren", color: "var(--mode-ferreo)", rgb: [201, 133, 0], icon: TrainFront },
  fluvial: { label: "Fluvial", vehicle: "Barcaza", color: "var(--mode-fluvial)", rgb: [44, 200, 224], icon: Sailboat },
};

export type Tone = "neutral" | "accent" | "info" | "success" | "warning" | "danger";

/** Mezcla un color CSS (hex o variable) con transparente: sustituye a la concatenación de alfa en hex. */
export const tint = (color: string, pct: number) =>
  `color-mix(in srgb, ${color} ${pct}%, transparent)`;

export const STATUSES: Record<ShipmentStatus, { tone: Tone; icon: LucideIcon }> = {
  "En Ruta": { tone: "success", icon: Navigation },
  "Transferencia Modal": { tone: "warning", icon: ArrowRightLeft },
  Retrasado: { tone: "danger", icon: TriangleAlert },
  Programado: { tone: "info", icon: CalendarClock },
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
