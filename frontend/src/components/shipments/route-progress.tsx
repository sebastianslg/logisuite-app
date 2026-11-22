import { MODES } from "@/lib/modes";
import type { Mode } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Avance de un envío dibujado como su ruta: un segmento por tramo, del color de su modo, separados por 2 px; lo
 * recorrido se llena y lo pendiente queda en el gris de relleno. La lista no trae la distancia de cada tramo (se quitó
 * para aligerarla), así que los tramos van a partes iguales: es una lectura de «cuántos tramos lleva y en cuál va», no
 * un mapa a escala. Los rellenos crecen con `scaleX` (meter-fill) al aparecer y al cambiar.
 */
export function RouteProgress({ modes, pct, className }: { modes: Mode[]; pct: number; className?: string }) {
  const legs = modes.length ? modes : (["terrestre"] as Mode[]);
  const done = (Math.min(Math.max(pct, 0), 100) / 100) * legs.length;
  return (
    <span className={cn("flex items-center gap-[2px]", className)} aria-hidden>
      {legs.map((m, i) => {
        const fill = Math.min(Math.max(done - i, 0), 1);
        return (
          <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
            <span
              className="meter-fill block h-full rounded-full"
              style={{ "--v": fill, backgroundColor: MODES[m].color } as React.CSSProperties}
            />
          </span>
        );
      })}
    </span>
  );
}
