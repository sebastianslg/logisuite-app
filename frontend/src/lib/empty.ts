import { toast } from "@/components/ui/toast";

/**
 * «Inicio vacío» de una lista. No es lo mismo que el vacío de un filtro: aquí el sistema todavía no tiene
 * registros y la pantalla debe decir qué hacer primero; con filtros puestos, un 0 se explica con «nada
 * coincide» y el botón de quitarlos.
 */

/** ¿Hay algún filtro puesto? Texto, una selección (cuántos hay) o un interruptor. */
export function filtersActive(...parts: (string | number | boolean | null | undefined)[]): boolean {
  return parts.some((p) => (typeof p === "number" ? p > 0 : typeof p === "string" ? p.trim().length > 0 : !!p));
}

/**
 * La lista no tiene registros y ningún filtro los está escondiendo. `total` es el total de la lista ya
 * filtrada: sin filtros, ese total es el del sistema entero.
 */
export function isStartEmpty(total: number, filters: boolean): boolean {
  return total === 0 && !filters;
}

/**
 * Abre la carga desde Excel que la pantalla ya tiene en su cabecera (`TableIO`, botón «Cargar»). El estado de
 * su hoja vive dentro de ese componente y la lista no puede abrirlo; se pulsa el botón de la cabecera, que es
 * el mismo flujo de siempre. Si no está (otra pantalla o la cabecera aún sin montar), no hace nada.
 */
export function abrirCargaDeExcel(): void {
  if (typeof document === "undefined") return;
  const boton = document.querySelector<HTMLButtonElement>('[data-action="cargar-tabla"]');
  if (boton) boton.click();
  else toast({ title: "No se pudo abrir la carga", description: "Usa el botón «Cargar» de la parte de arriba.", tone: "error" });
}
