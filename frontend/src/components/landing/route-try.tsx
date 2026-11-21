"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { api } from "@/lib/client";
import { MODES } from "@/lib/modes";
import type { Priority, SimulateResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "balanceado", label: "Balanceado" },
  { value: "tiempo", label: "Tiempo" },
  { value: "costo", label: "Costo" },
];
const PRIORITY_LABEL: Record<Priority, string> = { balanceado: "Balanceado", tiempo: "Más rápido", costo: "Más barato" };

type Alt = SimulateResponse["alternatives"][number];

function groupAlternatives(list: Alt[]): (Alt & { key: string; priorities: Priority[] })[] {
  const out: (Alt & { key: string; priorities: Priority[] })[] = [];
  for (const a of list) {
    const key = a.found ? `${(a.modes ?? []).join(",")}|${a.time_fmt}|${a.cost_fmt}` : `sin-ruta-${a.priority}`;
    const same = out.find((o) => o.key === key);
    if (same) same.priorities.push(a.priority);
    else out.push({ ...a, key, priorities: [a.priority] });
  }
  return out;
}

function joinLabels(ps: Priority[]): string {
  const labels = ps.map((p, i) => (i === 0 ? PRIORITY_LABEL[p] : PRIORITY_LABEL[p].toLowerCase()));
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}` : labels[0];
}

/**
 * Ruta en vivo para la presentación: el mismo motor de la app sobre la red real. Arranca con un cálculo hecho en el
 * servidor (la prueba se ve sin tocar nada) y cada cambio vuelve a pedirlo. Lleva a la cotización completa de la app.
 */
export function RouteTry({
  cities,
  initial,
  initialQuery,
}: {
  cities: string[];
  initial: SimulateResponse | null;
  initialQuery: { origen: string; destino: string; peso: number; prioridad: Priority };
}) {
  const [q, setQ] = useState(initialQuery);
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function calculate(next = q) {
    setQ(next);
    if (next.origen === next.destino) {
      setError("Elija un destino distinto del origen.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setData(
        await api<SimulateResponse>("/api/routes/simulate", {
          method: "POST",
          body: { origen: next.origen, destino: next.destino, peso_t: next.peso, prioridad: next.prioridad },
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const r = data?.route;
  // Prioridades que dan la misma ruta se muestran en una sola fila («Más rápido y balanceado»), no repetidas
  const alternatives = groupAlternatives(data?.alternatives ?? []);
  const total = r?.legs.length ? r.legs[r.legs.length - 1].end_h || 1 : 1;
  const quote = `/cotizacion?${new URLSearchParams({ origen: q.origen, destino: q.destino, peso: String(q.peso), prioridad: q.prioridad })}`;

  return (
    <section id="ruta" aria-labelledby="ruta-titulo" className="scroll-mt-16 border-t border-border bg-card">
      <div className="max-w-[1440px] py-20 px-4 sm:px-8 lg:px-14 xl:px-20 lg:py-28">
        <div className="max-w-[46rem]">
          <h2 id="ruta-titulo" className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-[2.75rem]">
            Calcule una ruta ahora, con la red real.
          </h2>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted-foreground">
            Es el mismo motor de la app: elige los modos, los transbordos y la vía según lo que usted priorice. Los costos son de
            referencia, en dólares.
          </p>
        </div>

        <form
          className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_7rem_auto] lg:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void calculate();
          }}
        >
          <label className="flex flex-col gap-1.5 text-[0.8125rem] font-medium">
            Origen
            <select className="field h-11 px-3 text-base font-normal" value={q.origen} onChange={(e) => setQ({ ...q, origen: e.target.value })}>
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[0.8125rem] font-medium">
            Destino
            <select className="field h-11 px-3 text-base font-normal" value={q.destino} onChange={(e) => setQ({ ...q, destino: e.target.value })}>
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1.5 text-[0.8125rem] font-medium">
            <span id="ruta-prioridad">Prioridad</span>
            <Segmented
              id="ruta-prioridad-control"
              label="Prioridad de la ruta"
              value={q.prioridad}
              options={PRIORITIES}
              onChange={(v) => void calculate({ ...q, prioridad: v })}
            />
          </div>
          <label className="flex flex-col gap-1.5 text-[0.8125rem] font-medium">
            Peso (t)
            <input
              className="field tabular h-11 px-3 text-base font-normal"
              type="number"
              inputMode="decimal"
              min={0.1}
              max={20000}
              step="any"
              value={q.peso}
              onChange={(e) => setQ({ ...q, peso: Number(e.target.value) || 0 })}
            />
          </label>
          <Button type="submit" size="lg" disabled={busy || q.peso <= 0} className="h-11">
            {busy && <LoaderCircle className="animate-spin" />} Calcular
          </Button>
        </form>

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        {r && (
          <div aria-live="polite" aria-busy={busy} className={cn("mt-8 overflow-hidden rounded-3xl glass transition-opacity", busy && "opacity-60")}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 sm:px-7 sm:pt-7">
              <p className="text-lg font-semibold tracking-tight">
                {r.origin} → {r.destination}
              </p>
              <p className="tabular text-sm text-muted-foreground">
                {r.weight_fmt} · {r.distance_fmt} · {r.n_transfers === 0 ? "sin transbordos" : r.n_transfers === 1 ? "1 transbordo" : `${r.n_transfers} transbordos`}
              </p>
            </div>

            {/* La cadena de modos: una barra por tramo, largo proporcional al tiempo; los rótulos van en lista debajo para
                que un tramo corto no los corte */}
            {/* La clave cambia con cada resultado: la barra se vuelve a montar y sus tramos crecen en orden */}
            <div key={`${r.origin}-${r.destination}-${r.priority}-${r.weight_t}`} className="flex gap-1 px-5 pt-5 sm:px-7" aria-hidden>
              {r.legs.map((l, i) => (
                <span
                  key={i}
                  className="leg-in block h-2.5 rounded-full"
                  style={{ flex: `${Math.max(l.end_h - l.start_h, total * 0.04)} 1 0`, backgroundColor: MODES[l.mode].color, "--k": i } as React.CSSProperties}
                />
              ))}
            </div>
            <ol className="mt-3 flex flex-col gap-1.5 px-5 sm:px-7" aria-label="Tramos de la ruta">
              {r.legs.map((l, i) => {
                const { label, icon: Icon, color } = MODES[l.mode];
                return (
                  <li key={i} className="grid grid-cols-[1rem_5.5rem_minmax(0,1fr)] items-start gap-x-2 text-sm leading-5">
                    <Icon className="mt-0.5 size-4" style={{ color }} aria-hidden />
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground">
                      {l.from.city} → {l.to.city} <span className="tabular">· {l.time_fmt}</span>
                    </span>
                  </li>
                );
              })}
            </ol>

            <dl className="mt-6 grid grid-cols-2 border-t border-border sm:grid-cols-4">
              {[
                { k: "Llegada estimada", v: r.time_fmt },
                { k: "Costo de referencia", v: r.cost_fmt },
                { k: "Huella", v: `${data.footprint.co2e_fmt} CO₂e` },
                { k: "Costo por tonelada", v: r.cost_per_t_fmt },
              ].map((f, i) => (
                <div key={f.k} className={cn("px-5 py-4 sm:px-7", i % 2 === 1 && "border-l border-border", i >= 2 && "border-t border-border sm:border-t-0", i === 2 && "sm:border-l")}>
                  <dt className="text-xs text-muted-foreground">{f.k}</dt>
                  <dd className="tabular mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{f.v}</dd>
                </div>
              ))}
            </dl>

            <div className="border-t border-border">
              <p className="px-5 pt-4 text-[0.8125rem] font-medium text-muted-foreground sm:px-7">
                {alternatives.length === 1 ? "La misma ruta gana con cualquier prioridad" : "Según lo que priorice"}
              </p>
              <ul className="rule-list mt-2 text-sm">
                {alternatives.map((a) => (
                  <li key={a.key} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[12rem_minmax(0,1fr)_7rem_7rem_8rem] sm:px-7", a.priorities.includes(r.priority) && "bg-raised")}>
                    <span className="font-medium">{joinLabels(a.priorities)}</span>
                    {a.found ? (
                      <>
                        <span role="img" className="flex items-center gap-1" aria-label={(a.modes ?? []).map((m) => MODES[m].label).join(", ")}>
                          {(a.modes ?? []).map((m, i) => {
                            const Icon = MODES[m].icon;
                            return <Icon key={i} className="size-4" style={{ color: MODES[m].color }} aria-hidden />;
                          })}
                        </span>
                        <span className="tabular text-muted-foreground sm:text-right">{a.time_fmt}</span>
                        <span className="tabular text-muted-foreground sm:text-right">{a.cost_fmt}</span>
                        <span className="tabular text-muted-foreground sm:text-right">{a.co2e_fmt} CO₂e</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground sm:col-span-4">Sin ruta con esta prioridad</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-7">
              <p className="text-xs text-muted-foreground">Red con datos verificados y aproximados; los aproximados se marcan en la app.</p>
              <Link href={quote} className="press inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/60">
                Abrir como cotización <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
