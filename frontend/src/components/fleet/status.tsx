import {
  Archive,
  CalendarClock,
  CircleCheck,
  Navigation,
  OctagonAlert,
  TimerOff,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/lib/modes";
import type { FaultSeverity, ServiceClock, VehicleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const VEHICLE_STATUS: Record<VehicleStatus, { tone: Tone; icon: LucideIcon; hint: string }> = {
  Disponible: { tone: "success", icon: CircleCheck, hint: "Listo para recibir un envío" },
  Reservado: { tone: "info", icon: CalendarClock, hint: "Tiene un tramo que sale en las próximas 24 h" },
  "En ruta": { tone: "accent", icon: Navigation, hint: "Está llevando un envío ahora" },
  "En mantenimiento": { tone: "warning", icon: Wrench, hint: "En el taller: no recibe envíos" },
  Inhabilitado: { tone: "danger", icon: OctagonAlert, hint: "Tiene una falla o un impedimento abierto" },
  "Mantenimiento vencido": { tone: "danger", icon: TimerOff, hint: "Pasó el plazo del siguiente servicio" },
  "Dado de baja": { tone: "neutral", icon: Archive, hint: "Retirado de la flota" },
};

export const STATUS_ORDER: VehicleStatus[] = [
  "Disponible",
  "Reservado",
  "En ruta",
  "En mantenimiento",
  "Inhabilitado",
  "Mantenimiento vencido",
  "Dado de baja",
];

/** Estado del vehículo: color + ícono + texto (nunca solo color). */
export function VehicleStatusBadge({ status, className }: { status: VehicleStatus; className?: string }) {
  const { tone, icon: Icon, hint } = VEHICLE_STATUS[status];
  return (
    <Badge tone={tone} className={className} title={hint}>
      <Icon aria-hidden />
      {status}
    </Badge>
  );
}

const SEV: Record<FaultSeverity, Tone> = { Leve: "neutral", Moderada: "warning", Crítica: "danger" };

export function SeverityBadge({ severity }: { severity: FaultSeverity }) {
  return (
    <Badge tone={SEV[severity]}>
      <TriangleAlert aria-hidden />
      {severity}
    </Badge>
  );
}

const nf = (n: number) => Math.round(n).toLocaleString("es-CO");

/** "12 d", "Vence hoy", "Vencido hace 3 d". */
export function daysText(d: number): string {
  if (d < 0) return `vencido hace ${Math.ceil(-d)} d`;
  if (d < 1) return "vence hoy";
  return `${Math.floor(d)} d`;
}

export function dt(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—";
}

export function dateOnly(iso: string | null | undefined): string {
  return iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("es-CO", { dateStyle: "medium" }) : "—";
}

const METER = { "Al día": "var(--color-success)", Próximo: "var(--color-warning)", Vencido: "var(--color-destructive)" } as const;

/**
 * Cuánto falta para el próximo mantenimiento, por días y por kilómetros (vale lo que ocurra primero).
 * La barra es lo consumido del intervalo; el factor que manda va en negrita.
 */
export function ServiceMeter({ service, compact = false, className }: { service: ServiceClock; compact?: boolean; className?: string }) {
  const color = METER[service.state];
  const pct = Math.min(service.pct_used, 100);
  const byDays = service.limiting === "días";
  return (
    <div className={cn("min-w-0", className)}>
      <div
        role="meter"
        aria-label="Intervalo de mantenimiento consumido"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className={cn("overflow-hidden rounded-full bg-fill", compact ? "h-1.5" : "h-2")}
      >
        <div className="h-full rounded-full transition-[width] duration-500 ease-apple" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className={cn("tabular mt-1 flex flex-wrap gap-x-2 text-muted-foreground", compact ? "text-[0.6875rem]" : "text-xs")}>
        <span className={cn(byDays && "font-semibold text-foreground")} style={service.state === "Vencido" && byDays ? { color } : undefined}>
          {daysText(service.days_left)}
        </span>
        <span aria-hidden>·</span>
        <span className={cn(!byDays && "font-semibold text-foreground")} style={service.state === "Vencido" && !byDays ? { color } : undefined}>
          {service.km_left < 0 ? `vencido por ${nf(-service.km_left)} km` : `${nf(service.km_left)} km`}
        </span>
      </div>
    </div>
  );
}

export const km = nf;
