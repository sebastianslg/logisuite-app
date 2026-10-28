import {
  Anchor,
  Boxes,
  Building2,
  CircleCheck,
  Flag,
  Flame,
  PackageCheck,
  Plane,
  ShieldCheck,
  Snowflake,
  Sprout,
  Undo2,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { StockState, Warehouse, WarehouseStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const ROLE_ICON: Record<string, LucideIcon> = {
  hub: Boxes,
  regional: Building2,
  ultima_milla: PackageCheck,
  frio: Snowflake,
  puerto: Anchor,
  aduanera: ShieldCheck,
  frontera: Flag,
  aerea: Plane,
  peligrosos: Flame,
  agro: Sprout,
  devoluciones: Undo2,
};

/** Nivel de la red: centro nacional, regional o especializada (para el tamaño en el esquema). */
export const tierOf = (role: string): 0 | 1 | 2 => (role === "hub" ? 0 : role === "regional" ? 1 : 2);

export function RoleIcon({ role, className }: { role: string; className?: string }) {
  const Icon = ROLE_ICON[role] ?? Building2;
  return <Icon className={className ?? "size-4"} aria-hidden />;
}

const STATUS: Record<WarehouseStatus, { tone: "success" | "warning" | "danger"; icon: LucideIcon }> = {
  Operativa: { tone: "success", icon: CircleCheck },
  Mantenimiento: { tone: "warning", icon: Wrench },
  Cerrada: { tone: "danger", icon: XCircle },
};

export function WarehouseStatusBadge({ status }: { status: WarehouseStatus }) {
  const { tone, icon: Icon } = STATUS[status];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden />
      {status}
    </Badge>
  );
}

export function StockStateBadge({ state }: { state: StockState }) {
  if (state === "Normal") return null;
  return <Badge tone={state === "Bajo" ? "danger" : "warning"}>{state === "Bajo" ? "Bajo el mínimo" : "En exceso"}</Badge>;
}

/** Banderas de lo que la bodega puede manejar: frío, peligrosos, aduana. */
export function Capabilities({ w }: { w: Pick<Warehouse, "temp_controlled" | "hazmat" | "bonded"> }) {
  return (
    <>
      {w.temp_controlled && <Badge tone="info"><Snowflake aria-hidden />Frío</Badge>}
      {w.hazmat && <Badge tone="danger"><Flame aria-hidden />Peligrosos</Badge>}
      {w.bonded && <Badge tone="neutral"><ShieldCheck aria-hidden />Aduana</Badge>}
    </>
  );
}

/** Ocupación en m³: verde hasta 75 %, naranja hasta 90 %, rojo desde ahí. */
export function OccupancyBar({ pct, className, label = true }: { pct: number; className?: string; label?: boolean }) {
  const color = pct >= 90 ? "var(--color-destructive)" : pct >= 75 ? "var(--color-warning)" : "var(--color-success)";
  return (
    <div className={cn("min-w-0", className)}>
      <div
        role="meter"
        aria-label="Ocupación de la bodega"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="h-1 overflow-hidden rounded-full bg-fill"
      >
        <div className="h-full w-full origin-left rounded-full transition-transform duration-500 ease-apple" style={{ transform: `scaleX(${Math.min(pct, 100) / 100})`, backgroundColor: color }} />
      </div>
      {label && <div className="tabular mt-1 text-xs text-muted-foreground">{pct.toLocaleString("es-CO")} % ocupada</div>}
    </div>
  );
}

export const n0 = (n: number) => Math.round(n).toLocaleString("es-CO");
export const n1 = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 1 });
