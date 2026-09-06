"""
warehouse.py
Módulo 1 - Warehouse Management: inventario por zona de rotación (Alta/Media/Baja),
ciclo Inbound (recepción/inspección) y Outbound (picking/empaque/despacho),
alertas de stock crítico/sobre-stock y reportes de rotación y valoración.
"""
from dataclasses import dataclass
from typing import Optional
from database.db import run_query, run_write


@dataclass
class Warehouse:
    warehouse_id: Optional[int]
    node_id: int
    capacity_m3: float
    manager: str = ""

    @staticmethod
    def all() -> "list[dict]":
        sql = """SELECT w.*, n.name, n.city, n.latitude, n.longitude
                  FROM warehouses w JOIN nodes n ON w.node_id = n.node_id"""
        return run_query(sql).to_dict(orient="records")

    def save(self) -> int:
        return run_write(
            "INSERT INTO warehouses (node_id, capacity_m3, manager) VALUES (?,?,?)",
            (self.node_id, self.capacity_m3, self.manager),
        )


@dataclass
class InventoryItem:
    item_id: Optional[int]
    warehouse_id: int
    sku: str
    name: str
    zone: str  # Alta, Media, Baja
    quantity: float
    min_stock: float
    max_stock: float
    unit_cost: float

    @staticmethod
    def all(warehouse_id: Optional[int] = None) -> "list[dict]":
        sql = """SELECT i.*, w.node_id, n.name AS warehouse_name
                  FROM inventory_items i
                  JOIN warehouses w ON i.warehouse_id = w.warehouse_id
                  JOIN nodes n ON w.node_id = n.node_id"""
        params = ()
        if warehouse_id is not None:
            sql += " WHERE i.warehouse_id = ?"
            params = (warehouse_id,)
        df = run_query(sql, params)
        if df.empty:
            return []
        df["stock_status"] = df.apply(_stock_status, axis=1)
        df["valuation"] = df["quantity"] * df["unit_cost"]
        return df.to_dict(orient="records")

    def save(self) -> int:
        return run_write(
            """INSERT INTO inventory_items (warehouse_id, sku, name, zone, quantity,
               min_stock, max_stock, unit_cost) VALUES (?,?,?,?,?,?,?,?)""",
            (self.warehouse_id, self.sku, self.name, self.zone, self.quantity,
             self.min_stock, self.max_stock, self.unit_cost),
        )

    @staticmethod
    def adjust_quantity(item_id: int, delta: float) -> None:
        run_write("UPDATE inventory_items SET quantity = quantity + ? WHERE item_id = ?",
                   (delta, item_id))


def _stock_status(row) -> str:
    if row["quantity"] <= row["min_stock"]:
        return "CRITICO (bajo minimo)"
    if row["quantity"] >= row["max_stock"]:
        return "SOBRE-STOCK"
    return "Normal"


@dataclass
class WarehouseMovement:
    movement_id: Optional[int]
    item_id: int
    movement_type: str
    quantity: float
    movement_date: str
    reference: str = ""

    INBOUND_TYPES = ("Inbound-Recepcion", "Inbound-Inspeccion")
    OUTBOUND_TYPES = ("Outbound-Picking", "Outbound-Empaque", "Outbound-Despacho")

    @staticmethod
    def all(item_id: Optional[int] = None) -> "list[dict]":
        sql = """SELECT m.*, i.sku, i.name AS item_name FROM warehouse_movements m
                  JOIN inventory_items i ON m.item_id = i.item_id"""
        params = ()
        if item_id is not None:
            sql += " WHERE m.item_id = ?"
            params = (item_id,)
        sql += " ORDER BY m.movement_date DESC"
        return run_query(sql, params).to_dict(orient="records")

    def save(self) -> int:
        mv_id = run_write(
            """INSERT INTO warehouse_movements (item_id, movement_type, quantity,
               movement_date, reference) VALUES (?,?,?,?,?)""",
            (self.item_id, self.movement_type, self.quantity, self.movement_date, self.reference),
        )
        # Inbound suma al inventario, Outbound resta
        delta = self.quantity if self.movement_type in self.INBOUND_TYPES else -self.quantity
        InventoryItem.adjust_quantity(self.item_id, delta)
        return mv_id


def rotation_report() -> "list[dict]":
    """Reporte de rotación: unidades despachadas (Outbound-Despacho) por item en los
    movimientos registrados, usado como proxy de rotación de inventario."""
    sql = """
        SELECT i.sku, i.name, i.zone, w.node_id, n.name AS warehouse_name,
               COALESCE(SUM(CASE WHEN m.movement_type='Outbound-Despacho'
                    THEN m.quantity ELSE 0 END),0) AS unidades_despachadas,
               i.quantity AS stock_actual, i.unit_cost,
               i.quantity * i.unit_cost AS valoracion
        FROM inventory_items i
        JOIN warehouses w ON i.warehouse_id = w.warehouse_id
        JOIN nodes n ON w.node_id = n.node_id
        LEFT JOIN warehouse_movements m ON m.item_id = i.item_id
        GROUP BY i.item_id
        ORDER BY unidades_despachadas DESC
    """
    return run_query(sql).to_dict(orient="records")
