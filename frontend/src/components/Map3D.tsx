"use client";

/**
 * Map3D: cartografía 3D de la red multimodal de Colombia.
 *
 * deck.gl (WebGL) sobre un mapa base vectorial oscuro de MapLibre. Capas:
 *   - PolygonLayer: los 32 departamentos y Bogotá D.C. (DANE), extruidos
 *     según las toneladas que los atraviesan, con relleno al ~10 %.
 *   - PathLayer: carreteras (esmeralda, a ras de suelo), ríos y mar (azules)
 *     y ferrocarril (ámbar, punteado con PathStyleExtension).
 *   - ArcLayer: rutas aéreas, arcos altos de magenta a cian.
 *   - TripsLayer: partículas de luz de camiones, barcazas, buques, trenes y
 *     aviones moviéndose sobre su propio trazado.
 *   - ScatterplotLayer / TextLayer: nodos y activos, con tooltip HTML
 *     glassmorphism al pasar el cursor.
 *   - Ruta simulada: tramos resaltados, transbordos y su recorrido animado.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import DeckGL, { type DeckGLRef } from "@deck.gl/react";
import { Pause, Play } from "lucide-react";
import {
  Deck,
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
import { usePrefs } from "@/lib/prefs";
import type { DepartmentsGeo, FleetLive, LiveAsset, Mode, NetworkGeo, RouteResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMapAnimation } from "@/components/map/use-map-animation";
import { onIdle } from "@/lib/idle";

// Worker publicado por scripts/copy-maplibre-worker.mjs (ver allí el porqué)
setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

// Next conserva oculta la ruta que se deja (Activity): al ocultarla, <DeckGL> finaliza su Deck; al volver, su efecto
// de diseño corre antes de crear el nuevo y redibuja el finalizado con un cuadro pendiente ("reading 'context' of
// null" en _drawLayers, visto en CI con Resumen → Envíos → Flota → Resumen). Un Deck ya finalizado no dibuja.
type Drawable = { layerManager: unknown; _drawLayers: (...args: unknown[]) => void };
const deckProto = Deck.prototype as unknown as Drawable;
const drawLayers = deckProto._drawLayers;
deckProto._drawLayers = function (this: Drawable, ...args: unknown[]) {
  if (this.layerManager) drawLayers.apply(this, args);
};

// NEXT_PUBLIC_MAP_STYLE fija un estilo único; sin él, el mapa sigue la apariencia elegida (Sistema/Claro/Oscuro).
const MAP_STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const MAP_STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";


export const COLOMBIA_VIEW: MapViewState = {
  longitude: -74.2,
  latitude: 3.6,
  zoom: 4.6,
  pitch: 45,
  bearing: -10,
};

type RGBA = [number, number, number, number];
const rgba = (mode: Mode, a = 255, dark = false): RGBA => [...(dark ? MODES[mode].rgbDark : MODES[mode].rgb), a];
const CYAN: RGBA = [34, 211, 238, 255];
const VIOLET: RGBA = [198, 57, 156, 255];
const AMBER: RGBA = [245, 158, 11, 255];
const ROSE: RGBA = [251, 113, 133, 255];

const NODE_STYLE: Record<string, { color: [number, number, number]; mode?: Mode; radius: number }> = {
  aeropuerto: { color: MODES.aereo.rgb, mode: "aereo", radius: 6 },
  puerto_maritimo: { color: MODES.maritimo.rgb, mode: "maritimo", radius: 7 },
  puerto_fluvial: { color: MODES.fluvial.rgb, mode: "fluvial", radius: 5.5 },
  terminal_ferrea: { color: MODES.ferreo.rgb, mode: "ferreo", radius: 5.5 },
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
type LayerList = NonNullable<React.ComponentProps<typeof DeckGL>["layers"]>;
const NO_LAYERS: LayerList = [];
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
  /** Si se define, solo se dibujan los nodos de estas ciudades (filtro por categoría). */
  visibleCities?: ReadonlySet<string> | null;
  /** Detiene la animación aunque se interactúe con el mapa (por ejemplo, mientras se escribe en un panel). */
  paused?: boolean;
  /** Pantalla completa: la animación corre sin necesidad de interactuar. */
  live?: boolean;
  /** Ciudades marcadas con un aro (origen y destino elegidos). */
  selectedCities?: readonly string[];
  /** Ciudad a la que vuela la cámara cuando cambia. */
  focusCity?: string | null;
  /** Se llama al pulsar un nodo. */
  onCityClick?: (city: string) => void;
  /**
   * Lo que tapan los controles que flotan sobre el mapa en escritorio (px): arriba el encabezado, a la izquierda
   * el simulador, abajo la leyenda. El encuadre usa solo el espacio libre. En celular se usan márgenes propios.
   */
  insets?: { top?: number; left?: number; bottom?: number };
}

