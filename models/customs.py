"""
customs.py
Módulo 5 - Customs Management: documentación aduanera por envío (BL, manifiestos,
declaraciones), control de aranceles/impuestos, estado del trámite en tiempo real
y alertas automáticas de vencimiento de permisos/documentos legales.
"""
from dataclasses import dataclass
from typing import Optional
from datetime import datetime
import pandas as pd
from database.db import run_query, run_write


@dataclass
class CustomsDocument:
    doc_id: Optional[int]
    shipment_id: int
    doc_type: str
    doc_number: str
    issue_date: str
    expiry_date: Optional[str] = None
    status: str = "Pendiente"

    DOC_TYPES = ("Bill of Lading", "Manifiesto de Carga", "Declaracion de Importacion",
                 "Declaracion de Exportacion", "Certificado de Origen")
    STATUSES = ("Pendiente", "En Revision", "Liberado", "Rechazado")

    @staticmethod
    def all() -> "list[dict]":
        sql = """SELECT c.*, s.origin_node_id, s.dest_node_id FROM customs_documents c
                  JOIN shipments s ON c.shipment_id = s.shipment_id"""
        df = run_query(sql)
        if df.empty:
            return []
        today = datetime.today().date()
        recs = df.to_dict(orient="records")
        for r in recs:
            if pd.notna(r["expiry_date"]) and isinstance(r["expiry_date"], str) and r["expiry_date"]:
                exp = datetime.strptime(r["expiry_date"], "%Y-%m-%d").date()
                r["dias_para_vencer"] = (exp - today).days
                r["alerta_vencimiento"] = r["dias_para_vencer"] <= 15
            else:
                r["dias_para_vencer"] = None
                r["alerta_vencimiento"] = False
        return recs

    def save(self) -> int:
        return run_write(
            """INSERT INTO customs_documents (shipment_id, doc_type, doc_number, issue_date,
               expiry_date, status) VALUES (?,?,?,?,?,?)""",
            (self.shipment_id, self.doc_type, self.doc_number, self.issue_date,
             self.expiry_date, self.status),
        )

    @staticmethod
    def update_status(doc_id: int, status: str) -> None:
        run_write("UPDATE customs_documents SET status=? WHERE doc_id=?", (status, doc_id))


@dataclass
class CustomsDuty:
    duty_id: Optional[int]
    shipment_id: int
    tariff_pct: float
    taxable_value: float
    taxes: float
    total_duty: float

    @staticmethod
    def all() -> "list[dict]":
        sql = """SELECT d.*, s.origin_node_id, s.dest_node_id FROM customs_duties d
                  JOIN shipments s ON d.shipment_id = s.shipment_id"""
        return run_query(sql).to_dict(orient="records")

    @staticmethod
    def compute(taxable_value: float, tariff_pct: float, vat_pct: float = 19.0) -> dict:
        tariff_amount = taxable_value * tariff_pct / 100.0
        taxes = (taxable_value + tariff_amount) * vat_pct / 100.0
        total = tariff_amount + taxes
        return {"tariff_amount": round(tariff_amount, 2), "taxes": round(taxes, 2),
                "total_duty": round(total, 2)}

    def save(self) -> int:
        return run_write(
            """INSERT INTO customs_duties (shipment_id, tariff_pct, taxable_value, taxes,
               total_duty) VALUES (?,?,?,?,?)""",
            (self.shipment_id, self.tariff_pct, self.taxable_value, self.taxes, self.total_duty),
        )
