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
 * Paleta por modo (fuente única para mapa, gráficos y badges): terrestre #0f9d7a, fluvial #0a84ff,
 * marítimo #5e5ce6, aéreo #d6399b, férreo #c98a00 (decisión de diseño del 27/10/2026). Es la misma en
 * claro y oscuro; `color` es la variable CSS (globals.css) y `rgb` el mismo color para deck.gl.
 * Solo identifica el modo: nunca decora, y el modo nunca se comunica solo con color (siempre va con
 * ícono y texto). Los gráficos de partes de un todo usan MODE_ORDER, nunca un orden por valor.
 */
export const MODE_ORDER: Mode[] = ["maritimo", "terrestre", "aereo", "ferreo", "fluvial"];

export const MODES: Record<
  Mode,
  { label: string; vehicle: string; color: string; rgb: [number, number, number]; icon: LucideIcon }
> = {
  maritimo: { label: "Marítimo", vehicle: "Buque", color: "var(--mode-maritimo)", rgb: [94, 92, 230], icon: Ship },
  terrestre: { label: "Terrestre", vehicle: "Camión", color: "var(--mode-terrestre)", rgb: [15, 157, 122], icon: Truck },
  aereo: { label: "Aéreo", vehicle: "Avión", color: "var(--mode-aereo)", rgb: [214, 57, 155], icon: Plane },
  ferreo: { label: "Férreo", vehicle: "Tren", color: "var(--mode-ferreo)", rgb: [201, 138, 0], icon: TrainFront },
  fluvial: { label: "Fluvial", vehicle: "Barcaza", color: "var(--mode-fluvial)", rgb: [10, 132, 255], icon: Sailboat },
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
