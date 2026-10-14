// Tipos de las respuestas de la API FastAPI (backend/app/main.py).

export type Mode = "terrestre" | "fluvial" | "maritimo" | "aereo" | "ferreo";
export type Priority = "tiempo" | "costo" | "balanceado";
export type ShipmentStatus =
  | "Programado"
  | "En Ruta"
  | "Transferencia Modal"
  | "Retrasado"
  | "Entregado";

export interface Kpi {
  value: number | null;
  fmt: string;
}

export interface DashboardSummary {
  generated_at: string;
  status_counts: Record<ShipmentStatus, number>;
  kpis: {
    active: Kpi;
    in_transfer: Kpi;
    delayed: Kpi;
    tons_in_transit: Kpi;
    cost_in_transit: Kpi;
    otif: Kpi;
    delivered: Kpi;
    scheduled: Kpi;
  };
  modal_split: { mode: Mode; label: string; tkm: number; tkm_fmt: string; share_pct: number }[];
  top_corridors: { corridor: string; tons: number; tons_fmt: string }[];
  all_corridors: { corridor: string; tons: number; tons_fmt: string }[];
  dispatches_14d: { date: string; count: number }[];
  alerts: { closed_corridors: string[]; no_route: string[] };
  network: {
    nodes: number;
    links: number;
    modes: { mode: Mode; label: string; links: number; km: number; km_fmt: string }[];
  };
}

export interface NodeBrief {
  code: string;
  name: string;
  city: string;
  kind: string;
  lon: number;
  lat: number;
}

export interface Asset {
  id: string;
  type: string;
  units: number;
  carrier: string;
}

export interface Leg {
  mode: Mode;
  mode_label: string;
  from: NodeBrief;
  to: NodeBrief;
  corridors: string[];
  distance_km: number;
  distance_fmt: string;
  time_h: number;
  time_fmt: string;
  cost: number;
  cost_fmt: string;
  start_h: number;
  end_h: number;
  path: [number, number][];
  asset?: Asset;
  /** Tramo cortado por el cierre de una vía (lo recorrido antes del desvío). */
  interrupted?: boolean;
  /** Regreso al nodo anterior a la vía cerrada. */
  detour?: boolean;
}

export interface Transfer {
  node: NodeBrief;
  from_mode: Mode;
  to_mode: Mode;
  label: string;
  start_h: number;
  time_h: number;
  time_fmt: string;
  cost: number;
  cost_fmt: string;
}

export interface Trip {
  path: [number, number][];
  timestamps: number[];
  modes: string[];
}

export interface Footprint {
  co2e_kg: number;
  co2e_fmt: string;
  fuel_l: number;
  fuel_fmt: string;
  intensity_g_tkm: number;
  baseline_co2e_kg: number;
  baseline_fuel_l: number;
  /** Positivo: emite menos que mover todo por carretera. */
  saved_vs_road_pct: number;
  per_leg: { co2e_kg: number; fuel_l: number }[];
  by_mode: { mode: Mode; label: string; fuel_type: string; co2e_kg: number; fuel_l: number }[];
}

export type CityCategory = "principal" | "municipio" | "dificil_acceso";

export interface Shipment {
  code: string;
  origin: string;
  destination: string;
  cargo: string;
  client: string;
  weight_t: number;
  weight_fmt: string;
  priority: Priority;
  status: ShipmentStatus;
  modes: Mode[];
  mode_labels: string[];
  current_mode: Mode | null;
  n_transfers: number;
  distance_km: number;
  distance_fmt: string;
  time_h: number;
  time_fmt: string;
  cost: number;
  cost_fmt: string;
  departure_at: string;
  eta_at: string;
  eta_fmt: string;
  delay_h: number;
  delay_fmt: string | null;
  progress_pct: number;
  source: "seed" | "auto" | "manual";
  route_status: "ok" | "sin_ruta";
  route_note: string | null;
  forced_modes: Mode[];
  forced_corridors: string[];
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  legs?: Leg[];
  transfers?: Transfer[];
  trip?: Trip;
  footprint?: Footprint;
}

export interface RouteResult {
  origin: string;
  destination: string;
  priority: Priority;
  weight_t: number;
  weight_fmt: string;
  modes: Mode[];
  mode_labels: string[];
  n_transfers: number;
  distance_km: number;
  distance_fmt: string;
  time_h: number;
  time_fmt: string;
  cost: number;
  cost_fmt: string;
  cost_per_t: number;
  cost_per_t_fmt: string;
  legs: Leg[];
  transfers: Transfer[];
  trip: Trip;
}

export interface RouteAlternative {
  priority: Priority;
  found: boolean;
  error?: string;
  modes?: Mode[];
  n_transfers?: number;
  time_h?: number;
  time_fmt?: string;
  cost?: number;
  cost_fmt?: string;
  distance_km?: number;
  distance_fmt?: string;
  co2e_kg?: number;
  co2e_fmt?: string;
  fuel_l?: number;
  fuel_fmt?: string;
}

export interface SimulateResponse {
  route: RouteResult;
  alternatives: RouteAlternative[];
  footprint: Footprint;
}