type Padding = { top: number; bottom: number; left: number; right: number };

/**
 * Encuadre con la cámara inclinada. `fitBounds` supone un mapa plano: con inclinación y giro el sur se acerca
 * (se ve más grande y baja) y el norte se aleja, así que el país quedaba cortado abajo. Se parte del encuadre
 * plano y se corrige proyectando el contorno con la cámara real: escala y centro, tres pasadas. Cálculo único.
 */
function fitTilted(bounds: [[number, number], [number, number]], width: number, height: number, padding: Padding, pitch: number, bearing: number) {
  let { longitude, latitude, zoom } = new WebMercatorViewport({ width, height }).fitBounds(bounds, { padding });
  const [[w, s], [e, n]] = bounds;
  const outline: [number, number][] = [];
  for (let i = 0; i <= 4; i++) {
    const x = w + ((e - w) * i) / 4;
    const y = s + ((n - s) * i) / 4;
    outline.push([x, s], [x, n], [w, y], [e, y]);
  }
  const box = { x: padding.left, y: padding.top, w: width - padding.left - padding.right, h: height - padding.top - padding.bottom };
  for (let k = 0; k < 3; k++) {
    const vp = new WebMercatorViewport({ width, height, longitude, latitude, zoom, pitch, bearing });
    const pts = outline.map((p) => vp.project(p));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    // Un tramo recto norte-sur o este-oeste tiene caja de ancho o alto casi nulo: mínimo 1 px
    const scale = Math.min(box.w / Math.max(x1 - x0, 1), box.h / Math.max(y1 - y0, 1));
    // Mueve el centro para que el contorno quede centrado en el espacio libre, y ajusta el zoom
    const [lng, lat] = vp.unproject([width / 2 + ((x0 + x1) / 2 - (box.x + box.w / 2)), height / 2 + ((y0 + y1) / 2 - (box.y + box.h / 2))]);
    longitude = lng;
    latitude = lat;
    zoom = Math.min(Math.max(zoom + Math.log2(scale), 1), 12);
  }
  return { longitude, latitude, zoom };
}

/** Colombia continental más San Andrés: lo que el encuadre inicial debe mostrar completo. */
const COLOMBIA_BOUNDS: [[number, number], [number, number]] = [
  [-81.8, -4.3],
  [-66.8, 13.6],
];

