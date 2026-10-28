"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ModeChain, StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import type { Shipment, ShipmentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;
const WINDOWS = [7, 14, 30] as const;

/** Color de la barra según el estado (el estado ya tiene sus colores en toda la app). */
const BAR: Record<ShipmentStatus, string> = {
  Programado: "bg-[color-mix(in_srgb,var(--muted-foreground)_35%,transparent)]",
  "En Ruta": "bg-[var(--accent-solid)]",
  "Transferencia Modal": "bg-[var(--sys-orange)]",
  Retrasado: "bg-[var(--sys-red)]",
  Entregado: "bg-[color-mix(in_srgb,var(--success)_45%,transparent)]",
};

const dayLabel = (d: Date) => d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric" }).replace(".", "");
const when = (d: Date) => d.toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(/\s/g, " ");

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Calendario de envíos: cada envío es una barra entre su salida y su llegada estimada, del color de su estado,
 * con el retraso como un tramo rojo al final. Una línea marca el momento actual. En pantallas angostas pasa a
 * una agenda por día de salida (la línea de tiempo no cabe sin desplazarse hacia el lado).
 */
export function ShipmentCalendar({ shipments }: { shipments: Shipment[] }) {
  const router = useRouter();
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(14);
  const [delivered, setDelivered] = useState(false);
  const [now] = useState(() => new Date());

  const start = useMemo(() => new Date(startOfDay(now).getTime() - Math.round(days * 0.25) * DAY), [now, days]);
  const end = useMemo(() => new Date(start.getTime() + days * DAY), [start, days]);
  const span = end.getTime() - start.getTime();
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - start.getTime()) / span) * 100));

  const rows = useMemo(
    () =>
      shipments
        .map((s) => {
          const dep = new Date(s.departure_at).getTime();
          const eta = new Date(s.eta_at).getTime();
          return { s, dep, eta, arr: eta + (s.delay_h || 0) * 3_600_000 };
        })
        .filter((r) => r.dep < end.getTime() && r.arr > start.getTime() && (delivered || r.s.status !== "Entregado"))
        .sort((a, b) => a.dep - b.dep),
    [shipments, start, end, delivered],
  );

  const ticks = Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * DAY));
  const step = days > 14 ? 3 : 1;
  const nowPct = pct(now.getTime());

  // Agenda (celular): agrupada por día de salida
  const agenda = useMemo(() => {
    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = startOfDay(new Date(r.dep)).toISOString();
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    return [...groups.entries()];
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          id="calendar-window"
          label="Ventana"
          value={String(days)}
          options={WINDOWS.map((w) => ({ value: String(w), label: `${w} días` }))}
          onChange={(v) => setDays(Number(v) as (typeof WINDOWS)[number])}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {(Object.keys(BAR) as ShipmentStatus[]).map((st) => (
            <span key={st} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2 w-4 rounded-full", BAR[st])} aria-hidden />
              {st}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full bg-[repeating-linear-gradient(135deg,var(--sys-red)_0_3px,transparent_3px_6px)]" aria-hidden />
            Retraso
          </span>
          <label className="inline-flex items-center gap-1.5 text-foreground">
            <input type="checkbox" checked={delivered} onChange={(e) => setDelivered(e.target.checked)} />
            Mostrar entregados
          </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="glass rounded-3xl">
          <EmptyState figure="0" title="Sin envíos en esta ventana" description="Amplía la ventana o muestra también los entregados." />
        </div>
      ) : (
        <>
          {/* Escritorio: línea de tiempo */}
          <section aria-label="Línea de tiempo de envíos" className="glass hidden overflow-clip rounded-3xl lg:block">
            <div className="sticky top-[5.25rem] z-10 grid grid-cols-[17rem_minmax(0,1fr)] border-b border-border bg-card">
              <div className="px-5 py-2.5 text-xs font-medium text-muted-foreground">
                {rows.length} {rows.length === 1 ? "envío" : "envíos"}
              </div>
              <div className="relative h-11">
                {ticks.map((t, i) =>
                  i % step === 0 ? (
                    <span
                      key={i}
                      className="absolute bottom-2 text-[11px] whitespace-nowrap text-muted-foreground"
                      style={{ left: `calc(${pct(t.getTime())}% + 4px)` }}
                    >
                      {dayLabel(t)}
                    </span>
                  ) : null,
                )}
                <span className="absolute -top-0 bottom-0 w-px bg-primary" style={{ left: `${nowPct}%` }} aria-hidden />
                <span className="absolute top-1 -translate-x-1/2 rounded-full bg-solid px-1.5 text-[10px] leading-4 font-semibold text-primary-foreground" style={{ left: `${nowPct}%` }}>
                  Ahora
                </span>
              </div>
            </div>
            {/* key: al cambiar la ventana las barras vuelven a crecer desde su salida (explica el cambio de escala) */}
            <ol key={`${days}-${delivered}`} className="relative">
              {/* Rejilla de días (fines de semana en un tono) y línea de ahora, detrás de las filas */}
              <div className="pointer-events-none absolute inset-y-0 right-0 left-[17rem]" aria-hidden>
                {ticks.map((t, i) => (
                  <span
                    key={i}
                    className={cn("absolute inset-y-0 border-l border-border/60", [0, 6].includes(t.getDay()) && "bg-fill/40")}
                    style={{ left: `${pct(t.getTime())}%`, width: `${100 / days}%` }}
                  />
                ))}
                <span className="absolute inset-y-0 w-px bg-primary/60" style={{ left: `${nowPct}%` }} />
              </div>
              {rows.map(({ s, dep, eta, arr }, i) => {
                const left = pct(dep);
                const planned = Math.max(pct(eta) - left, 0.4);
                const delay = Math.max(pct(arr) - pct(eta), 0);
                const label = `${s.code}: ${s.origin} → ${s.destination}. Sale ${when(new Date(dep))}, llega ${when(new Date(arr))}${s.delay_fmt ? ` (+${s.delay_fmt})` : ""}. ${s.status}.`;
                return (
                  <li key={s.code} className="group/row relative grid grid-cols-[17rem_minmax(0,1fr)] border-b border-border last:border-0 hover:bg-[color-mix(in_srgb,var(--card)_96%,var(--foreground))]">
                    <Link href={`/envios/${s.code}`} prefetch={false} className="flex min-w-0 flex-col px-5 py-2.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80 focus-visible:ring-inset">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-foreground/80">{s.code}</span>
                        <ModeChain modes={s.modes} />
                      </span>
                      <span className="truncate text-sm font-medium">
                        {s.origin} <span className="text-muted-foreground">→</span> {s.destination}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => router.push(`/envios/${s.code}`)}
                      aria-label={label}
                      className="cal-hit relative h-full min-h-14 cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80 focus-visible:ring-inset"
                    >
                      <span
                        className="cal-bar absolute top-1/2 flex h-2.5 -translate-y-1/2"
                        style={{ left: `${left}%`, width: `${planned + delay}%`, "--i": Math.min(i, 15) } as React.CSSProperties}
                      >
                        <span className={cn("h-full rounded-l-full", BAR[s.status], !delay && "rounded-r-full")} style={{ width: `${(planned / (planned + delay)) * 100}%` }} />
                        {delay > 0 && (
                          <span
                            className="h-full rounded-r-full bg-[repeating-linear-gradient(135deg,var(--sys-red)_0_3px,transparent_3px_6px)]"
                            style={{ width: `${(delay / (planned + delay)) * 100}%` }}
                          />
                        )}
                      </span>
                      {/* Ficha al pasar el puntero o con el foco: sube 4 px y aparece (ya leída por aria-label) */}
                      <span
                        aria-hidden
                        className="cal-tip floating pointer-events-none absolute bottom-[calc(50%+0.75rem)] z-20 flex w-max max-w-72 flex-col gap-0.5 rounded-xl px-3 py-2 text-left text-xs"
                        style={{ left: `${Math.min(left, 74)}%` }}
                      >
                        <span className="flex items-center justify-between gap-4">
                          <span className="font-mono text-muted-foreground">{s.code}</span>
                          <span className="font-medium">{s.status}</span>
                        </span>
                        <span className="truncate text-sm font-semibold">
                          {s.origin} → {s.destination}
                        </span>
                        <span className="tabular text-muted-foreground">Sale {when(new Date(dep))}</span>
                        <span className="tabular text-muted-foreground">
                          Llega {when(new Date(arr))}
                          {s.delay_fmt && <span className="text-destructive"> · +{s.delay_fmt}</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Celular y tableta: agenda por día de salida */}
          <div className="flex flex-col gap-5 lg:hidden">
            {agenda.map(([day, list]) => (
              <section key={day} aria-label={new Date(day).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}>
                <h2 className="mb-2 px-1 text-sm font-semibold first-letter:uppercase">
                  {new Date(day).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
                </h2>
                <ul className="glass rule-list overflow-hidden rounded-2xl">
                  {list.map(({ s, dep, arr }) => (
                    <li key={s.code}>
                      <Link href={`/envios/${s.code}`} prefetch={false} className="row-link flex-col items-stretch gap-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">
                            {s.origin} → {s.destination}
                          </span>
                          <StatusBadge status={s.status} />
                        </span>
                        <span className="tabular flex items-center gap-2 text-xs text-muted-foreground">
                          <ModeChain modes={s.modes} />
                          {when(new Date(dep))} → {when(new Date(arr))}
                          {s.delay_fmt && <span className="text-destructive">+{s.delay_fmt}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        La barra va de la salida a la ETA planeada; el tramo rayado es el retraso. Toca una fila para abrir el envío.
      </p>
    </div>
  );
}
