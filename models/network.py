"""
network.py
Modelo de la red de distribución: nodos (plantas, almacenes, CDs, clientes,
hubs, gateways portuarios) y corredores (enlaces de transporte entre nodos).
Implementado con POO: cada clase encapsula sus propias operaciones CRUD.
"""
from dataclasses import dataclass
from typing import Optional, List
from database.db import run_query, run_write


@dataclass
class Node:
    node_id: Optional[int]
    name: str
    node_type: str  # Planta, Almacen, CD, Cliente, Hub, Gateway
    latitude: float
    longitude: float
    city: str = ""
    active: int = 1

    @staticmethod
    def all(active_only: bool = True) -> "list[dict]":
        sql = "SELECT * FROM nodes"
        if active_only:
            sql += " WHERE active = 1"
        return run_query(sql).to_dict(orient="records")

    @staticmethod
    def get(node_id: int) -> Optional[dict]:
        df = run_query("SELECT * FROM nodes WHERE node_id = ?", (node_id,))
        return df.to_dict(orient="records")[0] if not df.empty else None

    def save(self) -> int:
        return run_write(
            """INSERT INTO nodes (name, node_type, latitude, longitude, city, active)
               VALUES (?,?,?,?,?,?)""",
            (self.name, self.node_type, self.latitude, self.longitude, self.city, self.active),
        )

    @staticmethod
    def deactivate(node_id: int) -> None:
        run_write("UPDATE nodes SET active = 0 WHERE node_id = ?", (node_id,))

    @staticmethod
    def reactivate(node_id: int) -> None:
        run_write("UPDATE nodes SET active = 1 WHERE node_id = ?", (node_id,))


@dataclass
class Corridor:
    corridor_id: Optional[int]
    origin_node_id: int
    dest_node_id: int
    distance_km: float
    transit_time_h: float
    mode: str
    cost_per_km: float = 1.0
    active: int = 1

    @staticmethod
    def all(active_only: bool = True) -> "list[dict]":
        sql = """
            SELECT c.*, no.name AS origin_name, nd.name AS dest_name,
                   no.latitude AS origin_lat, no.longitude AS origin_lon,
                   nd.latitude AS dest_lat, nd.longitude AS dest_lon
            FROM corridors c
            JOIN nodes no ON c.origin_node_id = no.node_id
            JOIN nodes nd ON c.dest_node_id = nd.node_id
        """
        if active_only:
            sql += " WHERE c.active = 1 AND no.active = 1 AND nd.active = 1"
        return run_query(sql).to_dict(orient="records")

    def save(self) -> int:
        return run_write(
            """INSERT INTO corridors (origin_node_id, dest_node_id, distance_km,
               transit_time_h, mode, cost_per_km, active) VALUES (?,?,?,?,?,?,?)""",
            (self.origin_node_id, self.dest_node_id, self.distance_km,
             self.transit_time_h, self.mode, self.cost_per_km, self.active),
        )
