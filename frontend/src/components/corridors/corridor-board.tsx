"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, History, LoaderCircle, Lock, LockOpen, Search, TriangleAlert } from "lucide-react";

import { useApp } from "@/components/providers";
import { ModeIcon } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { MODE_ORDER, MODES } from "@/lib/modes";
import type { AuditEntry, Corridor, CorridorChange, Mode } from "@/lib/types";
import { cn } from "@/lib/utils";

type StateFilter = "todas" | "activas" | "cerradas";

function dt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—";
}

export function CorridorBoard({ corridors, history }: { corridors: Corridor[]; history: AuditEntry[] }) {
  const router = useRouter();
  const { operator } = useApp();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode | null>(null);
  const [state, setState] = useState<StateFilter>("todas");
  const [closing, setClosing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CorridorChange | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return corridors.filter(
      (c) =>
        (!q || c.corridor.toLowerCase().includes(q) || c.segments.some((s) => s.toLowerCase().includes(q))) &&
        (!mode || c.modes.includes(mode)) &&
        (state === "todas" || (state === "activas" ? c.active : !c.active)),
    );
  }, [corridors, query, mode, state]);

  const closedCount = corridors.filter((c) => !c.active).length;

  async function change(corridor: string, active: boolean) {
    setBusy(corridor);
    setError(null);
    setResult(null);
    try {
      const res = await api<CorridorChange>("/api/corridors/status", {
        method: "POST",
        body: { corridor, active, reason: active ? null : reason, usuario: operator },
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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative flex h-9 w-full max-w-xs items-center">
            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar vía o ciudad"
              aria-label="Buscar vías"
              className="h-9 w-full rounded-md border border-input bg-white/[0.02] pr-3 pl-9 text-sm outline-none focus:border-neon-cyan/40"
            />
          </label>
          <div className="flex rounded-md border border-white/[0.06] p-0.5 text-xs" role="radiogroup" aria-label="Estado">
            {(["todas", "activas", "cerradas"] as StateFilter[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={state === s} onClick={() => setState(s)}
                className={cn("h-7 rounded px-3 capitalize", state === s ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {s}
                {s === "cerradas" && closedCount > 0 && <span className="ml-1 text-neon-rose">{closedCount}</span>}
              </button>
            ))}
          </div>
          <div className="flex gap-1" role="group" aria-label="Filtrar por modo">
            {MODE_ORDER.map((m) => {
              const on = mode === m;
              const { icon: Icon, color, label } = MODES[m];
              return (
                <button key={m} type="button" onClick={() => setMode(on ? null : m)} aria-pressed={on} title={label}
                  className={cn("flex size-8 items-center justify-center rounded-md border transition-colors",
                    on ? "" : "border-white/[0.06] opacity-60 hover:opacity-100")}
                  style={on ? { borderColor: `${color}66`, backgroundColor: `${color}1a` } : undefined}>
                  <Icon className="size-4" style={{ color }} />
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="rounded-md border border-neon-rose/25 bg-neon-rose/10 px-3 py-2 text-sm text-neon-rose">{error}</p>}
        {result && <ChangeSummary result={result} />}

        <ul className="flex flex-col gap-2">
          {list.length === 0 && <li className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">Ninguna vía coincide.</li>}
          {list.map((c) => (
            <li key={c.corridor}
              className={cn("rounded-lg border bg-card p-4", c.active ? "border-border" : "border-neon-rose/25 bg-neon-rose/[0.03]")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="flex shrink-0 gap-1">{c.modes.map((m) => <ModeIcon key={m} mode={m} />)}</div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {c.corridor}
                      {c.active ? (
                        <Badge tone="emerald"><CircleCheck />Activa</Badge>
                      ) : (
                        <Badge tone="rose"><Lock />Cerrada</Badge>
                      )}
                      {c.approximate && <Badge tone="neutral" title="Coordenadas y distancias sin verificar con fuente oficial">Aproximada</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {c.distance_fmt} · {c.links} {c.links === 1 ? "enlace" : "enlaces"} · {c.segments.slice(0, 3).join("; ")}
                      {c.segments.length > 3 && ` y ${c.segments.length - 3} más`}
                    </div>
                    {!c.active && (
                      <div className="mt-1.5 text-xs text-neon-rose">
                        Motivo: {c.reason} · {dt(c.changed_at)} · {c.changed_by}
                      </div>
                    )}
                    {c.shipments.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        {c.active ? "En uso por" : "Envíos sin alternativa:"}
                        {c.shipments.slice(0, 8).map((code) => (
                          <Link key={code} href={`/envios/${code}`} className="font-mono text-[11px] text-slate-300 hover:text-neon-cyan">
                            {code}
                          </Link>
                        ))}
                        {c.shipments.length > 8 && <span>y {c.shipments.length - 8} más</span>}
                      </div>
                    )}
                  </div>
                </div>
                {c.active ? (
                  closing === c.corridor ? null : (
                    <Button variant="secondary" size="sm" className="shrink-0" onClick={() => { setClosing(c.corridor); setReason(""); setError(null); }}>
                      <Lock />
                      Cerrar vía
                    </Button>
                  )
                ) : (
                  <Button variant="secondary" size="sm" className="shrink-0" disabled={busy === c.corridor} onClick={() => change(c.corridor, true)}>
                    {busy === c.corridor ? <LoaderCircle className="animate-spin" /> : <LockOpen />}
                    Reabrir
                  </Button>
                )}
              </div>
              {closing === c.corridor && (
                <form
                  className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"
                  onSubmit={(e) => { e.preventDefault(); void change(c.corridor, false); }}
                >
                  <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={200}
                    placeholder="Motivo del cierre (derrumbe, paro, mantenimiento...)" aria-label="Motivo del cierre"
                    className="h-8 min-w-64 flex-1 rounded-md border border-input bg-white/[0.02] px-2.5 text-xs outline-none focus:border-neon-rose/40" />
                  <Button type="submit" size="sm" variant="destructive" disabled={busy === c.corridor || !reason.trim()}>
                    {busy === c.corridor ? <LoaderCircle className="animate-spin" /> : <Lock />}
                    Confirmar cierre
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setClosing(null)}>Cancelar</Button>
                  {c.shipments.length > 0 && (
                    <span className="w-full text-[11px] text-neon-amber">
                      {c.shipments.length} envío(s) en curso usan esta vía y se redirigirán.
                    </span>
                  )}
                </form>
              )}
            </li>
          ))}
        </ul>
      </div>

      <aside className="h-fit rounded-lg border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <History className="size-4 text-muted-foreground" /> Historial de cierres
        </h2>
        {history.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">Aún no hay cierres registrados.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5 text-xs">
            {history.map((h) => (
              <li key={h.audit_id} className={cn("border-l pl-3", h.action === "CLOSE" ? "border-neon-rose/50" : "border-neon-emerald/50")}>
                <div className="text-muted-foreground">{dt(h.timestamp)} · <span className="text-foreground">{h.username}</span></div>
                <div className="font-medium">{h.record_id}</div>
                <div>{h.detail}</div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[11px] text-muted-foreground">
          El nombre es el que se declara en la barra lateral; no hay autenticación.
        </p>
      </aside>
    </div>
  );
}

function ChangeSummary({ result }: { result: CorridorChange }) {
  const groups: [string, string[], string, React.ReactNode][] = [
    ["Redirigidos", result.rerouted, "text-neon-amber", <TriangleAlert key="r" className="size-3.5" />],
    ["Recalculados (programados)", result.replanned, "text-neon-cyan", <CircleCheck key="p" className="size-3.5" />],
    ["Sin ruta disponible", result.no_route, "text-neon-rose", <CircleAlert key="n" className="size-3.5" />],
    ["Ruta restablecida", result.restored, "text-neon-emerald", <CircleCheck key="o" className="size-3.5" />],
  ];
  const any = groups.some(([, codes]) => codes.length > 0);
  return (
    <div className="rounded-lg border border-border-strong bg-card p-4 text-sm">
      <div className="font-medium">
        {result.corridor} {result.active ? "reabierta" : "cerrada"}.{" "}
        {!any && <span className="font-normal text-muted-foreground">Ningún envío en curso la usaba.</span>}
      </div>
      {groups.filter(([, codes]) => codes.length > 0).map(([label, codes, color, icon]) => (
        <div key={label} className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className={cn("flex items-center gap-1 font-medium", color)}>{icon}{label} ({codes.length}):</span>
          {codes.map((code) => (
            <Link key={code} href={`/envios/${code}`} className="font-mono text-[11px] text-slate-300 hover:text-neon-cyan">{code}</Link>
          ))}
        </div>
      ))}
    </div>
  );
}
