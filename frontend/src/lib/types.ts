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
  alerts: {
    fleet?: { disabled: number; in_shop: number; overdue: number; open_faults: number };
    warehouses?: { low_stock: number; full: string[] };
    closed_corridors: string[];
    closed_nodes: { code: string; name: string; reason: string | null }[];
    no_route: string[];
    rerouted: string[];
    delayed: { code: string; origin: string; destination: string; delay_fmt: string }[];
  };
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
  /** Flota propia: vehículos reales del tramo (si es de un tercero, queda vacío). */
  own?: boolean;
  outsourced?: boolean;
  vehicle_ids?: number[];
  plates?: string[];
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
  base_cost: number;
  toll_cost: number;
  tax_cost: number;
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
  base_cost: number;
  tax_cost: number;
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

export interface NodeStatus {
  code: string;
  name: string;
  kind: string;
  city: string;
  active: boolean;
  reason: string | null;
  changed_at: string | null;
  changed_by: string | null;
  approximate: boolean;
  /** Envíos no entregados con tramos pendientes que pasan por el nodo. */
  shipments: string[];
}

export interface NodeChange {
  code: string;
  name: string;
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

// ---------------------------------------------------------------------------
// Flota de vehículos
// ---------------------------------------------------------------------------
export type VehicleStatus =
  | "Disponible"
  | "Reservado"
  | "En ruta"
  | "En mantenimiento"
  | "Inhabilitado"
  | "Mantenimiento vencido"
  | "Dado de baja";

export type FaultSeverity = "Leve" | "Moderada" | "Crítica";
export type FaultStatus = "Abierta" | "En reparación" | "Resuelta";
export type MaintenanceKind = "Preventivo" | "Correctivo" | "Inspección";
export type MaintenanceStatus = "Programado" | "En curso" | "Completado" | "Cancelado";

export interface ServiceClock {
  state: "Al día" | "Próximo" | "Vencido";
  due_at: string;
  days_left: number;
  due_km: number;
  km_left: number;
  interval_days: number;
  interval_km: number;
  pct_used: number;
  limiting: "días" | "km";
  last_service_at: string;
}

export interface VehicleDriver {
  id: number;
  name: string;
  license_cat: string;
  license_expiry: string;
  license_days_left: number;
  status: string;
}

export interface Vehicle {
  id: number;
  code: string;
  mode: Mode;
  mode_label: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  capacity_t: number;
  capacity_m3: number | null;
  home_warehouse_id: number | null;
  home_name: string | null;
  home_city: string | null;
  home_code: string | null;
  driver: VehicleDriver | null;
  odometer_km: number;
  status: VehicleStatus;
  operable: boolean;
  blockers: string[];
  warnings: string[];
  service: ServiceClock;
  open_faults: number;
  blocking_faults: number;
  next_maintenance: { id: number; kind: MaintenanceKind; start: string; end: string; workshop: string | null } | null;
  in_maintenance: { id: number; kind: MaintenanceKind; end: string; workshop: string | null } | null;
  current: { shipment_code: string; end_at: string; leg: number } | null;
  upcoming_assignments: number;
  trips_total: number;
  retired: boolean;
  retired_reason: string | null;
  notes: string | null;
  source: string | null;
  service_interval_days: number;
  service_interval_km: number;
  last_service_at: string | null;
  last_service_km: number;
}

export interface Fault {
  fault_id: number;
  vehicle_id: number;
  severity: FaultSeverity;
  category: string;
  description: string;
  blocks_operation: number;
  status: FaultStatus;
  reported_at: string;
  reported_by: string | null;
  shipment_code: string | null;
  resolved_at: string | null;
  resolution: string | null;
  repair_cost_usd: number | null;
  code?: string;
  vehicle_type?: string;
  mode?: Mode;
}

export interface Maintenance {
  maint_id: number;
  vehicle_id: number;
  kind: MaintenanceKind;
  status: MaintenanceStatus;
  scheduled_start: string;
  scheduled_end: string;
  workshop: string | null;
  est_cost_usd: number;
  cost_usd: number | null;
  odometer_km: number | null;
  notes: string | null;
  completed_at: string | null;
  fault_id: number | null;
  created_by: string | null;
  code?: string;
  vehicle_type?: string;
  mode?: Mode;
}

export interface VehicleTrip {
  assign_id: number;
  shipment_code: string;
  leg_index: number;
  start_at: string;
  end_at: string;
  km: number;
  load_t: number;
  origin: string | null;
  destination: string | null;
  cargo: string | null;
  shipment_status: string | null;
  phase: "En curso" | "Próximo" | "Terminado";
}

export interface VehicleDetail extends Vehicle {
  faults: Fault[];
  maintenance: Maintenance[];
  trips: VehicleTrip[];
  maintenance_cost_usd: number;
  faults_total: number;
  reassigned?: {
    replaced: { shipment_code: string; from: string; to: string }[];
    outsourced: { shipment_code: string; from: string }[];
  };
}

export interface FleetSummary {
  total: number;
  by_status: Record<VehicleStatus, number>;
  by_mode: { mode: Mode; label: string; total: number; operable: number }[];
  availability_pct: number;
  maintenance_due: { id: number; code: string; vehicle_type: string; mode: Mode; state: string; days_left: number; km_left: number; limiting: string }[];
  open_faults: Fault[];
  upcoming_maintenance: Maintenance[];
  licenses_expiring: { id: number; code: string; driver: string; days_left: number }[];
  maintenance_cost_90d_usd: number;
}

export interface FleetCatalog {
  modes: {
    key: Mode;
    label: string;
    types: {
      name: string;
      capacity_t: number;
      capacity_m3: number;
      service_interval_days: number;
      service_interval_km: number;
      makes: { make: string; model: string }[];
    }[];
  }[];
  fault_categories: string[];
  severities: FaultSeverity[];
  maintenance_kinds: MaintenanceKind[];
  workshops: Record<Mode, string[]>;
}

export interface Driver {
  driver_id: number;
  name: string;
  license_cat: string;
  license_expiry: string;
  status: "Activo" | "Inactivo";
  vehicle_code: string | null;
  vehicle_id: number | null;
  license_days_left: number;
  license_state: "Vigente" | "Por vencer" | "Vencida";
}

// ---------------------------------------------------------------------------
// Bodegas
// ---------------------------------------------------------------------------
export type WarehouseStatus = "Operativa" | "Mantenimiento" | "Cerrada";
export type StockState = "Normal" | "Bajo" | "Exceso";
export type MovementKind = "Entrada" | "Salida" | "Traslado salida" | "Traslado entrada" | "Ajuste" | "Merma";

export interface Warehouse {
  warehouse_id: number;
  code: string;
  name: string;
  city: string;
  node_code: string | null;
  role: string;
  role_label: string;
  role_description: string;
  stores: string;
  capacity_m3: number;
  capacity_pallets: number;
  docks: number;
  latitude: number | null;
  longitude: number | null;
  manager: string | null;
  shift: string | null;
  temp_controlled: boolean;
  hazmat: boolean;
  bonded: boolean;
  status: WarehouseStatus;
  strategic_reason: string | null;
  source: string;
  used_m3: number;
  occupancy_pct: number;
  free_m3: number;
  stock_lines: number;
  low_stock: number;
  over_stock: number;
  vehicles: number;
  in_transit: number;
  alerts: string[];
}

export interface StockItem {
  stock_id: number;
  warehouse_id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  min_qty: number;
  max_qty: number;
  volume_m3: number;
  weight_kg: number;
  unit_cost_usd: number;
  zone: string | null;
  state: StockState;
  volume_total_m3: number;
  value_usd: number;
}

export interface WarehouseMovement {
  move_id: number;
  warehouse_id: number;
  sku: string;
  kind: MovementKind;
  qty: number;
  at: string;
  reference: string | null;
  by_user: string | null;
  note: string | null;
}

export interface WarehouseTransfer {
  transfer_id: number;
  from_wh: number;
  to_wh: number;
  sku: string;
  qty: number;
  shipment_code: string | null;
  status: "En tránsito" | "Recibido" | "Cancelado";
  created_at: string;
  created_by: string | null;
  received_at: string | null;
  from_name: string;
  from_city: string;
  from_code?: string;
  to_name: string;
  to_city: string;
  to_code?: string;
}

export interface WarehouseDetail extends Warehouse {
  stock: StockItem[];
  movements: WarehouseMovement[];
  transfers: WarehouseTransfer[];
  vehicles_list: Vehicle[];
  value_usd: number;
}

export interface WarehouseRole {
  key: string;
  label: string;
  description: string;
  stores: string;
}

export interface WarehouseSummary {
  warehouses: number;
  cities: number;
  operating: number;
  capacity_m3: number;
  used_m3: number;
  occupancy_pct: number;
  low_stock_lines: number;
  over_stock_lines: number;
  full_warehouses: string[];
  in_transit: number;
  by_role: { role: string; label: string; count: number; capacity_m3: number; used_m3: number; occupancy_pct: number }[];
  network: { id: number; code: string; name: string; city: string; role: string; lat: number | null; lon: number | null; parent: string | null }[];
}

/** Peaje por despacho de un tramo terrestre (tabla editable en Configuración). */
export interface Toll {
  link_id: number;
  corridor: string;
  origin_code: string;
  dest_code: string;
  origin: string;
  destination: string;
  distance_km: number;
  tolls_cop: number;
  tolls_note: string | null;
  tolls_source: string | null;
  tolls_updated_at: string | null;
}
