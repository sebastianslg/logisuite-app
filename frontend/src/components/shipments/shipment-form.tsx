"use client";

import { cloneElement, useEffect, useId, useMemo, useRef, useState, type ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRightLeft, Check, CircleDollarSign, Clock, Cloud, Fuel, Leaf, LoaderCircle, Route, Sparkles, X } from "lucide-react";

import { useApp } from "@/components/providers";
import { ModeChain, ModeIcon } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { SaveIcon, useSavedFlash } from "@/components/ui/save-icon";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { MODE_ORDER, MODES, PRIORITIES, tint } from "@/lib/modes";
import { EASE } from "@/lib/motion";
import type { CityOption, Corridor, Footprint, Mode, Priority, RouteResult, Shipment } from "@/lib/types";
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
const MAX_WEIGHT_T = 20000;

type Errors = Partial<Record<keyof ShipmentDraft, string>>;

const num = (v: string) => Number(v.trim().replace(",", "."));

/** Valida el borrador con mensajes en español (el navegador los daría en el idioma del sistema). */
function validate(d: ShipmentDraft): Errors {
  const e: Errors = {};
  if (!d.origin) e.origin = "Elige el origen.";
  if (!d.destination) e.destination = "Elige el destino.";
  else if (d.destination === d.origin) e.destination = "El destino debe ser distinto del origen.";
  if (!d.cargo.trim()) e.cargo = "Describe la carga, por ejemplo “Café excelso en sacos”.";
  if (!d.client.trim()) e.client = "Escribe el nombre del cliente.";
  const w = num(d.weight_t);
  if (!d.weight_t.trim() || !Number.isFinite(w)) e.weight_t = "Escribe el peso en toneladas, por ejemplo 12,5.";
  else if (w <= 0) e.weight_t = "El peso debe ser mayor que cero.";
  else if (w > MAX_WEIGHT_T) e.weight_t = `El peso máximo por envío es ${MAX_WEIGHT_T.toLocaleString("es-CO")} t.`;
  if (!d.departure_at) e.departure_at = "Elige la fecha y la hora de salida.";
  if (d.delay_h.trim() && (!Number.isFinite(num(d.delay_h)) || num(d.delay_h) < 0))
    e.delay_h = "El retraso son horas, cero o más.";
  return e;
}

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
  const [footprint, setFootprint] = useState<Footprint | null>(null);
  const [busy, setBusy] = useState<"preview" | "save" | null>(null);
  const [saved, flashSaved] = useSavedFlash();
  const [error, setError] = useState<string | null>(null);
  const [corridorQuery, setCorridorQuery] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    api<{ cities: CityOption[] }>("/api/locations").then((d) => setCities(d.cities)).catch(() => undefined);
    api<{ items: Corridor[] }>("/api/corridors").then((d) => setCorridors(d.items)).catch(() => undefined);
  }, []);

  const set = <K extends keyof ShipmentDraft>(k: K, v: ShipmentDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setErrors((er) => (er[k] ? { ...er, [k]: undefined } : er));
    setPreview(null);
    setFootprint(null);
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

  /** Marca los campos con error y lleva el foco al primero. Devuelve true si todo está bien. */
  function check(): boolean {
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) return true;
    setError(null);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
    return false;
  }

  async function runPreview() {
    if (!check()) return;
    setBusy("preview");
    setError(null);
    try {
      const res = await api<{ route: RouteResult; footprint: Footprint }>("/api/shipments/preview", { method: "POST", body: body() });
      setPreview(res.route);
      setFootprint(res.footprint);
    } catch (e) {
      setPreview(null);
      setFootprint(null);
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!check()) return;
    setBusy("save");
    setError(null);
    try {
      const saved = shipment
        ? await api<Shipment>(`/api/shipments/${encodeURIComponent(shipment.code)}`, { method: "PUT", body: body() })
        : await api<Shipment>("/api/shipments", { method: "POST", body: body() });
      flashSaved();
      toast({ title: shipment ? `Envío ${saved.code} guardado` : `Envío ${saved.code} creado` });
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
    "h-10 w-full field px-3 text-sm outline-none [&>option]:bg-card";

  return (
    <form ref={formRef} onSubmit={save} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-5 glass rounded-3xl p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Origen" error={errors.origin}>
            <select className={input} value={draft.origin} onChange={(e) => set("origin", e.target.value)}>
              {!cities.some((c) => c.city === draft.origin) && <option value={draft.origin}>{draft.origin}</option>}
              {cities.map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Destino" error={errors.destination}>
            <select className={input} value={draft.destination} onChange={(e) => set("destination", e.target.value)}>
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
          <Field label="Carga" error={errors.cargo}>
            <input className={input} value={draft.cargo} onChange={(e) => set("cargo", e.target.value)} maxLength={120}
              placeholder="Ej. Café excelso en sacos" />
          </Field>
          <Field label="Cliente" error={errors.client}>
            <input className={input} value={draft.client} onChange={(e) => set("client", e.target.value)} maxLength={120} />
          </Field>
          <Field label="Peso (t)" error={errors.weight_t}>
            <input className={cn(input, "tabular")} inputMode="decimal" value={draft.weight_t}
              onChange={(e) => set("weight_t", e.target.value)} />
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
          <Field label="Fecha y hora de salida" error={errors.departure_at}>
            <input type="datetime-local" className={cn(input, "tabular")} value={draft.departure_at}
              onChange={(e) => set("departure_at", e.target.value)} />
          </Field>
          <Field label="Retraso operativo (h)" error={errors.delay_h}>
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
                    on ? "text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                  style={on ? { borderColor: tint(color, 45), backgroundColor: tint(color, 12) } : undefined}>
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
                className="flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
                {c} <X className="size-3" />
              </button>
            ))}
          </div>
          {draft.forced_corridors.length < MAX_CORRIDORS && (
            <div className="relative">
              <input className={input} value={corridorQuery} onChange={(e) => setCorridorQuery(e.target.value)}
                placeholder="Buscar vía (ej. Río Magdalena, Ruta del Sol)" aria-label="Buscar vía para forzar" />
              <AnimatePresence>
              {corridorQuery && (
                <motion.ul
                  initial={{ opacity: 0, scale: 0.96, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: EASE } }}
                  exit={{ opacity: 0, scale: 0.96, y: -6, transition: { duration: 0.15, ease: EASE } }}
                  style={{ transformOrigin: "top center" }}
                  className="floating absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl py-1"
                >
                  {corridorOptions.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">Sin coincidencias entre las vías activas</li>}
                  {corridorOptions.map((c) => (
                    <li key={c.corridor}>
                      <button type="button" onClick={() => { toggleCorridor(c.corridor); setCorridorQuery(""); }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-fill">
                        {c.modes.map((m) => <ModeIcon key={m} mode={m} className="size-5" />)}
                        {c.corridor}
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {error && <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={!!busy} burst={shipment ? Check : Sparkles}>
            <SaveIcon state={saved ? "done" : busy === "save" ? "busy" : "idle"} />
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
          <p className="text-xs text-warning">
            Este envío ya salió. Al guardar, la ruta se recalcula completa desde el origen con los datos nuevos.
          </p>
        )}
      </div>

      <aside className="glass rounded-3xl p-5">
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
              {footprint && <Metric icon={<Cloud />} label="CO₂e" value={footprint.co2e_fmt} />}
              {footprint && <Metric icon={<Fuel />} label="Combustible" value={footprint.fuel_fmt} />}
              {footprint && (
                <Metric
                  icon={<Leaf />}
                  label="Frente a carretera"
                  value={footprint.saved_vs_road_pct === 0 ? "Igual" : `${footprint.saved_vs_road_pct > 0 ? "−" : "+"}${Math.abs(footprint.saved_vs_road_pct).toLocaleString("es-CO")} % CO₂e`}
                />
              )}
            </div>
            <ol className="flex flex-col gap-1.5">
              {preview.legs.map((l, i) => (
                <li key={i} className="flex gap-2 rounded-xl bg-fill/60 p-2.5 text-xs">
                  <ModeIcon mode={l.mode} />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{l.from.name} → {l.to.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{l.corridors.join(" · ")}</div>
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
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-muted-foreground">
        {label}
      </label>
      {cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? `${id}-error` : undefined,
      })}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-fill/60 p-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3">
        {icon}
        {label}
      </div>
      <div className="tabular mt-0.5 font-semibold">{value}</div>
    </div>
  );
}
