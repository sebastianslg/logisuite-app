"""
common.py
Piezas compartidas por operaciones, flota y bodegas: error de operación, firma del
usuario (nombre declarado, sin autenticación) e historial de cambios en audit_log.
Viven aquí para que los módulos no se importen en círculo.
"""
from __future__ import annotations

from datetime import datetime

import pandas as pd

from app.database.db import run_write

ANON = "anónimo"


class OperationError(ValueError):
    """Dato inválido o acción imposible (se responde con 4xx)."""


def _now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _user(name: str | None) -> str:
    name = (name or "").strip()
    return name[:60] if name else ANON


def audit(user: str | None, action: str, table: str, record: str | None, detail: str) -> None:
    run_write("""INSERT INTO audit_log (username, action, table_name, record_id, detail, timestamp)
                 VALUES (?,?,?,?,?,?)""", (_user(user), action, table, record, detail, _now_iso()))


def records(df: "pd.DataFrame") -> list:
    """Filas como diccionarios con los vacíos de la base convertidos en None (NaN rompe el JSON de la API)."""
    return df.astype(object).where(pd.notna(df), None).to_dict(orient="records")
