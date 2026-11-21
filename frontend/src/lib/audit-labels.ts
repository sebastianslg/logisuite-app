/**
 * Nombres en español de las acciones y tablas del historial (audit_log). La API guarda códigos estables (INSERT,
 * mm_shipments); la pantalla nunca los muestra en crudo. Lo que no esté aquí se muestra tal cual.
 */
export const AUDIT_ACTIONS: Record<string, string> = {
  INSERT: "Creación",
  CREATE: "Creación",
  UPDATE: "Edición",
  EDIT: "Edición",
  DELETE: "Borrado",
  CLOSE: "Cierre",
  REOPEN: "Reapertura",
  EXPORT: "Enlace creado",
  REVOKE: "Revocación",
  IMPORT: "Carga masiva",
  EMAIL: "Correo enviado",
  LOGIN: "Inicio de sesión",
  LOGOUT: "Cierre de sesión",
};

export const AUDIT_TABLES: Record<string, string> = {
  mm_shipments: "Envíos",
  mm_shipment_events: "Bitácora",
  mm_attachments: "Adjuntos",
  mm_deliveries: "Entregas",
  mm_tracking_links: "Seguimiento",
  mm_share_links: "Enlaces",
  mm_corridor_status: "Vías",
  mm_node_status: "Nodos",
  mm_links: "Peajes",
  mm_consents: "Aceptaciones",
  fl_vehicles: "Vehículos",
  fl_drivers: "Conductores",
  fl_faults: "Fallas",
  fl_maintenance: "Mantenimientos",
  wh_warehouses: "Bodegas",
  wh_stock: "Inventario",
  wh_transfers: "Traslados",
  users: "Usuarios",
  companies: "Empresas",
  demo_requests: "Demostraciones",
  system_params: "Parámetros",
};

export const actionLabel = (a: string) => AUDIT_ACTIONS[a] ?? a;
export const tableLabel = (t: string) => AUDIT_TABLES[t] ?? t;
