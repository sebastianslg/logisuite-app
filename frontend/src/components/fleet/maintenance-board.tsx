"use client";

import Link from "next/link";
import { CalendarClock, ChevronRight, Wrench } from "lucide-react";

import { Money } from "@/components/money";
import { ModeIcon } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import type { FleetSummary, Maintenance } from "@/lib/types";
import { cn } from "@/lib/utils";

import { dt, km, daysText } from "./status";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff < 0) return `Hace ${-diff} d`;
  return d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
}

function Row({ m }: { m: Maintenance & { code?: string; vehicle_type?: string } }) {
  return (
    <li>
      <Link href={`/flota/${m.vehicle_id}`} className="press glass flex items-center gap-3 rounded-2xl p-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80">
        {m.mode && <ModeIcon mode={m.mode} className="size-8" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{m.code}</span>
            <span className="truncate text-xs text-muted-foreground">{m.vehicle_type}</span>
            <Badge tone={m.kind === "Correctivo" ? "warning" : "info"}><Wrench aria-hidden />{m.kind}</Badge>
            <Badge tone={m.status === "En curso" ? "warning" : m.status === "Completado" ? "success" : m.status === "Cancelado" ? "neutral" : "accent"}>{m.status}</Badge>
          </div>
          <p className="tabular mt-0.5 text-xs text-muted-foreground">
            {dt(m.scheduled_start)} → {dt(m.scheduled_end)}
            {m.workshop ? ` · ${m.workshop}` : ""}
            {m.status === "Completado" ? <> · costó <Money usd={m.cost_usd} /></> : m.est_cost_usd ? <> · estimado <Money usd={m.est_cost_usd} /></> : null}
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

/** Agenda de taller: lo que está en curso, lo programado por día y lo que está por vencer sin cita. */
export function MaintenanceBoard({ items, due }: { items: Maintenance[]; due: FleetSummary["maintenance_due"] }) {
  const ongoing = items.filter((m) => m.status === "En curso");
  const planned = items.filter((m) => m.status === "Programado").sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
  const done = items.filter((m) => m.status === "Completado").slice(0, 12);
  const scheduledIds = new Set(items.filter((m) => m.status === "Programado" || m.status === "En curso").map((m) => m.vehicle_id));
  const unscheduled = due.filter((d) => !scheduledIds.has(d.id));

  const byDay: Record<string, Maintenance[]> = {};
  for (const m of planned) (byDay[m.scheduled_start.slice(0, 10)] ??= []).push(m);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-6">
        <section aria-labelledby="m-curso">
          <h2 id="m-curso" className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold"><Wrench className="size-4 text-warning" aria-hidden /> En el taller ahora ({ongoing.length})</h2>
          {ongoing.length === 0 ? <p className="glass rounded-2xl p-4 text-sm text-muted-foreground">Ningún vehículo está en el taller en este momento.</p>
            : <ul className="flex flex-col gap-2">{ongoing.map((m) => <Row key={m.maint_id} m={m} />)}</ul>}
        </section>
        <section aria-labelledby="m-prog">
          <h2 id="m-prog" className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold"><CalendarClock className="size-4 text-primary" aria-hidden /> Programados ({planned.length})</h2>
          {planned.length === 0 ? <p className="glass rounded-2xl p-4 text-sm text-muted-foreground">No hay mantenimientos programados. Abre un vehículo y pulsa “Programar mantenimiento”.</p> : (
            <div className="flex flex-col gap-4">
              {Object.entries(byDay).map(([day, list]) => (
                <div key={day}>
                  <h3 className="mb-1.5 px-1 text-xs font-semibold text-muted-foreground capitalize">{dayLabel(day)}</h3>
                  <ul className="flex flex-col gap-2">{list.map((m) => <Row key={m.maint_id} m={m} />)}</ul>
                </div>
              ))}
            </div>
          )}
        </section>
        {done.length > 0 && (
          <section aria-labelledby="m-hist">
            <h2 id="m-hist" className="mb-2 px-1 text-sm font-semibold">Terminados recientemente</h2>
            <ul className="flex flex-col gap-2">{done.map((m) => <Row key={m.maint_id} m={m} />)}</ul>
          </section>
        )}
      </div>

      <aside className="h-fit glass rounded-3xl p-5">
        <h2 className="text-sm font-semibold">Por vencer sin cita ({unscheduled.length})</h2>
        <p className="mt-1 text-xs text-muted-foreground">Vehículos cuyo servicio vence pronto o ya venció y no tienen un mantenimiento programado.</p>
        {unscheduled.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Todos tienen cita o están al día.</p> : (
          <ul className="mt-3 flex flex-col">
            {unscheduled.map((d) => (
              <li key={d.id} className="border-b border-border last:border-0">
                <Link href={`/flota/${d.id}`} className="press flex items-center gap-2 py-2.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80">
                  <ModeIcon mode={d.mode} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs font-semibold">{d.code}</span>
                    <span className="block truncate text-xs text-muted-foreground">{d.vehicle_type}</span>
                  </span>
                  <span className={cn("tabular text-right text-xs", d.state === "Vencido" ? "text-destructive" : "text-warning")}>
                    <span className="block font-semibold">{d.state}</span>
                    {d.limiting === "días" ? daysText(d.days_left) : `${d.km_left < 0 ? "-" : ""}${km(Math.abs(d.km_left))} km`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
