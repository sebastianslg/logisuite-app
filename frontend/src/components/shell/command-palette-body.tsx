"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CornerDownLeft,
  FileText,
  Fuel,
  History,
  Keyboard,
  LayoutDashboard,
  Leaf,
  MapPin,
  Moon,
  Network,
  Package,
  PackagePlus,
  Scale,
  ScrollText,
  Search,
  Settings,
  Sun,
  TrafficCone,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import { rememberCode } from "@/components/shipments/shared-code";
import { OPEN_SHORTCUTS_EVENT, shortcutFor } from "@/components/shell/shortcuts";
import { useApp } from "@/components/providers";
import { getAuthToken } from "@/lib/auth";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

/** Una fila de la paleta: comando, acción o resultado. `href` permite precargar la ruta al pasar el puntero. */
export interface PaletteResult {
  id: string;
  group: string;
  /** Bloque al que pertenece la fila («Resultados» para lo que trae el servidor); sin bloque, la lista de siempre. */
  section?: string;
  label: string;
  hint?: string;
  /** Atajos que ejecutan la misma acción, para mostrarlos a la derecha (por ejemplo «g», «e»). */
  keys?: string[];
  href?: string;
  icon: LucideIcon;
  run: () => void;
}

interface ShipmentRow {
  code: string;
  origin: string;
  destination: string;
}
interface CityRow {
  city: string;
  category: string;
}
interface VehicleRow {
  id: number;
  code: string;
  vehicle_type: string;
  mode_label: string;
  home_name?: string;
}
interface WarehouseRow {
  warehouse_id: number;
  code: string;
  name: string;
  city: string;
}
interface CorridorRow {
  corridor: string;
  active: boolean;
  distance_fmt: string;
}

/** Tipos de la búsqueda del servidor (/api/search), con su grupo en español y su ícono. */
const KIND: Record<string, { group: string; icon: LucideIcon }> = {
  envio: { group: "Envíos", icon: Package },
  vehiculo: { group: "Vehículos", icon: Truck },
  bodega: { group: "Bodegas", icon: Warehouse },
  cliente: { group: "Clientes", icon: Users },
};
const KIND_ORDER = Object.keys(KIND);

interface Hit {
  type?: string;
  title?: string;
  subtitle?: string;
  href?: string;
}
interface SearchResponse {
  items?: Hit[];
  truncated?: boolean;
}
type ServerSearch = { term: string; status: "done" | "error"; items: Hit[]; truncated: boolean };

/**
 * Convierte lo que devolvió /api/search en filas de la paleta, agrupadas por tipo en el orden de «Envíos, Vehículos,
 * Bodegas, Clientes». Tolera campos que falten y enlaces que no sean de la app (se descartan).
 */
function serverItems(hits: Hit[] | undefined, go: (href: string) => () => void): PaletteResult[] {
  if (!Array.isArray(hits)) return [];
  return hits
    .map((hit, index) => ({
      hit,
      index,
      order: hit && typeof hit.type === "string" && KIND[hit.type] ? KIND_ORDER.indexOf(hit.type) : KIND_ORDER.length,
    }))
    .sort((a, b) => a.order - b.order)
    .map(({ hit, index }): PaletteResult | null => {
      if (!hit || typeof hit.href !== "string" || !hit.href.startsWith("/")) return null;
      const tipo = typeof hit.type === "string" ? KIND[hit.type] : undefined;
      const label = hit.title || hit.subtitle || hit.href;
      return {
        id: `sr-${index}`,
        section: "Resultados",
        group: tipo?.group ?? "Otros resultados",
        label,
        hint: hit.title && hit.subtitle ? hit.subtitle : undefined,
        icon: tipo?.icon ?? Search,
        href: hit.href,
        run: go(hit.href),
      };
    })
    .filter((it): it is PaletteResult => it !== null);
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/* --------------------------------------------------------------------------
 * Datos de la paleta. Se piden la primera vez que se abre y quedan en el módulo:
 * cerrar y volver a abrir no repite cinco peticiones cuando ya llegaron todas.
 * Si alguna falló, al reabrir se reintenta y se conserva lo último válido.
 * ------------------------------------------------------------------------ */
interface PaletteData {
  shipments: ShipmentRow[];
  cities: CityRow[];
  vehicles: VehicleRow[];
  warehouses: WarehouseRow[];
  corridors: CorridorRow[];
}
let cached: PaletteData | null = null;
/** La última carga dejó listas sin respuesta: la siguiente apertura lo vuelve a intentar. */
let incompleto = false;
let pending: Promise<PaletteData> | null = null;

/**
 * Lee una lista de la API. Devuelve `null` si la petición o la respuesta fallaron: así se distingue
 * «no hay elementos» (una lista vacía de verdad) de «no se pudo cargar» (no se guarda como si lo fuera).
 */
async function listOf<T>(url: string, field: string): Promise<T[] | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const list = data && typeof data === "object" ? (data as Record<string, unknown>)[field] : null;
    return Array.isArray(list) ? (list as T[]) : null;
  } catch {
    return null;
  }
}

