"use client";

import Link from "next/link";
import { ArrowUpRight, TrafficCone } from "lucide-react";

import { CountUp } from "@/components/ui/count-up";
import { MODE_ORDER, MODES } from "@/lib/modes";
import type { FleetLive, NetworkGeo } from "@/lib/types";

/**
 * «Ahora en la red»: lo que pasa en este momento, en el espacio del simulador mientras no hay una ruta calculada.
 * Vehículos en tránsito por modo (barra del color del modo, a escala del mayor), vías cerradas con su motivo y los
 * envíos que más avanzan. Todo sale de lo que el mapa ya cargó (red y flota en vivo): no pide nada más a la API.
 * Entra en cascada corta (list-in) y las barras crecen con scaleX (meter-fill); después queda quieto.
 */
export function LiveNow({ network, fleet }: { network: NetworkGeo | null; fleet: FleetLive | null }) {
  const byMode = MODE_ORDER.map((m) => ({ m, n: fleet?.by_mode?.[m] ?? 0 })).filter((x) => x.n > 0);
  const max = Math.max(1, ...byMode.map((x) => x.n));
  const closed = new Map<string, string | null>();
  for (const f of network?.links.features ?? []) {
    if (f.properties.closed && !closed.has(f.properties.corridor)) closed.set(f.properties.corridor, f.properties.closure_reason);
  }
  const moving = [...(fleet?.assets ?? [])]
    .filter((a, i, all) => all.findIndex((b) => b.shipment_code === a.shipment_code) === i)
    .sort((a, b) => b.progress_pct - a.progress_pct)
    .slice(0, 5);

  if (!fleet && !network) {
    return (
      <div className="flex flex-col gap-3 p-5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-10 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <section aria-labelledby="ahora-red" className="flex flex-col gap-5 px-4 py-5 md:px-5">
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="ahora-red" className="flex items-center gap-2 text-sm font-semibold">
          <span className="size-1.5 rounded-full bg-[var(--success)]" aria-hidden />
          Ahora en la red
        </h2>
        <p className="text-xs text-muted-foreground">
          <CountUp value={fleet?.count ?? 0} className="tabular font-semibold text-foreground" /> en tránsito
        </p>
      </header>

      {byMode.length > 0 && (
        <ul className="list-in flex flex-col gap-2.5" aria-label="Vehículos en tránsito por modo">
          {byMode.map(({ m, n }) => {
            const { icon: Icon, color, label } = MODES[m];
            return (
              <li key={m} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <Icon className="size-3.5 shrink-0" style={{ color }} aria-hidden />
                  {label}
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-fill" aria-hidden>
                  <span className="meter-fill block h-full rounded-full" style={{ "--v": n / max, backgroundColor: color } as React.CSSProperties} />
                </span>
                <span className="tabular text-right text-muted-foreground">{n}</span>
              </li>
            );
          })}
        </ul>
      )}

      {closed.size > 0 && (
        <div>
          <h3 className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
            Vías cerradas · {closed.size}
            <Link href="/vias" className="link-draw inline-flex items-center gap-0.5 font-medium text-primary">
              Ver vías <ArrowUpRight className="size-3" aria-hidden />
            </Link>
          </h3>
          <ul className="list-in flex flex-col gap-1.5">
            {[...closed.entries()].slice(0, 4).map(([corridor, reason]) => (
              <li key={corridor} className="flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-3 py-2 text-xs">
                <TrafficCone className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{corridor}</span>
                  {reason && <span className="block truncate text-muted-foreground">{reason}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {moving.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Más cerca de llegar</h3>
          <ul className="list-in flex flex-col">
            {moving.map((a) => {
              const { icon: Icon, color } = MODES[a.mode];
              return (
                <li key={a.shipment_code}>
                  <Link
                    href={`/envios/${a.shipment_code}`}
                    prefetch={false}
                    className="press -mx-2 flex items-center gap-3 rounded-xl px-2 py-2 text-xs outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/60"
                  >
                    <Icon className="size-3.5 shrink-0" style={{ color }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {a.origin} <span className="text-muted-foreground">→</span> {a.destination}
                      </span>
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-fill" aria-hidden>
                        <span className="meter-fill block h-full rounded-full" style={{ "--v": a.progress_pct / 100, backgroundColor: color } as React.CSSProperties} />
                      </span>
                    </span>
                    <span className="tabular w-9 shrink-0 text-right text-muted-foreground">{Math.round(a.progress_pct)} %</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Elige origen, destino y prioridad arriba: el motor calcula la combinación óptima de modos y la dibuja en el mapa.
      </p>
    </section>
  );
}
