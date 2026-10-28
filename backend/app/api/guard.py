"""Protecciones de la API frente a abuso: límite de peticiones que escriben y tamaño máximo del cuerpo.

- Límite por cliente con ventana deslizante de 60 s, en memoria (un solo proceso de uvicorn): 120 escrituras
  por minuto en general y 20 para adjuntos e importaciones, que son las pesadas. Las lecturas no se limitan
  (las cubre la caché). Al pasarse responde 429 con `Retry-After`.
- El cliente se identifica por la primera IP de `X-Forwarded-For`: en producción la API no publica puertos y
  solo la alcanza el proxy de Next, que reenvía la IP que puso Caddy (Caddy no confía en ese encabezado si
  viene del navegador). Sin el encabezado, la IP de la conexión.
- Cuerpo de más de 16 MB: 413 (un adjunto de 10 MB en base64 ocupa unos 13,4 MB).

`WESTVANE_RATE_LIMIT=0` lo desactiva (pruebas); `WESTVANE_RATE_LIMIT=<n>` cambia el límite general.
"""
from __future__ import annotations

import os
import threading
import time
from collections import defaultdict, deque

WINDOW_S = 60.0
HEAVY_LIMIT = 20
MAX_BODY_BYTES = 16 * 1024 * 1024
_HEAVY = ("/attachments", "/import")

_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def general_limit() -> int:
    """Escrituras por minuto y cliente; 0 desactiva el límite. Se lee en cada llamada (las pruebas lo cambian)."""
    try:
        return max(0, int(os.environ.get("WESTVANE_RATE_LIMIT", "120")))
    except ValueError:
        return 120


def client_key(forwarded_for: str | None, peer: str | None) -> str:
    if forwarded_for:
        first = forwarded_for.split(",")[0].strip()
        if first:
            return first
    return peer or "desconocido"


def check_rate(key: str, path: str, now: float | None = None) -> float | None:
    """Registra la escritura y devuelve None si se permite, o los segundos que faltan para poder repetirla."""
    limit = general_limit()
    if limit == 0:
        return None
    heavy = any(h in path for h in _HEAVY)
    bucket_key = f"{key}|{'pesada' if heavy else 'general'}"
    cap = min(HEAVY_LIMIT, limit) if heavy else limit
    now = time.monotonic() if now is None else now
    with _lock:
        q = _hits[bucket_key]
        while q and now - q[0] >= WINDOW_S:
            q.popleft()
        if len(q) >= cap:
            return max(1.0, WINDOW_S - (now - q[0]))
        q.append(now)
        # Limpieza ocasional de clientes que ya no escriben, para que el diccionario no crezca sin fin
        if len(_hits) > 5000:
            for k in [k for k, v in _hits.items() if not v or now - v[-1] >= WINDOW_S]:
                del _hits[k]
    return None


def body_too_large(content_length: str | None) -> bool:
    try:
        return content_length is not None and int(content_length) > MAX_BODY_BYTES
    except ValueError:
        return True


def reset() -> None:
    """Para las pruebas."""
    with _lock:
        _hits.clear()
