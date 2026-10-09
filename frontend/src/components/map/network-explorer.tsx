"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  ArrowDownUp,
  ArrowRightLeft,
  ChevronDown,
  Rows3,
  Clock,
  CircleDollarSign,
  Layers,
  LoaderCircle,
  Map as MapIcon,
  PackagePlus,
  Radio,
  Route,
  Waypoints,
  Weight,
  X,
} from "lucide-react";

import { Map3DLazy, MapLoading } from "./map-3d-lazy";
import { MapLegend } from "./map-legend";
import { useMapData } from "./use-map-data";
import { useApp } from "@/components/providers";
import { ModeChain, ModeIcon } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { MODE_ORDER, MODES, PRIORITIES } from "@/lib/modes";
import type { CityOption, Mode, Priority, SimulateResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const spring = { type: "spring", stiffness: 420, damping: 34 } as const;

export function NetworkExplorer() {
  const { network, departments, fleet, error } = useMapData();
  const [cities, setCities] = useState<CityOption[]>([]);
  const [origin, setOrigin] = useState("Leticia");
  const [destination, setDestination] = useState("Cartagena");
  const [priority, setPriority] = useState<Priority>("balanceado");
  const [weight, setWeight] = useState("5");
  const [result, setResult] = useState<SimulateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [modes, setModes] = useState<Set<Mode>>(new Set(MODE_ORDER));
  const [showDepartments, setShowDepartments] = useState(true);
  const [showFleet, setShowFleet] = useState(true);
  // Vista: mapa visible u ocultos (solo datos) y panel del simulador abierto o plegado
  const [showMap, setShowMap] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d: { cities: CityOption[] }) => setCities(d.cities))
      .catch(() => undefined);
  }, []);

  async function simulate(p: Priority = priority) {
    setLoading(true);
    setSimError(null);
    try {
      const res = await fetch("/api/routes/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          origen: origin,
          destino: destination,
          prioridad: p,
          peso_t: Number(weight.replace(",", ".")) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSimError(typeof data.detail === "string" ? data.detail : "Datos inválidos");
        setResult(null);
      } else {
        setResult(data as SimulateResponse);
      }
    } catch {
      setSimError("No se pudo contactar la API");
    } finally {
      setLoading(false);
    }
  }

  const toggleMode = (m: Mode) =>
    setModes((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });

  const route = result?.route ?? null;

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div className={cn("absolute inset-0", !showMap && "hidden")}>
        {network && departments ? (
          <Map3DLazy
            network={network}
            departments={departments}
            fleet={fleet}
            route={route}
            visibleModes={modes}
            showDepartments={showDepartments}
            showFleet={showFleet}
          />
        ) : (
          <MapLoading label={error ?? undefined} />
        )}
      </div>

      {/* Encabezado */}
      <div className="pointer-events-none absolute top-14 right-0 left-0 z-20 flex flex-wrap items-start justify-between gap-3 p-3 md:top-0 md:gap-4 md:p-6">
        <div className="pointer-events-auto">
          <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.14em] text-neon-cyan uppercase">
            <Waypoints className="size-3.5" /> GIS 3D · Red multimodal
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Colombia en movimiento</h1>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <ViewToggle showMap={showMap} setShowMap={setShowMap} />
          {showMap && (
            <LayerPanel
              modes={modes}
              toggleMode={toggleMode}
              showDepartments={showDepartments}
              setShowDepartments={setShowDepartments}
              showFleet={showFleet}
              setShowFleet={setShowFleet}
              fleetCount={fleet?.count ?? 0}
            />
          )}
        </div>
      </div>

      {/* Simulador: panel flotante (mapa), hoja inferior (celular) o pantalla completa (solo datos) */}
      {panelOpen ? (
      <motion.aside
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "absolute z-10 flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b0f19]/90 shadow-2xl shadow-black/50 backdrop-blur-xl",
          showMap
            ? "inset-x-2 bottom-2 max-h-[52vh] md:inset-x-auto md:top-28 md:bottom-6 md:left-6 md:max-h-none md:w-[380px] md:bg-[#0b0f19]/75"
            : "inset-x-2 top-48 bottom-2 md:inset-x-auto md:top-28 md:bottom-6 md:left-1/2 md:w-[min(960px,calc(100%-3rem))] md:-translate-x-1/2 md:bg-[#0b0f19]/85",
        )}
      >
        <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Route className="size-4 text-neon-cyan" /> Simulador de rutas multimodales
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="-mt-1 -mr-2 size-8 shrink-0"
            aria-label="Ocultar simulador"
            title="Ocultar simulador"
            onClick={() => setPanelOpen(false)}
          >
            <ChevronDown />
          </Button>
        </div>
        <div className="border-b border-white/[0.06] p-5">
          <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-2">
            <div className="flex flex-col gap-2">
              <CitySelect label="Origen" value={origin} onChange={setOrigin} cities={cities} />
              <CitySelect label="Destino" value={destination} onChange={setDestination} cities={cities} />
            </div>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Invertir origen y destino"
              className="mb-0.5"
              onClick={() => {
                setOrigin(destination);
                setDestination(origin);
              }}
            >
              <ArrowDownUp />
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-[1fr_96px] gap-2">
            <div>
              <span className="mb-1 block text-[11px] text-muted-foreground">Prioridad</span>
              <LayoutGroup id="priority">
                <div className="flex rounded-md border border-white/[0.06] bg-white/[0.02] p-0.5" role="radiogroup">
                  {(Object.keys(PRIORITIES) as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={priority === p}
                      onClick={() => setPriority(p)}
                      className={cn(
                        "relative h-7 flex-1 rounded text-xs transition-colors",
                        priority === p ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {priority === p && (
                        <motion.span
                          layoutId="priority-pill"
                          transition={spring}
                          className="absolute inset-0 rounded border border-neon-cyan/25 bg-neon-cyan/10"
                        />
                      )}
                      <span className="relative">{PRIORITIES[p]}</span>
                    </button>
                  ))}
                </div>
              </LayoutGroup>
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">Peso (t)</span>
              <span className="relative flex">
                <Weight className="pointer-events-none absolute top-2 left-2 size-3.5 text-muted-foreground" />
                <input
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="tabular h-8 w-full rounded-md border border-input bg-white/[0.02] pr-2 pl-7 text-sm outline-none focus:border-neon-cyan/40"
                />
              </span>
            </label>
          </div>

          <Button className="mt-4 w-full" onClick={() => simulate()} disabled={loading}>
            {loading ? <LoaderCircle className="animate-spin" /> : <Route />}
            Simular ruta
          </Button>
          {simError && <p className="mt-2 text-xs text-neon-rose">{simError}</p>}
        </div>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {result ? (
              <RouteResultView
                key={`${result.route.origin}-${result.route.destination}-${result.route.priority}-${result.route.weight_t}`}
                data={result}
                onPick={(p) => {
                  setPriority(p);
                  simulate(p);
                }}
                onClear={() => setResult(null)}
              />
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 px-8 py-10 text-center text-xs text-muted-foreground"
              >
                <MapIcon className="size-6 text-white/20" />
                Elige origen, destino y prioridad. El motor calcula la combinación óptima de carretera,
                río, mar, aire y ferrocarril, con sus transbordos, y la anima sobre el mapa.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>
      ) : (
        <Button
          variant="secondary"
          className="absolute bottom-3 left-3 z-10 shadow-xl md:top-28 md:bottom-auto md:left-6"
          onClick={() => setPanelOpen(true)}
        >
          <Route />
          Mostrar simulador
        </Button>
      )}

      {showMap && (
        <div className="pointer-events-none absolute right-6 bottom-6 hidden rounded-lg border border-white/[0.06] bg-[#0b0f19]/70 px-4 py-3 backdrop-blur-md md:block">
          <MapLegend />
        </div>
      )}
    </div>
  );
}

