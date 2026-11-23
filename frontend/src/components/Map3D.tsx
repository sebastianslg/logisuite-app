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
import { Map as MapIcon, MapPinOff, Pause, Play } from "lucide-react";
import {
  Deck,
  FlyToInterpolator,
  WebMercatorViewport,
  type MapViewState,
  type PickingInfo,
} from "@deck.gl/core";
import { ArcLayer, PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import { CollisionFilterExtension, PathStyleExtension, type CollisionFilterExtensionProps, type PathStyleExtensionProps } from "@deck.gl/extensions";
import { Map as BaseMap } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { boundsOf, flightArc, positionAt, splitTrip, type Position3, type TripSegment } from "./map/geometry";
import {
  MAPA_ATRIBUCION,
  MAPA_ESTILO_CLARO,
  MAPA_ESTILO_OSCURO,
  MAPA_GIRO,
  MAPA_INCLINACION,
  MAPA_LIMITES,
  MAPA_TONOS,
  MAPA_ZOOM,
  MASCARA_COLOMBIA,
  TIERRA_COLOMBIA,
  dentroDeColombia,
} from "./map/colombia-style";
import { useApp } from "@/components/providers";
import { MODES } from "@/lib/modes";
import { usePrefs } from "@/lib/prefs";
import type { DepartmentsGeo, FleetLive, LiveAsset, Mode, NetworkGeo, RouteResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMapAnimation, useMapBase, useMapQuality } from "@/components/map/use-map-animation";
import { onIdle } from "@/lib/idle";
import { useMedia } from "@/lib/use-media";

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

// Mapa base detallado: teselas de OpenStreetMap vía OpenFreeMap (libres también para uso comercial, sin clave).
// Sin mapa base, el mapa usa su estilo local (sin red) o, si el estilo elegido falla, cae en él para no dejar un
// hueco: la silueta, la máscara y los datos los pinta deck.gl de todos modos.
const MAP_STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
const MAP_STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
// NEXT_PUBLIC_MAP_STYLE puede fijar otro estilo (por ejemplo, teselas locales); sin él se usa OpenFreeMap y, si
// falla, el estilo local.
const MAP_STYLE = process.env.NEXT_PUBLIC_MAP_STYLE;

export const COLOMBIA_VIEW: MapViewState = {
  longitude: -74.2,
  latitude: 3.6,
  zoom: 4.6,
  pitch: 45,
  bearing: -10,
};

/** Mantiene la cámara dentro de Colombia y de los límites de zoom, inclinación y giro. */
function containView(view: MapViewState): MapViewState {
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  return {
    ...view,
    longitude: clamp(view.longitude, MAPA_LIMITES[0][0], MAPA_LIMITES[1][0]),
    latitude: clamp(view.latitude, MAPA_LIMITES[0][1], MAPA_LIMITES[1][1]),
    zoom: clamp(view.zoom, MAPA_ZOOM.min, MAPA_ZOOM.max),
    pitch: clamp(view.pitch ?? 0, MAPA_INCLINACION.min, MAPA_INCLINACION.max),
    bearing: clamp(view.bearing ?? 0, MAPA_GIRO.min, MAPA_GIRO.max),
  };
}

type RGBA = [number, number, number, number];
// La interfaz es tinta (DESIGN.md): el tráfico por departamento va en grafito, no en un color que compita con los modos
const ACCENT_LIGHT: [number, number, number] = [22, 25, 32];
const ACCENT_DARK: [number, number, number] = [238, 239, 242];
/** Qué nombre de ciudad gana cuando dos se tocan en el mapa. */
const LABEL_PRIORITY: Record<string, number> = { cedi: 100, puerto_maritimo: 80, aeropuerto: 60, puerto_fluvial: 40, terminal_ferrea: 20 };

const rgba = (mode: Mode, a = 255, dark = false): RGBA => [...(dark ? MODES[mode].rgbDark : MODES[mode].rgb), a];
// Estado (DESIGN.md): rojo = cierre, naranja = transbordo (los mismos tonos que --danger y --warning)
const DANGER_LIGHT: [number, number, number] = [184, 46, 48];
const DANGER_DARK: [number, number, number] = [244, 122, 121];
const ORANGE: [number, number, number] = [214, 128, 40];

const NODE_STYLE: Record<string, { color: [number, number, number]; mode?: Mode; radius: number }> = {
  aeropuerto: { color: MODES.aereo.rgb, mode: "aereo", radius: 6 },
  puerto_maritimo: { color: MODES.maritimo.rgb, mode: "maritimo", radius: 7 },
  puerto_fluvial: { color: MODES.fluvial.rgb, mode: "fluvial", radius: 5.5 },
  terminal_ferrea: { color: MODES.ferreo.rgb, mode: "ferreo", radius: 5.5 },
  cedi: { color: [22, 25, 32], radius: 6 },
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

/**
 * Encendido por etapas: cada etapa añade las capas que comparten programa de GPU (y su volumen de datos), así
 * deck.gl compila y sube un grupo pequeño por vez en lugar de todo en una sola tarea. Cada número es el `stage`
 * mínimo con el que esa capa ya se dibuja; 0 es el mapa vacío (solo el mar) y 8, el mapa completo.
 *
 * Medido en la apertura de la Red: compilar de golpe era una tarea de 1.443 ms (sección 77 de la bitácora).
 */
const STAGE = {
  land: 1, // máscara y tierra: polígonos planos
  roads: 2, // costa y corredores: líneas
  nodes: 3, // nodos, halos y selección: puntos
  departments: 4, // departamentos extruidos y sus bordes
  closures: 5, // férreo y vías cerradas: líneas punteadas
  flights: 6, // vuelos: arcos
  labels: 7, // nombres de ciudad: texto
  fleet: 8, // flota en vivo y ruta simulada
} as const;
const STAGE_LAST = STAGE.fleet;

/**
 * Suelta los contextos WebGL de los lienzos de un contenedor que se va. Deck finaliza sus capas al desmontarse,
 * pero no el contexto: el navegador no lo libera hasta que pase el recolector. `WEBGL_lose_context` es la única
 * forma que da la web de devolver esa memoria de GPU en el acto (y la que evita que un bucle de idas y vueltas al
 * mapa acumule un contexto por visita).
 */
function loseContexts(root: HTMLElement | null) {
  if (!root) return;
  for (const canvas of Array.from(root.querySelectorAll<HTMLCanvasElement>("canvas"))) {
    try {
      const gl =
        (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ??
        (canvas.getContext("webgl") as WebGLRenderingContext | null);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      // un lienzo sin contexto (o ya perdido) no necesita nada
    }
  }
}

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
  /**
   * Cámara con la que nace el mapa: la última que se vio. Al salir de la ruta el mapa se suelta entero —su contexto
   * WebGL incluido— y con esto se abre donde estaba al volver, en vez de saltar al encuadre inicial. Se lee una sola
   * vez, al crear el mapa: después la cámara es del usuario.
   */
  initialView?: { longitude: number; latitude: number; zoom: number; pitch?: number; bearing?: number } | null;
  /** Se llama cuando cambia la cámara (no en cada cuadro): quien monta el mapa recuerda dónde quedó. */
  onViewChange?: (view: { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number }) => void;
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

/**
 * Solo la Colombia continental, para pantallas angostas: con San Andrés (3° al oeste) el país cabía a lo ancho
 * alejándose tanto que se veían Perú y el Caribe y Colombia quedaba diminuta. La isla queda a un arrastre.
 */
const MAINLAND_BOUNDS: [[number, number], [number, number]] = [
  [-79.1, -4.3],
  [-66.8, 12.5],
];

// Datos de la cartografía propia, una sola vez en el módulo: las capas se rehacen en cada etapa del encendido y
// deck.gl solo vuelve a subir a la GPU lo que cambia de verdad (una lista nueva por etapa lo re-subiría todo).
const MASCARA_DATA = [{ id: "mascara" }];
const TIERRA_DATA = TIERRA_COLOMBIA.map((ring, i) => ({ id: `tierra-${i}`, ring }));

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
  initialView = null,
  onViewChange,
}: Map3DProps) {
  const insetTop = insets?.top ?? 0;
  const insetLeft = insets?.left ?? 0;
  const insetBottom = insets?.bottom ?? 0;
  // Calidad liviana (equipos sin tarjeta gráfica o elegida en Configuración): plano, sin relieve y a 1x
  const { lite } = useMapQuality();
  // Mapa base: MapLibre pinta el mar y la atribución. Apagado (equipos de 4 hilos o 4 GB) no hay segundo lienzo
  // WebGL ni teselas; la silueta y la máscara las sigue dibujando deck.gl.
  const { base, setBase } = useMapBase();
  // Un Deck nuevo no puede reutilizar capas ya finalizadas (Layer._initialize afirma que no hay estado): al cargar
  // un Deck se sube la generación y las capas memorizadas se rehacen.
  const [deckEpoch, setDeckEpoch] = useState(0);
  // En la vista compacta el país sube para no quedar bajo los chips de resumen
  const [viewState, setViewState] = useState<MapViewState>(() => {
    const inicial = compact
      ? { ...COLOMBIA_VIEW, latitude: 1.4, zoom: 4.25, pitch: lite ? 0 : 40, bearing: lite ? 0 : COLOMBIA_VIEW.bearing }
      : lite
        ? { ...COLOMBIA_VIEW, pitch: 0, bearing: 0 }
        : COLOMBIA_VIEW;
    // Un mapa que se crea de nuevo tras soltarse al salir de la ruta nace donde estaba: la cámara no salta.
    return initialView ? containView({ ...inicial, ...initialView }) : inicial;
  });
  const [hover, setHover] = useState<Hover>(null);
  // El mapa base puede ser un estilo externo (NEXT_PUBLIC_MAP_STYLE): si falla, la cartografía propia sigue y se
  // avisa. La máscara, la tierra y los datos los pinta deck.gl, así que nunca queda una pantalla vacía.
  const [baseError, setBaseError] = useState(false);
  // Con el estilo ya cargado, una tesela caída no invalida la cartografía, pero una ráfaga (servidor sin
  // respuesta, sin red) deja huecos: se vuelve a pintar la silueta de deck.gl debajo para que el país no se pierda.
  const [tilesFailed, setTilesFailed] = useState(false);
  const tileErrors = useRef(0);
  const tileErrorsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hasta que MapLibre tiene su estilo cargado, la tierra la pinta deck.gl (evita un hueco del color del mar).
  const [baseReady, setBaseReady] = useState(false);
  const dark = usePrefs().resolved === "dark";
  const tonos = dark ? MAPA_TONOS.oscuro : MAPA_TONOS.claro;
  const { money } = useApp();
  // El reloj de la animación vive en una referencia: no pasa por React en cada cuadro.
  // Así el mapa no se redibuja entero 30 veces por segundo; deck.gl recibe las capas directamente.
  const clockRef = useRef(0);
  const deckRef = useRef<DeckGLRef | null>(null);
  const buildRef = useRef<((t: number) => LayerList) | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { animate, setAnimate } = useMapAnimation();
  // Resolución de dibujado: la nativa de la pantalla para que el mapa se vea nítido, con tope 2 (1,5 si además
  // hay mapa base, que dibuja su propio lienzo); la vista compacta del dashboard y la calidad liviana usan 1.
  const maxPixelRatio =
    typeof window === "undefined" || compact || lite
      ? 1
      : Math.min(window.devicePixelRatio || 1, base ? 1.5 : 2);
  // Límites del controlador de deck.gl (cámara controlada por React). El giro se limita en containView.
  const controller = useMemo(
    () => ({
      dragRotate: !lite,
      touchRotate: !lite,
      scrollZoom: !compact,
      minZoom: MAPA_ZOOM.min,
      maxZoom: MAPA_ZOOM.max,
      minPitch: MAPA_INCLINACION.min,
      maxPitch: MAPA_INCLINACION.max,
    }),
    [compact, lite],
  );

  /**
   * El mapa se suelta con su contenedor. Next conserva oculta la ruta que se deja (Activity) sin quitar el DOM, y
   * aun así no basta: React retira el contenedor cuando el mapa se desmonta de verdad, y ese es el único momento en
   * que su lienzo deja de existir. Ahí se finaliza el Deck (capas, búferes y programas) y se fuerza la pérdida de
   * los contextos WebGL: si no, cada visita dejaba un contexto vivo retenido (54 % de memoria en 20 navegaciones).
   * La marca del contenedor evita que esa pérdida intencional se lea como un fallo del mapa.
   *
   * La liberación espera una tarea: React puede soltar y volver a atar la misma referencia en el mismo commit (lo hace
   * en desarrollo con StrictMode) y el contexto de un mapa que sigue en su sitio no se toca.
   */
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attachContainer = useCallback((node: HTMLDivElement | null) => {
    if (releaseTimer.current) {
      clearTimeout(releaseTimer.current);
      releaseTimer.current = null;
    }
    if (node) {
      containerRef.current = node;
      return;
    }
    const element = containerRef.current;
    if (!element) return;
    releaseTimer.current = setTimeout(() => {
      releaseTimer.current = null;
      if (element.isConnected) return; // sigue en el documento: no era un desmontaje
      containerRef.current = null;
      element.dataset.mapaLiberado = "1";
      const deck = deckRef.current?.deck;
      try {
        if (deck && (deck as unknown as Drawable).layerManager) deck.finalize();
      } catch {
        // Ya finalizado por <DeckGL> (o sin capas que soltar): no hay nada que hacer.
      }
      loseContexts(element);
    }, 0);
  }, []);

  // deck.gl crea una capa de eventos enfocable sin nombre: se la damos para lectores de pantalla.
  useEffect(() => {
    const root = containerRef.current?.querySelector<HTMLElement>(".deck-events-root");
    if (root) {
      root.setAttribute("role", "application");
      root.setAttribute("aria-label", "Mapa de la red multimodal. Arrastra para mover y usa la rueda para acercar.");
    }
  }, []);

  // ---- Encendido por etapas -------------------------------------------
  // Cada etapa añade un grupo de capas con su propio programa de GPU y espera a que el cuadro anterior esté pintado
  // y el navegador quede libre: así la compilación de deck.gl no cae entera en una sola tarea. El orden es el que ya
  // se veía (país, corredores, nodos, relieve, cierres, vuelos, nombres y flota) y al final están todas las capas:
  // no se quita ninguna ni cambia su aspecto.
  // Se empieza cuando el Deck ya existe (su primer cuadro vacío): si las etapas corrieran antes, se saltarían y la
  // primera capa aplicada sería un grupo entero.
  const [deckReady, setDeckReady] = useState(false);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    // Marca de diagnóstico (la lee la prueba de apertura para emparejar cada tarea larga con su etapa).
    performance.mark(`westvane:mapa:etapa:${stage}`);
    if (!deckReady || stage >= STAGE_LAST) return;
    let cancelIdle = () => {};
    // Un cuadro para que deck.gl dibuje lo de esta etapa y luego, en el primer momento libre, la siguiente.
    const frame = requestAnimationFrame(() => {
      cancelIdle = onIdle(() => setStage((s) => s + 1), 240);
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelIdle();
    };
  }, [deckReady, stage]);

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
  // deck.gl llama a este aviso en cada cuadro con «nada activo». Si cada llamada reiniciara el temporizador, el
  // mapa nunca volvería al reposo y el reloj seguiría trabajando. Solo se arma al pasar de activo a quieto.
  const wasActive = useRef(false);
  const onInteractionStateChange = useCallback(
    (s: { isDragging?: boolean; isPanning?: boolean; isZooming?: boolean; isRotating?: boolean }) => {
      const active = !!(s.isDragging || s.isPanning || s.isZooming || s.isRotating);
      if (active) {
        wasActive.current = true;
        if (engageTimer.current) clearTimeout(engageTimer.current);
        setEngaged(true);
        // Tope duro: si deck.gl no avisa del final (arrastre que termina fuera), la animación no queda encendida
        engageTimer.current = setTimeout(() => setEngaged(false), 1200);
      } else if (wasActive.current) {
        wasActive.current = false;
        if (engageTimer.current) clearTimeout(engageTimer.current);
        engageTimer.current = setTimeout(() => setEngaged(false), 300);
      }
    },
    [],
  );
  useEffect(() => () => {
    if (engageTimer.current) clearTimeout(engageTimer.current);
  }, []);
  const running = animate && !paused && (live || engaged);

  // Errores del mapa base. Los de una tesela se cuentan en ráfaga; los del estilo o una fuente caen al estilo local.
  const onBaseError = useCallback((event: { target: { isStyleLoaded(): boolean | void }; tile?: unknown }) => {
    if (event.tile) {
      tileErrors.current += 1;
      if (tileErrorsTimer.current) clearTimeout(tileErrorsTimer.current);
      // La ráfaga se mide con las teselas que fallan a la vez: un 404 suelto no cambia la cartografía.
      tileErrorsTimer.current = setTimeout(() => {
        tileErrors.current = 0;
      }, 4000);
      if (tileErrors.current >= 3) setTilesFailed(true);
      return;
    }
    // Sin tesela es el estilo o una de sus fuentes: se cae al estilo local para no dejar el mar vacío.
    if (!event.target.isStyleLoaded()) setBaseError(true);
  }, []);
  useEffect(() => () => {
    if (tileErrorsTimer.current) clearTimeout(tileErrorsTimer.current);
  }, []);

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
        // Un Deck ya finalizado (ruta oculta por Activity) no puede recibir capas: su Deck se recrea al volver.
        // La misma guarda que _drawLayers evita el «assertion failed» al montar el mapa nuevo.
        const deck = deckRef.current?.deck;
        if (deck && (deck as unknown as Drawable).layerManager) deck.setProps({ layers: buildRef.current?.(t) ?? NO_LAYERS });
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
    // Si el mapa nació con la cámara que se recordó (se creó de nuevo al volver a la ruta), no se re-encuadra.
    if (initialView) return;
    const { width, height } = el.getBoundingClientRect();
    const narrow = width < 768;
    // Los chips y la leyenda flotan sobre el borde inferior; el sur del país (Amazonas) cae al centro y puede
    // pasar por debajo de ellos sin tapar nada importante.
    const padding = compact
      ? { top: 12, bottom: 44, left: 16, right: 16 }
      : narrow
        ? // Abajo, el simulador plegado y el dock ocupan cerca del 22 % de la altura (con 30 % el país quedaba lejano)
          { top: insetTop ? 110 : 16, bottom: insetTop ? Math.round(height * 0.22) : 16, left: 12, right: 12 }
        : { top: 24 + insetTop, bottom: 24 + insetBottom, left: 24 + insetLeft, right: 24 };
    // deck.gl falla si el margen no deja espacio: en ese caso se queda la vista por defecto
    if (width - padding.left - padding.right < 120 || height - padding.top - padding.bottom < 120) return;
    try {
      setViewState((v) => {
        // En celular la cámara arranca plana y sin giro: inclinada, el norte (donde están casi todos los nodos)
        // se encogía y los nombres se encimaban, mientras el sur casi vacío ocupaba media pantalla
        const pitch = narrow ? 0 : (v.pitch ?? 0);
        const bearing = narrow ? 0 : (v.bearing ?? 0);
        const fit = fitTilted(narrow ? MAINLAND_BOUNDS : COLOMBIA_BOUNDS, width, height, padding, pitch, bearing);
        return containView({ ...v, pitch, bearing, longitude: fit.longitude, latitude: fit.latitude, zoom: Math.min(Math.max(fit.zoom, 3.4), 6.4) });
      });
    } catch {
      // Sin encuadre posible se queda la vista por defecto
    }
    // Solo al montar: después la cámara es del usuario
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La cámara se recuerda fuera del mapa: si el mapa se suelta al salir de la ruta y se crea otro al volver, se
  // abre donde estaba. No cambia nada en pantalla; el aviso solo guarda la vista (no hay estado que redibuje).
  useEffect(() => {
    onViewChange?.({
      longitude: viewState.longitude,
      latitude: viewState.latitude,
      zoom: viewState.zoom,
      pitch: viewState.pitch ?? 0,
      bearing: viewState.bearing ?? 0,
    });
  }, [onViewChange, viewState]);

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
      const [pitch, bearing] = lite ? [0, 0] : [50, -12];
      const fit = fitTilted(boundsOf(pts), width, height, padding, pitch, bearing);
      setViewState((v) => containView({
        ...v,
        longitude: fit.longitude,
        latitude: fit.latitude,
        zoom: Math.min(fit.zoom, 7.5),
        pitch,
        bearing,
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
        setViewState((v) => containView({
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
    () =>
      network.links.features.filter(
        (f) => isVisible(f.properties.mode) && f.geometry.coordinates.some(dentroDeColombia),
      ),
    [network, isVisible],
  );
  // Vías cerradas: fuera de las capas normales, en una capa propia (rojo punteado)
  const openLinks = useMemo(() => links.filter((f) => !f.properties.closed), [links]);
  const closedLinks = useMemo(() => links.filter((f) => f.properties.closed), [links]);
  const groundLinks = useMemo(() => openLinks.filter((f) => f.properties.mode !== "aereo"), [openLinks]);
  const airLinks = useMemo(() => openLinks.filter((f) => f.properties.mode === "aereo"), [openLinks]);
  // Filtro Colombia: fuera de la caja del país no se dibuja nada (los datos son nacionales; un punto perdido
  // no debe obligar a alejar la cámara). Los trazados que cruzan el borde se conservan.
  const nodes = useMemo(
    () =>
      (visibleCities ? network.nodes.features.filter((n) => visibleCities.has(n.properties.city)) : network.nodes.features).filter(
        (n) => dentroDeColombia(n.geometry.coordinates),
      ),
    [network, visibleCities],
  );
  // Origen y destino elegidos: se recalculan cuando cambian las ciudades, no en cada cuadro
  const selectedNodes = useMemo(
    () => network.nodes.features.filter((n) => selectedCities.includes(n.properties.city)),
    [network, selectedCities],
  );
  // Una etiqueta por ciudad, sobre su nodo principal
  // En celular solo se rotulan los centros (CEDI y puertos marítimos): con todas las ciudades los nombres se
  // encimaban hasta no leerse. Las demás siguen con su punto y su ficha al tocarlas.
  const narrowScreen = useMedia("(max-width: 767px)");
  const cityLabels = useMemo(() => {
    const rank = narrowScreen
      ? ["cedi", "puerto_maritimo"]
      : ["cedi", "puerto_maritimo", "aeropuerto", "puerto_fluvial", "terminal_ferrea"];
    const best = new Map<string, NodeDatum>();
    for (const n of nodes) {
      const r = rank.indexOf(n.properties.kind);
      if (r < 0) continue;
      const cur = best.get(n.properties.city);
      if (!cur || r < rank.indexOf(cur.properties.kind)) best.set(n.properties.city, n);
    }
    return [...best.values()];
  }, [nodes, narrowScreen]);

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

  // Solo lo visible de la flota: el filtro de modos no se repite en cada cuadro del reloj
  const fleetVisibleSegments = useMemo(
    () => fleetSegments.filter((s) => isVisible(s.mode)),
    [fleetSegments, isVisible],
  );
  const hasRoute = Boolean(route);
  // Con ruta simulada, la red pasa a segundo plano
  const dim = hasRoute ? 0.35 : 1;

  // Colores de modo según el tema (la paleta tiene variante clara y oscura). Estables por tema para que las
  // capas memorizadas solo se rehagan cuando cambia la apariencia.
  const tone = useCallback((m: Mode, a = 255): RGBA => rgba(m, a, dark), [dark]);
  const nodeColor = useCallback(
    (kind: string, a: number): RGBA => {
      const st = NODE_STYLE[kind] ?? NODE_STYLE.ciudad;
      if (st.mode) return rgba(st.mode, a, dark);
      // El CEDI es de la operación propia: va en tinta (grafito en claro, gris claro en oscuro), como la interfaz
      if (kind === "cedi") return [...(dark ? ACCENT_DARK : ACCENT_LIGHT), a] as RGBA;
      return [...st.color, a] as RGBA;
    },
    [dark],
  );

  const haloNodes = useMemo(() => nodes.filter((n) => n.properties.kind !== "ciudad"), [nodes]);
  const roadLinks = useMemo(() => groundLinks.filter((f) => f.properties.mode !== "ferreo"), [groundLinks]);
  const railLinks = useMemo(() => groundLinks.filter((f) => f.properties.mode === "ferreo"), [groundLinks]);

  // ---- Capas estáticas (memoizadas) ------------------------------------
  // El reloj solo rehace lo que se mueve (estelas y cabezas). La cartografía, los corredores, los nodos y la ruta
  // se reutilizan entre cuadros: deck.gl compara props y no vuelve a subir a la GPU lo que no cambió.
  // Con el mapa base cargado, la tierra y la costa vienen en sus teselas: deck.gl solo oscurece lo de fuera. Si el
  // estilo falló o sus teselas dejaron huecos, la silueta propia vuelve a pintarse.
  const showLand = !base || baseError || !baseReady || tilesFailed;
  const baseLayers = useMemo<LayerList>(
    () => [
      // Máscara inversa: el mundo con un hueco por cada anillo del país. Fuera de Colombia se atenúa.
      stage >= STAGE.land &&
        new PolygonLayer<{ id: string }>({
          id: "mascara-colombia",
          data: MASCARA_DATA,
          getPolygon: () => MASCARA_COLOMBIA,
          filled: true,
          extruded: false,
          getFillColor: tonos.mascara,
          pickable: false,
          parameters: { depthWriteEnabled: false },
        }),
      // Tierra: la silueta disuelta de los departamentos, archipiélago incluido y sin líneas internas.
      stage >= STAGE.land &&
        showLand &&
        new PolygonLayer<{ id: string; ring: [number, number][] }>({
          id: "tierra-colombia",
          data: TIERRA_DATA,
          getPolygon: (d) => d.ring,
          filled: true,
          extruded: false,
          getFillColor: tonos.tierra,
          pickable: false,
          parameters: { depthWriteEnabled: false },
        }),
      stage >= STAGE.roads &&
        showLand &&
        new PathLayer<[number, number][]>({
          id: "costa-colombia",
          data: TIERRA_COLOMBIA,
          getPath: (ring) => ring,
          getColor: tonos.costa,
          getWidth: 1,
          widthUnits: "pixels",
          parameters: { depthWriteEnabled: false },
        }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la generación y la etapa rehacen las capas
    [tonos, deckEpoch, showLand, stage],
  );

  const deptLayers = useMemo<LayerList>(
    () => [
      showDepartments &&
        stage >= STAGE.departments &&
        new PolygonLayer<DeptDatum>({
          id: "departamentos",
          data: deptData,
          getPolygon: (d) => d.polygon,
          // Un solo tono del acento por intensidad, como el mapa por departamento. Con una ruta (ficha del envío) van
          // planos y tenues: la ruta es lo que se mira, no el relieve del país.
          extruded: !lite && !hasRoute,
          getElevation: (d) => 800 + d.intensity * 18000,
          getFillColor: (d) =>
            [...(dark ? ACCENT_DARK : ACCENT_LIGHT), Math.round((hasRoute ? 4 : 8) + d.intensity * (hasRoute ? 10 : 24))] as RGBA,
          material: false,
          pickable: true,
          autoHighlight: true,
          highlightColor: [...(dark ? ACCENT_DARK : ACCENT_LIGHT), 40] as RGBA,
          // Translúcido: no escribe profundidad para no ocultar las rutas
          parameters: { depthWriteEnabled: false },
          updateTriggers: { getFillColor: [deptData, dark, hasRoute] },
        }),
      showDepartments &&
        stage >= STAGE.departments &&
        new PathLayer<DeptDatum>({
          id: "departamentos-borde",
          data: deptData,
          getPath: (d) => d.polygon[0] as [number, number][],
          getColor: [148, 163, 184, 70],
          getWidth: 0.8,
          widthUnits: "pixels",
          parameters: { depthWriteEnabled: false },
        }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la generación y la etapa rehacen las capas
    [deptData, dark, lite, hasRoute, stage, showDepartments, deckEpoch],
  );

  const linkLayers = useMemo<LayerList>(
    () => [
      // Resplandor de los corredores de superficie
      stage >= STAGE.roads &&
        new PathLayer<LinkDatum>({
          id: "corredores-glow",
          data: roadLinks,
          getPath: (f) => f.geometry.coordinates as [number, number][],
          getColor: (f) => tone(f.properties.mode, Math.round(38 * dim)),
          getWidth: 7,
          widthUnits: "pixels",
          capRounded: true,
          jointRounded: true,
        }),
      stage >= STAGE.roads &&
        new PathLayer<LinkDatum>({
          id: "corredores",
          data: roadLinks,
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
      stage >= STAGE.closures &&
        new PathLayer<LinkDatum, PathStyleExtensionProps<LinkDatum>>({
          id: "ferreo",
          data: railLinks,
          getPath: (f) => f.geometry.coordinates as [number, number][],
          getColor: tone("ferreo", Math.round(240 * dim)),
          getWidth: 2.4,
          widthUnits: "pixels",
          getDashArray: () => [5, 3],
          dashJustified: true,
          extensions: [new PathStyleExtension({ dash: true })],
          pickable: true,
          autoHighlight: true,
          updateTriggers: { getColor: dim },
        }),
      stage >= STAGE.flights &&
        new ArcLayer<LinkDatum>({
          id: "vuelos",
          data: airLinks,
          getSourcePosition: (f) => f.geometry.coordinates[0] as [number, number],
          getTargetPosition: (f) => f.geometry.coordinates[f.geometry.coordinates.length - 1] as [number, number],
          getSourceColor: tone("aereo", Math.round(150 * dim)),
          getTargetColor: tone("aereo", Math.round(90 * dim)),
          getHeight: 0.42,
          getWidth: 1.2,
          widthUnits: "pixels",
          pickable: true,
          autoHighlight: true,
          updateTriggers: { getSourceColor: [dim, dark], getTargetColor: [dim, dark] },
        }),
      closedLinks.length > 0 &&
        stage >= STAGE.closures &&
        new PathLayer<LinkDatum, PathStyleExtensionProps<LinkDatum>>({
          id: "cerrados",
          data: closedLinks,
          getPath: (f) => f.geometry.coordinates as [number, number][],
          getColor: [...(dark ? DANGER_DARK : DANGER_LIGHT), Math.round(230 * dim)] as RGBA,
          getWidth: 2.6,
          widthUnits: "pixels",
          getDashArray: () => [3, 3],
          dashJustified: true,
          extensions: [new PathStyleExtension({ dash: true })],
          pickable: true,
          autoHighlight: true,
          updateTriggers: { getColor: dim },
        }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la generación rehace las capas para un Deck nuevo
    [airLinks, closedLinks, dark, dim, railLinks, roadLinks, stage, tone, deckEpoch],
  );

  const selectionLayers = useMemo<LayerList>(
    () => [
      // Origen y destino elegidos
      stage >= STAGE.nodes &&
        new ScatterplotLayer<NodeDatum>({
          id: "seleccion",
          data: selectedNodes,
          getPosition: (n) => n.geometry.coordinates as [number, number],
          getFillColor: [0, 122, 255, 40],
          getLineColor: [0, 122, 255, 255],
          stroked: true,
          filled: true,
          lineWidthMinPixels: 2,
          getRadius: 15,
          radiusUnits: "pixels",
        }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la generación y la etapa rehacen las capas
    [selectedNodes, stage, deckEpoch],
  );

  const nodeLayers = useMemo<LayerList>(
    () => [
      // Nodos
      stage >= STAGE.nodes &&
        new ScatterplotLayer<NodeDatum>({
          id: "nodos-halo",
          data: haloNodes,
          getPosition: (n) => n.geometry.coordinates as [number, number],
          getFillColor: (n) => nodeColor(n.properties.kind, 40),
          getRadius: (n) => NODE_STYLE[n.properties.kind].radius * 2.3,
          radiusUnits: "pixels",
          updateTriggers: { getFillColor: dark },
        }),
      stage >= STAGE.nodes &&
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
          updateTriggers: { getFillColor: dark },
        }),
      !compact &&
        stage >= STAGE.labels &&
        new TextLayer<NodeDatum, CollisionFilterExtensionProps<NodeDatum>>({
          id: "nodos-etiquetas",
          data: cityLabels,
          getPosition: (n) => n.geometry.coordinates as [number, number],
          getText: (n) => n.properties.city,
          getSize: 12,
          // Tinta del tema sobre un halo del fondo del mapa: se lee en claro y en oscuro
          getColor: dark ? [235, 235, 245, 235] : [29, 29, 31, 235],
          getPixelOffset: [0, -16],
          fontFamily: "'Inter Variable', Inter, system-ui, -apple-system, sans-serif",
          fontWeight: 600,
          characterSet: "auto",
          fontSettings: { sdf: true },
          outlineWidth: 4,
          outlineColor: dark ? [0, 0, 0, 230] : [255, 255, 255, 235],
          parameters: { depthCompare: "always" },
          // Sin choques: si dos nombres se tocan, queda el del nodo más importante (centro de distribución, luego puerto…).
          // Se recalcula al mover el mapa; en reposo no trabaja.
          extensions: [new CollisionFilterExtension()],
          collisionEnabled: true,
          getCollisionPriority: (n) => LABEL_PRIORITY[n.properties.kind] ?? 0,
          collisionTestProps: { sizeScale: 1.15 },
          updateTriggers: { getColor: dark, outlineColor: dark },
        }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la generación rehace las capas para un Deck nuevo
    [cityLabels, compact, dark, haloNodes, nodeColor, nodes, stage, deckEpoch],
  );

  const routeUnderLayers = useMemo<LayerList>(
    () => [
      // Ruta simulada (debajo del recorrido animado)
      route &&
        stage >= STAGE.fleet &&
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
        stage >= STAGE.fleet &&
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
        stage >= STAGE.fleet &&
        new PathLayer({
          id: "ruta-aerea",
          data: routeAir,
          getPath: (d) => d.path,
          getColor: tone("aereo"),
          getWidth: 3.5,
          widthUnits: "pixels",
          capRounded: true,
        }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la generación rehace las capas para un Deck nuevo
    [route, routeAir, routeGround, stage, tone, deckEpoch],
  );

  const routeOverLayers = useMemo<LayerList>(
    () => [
      route &&
        stage >= STAGE.fleet &&
        new ScatterplotLayer({
          id: "ruta-transbordos",
          data: route.transfers,
          getPosition: (t) => [t.node.lon, t.node.lat],
          getFillColor: [...ORANGE, 255] as RGBA,
          getLineColor: dark ? [0, 0, 0, 255] : [255, 255, 255, 255],
          stroked: true,
          lineWidthMinPixels: 2,
          getRadius: 9,
          radiusUnits: "pixels",
          pickable: true,
        }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la generación rehace las capas para un Deck nuevo
    [dark, route, stage, deckEpoch],
  );

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
    ? fleetVisibleSegments
        .map((s) => ({ s, p: positionAt(s, fleetTime) }))
        .filter((x): x is { s: AssetSegment; p: Position3 } => x.p !== null)
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
  const layers = [
    ...baseLayers,
    ...deptLayers,
    ...linkLayers,

    // Flota en vivo: estelas de luz y cabezas brillantes
    showFleet &&
      stage >= STAGE.fleet &&
      new TripsLayer<AssetSegment>({
        id: "flota-estelas",
        data: fleetVisibleSegments,
        getPath: (s) => s.path,
        getTimestamps: (s) => s.timestamps,
        getColor: (s) => tone(s.mode),
        currentTime: fleetTime,
        trailLength: 1.6,
        fadeTrail: true,
        widthMinPixels: 3,
        capRounded: true,
        jointRounded: true,
        opacity: hasRoute ? 0.35 : 0.95,
        updateTriggers: { getColor: dark },
      }),
    showFleet &&
      stage >= STAGE.fleet &&
      new ScatterplotLayer<{ s: AssetSegment; p: Position3 }>({
        id: "flota-halo",
        data: fleetHeads,
        getPosition: (d) => d.p,
        getFillColor: (d) => tone(d.s.mode, hasRoute ? 25 : 60),
        getRadius: 11,
        radiusUnits: "pixels",
        updateTriggers: { getFillColor: [dark, hasRoute] },
      }),
    showFleet &&
      stage >= STAGE.fleet &&
      new ScatterplotLayer<{ s: AssetSegment; p: Position3 }>({
        id: "flota",
        data: fleetHeads,
        getPosition: (d) => d.p,
        getFillColor: [255, 255, 255, hasRoute ? 120 : 255],
        getLineColor: (d) => tone(d.s.mode),
        stroked: true,
        lineWidthMinPixels: 2,
        getRadius: 3.5,
        radiusUnits: "pixels",
        pickable: true,
        updateTriggers: { getLineColor: dark },
      }),

    // Origen y destino elegidos, nodos y etiquetas (memoizados)
    ...selectionLayers,
    ...nodeLayers,

    // Ruta simulada (capas fijas memoizadas)
    ...routeUnderLayers,
    route &&
      stage >= STAGE.fleet &&
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
    ...routeOverLayers,
    route &&
      routeHead &&
      stage >= STAGE.fleet &&
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
        updateTriggers: { getLineColor: dark },
      }),
  ].filter(Boolean);
  return layers;
  };
  // Tras cada renderizado (antes de pintar) deck.gl recibe las capas en el instante actual.
  // React siempre pasa la misma lista vacía, así que no sobrescribe las capas entre cuadros.
  useLayoutEffect(() => {
    buildRef.current = buildLayers;
    // Un Deck ya finalizado (ruta oculta por Activity) no admite capas; el Deck nuevo las recibe en su onLoad.
    // La misma guarda que _drawLayers evita el «assertion failed» al volver al mapa.
    const deck = deckRef.current?.deck;
    if (!deck || !(deck as unknown as Drawable).layerManager) return;
    deck.setProps({ layers: buildLayers(clockRef.current) as LayerList });
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
          {p.approximate && <div className="mt-1 text-xs text-muted-foreground">Trazado y distancia aproximados</div>}
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
    <div
      ref={attachContainer}
      data-testid="mapa-colombia"
      data-lng={viewState.longitude.toFixed(3)}
      data-lat={viewState.latitude.toFixed(3)}
      data-zoom={viewState.zoom.toFixed(2)}
      data-pitch={(viewState.pitch ?? 0).toFixed(1)}
      data-bearing={(viewState.bearing ?? 0).toFixed(1)}
      data-map-land={showLand ? "local" : "base"}
      data-map-stage={stage}
      data-running={running ? "1" : "0"}
      data-engaged={engaged ? "1" : "0"}
      data-live={live ? "1" : "0"}
      style={{ backgroundColor: tonos.mar }}
      className={cn("relative h-full min-h-80 w-full overflow-hidden", className)}
    >
      <DeckGL
        useDevicePixels={maxPixelRatio}
        viewState={lite && (viewState.pitch || viewState.bearing) ? { ...viewState, pitch: 0, bearing: 0 } : viewState}
        onViewStateChange={({ viewState: v }) => setViewState(containView(v as MapViewState))}
        onInteractionStateChange={onInteractionStateChange}
        controller={controller}
        ref={deckRef}
        layers={NO_LAYERS}
        // Un Deck nuevo (primer montaje, o al volver a una ruta que Next dejó oculta) recibe las capas del instante
        onLoad={() => {
          // Un Deck nuevo no puede reutilizar capas finalizadas: la generación obliga a rehacerlas en el siguiente
          // efecto de diseño (que ya corre antes de pintar) y deja el mapa listo para las pruebas y el diagnóstico.
          setDeckEpoch((e) => e + 1);
          // Hasta que el Deck existe no se encienden las etapas: el primer cuadro va vacío y cada grupo de capas
          // llega en su propia tarea.
          setDeckReady(true);
          containerRef.current?.setAttribute("data-map-ready", "1");
        }}
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
        {base && (
          <BaseMap
            mapStyle={
              baseError
                ? dark
                  ? MAPA_ESTILO_OSCURO
                  : MAPA_ESTILO_CLARO
                : MAP_STYLE || (dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT)
            }
            attributionControl={{ compact: true, customAttribution: MAPA_ATRIBUCION }}
            interactive={false}
            renderWorldCopies={false}
            minZoom={MAPA_ZOOM.min}
            maxZoom={MAPA_ZOOM.max}
            maxPitch={MAPA_INCLINACION.max}
            fadeDuration={0}
            onLoad={() => setBaseReady(true)}
            onError={onBaseError}
          />
        )}
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
      {(!base || baseError) && !compact && (
        <p
          data-testid="mapa-atribucion"
          className="pointer-events-none absolute right-2 bottom-2 z-10 text-xs text-muted-foreground"
        >
          {MAPA_ATRIBUCION}
        </p>
      )}
      {base && (baseError || tilesFailed) && !compact && (
        <p
          role="status"
          className="pointer-events-none absolute right-2 bottom-7 z-10 max-w-64 rounded bg-background/85 px-1.5 py-0.5 text-right text-xs text-warning"
        >
          {baseError
            ? "El mapa base no cargó; se muestra la cartografía local."
            : "Las teselas del mapa base no cargaron; se muestra la silueta local."}
        </p>
      )}
      {!compact && (
        <button
          type="button"
          data-testid="mapa-base"
          onClick={() => {
            setBaseError(false);
            setBaseReady(false);
            setTilesFailed(false);
            tileErrors.current = 0;
            setBase(!base);
          }}
          aria-pressed={base}
          aria-label="Mapa base"
          title={
            base
              ? "Mapa base activado: teselas de OpenFreeMap (o el estilo configurado)"
              : "Mapa base desactivado: cartografía propia, sin teselas ni segundo lienzo WebGL"
          }
          className="material press absolute top-3 right-3 z-10 flex h-11 w-11 items-center justify-center gap-1.5 rounded-full border border-border text-xs text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80 sm:h-9 sm:w-auto sm:px-3 pointer-coarse:h-11"
        >
          {base ? <MapIcon className="size-4" aria-hidden /> : <MapPinOff className="size-4" aria-hidden />}
          <span className="hidden sm:inline">Mapa base</span>
        </button>
      )}
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
