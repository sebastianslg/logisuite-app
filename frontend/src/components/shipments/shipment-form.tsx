"use client";

import { cloneElement, useEffect, useId, useMemo, useState, type ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Clock, CircleDollarSign, LoaderCircle, Route, Save, X } from "lucide-react";

import { useApp } from "@/components/providers";
import { ModeChain, ModeIcon } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { MODE_ORDER, MODES, PRIORITIES } from "@/lib/modes";
import type { CityOption, Corridor, Mode, Priority, RouteResult, Shipment } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ShipmentDraft {
  origin: string;
  destination: string;
  cargo: string;
  weight_t: string;
  priority: Priority;
  client: string;
  departure_at: string;
  delay_h: string;
  forced_modes: Mode[];
  forced_corridors: string[];
}

const MAX_CORRIDORS = 3;

/** Fecha local para <input type="datetime-local"> (AAAA-MM-DDTHH:MM). */
function localInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function draftFrom(s?: Shipment, prefill: Partial<ShipmentDraft> = {}): ShipmentDraft {
  if (s) {
    return {
      origin: s.origin,
      destination: s.destination,
      cargo: s.cargo,
      weight_t: String(s.weight_t),
      priority: s.priority,
      client: s.client,
      departure_at: s.departure_at.slice(0, 16),
      delay_h: String(s.delay_h ?? 0),
      forced_modes: s.forced_modes,
      forced_corridors: s.forced_corridors,
    };
  }
  const start = new Date(Date.now() + 2 * 3600_000);
  start.setMinutes(0, 0, 0);
  return {
    origin: "Bogotá",
    destination: "Cartagena",
    cargo: "",
    weight_t: "10",
    priority: "balanceado",
    client: "",
    departure_at: localInput(start),
    delay_h: "0",
    forced_modes: [],
    forced_corridors: [],
    ...prefill,
  };
}

