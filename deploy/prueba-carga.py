#!/usr/bin/env python3
"""Prueba de carga ligera: simula N personas navegando a la vez y mide tiempos de respuesta.

    # Con sesión (recomendado: la app pide ingreso y sin sesión las páginas redirigen a /ingresar)
    CARGA_USUARIO=profesor CARGA_CLAVE=... python3 deploy/prueba-carga.py https://westvane.duckdns.org --usuarios 10

    # Solo lo público (presentación, metodología, créditos y la API de lectura)
    python3 deploy/prueba-carga.py https://westvane.duckdns.org --usuarios 8

La cuenta se toma de las variables de entorno CARGA_USUARIO y CARGA_CLAVE: no se escriben en el código ni en el comando
(el historial de la terminal guardaría la clave). Con ellas, el script hace POST /api/auth/password y manda la cookie
`westvane_session` en cada petición. Sin ellas, avisa y mide solo lo público: las páginas de la app se cuentan aparte como
«redirigidas al ingreso», porque un 200 del ingreso no dice nada del rendimiento.

Solo lee (GET) y un POST para entrar; no crea datos. Sin dependencias. Úsala solo contra tu propio servidor.
"""
import argparse
import os
import statistics
import threading
import time
import urllib.error
import urllib.request

API = ["/api/dashboard/summary", "/api/shipments", "/api/fleet/live", "/api/alerts", "/api/network/multimodal",
       "/api/history?days=30"]
PAGINAS = ["/", "/envios", "/hoy", "/red", "/flota", "/historial", "/clientes"]
PUBLICAS = ["/", "/metodologia", "/creditos", "/terminos"]


def entrar(base: str, usuario: str, clave: str) -> str:
    """POST /api/auth/password y devuelve el token de la sesión."""
    import json
    datos = json.dumps({"identifier": usuario, "password": clave}).encode("utf-8")
    req = urllib.request.Request(f"{base}/api/auth/password", data=datos,
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())["token"]


def worker(base, rutas, cookie, stop, results, lock, pause):
    i = 0
    while time.monotonic() < stop:
        path = rutas[i % len(rutas)]
        i += 1
        kind = "página" if path in PAGINAS or path in PUBLICAS else "api"
        headers = {"Accept-Encoding": "gzip"}
        if cookie:
            headers["Cookie"] = cookie
        t0 = time.monotonic()
        redirected = False
        try:
            with urllib.request.urlopen(urllib.request.Request(base + path, headers=headers), timeout=30) as r:
                r.read()
                ok = r.status == 200
                redirected = "/ingresar" in r.url
        except urllib.error.HTTPError as exc:
            ok = exc.code == 200
            redirected = exc.code in (301, 302, 303, 307, 308)
        except Exception:
            ok, redirected = False, False
        dt = time.monotonic() - t0
        with lock:
            results.append((kind, ok, dt, path, redirected))
        time.sleep(pause)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--usuarios", type=int, default=5)
    ap.add_argument("--segundos", type=int, default=20)
    ap.add_argument("--pausa", type=float, default=0.5, help="segundos entre acciones de cada persona")
    a = ap.parse_args()
    base = a.url.rstrip("/")

    usuario = os.environ.get("CARGA_USUARIO", "").strip()
    clave = os.environ.get("CARGA_CLAVE", "")
    cookie = ""
    if usuario and clave:
        try:
            cookie = f"westvane_session={entrar(base, usuario, clave)}"
            print(f"sesión iniciada como {usuario}")
        except Exception as exc:
            print(f"No se pudo entrar como {usuario}: {exc}")
            print("Se mide solo lo público.")
    else:
        print("Sin CARGA_USUARIO/CARGA_CLAVE: se mide solo lo público "
              "(las páginas de la app redirigen a /ingresar y se cuentan aparte).")

    rutas = PAGINAS + API if cookie else PUBLICAS + API
    stop = time.monotonic() + a.segundos
    results, lock = [], threading.Lock()
    ts = [threading.Thread(target=worker, args=(base, rutas, cookie, stop, results, lock, a.pausa)) for _ in range(a.usuarios)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    print(f"{a.usuarios} usuarios durante {a.segundos} s contra {base}")
    for kind in ("página", "api"):
        rows = [r for r in results if r[0] == kind]
        if not rows:
            continue
        times = sorted(r[2] for r in rows)
        bad = sum(1 for r in rows if not r[1])
        redir = sum(1 for r in rows if r[4])
        p95 = times[min(len(times) - 1, int(len(times) * 0.95))]
        extra = f" · {redir} redirigidas al ingreso" if redir else ""
        print(f"  {kind:7} {len(rows):5} peticiones · {bad} con error · mediana {statistics.median(times)*1000:.0f} ms · "
              f"p95 {p95*1000:.0f} ms · peor {times[-1]*1000:.0f} ms{extra}")
    print(f"  {len(results) / a.segundos:.1f} peticiones por segundo")

    # Las tres rutas más lentas: saber si lo que pesa es el mapa, una lista o el resumen
    por_ruta = {}
    for kind, ok, dt, path, redirected in results:
        if not redirected:
            por_ruta.setdefault(path, []).append(dt)
    ranking = sorted(((statistics.median(v), max(v), k) for k, v in por_ruta.items()), reverse=True)[:3]
    if ranking:
        print("  más lentas (mediana):")
        for mediana, peor, path in ranking:
            print(f"    {path:32} {mediana*1000:6.0f} ms · peor {peor*1000:.0f} ms")


if __name__ == "__main__":
    main()
