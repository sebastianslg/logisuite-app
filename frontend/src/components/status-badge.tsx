import { Badge } from "@/components/ui/badge";
import { MODES, STATUSES } from "@/lib/modes";
import type { Mode, ShipmentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Estado del envío: color translúcido + ícono + texto (nunca solo color). */
export function StatusBadge({ status, className }: { status: ShipmentStatus; className?: string }) {
  const { tone, icon: Icon } = STATUSES[status];
  return (
    <Badge tone={tone} className={className}>
      <Icon aria-hidden />
      {status}
    </Badge>
  );
}

/** Ícono del modo sobre una pastilla con su color de serie. */
export function ModeIcon({ mode, className }: { mode: Mode; className?: string }) {
  const { icon: Icon, color, label } = MODES[mode];
  return (
    <span
      title={label}
      className={cn("inline-flex size-6 items-center justify-center rounded-md border", className)}
      style={{ color, borderColor: `${color}40`, backgroundColor: `${color}14` }}
    >
      <Icon className="size-3.5" aria-label={label} />
    </span>
  );
}

/** Cadena de modos de una ruta: Avión -> Camión. */
export function ModeChain({ modes }: { modes: Mode[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {modes.map((m, i) => (
        <span key={`${m}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 && <span className="h-px w-2 bg-white/15" aria-hidden />}
          <ModeIcon mode={m} />
        </span>
      ))}
    </span>
  );
}
