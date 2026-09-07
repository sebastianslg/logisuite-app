"""
consolidation.py
Modelos de las funcionalidades avanzadas de Freight y Customs:

  - Consolidation: agrupación real de varios envíos que comparten corredor y
    ventana de fecha en una sola unidad de carga, con recálculo de costos y
    cuantificación del ahorro obtenido por masificación.
  - ShipmentEmission: huella de carbono calculada y persistida por envío.
  - TariffScenario: escenarios arancelarios comparables (tratados comerciales).
  - CorridorCostHistory: serie temporal de costo por km de cada corredor.

Sigue el mismo patrón POO del resto de models/: dataclass + métodos estáticos
de consulta y un save() de instancia.
"""
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List

from database.db import run_query, run_write
from models.freight import compute_transport_cost


# ===========================================================================
# CONSOLIDACIÓN DE CARGA
# ===========================================================================
@dataclass
class Consolidation:
    consolidation_id: Optional[int]
    name: str
    origin_node_id: int
    dest_node_id: int
    consolidation_date: str
    total_weight_kg: float = 0.0
    total_volume_m3: float = 0.0
    cost_before: float = 0.0
    cost_after: float = 0.0
    savings: float = 0.0

    @staticmethod
    def all() -> List[dict]:
        sql = """
            SELECT c.*, no.name AS origin_name, nd.name AS dest_name,
                   (SELECT COUNT(*) FROM consolidation_items ci
                     WHERE ci.consolidation_id = c.consolidation_id) AS n_envios
            FROM consolidations c
            JOIN nodes no ON c.origin_node_id = no.node_id
            JOIN nodes nd ON c.dest_node_id = nd.node_id
            ORDER BY c.consolidation_id DESC
        """
        return run_query(sql).to_dict(orient="records")

    @staticmethod
    def items(consolidation_id: int) -> List[dict]:
        """Envíos que componen una consolidación."""
        sql = """
            SELECT s.*, no.name AS origin_name, nd.name AS dest_name
            FROM consolidation_items ci
            JOIN shipments s ON ci.shipment_id = s.shipment_id
            JOIN nodes no ON s.origin_node_id = no.node_id
            JOIN nodes nd ON s.dest_node_id = nd.node_id
            WHERE ci.consolidation_id = ?
        """
        return run_query(sql, (consolidation_id,)).to_dict(orient="records")

    def save(self, shipment_ids: List[int]) -> int:
        cid = run_write(
            """INSERT INTO consolidations (name, origin_node_id, dest_node_id, consolidation_date,
               total_weight_kg, total_volume_m3, cost_before, cost_after, savings)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (self.name, self.origin_node_id, self.dest_node_id, self.consolidation_date,
             self.total_weight_kg, self.total_volume_m3, self.cost_before, self.cost_after,
             self.savings),
        )
        for sid in shipment_ids:
            run_write(
                "INSERT INTO consolidation_items (consolidation_id, shipment_id) VALUES (?,?)",
                (cid, sid),
            )
            # Los envíos consolidados cambian de estado para reflejar la operación
            run_write("UPDATE shipments SET status='Consolidado' WHERE shipment_id=?", (sid,))
        return cid


def candidates_for_consolidation(window_days: int = 7) -> List[dict]:
    """Busca grupos de envíos consolidables: mismo par origen-destino, aún no
    consolidados, y con fechas prometidas dentro de una misma ventana.

    Devuelve un registro por grupo con la lista de envíos que lo componen."""
    df = run_query("""
        SELECT s.shipment_id, s.origin_node_id, s.dest_node_id, s.cargo_units,
               s.weight_kg, s.volume_m3, s.promised_date, s.total_cost,
               s.transaction_cost, s.distance_friction_cost, s.shipment_cost,
               no.name AS origin_name, nd.name AS dest_name
        FROM shipments s
        JOIN nodes no ON s.origin_node_id = no.node_id
        JOIN nodes nd ON s.dest_node_id = nd.node_id
        WHERE s.status IN ('Registrado')
          AND s.shipment_id NOT IN (SELECT shipment_id FROM consolidation_items)
        ORDER BY s.origin_node_id, s.dest_node_id, s.promised_date
    """)
    if df.empty:
        return []

    grupos = []
    for (o, d), sub in df.groupby(["origin_node_id", "dest_node_id"]):
        sub = sub.sort_values("promised_date")
        actual: List[dict] = []
        base_fecha = None
        for _, row in sub.iterrows():
            try:
                f = datetime.strptime(str(row["promised_date"]), "%Y-%m-%d")
            except (ValueError, TypeError):
                f = None
            if not actual:
                actual, base_fecha = [row.to_dict()], f
                continue
            dentro = (f is not None and base_fecha is not None
                      and abs((f - base_fecha).days) <= window_days)
            if dentro:
                actual.append(row.to_dict())
            else:
                if len(actual) >= 2:
                    grupos.append(_build_group(actual))
                actual, base_fecha = [row.to_dict()], f
        if len(actual) >= 2:
            grupos.append(_build_group(actual))
    return grupos


def _build_group(rows: List[dict]) -> dict:
    """Arma el resumen de un grupo consolidable."""
    return {
        "origin_node_id": int(rows[0]["origin_node_id"]),
        "dest_node_id": int(rows[0]["dest_node_id"]),
        "origin_name": rows[0]["origin_name"],
        "dest_name": rows[0]["dest_name"],
        "shipment_ids": [int(r["shipment_id"]) for r in rows],
        "n_envios": len(rows),
        "total_weight_kg": float(sum(r["weight_kg"] for r in rows)),
        "total_volume_m3": float(sum(r["volume_m3"] for r in rows)),
        "total_units": int(sum(r["cargo_units"] for r in rows)),
        "costo_individual_total": round(float(sum(r["total_cost"] for r in rows)), 2),
        "fecha_referencia": str(rows[0]["promised_date"]),
    }


def evaluate_consolidation(group: dict, distance_km: float, transit_time_h: float,
                            declared_value: float, params: dict = None) -> dict:
    """Compara enviar el grupo por separado vs. como una sola carga consolidada.

    El ahorro proviene de dos fuentes:
      1. El costo de transacción (seguros/trámites) se paga UNA vez en lugar
         de una vez por envío.
      2. Al sumar las unidades de carga se supera el umbral de masificación y
         se activa el descuento de consolidación del motor de costos.
    """
    consolidado = compute_transport_cost(
        distance_km=distance_km, transit_time_h=transit_time_h,
        weight_kg=group["total_weight_kg"], volume_m3=group["total_volume_m3"],
        cargo_units=group["total_units"], declared_value=declared_value, params=params,
    )
    antes = group["costo_individual_total"]
    despues = consolidado["total_cost"]
    ahorro = antes - despues
    return {
        "costo_antes": round(antes, 2),
        "costo_despues": round(despues, 2),
        "ahorro": round(ahorro, 2),
        "ahorro_pct": round(100 * ahorro / antes, 2) if antes > 0 else 0.0,
        "desglose_consolidado": consolidado,
    }


# ===========================================================================
# HUELLA DE CARBONO PERSISTIDA
# ===========================================================================
@dataclass
class ShipmentEmission:
    emission_id: Optional[int]
    shipment_id: int
    mode: str
    distance_km: float
    ton_km: float
    kg_co2e: float
    computed_at: str

    @staticmethod
    def all() -> List[dict]:
        sql = """
            SELECT e.*, no.name AS origin_name, nd.name AS dest_name, s.weight_kg
            FROM shipment_emissions e
            JOIN shipments s ON e.shipment_id = s.shipment_id
            JOIN nodes no ON s.origin_node_id = no.node_id
            JOIN nodes nd ON s.dest_node_id = nd.node_id
            ORDER BY e.kg_co2e DESC
        """
        return run_query(sql).to_dict(orient="records")

    def save(self) -> int:
        """Inserta o actualiza (la tabla tiene shipment_id UNIQUE)."""
        return run_write(
            """INSERT INTO shipment_emissions (shipment_id, mode, distance_km, ton_km,
               kg_co2e, computed_at) VALUES (?,?,?,?,?,?)
               ON CONFLICT(shipment_id) DO UPDATE SET
                 mode=excluded.mode, distance_km=excluded.distance_km,
                 ton_km=excluded.ton_km, kg_co2e=excluded.kg_co2e,
                 computed_at=excluded.computed_at""",
            (self.shipment_id, self.mode, self.distance_km, self.ton_km,
             self.kg_co2e, self.computed_at),
        )


# ===========================================================================
# ESCENARIOS ARANCELARIOS
# ===========================================================================
@dataclass
class TariffScenario:
    scenario_id: Optional[int]
    name: str
    country_origin: str
    tariff_pct: float
    vat_pct: float = 19.0
    other_fees_pct: float = 0.0
    notes: str = ""

    @staticmethod
    def all() -> List[dict]:
        return run_query("SELECT * FROM tariff_scenarios ORDER BY tariff_pct").to_dict(orient="records")

    def save(self) -> int:
        return run_write(
            """INSERT INTO tariff_scenarios (name, country_origin, tariff_pct, vat_pct,
               other_fees_pct, notes) VALUES (?,?,?,?,?,?)""",
            (self.name, self.country_origin, self.tariff_pct, self.vat_pct,
             self.other_fees_pct, self.notes),
        )

    @staticmethod
    def compare(taxable_value: float) -> List[dict]:
        """Calcula el costo total de importación bajo cada escenario registrado.

        Base gravable -> arancel -> IVA sobre (valor + arancel) -> otros gastos.
        Es la secuencia usada por la DIAN en Colombia y por la mayoría de
        regímenes aduaneros que aplican IVA sobre el valor en aduana más el
        arancel, no sobre el valor FOB puro.
        """
        filas = []
        for sc in TariffScenario.all():
            arancel = taxable_value * sc["tariff_pct"] / 100.0
            iva = (taxable_value + arancel) * sc["vat_pct"] / 100.0
            otros = taxable_value * sc["other_fees_pct"] / 100.0
            total_tributos = arancel + iva + otros
            filas.append({
                "escenario": sc["name"],
                "origen": sc["country_origin"],
                "arancel_pct": sc["tariff_pct"],
                "iva_pct": sc["vat_pct"],
                "otros_pct": sc["other_fees_pct"],
                "valor_gravable": round(taxable_value, 2),
                "arancel": round(arancel, 2),
                "iva": round(iva, 2),
                "otros_gastos": round(otros, 2),
                "total_tributos": round(total_tributos, 2),
                "costo_total_importacion": round(taxable_value + total_tributos, 2),
                "notas": sc.get("notes", ""),
            })
        return sorted(filas, key=lambda r: r["costo_total_importacion"])


# ===========================================================================
# HISTORIAL DE COSTOS POR CORREDOR
# ===========================================================================
def corridor_cost_history(corridor_id: Optional[int] = None) -> List[dict]:
    """Serie temporal de costo por km. Si no se indica corredor, devuelve todos."""
    sql = """
        SELECT h.*, no.name AS origin_name, nd.name AS dest_name, c.mode
        FROM corridor_cost_history h
        JOIN corridors c ON h.corridor_id = c.corridor_id
        JOIN nodes no ON c.origin_node_id = no.node_id
        JOIN nodes nd ON c.dest_node_id = nd.node_id
    """
    params = ()
    if corridor_id is not None:
        sql += " WHERE h.corridor_id = ?"
        params = (corridor_id,)
    sql += " ORDER BY h.record_date"
    return run_query(sql, params).to_dict(orient="records")