/** ¿Se puede abrir la paleta sin pedir los datos otra vez? Solo si la última carga fue completa. */
function paletteDataReady() {
  return cached !== null && !incompleto;
}

function loadPaletteData(): Promise<PaletteData> {
  if (cached && !incompleto) return Promise.resolve(cached);
  if (!pending) {
    pending = Promise.all([
      listOf<ShipmentRow>("/api/shipments?limit=100", "items"),
      listOf<CityRow>("/api/locations", "cities"),
      listOf<VehicleRow>("/api/fleet/vehicles", "items"),
      listOf<WarehouseRow>("/api/warehouses", "items"),
      listOf<CorridorRow>("/api/corridors", "items"),
    ])
      .then(([shipments, cities, vehicles, warehouses, corridors]) => {
        // Un fallo no borra lo que ya se mostraba: se completa con la última lista válida de cada tipo
        const data: PaletteData = {
          shipments: shipments ?? cached?.shipments ?? [],
          cities: cities ?? cached?.cities ?? [],
          vehicles: vehicles ?? cached?.vehicles ?? [],
          warehouses: warehouses ?? cached?.warehouses ?? [],
          corridors: corridors ?? cached?.corridors ?? [],
        };
        incompleto = [shipments, cities, vehicles, warehouses, corridors].some((lista) => lista === null);
        // Si todo falló no se guarda una paleta vacía como si fuera buena: la siguiente apertura reintenta
        if (shipments || cities || vehicles || warehouses || corridors) cached = data;
        return data;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

function PaletteHeading({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn("px-3 pt-2 pb-1 text-xs font-semibold", strong ? "text-foreground/80" : "text-muted-foreground")}>
      {children}
    </div>
  );
}

/** Teclas de una fila, en el mismo trazo que las del pie (no llevan foco propio). */
function Keys({ keys }: { keys: string[] }) {
  return (
    <span aria-hidden className="ml-auto flex shrink-0 items-center gap-1">
      {keys.map((k, i) => (
        <kbd
          key={`${k}-${i}`}
          className="inline-flex min-w-5 items-center justify-center rounded-md border border-border-strong px-1 text-[11px] leading-4 font-medium"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

/**
 * Lista y búsqueda de la paleta. Es el trozo pesado (íconos, datos y filtros): la primera pantalla solo lleva el
 * marco y el campo de texto, que recibe el foco y la primera tecla mientras este trozo termina de llegar.
 * Publica las filas al marco (`onResults`) para que Intro ejecute la resaltada y para `aria-activedescendant`.
 */
export function CommandPaletteBody({
  q,
  active,
  setActive,
  onClose,
  onResults,
  onActiveId,
}: {
  q: string;
  active: number;
  setActive: (index: number) => void;
  onClose: () => void;
  onResults: (items: PaletteResult[]) => void;
  onActiveId: (id: string | undefined) => void;
}) {
  const router = useRouter();
  const { setTheme } = usePrefs();
  const { setCurrency, fx } = useApp();
  const [data, setData] = useState<PaletteData | null>(cached);
  const [server, setServer] = useState<ServerSearch>({ term: "", status: "done", items: [], truncated: false });
  const needle = q.trim();
  const listRef = useRef<HTMLUListElement>(null);

  // Los datos se piden al montar (la paleta ya se abrió) y se conservan al cerrarla: la segunda apertura es instantánea.
  // Si quedó alguna lista sin cargar, cada reapertura lo reintenta y muestra mientras tanto lo último válido.
  useEffect(() => {
    if (paletteDataReady()) return;
    let alive = true;
    void loadPaletteData().then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  const go = useCallback(
    (href: string) => () => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const items = useMemo<PaletteResult[]>(() => {
    const base: PaletteResult[] = [
      { id: "p-home", group: "Ir a", label: "Resumen", icon: LayoutDashboard, href: "/panel", keys: shortcutFor("/panel"), run: go("/panel") },
      { id: "p-env", group: "Ir a", label: "Envíos", icon: Package, href: "/envios", keys: shortcutFor("/envios"), run: go("/envios") },
      { id: "p-red", group: "Ir a", label: "Red multimodal", icon: Network, href: "/red", keys: shortcutFor("/red"), run: go("/red") },
      { id: "p-fuel", group: "Ir a", label: "Combustible", icon: Fuel, href: "/combustible", keys: shortcutFor("/combustible"), run: go("/combustible") },
      { id: "p-co2", group: "Ir a", label: "Huella de carbono", icon: Leaf, href: "/huella", keys: shortcutFor("/huella"), run: go("/huella") },
      { id: "p-vias", group: "Ir a", label: "Vías y cierres", icon: TrafficCone, href: "/vias", keys: shortcutFor("/vias"), run: go("/vias") },
      { id: "p-fleet", group: "Ir a", label: "Flota de vehículos", icon: Truck, href: "/flota", keys: shortcutFor("/flota"), run: go("/flota") },
      { id: "p-wh", group: "Ir a", label: "Bodegas", icon: Warehouse, href: "/bodegas", keys: shortcutFor("/bodegas"), run: go("/bodegas") },
      { id: "p-hist", group: "Ir a", label: "Historial de trayectos", hint: "Por ciudad, departamento y corredor", icon: History, href: "/historial", keys: shortcutFor("/historial"), run: go("/historial") },
      { id: "p-aud", group: "Ir a", label: "Auditoría", hint: "Quién cambió qué y cuándo", icon: ScrollText, href: "/auditoria", run: go("/auditoria") },
      { id: "p-metodo", group: "Ir a", label: "Metodología", hint: "Cómo se calculan rutas, costos y huella", icon: BookOpen, href: "/metodologia", run: go("/metodologia") },
      { id: "p-creditos", group: "Ir a", label: "Créditos y licencias", hint: "Fuentes de datos, mapas y software de terceros", icon: BookOpen, href: "/creditos", run: go("/creditos") },
      { id: "p-hoy", group: "Ir a", label: "Hoy", hint: "Salidas, llegadas y entregas por firmar", icon: CalendarClock, href: "/hoy", run: go("/hoy") },
      { id: "p-cal", group: "Ir a", label: "Calendario de envíos", hint: "Qué sale y qué llega", icon: CalendarDays, href: "/calendario", run: go("/calendario") },
      { id: "p-cli", group: "Ir a", label: "Clientes", hint: "Envíos, puntualidad y flete por cliente", icon: Users, href: "/clientes", run: go("/clientes") },
      { id: "p-cmp", group: "Ir a", label: "Comparar rutas", hint: "Escenarios lado a lado", icon: Scale, href: "/comparar", run: go("/comparar") },
      { id: "p-cot", group: "Ir a", label: "Cotización", hint: "Precio de un traslado con margen", icon: FileText, href: "/cotizacion", run: go("/cotizacion") },
      { id: "p-cfg", group: "Ir a", label: "Configuración", icon: Settings, href: "/configuracion", keys: shortcutFor("/configuracion"), run: go("/configuracion") },
      { id: "a-veh", group: "Acciones", label: "Agregar un vehículo", hint: "Flota", icon: Truck, href: "/flota/nuevo", run: go("/flota/nuevo") },
      { id: "a-wh", group: "Acciones", label: "Crear una bodega", hint: "Bodegas", icon: Warehouse, href: "/bodegas/nueva", run: go("/bodegas/nueva") },
      { id: "a-new", group: "Acciones", label: "Crear envío", hint: "Simulador de rutas", icon: PackagePlus, href: "/envios/nuevo", keys: ["n"], run: go("/envios/nuevo") },
      { id: "a-rep", group: "Acciones", label: "Descargar el reporte semanal", hint: "PDF", icon: FileText, run: () => { onClose(); window.open("/api/reports/operations?days=7", "_blank", "noopener"); } },
      ...(fx?.rate ? [{ id: "a-cop", group: "Acciones" as const, label: "Mostrar costos en pesos (COP)", icon: Banknote, run: () => { setCurrency("COP"); onClose(); } }] : []),
      { id: "a-usd", group: "Acciones", label: "Mostrar costos en dólares (USD)", icon: Banknote, run: () => { setCurrency("USD"); onClose(); } },
      { id: "a-keys", group: "Acciones", label: "Ver atajos de teclado", hint: "?", icon: Keyboard, keys: ["?"], run: () => { onClose(); setTimeout(() => window.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT)), 0); } },
      { id: "a-light", group: "Acciones", label: "Apariencia: claro", icon: Sun, run: () => { setTheme("light"); onClose(); } },
      { id: "a-dark", group: "Acciones", label: "Apariencia: oscuro", icon: Moon, run: () => { setTheme("dark"); onClose(); } },
    ];
    const shipments = (data?.shipments ?? []).map<PaletteResult>((s) => ({
      id: `s-${s.code}`, group: "Envíos", label: s.code, hint: `${s.origin} → ${s.destination}`,
      icon: Package, href: `/envios/${s.code}`,
      // El código vuela desde la paleta hasta el encabezado del detalle
      run: () => {
        rememberCode(s.code, document.querySelector(`[data-code="${CSS.escape(s.code)}"]`));
        go(`/envios/${s.code}`)();
      },
    }));
    const cities = (data?.cities ?? []).map<PaletteResult>((c) => ({
      id: `c-${c.city}`, group: "Ciudades", label: c.city, hint: "Ver en el mapa",
      icon: MapPin, href: `/red?ciudad=${encodeURIComponent(c.city)}`, run: go(`/red?ciudad=${encodeURIComponent(c.city)}`),
    }));
    const vehicles = (data?.vehicles ?? []).map<PaletteResult>((v) => ({
      id: `v-${v.id}`, group: "Vehículos", label: v.code, hint: `${v.vehicle_type} · ${v.mode_label}${v.home_name ? ` · ${v.home_name}` : ""}`,
      icon: Truck, href: `/flota/${v.id}`, run: go(`/flota/${v.id}`),
    }));
    const warehouses = (data?.warehouses ?? []).map<PaletteResult>((w) => ({
      id: `w-${w.warehouse_id}`, group: "Bodegas", label: w.name, hint: `${w.code} · ${w.city}`,
      icon: Warehouse, href: `/bodegas/${w.warehouse_id}`, run: go(`/bodegas/${w.warehouse_id}`),
    }));
    const corridors = (data?.corridors ?? []).map<PaletteResult>((c) => ({
      id: `r-${c.corridor}`, group: "Vías", label: c.corridor, hint: `${c.active ? "Activa" : "Cerrada"} · ${c.distance_fmt}`,
      icon: TrafficCone, href: "/vias", run: go("/vias"),
    }));
    return [...base, ...shipments, ...cities, ...vehicles, ...warehouses, ...corridors];
  }, [data, go, onClose, setCurrency, setTheme, fx]);

  const localResults = useMemo(() => {
    const texto = norm(q.trim());
    if (!texto) return items.filter((i) => i.group === "Ir a" || i.group === "Acciones");
    return items
      .filter((i) => norm(`${i.label} ${i.hint ?? ""}`).includes(texto))
      .sort((a, b) => Number(norm(b.label).startsWith(texto)) - Number(norm(a.label).startsWith(texto)))
      .slice(0, 30);
  }, [items, q]);

  // Resultados del servidor: se piden 250 ms después de dejar de escribir, desde 2 caracteres y cancelando la
  // petición anterior. Si la API falla, la paleta sigue con los comandos y lo ya cargado, sin aviso ruidoso.
  useEffect(() => {
    if (needle.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const token = getAuthToken();
      fetch(`/api/search?q=${encodeURIComponent(needle)}&limit=5`, {
        cache: "no-store",
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
        .then((r) => {
          if (!r.ok) throw new Error(`Error ${r.status}`);
          return r.json() as Promise<SearchResponse>;
        })
        .then((result) => {
          if (controller.signal.aborted) return;
          setServer({
            term: needle,
            status: "done",
            items: Array.isArray(result?.items) ? result.items : [],
            truncated: result?.truncated === true,
          });
          // Las filas del servidor entran delante de las demás: el resaltado vuelve a la primera para que Intro abra
          // lo que se ve resaltado y no otra fila que acaba de ocupar ese lugar
          setActive(0);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setServer({ term: needle, status: "error", items: [], truncated: false });
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [needle, setActive]);

  const serverFor = server.term === needle ? server : null;
  const serverResults = useMemo(
    () => (serverFor?.status === "done" ? serverItems(serverFor.items, go) : []),
    [serverFor, go],
  );
  const buscandoServidor = needle.length >= 2 && !serverFor;
  // «Sin resultados» solo si tampoco hay coincidencias locales (comandos o lo ya cargado) que mostrar
  const sinServidor =
    needle.length >= 2 && !buscandoServidor && serverFor?.status === "done" && serverResults.length === 0 &&
    localResults.length === 0;
  // Lo del servidor va primero (la sección «Resultados») y después los comandos y lo que ya estaba cargado, sin
  // repetir lo que el servidor ya trajo (mismo grupo y mismo título)
  const results = useMemo(() => {
    const vistos = new Set(serverResults.map((r) => `${r.group}|${r.label}`));
    return [...serverResults, ...localResults.filter((r) => !vistos.has(`${r.group}|${r.label}`))];
  }, [serverResults, localResults]);

  // El marco necesita la lista para Intro y el índice para aria-activedescendant; no se copia en estado
  useEffect(() => {
    onResults(results);
    onActiveId(results[active]?.id);
  }, [results, active, onResults, onActiveId]);

  // Si la lista se acorta (un filtro o el servidor), el resaltado no puede quedar fuera
  useEffect(() => {
    if (active > results.length - 1) setActive(Math.max(0, results.length - 1));
  }, [results.length, active, setActive]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <ul id="palette-list" role="listbox" ref={listRef} className="max-h-[50dvh] overflow-y-auto p-2">
      {buscandoServidor && (
        <>
          <li role="presentation">
            <PaletteHeading strong>Resultados</PaletteHeading>
          </li>
          <li role="presentation" aria-live="polite" className="px-3 pb-2 text-xs text-muted-foreground">
            Buscando…
          </li>
        </>
      )}
      {sinServidor && (
        <>
          <li role="presentation">
            <PaletteHeading strong>Resultados</PaletteHeading>
          </li>
          <li role="presentation" className="px-3 pb-2 text-xs text-muted-foreground">
            Sin resultados.
          </li>
        </>
      )}
      {results.map((it, i) => {
        const Icon = it.icon;
        const prev = i > 0 ? results[i - 1] : null;
        const showSection = !!it.section && it.section !== prev?.section;
        const showGroup = showSection || !prev || prev.section !== it.section || prev.group !== it.group;
        return (
          <li key={it.id} role="presentation">
            {showSection && <PaletteHeading strong>{it.section}</PaletteHeading>}
            {showGroup && <PaletteHeading>{it.group}</PaletteHeading>}
            <div
              id={`palette-${it.id}`}
              role="option"
              aria-selected={i === active}
              data-index={i}
              onMouseMove={() => setActive(i)}
              // El puntero muestra intención: la ruta se pide antes del clic (nunca al montar la lista)
              onPointerEnter={() => {
                setActive(i);
                if (it.href) router.prefetch(it.href);
              }}
              onClick={it.run}
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm",
                i === active ? "bg-solid text-primary-foreground" : "",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="truncate font-medium" data-code={it.group === "Envíos" ? it.label : undefined}>
                {it.label}
              </span>
              {it.hint && (
                <span className={cn("truncate text-xs", i === active ? "opacity-80" : "text-muted-foreground")}>
                  {it.hint}
                </span>
              )}
              {it.keys && <Keys keys={it.keys} />}
              {i === active && <CornerDownLeft className={cn("size-4 shrink-0 opacity-80", !it.keys && "ml-auto")} aria-hidden />}
            </div>
          </li>
        );
      })}
      {serverFor?.status === "done" && serverFor.truncated && serverResults.length > 0 && (
        <li role="presentation" className="px-3 pt-1 pb-2 text-xs text-muted-foreground">
          Hay más coincidencias: escribe un poco más para acotar.
        </li>
      )}
      {results.length === 0 && !buscandoServidor && !sinServidor && (
        <li className="px-3 py-8 text-center text-sm text-muted-foreground">Sin resultados para “{q.trim()}”.</li>
      )}
    </ul>
  );
}