export default function Map3D({
  network,
  departments,
  fleet,
  route,
  paused = false,
  live = false,
  visibleModes,
  showDepartments = true,
  showFleet = true,
  compact = false,
  className,
  visibleCities = null,
  selectedCities = [],
  focusCity = null,
  onCityClick,
  insets,
}: Map3DProps) {
  const insetTop = insets?.top ?? 0;
  const insetLeft = insets?.left ?? 0;
  const insetBottom = insets?.bottom ?? 0;
  // En la vista compacta el país sube para no quedar bajo los chips de resumen
  const [viewState, setViewState] = useState<MapViewState>(
    compact ? { ...COLOMBIA_VIEW, latitude: 1.4, zoom: 4.25, pitch: 40 } : COLOMBIA_VIEW,
  );
  const [hover, setHover] = useState<Hover>(null);
  const dark = usePrefs().resolved === "dark";
  const { money } = useApp();
  // El reloj de la animación vive en una referencia: no pasa por React en cada cuadro.
  // Así el mapa no se redibuja entero 30 veces por segundo; deck.gl recibe las capas directamente.
  const clockRef = useRef(0);
  const deckRef = useRef<DeckGLRef | null>(null);
  const buildRef = useRef<((t: number) => LayerList) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { animate, setAnimate } = useMapAnimation();
  // Resolución de dibujado: la nativa de la pantalla para que el mapa se vea nítido; la vista compacta
  // del dashboard usa 1 porque es pequeña y no necesita el detalle.
  const [maxPixelRatio] = useState(() =>
    typeof window === "undefined" ? 1 : compact ? 1 : window.devicePixelRatio || 1,
  );

  // deck.gl crea una capa de eventos enfocable sin nombre: se la damos para lectores de pantalla.
  useEffect(() => {
    const root = containerRef.current?.querySelector<HTMLElement>(".deck-events-root");
    if (root) {
      root.setAttribute("role", "application");
      root.setAttribute("aria-label", "Mapa de la red multimodal. Arrastra para mover y usa la rueda para acercar.");
    }
  }, []);

  // Capas por etapas: compilar todos los sombreadores de golpe bloqueaba la página varios segundos en
  // equipos sin compilación en paralelo. Primero corredores y nodos; departamentos; férreo, vuelos y
  // cierres; etiquetas; y al final flota y ruta, cada etapa en un momento libre del navegador, para que los toques se atiendan entre una y otra.
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= 4) return;
    // Un cuadro para dibujar lo que ya hay y luego, en el siguiente momento libre, la etapa siguiente
    let cancelIdle = () => {};
    const frame = requestAnimationFrame(() => {
      cancelIdle = onIdle(() => setStage((s) => s + 1));
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelIdle();
    };
  }, [stage]);

  // Solo se anima lo que se ve: con el mapa fuera de pantalla o con "reducir movimiento" el reloj se detiene.
  const animateRef = useRef(true);
  useEffect(() => {
    const el = containerRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let onScreen = true;
    const update = () => {
      animateRef.current = onScreen && !reduce.matches;
    };
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      update();
    });
    if (el) io.observe(el);
    reduce.addEventListener("change", update);
    update();
    return () => {
      io.disconnect();
      reduce.removeEventListener("change", update);
    };
  }, []);
  const routeStartRef = useRef(0);

  // Regla del mapa: en reposo queda quieto. El reloj solo corre mientras se arrastra, se gira o se usa la
  // rueda (y 0,8 s después, para que el movimiento no se corte en seco) o en pantalla completa (`live`).
  const [engaged, setEngaged] = useState(false);
  const engageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onInteractionStateChange = useCallback(
    (s: { isDragging?: boolean; isPanning?: boolean; isZooming?: boolean; isRotating?: boolean }) => {
      const active = !!(s.isDragging || s.isPanning || s.isZooming || s.isRotating);
      if (engageTimer.current) clearTimeout(engageTimer.current);
      if (active) setEngaged(true);
      else engageTimer.current = setTimeout(() => setEngaged(false), 800);
    },
    [],
  );
  useEffect(() => () => {
    if (engageTimer.current) clearTimeout(engageTimer.current);
  }, []);
  const running = animate && !paused && (live || engaged);

  // ---- Reloj de animación (requestAnimationFrame) ---------------------
  useEffect(() => {
    if (!running) return; // en reposo: sin reloj no hay fotogramas nuevos y el navegador queda libre
    let frame = 0;
    let last = 0;
    // El reloj continúa desde donde quedó: al volver a moverse, nada salta al principio
    const base = clockRef.current;
    const t0 = performance.now();
    // La flota se mueve despacio: ~30 cuadros por segundo en el mapa completo y ~10 en la vista
    // compacta del dashboard bastan y dejan tiempo al hilo principal (navegación, toques).
    // En pestañas ocultas la animación se detiene.
    const minDelta = compact ? 100 : 33;
    const tick = (now: number) => {
      if (!document.hidden && animateRef.current && now - last >= minDelta) {
        last = now;
        const t = base + (now - t0) / 1000;
        clockRef.current = t;
        deckRef.current?.deck?.setProps({ layers: buildRef.current?.(t) ?? NO_LAYERS });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [compact, running]);

  const isVisible = useCallback((m: Mode) => !visibleModes || visibleModes.has(m), [visibleModes]);

  // ---- Encuadre inicial ----------------------------------------------
  // El país se ajusta al tamaño real del contenedor (antes era un zoom fijo: en pantallas anchas Colombia
  // quedaba pequeña, rodeada de Centroamérica, y detrás del simulador). Una sola vez, antes del primer cuadro.
  useLayoutEffect(() => {
    const el = containerRef.current;
    // Con una ruta el encuadre es el de la ruta (efecto siguiente)
    if (!el || route) return;
    const { width, height } = el.getBoundingClientRect();
    const narrow = width < 768;
    // Los chips y la leyenda flotan sobre el borde inferior; el sur del país (Amazonas) cae al centro y puede
    // pasar por debajo de ellos sin tapar nada importante.
    const padding = compact
      ? { top: 12, bottom: 44, left: 16, right: 16 }
      : narrow
        ? { top: insetTop ? 110 : 16, bottom: insetTop ? Math.round(height * 0.3) : 16, left: 16, right: 16 }
        : { top: 24 + insetTop, bottom: 24 + insetBottom, left: 24 + insetLeft, right: 24 };
    // deck.gl falla si el margen no deja espacio: en ese caso se queda la vista por defecto
    if (width - padding.left - padding.right < 120 || height - padding.top - padding.bottom < 120) return;
    try {
      setViewState((v) => {
        const fit = fitTilted(COLOMBIA_BOUNDS, width, height, padding, v.pitch ?? 0, v.bearing ?? 0);
        return { ...v, longitude: fit.longitude, latitude: fit.latitude, zoom: Math.min(Math.max(fit.zoom, 3.4), 6.4) };
      });
    } catch {
      // Sin encuadre posible se queda la vista por defecto
    }
    // Solo al montar: después la cámara es del usuario
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Encuadre de la ruta simulada -----------------------------------
  // La ficha del envío arma un objeto de ruta nuevo en cada render: la clave depende del trazado, no de la
  // identidad, para no re-encuadrar ni reiniciar la animación cada vez que la página refresca sus datos.
  const routeKey = route
    ? route.legs.map((l) => `${l.mode}:${l.path.length}:${l.path[0]?.join(",")}:${l.path.at(-1)?.join(",")}`).join("|")
    : "";
  const mountedRef = useRef(false);
  // Efecto de diseño (antes del primer cuadro): si corriera después, el mapa al iniciarse avisa su vista
  // original y pisa el encuadre.
  useLayoutEffect(() => {
    if (!route || !containerRef.current) return;
    routeStartRef.current = clockRef.current;
    const pts = route.legs.flatMap((l) => l.path);
    const { width, height } = containerRef.current.getBoundingClientRect();
    if (!width || !height || pts.length < 2) return;
    // Márgenes según el ancho: en celular el simulador es una hoja inferior y un margen lateral grande
    // supera la pantalla, lo que hace fallar deck.gl ("assertion failed") y tumba la página. A la izquierda
    // se deja el ancho del panel solo si hay uno (en la ficha del envío no lo hay).
    const narrow = width < 768;
    const padding = {
      top: narrow ? 40 : 48 + insetTop,
      bottom: narrow ? Math.round(height * (insetTop ? 0.55 : 0.1)) : 48 + insetBottom,
      left: compact || narrow ? 24 : 48 + insetLeft,
      right: narrow ? 24 : 48,
    };
    // Al crear el mapa con una ruta (ficha del envío) se encuadra directo: una transición en ese momento la
    // cancelaba el primer aviso de vista del mapa y quedaba todo el país. Con el mapa ya abierto, vuelo.
    const instant = !mountedRef.current;
    try {
      const fit = fitTilted(boundsOf(pts), width, height, padding, 50, -12);
      setViewState((v) => ({
        ...v,
        longitude: fit.longitude,
        latitude: fit.latitude,
        zoom: Math.min(fit.zoom, 7.5),
        pitch: 50,
        bearing: -12,
        ...(instant ? {} : { transitionDuration: 1800, transitionInterpolator: new FlyToInterpolator({ speed: 1.4 }) }),
      }));
    } catch {
      // Si el encuadre no es posible, la ruta sigue dibujada sin mover la cámara
    }
    // Solo se re-encuadra cuando cambia el trazado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);
  // Declarado después del encuadre: en el primer render ese efecto aún ve el mapa "recién creado"
  useEffect(() => {
    mountedRef.current = true;
  }, []);

  // ---- Vuelo a una ciudad elegida (lista, URL o paleta de comandos) ----
  useEffect(() => {
    if (!focusCity) return;
    const rank = ["cedi", "ciudad", "aeropuerto", "puerto_maritimo", "puerto_fluvial", "terminal_ferrea"];
    const node = network.nodes.features
      .filter((n) => n.properties.city === focusCity)
      .sort((a, b) => rank.indexOf(a.properties.kind) - rank.indexOf(b.properties.kind))[0];
    if (!node) return;
    const [longitude, latitude] = node.geometry.coordinates as [number, number];
    // Fuera del cuerpo del efecto: el vuelo es una reacción a un evento externo, no un estado derivado
    const t = setTimeout(
      () =>
        setViewState((v) => ({
          ...v,
          longitude,
          latitude,
          zoom: Math.max(v.zoom, 7),
          transitionDuration: 1200,
          transitionInterpolator: new FlyToInterpolator({ speed: 1.6 }),
        })),
      0,
    );
    return () => clearTimeout(t);
  }, [focusCity, network]);

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
  const nodes = useMemo(
    () => (visibleCities ? network.nodes.features.filter((n) => visibleCities.has(n.properties.city)) : network.nodes.features),
    [network, visibleCities],
  );
  // Una etiqueta por ciudad, sobre su nodo principal
  const cityLabels = useMemo(() => {
    const rank = ["cedi", "puerto_maritimo", "aeropuerto", "puerto_fluvial", "terminal_ferrea"];
    const best = new Map<string, NodeDatum>();
    for (const n of nodes) {
      const r = rank.indexOf(n.properties.kind);
      if (r < 0) continue;
      const cur = best.get(n.properties.city);
      if (!cur || r < rank.indexOf(cur.properties.kind)) best.set(n.properties.city, n);
    }
    return [...best.values()];
  }, [nodes]);

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

  // Colores de modo según el tema (la paleta tiene variante clara y oscura)
  const tone = (m: Mode, a = 255): RGBA => rgba(m, a, dark);
  const nodeColor = (kind: string, a: number): RGBA => {
    const st = NODE_STYLE[kind] ?? NODE_STYLE.ciudad;
    return st.mode ? tone(st.mode, a) : ([...st.color, a] as RGBA);
  };

  // Las capas se construyen a partir de un instante: el bucle de animación las pide con su propio tiempo.
  const buildLayers = (clock: number) => {
  const routeStart = routeStartRef.current;
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
      stage >= 1 &&
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
      stage >= 1 &&
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
      getColor: (f) => tone(f.properties.mode, Math.round(38 * dim)),
      getWidth: 7,
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
    }),
    new PathLayer<LinkDatum>({
      id: "corredores",
      data: groundLinks.filter((f) => f.properties.mode !== "ferreo"),
      getPath: (f) => f.geometry.coordinates as [number, number][],
      getColor: (f) => tone(f.properties.mode, Math.round(220 * dim)),
      getWidth: (f) => (f.properties.mode === "terrestre" ? 1.6 : 2.2),
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 200],
      updateTriggers: { getColor: dim },
    }),
    stage >= 2 &&
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
    stage >= 2 &&
      new ArcLayer<LinkDatum>({
      id: "vuelos",
      data: airLinks,
      getSourcePosition: (f) => f.geometry.coordinates[0] as [number, number],
      getTargetPosition: (f) =>
        f.geometry.coordinates[f.geometry.coordinates.length - 1] as [number, number],
      getSourceColor: [...VIOLET.slice(0, 3), Math.round(120 * dim)] as RGBA,
      getTargetColor: [...CYAN.slice(0, 3), Math.round(120 * dim)] as RGBA,
      getHeight: 0.42,
      getWidth: 1.2,
      widthUnits: "pixels",
      pickable: true,
      autoHighlight: true,
      updateTriggers: { getSourceColor: dim, getTargetColor: dim },
    }),
    closedLinks.length > 0 &&
      stage >= 2 &&
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
      stage >= 4 &&
      new TripsLayer<AssetSegment>({
        id: "flota-estelas",
        data: fleetSegments.filter((s) => isVisible(s.mode)),
        getPath: (s) => s.path,
        getTimestamps: (s) => s.timestamps,
        getColor: (s) => tone(s.mode),
        currentTime: fleetTime,
        trailLength: 1.6,
        fadeTrail: true,
        widthMinPixels: 3,
        capRounded: true,
        jointRounded: true,
        opacity: route ? 0.35 : 0.95,
      }),
    showFleet &&
      stage >= 4 &&
      new ScatterplotLayer<{ s: AssetSegment; p: Position3 }>({
        id: "flota-halo",
        data: fleetHeads,
        getPosition: (d) => d.p,
        getFillColor: (d) => tone(d.s.mode, route ? 25 : 60),
        getRadius: 11,
        radiusUnits: "pixels",
      }),
    showFleet &&
      stage >= 4 &&
      new ScatterplotLayer<{ s: AssetSegment; p: Position3 }>({
        id: "flota",
        data: fleetHeads,
        getPosition: (d) => d.p,
        getFillColor: [255, 255, 255, route ? 120 : 255],
        getLineColor: (d) => tone(d.s.mode),
        stroked: true,
        lineWidthMinPixels: 2,
        getRadius: 3.5,
        radiusUnits: "pixels",
        pickable: true,
      }),

    // Origen y destino elegidos
    new ScatterplotLayer<NodeDatum>({
      id: "seleccion",
      data: network.nodes.features.filter((n) => selectedCities.includes(n.properties.city)),
      getPosition: (n) => n.geometry.coordinates as [number, number],
      getFillColor: [0, 122, 255, 40],
      getLineColor: [0, 122, 255, 255],
      stroked: true,
      filled: true,
      lineWidthMinPixels: 2,
      getRadius: 15,
      radiusUnits: "pixels",
    }),

    // Nodos
    new ScatterplotLayer<NodeDatum>({
      id: "nodos-halo",
      data: nodes.filter((n) => n.properties.kind !== "ciudad"),
      getPosition: (n) => n.geometry.coordinates as [number, number],
      getFillColor: (n) => nodeColor(n.properties.kind, 40),
      getRadius: (n) => NODE_STYLE[n.properties.kind].radius * 2.3,
      radiusUnits: "pixels",
    }),
    new ScatterplotLayer<NodeDatum>({
      id: "nodos",
      data: nodes,
      getPosition: (n) => n.geometry.coordinates as [number, number],
      getFillColor: (n) => nodeColor(n.properties.kind, 255),
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
      stage >= 3 &&
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
      stage >= 4 &&
      new PathLayer({
        id: "ruta-glow",
        data: routeGround,
        getPath: (l) => l.path,
        getColor: (l) => tone(l.mode, 70),
        getWidth: 14,
        widthUnits: "pixels",
        capRounded: true,
        jointRounded: true,
      }),
    route &&
      stage >= 4 &&
      new PathLayer({
        id: "ruta",
        data: routeGround,
        getPath: (l) => l.path,
        getColor: (l) => tone(l.mode),
        getWidth: 4,
        widthUnits: "pixels",
        capRounded: true,
        jointRounded: true,
      }),
    route &&
      stage >= 4 &&
      new PathLayer({
        id: "ruta-aerea",
        data: routeAir,
        getPath: (d) => d.path,
        getColor: tone("aereo"),
        getWidth: 3.5,
        widthUnits: "pixels",
        capRounded: true,
      }),
    route &&
      stage >= 4 &&
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
      stage >= 4 &&
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
      stage >= 4 &&
      new ScatterplotLayer({
        id: "ruta-cabeza",
        data: [routeHead],
        getPosition: (d) => d.p,
        getFillColor: [255, 255, 255, 255],
        getLineColor: (d) => tone(d.mode),
        stroked: true,
        lineWidthMinPixels: 3,
        getRadius: 6,
        radiusUnits: "pixels",
      }),
  ].filter(Boolean);
  return layers;
  };
  // Tras cada renderizado (antes de pintar) deck.gl recibe las capas en el instante actual.
  // React siempre pasa la misma lista vacía, así que no sobrescribe las capas entre cuadros.
  useLayoutEffect(() => {
    buildRef.current = buildLayers;
    deckRef.current?.deck?.setProps({ layers: buildLayers(clockRef.current) as LayerList });
  });

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
    <div ref={containerRef} className={cn("relative h-full min-h-80 w-full overflow-hidden bg-background", className)}>
      <DeckGL
        useDevicePixels={maxPixelRatio}
        viewState={viewState}
        onViewStateChange={({ viewState: v }) => setViewState(v as MapViewState)}
        onInteractionStateChange={onInteractionStateChange}
        controller={{ dragRotate: true, touchRotate: true, scrollZoom: !compact }}
        ref={deckRef}
        layers={NO_LAYERS}
        // Un Deck nuevo (primer montaje, o al volver a una ruta que Next dejó oculta) recibe las capas del instante
        onLoad={() => deckRef.current?.deck?.setProps({ layers: buildRef.current?.(clockRef.current) ?? NO_LAYERS })}
        onHover={onHover}
        onClick={(info) => {
          const o = info.object as NodeDatum | undefined;
          if (o && info.layer?.id === "nodos" && o.properties?.city) onCityClick?.(o.properties.city);
        }}
        getCursor={({ isHovering, isDragging }) => (isDragging ? "grabbing" : isHovering ? "pointer" : "grab")}
      >
        {/* Sin reuseMaps: al volver a una ruta que Next dejó oculta, el mapa se "reusaba" en su mismo contenedor y
            el traslado de nodos de react-map-gl (mientras el contenedor viejo tenga hijos, moverlos al nuevo) no
            terminaba nunca: la pestaña se congelaba en Resumen → otra página → Resumen. */}
        <BaseMap mapStyle={process.env.NEXT_PUBLIC_MAP_STYLE || (dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT)} attributionControl={{ compact: true }} />
      </DeckGL>
      {hover && (
        <div
          className="pointer-events-none absolute z-20 max-w-72 -translate-x-1/2 -translate-y-[calc(100%+14px)] material rounded-lg border border-border-strong px-3.5 py-3 text-xs shadow-xl"
          style={{ left: hover.x, top: hover.y }}
        >
          {hover.content}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
      {compact && (
        <button
          type="button"
          onClick={() => setAnimate(!animate)}
          aria-pressed={animate}
          aria-label={animate ? "Desactivar la animación del mapa al moverlo" : "Activar la animación del mapa al moverlo"}
          title={animate ? "Animación al mover el mapa: activada" : "Animar la flota al mover el mapa (puede ralentizar equipos sin tarjeta gráfica)"}
          className="material press absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full border border-border text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80"
        >
          {animate ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        </button>
      )}
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
      <span className="tabular text-right text-foreground/80">{v}</span>
    </div>
  );
}
