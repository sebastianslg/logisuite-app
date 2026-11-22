#!/usr/bin/env python3
"""medir-lecturas.py — tiempos de las lecturas pesadas de la API, para comparar antes y después de un cambio.

    python deploy/medir-lecturas.py http://127.0.0.1:8000
    python deploy/medir-lecturas.py http://127.0.0.1:8000 --repeticiones 20 --ruta /api/shipments?limit=1000

Solo lee (GET). Calienta una vez y luego mide; informa mediana y p95 por ruta. Sin dependencias.
Útil con la memoria de respuestas apagada (WESTVANE_CACHE_TTL=0), para medir el cálculo y no la caché.
"""
import argparse
import statistics
import time
import urllib.request

RUTAS = ["/api/dashboard/summary", "/api/shipments?limit=1000", "/api/alerts", "/api/today"]


def tiempo(base: str, ruta: str) -> float:
    t0 = time.monotonic()
    with urllib.request.urlopen(urllib.request.Request(base + ruta, headers={"Accept-Encoding": "gzip"}), timeout=60) as r:
        r.read()
    return (time.monotonic() - t0) * 1000


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--repeticiones", type=int, default=10)
    ap.add_argument("--ruta", action="append", help="ruta a medir (se puede repetir); por defecto las cuatro pesadas")
    a = ap.parse_args()
    base = a.url.rstrip("/")
    rutas = a.ruta or RUTAS
    for ruta in rutas:
        try:
            tiempo(base, ruta)  # calentar (y comprobar que responde)
        except Exception as exc:
            print(f"  {ruta:34} no responde: {exc}")
            continue
        muestras = sorted(tiempo(base, ruta) for _ in range(a.repeticiones))
        p95 = muestras[min(len(muestras) - 1, int(len(muestras) * 0.95))]
        print(f"  {ruta:34} mediana {statistics.median(muestras):6.1f} ms · p95 {p95:6.1f} ms · peor {muestras[-1]:6.1f} ms")


if __name__ == "__main__":
    main()
