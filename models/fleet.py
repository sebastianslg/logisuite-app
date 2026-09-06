"""
fleet.py
Módulo 4 - Fleet Management: vehículos (placas, tipología, capacidad),
mantenimientos preventivos/correctivos con historial de odómetro, y
personal de conducción con licencias y vigencias.
"""
from dataclasses import dataclass
from typing import Optional
from datetime import datetime, timedelta
from database.db import run_query, run_write


@dataclass
class Vehicle:
    vehicle_id: Optional[int]
    plate: str
    vehicle_type: str
    capacity_kg: float
    capacity_m3: float
    status: str = "Disponible"
    odometer_km: float = 0.0
    home_node_id: Optional[int] = None

    STATUSES = ("Disponible", "En Ruta", "Mantenimiento", "Fuera de Servicio")

    @staticmethod
    def all() -> "list[dict]":
        sql = """SELECT v.*, n.name AS home_name FROM vehicles v
                  LEFT JOIN nodes n ON v.home_node_id = n.node_id"""
        return run_query(sql).to_dict(orient="records")

    def save(self) -> int:
        return run_write(
            """INSERT INTO vehicles (plate, vehicle_type, capacity_kg, capacity_m3, status,
               odometer_km, home_node_id) VALUES (?,?,?,?,?,?,?)""",
            (self.plate, self.vehicle_type, self.capacity_kg, self.capacity_m3, self.status,
             self.odometer_km, self.home_node_id),
        )

    @staticmethod
    def set_status(vehicle_id: int, status: str) -> None:
        run_write("UPDATE vehicles SET status=? WHERE vehicle_id=?", (status, vehicle_id))

    @staticmethod
    def add_km(vehicle_id: int, km: float) -> None:
        run_write("UPDATE vehicles SET odometer_km = odometer_km + ? WHERE vehicle_id=?",
                   (km, vehicle_id))


@dataclass
class Driver:
    driver_id: Optional[int]
    name: str
    license_number: str
    license_category: str
    license_expiry: str
    status: str = "Activo"

    @staticmethod
    def all() -> "list[dict]":
        df = run_query("SELECT * FROM drivers")
        if df.empty:
            return []
        today = datetime.today().date()
        recs = df.to_dict(orient="records")
        for r in recs:
            exp = datetime.strptime(r["license_expiry"], "%Y-%m-%d").date()
            days_left = (exp - today).days
            r["dias_para_vencer"] = days_left
            r["alerta_vencimiento"] = days_left <= 30
        return recs

    def save(self) -> int:
        return run_write(
            """INSERT INTO drivers (name, license_number, license_category, license_expiry, status)
               VALUES (?,?,?,?,?)""",
            (self.name, self.license_number, self.license_category, self.license_expiry, self.status),
        )


@dataclass
class MaintenanceRecord:
    maintenance_id: Optional[int]
    vehicle_id: int
    maintenance_type: str  # Preventivo / Correctivo
    maintenance_date: str
    odometer_km: float
    cost: float
    description: str = ""

    @staticmethod
    def all(vehicle_id: Optional[int] = None) -> "list[dict]":
        sql = """SELECT m.*, v.plate FROM maintenance_records m
                  JOIN vehicles v ON m.vehicle_id = v.vehicle_id"""
        params = ()
        if vehicle_id is not None:
            sql += " WHERE m.vehicle_id = ?"
            params = (vehicle_id,)
        sql += " ORDER BY m.maintenance_date DESC"
        return run_query(sql, params).to_dict(orient="records")

    def save(self) -> int:
        mid = run_write(
            """INSERT INTO maintenance_records (vehicle_id, maintenance_type, maintenance_date,
               odometer_km, cost, description) VALUES (?,?,?,?,?,?)""",
            (self.vehicle_id, self.maintenance_type, self.maintenance_date, self.odometer_km,
             self.cost, self.description),
        )
        run_write("UPDATE vehicles SET odometer_km=? WHERE vehicle_id=?",
                   (self.odometer_km, self.vehicle_id))
        return mid
