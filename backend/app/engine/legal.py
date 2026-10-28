"""
legal.py
Documentos legales (versiones vigentes y datos del responsable) y registro de aceptaciones.

- Las versiones viven aquí: cambiar el texto de un documento es subir su versión, y la app vuelve a pedir la
  aceptación a quien aceptó una anterior.
- Los datos del responsable del tratamiento salen de variables de entorno (LEGAL_*), así se completan en el
  servidor sin tocar el código. Si falta alguno, los documentos se muestran como borrador.
- La IP nunca se guarda en claro: se guarda un resumen SHA-256 con una sal secreta propia de la instalación
  (system_params), que sirve para probar que dos aceptaciones vinieron del mismo lugar sin revelar cuál.
"""
from __future__ import annotations

import csv
import hashlib
import io
import os
import re
import secrets

from app.database.db import run_query, run_write
from app.engine.common import OperationError, _now_iso, _user, audit, records

# Documentos y declaraciones que se pueden aceptar, con su versión vigente (fecha del texto)
VERSIONS: dict[str, str] = {
    "terminos": "2026-10-28",
    "privacidad": "2026-10-28",
    # Declaración al subir adjuntos o importar: que se tiene autorización de las personas cuyos datos van ahí
    "autorizacion_terceros": "2026-10-28",
}
CONTEXTS = {"primer_uso", "adjunto", "importacion", "configuracion"}
# Lo que se pide para empezar a usar la app
REQUIRED = ("terminos", "privacidad")

RESPONSIBLE_FIELDS = {
    "LEGAL_NAME": "name",
    "LEGAL_ID": "id_number",
    "LEGAL_CITY": "city",
    "LEGAL_ADDRESS": "address",
    "LEGAL_EMAIL": "email",
    "LEGAL_PHONE": "phone",
    "SERVER_LOCATION": "server_location",
}
_BROWSER_ID = re.compile(r"^[A-Za-z0-9-]{16,64}$")


def responsible() -> dict:
    """Datos del responsable desde el entorno; `complete` dice si están los indispensables."""
    data = {field: (os.environ.get(env) or "").strip() or None for env, field in RESPONSIBLE_FIELDS.items()}
    data["complete"] = all(data[k] for k in ("name", "id_number", "city", "email"))
    return data


def info() -> dict:
    return {"versions": VERSIONS, "required": list(REQUIRED), "responsible": responsible()}


def _salt() -> str:
    rows = run_query("SELECT param_value FROM system_params WHERE param_key = 'CONSENT_SALT'")
    if not rows.empty and rows.iloc[0]["param_value"]:
        return str(rows.iloc[0]["param_value"])
    salt = secrets.token_hex(16)
    run_write("INSERT OR IGNORE INTO system_params (param_key, param_value, description) VALUES (?,?,?)",
              ("CONSENT_SALT", salt, "Sal secreta para el resumen de IP del registro de aceptaciones"))
    return _salt()


def ip_hash(ip: str | None) -> str | None:
    if not ip:
        return None
    return hashlib.sha256(f"{_salt()}|{ip}".encode()).hexdigest()[:32]


def _check_browser(browser_id: str) -> str:
    if not _BROWSER_ID.match(browser_id or ""):
        raise OperationError("Identificador de navegador inválido.")
    return browser_id


def record(browser_id: str, subject: str | None, context: str, items: list[dict], ip: str | None,
           user_agent: str | None) -> dict:
    """Guarda una aceptación o revocación por cada elemento y devuelve el estado actualizado."""
    browser_id = _check_browser(browser_id)
    if context not in CONTEXTS:
        raise OperationError("Formulario de origen desconocido.")
    if not items:
        raise OperationError("No hay nada que registrar.")
    now = _now_iso()
    who = _user(subject)
    digest = ip_hash(ip)
    ua = (user_agent or "")[:200] or None
    for it in items:
        doc = it.get("document")
        if doc not in VERSIONS:
            raise OperationError(f"Documento desconocido: {doc}.")
        version = it.get("version") or VERSIONS[doc]
        if version != VERSIONS[doc]:
            raise OperationError(f"La versión {version} de {doc} ya no está vigente; recarga la página.")
        text = (it.get("text") or "").strip()
        if not text:
            raise OperationError("Falta el texto de la casilla aceptada.")
        accepted = 1 if it.get("accepted", True) else 0
        run_write(
            "INSERT INTO mm_consents (browser_id, subject, document, version, accepted, checkbox_text, context, "
            "ip_hash, user_agent, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (browser_id, who, doc, version, accepted, text[:500], context, digest, ua, now))
    docs = ", ".join(f"{it['document']} {'aceptado' if it.get('accepted', True) else 'revocado'}" for it in items)
    audit(who, "INSERT", "mm_consents", browser_id[:8], f"Consentimiento ({context}): {docs}")
    return status(browser_id)


def status(browser_id: str) -> dict:
    """Lo último que este navegador aceptó o revocó de cada documento, y si falta aceptar algo vigente."""
    browser_id = _check_browser(browser_id)
    rows = records(run_query(
        "SELECT document, version, accepted, created_at, subject, context FROM mm_consents c "
        "WHERE browser_id = ? AND consent_id = (SELECT MAX(consent_id) FROM mm_consents "
        "WHERE browser_id = c.browser_id AND document = c.document) ORDER BY document", (browser_id,)))
    latest = {r["document"]: r for r in rows}
    pending = [d for d in REQUIRED
               if not (d in latest and latest[d]["accepted"] == 1 and latest[d]["version"] == VERSIONS[d])]
    return {"browser_id": browser_id, "documents": latest, "pending": pending, "versions": VERSIONS}


def export_csv() -> str:
    """Todo el registro para entregarlo ante una consulta o reclamo (sin IP: solo su resumen)."""
    rows = records(run_query(
        "SELECT consent_id, created_at, subject, browser_id, document, version, accepted, context, checkbox_text, "
        "ip_hash, user_agent FROM mm_consents ORDER BY consent_id"))
    buf = io.StringIO()
    cols = ["consent_id", "created_at", "subject", "browser_id", "document", "version", "accepted", "context",
            "checkbox_text", "ip_hash", "user_agent"]
    w = csv.DictWriter(buf, fieldnames=cols)
    w.writeheader()
    for r in rows:
        w.writerow({k: r.get(k) for k in cols})
    return buf.getvalue()


def count() -> int:
    return int(run_query("SELECT COUNT(*) AS n FROM mm_consents").iloc[0]["n"])
