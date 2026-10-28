"""
notify.py
Avisos al celular con ntfy (app gratuita, sin cuenta) cuando pasa algo que pide atención: una incidencia en ruta
o el cierre de una vía o de un nodo con envíos afectados.

- Solo si hay NTFY_TOPIC en el entorno (el mismo de deploy/healthcheck.sh). Sin él, no hace nada.
- Se envía en un hilo aparte: la respuesta de la API no espera a ntfy y un fallo de red no rompe la operación.
- El tema de ntfy es público para quien conozca su nombre: usa uno difícil de adivinar. Los avisos llevan
  códigos de envío y ciudades, nunca datos de personas.
"""
from __future__ import annotations

import json
import os
import threading
import urllib.request

NTFY_URL = os.environ.get("NTFY_URL", "https://ntfy.sh")


def enabled() -> bool:
    return bool(os.environ.get("NTFY_TOPIC", "").strip())


_PRIORITY = {"default": 3, "high": 4}


def _post(topic: str, title: str, message: str, tags: str, priority: str, click: str | None) -> None:
    # Publicación en JSON: admite tildes y eñes en el título (los encabezados HTTP no)
    payload = {"topic": topic, "title": title, "message": message, "tags": [tags], "priority": _PRIORITY.get(priority, 3)}
    if click:
        payload["click"] = click
    req = urllib.request.Request(NTFY_URL, data=json.dumps(payload).encode("utf-8"),
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        urllib.request.urlopen(req, timeout=8).close()
    except Exception:
        pass  # sin red o ntfy caído: el aviso se pierde, la operación sigue


def send(title: str, message: str, tags: str = "warning", priority: str = "default", path: str | None = None) -> bool:
    """Envía el aviso en segundo plano. `path` (p. ej. /envios/LS-1) abre esa página al tocar el aviso."""
    topic = os.environ.get("NTFY_TOPIC", "").strip()
    if not topic:
        return False
    domain = os.environ.get("DOMAIN", "").strip()
    click = f"https://{domain}{path}" if domain and path else None
    threading.Thread(target=_post, args=(topic, title, message[:400], tags, priority, click), daemon=True).start()
    return True
