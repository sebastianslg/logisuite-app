import { MODES } from "@/lib/modes";
import type { Shipment } from "@/lib/types";
import { cn } from "@/lib/utils";

/** La longitud representa km; la parte llena se detiene durante un transbordo. */
export function RouteProgress({ segments = [], className }: { segments?: Shipment["progress_legs"]; className?: string }) {
  return <span className={cn("flex h-1.5 items-stretch gap-[2px]", className)} aria-hidden>
    {segments.length === 0 && <span className="flex-1 rounded-full bg-fill" />}
    {segments.map(([modo, km, avance], i) => (
      <span key={i} className="min-w-0 basis-0 overflow-hidden rounded-full bg-fill" style={{ flexGrow: km }}>
        <span className="block h-full origin-left" style={{ transform: `scaleX(${avance})`, backgroundColor: MODES[modo].color }} />
      </span>
    ))}
  </span>;
}