export interface LiveAsset {
  id: string;
  asset_type: string | null;
  carrier: string | null;
  units: number;
  shipment_code: string;
  status: ShipmentStatus;
  mode: Mode;
  mode_label: string;
  lon: number;
  lat: number;
  bearing: number;
  progress_pct: number;
  origin: string;
  destination: string;
  next_stop: string;
  cargo: string;
  weight_fmt: string;
  eta_at: string;
  trip: Trip;
}

export interface FleetLive {
  generated_at: string;
  count: number;
  by_mode: Partial<Record<Mode, number>>;
  assets: LiveAsset[];
}

export interface CityOption {
  city: string;
  department_code: string;
  category: CityCategory;
  lat: number;
  lon: number;
  kinds: string[];
  modes: Mode[];
  nodes: { code: string; name: string; kind: string }[];
}

export interface GeoFeature<P, G = GeoJSON.Geometry> {
  type: "Feature";
  properties: P;
  geometry: G;
}

export interface NetworkGeo {
  nodes: {
    type: "FeatureCollection";
    features: GeoFeature<
      {
        code: string;
        name: string;
        kind: string;
        city: string;
        department_code: string;
        iata: string | null;
        approximate: boolean;
        modes: Mode[];
      },
      GeoJSON.Point
    >[];
  };
  links: {
    type: "FeatureCollection";
    features: GeoFeature<
      {
        id: number;
        mode: Mode;
        mode_label: string;
        corridor: string;
        origin: string;
        origin_name: string;
        destination: string;
        destination_name: string;
        distance_fmt: string;
        time_fmt: string;
        capacity_fmt: string;
        closed: boolean;
        closure_reason: string | null;
        approximate: boolean;
      },
      GeoJSON.LineString
    >[];
  };
  stats: { mode: Mode; label: string; links: number; km: number; km_fmt: string }[];
}

export interface DepartmentsGeo {
  type: "FeatureCollection";
  features: GeoFeature<
    { code: string; name: string; traffic_t: number; traffic_fmt: string; intensity: number },
    GeoJSON.Polygon | GeoJSON.MultiPolygon
  >[];
}

// ---------------------------------------------------------------------------
// Logística verde: combustible y huella de carbono (backend/app/main.py)
// ---------------------------------------------------------------------------
export interface SustainabilitySummary {
  generated_at: string;
  window_days: number;
  shipments: number;
  totals: {
    co2e_kg: number;
    co2e_fmt: string;
    fuel_l: number;
    fuel_fmt: string;
    tkm: number;
    tkm_fmt: string;
    intensity_g_tkm: number;
    baseline_co2e_fmt: string;
    baseline_fuel_fmt: string;
    /** Positivo: la operación emite menos que moverlo todo por carretera. */
    saved_vs_road_pct: number;
    fuel_vs_road_pct: number;
  };
  by_mode: {
    mode: Mode;
    label: string;
    fuel_type: string;
    tkm: number;
    tkm_fmt: string;
    co2e_kg: number;
    co2e_fmt: string;
    fuel_l: number;
    fuel_fmt: string;
    intensity_g_tkm: number;
    co2e_share_pct: number;
  }[];
  co2e_14d: { date: string; co2e_kg: number }[];
  top_emitters: {
    code: string;
    route: string;
    modes: Mode[];
    co2e_kg: number;
    co2e_fmt: string;
    fuel_fmt: string;
  }[];
  method: { note: string; factors: { mode: Mode; g_co2e_per_tkm: number; fuel: string }[] };
}

export interface FuelLive {
  generated_at: string;
  count: number;
  burned_l: number;
  burned_fmt: string;
  total_l: number;
  total_fmt: string;
  burned_pct: number;
  assets: {
    id: string;
    shipment_code: string;
    mode: Mode;
    mode_label: string;
    fuel_type: string;
    origin: string;
    destination: string;
    progress_pct: number;
    burned_l: number;
    total_l: number;
    burned_pct: number;
    co2e_kg: number;
  }[];
}

export type Currency = "USD" | "COP";

export interface FxRate {
  rate: number | null;
  date: string | null;
  source: string | null;
}

export interface Settings {
  fx: FxRate;
  auto_replenish: boolean;
}

export interface Corridor {
  corridor: string;
  modes: Mode[];
  links: number;
  distance_km: number;
  distance_fmt: string;
  approximate: boolean;
  segments: string[];
  active: boolean;
  reason: string | null;
  changed_at: string | null;
  changed_by: string | null;
  /** Envíos no entregados con tramos pendientes por esta vía. */
  shipments: string[];
}

export interface CorridorChange {
  corridor: string;
  active: boolean;
  rerouted: string[];
  no_route: string[];
  restored: string[];
  replanned: string[];
}

export interface AuditEntry {
  audit_id: number;
  username: string;
  action: string;
  table_name: string;
  record_id: string | null;
  detail: string | null;
  timestamp: string;
}

export interface ShareLink {
  token: string;
  codes: string[];
  currency: Currency;
  created_at: string;
  created_by: string | null;
  revoked_at: string | null;
  path: string;
}
