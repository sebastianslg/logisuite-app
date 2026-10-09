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
  dispatches_14d: { date: string; count: number }[];
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
  legs?: Leg[];
  transfers?: Transfer[];
  trip?: Trip;
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
}

export interface SimulateResponse {
  route: RouteResult;
  alternatives: RouteAlternative[];
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
