"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  FileText,
  Scale, ArrowDownUp, ArrowRightLeft, Check, ChevronDown, Clock, Maximize2, Minimize2, Pause, Play, Rows3, CircleDollarSign, Cloud, Fuel, Layers, ListFilter, LoaderCircle, Map as MapIcon, PackagePlus, Radio, Route, Weight, X } from "lucide-react";

import { CityCombobox } from "./city-combobox";
import { CategoryFilter, CityDirectory, CityInspector } from "./city-explorer";
import { Map3DLazy, MapLoading } from "./map-3d-lazy";
import { MapFrame } from "./map-frame";
import { MapLegend } from "./map-legend";
import { useMapAnimation } from "./use-map-animation";
import { useMapData } from "./use-map-data";
import { ModeChain, ModeIcon } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { BurstLink } from "@/components/ui/burst-link";
import { Sheet } from "@/components/ui/sheet";
import { Dial } from "@/components/ui/dial";
import { Money } from "@/components/money";
import { MODE_ORDER, MODES, PRIORITIES, tint } from "@/lib/modes";
import { T_FAST, T_VIEW } from "@/lib/motion";
import type { CityCategory, CityOption, Footprint, Mode, Priority, SimulateResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const spring = T_FAST;
const ALL_CATEGORIES: CityCategory[] = ["principal", "municipio", "dificil_acceso"];

const asPriority = (v: string | null): Priority => (v === "tiempo" || v === "costo" || v === "balanceado" ? v : "balanceado");

export function NetworkExplorer() {
  const params = useSearchParams();
  const { network, departments, fleet, error } = useMapData();
  const [cities, setCities] = useState<CityOption[]>([]);
  const [origin, setOrigin] = useState(params.get("origen") ?? "Leticia");
  const [destination, setDestination] = useState(params.get("destino") ?? "Cartagena");
  const [priority, setPriority] = useState<Priority>(asPriority(params.get("prioridad")));
  const [weight, setWeight] = useState(params.get("peso") ?? "5");
  const [result, setResult] = useState<SimulateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [modes, setModes] = useState<Set<Mode>>(() => {
    const wanted = (params.get("modos") ?? "").split(",").filter((m): m is Mode => (MODE_ORDER as string[]).includes(m));
    return new Set(wanted.length ? wanted : MODE_ORDER);
  });
  const [showDepartments, setShowDepartments] = useState(true);
  const [showFleet, setShowFleet] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [categories, setCategories] = useState<Set<CityCategory>>(new Set(ALL_CATEGORIES));
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [inspect, setInspect] = useState<string | null>(params.get("ciudad"));
  const [focusCity, setFocusCity] = useState<string | null>(params.get("ciudad"));
  // En pantallas estrechas el panel arranca plegado para dejar ver el mapa; desde md siempre está abierto
  const [expanded, setExpanded] = useState(false);
  // Vista: mapa visible u oculto (solo datos) y simulador mostrado u oculto
  const [showMap, setShowMap] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  // Pantalla completa dentro de la página (funciona también en iPhone)
  const [mapFull, setMapFull] = useState(false);
  const [panelFull, setPanelFull] = useState(false);
  const exitMapFull = useCallback(() => setMapFull(false), []);
  // Mientras la persona interactúa (toca, arrastra, escribe o usa la rueda) el mapa deja de animarse,
  // así el navegador atiende primero sus clics. Se reanuda 1,5 s después de la última interacción.
  const [interacting, setInteracting] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markInteraction = useCallback(() => {
    setInteracting(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setInteracting(false), 1500);
  }, []);
  useEffect(() => () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, []);

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d: { cities: CityOption[] }) => setCities(d.cities))
      .catch(() => undefined);
  }, []);

  async function simulate(p: Priority = priority): Promise<SimulateResponse | null> {
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
        return null;
      }
      setResult(data as SimulateResponse);
      setExpanded(true);
      return data as SimulateResponse;
    } catch {
      setSimError("No se pudo contactar la API");
      return null;
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
  const selectable = useMemo(
    () => cities.filter((c) => categories.has(c.category) || c.city === origin || c.city === destination),
    [cities, categories, origin, destination],
  );
  const visibleCities = useMemo(
    () => (categories.size === ALL_CATEGORIES.length ? null : new Set(cities.filter((c) => categories.has(c.category)).map((c) => c.city))),
    [cities, categories],
  );
  const inspected = cities.find((c) => c.city === inspect) ?? null;

  const pickCity = (city: string) => {
    setDirectoryOpen(false);
    setFocusCity(city);
    setInspect(city);
  };

  return (
    <div
      className="relative h-[calc(100dvh-6rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full overflow-hidden md:-mt-20 md:h-dvh"
      onKeyDownCapture={markInteraction}
      onChangeCapture={markInteraction}
    >
      <MapFrame full={mapFull} onExit={exitMapFull} className={cn("absolute inset-0", !showMap && "hidden")}>
        {network && departments ? (
          <Map3DLazy
            network={network}
            departments={departments}
            fleet={fleet}
            route={route}
            visibleModes={modes}
            showDepartments={showDepartments}
            showFleet={showFleet}
            visibleCities={visibleCities}
            selectedCities={[origin, destination]}
            focusCity={focusCity}
            onCityClick={pickCity}
            paused={interacting}
            live={mapFull}
            insets={{ top: 150, left: panelOpen && !panelFull ? 424 : 0, bottom: 64 }}
          />
        ) : (
          <MapLoading label={error ?? undefined} />
        )}
      </MapFrame>

      {/* Encabezado */}
      <div onPointerDownCapture={markInteraction} className="pointer-events-none absolute top-0 right-0 left-0 z-20 flex flex-wrap items-start justify-between gap-3 p-3 md:gap-4 md:p-6 md:pt-[6.5rem]">
        <h1 className="glass-float pointer-events-auto rounded-2xl px-4 py-2 text-xl font-bold">Red multimodal</h1>
        <div className="pointer-events-auto flex w-full flex-wrap items-center gap-2 md:w-auto">
          <ViewToggle showMap={showMap} setShowMap={setShowMap} />
          {showMap && (
            <Button
              variant="secondary"
              size="icon"
              aria-label="Mapa a pantalla completa"
              title="Pantalla completa"
              onClick={() => setMapFull(true)}
            >
              <Maximize2 />
            </Button>
          )}
          {showMap && (
            <div className="hidden md:block">
              <LayerPanel
                modes={modes}
                toggleMode={toggleMode}
                showDepartments={showDepartments}
                setShowDepartments={setShowDepartments}
                showFleet={showFleet}
                setShowFleet={setShowFleet}
                fleetCount={fleet?.count ?? 0}
              />
            </div>
          )}
          {showMap && (
            <Button variant="secondary" className="md:hidden" onClick={() => setLayersOpen(true)} aria-haspopup="dialog">
              <Layers />
              Capas
              {modes.size < MODE_ORDER.length && (
                <span className="tabular rounded-full bg-primary/15 px-1.5 text-xs text-primary">{modes.size}/{MODE_ORDER.length}</span>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Simulador */}
      {panelOpen ? (
      <motion.aside
        onPointerDownCapture={markInteraction}
        onWheelCapture={markInteraction}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={T_VIEW}
        className={cn(
          "z-10 flex flex-col overflow-hidden",
          // Pantalla completa: ocupa toda la ventana (también sobre el dock) y en escritorio se parte en dos
          // columnas, formulario a la izquierda y resultados a la derecha, cada una con su desplazamiento.
          // Las clases de panel flotante no se mezclan con estas: antes el panel quedaba 176 px abajo y se
          // salía 24 px por la derecha.
          panelFull
            ? "fixed inset-0 z-[65] bg-card pb-[env(safe-area-inset-bottom)] md:flex-row"
            : cn(
                "glass-float absolute rounded-3xl",
                showMap
                  ? "inset-x-3 bottom-3 max-h-[62%] md:inset-x-auto md:top-44 md:bottom-6 md:left-6 md:max-h-none md:w-[400px]"
                  : "inset-x-3 top-36 bottom-3 md:inset-x-auto md:top-44 md:bottom-6 md:left-1/2 md:w-[min(960px,calc(100%-3rem))] md:-translate-x-1/2",
              ),
        )}
      >
        <div
          className={cn(
            "shrink-0 border-b border-border p-4 md:p-5",
            panelFull && "max-h-[55%] overflow-y-auto md:max-h-none md:w-[420px] md:border-r md:border-b-0 md:p-6 lg:w-[460px]",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[0.9375rem] font-semibold">
              <Route className="size-4 text-primary" aria-hidden /> Simulador de rutas
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setDirectoryOpen(true)} aria-label="Ciudades">
                <ListFilter /> <span className="hidden sm:inline">Ciudades</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={panelFull ? "Salir de pantalla completa" : "Simulador a pantalla completa"}
                title={panelFull ? "Salir de pantalla completa" : "Pantalla completa"}
                onClick={() => setPanelFull((v) => !v)}
              >
                {panelFull ? <Minimize2 /> : <Maximize2 />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Ocultar simulador"
                title="Ocultar simulador"
                onClick={() => {
                  setPanelFull(false);
                  setPanelOpen(false);
                }}
              >
                <X />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={expanded ? "Plegar el simulador" : "Abrir el simulador"}
                aria-expanded={expanded}
                onClick={() => setExpanded((o) => !o)}
              >
                <ChevronDown className={cn("transition-transform duration-300 ease-apple", expanded && "rotate-180")} />
              </Button>
            </div>
          </div>
          <div className={cn("mt-3", !expanded && "hidden md:block")}>
            <CategoryFilter cities={cities} value={categories} onChange={setCategories} />
          </div>
          <div className={cn("mt-3 grid grid-cols-[1fr_auto] items-end gap-2", !expanded && "hidden md:grid")}>
            <div className="flex flex-col gap-2">
              <CityCombobox label="Origen" value={origin} onChange={setOrigin} cities={selectable} />
              <CityCombobox label="Destino" value={destination} onChange={setDestination} cities={selectable} />
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

          <div className={cn("mt-3 grid grid-cols-[1fr_96px] gap-2", !expanded && "hidden md:grid")}>
            <div>
              <span className="mb-1 block text-xs text-muted-foreground">Prioridad</span>
              <LayoutGroup id="priority">
                <div className="flex rounded-xl bg-fill p-0.5" role="radiogroup" aria-label="Prioridad">
                  {(Object.keys(PRIORITIES) as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={priority === p}
                      onClick={() => setPriority(p)}
                      className={cn(
                        "press relative h-8 flex-1 rounded-[10px] text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80 pointer-coarse:h-10",
                        priority === p ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {priority === p && (
                        <motion.span layoutId="priority-pill" transition={spring} className="absolute inset-0 rounded-[10px] bg-card shadow-sm" />
                      )}
                      <span className="relative">{PRIORITIES[p]}</span>
                    </button>
                  ))}
                </div>
              </LayoutGroup>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Peso (t)</span>
              <span className="relative flex">
                <Weight className="pointer-events-none absolute top-2.5 left-2 size-3.5 text-muted-foreground pointer-coarse:top-3.5" />
                <input
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="tabular h-9 w-full rounded-xl bg-fill pr-2 pl-7 text-sm outline-none focus:ring-[3px] focus:ring-ring/80 pointer-coarse:h-11"
                />
              </span>
            </label>
          </div>

          <Button className={cn("mt-4 w-full", !expanded && "hidden md:inline-flex")} onClick={() => simulate()} disabled={loading}>
            {loading ? <LoaderCircle className="animate-spin" /> : <Route />}
            Simular ruta
          </Button>
          {simError && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {simError}
            </p>
          )}
        </div>

        <div className={cn("@container min-w-0 flex-1 overflow-y-auto", !expanded && "hidden md:block", panelFull && "md:bg-background")}>
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
                <MapIcon className="size-6 text-muted-foreground/50" aria-hidden />
                Elige origen, destino y prioridad. El motor calcula la combinación óptima de carretera, río, mar, aire y ferrocarril,
                con sus transbordos, costo, combustible y huella de CO₂e, y la anima sobre el mapa.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>
      ) : (
        <Button
          variant="secondary"
          className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-10 shadow-xl md:top-24 md:bottom-auto md:left-6"
          onClick={() => setPanelOpen(true)}
        >
          <Route />
          Mostrar simulador
        </Button>
      )}

      {showMap && (
        <div className="glass-float pointer-events-none absolute right-6 bottom-6 hidden rounded-2xl px-4 py-3 md:block">
          <MapLegend />
        </div>
      )}

      <Sheet open={layersOpen} onClose={() => setLayersOpen(false)} title="Capas del mapa" description="Qué modos y qué capas se dibujan">
        <LayerList
          modes={modes}
          toggleMode={toggleMode}
          showDepartments={showDepartments}
          setShowDepartments={setShowDepartments}
          showFleet={showFleet}
          setShowFleet={setShowFleet}
          fleetCount={fleet?.count ?? 0}
        />
      </Sheet>

      <CityDirectory
        open={directoryOpen}
        onClose={() => setDirectoryOpen(false)}
        cities={cities}
        categories={categories}
        onCategories={setCategories}
        onPick={pickCity}
      />
      <CityInspector
        city={inspected}
        onClose={() => setInspect(null)}
        onOrigin={(c) => {
          setOrigin(c);
          setInspect(null);
        }}
        onDestination={(c) => {
          setDestination(c);
          setInspect(null);
        }}
      />
    </div>
  );
}

function ViewToggle({ showMap, setShowMap }: { showMap: boolean; setShowMap: (v: boolean) => void }) {
  return (
    <div className="glass-float flex items-center gap-0.5 rounded-2xl p-1" role="group" aria-label="Vista">
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
            "press flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80 pointer-coarse:h-11 [&_svg]:size-3.5",
            showMap === v.key ? "bg-fill text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v.icon}
          {v.label}
        </button>
      ))}
    </div>
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
  const fp = data.footprint;
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
      transition={T_VIEW}
      className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-5 @3xl:gap-6 @3xl:p-8"
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

      <BurstLink
          href={`/envios/nuevo?origin=${encodeURIComponent(r.origin)}&destination=${encodeURIComponent(r.destination)}&priority=${r.priority}&weight=${r.weight_t}`}
        >
          <PackagePlus /> Crear envío con esta ruta
      </BurstLink>
      <div className="-mt-2 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/cotizacion?origen=${encodeURIComponent(r.origin)}&destino=${encodeURIComponent(r.destination)}&peso=${r.weight_t}&prioridad=${r.priority}`}>
            <FileText /> Cotizar
          </Link>
        </Button>
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/comparar?origen=${encodeURIComponent(r.origin)}&destino=${encodeURIComponent(r.destination)}&peso=${r.weight_t}`}>
            <Scale /> Comparar escenarios
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 @xl:grid-cols-3 @4xl:grid-cols-6">
        <Metric icon={<Clock />} label="Tiempo total" value={r.time_fmt} />
        <Metric icon={<CircleDollarSign />} label="Costo total" value={<Money usd={r.cost} />} />
        <Metric icon={<Route />} label="Distancia" value={r.distance_fmt} />
        <Metric icon={<ArrowRightLeft />} label="Transbordos" value={String(r.n_transfers)} />
        <Metric icon={<Cloud />} label="CO₂e" value={fp.co2e_fmt} />
        <Metric icon={<Fuel />} label="Combustible" value={fp.fuel_fmt} />
      </div>

      <FootprintSummary fp={fp} />

      <ol className="relative flex flex-col gap-1">
        {steps.map((s, idx) =>
          s.kind === "leg" ? (
            <motion.li
              key={`leg-${s.i}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05, ...T_FAST }}
              className="flex gap-3 rounded-2xl bg-fill p-3"
            >
              <ModeIcon mode={r.legs[s.i].mode} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">
                  {r.legs[s.i].from.name} → {r.legs[s.i].to.name}
                </div>
                <div className="truncate text-xs text-muted-foreground">{r.legs[s.i].corridors.join(" · ")}</div>
                <div className="tabular mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/80">
                  <span>{r.legs[s.i].distance_fmt}</span>
                  <span>{r.legs[s.i].time_fmt}</span>
                  <Money usd={r.legs[s.i].cost} />
                  <span>{fp.per_leg[s.i].co2e_kg.toLocaleString("es-CO")} kg CO₂e</span>
                  <span>{fp.per_leg[s.i].fuel_l.toLocaleString("es-CO")} L</span>
                </div>
              </div>
            </motion.li>
          ) : (
            <motion.li
              key={`tr-${s.i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.05, ...T_FAST }}
              className="flex items-center gap-2 py-1 pl-3 text-sm text-warning"
            >
              <ArrowRightLeft className="size-3.5" aria-hidden />
              <span className="font-medium">{r.transfers[s.i].label}</span>
              <span className="truncate text-muted-foreground">
                {r.transfers[s.i].node.name} · {r.transfers[s.i].time_fmt} · <Money usd={r.transfers[s.i].cost} />
              </span>
            </motion.li>
          ),
        )}
      </ol>

      <div>
        <div className="mb-2 text-sm font-semibold">Alternativas</div>
        <div className="flex flex-col gap-1.5">
          {data.alternatives.map((a) => (
            <button
              key={a.priority}
              type="button"
              disabled={!a.found}
              onClick={() => onPick(a.priority)}
              className={cn(
                "press flex items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80 disabled:opacity-50",
                a.priority === r.priority ? "border-primary/40 bg-primary/10" : "border-border hover:bg-fill/60",
              )}
            >
              <span className="w-20 font-medium">{PRIORITIES[a.priority]}</span>
              {a.found && a.modes ? (
                <>
                  <ModeChain modes={a.modes} />
                  <span className="tabular ml-auto text-right text-foreground/80">
                    {a.time_fmt}
                    <span className="block text-muted-foreground">
                      <Money usd={a.cost ?? 0} />
                    </span>
                    <span className="block text-xs text-muted-foreground">{a.co2e_fmt} CO₂e</span>
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

/** Huella de la ruta: reducción frente a mover la carga por carretera y desglose por modo. */
function FootprintSummary({ fp }: { fp: Footprint }) {
  const less = fp.saved_vs_road_pct >= 0;
  return (
    <section aria-label="Huella de la ruta" className="flex items-center gap-4 rounded-2xl bg-fill p-3">
      <Dial
        value={Math.max(fp.saved_vs_road_pct, 0)}
        color={less ? "var(--sys-green)" : "var(--sys-orange)"}
        label="Reducción de CO₂e frente a mover la carga por carretera"
        size={92}
        stroke={9}
      />
      <div className="min-w-0 text-sm">
        <div className="font-semibold">
          {fp.saved_vs_road_pct === 0
            ? "Igual CO₂e que por carretera"
            : less
              ? `${fp.saved_vs_road_pct.toLocaleString("es-CO")} % menos CO₂e que por carretera`
              : `${Math.abs(fp.saved_vs_road_pct).toLocaleString("es-CO")} % más CO₂e que por carretera`}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Por carretera: {fp.baseline_co2e_kg.toLocaleString("es-CO")} kg CO₂e · {fp.baseline_fuel_l.toLocaleString("es-CO")} L
        </div>
        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          {fp.by_mode.map((m) => (
            <li key={m.mode} className="flex items-center gap-1 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: MODES[m.mode].color }} aria-hidden />
              {m.label} {m.co2e_kg.toLocaleString("es-CO")} kg
            </li>
          ))}
        </ul>
        <Link href="/huella" className="mt-1 inline-block text-xs text-primary hover:underline">
          Ver huella de toda la operación
        </Link>
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-fill/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3">
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
  const { animate, setAnimate } = useMapAnimation();
  return (
    <div className="glass-float pointer-events-auto flex flex-wrap items-center gap-1 rounded-2xl p-1">
      {MODE_ORDER.map((m) => {
        const { icon: Icon, color, label } = MODES[m];
        const on = modes.has(m);
        return (
          <motion.button
            key={m}
            type="button"
            onClick={() => toggleMode(m)}
            aria-pressed={on}
            title={label}
            aria-label={label}
            className={cn("flex size-8 items-center justify-center rounded-md outline-none press focus-visible:ring-[3px] focus-visible:ring-ring/80 pointer-coarse:size-11", !on && "opacity-50")}
            style={on ? { backgroundColor: tint(color, 14) } : undefined}
          >
            <Icon className="size-4" style={{ color }} />
          </motion.button>
        );
      })}
      <span className="mx-1 h-5 w-px bg-border-strong" />
      <ToggleChip on={showDepartments} onClick={() => setShowDepartments(!showDepartments)} icon={<Layers />} label="Departamentos" />
      <ToggleChip on={showFleet} onClick={() => setShowFleet(!showFleet)} icon={<Radio />} label={`Flota ${fleetCount}`} />
      <ToggleChip on={animate} onClick={() => setAnimate(!animate)} icon={animate ? <Pause /> : <Play />} label="Animación" />
    </div>
  );
}

/** Capas del mapa en lista vertical, con objetivos grandes: es el contenido de la hoja en celular. */
function LayerList({
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
  const { animate, setAnimate } = useMapAnimation();
  const row = (on: boolean) =>
    cn(
      "press flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[0.9375rem] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80",
      on ? "bg-fill text-foreground" : "text-muted-foreground",
    );
  const mark = (on: boolean) => (
    <span className={cn("ml-auto flex size-5 items-center justify-center rounded-full border ", on ? "border-transparent bg-solid text-primary-foreground" : "border-border-strong")} aria-hidden>
      {on && <Check className="size-3" />}
    </span>
  );
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="px-3 pb-1 text-xs font-semibold text-muted-foreground">Modos</h3>
        <div className="flex flex-col gap-1">
          {MODE_ORDER.map((m) => {
            const { icon: Icon, color, label } = MODES[m];
            const on = modes.has(m);
            return (
              <button key={m} type="button" aria-pressed={on} onClick={() => toggleMode(m)} className={row(on)}>
                <span className="flex size-8 items-center justify-center rounded-lg" style={{ backgroundColor: tint(color, 14) }}>
                  <Icon className="size-4" style={{ color }} aria-hidden />
                </span>
                {label}
                {mark(on)}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="px-3 pb-1 text-xs font-semibold text-muted-foreground">Capas</h3>
        <div className="flex flex-col gap-1">
          <button type="button" aria-pressed={showDepartments} onClick={() => setShowDepartments(!showDepartments)} className={row(showDepartments)}>
            <Layers className="size-5" aria-hidden />
            Departamentos
            {mark(showDepartments)}
          </button>
          <button type="button" aria-pressed={showFleet} onClick={() => setShowFleet(!showFleet)} className={row(showFleet)}>
            <Radio className="size-5" aria-hidden />
            Flota en vivo <span className="tabular text-xs text-muted-foreground">{fleetCount}</span>
            {mark(showFleet)}
          </button>
          <button type="button" aria-pressed={animate} onClick={() => setAnimate(!animate)} className={row(animate)}>
            {animate ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
            Animación del mapa
            {mark(animate)}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleChip({
  on,
  onClick,
  icon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm outline-none press focus-visible:ring-[3px] focus-visible:ring-ring/80 pointer-coarse:h-11 [&_svg]:size-3.5",
        on ? "bg-fill text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