/** Mapa visible u oculto (solo datos). En celular la leyenda queda fuera. */
function ViewToggle({ showMap, setShowMap }: { showMap: boolean; setShowMap: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-[#0b0f19]/75 p-1 backdrop-blur-xl" role="group" aria-label="Vista">
      {[
        { key: true, label: "Mapa", icon: <MapIcon className="size-3.5" /> },
        { key: false, label: "Datos", icon: <Rows3 className="size-3.5" /> },
      ].map((v) => (
        <button
          key={v.label}
          type="button"
          onClick={() => setShowMap(v.key)}
          aria-pressed={showMap === v.key}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors [&_svg]:size-3.5",
            showMap === v.key ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v.icon}
          {v.label}
        </button>
      ))}
    </div>
  );
}

function CitySelect({
  label,
  value,
  onChange,
  cities,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  cities: CityOption[];
}) {
  const current = cities.find((c) => c.city === value);
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      <span className="relative flex items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full appearance-none rounded-md border border-input bg-white/[0.02] pr-20 pl-3 text-sm outline-none focus:border-neon-cyan/40 [&>option]:bg-[#0b0f19]"
        >
          {cities.length === 0 && <option value={value}>{value}</option>}
          {cities.map((c) => (
            <option key={c.city} value={c.city}>
              {c.city}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-8 flex gap-0.5">
          {current?.modes.map((m) => {
            const Icon = MODES[m].icon;
            return <Icon key={m} className="size-3" style={{ color: MODES[m].color }} />;
          })}
        </span>
        <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-muted-foreground" />
      </span>
    </label>
  );
}

function RouteResultView({
  data,
  onPick,
  onClear,
}: {
  data: SimulateResponse;
  onPick: (p: Priority) => void;
  onClear: () => void;
}) {
  const r = data.route;
  const { money } = useApp();
  // Línea de tiempo: tramos intercalados con sus transbordos
  const steps: ({ kind: "leg"; i: number } | { kind: "transfer"; i: number })[] = [];
  r.legs.forEach((_, i) => {
    steps.push({ kind: "leg", i });
    if (r.transfers[i]) steps.push({ kind: "transfer", i });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-5 p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">
            {r.origin} <span className="text-muted-foreground">→</span> {r.destination}
          </div>
          <div className="mt-1.5">
            <ModeChain modes={r.modes} />
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Quitar ruta" onClick={onClear}>
          <X />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric icon={<Clock />} label="Tiempo total" value={r.time_fmt} />
        <Metric icon={<CircleDollarSign />} label="Costo total" value={money(r.cost)} />
        <Metric icon={<Route />} label="Distancia" value={r.distance_fmt} />
        <Metric icon={<ArrowRightLeft />} label="Transbordos" value={String(r.n_transfers)} />
      </div>

      <ol className="relative flex flex-col gap-1">
        {steps.map((s, idx) =>
          s.kind === "leg" ? (
            <motion.li
              key={`leg-${s.i}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.06 }}
              className="flex gap-3 rounded-md border border-white/[0.05] bg-white/[0.02] p-3"
            >
              <ModeIcon mode={r.legs[s.i].mode} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">
                  {r.legs[s.i].from.name} → {r.legs[s.i].to.name}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {r.legs[s.i].corridors.join(" · ")}
                </div>
                <div className="tabular mt-1.5 flex gap-3 text-[11px] text-slate-300">
                  <span>{r.legs[s.i].distance_fmt}</span>
                  <span>{r.legs[s.i].time_fmt}</span>
                  <span>{money(r.legs[s.i].cost)}</span>
                </div>
              </div>
            </motion.li>
          ) : (
            <motion.li
              key={`tr-${s.i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.06 }}
              className="flex items-center gap-2 py-1 pl-3 text-[11px] text-neon-amber"
            >
              <ArrowRightLeft className="size-3.5" />
              <span className="font-medium">{r.transfers[s.i].label}</span>
              <span className="truncate text-muted-foreground">
                {r.transfers[s.i].node.name} · {r.transfers[s.i].time_fmt} · {money(r.transfers[s.i].cost)}
              </span>
            </motion.li>
          ),
        )}
      </ol>

      <Button variant="secondary" size="sm" asChild>
        <Link
          href={`/envios/nuevo?${new URLSearchParams({
            origin: r.origin,
            destination: r.destination,
            priority: r.priority,
            weight: String(r.weight_t),
          })}`}
        >
          <PackagePlus />
          Crear envío con esta ruta
        </Link>
      </Button>

      <div>
        <div className="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          Alternativas
        </div>
        <div className="flex flex-col gap-1.5">
          {data.alternatives.map((a) => (
            <button
              key={a.priority}
              type="button"
              disabled={!a.found}
              onClick={() => onPick(a.priority)}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-2 text-left text-xs transition-colors",
                a.priority === r.priority
                  ? "border-neon-cyan/30 bg-neon-cyan/[0.06]"
                  : "border-white/[0.05] hover:border-white/15",
              )}
            >
              <span className="w-20 font-medium">{PRIORITIES[a.priority]}</span>
              {a.found && a.modes ? (
                <>
                  <ModeChain modes={a.modes} />
                  <span className="tabular ml-auto text-right text-slate-300">
                    {a.time_fmt}
                    <span className="block text-muted-foreground">{money(a.cost)}</span>
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Sin ruta</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.05] bg-white/[0.02] p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground [&_svg]:size-3">
        {icon}
        {label}
      </div>
      <div className="tabular mt-1 text-base font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function LayerPanel({
  modes,
  toggleMode,
  showDepartments,
  setShowDepartments,
  showFleet,
  setShowFleet,
  fleetCount,
}: {
  modes: Set<Mode>;
  toggleMode: (m: Mode) => void;
  showDepartments: boolean;
  setShowDepartments: (v: boolean) => void;
  showFleet: boolean;
  setShowFleet: (v: boolean) => void;
  fleetCount: number;
}) {
  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-white/[0.08] bg-[#0b0f19]/75 p-1 backdrop-blur-xl">
      {MODE_ORDER.map((m) => {
        const { icon: Icon, color, label } = MODES[m];
        const on = modes.has(m);
        return (
          <motion.button
            key={m}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => toggleMode(m)}
            aria-pressed={on}
            title={label}
            className={cn("flex size-8 items-center justify-center rounded-md transition-colors", !on && "opacity-40")}
            style={on ? { backgroundColor: `${color}1f` } : undefined}
          >
            <Icon className="size-4" style={{ color }} />
          </motion.button>
        );
      })}
      <span className="mx-1 h-5 w-px bg-white/10" />
      <ToggleChip on={showDepartments} onClick={() => setShowDepartments(!showDepartments)} icon={<Layers />} label="Departamentos" short="Mapa" />
      <ToggleChip on={showFleet} onClick={() => setShowFleet(!showFleet)} icon={<Radio />} label={`Flota ${fleetCount}`} short={`${fleetCount}`} />
    </div>
  );
}

function ToggleChip({
  on,
  onClick,
  icon,
  label,
  short,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  /** Texto corto para celular */
  short?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors [&_svg]:size-3.5",
        on ? "bg-white/[0.07] text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {short ? (
        <>
          <span className="sm:hidden">{short}</span>
          <span className="hidden sm:inline">{label}</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}
