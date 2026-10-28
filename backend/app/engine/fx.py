"""
fx.py
TRM oficial desde los datos abiertos del Estado (datos.gov.co, conjunto 32sa-8pi3, publicado por la
Superintendencia Financiera con la TRM certificada del Banco de la República).

Se consulta solo cuando alguien lo pide (botón en Configuración): no hay tareas en segundo plano. Si
el servidor no tiene salida a internet o el servicio no responde, se informa y la TRM manual sigue igual.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

from app.engine import operations as ops
from app.engine.common import OperationError

URL = "https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1"
SOURCE = "TRM oficial (datos.gov.co, Superfinanciera)"
TIMEOUT_S = 8


def fetch_latest() -> dict:
    """Última TRM publicada: {'rate', 'date'}."""
    try:
        with urllib.request.urlopen(urllib.request.Request(URL, headers={"Accept": "application/json"}),
                                    timeout=TIMEOUT_S) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
        raise OperationError(f"No se pudo consultar la TRM oficial ({exc}). Ingrésala a mano.")
    if not data:
        raise OperationError("El servicio de la TRM no devolvió datos. Ingrésala a mano.")
    try:
        rate = float(data[0]["valor"])
        date = str(data[0]["vigenciadesde"])[:10]
    except (KeyError, TypeError, ValueError):
        raise OperationError("La respuesta del servicio de la TRM no tiene el formato esperado.")
    return {"rate": rate, "date": date}


def update_from_official(user: str | None) -> dict:
    latest = fetch_latest()
    current = ops.get_fx()
    if current["rate"] == latest["rate"] and current["date"] == latest["date"]:
        return {"fx": current, "changed": False}
    return {"fx": ops.set_fx(latest["rate"], latest["date"], SOURCE, user), "changed": True}
