"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleAlert, FileText, LoaderCircle, Plus, Scale, Trash2 } from "lucide-react";

import { CityCombobox } from "@/components/map/city-combobox";
import { useApp } from "@/components/providers";
import { ModeChain } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { MODE_ORDER, MODES, PRIORITIES } from "@/lib/modes";
import { DEFAULT_SCENARIOS, type ScenarioSpec } from "@/lib/compare";
import type { CityOption, Priority, SimulateResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

type Scenario = ScenarioSpec & { id: number };

export type CompareResult = { ok: true; data: SimulateResponse } | { ok: false; error: string };
type Result = CompareResult | null;



type Metric = {
  key: string;
  label: string;
  value: (r: SimulateResponse) => number;
  show: (r: SimulateResponse, money: (n: number) => string) => string;
  better: "low" | "none";
};

/**
 * Comparador de rutas: el mismo origen, destino y peso con hasta tres escenarios (prioridad y modos permitidos)
 * lado a lado. En cada métrica se marca el mejor valor con texto, no solo con color, y una barra fina muestra la
 * proporción frente al mayor. Sirve para ver qué aporta la multimodalidad frente a mover todo por carretera.
 */
export function RouteCompare({
  initial,
  initialResults,
}: {
  initial: { origin: string; destination: string; weight: number };
  /** Resultados de los escenarios por defecto, calculados en el servidor (la página llega ya comparada). */
  initialResults: CompareResult[];
}) {
  const { money } = useApp();
  const [cities, setCities] = useState<CityOption[]>([]);
  const [origin, setOrigin] = useState(initial.origin);
  const [destination, setDestination] = useState(initial.destination);
  const [weight, setWeight] = useState(String(initial.weight));
  const [scenarios, setScenarios] = useState<Scenario[]>(DEFAULT_SCENARIOS.map((d, i) => ({ ...d, id: i + 1 })));
  const [results, setResults] = useState<Record<number, Result>>(() =>
    Object.fromEntries(initialResults.map((r, i) => [i + 1, r])),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ cities: CityOption[] }>("/api/locations").then((d) => setCities(d.cities)).catch(() => undefined);
  }, []);

  const run = useCallback(async () => {
    setBusy(true);
    const peso = Number(weight.replace(",", ".")) || 1;
    const entries = await Promise.all(
      scenarios.map(async (s): Promise<[number, Result]> => {
        try {
          const data = await api<SimulateResponse>("/api/routes/simulate", {
            method: "POST",
            body: { origen: origin, destino: destination, prioridad: s.priority, peso_t: peso, modos: s.modes },
          });
          return [s.id, { ok: true, data }];
        } catch (e) {
          return [s.id, { ok: false, error: (e as Error).message }];
        }
      }),
    );
    setResults(Object.fromEntries(entries));
    setBusy(false);
  }, [origin, destination, weight, scenarios]);

  const metrics: Metric[] = useMemo(
    () => [
      { key: "time", label: "Tiempo total", value: (r) => r.route.time_h, show: (r) => r.route.time_fmt, better: "low" },
      { key: "cost", label: "Costo total", value: (r) => r.route.cost, show: (r, m) => m(r.route.cost), better: "low" },
      { key: "cpt", label: "Costo por tonelada", value: (r) => r.route.cost_per_t, show: (r, m) => m(r.route.cost_per_t), better: "low" },
      { key: "co2", label: "CO₂e", value: (r) => r.footprint.co2e_kg, show: (r) => r.footprint.co2e_fmt, better: "low" },
      { key: "fuel", label: "Combustible", value: (r) => r.footprint.fuel_l, show: (r) => r.footprint.fuel_fmt, better: "low" },
      { key: "dist", label: "Distancia", value: (r) => r.route.distance_km, show: (r) => r.route.distance_fmt, better: "none" },
      { key: "tr", label: "Transbordos", value: (r) => r.route.n_transfers, show: (r) => String(r.route.n_transfers), better: "low" },
    ],
    [],
  );

  const ok = scenarios.map((s) => ({ s, r: results[s.id] })).filter((x): x is { s: Scenario; r: { ok: true; data: SimulateResponse } } => !!x.r && x.r.ok);

  const update = (id: number, patch: Partial<Scenario>) => setScenarios((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Envío a comparar" className="glass grid gap-3 rounded-3xl p-5 md:grid-cols-[1fr_1fr_8rem_auto] md:items-end">
        <CityCombobox label="Origen" value={origin} onChange={setOrigin} cities={cities} />
        <CityCombobox label="Destino" value={destination} onChange={setDestination} cities={cities} />
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Peso (t)</span>
          <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className="field tabular h-10 w-full px-3 text-sm" />
        </label>
        <Button onClick={run} disabled={busy || !origin || !destination}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Scale />}
          Comparar
        </Button>
      </section>

      <div className={cn("grid gap-4", scenarios.length === 1 ? "md:grid-cols-1" : scenarios.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3")}>
        {scenarios.map((s, i) => {
          const r = results[s.id];
          return (
            <section key={s.id} aria-label={s.name} className="glass flex flex-col rounded-3xl p-5">
              <div className="flex items-center gap-2">
                <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-fill text-xs font-semibold">{String.fromCharCode(65 + i)}</span>
                <input
                  value={s.name}
                  onChange={(e) => update(s.id, { name: e.target.value })}
                  aria-label={`Nombre del escenario ${String.fromCharCode(65 + i)}`}
                  className="min-w-0 flex-1 rounded-md bg-transparent px-1 text-[0.9375rem] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80"
                />
                {scenarios.length > 1 && (
                  <Button variant="ghost" size="icon" className="size-8" aria-label={`Quitar ${s.name}`} onClick={() => setScenarios((l) => l.filter((x) => x.id !== s.id))}>
                    <Trash2 />
                  </Button>
                )}
              </div>
              <div className="mt-3 flex rounded-xl bg-fill p-0.5 text-xs" role="radiogroup" aria-label={`Prioridad de ${s.name}`}>
                {(Object.keys(PRIORITIES) as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={s.priority === p}
                    onClick={() => update(s.id, { priority: p })}
                    className={cn("press h-8 flex-1 rounded-[10px]", s.priority === p ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  >
                    {PRIORITIES[p]}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label={`Modos permitidos en ${s.name}`}>
                {MODE_ORDER.map((m) => {
                  const on = s.modes.includes(m);
                  const Icon = MODES[m].icon;
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={on}
                      onClick={() => update(s.id, { modes: on ? s.modes.filter((x) => x !== m) : [...s.modes, m] })}
                      className={cn("press flex h-7 items-center gap-1 rounded-md border px-2 text-xs", on ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                    >
                      <Icon className="size-3.5" style={{ color: MODES[m].color }} aria-hidden />
                      {MODES[m].label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">{s.modes.length ? "Solo los modos marcados." : "Todos los modos permitidos."}</p>

              <div className="mt-4 border-t border-border pt-4">
                {!r ? (
                  <div className="skeleton h-16 rounded-xl" aria-hidden />
                ) : r.ok ? (
                  <>
                    <ModeChain modes={r.data.route.modes} />
                    <div className="tabular mt-2 text-[1.5rem] leading-none font-semibold tracking-[-0.03em]">{money(r.data.route.cost, true)}</div>
                    <div className="tabular mt-1 text-xs text-muted-foreground">
                      {r.data.route.time_fmt} · {r.data.footprint.co2e_fmt} CO₂e
                    </div>
                    <Link
                      href={`/cotizacion?origen=${encodeURIComponent(origin)}&destino=${encodeURIComponent(destination)}&peso=${encodeURIComponent(weight)}&prioridad=${s.priority}${s.modes.length ? `&modos=${s.modes.join(",")}` : ""}`}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      <FileText className="size-4" aria-hidden /> Cotizar este escenario
                    </Link>
                  </>
                ) : (
                  <p className="flex items-start gap-1.5 text-sm text-destructive">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {r.error}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {scenarios.length < 3 && (
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => setScenarios((l) => [...l, { id: Math.max(0, ...l.map((x) => x.id)) + 1, name: "Nuevo escenario", priority: "balanceado", modes: [] }])}
        >
          <Plus /> Agregar escenario
        </Button>
      )}

      {ok.length > 1 && (
        // Celular: un bloque por métrica con cada escenario en una línea (la tabla no cabe sin desplazarse)
        <ul className="glass rule-list overflow-hidden rounded-3xl md:hidden" aria-label="Comparación por métrica">
          {metrics.map((m) => {
            const vals = ok.map((x) => m.value(x.r.data));
            const best = m.better === "low" ? Math.min(...vals) : null;
            const unique = best !== null && vals.filter((v) => v === best).length < vals.length;
            return (
              <li key={m.key} className="px-4 py-3">
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <ul className="mt-1.5 flex flex-col gap-1 text-sm">
                  {ok.map((x, i) => (
                    <li key={x.s.id} className="flex items-center justify-between gap-3">
                      <span className="truncate">{x.s.name}</span>
                      <span className="tabular flex items-center gap-2">
                        {unique && vals[i] === best && <span className="rounded-full bg-success/12 px-1.5 py-px text-[11px] font-medium text-success">Mejor</span>}
                        <span className={cn(unique && vals[i] === best && "font-semibold")}>{m.show(x.r.data, (n) => money(n))}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
      {ok.length > 1 && (
        <section aria-labelledby="cmp-table" className="glass hidden overflow-x-auto rounded-3xl md:block">
          <h2 id="cmp-table" className="sr-only">
            Comparación por métrica
          </h2>
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Métrica</th>
                {ok.map(({ s }) => (
                  <th key={s.id} className="px-5 py-2.5 text-right text-xs font-medium text-muted-foreground">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const vals = ok.map((x) => m.value(x.r.data));
                const max = Math.max(...vals, 1e-9);
                const best = m.better === "low" ? Math.min(...vals) : null;
                const unique = best !== null && vals.filter((v) => v === best).length < vals.length;
                return (
                  <tr key={m.key} className="border-b border-border last:border-0">
                    <th scope="row" className="px-5 py-3 text-left font-normal text-muted-foreground">
                      {m.label}
                    </th>
                    {ok.map((x, i) => {
                      const v = vals[i];
                      const isBest = unique && v === best;
                      return (
                        <td key={x.s.id} className="px-5 py-3 text-right">
                          <div className="tabular flex items-center justify-end gap-2">
                            {isBest && <span className="rounded-full bg-success/12 px-1.5 py-px text-[11px] font-medium text-success">Mejor</span>}
                            <span className={cn(isBest && "font-semibold")}>{m.show(x.r.data, (n) => money(n))}</span>
                          </div>
                          <div className="mt-1.5 ml-auto h-1 w-28 overflow-hidden rounded-full bg-fill" aria-hidden>
                            <div className="h-full w-full origin-left rounded-full bg-[var(--accent)]" style={{ transform: `scaleX(${v / max})` }} />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
