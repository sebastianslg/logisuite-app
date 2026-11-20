"""
system_status.py
Estado del servidor visto desde la propia API, para la pantalla de Configuración (solo administradores).

Es lo que se puede medir desde dentro del contenedor con la biblioteca estándar: disco del volumen de datos, memoria y
carga (en Linux, las del equipo), tamaño de la base y de los adjuntos, cuánto lleva encendida la API y si hay correo.
Lo que vive fuera del contenedor (los respaldos, los otros contenedores) sigue en `deploy/estado.sh`.
"""
from __future__ import annotations

import json
import os
import shutil
import time
from datetime import datetime

import app.database.db as db
from app.database.db import run_query
from app.engine import mail
from app.engine.common import audit_retention_days

STARTED = time.time()
WARN_DISK_PCT = 85
WARN_MEM_AVAILABLE_PCT = 10
BACKUP_MAX_AGE_H = 36   # el respaldo corre a diario: más de 36 h sin otro es que algo falló


def _dir_size(path: str, limit_s: float = 2.0) -> int | None:
    """Bytes de una carpeta; None si no existe o tardaría demasiado (no debe frenar la pantalla)."""
    if not os.path.isdir(path):
        return None
    total, t0 = 0, time.time()
    for root, _dirs, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
        if time.time() - t0 > limit_s:
            return None
    return total


def _memory() -> dict | None:
    """Memoria del equipo desde /proc/meminfo (solo Linux)."""
    try:
        info = {}
        with open("/proc/meminfo", encoding="ascii") as fh:
            for line in fh:
                k, _, v = line.partition(":")
                info[k] = int(v.split()[0]) * 1024
        total, avail = info["MemTotal"], info["MemAvailable"]
        return {"total": total, "available": avail, "used_pct": round(100 * (total - avail) / total, 1)}
    except (OSError, KeyError, ValueError, ZeroDivisionError):
        return None


def backup_marker() -> str:
    return os.path.join(os.path.dirname(db.DB_PATH) or ".", ".ultimo-respaldo")


def backup_info(now: datetime) -> dict | None:
    """Último respaldo bueno, según la marca que deja deploy/backup.sh junto a la base. None si nunca se ha hecho (o si la
    app corre sin ese script, como en desarrollo)."""
    try:
        with open(backup_marker(), encoding="utf-8") as fh:
            data = json.load(fh)
        at = datetime.fromtimestamp(int(data["at"]))
    except (OSError, ValueError, KeyError, TypeError):
        return None
    return {"at": at.isoformat(timespec="seconds"), "age_h": round(max(0.0, (now - at).total_seconds() / 3600), 1),
            "db_bytes": int(data.get("db_bytes") or 0), "adjuntos_bytes": int(data.get("adjuntos_bytes") or 0),
            "copies": int(data.get("copies") or 0)}


def backup_stale(now: datetime) -> str | None:
    """Mensaje si el respaldo está atrasado; None si está al día. En producción, no tener marca también es un problema."""
    info = backup_info(now)
    if info is None:
        return "No hay registro de ningún respaldo del servidor." if os.environ.get("WESTVANE_ENV") == "production" else None
    if info["age_h"] > BACKUP_MAX_AGE_H:
        return f"El último respaldo es de hace {int(info['age_h'])} horas: revisa que el cron del servidor siga corriendo."
    return None


def status(now: datetime) -> dict:
    data_dir = os.path.dirname(db.DB_PATH) or "."
    disk = shutil.disk_usage(data_dir)
    disk_pct = round(100 * disk.used / disk.total, 1)
    mem = _memory()
    load = None
    if hasattr(os, "getloadavg"):
        l1, l5, l15 = os.getloadavg()
        load = {"1": round(l1, 2), "5": round(l5, 2), "15": round(l15, 2), "cores": os.cpu_count() or 1}
    db_bytes = os.path.getsize(db.DB_PATH) if os.path.exists(db.DB_PATH) else None
    counts = {
        "shipments": int(run_query("SELECT COUNT(*) AS n FROM mm_shipments").iloc[0]["n"]),
        "users_active": int(run_query("SELECT COUNT(*) AS n FROM users WHERE active = 1").iloc[0]["n"]),
        "audit": int(run_query("SELECT COUNT(*) AS n FROM audit_log").iloc[0]["n"]),
    }
    warnings = []
    if disk_pct >= WARN_DISK_PCT:
        warnings.append(f"El disco está al {disk_pct} %: libera espacio o amplíalo.")
    if mem and 100 - mem["used_pct"] < WARN_MEM_AVAILABLE_PCT:
        warnings.append("Queda poca memoria disponible en el servidor.")
    if load and load["5"] > load["cores"] * 1.5:
        warnings.append("El servidor lleva varios minutos con la carga alta.")
    stale = backup_stale(now)
    if stale:
        warnings.append(stale)
    return {
        "now": now.isoformat(timespec="seconds"),
        "uptime_s": int(time.time() - STARTED),
        "disk": {"total": disk.total, "used": disk.used, "free": disk.free, "used_pct": disk_pct},
        "memory": mem, "load": load,
        "database_bytes": db_bytes,
        "attachments_bytes": _dir_size(os.path.join(data_dir, "adjuntos")),
        "counts": counts,
        "backup": backup_info(now),
        "mail_configured": mail.configured(),
        "audit_retention_days": audit_retention_days(),
        "warnings": warnings,
    }
