import type { Mode, Priority } from "@/lib/types";

/**
 * Escenarios por defecto del comparador de rutas. Viven fuera del componente cliente porque la página (servidor)
 * los usa para calcular la primera comparación: desde un módulo "use client" llegarían como referencia, no como datos.
 */
export interface ScenarioSpec {
  name: string;
  priority: Priority;
  modes: Mode[];
}

export const DEFAULT_SCENARIOS: ScenarioSpec[] = [
  { name: "Multimodal", priority: "balanceado", modes: [] },
  { name: "Solo carretera", priority: "balanceado", modes: ["terrestre"] },
  { name: "La más barata", priority: "costo", modes: [] },
];
