"""Configuración común de las pruebas."""
import os

# Las pruebas escriben en la base directamente (sin HTTP) y leen enseguida: sin caché de lecturas.
os.environ.setdefault("WESTVANE_CACHE_TTL", "0")
# Sin límite de escrituras: las pruebas escriben cientos de veces por minuto (test_guard lo activa por su cuenta)
os.environ.setdefault("WESTVANE_RATE_LIMIT", "0")
