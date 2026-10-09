"use client";

/**
 * Map3D: cartografía 3D de la red multimodal de Colombia.
 *
 * deck.gl (WebGL) sobre un mapa base vectorial oscuro de MapLibre. Capas:
 *   - PolygonLayer: los 32 departamentos y Bogotá D.C. (DANE), extruidos
 *     según las toneladas que los atraviesan, con relleno al ~10 %.
 *   - PathLayer: carreteras (esmeralda, a ras de suelo), ríos y mar (azules)
 *     y ferrocarril (ámbar, punteado con PathStyleExtension).
 *   - ArcLayer: rutas aéreas, arcos altos de violeta a cian.
 *   - TripsLayer: partículas de luz de camiones, barcazas, buques, trenes y
 *     aviones moviéndose sobre su propio trazado.
 *   - ScatterplotLayer / TextLayer: nodos y activos, con tooltip HTML
 *     glassmorphism al pasar el cursor.
 *   - Ruta simulada: tramos resaltados, transbordos y su recorrido animado.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import {
  FlyToInterpolator,
  WebMercatorViewport,
  type MapViewState,
  type PickingInfo,
} from "@deck.gl/core";
import { ArcLayer, PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import { PathStyleExtension, type PathStyleExtensionProps } from "@deck.gl/extensions";
import { Map as BaseMap } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { boundsOf, flightArc, positionAt, splitTrip, type Position3, type TripSegment } from "./map/geometry";
import { useApp } from "@/components/providers";
import { MODES } from "@/lib/modes";
import type { DepartmentsGeo, FleetLive, LiveAsset, Mode, NetworkGeo, RouteResult } from "@/lib/types";
import { cn } from "@/lib/utils";

// Worker publicado por scripts/copy-maplibre-worker.mjs (ver allí el porqué)
setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE ??
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export const COLOMBIA_VIEW: MapViewState = {
  longitude: -74.2,
  latitude: 3.6,
  zoom: 4.6,
  pitch: 45,
  bearing: -10,
};

type RGBA = [number, number, number, number];
const rgba = (mode: Mode, a = 255): RGBA => [...MODES[mode].rgb, a];
const CYAN: RGBA = [34, 211, 238, 255];
const VIOLET: RGBA = [161, 115, 232, 255];
const AMBER: RGBA = [245, 158, 11, 255];
const ROSE: RGBA = [251, 113, 133, 255];

const NODE_STYLE: Record<string, { color: [number, number, number]; radius: number }> = {
  aeropuerto: { color: MODES.aereo.rgb, radius: 6 },
  puerto_maritimo: { color: MODES.maritimo.rgb, radius: 7 },
  puerto_fluvial: { color: MODES.fluvial.rgb, radius: 5.5 },
  terminal_ferrea: { color: [245, 158, 11], radius: 5.5 },
  cedi: { color: [34, 211, 238], radius: 6 },
  ciudad: { color: [148, 163, 184], radius: 3 },
};

const KIND_LABEL: Record<string, string> = {
  aeropuerto: "Aeropuerto",
  puerto_maritimo: "Puerto marítimo",
  puerto_fluvial: "Puerto fluvial",
  terminal_ferrea: "Terminal férrea",
  cedi: "CEDI",
  ciudad: "Nodo vial",
};

/** Simulación: 1 s real = FLEET_HOURS_PER_SECOND horas de operación. */
const FLEET_HOURS_PER_SECOND = 0.6;
const FLEET_LOOP_HOURS = 14;
const ROUTE_LOOP_SECONDS = 9;

type DeptDatum = { name: string; code: string; traffic: string; intensity: number; polygon: number[][][] };
type LinkDatum = NetworkGeo["links"]["features"][number];
type NodeDatum = NetworkGeo["nodes"]["features"][number];
type AssetSegment = TripSegment & { asset: LiveAsset };
type Hover = { x: number; y: number; content: React.ReactNode } | null;

