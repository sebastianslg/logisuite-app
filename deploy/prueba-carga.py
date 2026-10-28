#!/usr/bin/env python3
"""Prueba de carga ligera: simula N personas navegando a la vez y mide tiempos de respuesta.

    python3 deploy/prueba-carga.py https://westvane.duckdns.org --usuarios 10 --segundos 30

Solo lee (GET) las páginas y lecturas de la API que usa una persona al navegar; no crea datos. Al final
muestra peticiones, errores, mediana, p95 y el peor tiempo por tipo. Sin dependencias (biblioteca estándar).
Úsala solo contra tu propio servidor.
"""
import argparse
import statistics
import threading
import time
import urllib.request

PAGES = ["/", "/envios", "/red", "/flota", "/historial", "/clientes"]
API = ["/api/dashboard/summary", "/api/shipments", "/api/fleet/live", "/api/alerts", "/api/network/multimodal", "/api/history?days=30"]


def worker(base, stop, results, lock, pause):
    i = 0
    while time.monotonic() < stop:
        path = (PAGES + API)[i % (len(PAGES) + len(API))]
        i += 1
        kind = "página" if path in PAGES else "api"
        t0 = time.monotonic()
        try:
            with urllib.request.urlopen(urllib.request.Request(base + path, headers={"Accept-Encoding": "gzip"}), timeout=30) as r:
                r.read()
                ok = r.status == 200
        except Exception:
            ok = False
        dt = time.monotonic() - t0
        with lock:
            results.append((kind, ok, dt))
        time.sleep(pause)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--usuarios", type=int, default=5)
    ap.add_argument("--segundos", type=int, default=20)
    ap.add_argument("--pausa", type=float, default=0.5, help="segundos entre acciones de cada persona")
    a = ap.parse_args()
    base = a.url.rstrip("/")
    stop = time.monotonic() + a.segundos
    results, lock = [], threading.Lock()
    ts = [threading.Thread(target=worker, args=(base, stop, results, lock, a.pausa)) for _ in range(a.usuarios)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    print(f"{a.usuarios} usuarios durante {a.segundos} s contra {base}")
    for kind in ("página", "api"):
        rows = [r for r in results if r[0] == kind]
        if not rows:
            continue
        times = sorted(r[2] for r in rows)
        bad = sum(1 for r in rows if not r[1])
        p95 = times[min(len(times) - 1, int(len(times) * 0.95))]
        print(f"  {kind:7} {len(rows):5} peticiones · {bad} con error · mediana {statistics.median(times)*1000:.0f} ms · p95 {p95*1000:.0f} ms · peor {times[-1]*1000:.0f} ms")
    print(f"  {len(results) / a.segundos:.1f} peticiones por segundo")


if __name__ == "__main__":
    main()
