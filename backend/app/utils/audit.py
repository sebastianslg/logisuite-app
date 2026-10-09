"""
audit.py
Registro de auditoría: quién hizo qué cambio, sobre qué tabla y cuándo.
Se invoca desde la API cada vez que se ejecuta una operación de escritura.
"""
from datetime import datetime
from typing import Optional

from app.database.db import run_query, run_write


def log_action(action: str, table_name: str, record_id: Optional[str] = None,
                detail: str = "", username: str = "sistema") -> None:
    """Registra una acción. Nunca lanza excepción hacia quien la invoca: la
    auditoría no debe romper el flujo de trabajo si algo falla."""
    try:
        run_write(
            """INSERT INTO audit_log (username, action, table_name, record_id, detail, timestamp)
               VALUES (?,?,?,?,?,?)""",
            (username, action, table_name, str(record_id) if record_id is not None else None,
             detail, datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        )
    except Exception:
        pass


def get_audit_log(limit: int = 500, username: str = None, table_name: str = None) -> list:
    """Devuelve el historial de auditoría, opcionalmente filtrado."""
    sql = "SELECT * FROM audit_log WHERE 1=1"
    params = []
    if username:
        sql += " AND username = ?"
        params.append(username)
    if table_name:
        sql += " AND table_name = ?"
        params.append(table_name)
    sql += " ORDER BY audit_id DESC LIMIT ?"
    params.append(limit)
    return run_query(sql, tuple(params)).to_dict(orient="records")


def audit_summary() -> dict:
    """Resumen agregado para el panel de administración."""
    total = run_query("SELECT COUNT(*) c FROM audit_log").iloc[0]["c"]
    by_action = run_query(
        "SELECT action, COUNT(*) n FROM audit_log GROUP BY action ORDER BY n DESC"
    ).to_dict(orient="records")
    by_user = run_query(
        "SELECT username, COUNT(*) n FROM audit_log GROUP BY username ORDER BY n DESC"
    ).to_dict(orient="records")
    return {"total": int(total), "by_action": by_action, "by_user": by_user}
