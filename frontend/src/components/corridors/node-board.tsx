"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Anchor, Building2, CircleCheck, LoaderCircle, Lock, LockOpen, Plane, Search, TrainFront, Waves } from "lucide-react";

import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import type { NodeChange, NodeStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ChangeSummary } from "./corridor-board";
import { GroupBlock } from "./group-block";

const KINDS: Record<string, { label: string; icon: typeof Plane }> = {
  aeropuerto: { label: "Aeropuertos", icon: Plane },
  puerto_maritimo: { label: "Puertos marítimos", icon: Anchor },
  puerto_fluvial: { label: "Puertos fluviales", icon: Waves },
  terminal_ferrea: { label: "Terminales férreas", icon: TrainFront },
  cedi: { label: "Centros de distribución", icon: Building2 },
  ciudad: { label: "Ciudades", icon: Building2 },
};

type StateFilter = "todos" | "operativos" | "cerrados";

function dt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }).replace(/\s/g, " ") : "—";
}

/** Cierre y reapertura de nodos: aeropuertos, puertos, terminales, CEDIs y ciudades. */
export function NodeBoard({ nodes }: { nodes: NodeStatus[] }) {
  const router = useRouter();
  const { operator } = useApp();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string | null>(null);
  const [state, setState] = useState<StateFilter>("todos");
  const [closing, setClosing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NodeChange | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nodes.filter(
      (n) =>
        (!q || n.name.toLowerCase().includes(q) || n.city.toLowerCase().includes(q) || n.code.toLowerCase().includes(q)) &&
        (!kind || n.kind === kind) &&
        (state === "todos" || (state === "operativos" ? n.active : !n.active)),
    );
  }, [nodes, query, kind, state]);

  const closedCount = nodes.filter((n) => !n.active).length;

  const filtering = query.trim() !== "" || kind !== null || state !== "todos";
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => {
    const out: { key: string; title: string; icon?: React.ReactNode; danger?: boolean; items: NodeStatus[]; defaultOpen: boolean }[] = [];
    const closed = list.filter((n) => !n.active);
    if (closed.length) out.push({ key: "cerrados", title: "Cerrados", danger: true, items: closed, defaultOpen: true });
    for (const k of Object.keys(KINDS)) {
      const items = list.filter((n) => n.active && n.kind === k);
      if (!items.length) continue;
      const Icon = KINDS[k].icon;
      out.push({ key: k, title: KINDS[k].label, icon: <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />,
        items, defaultOpen: filtering || items.length <= 8 });
    }
    return out;
  }, [list, filtering]);
  const kinds = useMemo(() => Object.keys(KINDS).filter((k) => nodes.some((n) => n.kind === k)), [nodes]);

  async function change(code: string, active: boolean) {
    setBusy(code);
    setError(null);
    setResult(null);
    try {
      const res = await api<NodeChange>("/api/nodes/status", {
        method: "POST",
        body: { code, active, reason: active ? null : reason, usuario: operator },
      });
      setResult(res);
      setClosing(null);
      setReason("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex h-10 w-full max-w-xs items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nodo, ciudad o código"
            aria-label="Buscar nodos"
            className="h-10 w-full field pr-3 pl-9 text-sm outline-none" />
        </label>
        <div className="flex rounded-md border border-border p-0.5 text-xs" role="radiogroup" aria-label="Estado">
          {(["todos", "operativos", "cerrados"] as StateFilter[]).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={state === s} onClick={() => setState(s)}
              className={cn("press h-7 rounded px-3 capitalize", state === s ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {s}
              {s === "cerrados" && closedCount > 0 && <span className="ml-1 text-destructive">{closedCount}</span>}
            </button>
          ))}
        </div>
        <div className="chip-scroll flex flex-wrap gap-1" role="group" aria-label="Filtrar por tipo">
          {kinds.map((k) => {
            const on = kind === k;
            const { icon: Icon, label } = KINDS[k];
            return (
              <button key={k} type="button" onClick={() => setKind(on ? null : k)} aria-pressed={on} title={label}
                className={cn("press flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
                  on ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                <Icon className="size-3.5" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {result && <ChangeSummary result={result} name={result.name} feminine={false} />}

      <ul className="flex flex-col gap-2">
        {list.length === 0 && (
          <li className="glass flex flex-col items-center gap-3 rounded-3xl p-8 text-center text-sm text-muted-foreground">
            Ningún nodo coincide con la búsqueda y los filtros.
            <Button variant="secondary" size="sm" onClick={() => { setQuery(""); setKind(null); setState("todos"); }}>
              Quitar filtros
            </Button>
          </li>
        )}
        {groups.map((g) => (
          <GroupBlock key={g.key} title={g.title} count={g.items.length} icon={g.icon} danger={g.danger}
            open={openGroups[g.key] ?? g.defaultOpen}
            onToggle={() => setOpenGroups((o) => ({ ...o, [g.key]: !(o[g.key] ?? g.defaultOpen) }))}>
        {g.items.map((n) => {
          const Icon = (KINDS[n.kind] ?? KINDS.ciudad).icon;
          return (
            <li key={n.code} className={cn("px-4 py-3 sm:px-5 sm:py-4", !n.active && "bg-destructive/[0.04]")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-fill text-muted-foreground">
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {n.name}
                      {n.active ? <Badge tone="success"><CircleCheck />Operativo</Badge> : <Badge tone="danger"><Lock />Cerrado</Badge>}
                      {n.approximate && <Badge tone="neutral" title="Coordenadas sin verificar con fuente oficial">Aproximado</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-mono">{n.code}</span> · {(KINDS[n.kind] ?? KINDS.ciudad).label.replace(/s$/, "")} · {n.city}
                    </div>
                    {!n.active && (
                      <div className="mt-1.5 text-xs text-destructive">Motivo: {n.reason} · {dt(n.changed_at)} · {n.changed_by}</div>
                    )}
                    {n.shipments.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        {n.active ? "Pasan por aquí:" : "Envíos sin alternativa:"}
                        {n.shipments.slice(0, 8).map((code) => (
                          <Link key={code} href={`/envios/${code}`} className="font-mono text-xs text-foreground/80 hover:text-primary">{code}</Link>
                        ))}
                        {n.shipments.length > 8 && <span>y {n.shipments.length - 8} más</span>}
                      </div>
                    )}
                  </div>
                </div>
                {n.active ? (
                  closing === n.code ? null : (
                    <Button variant="secondary" size="sm" className="shrink-0" onClick={() => { setClosing(n.code); setReason(""); setError(null); }}>
                      <Lock />Cerrar
                    </Button>
                  )
                ) : (
                  <Button variant="secondary" size="sm" className="shrink-0" disabled={busy === n.code} onClick={() => change(n.code, true)}>
                    {busy === n.code ? <LoaderCircle className="animate-spin" /> : <LockOpen />}Reabrir
                  </Button>
                )}
              </div>
              {closing === n.code && (
                <form className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"
                  onSubmit={(e) => { e.preventDefault(); void change(n.code, false); }}>
                  <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={200}
                    placeholder="Motivo del cierre (pista, clima, paro, mantenimiento...)" aria-label="Motivo del cierre"
                    className="h-8 min-w-64 flex-1 field px-2.5 text-xs outline-none focus:border-destructive/40" />
                  <Button type="submit" size="sm" variant="destructive" disabled={busy === n.code || !reason.trim()}>
                    {busy === n.code ? <LoaderCircle className="animate-spin" /> : <Lock />}Confirmar cierre
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setClosing(null)}>Cancelar</Button>
                  {n.shipments.length > 0 && (
                    <span className="w-full text-xs text-warning">{n.shipments.length} envío(s) en curso pasan por aquí y se redirigirán.</span>
                  )}
                </form>
              )}
            </li>
          );
        })}
          </GroupBlock>
        ))}
      </ul>
    </div>
  );
}
