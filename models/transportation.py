"""
transportation.py
Módulo 3 - Transportation Management: planificación de rutas sobre la red
(distancia mínima / costo mínimo vía NetworkX), asignación de vehículo y
conductor, y control de tiempos estimados (ETA) vs. reales.
"""
import json
from dataclasses import dataclass
from typing import Optional
from database.db import run_query, run_write


@dataclass
class Route:
    route_id: Optional[int]
    shipment_id: int
    path: list          # lista de node_id
    algorithm: str
    total_distance_km: float
    total_cost: float
    eta_hours: float
    actual_hours: Optional[float] = None
    vehicle_id: Optional[int] = None
    driver_id: Optional[int] = None

    @staticmethod
    def all() -> "list[dict]":
        sql = """
            SELECT r.*, s.origin_node_id, s.dest_node_id, v.plate, d.name AS driver_name
            FROM routes r
            JOIN shipments s ON r.shipment_id = s.shipment_id
            LEFT JOIN vehicles v ON r.vehicle_id = v.vehicle_id
            LEFT JOIN drivers d ON r.driver_id = d.driver_id
            ORDER BY r.route_id DESC
        """
        df = run_query(sql)
        if df.empty:
            return []
        records = df.to_dict(orient="records")
        for r in records:
            r["path"] = json.loads(r["path_json"])
            if r["actual_hours"] is not None and r["eta_hours"]:
                r["desviacion_pct"] = round(100 * (r["actual_hours"] - r["eta_hours"]) / r["eta_hours"], 1)
            else:
                r["desviacion_pct"] = None
        return records

    def save(self) -> int:
        return run_write(
            """INSERT INTO routes (shipment_id, path_json, algorithm, total_distance_km,
               total_cost, eta_hours, actual_hours, vehicle_id, driver_id)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (self.shipment_id, json.dumps(self.path), self.algorithm, self.total_distance_km,
             self.total_cost, self.eta_hours, self.actual_hours, self.vehicle_id, self.driver_id),
        )

    @staticmethod
    def assign_vehicle_driver(route_id: int, vehicle_id: int, driver_id: int) -> None:
        run_write("UPDATE routes SET vehicle_id=?, driver_id=? WHERE route_id=?",
                   (vehicle_id, driver_id, route_id))
        run_write("UPDATE vehicles SET status='En Ruta' WHERE vehicle_id=?", (vehicle_id,))

    @staticmethod
    def register_actual_time(route_id: int, actual_hours: float) -> None:
        run_write("UPDATE routes SET actual_hours=? WHERE route_id=?", (actual_hours, route_id))