export function ShipmentForm({ shipment, prefill }: { shipment?: Shipment; prefill?: Partial<ShipmentDraft> }) {
  const router = useRouter();
  const { operator, money } = useApp();
  const [draft, setDraft] = useState<ShipmentDraft>(() => draftFrom(shipment, prefill));
  const [cities, setCities] = useState<CityOption[]>([]);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [preview, setPreview] = useState<RouteResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [corridorQuery, setCorridorQuery] = useState("");

  useEffect(() => {
    api<{ cities: CityOption[] }>("/api/locations").then((d) => setCities(d.cities)).catch(() => undefined);
    api<{ items: Corridor[] }>("/api/corridors").then((d) => setCorridors(d.items)).catch(() => undefined);
  }, []);

  const set = <K extends keyof ShipmentDraft>(k: K, v: ShipmentDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setPreview(null);
  };

  const body = () => ({
    origin: draft.origin,
    destination: draft.destination,
    cargo: draft.cargo,
    weight_t: Number(draft.weight_t.replace(",", ".")),
    priority: draft.priority,
    client: draft.client,
    departure_at: draft.departure_at,
    delay_h: Number(draft.delay_h.replace(",", ".")) || 0,
    forced_modes: draft.forced_modes,
    forced_corridors: draft.forced_corridors,
    usuario: operator,
  });

  async function runPreview() {
    setBusy("preview");
    setError(null);
    try {
      setPreview((await api<{ route: RouteResult }>("/api/shipments/preview", { method: "POST", body: body() })).route);
    } catch (e) {
      setPreview(null);
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    try {
      const saved = shipment
        ? await api<Shipment>(`/api/shipments/${encodeURIComponent(shipment.code)}`, { method: "PUT", body: body() })
        : await api<Shipment>("/api/shipments", { method: "POST", body: body() });
      router.push(`/envios/${saved.code}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  const toggleMode = (m: Mode) =>
    set("forced_modes", draft.forced_modes.includes(m) ? draft.forced_modes.filter((x) => x !== m) : [...draft.forced_modes, m]);
  const toggleCorridor = (c: string) =>
    set(
      "forced_corridors",
      draft.forced_corridors.includes(c)
        ? draft.forced_corridors.filter((x) => x !== c)
        : [...draft.forced_corridors, c].slice(0, MAX_CORRIDORS),
    );

  const corridorOptions = useMemo(() => {
    const q = corridorQuery.trim().toLowerCase();
    return corridors
      .filter((c) => c.active && !draft.forced_corridors.includes(c.corridor))
      .filter((c) => !q || c.corridor.toLowerCase().includes(q))
      .slice(0, 8);
  }, [corridors, corridorQuery, draft.forced_corridors]);

  const input =
    "h-9 w-full rounded-md border border-input bg-white/[0.02] px-3 text-sm outline-none focus:border-neon-cyan/40 [&>option]:bg-[#0b0f19]";

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Origen">
            <select className={input} value={draft.origin} onChange={(e) => set("origin", e.target.value)} required>
              {!cities.some((c) => c.city === draft.origin) && <option value={draft.origin}>{draft.origin}</option>}
              {cities.map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Destino">
            <select className={input} value={draft.destination} onChange={(e) => set("destination", e.target.value)} required>
              {!cities.some((c) => c.city === draft.destination) && (
                <option value={draft.destination}>{draft.destination}</option>
              )}
              {cities.map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Carga">
            <input className={input} value={draft.cargo} onChange={(e) => set("cargo", e.target.value)} required maxLength={120}
              placeholder="Ej. Café excelso en sacos" />
          </Field>
          <Field label="Cliente">
            <input className={input} value={draft.client} onChange={(e) => set("client", e.target.value)} required maxLength={120} />
          </Field>
          <Field label="Peso (t)">
            <input className={cn(input, "tabular")} inputMode="decimal" value={draft.weight_t}
              onChange={(e) => set("weight_t", e.target.value)} required />
          </Field>
          <Field label="Prioridad">
            <select className={input} value={draft.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
              {(Object.keys(PRIORITIES) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITIES[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha y hora de salida">
            <input type="datetime-local" className={cn(input, "tabular")} value={draft.departure_at}
              onChange={(e) => set("departure_at", e.target.value)} required />
          </Field>
          <Field label="Retraso operativo (h)">
            <input className={cn(input, "tabular")} inputMode="decimal" value={draft.delay_h}
              onChange={(e) => set("delay_h", e.target.value)} />
          </Field>
        </div>

        <div>
          <span className="mb-1.5 block text-xs text-muted-foreground">
            Forzar modos (opcional): la ruta solo usará los modos marcados
          </span>
          <div className="flex flex-wrap gap-1.5">
            {MODE_ORDER.map((m) => {
              const on = draft.forced_modes.includes(m);
              const { icon: Icon, color, label } = MODES[m];
              return (
                <button key={m} type="button" onClick={() => toggleMode(m)} aria-pressed={on}
                  className={cn("flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
                    on ? "text-foreground" : "border-white/[0.06] text-muted-foreground hover:text-foreground")}
                  style={on ? { borderColor: `${color}66`, backgroundColor: `${color}1a` } : undefined}>
                  <Icon className="size-3.5" style={{ color }} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs text-muted-foreground">
            Forzar vías (opcional, máximo {MAX_CORRIDORS}): la ruta pasará por cada una
          </span>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {draft.forced_corridors.map((c) => (
              <button key={c} type="button" onClick={() => toggleCorridor(c)}
                className="flex items-center gap-1 rounded-full border border-neon-cyan/25 bg-neon-cyan/10 px-2.5 py-0.5 text-xs text-neon-cyan">
                {c} <X className="size-3" />
              </button>
            ))}
          </div>
          {draft.forced_corridors.length < MAX_CORRIDORS && (
            <div className="relative">
              <input className={input} value={corridorQuery} onChange={(e) => setCorridorQuery(e.target.value)}
                placeholder="Buscar vía (ej. Río Magdalena, Ruta del Sol)" aria-label="Buscar vía para forzar" />
              {corridorQuery && (
                <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border-strong bg-[#0b0f19] py-1 shadow-xl">
                  {corridorOptions.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">Sin coincidencias entre las vías activas</li>}
                  {corridorOptions.map((c) => (
                    <li key={c.corridor}>
                      <button type="button" onClick={() => { toggleCorridor(c.corridor); setCorridorQuery(""); }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-white/[0.05]">
                        {c.modes.map((m) => <ModeIcon key={m} mode={m} className="size-5" />)}
                        {c.corridor}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {error && <p className="rounded-md border border-neon-rose/25 bg-neon-rose/10 px-3 py-2 text-sm text-neon-rose">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={!!busy}>
            {busy === "save" ? <LoaderCircle className="animate-spin" /> : <Save />}
            {shipment ? "Guardar cambios" : "Crear envío"}
          </Button>
          <Button type="button" variant="secondary" disabled={!!busy} onClick={runPreview}>
            {busy === "preview" ? <LoaderCircle className="animate-spin" /> : <Route />}
            Calcular ruta
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link href={shipment ? `/envios/${shipment.code}` : "/envios"}>Cancelar</Link>
          </Button>
          <span className="text-xs text-muted-foreground">
            Firmará: <span className="text-foreground">{operator || "anónimo"}</span>
          </span>
        </div>
        {shipment && shipment.status !== "Programado" && (
          <p className="text-xs text-neon-amber">
            Este envío ya salió. Al guardar, la ruta se recalcula completa desde el origen con los datos nuevos.
          </p>
        )}
      </div>

      <aside className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Ruta calculada</h2>
        {!preview ? (
          <p className="mt-3 text-xs text-muted-foreground">
            La ruta se calcula sola al guardar. Usa «Calcular ruta» para verla antes, con las vías cerradas ya excluidas.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            <ModeChain modes={preview.modes} />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric icon={<Clock />} label="Tiempo" value={preview.time_fmt} />
              <Metric icon={<CircleDollarSign />} label="Costo" value={money(preview.cost)} />
              <Metric icon={<Route />} label="Distancia" value={preview.distance_fmt} />
              <Metric icon={<ArrowRightLeft />} label="Transbordos" value={String(preview.n_transfers)} />
            </div>
            <ol className="flex flex-col gap-1.5">
              {preview.legs.map((l, i) => (
                <li key={i} className="flex gap-2 rounded-md border border-white/[0.05] bg-white/[0.02] p-2.5 text-xs">
                  <ModeIcon mode={l.mode} />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{l.from.name} → {l.to.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{l.corridors.join(" · ")}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </aside>
    </form>
  );
}

/** Etiqueta asociada por id (no envuelve el control: un <select> envuelto
 * sumaría todas sus opciones al nombre accesible). */
function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-muted-foreground">
        {label}
      </label>
      {cloneElement(children, { id })}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.05] bg-white/[0.02] p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground [&_svg]:size-3">
        {icon}
        {label}
      </div>
      <div className="tabular mt-0.5 font-semibold">{value}</div>
    </div>
  );
}
