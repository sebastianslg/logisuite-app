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
 * Paleta por modo (fuente única para mapa, gráficos y badges). Parte de la elegida el 27/10/2026 (terrestre
 * verde, fluvial azul, marítimo añil, aéreo magenta, férreo ámbar) y se ajustó en luminosidad y saturación
 * (tono ±15°) para pasar el validador de la skill de visualización con TODAS las parejas comparadas, como en
 * un mapa: separación ≥ 8 (ΔE OKLab ×100) con protanopía y deuteranopía, ≥ 15 con visión normal y contraste
 * ≥ 3:1 sobre la superficie. La original fallaba: aéreo y terrestre casi iguales con deuteranopía (4,4) y
 * fluvial y marítimo poco distinguibles incluso con visión normal (10,5).
 *
 *   claro (sobre #ffffff):   marítimo #5044db · terrestre #26a683 · aéreo #d623a7 · férreo #bc812f · fluvial #3c88e5
 *   oscuro (sobre #1c1c1e):  marítimo #684af5 · terrestre #26a683 · aéreo #c82a9c · férreo #bc812f · fluvial #5b91d7
 *
 * `color` es la variable CSS (cambia con el tema); `rgb` y `rgbDark` son lo mismo para deck.gl. El modo nunca
 * se comunica solo con color: siempre va con ícono y texto. Los gráficos de partes de un todo usan MODE_ORDER.
 */
export const MODE_ORDER: Mode[] = ["maritimo", "terrestre", "aereo", "ferreo", "fluvial"];

export const MODES: Record<
  Mode,
  { label: string; vehicle: string; color: string; rgb: [number, number, number]; rgbDark: [number, number, number]; icon: LucideIcon }
> = {
  maritimo: { label: "Marítimo", vehicle: "Buque", color: "var(--mode-maritimo)", rgb: [80, 68, 219], rgbDark: [104, 74, 245], icon: Ship },
  terrestre: { label: "Terrestre", vehicle: "Camión", color: "var(--mode-terrestre)", rgb: [38, 166, 131], rgbDark: [38, 166, 131], icon: Truck },
  aereo: { label: "Aéreo", vehicle: "Avión", color: "var(--mode-aereo)", rgb: [214, 35, 167], rgbDark: [200, 42, 156], icon: Plane },
  ferreo: { label: "Férreo", vehicle: "Tren", color: "var(--mode-ferreo)", rgb: [188, 129, 47], rgbDark: [188, 129, 47], icon: TrainFront },
  fluvial: { label: "Fluvial", vehicle: "Barcaza", color: "var(--mode-fluvial)", rgb: [60, 136, 229], rgbDark: [91, 145, 215], icon: Sailboat },
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
