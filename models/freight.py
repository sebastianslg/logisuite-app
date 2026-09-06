"""
freight.py
Módulo 2 - Freight Management: registro de envíos, consolidación de carga,
tracking de estado, y motor parametrizado de costos de transporte con 3
componentes explícitos:
  (a) Costo de transacción      -> seguros, aduanas, trámites legales
  (b) Fricción de la distancia  -> tiempo y consumo energético según el corredor
  (c) Costo del envío           -> unidad de carga, empaque y masificación
"""
from dataclasses import dataclass
from typing import Optional
from database.db import run_query, run_write


# ---------------------------------------------------------------------------
# Parámetros por defecto del motor de costos (ajustables desde la UI)
# ---------------------------------------------------------------------------
DEFAULT_COST_PARAMS = {
    "insurance_rate": 0.008,       # % del valor de la carga -> transaction_cost
    "customs_flat_fee": 45.0,      # USD fijos por trámite   -> transaction_cost
    "energy_cost_per_km_ton": 0.09,  # USD por km por tonelada -> distance_friction
    "time_cost_per_hour": 12.0,    # USD por hora en tránsito -> distance_friction
    "packaging_cost_per_m3": 3.5,  # USD por m3 empacado      -> shipment_cost
    "consolidation_discount": 0.12,  # % descuento si cargo_units >= consolidation_threshold
    "consolidation_threshold": 5,
}


def compute_transport_cost(distance_km: float, transit_time_h: float, weight_kg: float,
                            volume_m3: float, cargo_units: int, declared_value: float,
                            params: dict = None) -> dict:
    """Motor parametrizado de costos. Devuelve el desglose de los 3 componentes
    y el total, permitiendo trazabilidad completa para el reporte académico."""
    p = {**DEFAULT_COST_PARAMS, **(params or {})}
    weight_ton = weight_kg / 1000.0

    # (a) Costo de transacción
    transaction_cost = declared_value * p["insurance_rate"] + p["customs_flat_fee"]

    # (b) Fricción de la distancia (energía + tiempo del corredor)
    energy_component = distance_km * weight_ton * p["energy_cost_per_km_ton"]
    time_component = transit_time_h * p["time_cost_per_hour"]
    distance_friction_cost = energy_component + time_component

    # (c) Costo del envío (empaque + masificación de unidades de carga)
    packaging_component = volume_m3 * p["packaging_cost_per_m3"]
    consolidation_factor = (
        (1 - p["consolidation_discount"]) if cargo_units >= p["consolidation_threshold"] else 1.0
    )
    shipment_cost = packaging_component * consolidation_factor

    total_cost = transaction_cost + distance_friction_cost + shipment_cost
    return {
        "transaction_cost": round(transaction_cost, 2),
        "distance_friction_cost": round(distance_friction_cost, 2),
        "shipment_cost": round(shipment_cost, 2),
        "total_cost": round(total_cost, 2),
        "breakdown": {
            "seguro": round(declared_value * p["insurance_rate"], 2),
            "tramites_aduana": p["customs_flat_fee"],
            "energia": round(energy_component, 2),
            "tiempo": round(time_component, 2),
            "empaque": round(packaging_component, 2),
            "descuento_consolidacion_aplicado": cargo_units >= p["consolidation_threshold"],
        },
    }


@dataclass
class Shipment:
    shipment_id: Optional[int]
    origin_node_id: int
    dest_node_id: int
    cargo_units: int
    weight_kg: float
    volume_m3: float
    status: str = "Registrado"
    promised_date: str = ""
    delivered_date: str = ""
    transaction_cost: float = 0.0
    distance_friction_cost: float = 0.0
    shipment_cost: float = 0.0
    total_cost: float = 0.0

    STATUSES = ("Registrado", "Consolidado", "En Transito", "Entregado", "Retrasado")

    @staticmethod
    def all() -> "list[dict]":
        sql = """
            SELECT s.*, no.name AS origin_name, nd.name AS dest_name
            FROM shipments s
            JOIN nodes no ON s.origin_node_id = no.node_id
            JOIN nodes nd ON s.dest_node_id = nd.node_id
            ORDER BY s.shipment_id DESC
        """
        return run_query(sql).to_dict(orient="records")

    @staticmethod
    def get(shipment_id: int) -> Optional[dict]:
        df = run_query("SELECT * FROM shipments WHERE shipment_id = ?", (shipment_id,))
        return df.to_dict(orient="records")[0] if not df.empty else None

    def save(self) -> int:
        return run_write(
            """INSERT INTO shipments (origin_node_id, dest_node_id, cargo_units, weight_kg,
               volume_m3, status, promised_date, delivered_date, transaction_cost,
               distance_friction_cost, shipment_cost, total_cost)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (self.origin_node_id, self.dest_node_id, self.cargo_units, self.weight_kg,
             self.volume_m3, self.status, self.promised_date, self.delivered_date,
             self.transaction_cost, self.distance_friction_cost, self.shipment_cost,
             self.total_cost),
        )

    @staticmethod
    def update_status(shipment_id: int, status: str, delivered_date: str = None) -> None:
        if delivered_date:
            run_write("UPDATE shipments SET status=?, delivered_date=? WHERE shipment_id=?",
                       (status, delivered_date, shipment_id))
        else:
            run_write("UPDATE shipments SET status=? WHERE shipment_id=?", (status, shipment_id))

    @staticmethod
    def otif_kpi() -> dict:
        """On-Time-In-Full: entregados a tiempo (delivered_date <= promised_date)."""
        df = run_query(
            "SELECT * FROM shipments WHERE status='Entregado' AND promised_date IS NOT NULL"
        )
        if df.empty:
            return {"otif_pct": None, "on_time": 0, "total_delivered": 0}
        on_time = (df["delivered_date"] <= df["promised_date"]).sum()
        total = len(df)
        return {"otif_pct": round(100 * on_time / total, 1), "on_time": int(on_time),
                "total_delivered": int(total)}
