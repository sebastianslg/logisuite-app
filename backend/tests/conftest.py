"""Configuración común de las pruebas."""
import os

# Las pruebas escriben en la base directamente (sin HTTP) y leen enseguida: sin caché de lecturas.
os.environ.setdefault("WESTVANE_CACHE_TTL", "0")
