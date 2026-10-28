"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronDown, Search } from "lucide-react";

import { useApp } from "@/components/providers";
import { ModeIcon } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatStrip } from "@/components/ui/stat-strip";
import { EASE } from "@/lib/motion";
import type { ClientSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "cost" | "shipments" | "tons" | "on_time_pct" | "active";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "cost", label: "Flete" },
  { key: "shipments", label: "Envíos" },
  { key: "tons", label: "Toneladas" },
  { key: "on_time_pct", label: "Puntualidad" },
  { key: "active", label: "En ruta" },
];

const n = (v: number) => v.toLocaleString("es-CO");

/** Puntualidad con su lectura: verde desde 95 %, naranja desde 85 %, roja por debajo (siempre con la cifra). */
function OnTime({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground">Sin entregas</span>;
  const tone = pct >= 95 ? "text-success" : pct >= 85 ? "text-warning" : "text-destructive";
  return <span className={cn("tabular font-medium", tone)}>{pct.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %</span>;
}

/**
 * Clientes: quién mueve más carga, cuánto paga en flete, qué tan puntuales han sido sus entregas y por qué modos.
 * Cada fila se despliega con sus rutas frecuentes y sus últimos envíos.
 */
export function ClientsView({ items }: { items: ClientSummary[] }) {
  const { money } = useApp();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "cost", desc: true });
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = term ? items.filter((c) => c.client.toLowerCase().includes(term)) : items;
    const val = (c: ClientSummary) => (sort.key === "on_time_pct" ? (c.on_time_pct ?? -1) : c[sort.key]);
    return [...filtered].sort((a, b) => (sort.desc ? val(b) - val(a) : val(a) - val(b)));
  }, [items, q, sort]);

  const totalCost = items.reduce((a, c) => a + c.cost, 0);
  const delivered = items.reduce((a, c) => a + c.delivered, 0);
  const onTime = items.reduce((a, c) => a + ((c.on_time_pct ?? 0) / 100) * c.delivered, 0);
  const top = items[0];

  return (
    <div className="flex flex-col gap-6">
      <StatStrip
        items={[
          { label: "Clientes", value: n(items.length), hint: `${n(items.reduce((a, c) => a + c.shipments, 0))} envíos en total` },
          { label: "En ruta ahora", value: n(items.reduce((a, c) => a + c.active, 0)), hint: `${n(items.reduce((a, c) => a + c.delayed, 0))} con retraso` },
          { label: "Puntualidad", value: delivered ? `${(100 * onTime / delivered).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %` : "—", hint: `${n(delivered)} entregas` },
          { label: "Flete facturado", value: money(totalCost, true), hint: top ? `${top.client}: ${Math.round((100 * top.cost) / (totalCost || 1))} %` : undefined },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex h-10 w-full max-w-xs items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente" className="field h-10 w-full pr-3 pl-9 text-sm" />
        </label>
        <div className="chip-scroll flex items-center gap-1 text-sm" role="group" aria-label="Ordenar por">
          <span className="mr-1 text-xs text-muted-foreground">Ordenar por</span>
          {SORTS.map((s) => {
            const on = sort.key === s.key;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                onClick={() => setSort((p) => ({ key: s.key, desc: p.key === s.key ? !p.desc : true }))}
                className={cn(
                  "press inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs",
                  on ? "bg-card font-medium text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
                {on && (sort.desc ? <ArrowDown className="size-3" aria-label="mayor a menor" /> : <ArrowUp className="size-3" aria-label="menor a mayor" />)}
              </button>
            );
          })}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="glass rounded-3xl">
          <EmptyState figure="0" title="Ningún cliente coincide" description="Cambia la búsqueda." />
        </div>
      ) : (
        <ul className="rows overflow-hidden rounded-3xl">
          <li className="hidden grid-cols-[minmax(0,2fr)_6rem_7rem_7rem_8rem_7rem_6rem_2rem] gap-4 px-5 py-2.5 text-xs font-medium text-muted-foreground lg:grid" aria-hidden>
            <span>Cliente</span>
            <span className="text-right">Envíos</span>
            <span className="text-right">Puntualidad</span>
            <span className="text-right">Toneladas</span>
            <span className="text-right">Flete</span>
            <span className="text-right">Por tonelada</span>
            <span>Modos</span>
            <span />
          </li>
          {list.map((c) => {
            const expanded = open === c.client;
            return (
              <li key={c.client}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : c.client)}
                  className="grid w-full grid-cols-2 gap-x-4 gap-y-1 px-5 py-3.5 text-left text-sm outline-none transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--card)_96%,var(--foreground))] focus-visible:ring-[3px] focus-visible:ring-ring/80 focus-visible:ring-inset lg:grid-cols-[minmax(0,2fr)_6rem_7rem_7rem_8rem_7rem_6rem_2rem] lg:items-center"
                >
                  <span className="col-span-2 min-w-0 lg:col-span-1">
                    <span className="block truncate font-medium">{c.client}</span>
                    <span className="tabular block text-xs text-muted-foreground">
                      {c.active ? `${c.active} en ruta` : "Nada en ruta"}
                      {c.delayed ? <span className="text-destructive"> · {c.delayed} con retraso</span> : null}
                      {c.scheduled ? ` · ${c.scheduled} programados` : ""}
                    </span>
                  </span>
                  <span className="tabular lg:text-right">
                    <span className="text-xs text-muted-foreground lg:hidden">Envíos </span>
                    {n(c.shipments)}
                  </span>
                  <span className="text-right lg:text-right">
                    <OnTime pct={c.on_time_pct} />
                  </span>
                  <span className="tabular lg:text-right">
                    <span className="text-xs text-muted-foreground lg:hidden">Carga </span>
                    {c.tons_fmt}
                  </span>
                  <span className="tabular text-right font-medium">{money(c.cost, true)}</span>
                  <span className="tabular hidden text-right text-muted-foreground lg:block">{money(c.avg_cost_per_t)}</span>
                  <span className="hidden items-center gap-1 lg:flex">
                    {c.modes.slice(0, 4).map((m) => (
                      <ModeIcon key={m.mode} mode={m.mode} />
                    ))}
                  </span>
                  <ChevronDown className={cn("hidden size-4 justify-self-end text-muted-foreground transition-transform duration-200 lg:block", expanded && "rotate-180")} aria-hidden />
                </button>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      className="grid gap-5 border-t border-border bg-[color-mix(in_srgb,var(--card)_97%,var(--foreground))] px-5 py-4 text-sm md:grid-cols-3"
                    >
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground">Rutas frecuentes</h3>
                        <ul className="mt-1.5 flex flex-col gap-1">
                          {c.top_routes.map((r) => (
                            <li key={r.route} className="flex justify-between gap-3">
                              <span className="truncate">{r.route}</span>
                              <span className="tabular text-muted-foreground">{r.count}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground">Modos</h3>
                        <ul className="mt-1.5 flex flex-col gap-1">
                          {c.modes.map((m) => (
                            <li key={m.mode} className="flex items-center gap-2">
                              <ModeIcon mode={m.mode} />
                              <span className="flex-1">{m.label}</span>
                              <span className="tabular text-muted-foreground">{m.count}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground">Últimos envíos</h3>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {c.recent.map((code) => (
                            <Link key={code} href={`/envios/${code}`} prefetch={false} className="rounded-md border border-border px-1.5 py-0.5 font-mono text-xs hover:border-primary hover:text-primary">
                              {code}
                            </Link>
                          ))}
                        </div>
                        <Link href={`/envios?q=${encodeURIComponent(c.client)}`} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                          Ver todos sus envíos
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
