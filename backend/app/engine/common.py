"""
common.py
Piezas compartidas por operaciones, flota y bodegas: error de operación, firma del
usuario (nombre declarado, sin autenticación) e historial de cambios en audit_log.
Viven aquí para que los módulos no se importen en círculo.
"""
from __future__ import annotations

from contextvars import ContextVar
import logging
import os
from datetime import datetime, timedelta

import pandas as pd

from app.database.db import run_query, run_write

ANON = "anónimo"


class OperationError(ValueError):
    """Dato inválido o acción imposible (se responde con 4xx)."""


def _now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


# Usuario de la sesión de esta petición (lo fija el middleware `session_identity` de main.py). Con sesión válida, el
# historial se firma con la cuenta real y se ignora el nombre que el navegador declare: no se puede firmar como otra
# persona. Sin sesión, la app sigue como siempre: el nombre es declarado.
SESSION_USER: ContextVar[str | None] = ContextVar("session_user", default=None)


def _user(name: str | None) -> str:
    real = SESSION_USER.get()
    if real:
        return real[:60]
    name = (name or "").strip()
    return name[:60] if name else ANON


def audit(user: str | None, action: str, table: str, record: str | None, detail: str) -> None:
    run_write("""INSERT INTO audit_log (username, action, table_name, record_id, detail, timestamp)
                 VALUES (?,?,?,?,?,?)""", (_user(user), action, table, record, detail, _now_iso()))


def audit_retention_days() -> int:
    """Días que se conserva el historial (AUDIT_RETENTION_DAYS); 0 = para siempre (lo de por defecto)."""
    try:
        return max(0, int(os.environ.get("AUDIT_RETENTION_DAYS", "0")))
    except ValueError:
        return 0


def purge_old_audit(now: datetime) -> int:
    """Borra las líneas del historial más viejas que el plazo. Devuelve cuántas borró.

    El historial crecía sin límite: una línea por cada cambio, para siempre. Con el plazo puesto, se conserva lo reciente y
    se va borrando lo viejo. Se deja constancia en el registro del servidor (no en el propio historial, que es lo que se
    está recortando)."""
    days = audit_retention_days()
    if not days:
        return 0
    cutoff = (now - timedelta(days=days)).isoformat(timespec="seconds")
    n = int(run_query("SELECT COUNT(*) AS n FROM audit_log WHERE timestamp < ?", (cutoff,)).iloc[0]["n"])
    if n:
        run_write("DELETE FROM audit_log WHERE timestamp < ?", (cutoff,))
        logging.getLogger("westvane.audit").info(
            "Historial: %d línea(s) anteriores al %s borradas por el plazo de %d días", n, cutoff[:10], days)
    return n


def records(df: "pd.DataFrame") -> list:
    """Filas como diccionarios con los vacíos de la base convertidos en None (NaN rompe el JSON de la API)."""
    return df.astype(object).where(pd.notna(df), None).to_dict(orient="records")