export interface Map3DProps {
  network: NetworkGeo;
  departments: DepartmentsGeo;
  fleet?: FleetLive | null;
  route?: RouteResult | null;
  visibleModes?: ReadonlySet<Mode>;
  showDepartments?: boolean;
  showFleet?: boolean;
  compact?: boolean;
  className?: string;
}

export default function Map3D({
  network,
  departments,
  fleet,
  route,
  visibleModes,
  showDepartments = true,
  showFleet = true,
  compact = false,
  className,
}: Map3DProps) {
  // En la vista compacta el país sube para no quedar bajo los chips de resumen
  const [viewState, setViewState] = useState<MapViewState>(
    compact ? { ...COLOMBIA_VIEW, latitude: 1.4, zoom: 4.25, pitch: 40 } : COLOMBIA_VIEW,
  );
  const [hover, setHover] = useState<Hover>(null);
  const { money } = useApp();
  const [clock, setClock] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [routeStart, setRouteStart] = useState(0);

  // ---- Reloj de animación (requestAnimationFrame) ---------------------
  useEffect(() => {
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      setClock((now - t0) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const isVisible = useCallback((m: Mode) => !visibleModes || visibleModes.has(m), [visibleModes]);

  // ---- Encuadre de la ruta simulada -----------------------------------
  useEffect(() => {
    if (!route || !containerRef.current) return;
    setRouteStart(clock);
    const pts = route.legs.flatMap((l) => l.path);
    const { width, height } = containerRef.current.getBoundingClientRect();
    if (!width || !height || pts.length < 2) return;
    const vp = new WebMercatorViewport({ width, height });
    const { longitude, latitude, zoom } = vp.fitBounds(boundsOf(pts), {
      padding: { top: 80, bottom: 80, left: compact ? 40 : 420, right: 80 },
    });
    setViewState((v) => ({
      ...v,
      longitude,
      latitude,
      zoom: Math.min(zoom, 7.5),
      pitch: 50,
      bearing: -12,
      transitionDuration: 1800,
      transitionInterpolator: new FlyToInterpolator({ speed: 1.4 }),
    }));
    // Solo se re-encuadra cuando cambia la ruta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // ---- Datos derivados (memorizados) ----------------------------------
  const deptData = useMemo<DeptDatum[]>(
    () =>
      departments.features.flatMap((f) => {
        const polys =
          f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        return polys.map((polygon) => ({
          name: f.properties.name,
          code: f.properties.code,
          traffic: f.properties.traffic_fmt,
          intensity: f.properties.intensity,
          polygon: polygon as number[][][],
        }));
      }),
    [departments],
  );

  const links = useMemo(
    () => network.links.features.filter((f) => isVisible(f.properties.mode)),
    [network, isVisible],
  );
  // Vías cerradas: fuera de las capas normales, en una capa propia (rojo punteado)
  const openLinks = useMemo(() => links.filter((f) => !f.properties.closed), [links]);
  const closedLinks = useMemo(() => links.filter((f) => f.properties.closed), [links]);
  const groundLinks = useMemo(() => openLinks.filter((f) => f.properties.mode !== "aereo"), [openLinks]);
  const airLinks = useMemo(() => openLinks.filter((f) => f.properties.mode === "aereo"), [openLinks]);
  const nodes = network.nodes.features;
  // Una etiqueta por ciudad, sobre su nodo principal
  const cityLabels = useMemo(() => {
    const rank = ["cedi", "puerto_maritimo", "aeropuerto", "puerto_fluvial", "terminal_ferrea"];
    const best = new Map<string, NodeDatum>();
    for (const n of network.nodes.features) {
      const r = rank.indexOf(n.properties.kind);
      if (r < 0) continue;
      const cur = best.get(n.properties.city);
      if (!cur || r < rank.indexOf(cur.properties.kind)) best.set(n.properties.city, n);
    }
    return [...best.values()];
  }, [network]);

  const fleetSegments = useMemo<AssetSegment[]>(
    () =>
      (fleet?.assets ?? []).flatMap((asset) =>
        splitTrip(asset.trip)
          .filter((s) => s.timestamps[s.timestamps.length - 1] >= 0)
          .map((s) => ({ ...s, asset })),
      ),
    [fleet],
  );

  const routeSegments = useMemo(() => (route ? splitTrip(route.trip) : []), [route]);
  const routeGround = useMemo(
    () => (route ? route.legs.filter((l) => l.mode !== "aereo") : []),
    [route],
  );
  const routeAir = useMemo(
    () =>
      route
        ? route.legs
            .filter((l) => l.mode === "aereo")
            .map((l) => ({ leg: l, path: flightArc(l.path[0], l.path[l.path.length - 1]) }))
        : [],
    [route],
  );

  // ---- Tiempo de animación -------------------------------------------
  const fleetTime = (clock * FLEET_HOURS_PER_SECOND) % FLEET_LOOP_HOURS;
  const routeTotal = route?.trip.timestamps[route.trip.timestamps.length - 1] ?? 1;
  const routeT = route
    ? (((clock - routeStart) % ROUTE_LOOP_SECONDS) / (ROUTE_LOOP_SECONDS * 0.85)) * routeTotal
    : 0;

  // Posiciones de este fotograma (cambian en cada tick: no se memorizan)
  const fleetHeads = showFleet
    ? fleetSegments
        .map((s) => ({ s, p: positionAt(s, fleetTime) }))
        .filter((x): x is { s: AssetSegment; p: Position3 } => x.p !== null && isVisible(x.s.mode))
    : [];

  let routeHead: { p: Position3; mode: Mode } | null = null;
  for (const s of routeSegments) {
    const p = positionAt(s, Math.min(routeT, routeTotal));
    if (p) {
      routeHead = { p, mode: s.mode };
      break;
    }
  }

  // ---- Capas ---------------------------------------------------------
  const dim = route ? 0.35 : 1; // con ruta simulada, la red pasa a segundo plano

  const layers = [
    showDepartments &&
      new PolygonLayer<DeptDatum>({
        id: "departamentos",
        data: deptData,
        getPolygon: (d) => d.polygon,
        extruded: true,
        getElevation: (d) => 1500 + d.intensity * 42000,
        getFillColor: (d) => [34, 211, 238, Math.round(10 + d.intensity * 22)],
        material: false,
        pickable: true,
        autoHighlight: true,
        highlightColor: [34, 211, 238, 50],
        // Translúcido: no escribe profundidad para no ocultar las rutas
        parameters: { depthWriteEnabled: false },
        updateTriggers: { getFillColor: deptData },
      }),

    showDepartments &&
      new PathLayer<DeptDatum>({
        id: "departamentos-borde",
        data: deptData,
        getPath: (d) => d.polygon[0] as [number, number][],
        getColor: [148, 163, 184, 70],
        getWidth: 0.8,
        widthUnits: "pixels",
        parameters: { depthWriteEnabled: false },
      }),

    // Resplandor de los corredores de superficie
    new PathLayer<LinkDatum>({
      id: "corredores-glow",
      data: groundLinks.filter((f) => f.properties.mode !== "ferreo"),
      getPath: (f) => f.geometry.coordinates as [number, number][],
      getColor: (f) => rgba(f.properties.mode, Math.round(38 * dim)),
      getWidth: 7,
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
    }),
    new PathLayer<LinkDatum>({
      id: "corredores",
      data: groundLinks.filter((f) => f.properties.mode !== "ferreo"),
      getPath: (f) => f.geometry.coordinates as [number, number][],
      getColor: (f) => rgba(f.properties.mode, Math.round(220 * dim)),
      getWidth: (f) => (f.properties.mode === "terrestre" ? 1.6 : 2.2),
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 200],
      updateTriggers: { getColor: dim },
    }),
    new PathLayer<LinkDatum, PathStyleExtensionProps<LinkDatum>>({
      id: "ferreo",
      data: groundLinks.filter((f) => f.properties.mode === "ferreo"),
      getPath: (f) => f.geometry.coordinates as [number, number][],
      getColor: [...AMBER.slice(0, 3), Math.round(240 * dim)] as RGBA,
      getWidth: 2.4,
      widthUnits: "pixels",
      getDashArray: () => [5, 3],
      dashJustified: true,
      extensions: [new PathStyleExtension({ dash: true })],
      pickable: true,
      autoHighlight: true,
      updateTriggers: { getColor: dim },
    }),
    new ArcLayer<LinkDatum>({
      id: "vuelos",
      data: airLinks,
      getSourcePosition: (f) => f.geometry.coordinates[0] as [number, number],
      getTargetPosition: (f) =>
        f.geometry.coordinates[f.geometry.coordinates.length - 1] as [number, number],
      getSourceColor: [...VIOLET.slice(0, 3), Math.round(230 * dim)] as RGBA,
      getTargetColor: [...CYAN.slice(0, 3), Math.round(230 * dim)] as RGBA,
      getHeight: 0.42,
      getWidth: 1.8,
      widthUnits: "pixels",
      pickable: true,
      autoHighlight: true,
      updateTriggers: { getSourceColor: dim, getTargetColor: dim },
    }),
    closedLinks.length > 0 &&
      new PathLayer<LinkDatum, PathStyleExtensionProps<LinkDatum>>({
        id: "cerrados",
        data: closedLinks,
        getPath: (f) => f.geometry.coordinates as [number, number][],
        getColor: [...ROSE.slice(0, 3), Math.round(230 * dim)] as RGBA,
        getWidth: 2.6,
        widthUnits: "pixels",
        getDashArray: () => [3, 3],
        dashJustified: true,
        extensions: [new PathStyleExtension({ dash: true })],
        pickable: true,
        autoHighlight: true,
        updateTriggers: { getColor: dim },
      }),

    // Flota en vivo: estelas de luz y cabezas brillantes
    showFleet &&
      new TripsLayer<AssetSegment>({
        id: "flota-estelas",
        data: fleetSegments.filter((s) => isVisible(s.mode)),
        getPath: (s) => s.path,
        getTimestamps: (s) => s.timestamps,
        getColor: (s) => rgba(s.mode),
        currentTime: fleetTime,
        trailLength: 1.6,
        fadeTrail: true,
        widthMinPixels: 3,
        capRounded: true,
        jointRounded: true,
        opacity: route ? 0.35 : 0.95,
      }),
    showFleet &&
      new ScatterplotLayer<{ s: AssetSegment; p: Position3 }>({
        id: "flota-halo",
        data: fleetHeads,
        getPosition: (d) => d.p,
        getFillColor: (d) => rgba(d.s.mode, route ? 25 : 60),
        getRadius: 11,
        radiusUnits: "pixels",
      }),
    showFleet &&
      new ScatterplotLayer<{ s: AssetSegment; p: Position3 }>({
        id: "flota",
        data: fleetHeads,
        getPosition: (d) => d.p,
        getFillColor: [255, 255, 255, route ? 120 : 255],
        getLineColor: (d) => rgba(d.s.mode),
        stroked: true,
        lineWidthMinPixels: 2,
        getRadius: 3.5,
        radiusUnits: "pixels",
        pickable: true,
      }),

    // Nodos
    new ScatterplotLayer<NodeDatum>({
      id: "nodos-halo",
      data: nodes.filter((n) => n.properties.kind !== "ciudad"),
      getPosition: (n) => n.geometry.coordinates as [number, number],
      getFillColor: (n) => [...NODE_STYLE[n.properties.kind].color, 40] as RGBA,
      getRadius: (n) => NODE_STYLE[n.properties.kind].radius * 2.3,
      radiusUnits: "pixels",
    }),
    new ScatterplotLayer<NodeDatum>({
      id: "nodos",
      data: nodes,
      getPosition: (n) => n.geometry.coordinates as [number, number],
      getFillColor: (n) => [...NODE_STYLE[n.properties.kind].color, 255] as RGBA,
      getLineColor: [3, 7, 18, 255],
      stroked: true,
      lineWidthMinPixels: 1.5,
      getRadius: (n) => NODE_STYLE[n.properties.kind].radius,
      radiusUnits: "pixels",
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 160],
    }),
    !compact &&
      new TextLayer<NodeDatum>({
        id: "nodos-etiquetas",
        data: cityLabels,
        getPosition: (n) => n.geometry.coordinates as [number, number],
        getText: (n) => n.properties.city,
        getSize: 11,
        getColor: [226, 232, 240, 210],
        getPixelOffset: [0, -16],
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontWeight: 600,
        characterSet: "auto",
        fontSettings: { sdf: true },
        outlineWidth: 3,
        outlineColor: [3, 7, 18, 255],
        parameters: { depthCompare: "always" },
      }),

    // Ruta simulada
    route &&
      new PathLayer({
        id: "ruta-glow",
        data: routeGround,
        getPath: (l) => l.path,
        getColor: (l) => rgba(l.mode, 70),
        getWidth: 14,
        widthUnits: "pixels",
        capRounded: true,
        jointRounded: true,
      }),
    route &&
      new PathLayer({
        id: "ruta",
        data: routeGround,
        getPath: (l) => l.path,
        getColor: (l) => rgba(l.mode),
        getWidth: 4,
        widthUnits: "pixels",
        capRounded: true,
        jointRounded: true,
      }),
    route &&
      new PathLayer({
        id: "ruta-aerea",
        data: routeAir,
        getPath: (d) => d.path,
        getColor: rgba("aereo"),
        getWidth: 3.5,
        widthUnits: "pixels",
        capRounded: true,
      }),
    route &&
      new TripsLayer<TripSegment>({
        id: "ruta-recorrido",
        data: routeSegments,
        getPath: (s) => s.path,
        getTimestamps: (s) => s.timestamps,
        getColor: [255, 255, 255, 255],
        currentTime: routeT,
        trailLength: routeTotal * 0.12,
        fadeTrail: true,
        widthMinPixels: 5,
        capRounded: true,
      }),
    route &&
      new ScatterplotLayer({
        id: "ruta-transbordos",
        data: route.transfers,
        getPosition: (t) => [t.node.lon, t.node.lat],
        getFillColor: AMBER,
        getLineColor: [3, 7, 18, 255],
        stroked: true,
        lineWidthMinPixels: 2,
        getRadius: 9,
        radiusUnits: "pixels",
        pickable: true,
      }),
    route &&
      routeHead &&
      new ScatterplotLayer({
        id: "ruta-cabeza",
        data: [routeHead],
        getPosition: (d) => d.p,
        getFillColor: [255, 255, 255, 255],
        getLineColor: (d) => rgba(d.mode),
        stroked: true,
        lineWidthMinPixels: 3,
        getRadius: 6,
        radiusUnits: "pixels",
      }),
  ].filter(Boolean);

  // ---- Tooltip glassmorphism ------------------------------------------
  const onHover = useCallback((info: PickingInfo) => {
    if (!info.object || !info.layer) {
      setHover(null);
      return;
    }
    const o = info.object as Record<string, unknown>;
    const id = info.layer.id;
    let content: React.ReactNode = null;
    if (id === "departamentos") {
      const d = o as unknown as DeptDatum;
      content = (
        <TooltipBody title={d.name} subtitle="Departamento">
          <Row k="Tráfico (30 días)" v={d.traffic} />
        </TooltipBody>
      );
    } else if (id === "nodos") {
      const n = (o as unknown as NodeDatum).properties;
      content = (
        <TooltipBody title={n.name} subtitle={`${KIND_LABEL[n.kind]} · ${n.city}${n.approximate ? " · ubicación aproximada" : ""}`}>
          <div className="mt-2 flex gap-1">
            {n.modes.map((m) => {
              const Icon = MODES[m].icon;
              return <Icon key={m} className="size-3.5" style={{ color: MODES[m].color }} />;
            })}
          </div>
        </TooltipBody>
      );
    } else if (["corredores", "ferreo", "vuelos", "cerrados"].includes(id)) {
      const p = (o as unknown as LinkDatum).properties;
      content = (
        <TooltipBody title={p.corridor} subtitle={`${p.origin_name} → ${p.destination_name}`} mode={p.mode}>
          {p.closed && <div className="mb-1 font-medium text-neon-rose">Cerrada: {p.closure_reason}</div>}
          <Row k="Distancia" v={p.distance_fmt} />
          <Row k="Tiempo" v={p.time_fmt} />
          <Row k="Capacidad por despacho" v={p.capacity_fmt} />
          {p.approximate && <div className="mt-1 text-[11px] text-muted-foreground">Trazado y distancia aproximados</div>}
        </TooltipBody>
      );
    } else if (id === "flota") {
      const a = (o as unknown as { s: AssetSegment }).s.asset;
      content = (
        <TooltipBody title={a.id} subtitle={`${a.asset_type ?? ""} · ${a.carrier ?? ""}`} mode={a.mode}>
          <Row k="Envío" v={a.shipment_code} />
          <Row k="Ruta" v={`${a.origin} → ${a.destination}`} />
          <Row k="Carga" v={`${a.cargo} · ${a.weight_fmt}`} />
          <Row k="Estado" v={`${a.status} · ${Math.round(a.progress_pct)} %`} />
        </TooltipBody>
      );
    } else if (id === "ruta-transbordos") {
      const t = o as unknown as RouteResult["transfers"][number];
      content = (
        <TooltipBody title={t.label} subtitle={t.node.name}>
          <Row k="Manipulación" v={t.time_fmt} />
          <Row k="Costo" v={money(t.cost)} />
        </TooltipBody>
      );
    }
    setHover(content ? { x: info.x, y: info.y, content } : null);
  }, [money]);

  return (
    <div ref={containerRef} className={cn("relative h-full min-h-80 w-full overflow-hidden bg-[#030712]", className)}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: v }) => setViewState(v as MapViewState)}
        controller={{ dragRotate: true, touchRotate: true, scrollZoom: !compact }}
        layers={layers}
        onHover={onHover}
        getCursor={({ isHovering, isDragging }) => (isDragging ? "grabbing" : isHovering ? "pointer" : "grab")}
      >
        <BaseMap mapStyle={MAP_STYLE} reuseMaps attributionControl={{ compact: true }} />
      </DeckGL>
      {hover && (
        <div
          className="pointer-events-none absolute z-20 max-w-72 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-lg border border-white/10 bg-[#0b0f19]/70 px-3.5 py-3 text-xs shadow-2xl shadow-black/60 backdrop-blur-xl"
          style={{ left: hover.x, top: hover.y }}
        >
          {hover.content}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#030712] to-transparent" />
    </div>
  );
}

function TooltipBody({
  title,
  subtitle,
  mode,
  children,
}: {
  title: string;
  subtitle?: string;
  mode?: Mode;
  children?: React.ReactNode;
}) {
  const Icon = mode ? MODES[mode].icon : null;
  return (
    <div>
      <div className="flex items-center gap-2">
        {Icon && mode && <Icon className="size-3.5 shrink-0" style={{ color: MODES[mode].color }} />}
        <span className="font-medium text-foreground">{title}</span>
      </div>
      {subtitle && <div className="mt-0.5 text-muted-foreground">{subtitle}</div>}
      {children && <div className="mt-2 flex flex-col gap-1">{children}</div>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className="tabular text-right text-slate-200">{v}</span>
    </div>
  );
}
