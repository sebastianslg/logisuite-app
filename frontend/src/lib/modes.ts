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
 * Paleta por modo (fuente única para mapa, gráficos y badges). Rediseño del 22/11/2026: la anterior usaba los colores de
 * sistema de Apple (rosa, verde, cian y naranja casi puros) y en pantalla chocaban entre sí. Esta se buscó por cálculo:
 * los cinco con croma parecido (por eso combinan) y la luminosidad repartida para que se distingan, y pasó el validador
 * de la skill de visualización con TODAS las parejas comparadas, como en un mapa: separación con protanopía y
 * deuteranopía 9,9 en claro y 10,0 en oscuro (objetivo ≥ 8, ΔE OKLab ×100), ≥ 17 con visión normal y contraste ≥ 3:1
 * sobre la superficie. El oscuro son los mismos tonos un paso más arriba para el fondo grafito, no otra paleta.
 *
 *   claro (sobre #ffffff):  marítimo añil #5252aa · terrestre verde bosque #2b7a3d · aéreo rosa #dd668d ·
 *                           férreo ocre #bb8912 · fluvial petróleo #2d9fbf
 *   oscuro (sobre #191b1f): #6765c5 · #397c3a · #d65a7e · #b2902c · #22a2c3
 *
 * `color` es la variable CSS (cambia con el tema); `rgb` y `rgbDark` son lo mismo para deck.gl. El modo nunca
 * se comunica solo con color: siempre va con ícono y texto. Los gráficos de partes de un todo usan MODE_ORDER.
 */
export const MODE_ORDER: Mode[] = ["maritimo", "terrestre", "aereo", "ferreo", "fluvial"];

export const MODES: Record<
  Mode,
  { label: string; vehicle: string; color: string; rgb: [number, number, number]; rgbDark: [number, number, number]; icon: LucideIcon }
> = {
  maritimo: { label: "Marítimo", vehicle: "Buque", color: "var(--mode-maritimo)", rgb: [82, 82, 170], rgbDark: [103, 101, 197], icon: Ship },
  terrestre: { label: "Terrestre", vehicle: "Camión", color: "var(--mode-terrestre)", rgb: [43, 122, 61], rgbDark: [57, 124, 58], icon: Truck },
  aereo: { label: "Aéreo", vehicle: "Avión", color: "var(--mode-aereo)", rgb: [221, 102, 141], rgbDark: [214, 90, 126], icon: Plane },
  ferreo: { label: "Férreo", vehicle: "Tren", color: "var(--mode-ferreo)", rgb: [187, 137, 18], rgbDark: [178, 144, 44], icon: TrainFront },
  fluvial: { label: "Fluvial", vehicle: "Barcaza", color: "var(--mode-fluvial)", rgb: [45, 159, 191], rgbDark: [34, 162, 195], icon: Sailboat },
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
