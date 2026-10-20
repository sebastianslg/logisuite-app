"""
Peajes por tramo terrestre: tabla editable, carga desde Excel o CSV y exportación.

Cada tramo terrestre (mm_links con mode = 'terrestre') guarda el peaje que paga un
despacho por recorrerlo, en pesos. El motor lo convierte a dólares con la TRM.
Un valor en 0 significa "sin tarifa cargada", no "sin peaje": la nota y la fuente
dicen qué se sabe de cada tramo.
"""
from __future__ import annotations

import base64
import io
import re
from datetime import datetime

import pandas as pd

from app.database.db import run_query, run_write
from app.engine.common import OperationError, audit

COLUMNAS_OBLIGATORIAS = {"link_id", "peaje_cop"}
COLUMNAS_EXPORTACION = ["link_id", "corredor", "origen", "destino", "distancia_km", "peaje_cop", "nota", "fuente"]


def list_tolls() -> list:
    """Todos los tramos terrestres activos, con su peaje y su procedencia."""
    return run_query(
        """
        SELECT l.link_id, l.corridor, l.origin_code, l.dest_code,
               o.name AS origin, d.name AS destination, l.distance_km,
               l.tolls_cop, l.tolls_note, l.tolls_source, l.tolls_updated_at
        FROM mm_links l
        JOIN mm_nodes o ON o.node_code = l.origin_code
        JOIN mm_nodes d ON d.node_code = l.dest_code
        WHERE l.mode = 'terrestre' AND l.active = 1
        ORDER BY l.corridor, l.link_id
        """
    ).to_dict(orient="records")


def _pesos(value) -> float:
    """Pesos enteros desde un número o texto como '$ 29.400' o '29400'."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        raise OperationError("El peaje está vacío.")
    if isinstance(value, (int, float)):
        if value < 0:
            raise OperationError("El peaje no puede ser negativo.")
        return float(round(value))
    digits = re.sub(r"[^\d]", "", str(value))
    if not digits:
        raise OperationError(f"'{value}' no es un valor en pesos.")
    return float(digits)


def update_toll(link_id: int, tolls_cop, note: str | None, source: str | None, usuario: str | None) -> dict:
    """Guarda el peaje de un tramo y lo deja en el historial."""
    tolls = _pesos(tolls_cop)
    if run_query("SELECT link_id FROM mm_links WHERE link_id = ? AND mode = 'terrestre'", (link_id,)).empty:
        raise LookupError(f"No existe el tramo terrestre {link_id}.")
    now = datetime.now().isoformat(timespec="seconds")
    run_write(
        "UPDATE mm_links SET tolls_cop = ?, tolls_note = ?, tolls_source = ?, tolls_updated_at = ? WHERE link_id = ?",
        (tolls, (note or None), (source or None), now, link_id),
    )
    audit(usuario, "UPDATE", "mm_links", str(link_id), f"Peaje por despacho: {tolls:,.0f} COP")
    return {"link_id": link_id, "tolls_cop": tolls}


def import_file(filename: str, content_b64: str, usuario: str | None) -> dict:
    """Carga peajes desde un Excel (.xlsx) o CSV. Columnas: link_id, peaje_cop y opcionales nota, fuente.
    Las filas con error se reportan y no detienen la carga del resto."""
    raw = base64.b64decode(content_b64)
    if filename.lower().endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(raw), dtype=object)
    else:
        df = pd.read_csv(io.BytesIO(raw), dtype=object, sep=None, engine="python")
    df.columns = [str(c).strip().lower() for c in df.columns]
    faltan = COLUMNAS_OBLIGATORIAS - set(df.columns)
    if faltan:
        raise OperationError(f"Faltan columnas: {', '.join(sorted(faltan))}.")

    actualizados, errores = 0, []
    for fila, row in df.iterrows():
        numero = fila + 2  # fila en la hoja: encabezado en la 1
        try:
            link_id = int(float(row["link_id"]))
            update_toll(link_id, row["peaje_cop"], _texto(row.get("nota")), _texto(row.get("fuente")), usuario)
            actualizados += 1
        except (OperationError, LookupError, ValueError, TypeError) as exc:
            errores.append({"fila": int(numero), "error": str(exc)})
    return {"actualizados": actualizados, "errores": errores}


def export_csv() -> str:
    """La tabla completa en CSV, lista para editar y volver a cargar."""
    filas = [
        {"link_id": t["link_id"], "corredor": t["corridor"], "origen": t["origin"], "destino": t["destination"],
         "distancia_km": round(t["distance_km"], 1), "peaje_cop": int(t["tolls_cop"] or 0),
         "nota": t["tolls_note"] or "", "fuente": t["tolls_source"] or ""}
        for t in list_tolls()
    ]
    return pd.DataFrame(filas, columns=COLUMNAS_EXPORTACION).to_csv(index=False)


def _texto(value) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    texto = str(value).strip()
    return texto or None
